/** 2026-07-13 sent-sync — confirm the 7/09-7/10 campaign wave (28 sends from
 * Gmail sent folder), idempotent. Marks emailed (upgrade-only), sets day-4
 * reminder, flags 2 bounces. Matched by exact `em`. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SENDS: { em: string; at: string }[] = [
  // 7/09 afternoon
  { em: 'eric.grupp@crissair.com', at: '2026-07-09T16:51:25Z' },
  { em: 'info@campbellcnc.com', at: '2026-07-09T16:51:20Z' },
  { em: 'sales@precisemfg.com', at: '2026-07-09T16:51:37Z' },
  { em: 'caltronedm@gmail.com', at: '2026-07-09T16:51:39Z' },
  { em: 'sales@aaeroswiss.com', at: '2026-07-09T16:51:41Z' },
  { em: 'aldo.lemus@aceairmfg.com', at: '2026-07-09T16:51:43Z' },
  { em: 'cassandra.sparks@avibank.com', at: '2026-07-09T16:51:44Z' },
  // 7/09 evening wave
  { em: 'steveg@premiergearinc.com', at: '2026-07-09T21:37:02Z' },
  { em: 'info@brek.aero', at: '2026-07-09T21:37:05Z' },
  { em: 'info@pmdprecision.com', at: '2026-07-09T21:37:08Z' },
  { em: 'quotes@lagauge.com', at: '2026-07-09T21:37:24Z' },
  { em: 'kip@rkltech.com', at: '2026-07-09T21:37:28Z' },
  { em: 'jimhogin@hoginmachine.com', at: '2026-07-09T21:38:13Z' },
  { em: 'info@farraraerospace.net', at: '2026-07-09T21:38:18Z' },
  { em: 'aerospace@pankl.com', at: '2026-07-09T21:38:23Z' },
  { em: 'sales@mavaero.com', at: '2026-07-09T21:38:25Z' },
  { em: 'rfq@mkti.com', at: '2026-07-09T21:38:27Z' },
  { em: 'sales@rampengineering.com', at: '2026-07-09T21:38:31Z' },
  { em: 'sales@accuratemanufacturing.net', at: '2026-07-09T21:38:33Z' },
  { em: 'info@lanicaero.com', at: '2026-07-09T21:38:35Z' },
  { em: 'sales@votaw.com', at: '2026-07-09T22:35:47Z' },
  { em: 'sales@romiindustries.com', at: '2026-07-09T22:36:00Z' },
  { em: 'info@aceclearwater.com', at: '2026-07-09T22:36:05Z' },
  { em: 'keith@gbfenterprises.com', at: '2026-07-09T22:36:06Z' },
  { em: 'info@alphaomegaswiss.com', at: '2026-07-09T22:36:09Z' },
  { em: 'sales@abacorpcnc.com', at: '2026-07-09T22:46:04Z' },
  // 7/10 morning
  { em: 'tim@aboveallcnc.com', at: '2026-07-10T11:32:35Z' },
  { em: 'robert@wireproedm.com', at: '2026-07-10T11:37:34Z' },
];

const BOUNCES: { em: string; note: string }[] = [
  { em: 'rkrispel@aerodyneprecision.com', note: '[2026-07-13] Send 7/09 BOUNCED — "rkrispel wasn\'t found" (recipient unknown). Contact invalid; find a new inbox or call.' },
  { em: 'sales@rtcaerospace.com', note: '[2026-07-13] Send 7/09 BOUNCED again — mailbox full (3rd time). PHONE ONLY, confirmed: Jason Keck GM (818) 407-0291.' },
];

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  let marked = 0, already = 0, missing = 0;
  for (const s of SENDS) {
    const q = await db.collection('leads').where('em', '==', s.em).get();
    if (q.empty) { console.log('NOT FOUND:', s.em); missing++; continue; }
    for (const d of q.docs) {
      const x = d.data() as any;
      const day = s.at.slice(0, 10);
      if ((x.notes || '').includes(`Emailed ${day} (sent-sync`)) { already++; continue; }
      const fields: any = {
        lastContactedAt: s.at,
        touchCount: (x.touchCount || 0) + ((x.lastContactedAt || '').slice(0, 10) === day ? 0 : 1),
        reminderDate: new Date(new Date(s.at).getTime() + 4 * 864e5).toISOString().slice(0, 10),
        notes: (x.notes ? x.notes + '\n' : '') + `[2026-07-13] Emailed ${day} (sent-sync from Gmail sent folder). Day-4 bump due.`,
      };
      if (['new', 'called', 'voicemail', undefined].includes(x.status)) fields.status = 'emailed';
      await d.ref.set(fields, { merge: true });
      console.log('marked:', x.co || s.em);
      marked++;
    }
  }
  for (const b of BOUNCES) {
    const q = await db.collection('leads').where('em', '==', b.em).get();
    for (const d of q.docs) {
      const x = d.data() as any;
      if ((x.notes || '').includes(b.note.slice(0, 30))) continue;
      await d.ref.set({ notes: (x.notes ? x.notes + '\n' : '') + b.note }, { merge: true });
      console.log('bounce noted:', x.co || b.em);
    }
  }
  console.log(`\nDone — ${marked} marked, ${already} already, ${missing} missing.`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
