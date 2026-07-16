/** Write 2026-07-09 deep-research into the CRM: fit grade + profile into notes,
 * makes→parts, named contact→who, tier by fit, Maverick city fix, and
 * "Draft staged" stamps for the 15 GREAT-fit leads getting drafts today. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SCRATCH = String.raw`C:\Users\scpre\AppData\Local\Temp\claude\C--Users-scpre-SC-DEBURR-MARKETING\c46d0ac7-80be-4db5-9553-323f89ead618\scratchpad`;
const STAMP = '[2026-07-09] Draft staged (research batch) — pending send.';

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  const A = JSON.parse(readFileSync(SCRATCH + '\\research_batchA.json', 'utf8')).companies;
  const B = JSON.parse(readFileSync(SCRATCH + '\\research_batchB.json', 'utf8')).companies;
  const all: any[] = [...A, ...B];

  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  const docs: { ref: any; co: string; data: any }[] = [];
  snap.forEach((d) => docs.push({ ref: d.ref, co: (d.data() as any).co || '', data: d.data() }));
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

  let updated = 0;
  for (const r of all) {
    const rn = norm(r.co);
    const hit = docs.find((d) => {
      const dn = norm(d.co);
      return dn === rn || dn.startsWith(rn) || rn.startsWith(dn);
    });
    if (!hit) { console.log('NO MATCH:', r.co); continue; }
    const x = hit.data;

    const block =
      `[2026-07-09] RESEARCH — FIT: ${r.fit}. ${r.why}` +
      `\n  Makes: ${r.makes}` +
      `\n  Size: ${r.size} | Certs: ${r.certs || 'none stated'}` +
      (r.named_contact ? `\n  Contact: ${r.named_contact}` : '') +
      (r.better_email ? `\n  Alt email: ${r.better_email}` : '') +
      `\n  Hiring: ${r.hiring || 'none found'}`;

    const fields: any = {
      notes: (x.notes ? x.notes + '\n' : '') + block + (r.fit === 'GREAT' ? '\n' + STAMP : ''),
      t: r.fit === 'GREAT' ? 1 : 2,
    };
    if (r.makes && (!x.parts || x.parts.length < 20)) fields.parts = r.makes.slice(0, 180);
    if (r.named_contact && !x.who) fields.who = r.named_contact.split(';')[0].trim().slice(0, 80);
    if (r.co === 'Maverick Aerospace') fields.city = 'City of Industry';

    // idempotence: skip if this research block already applied
    if ((x.notes || '').includes('[2026-07-09] RESEARCH — FIT')) { console.log('already enriched:', hit.co); continue; }
    await hit.ref.set(fields, { merge: true });
    console.log(`enriched [${r.fit}]`, hit.co);
    updated++;
  }
  console.log(`\nDone — ${updated} leads enriched.`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
