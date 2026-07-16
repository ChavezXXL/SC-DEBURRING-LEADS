/** Follow-up: RTCA (phone-only note) + Above All CNC (emailed 7/10) by co name. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();

  const jobs: { prefix: string; note: string; set?: any }[] = [
    { prefix: 'RTCA Aerospace', note: '[2026-07-10] Send 7/09 BOUNCED — mailbox full (same Mar 2026). Email unreachable: PHONE ONLY. Deburr-tech hiring at 2 sites = worth a call. Contact: Jason Keck, Regional GM.' },
    { prefix: 'Above All CNC', note: '[2026-07-10] Emailed — cold intro sent (confirmed via Gmail 7/10 morning). Day-4 bump due 2026-07-14.', set: { status: 'emailed', lastContactedAt: '2026-07-10T11:32:00.000Z', reminderDate: '2026-07-14' } },
  ];
  for (const j of jobs) {
    for (const d of snap.docs) {
      const x = d.data() as any;
      if (!(x.co || '').startsWith(j.prefix)) continue;
      if ((x.notes || '').includes(j.note.slice(0, 30))) { console.log('already:', x.co); continue; }
      const fields: any = { ...(j.set || {}), notes: (x.notes ? x.notes + '\n' : '') + j.note };
      await d.ref.set(fields, { merge: true });
      console.log('updated:', x.co);
    }
  }
  console.log('Done.');
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
