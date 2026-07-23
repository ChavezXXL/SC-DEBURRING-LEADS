/** Reconcile the CRM with what actually happened in Gmail (2026-07-21/22):
 *  - mark cold intros as `emailed`
 *  - set the 2 real replies to `interested`
 *  - flag the 3 bounced addresses (don't upgrade, note the dead email)
 *  - add the 3 emailed shops that aren't in the CRM
 * Matches by EMAIL address (reliable) to avoid fuzzy-name false positives.
 * Dry-run by default; --commit to write. Never downgrades a warmer status. */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const TENANT = 'sc-deburring';
const D = '2026-07-22';
const COLDER = new Set(['new', 'called', 'voicemail']); // safe to move up to emailed

const EMAILED = [
  'info@aeromechanism.com', 'sales@axisproductdevelopment.com', 'info@kdprecision.com',
  'sales@usswiss.com', 'info@meanseng.com', 'sales@veridiam.com', 'rapidquote@alvamfg.com',
  'sales@flightworksinc.com', 'sales@itldental.com', 'sales@haskel.com', 'info@avalon.aero',
  'quotes@savagemachininginc.com',
];
const INTERESTED: Record<string, string> = {
  'info@aeromechanism.com': 'REPLIED 2026-07-22: "Do you do polishing too? Like shine finish?" You confirmed polishing/buffing incl. shine and asked for a photo/drawing. Palminder Sehmbey, 818-886-1855, Chatsworth (15 min). Next: get the photo, quote it.',
  'sales@axisproductdevelopment.com': 'REPLIED 2026-07-22 (Jeremy Robinson, jrobinson@axisproductdevelopment.com): "Your company looks interesting, might help us with certain projects." You explained hand deburring + time/qty pricing. Next: get one part/drawing to quote.',
};
const BOUNCED: Record<string, string> = {
  'eric.grupp@crissair.com': 'EMAIL BOUNCED 2026-07-22 — eric.grupp@crissair.com rejected by mail server. Use phone 661-367-3300. They are hiring a deburr tech right now.',
  'info@precisiononemedical.com': 'EMAIL BOUNCED 2026-07-22 — info@precisiononemedical.com does not exist. Need a new contact (site/phone) before any resend.',
  'info@anacapaindustries.com': 'EMAIL BOUNCED 2026-07-22 — info@anacapaindustries.com does not exist. Need a new contact before resend.',
};
const ADD = [
  { co: 'Jay Manufacturing', em: 'Production@jaymfg.com', pm: 'Daniel', region: 'Other', note: 'Emailed 2026-07-22 (cold intro). Mark Jordan auto-reply directed to Daniel for production/purchasing.' },
  { co: 'Proaxxis Manufacturing', em: 'info@proaxxismanufacturing.com', region: 'Other', note: 'Emailed 2026-07-22 (cold intro). Complex precision machining.' },
  { co: 'Ramp Engineering', em: 'sales@rampengineering.com', region: 'Other', note: 'Emailed 2026-07-09 + bumped 2026-07-22. NOT the same as Ram Aerospace.' },
];

const stamp = (l: any, line: string) => (l.notes ? `${l.notes}\n${line}` : line);

async function main() {
  const commit = process.argv.includes('--commit');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', TENANT).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const byEmail = (em: string) => all.find((l) => (l.em || '').toLowerCase().trim() === em.toLowerCase());

  console.log(`MODE: ${commit ? 'COMMIT' : 'DRY-RUN'}\n`);
  let changed = 0;
  const write = async (id: string, patch: Record<string, unknown>, label: string) => {
    console.log(`  ${label}`); changed++;
    if (commit) await db.collection('leads').doc(id).set(patch, { merge: true });
  };

  console.log('--- REPLIES -> interested ---');
  for (const [em, note] of Object.entries(INTERESTED)) {
    const l = byEmail(em);
    if (!l) { console.log(`  ?? no lead for ${em}`); continue; }
    const patch: any = { notes: stamp(l, `[${D}] ${note}`), lastContactedAt: new Date().toISOString() };
    if (l.status !== 'interested' && l.status !== 'quote' && l.status !== 'client') patch.status = 'interested';
    await write(l.id, patch, `${l.co} -> interested`);
  }

  console.log('\n--- BOUNCES -> flag (no upgrade) ---');
  for (const [em, note] of Object.entries(BOUNCED)) {
    const l = byEmail(em);
    if (!l) { console.log(`  ?? no lead for ${em}`); continue; }
    if ((l.notes || '').includes('BOUNCED 2026-07-22')) { console.log(`  = ${l.co}: already flagged`); continue; }
    await write(l.id, { notes: stamp(l, `[${D}] ${note}`) }, `${l.co}: flagged bad email`);
  }

  console.log('\n--- COLD INTROS -> emailed ---');
  for (const em of EMAILED) {
    if (INTERESTED[em]) continue;
    const l = byEmail(em);
    if (!l) { console.log(`  ?? no lead for ${em}`); continue; }
    const patch: any = { notes: stamp(l, `[${D}] Emailed — cold intro sent (your approved voice).`), lastContactedAt: new Date().toISOString(), touchCount: (l.touchCount || 0) + 1 };
    if (COLDER.has(l.status)) patch.status = 'emailed';
    await write(l.id, patch, `${l.co} (${l.status}${patch.status ? ' -> emailed' : ''})`);
  }

  console.log('\n--- ADD missing emailed shops ---');
  for (const a of ADD) {
    if (byEmail(a.em)) { console.log(`  = ${a.co}: already in CRM`); continue; }
    const id = a.co.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).slice(2, 7);
    const lead = {
      id, tenantId: TENANT, status: 'emailed', t: 2, r: a.region, co: a.co, city: '',
      ph: '', em: a.em, web: '', who: '', role: '', pm: (a as any).pm || '', pm_title: '',
      parts: '', pitch: 'Overflow deburring', lastContactedAt: new Date().toISOString(), touchCount: 1,
      notes: `[${D}] ${a.note}`,
    };
    await write(id, lead, `+ NEW ${a.co} (emailed)`);
  }

  console.log(`\n${commit ? 'Wrote' : 'Would write'} ${changed} changes.`);
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.message || e); process.exit(1); });
