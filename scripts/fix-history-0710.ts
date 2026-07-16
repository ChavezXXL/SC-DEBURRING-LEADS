/** 2026-07-10 history reconcile — Santiago was right ("I've emailed some of these").
 * June campaigns used other subject lines and were never synced. Fixes:
 *  - Alpha Machinery (cncalpha.com) = PAST CLIENT (2024 PO/invoice) → status client
 *  - Log June sends on affected leads; flag repeats; RTCA = mailbox full, phone-only
 *  - Above All CNC marked emailed (sent 7/10 morning). */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const UPDATES: { em: string; set?: any; note: string }[] = [
  { em: 'info@cncalpha.com', set: { status: 'client' }, note: '[2026-07-10] PAST CLIENT CONFIRMED — 2024 RFQ P/N 463-0049 + PO 0009507 + invoice 00511 (Albert Nikoghossian, GM; Edmond = President). NEVER cold-pitch. Reactivation track: warm check-in or call. Cold draft staged 7/09 must be DELETED from Gmail drafts.' },
  { em: 'sales@votaw.com', note: '[2026-07-10] History: also emailed 2026-06-16 ("extra deburring hands without the hiring") — todays send was a 2nd touch 23 days later. Acceptable; next touch = bump only.' },
  { em: 'sales@romiindustries.com', note: '[2026-07-10] History: also emailed 2026-06-24 ("extra deburring hands when your bench is buried") — todays send was 2nd touch in 15 days. No more emails; call next.' },
  { em: 'mail@sanvalprecision.com', note: '[2026-07-10] History: emailed 2026-06-24 ("the parts nobody wants to deburr"). PENDING DRAFT IS A REPEAT — DO NOT SEND; bump the June thread instead.' },
  { em: 'info@senga-eng.com', note: '[2026-07-10] History: emailed 2026-06-24 and it BOUNCED (address not found — dead inbox). PENDING DRAFT USELESS — DO NOT SEND. Use their RFQ portal: senga-eng.com/submit-rfq.' },
  { em: 'info@c-hmachine.com', note: '[2026-07-10] History: emailed 2026-06-23 ("another option for deburring overflow"). PENDING DRAFT IS A REPEAT — DO NOT SEND; bump the June thread instead.' },
  { em: 'sales@wcmmanufacturing.com', note: '[2026-07-10] History: emailed 2026-06-24. PENDING DRAFT IS A REPEAT — DO NOT SEND; bump the June thread instead.' },
  { em: 'mail@paramountmachine.com', note: '[2026-07-10] History: emailed 2026-06-24. PENDING DRAFT IS A REPEAT — DO NOT SEND; bump the June thread instead.' },
  { em: 'sales@rtcaerospace.com', note: '[2026-07-10] Send 7/09 BOUNCED — mailbox full (same in Mar 2026 to chatsworth@). Email unreachable: PHONE ONLY. Their deburr-tech hiring (2 sites) makes them worth a call: Jason Keck, Regional GM.' },
  { em: 'tim@aboveallcnc.com', set: { status: 'emailed', lastContactedAt: '2026-07-10T11:32:00.000Z', reminderDate: '2026-07-14' }, note: '[2026-07-10] Emailed — cold intro sent (confirmed via Gmail). Day-4 bump due 2026-07-14.' },
];

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  for (const u of UPDATES) {
    const q = await db.collection('leads').where('em', '==', u.em).get();
    if (q.empty) { console.log('NOT FOUND:', u.em); continue; }
    for (const d of q.docs) {
      const x = d.data() as any;
      if ((x.notes || '').includes(u.note.slice(0, 30))) { console.log('already noted:', x.co); continue; }
      const fields: any = { ...(u.set || {}), notes: (x.notes ? x.notes + '\n' : '') + u.note };
      if (u.set?.status === 'emailed' && !['new', 'called', 'voicemail', undefined].includes(x.status)) delete fields.status;
      await d.ref.set(fields, { merge: true });
      console.log('updated:', x.co, u.set ? JSON.stringify(u.set) : '(note)');
    }
  }
  console.log('Done.');
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
