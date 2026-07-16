/** Evening sync 2026-07-09: 13 research-batch sends confirmed in Gmail sent. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SENT = [
  'info@lanicaero.com', 'sales@accuratemanufacturing.net', 'sales@rampengineering.com',
  'rfq@mkti.com', 'sales@mavaero.com', 'aerospace@pankl.com', 'info@farraraerospace.net',
  'jimhogin@hoginmachine.com', 'kip@rkltech.com', 'quotes@lagauge.com',
  'info@pmdprecision.com', 'info@brek.aero', 'steveg@premiergearinc.com',
];
const DATE = '2026-07-09';
const BUMP = '2026-07-13';

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  let n = 0;
  for (const em of SENT) {
    const q = await db.collection('leads').where('em', '==', em).limit(1).get();
    if (q.empty) { console.log('NOT FOUND:', em); continue; }
    const doc = q.docs[0]; const x = doc.data() as any;
    const key = `[${DATE}] Emailed`;
    if ((x.notes || '').includes(key)) { console.log('already:', x.co); continue; }
    const fields: any = {
      lastContactedAt: DATE + 'T21:38:00.000Z',
      touchCount: (x.touchCount || 0) + 1,
      reminderDate: BUMP,
      notes: (x.notes ? x.notes + '\n' : '') + `${key} — cold intro sent (confirmed via Gmail). Day-4 bump due ${BUMP}.`,
    };
    if (['new', 'called', 'voicemail', undefined].includes(x.status)) fields.status = 'emailed';
    await doc.ref.set(fields, { merge: true });
    console.log('MARKED:', x.co);
    n++;
  }
  console.log(`\n${n} marked emailed.`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
