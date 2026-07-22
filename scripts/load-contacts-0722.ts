/** Write verified phone/email/contact/address onto the hot hiring-signal leads.
 * Only fills EMPTY fields — never overwrites something already in the CRM.
 * Dry-run by default; --commit to write. */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const TENANT = 'sc-deburring';

type C = { match: string; ph: string; em?: string; pm?: string; pm_title?: string; address?: string; note?: string };

const CONTACTS: C[] = [
  { match: 'Advanced Metal Mfg', ph: '(805) 322-4161', em: 'office@advancedmetalmfg.com', address: '49 Strathearn Place, Simi Valley, CA 93065', note: 'AS9100/ISO9001 precision sheet metal, ~41,500 sqft. Laser + punch work = heavy edge/hole deburr. No named contact published — ask for whoever handles outside processing.' },
  { match: 'Axis Precision Prototyping', ph: '1-800-864-5457', em: 'sales@axisproductdevelopment.com', pm: 'Brandon Esmaeilpour', pm_title: 'CEO', address: '633 Young Street, Santa Ana, CA 92705', note: 'NAME CHECK: no entity "Axis Precision Prototyping" exists — almost certainly Axis Product Development Inc (same city/industry). Confirm on the call. 800# is a general queue.' },
  { match: 'Johnson Manufacturing', ph: '(714) 903-0393', em: 'Rene.Rua@johnsonmfginc.com', pm: 'Rene Rua', pm_title: 'Purchasing (ext 108)', address: '15201 Connector Ln, Huntington Beach, CA 92649', note: 'AS9100 aero shop (Boeing, C-17, Parker Hannifin). Ask for Rene Rua ext 108 (buys outside services). Backup: Rene Ramirez, Production Mgr ext 105 — he feels the deburr bottleneck.' },
  { match: 'Neill Aircraft', ph: '(562) 432-7981', em: 'jcastro@neillaircraft.com', pm: 'Juan Castro', pm_title: 'Company point of contact (ext 263)', address: '1260 West 15th Street, Long Beach, CA 90813', note: 'Juan Castro direct ext 263. Dept inboxes: sales@, estimating@, quality@neillaircraft.com. President/CEO Judy Carpenter.' },
  { match: 'Premier Gear', ph: '(951) 278-5505', em: 'marshallj@premiergearinc.com', pm: 'Marshall Jarnagan', pm_title: 'Purchasing / Scheduling (ext 222)', address: '2360 Pomona Road, Corona, CA 92878', note: 'Marshall Jarnagan ext 222 handles purchasing AND scheduling — he owns the late-parts pain.' },
  { match: 'RTC Aerospace', ph: '(818) 407-0291', em: 'sales@rtcaerospace.com', pm: 'Jason Keck', pm_title: 'General Manager, Chatsworth Division', address: '20409 Prairie Street, Chatsworth, CA 91311', note: 'GM Jason Keck. 10 min from the shop down the 118 — best walk-in candidate on the list.' },
  { match: 'Senior Aerospace Spencer', ph: '(818) 350-8499', address: '28510 Industry Drive, Valencia, CA 91355', note: 'Part of Senior plc. No published contact name — ask for outside processing / supply chain.' },
  { match: 'Sonfarrel', ph: '(714) 630-7280', em: 'Sales@son-aero.com', pm: 'Alberto Silva', pm_title: 'Plant Manager', address: '3010 E. La Jolla Street, Anaheim, CA 92806', note: 'Alberto Silva is the PLANT MANAGER — he owns the bench, best person for an overflow conversation.' },
];

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function main() {
  const commit = process.argv.includes('--commit');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', TENANT).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

  console.log(`MODE: ${commit ? 'COMMIT' : 'DRY-RUN'}\n`);
  let updated = 0;
  for (const c of CONTACTS) {
    const n = norm(c.match);
    const lead = all.find((l) => {
      const ln = norm(l.co);
      return ln.length > 3 && (ln.includes(n) || n.includes(ln));
    });
    if (!lead) { console.log(`  ?? no lead matched: ${c.match}`); continue; }

    // Only fill blanks — never clobber data already in the CRM.
    const patch: Record<string, unknown> = {};
    if (!lead.ph?.trim() && c.ph) patch.ph = c.ph;
    if (!lead.em?.trim() && c.em) patch.em = c.em;
    if (!lead.pm?.trim() && c.pm) patch.pm = c.pm;
    if (!lead.pm_title?.trim() && c.pm_title) patch.pm_title = c.pm_title;
    if (!lead.address?.trim() && c.address) patch.address = c.address;
    if (c.note && !(lead.notes || '').includes(c.note.slice(0, 30))) {
      patch.notes = lead.notes ? `${lead.notes}\n[2026-07-22] CONTACT — ${c.note}` : `[2026-07-22] CONTACT — ${c.note}`;
    }
    if (!Object.keys(patch).length) { console.log(`  = ${lead.co}: nothing to add`); continue; }
    console.log(`  + ${lead.co}: ${Object.keys(patch).join(', ')}`);
    updated++;
    if (commit) await db.collection('leads').doc(lead.id).set(patch, { merge: true });
  }
  console.log(`\n${commit ? 'Updated' : 'Would update'} ${updated} leads. Existing values never overwritten.`);
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.message || e); process.exit(1); });
