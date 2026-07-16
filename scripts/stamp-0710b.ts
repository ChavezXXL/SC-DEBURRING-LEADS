/** 2026-07-10 wave-B: stamp the 6 leads that got cold drafts (repeat-guard PASSED)
 * + set day-4 bump reminder. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DRAFTED = [
  'Crown Precision', 'M.A. Machining Aerospace', 'Radical Fabrications',
  'JVC Precision', 'Ram Aerospace Inc.', 'My Machine Inc',
];
const STAMP = '[2026-07-10] Cold draft staged (untapped sweep; repeat-guard PASSED — no prior send to domain). Pending review/send. If sent, day-4 bump 2026-07-14.';

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  for (const co of DRAFTED) {
    const q = await db.collection('leads').where('tenantId', '==', 'sc-deburring').where('co', '==', co).get();
    if (q.empty) { console.log('NOT FOUND:', co); continue; }
    for (const d of q.docs) {
      const x = d.data() as any;
      if ((x.notes || '').includes(STAMP.slice(0, 40))) { console.log('already stamped:', co); continue; }
      await d.ref.set({ notes: (x.notes ? x.notes + '\n' : '') + STAMP, reminderDate: '2026-07-14' }, { merge: true });
      console.log('stamped:', co, '→', x.em);
    }
  }
  console.log('\nDone.');
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
