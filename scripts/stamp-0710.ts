/** 2026-07-10 draft-staging record + repeat-guard corrections.
 *  (1) Stamp the 9 net-new leads that got cold drafts today (repeat-guard PASSED).
 *  (2) Correct O&S Precision + Infinity Precision — Gmail history shows prior
 *      contact, so they must NOT be cold-pitched. Fix contacts + status + notes. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DRAFTED = [
  'Alva Manufacturing', 'Aero Mechanism Precision', 'U.S. Swiss', 'Precision One Medical',
  'KD Precision Machining', 'Industrial Tool & Die', 'Means Engineering', 'Veridiam', 'Darmark Corporation',
];
const STAMP = '[2026-07-10] Cold draft staged (net-new sweep; repeat-guard PASSED — no prior send to domain). Pending review/send. If sent, day-4 bump 2026-07-14.';

const CORRECT = [
  { co: 'O&S Precision Inc', em: 'gina@oands.com', status: 'emailed', lastContactedAt: '2026-06-16T23:31:10.000Z',
    note: '[2026-07-10] REPEAT-GUARD / HISTORY — NOT A COLD LEAD. Warm contact since 2022: Erandi Morales, Gina Gomez (gina@oands.com), sales@oands.com. They have sent quote requests (Jan-2022 tumble P/N 1513067-1 @ $75/lot; Jun-2025 VR301-6-1 105pc). They want TUMBLE (SC phased out — we do manual-under-magnification) and do manual in-house. Jun-16-2026 cold blitz already went to sales@oands.com. DO NOT cold-pitch. Reconnect = personal note/call from Santiago offering manual precision work. (Their file still had our OLD addr Unit #15 — now STE 17.)' },
  { co: 'Infinity Precision (IPI)', em: 'lizette@ipinc-usa.com', status: 'emailed', lastContactedAt: '2025-03-11T21:03:38.000Z',
    note: '[2026-07-10] REPEAT-GUARD / HISTORY — already contacted 2025-03-11: "Deburring Inquiry" sent to lizette@ipinc-usa.com after a phone call (they mostly do their own finishing). NOT a fresh cold lead — no draft staged. Reconnect via Lizette referencing the prior conversation. Woman-owned AS9100, Simi Valley (~25 min).' },
];

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();

  for (const co of DRAFTED) {
    const q = await db.collection('leads').where('tenantId', '==', 'sc-deburring').where('co', '==', co).get();
    if (q.empty) { console.log('NOT FOUND (no stamp):', co); continue; }
    for (const d of q.docs) {
      const x = d.data() as any;
      if ((x.notes || '').includes(STAMP.slice(0, 40))) { console.log('already stamped:', co); continue; }
      await d.ref.set({ notes: (x.notes ? x.notes + '\n' : '') + STAMP, reminderDate: '2026-07-14' }, { merge: true });
      console.log('stamped draft:', co, '→', x.em);
    }
  }

  for (const c of CORRECT) {
    const q = await db.collection('leads').where('tenantId', '==', 'sc-deburring').where('co', '==', c.co).get();
    if (q.empty) { console.log('NOT FOUND (correct):', c.co); continue; }
    for (const d of q.docs) {
      const x = d.data() as any;
      if ((x.notes || '').includes('[2026-07-10] REPEAT-GUARD / HISTORY')) { console.log('already corrected:', c.co); continue; }
      await d.ref.set({ em: c.em, status: c.status, lastContactedAt: c.lastContactedAt, notes: (x.notes ? x.notes + '\n' : '') + c.note }, { merge: true });
      console.log('CORRECTED (no-cold):', c.co, '→', c.em, c.status);
    }
  }
  console.log('\nDone.');
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
