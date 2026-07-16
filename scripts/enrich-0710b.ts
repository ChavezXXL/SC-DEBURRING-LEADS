/** 2026-07-10 wave-B enrich/correct:
 *  - Ram Aerospace Inc. + My Machine Inc: in CRM but email-less; add found emails (repeat-guard clean) → will draft.
 *  - JAH Machine Inc: Gmail shows it was ALREADY cold-emailed Jun-16-2026 (sales@jahmachine.com, "Hi Jerry"),
 *    but CRM status was stale 'new'. Correct to 'emailed'. DO NOT re-cold. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const JOBS = [
  { co: 'Ram Aerospace Inc.', set: { em: 'info@ramaerospace.com' },
    note: '[2026-07-10] Email found (agent web-verified): info@ramaerospace.com. Repeat-guard clean. AS9100D/ISO9001 precision CNC + contract mfg; aerospace/defense/medical/oil&gas. Brea. FIT: GOOD. Cold draft staged today.' },
  { co: 'My Machine Inc', set: { em: 'info@mymachineinc.com' },
    note: '[2026-07-10] Email found (agent web-verified): info@mymachineinc.com. Repeat-guard clean. AS9100D/ISO9001 aerospace CNC, inspection, assembly; supplies Boeing/Lockheed/SpaceX. Baldwin Park. FIT: GOOD. Cold draft staged today.' },
  { co: 'JAH Machine Inc', set: { em: 'sales@jahmachine.com', status: 'emailed', lastContactedAt: '2026-06-16T23:31:21.000Z' },
    note: '[2026-07-10] REPEAT-GUARD CORRECTION: already cold-emailed Jun-16-2026 to sales@jahmachine.com ("extra deburring hands...", opened "Hi Jerry"). CRM status was stale \'new\' — corrected to emailed. DO NOT re-cold; bump the June thread only.' },
];

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  for (const j of JOBS) {
    const q = await db.collection('leads').where('tenantId', '==', 'sc-deburring').where('co', '==', j.co).get();
    if (q.empty) { console.log('NOT FOUND:', j.co); continue; }
    for (const d of q.docs) {
      const x = d.data() as any;
      if ((x.notes || '').includes(j.note.slice(0, 34))) { console.log('already done:', j.co); continue; }
      await d.ref.set({ ...j.set, notes: (x.notes ? x.notes + '\n' : '') + j.note }, { merge: true });
      console.log('updated:', j.co, JSON.stringify(j.set));
    }
  }
  console.log('\nDone.');
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
