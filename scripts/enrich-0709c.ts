/** Wave-2 enrichment (batches C+D): write research to CRM, mark Scicon dead,
 * fix J&J email, ADI email cleared (placeholder), stamps for the 12 drafted. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SCRATCH = String.raw`C:\Users\scpre\AppData\Local\Temp\claude\C--Users-scpre-SC-DEBURR-MARKETING\c46d0ac7-80be-4db5-9553-323f89ead618\scratchpad`;
const STAMP = '[2026-07-09] Draft staged (research wave 2) — pending send.';
const DRAFTED = new Set([
  'RTCA Aerospace', 'Votaw Precision Technologies', 'Vescio Manufacturing', 'Senga Engineering',
  'Torrance Precision Machining', 'Wire Pro EDM Technologies', 'J & J Custom Machining',
  'ABACORP CNC Machined Parts', 'San Val Precision Inc', 'W.C.M. Manufacturing',
  'Alpha Machinery & Technology Co.', 'Paramount Machine Company',
]);

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  const C = JSON.parse(readFileSync(SCRATCH + '\\research_batchC.json', 'utf8')).companies;
  const D = JSON.parse(readFileSync(SCRATCH + '\\research_batchD.json', 'utf8')).companies;
  const all: any[] = [...C, ...D];

  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  const docs: { ref: any; co: string; data: any }[] = [];
  snap.forEach((d) => docs.push({ ref: d.ref, co: (d.data() as any).co || '', data: d.data() }));
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

  let updated = 0;
  for (const r of all) {
    const rn = norm(r.co);
    // guard: never match empty/short names (lesson from wave 1)
    const hits = docs.filter((d) => {
      const dn = norm(d.co);
      return dn.length > 3 && rn.length > 3 && (dn === rn || dn.startsWith(rn) || rn.startsWith(dn));
    });
    if (!hits.length) { console.log('NO MATCH:', r.co); continue; }

    for (const hit of hits) { // RTCA has 3 rows — enrich all
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
      if (r.co === 'Scicon Technologies Corp') fields.status = 'dead';
      if (r.co === 'J & J Custom Machining') fields.em = 'jjcustommachining@gmail.com';
      if (r.co === 'Aerospace Dynamics International, Inc. (ADI)') fields.em = '';
      await hit.ref.set(fields, { merge: true });
      console.log(`enriched [${r.fit}]`, hit.co);
      updated++;
    }
  }
  console.log(`\nDone — ${updated} lead rows enriched.`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
