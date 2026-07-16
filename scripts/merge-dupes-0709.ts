/** CRM hygiene 2026-07-09: collapse duplicate leads. Keeps ONE primary per
 * company; marks the extras status:'dead' with a DUPLICATE note (never delete —
 * history stays visible). Also retires the blank-name mystery lead. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// keep: exact co of the primary · dupes: exact co names to retire
const GROUPS: { keep: string; dupes: string[] }[] = [
  { keep: 'RTCA Aerospace — Chatsworth', dupes: ['RTCA Aerospace — Chatsworth 2', 'RTCA Aerospace — Simi Valley'] },
  { keep: 'Force Fabrication Inc', dupes: ['Force Fabrication'] },
  { keep: 'Alpha Machinery & Technology Co.', dupes: ['Alpha Machinery & Technology Co'] },
  { keep: 'LAS Precision', dupes: ['LAS Precision CNC Machining'] },
];

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();

  for (const g of GROUPS) {
    const keepQ = await db.collection('leads').where('co', '==', g.keep).limit(1).get();
    if (keepQ.empty) { console.log('PRIMARY NOT FOUND (skip group):', g.keep); continue; }
    for (const dupeName of g.dupes) {
      const q = await db.collection('leads').where('co', '==', dupeName).get();
      for (const d of q.docs) {
        const x = d.data() as any;
        if ((x.notes || '').includes('DUPLICATE of')) { console.log('already merged:', dupeName); continue; }
        await d.ref.set({
          status: 'dead',
          notes: (x.notes ? x.notes + '\n' : '') + `[2026-07-09] DUPLICATE of "${g.keep}" — retired by dedupe. Work the primary card.`,
        }, { merge: true });
        console.log('retired dupe:', dupeName);
      }
    }
  }

  // blank-name mystery lead → retire until identified
  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  for (const d of snap.docs) {
    const x = d.data() as any;
    if ((x.co || '').trim() === '' && x.status !== 'dead') {
      await d.ref.set({ status: 'dead', notes: (x.notes ? x.notes + '\n' : '') + '[2026-07-09] No company name — retired until identified (ph on file).' }, { merge: true });
      console.log('retired blank-name lead', d.id);
    }
  }
  console.log('Done.');
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
