/** 2026-07-13: (1) stamp the 25 day-4 bump reply-drafts staged in Gmail;
 * (2) Aerodyne contact fix — site cert broken, email dead, phone verified. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BUMPED = [
  'eric.grupp@crissair.com','info@campbellcnc.com','sales@precisemfg.com','caltronedm@gmail.com',
  'sales@aaeroswiss.com','aldo.lemus@aceairmfg.com','cassandra.sparks@avibank.com',
  'steveg@premiergearinc.com','info@brek.aero','info@pmdprecision.com','quotes@lagauge.com',
  'kip@rkltech.com','jimhogin@hoginmachine.com','info@farraraerospace.net','aerospace@pankl.com',
  'sales@mavaero.com','rfq@mkti.com','sales@rampengineering.com','sales@accuratemanufacturing.net',
  'info@lanicaero.com','sales@votaw.com','info@aceclearwater.com','keith@gbfenterprises.com',
  'info@alphaomegaswiss.com','sales@abacorpcnc.com',
];
const STAMP = '[2026-07-13] Day-4 BUMP staged as reply draft in Gmail (threads to the 7/09 intro) — pending send. Next touch if no reply: sample-lot offer day 8.';

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  let n = 0;
  for (const em of BUMPED) {
    const q = await db.collection('leads').where('em', '==', em).get();
    if (q.empty) { console.log('NOT FOUND:', em); continue; }
    for (const d of q.docs) {
      const x = d.data() as any;
      if ((x.notes || '').includes(STAMP.slice(0, 30))) continue;
      await d.ref.set({ notes: (x.notes ? x.notes + '\n' : '') + STAMP }, { merge: true });
      n++;
    }
  }
  console.log(`bump-stamped: ${n}`);

  const q = await db.collection('leads').where('em', '==', 'rkrispel@aerodyneprecision.com').get();
  for (const d of q.docs) {
    const x = d.data() as any;
    const note = '[2026-07-13] CONTACT FIX: website cert broken (serves binaya.com cert) — that inbox is dead. Phone VERIFIED (714) 891-1311, 5471 Argosy Ave, Huntington Beach. AS9100 aero CNC, 20,000 sqft, since 1986. CALL-ONLY now; no public sales email found (jobs@ is HR — do not pitch it).';
    if ((x.notes || '').includes('[2026-07-13] CONTACT FIX')) continue;
    await d.ref.set({ ph: x.ph || '(714) 891-1311', em: '', notes: (x.notes ? x.notes + '\n' : '') + note }, { merge: true });
    console.log('aerodyne fixed:', x.co);
  }
  console.log('Done.');
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
