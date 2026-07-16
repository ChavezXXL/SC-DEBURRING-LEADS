/** Reconcile Gmail SENT reality → CRM (2026-07-09).
 * Source: Gmail search in:sent subject:"deburring help when your bench gets backed up".
 * Marks delivered sends as emailed (status upgrade, lastContactedAt, touchCount+1,
 * dated note, day-4 reminderDate). Bounces get flagged, NOT marked emailed. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

type Sent = { em: string; date: string; bounced?: boolean };
const SENT: Sent[] = [
  // 2026-07-09 batch
  { em: 'cassandra.sparks@avibank.com', date: '2026-07-09' },
  { em: 'aldo.lemus@aceairmfg.com', date: '2026-07-09' },
  { em: 'sales@aaeroswiss.com', date: '2026-07-09' },
  { em: 'caltronedm@gmail.com', date: '2026-07-09' },
  { em: 'sales@precisemfg.com', date: '2026-07-09' },
  { em: 'eric.grupp@crissair.com', date: '2026-07-09' },
  { em: 'info@campbellcnc.com', date: '2026-07-09' },
  { em: 'lorenzo@lmprecisioninc.com', date: '2026-07-09' },
  { em: 'printmetal@mimotechnik.com', date: '2026-07-09' },
  { em: 'rkrispel@aerodyneprecision.com', date: '2026-07-09', bounced: true },
  // 2026-07-06 batch
  { em: 'info@milcowireedm.com', date: '2026-07-06' },
  { em: 'sales@afabcnc.com', date: '2026-07-06' },
  { em: 'contact@threadlockprecision.com', date: '2026-07-06' },
  { em: 'info@nytron.aero', date: '2026-07-06' },
  { em: 'info@marplesgearsinc.com', date: '2026-07-06' },
  { em: 'sales@pro-dex.com', date: '2026-07-06' },
  // 2026-07-01 batch
  { em: 'sales@sandiegomachine.com', date: '2026-07-01' },
  { em: 'contact@oculartec.com', date: '2026-07-01' },
  { em: 'sales@temeculaprecision.com', date: '2026-07-01' },
  { em: 'mail@nbtmachining.com', date: '2026-07-01' },
  { em: 'sales@cncmae.com', date: '2026-07-01' },
  { em: 'sales@precisionoptical.com', date: '2026-07-01' },
  { em: 'quotes@gicncmachine.com', date: '2026-07-01', bounced: true },
  { em: 'sales1@accuturncorp.com', date: '2026-07-01', bounced: true },
];

const plus4 = (d: string) => {
  const t = new Date(d + 'T12:00:00Z');
  t.setUTCDate(t.getUTCDate() + 4);
  return t.toISOString().slice(0, 10);
};

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  let marked = 0, already = 0, flaggedBounce = 0, notFound = 0;

  for (const s of SENT) {
    const q = await db.collection('leads').where('em', '==', s.em).limit(1).get();
    if (q.empty) { console.log('NOT FOUND in CRM:', s.em); notFound++; continue; }
    const doc = q.docs[0];
    const x = doc.data() as any;

    if (s.bounced) {
      const flag = `[${s.date}] Email BOUNCED — address invalid. Needs new contact (call/site).`;
      if (!(x.notes || '').includes('BOUNCED')) {
        await doc.ref.set({ notes: x.notes ? x.notes + '\n' + flag : flag }, { merge: true });
        console.log('bounce flagged:', x.co, `(${s.em})`);
        flaggedBounce++;
      } else { console.log('bounce already flagged:', x.co); }
      continue;
    }

    const stampKey = `[${s.date}] Emailed`;
    if ((x.notes || '').includes(stampKey) || (x.status === 'emailed' && x.lastContactedAt)) {
      console.log('already tracked:', x.co);
      already++;
      continue;
    }
    const fields: any = {
      lastContactedAt: s.date + 'T17:00:00.000Z',
      touchCount: (x.touchCount || 0) + 1,
      reminderDate: plus4(s.date),
      notes: (x.notes ? x.notes + '\n' : '') + `${stampKey} — cold intro sent (confirmed via Gmail sent folder). Day-4 bump due ${plus4(s.date)}.`,
    };
    if (['new', 'called', 'voicemail', undefined].includes(x.status)) fields.status = 'emailed';
    await doc.ref.set(fields, { merge: true });
    console.log('MARKED EMAILED:', x.co, `(${s.em})`, '→ bump', plus4(s.date));
    marked++;
  }
  console.log(`\nSummary: ${marked} marked, ${already} already tracked, ${flaggedBounce} bounces flagged, ${notFound} not in CRM.`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
