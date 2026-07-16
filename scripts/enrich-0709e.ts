/** Wave-3 enrichment (batch E): research → CRM. Stamps drafts for the 8 GREATs
 * getting drafts today (Alpha Omega already has a pending draft — no re-stamp). */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SCRATCH = String.raw`C:\Users\scpre\AppData\Local\Temp\claude\C--Users-scpre-SC-DEBURR-MARKETING\c46d0ac7-80be-4db5-9553-323f89ead618\scratchpad`;
const STAMP = '[2026-07-09] Draft staged (research wave 3) — pending send.';
const DRAFTED = new Set([
  'Above All CNC', 'C&H Machine & EDM Services', 'Coast Precision', 'Dye CNC',
  'G.V. Industries', 'GlenDee / MGI', 'R&G Precision Machining',
  'San Diego Precision Machining, Inc. (SDPM)',
]);

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  const E = JSON.parse(readFileSync(SCRATCH + '\\research_batchE.json', 'utf8')).companies;

  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  const docs: { ref: any; co: string; data: any }[] = [];
  snap.forEach((d) => docs.push({ ref: d.ref, co: (d.data() as any).co || '', data: d.data() }));
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

  let updated = 0;
  for (const r of E) {
    const rn = norm(r.co);
    const hits = docs.filter((d) => {
      const dn = norm(d.co);
      return dn.length > 3 && rn.length > 3 && (dn === rn || dn.startsWith(rn) || rn.startsWith(dn));
    });
    if (!hits.length) { console.log('NO MATCH:', r.co); continue; }
    for (const hit of hits) {
      const x = hit.data;
      if ((x.notes || '').includes('] RESEARCH — FIT')) { console.log('already:', hit.co); continue; }
      const block =
        `[2026-07-09] RESEARCH — FIT: ${r.fit}. ${r.why}` +
        `\n  Makes: ${r.makes}` +
        `\n  Size: ${r.size} | Certs: ${r.certs || 'none stated'}` +
        (r.named_contact ? `\n  Contact: ${r.named_contact}` : '') +
        (r.better_email ? `\n  Alt email: ${r.better_email}` : '') +
        `\n  Hiring: ${r.hiring || 'none found'}`;
      const fields: any = {
        notes: (x.notes ? x.notes + '\n' : '') + block + (DRAFTED.has(r.co) ? '\n' + STAMP : ''),
        t: r.fit === 'GREAT' ? 1 : 2,
      };
      if (r.makes && (!x.parts || x.parts.length < 20)) fields.parts = r.makes.slice(0, 180);
      if (r.named_contact && !x.who) fields.who = r.named_contact.split(';')[0].trim().slice(0, 80);
      await hit.ref.set(fields, { merge: true });
      console.log(`enriched [${r.fit}]`, hit.co);
      updated++;
    }
  }
  console.log(`\nDone — ${updated} rows.`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
