/** Verify the 7 "already in CRM" skips are real dupes (not false positives),
 * and print their status/email/notes so I know if the hot ones (Aero Mechanism)
 * are already worked or emailed before I do anything. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SKIPPED = ['Aero Mechanism', 'O&S Precision', 'Turret Lathe', 'Darmark', 'Vanacore', 'Moseys', 'TOMI'];

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const docs: any[] = [];
  snap.forEach((d) => docs.push(d.data()));

  for (const s of SKIPPED) {
    const sn = norm(s);
    const hits = docs.filter((x) => { const c = norm(x.co); return c.includes(sn) || sn.includes(c.slice(0, 8)); });
    console.log('\n=== search:', s, '===');
    if (!hits.length) { console.log('  (no match — was a FALSE skip, should re-add)'); continue; }
    for (const x of hits) {
      console.log(`  co="${x.co}" | em=${x.em || '(none)'} | status=${x.status} | touch=${x.touchCount || 0} | lastContacted=${x.lastContactedAt || '-'}`);
      const notes = (x.notes || '').split('\n').slice(-3).join(' / ');
      console.log('   last notes:', notes.slice(0, 220));
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
