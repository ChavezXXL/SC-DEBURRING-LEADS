/** Verify the 10 "already in CRM" skips from add-0710b are REAL dupes, not false
 * positives from the slice(0,10) containment. Print the exact existing co(s) that
 * triggered each skip so I can re-add any genuinely-new lead. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SKIPPED = [
  'Vinaco Precision Machining', 'JAH Machine', 'Ram Aerospace', 'My Machine Inc',
  'Aerotech Precision Machining', 'EM Aerospace', 'Paragon Precision',
  'Advanced Techno Cut', 'Price Manufacturing', 'Align Precision',
];

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const docs: any[] = [];
  snap.forEach((d) => { const x = d.data(); docs.push({ co: x.co || '', em: x.em || '', status: x.status, city: x.city || '' }); });

  for (const s of SKIPPED) {
    const n = norm(s);
    const hits = docs.filter((x) => {
      const e = norm(x.co);
      if (e.length < 6) return false;
      return e === n || e.startsWith(n.slice(0, 10)) || n.startsWith(e.slice(0, 10));
    });
    console.log(`\n=== ${s}  (norm10="${n.slice(0, 10)}") ===`);
    for (const h of hits) {
      const exact = norm(h.co) === n;
      console.log(`  ${exact ? 'REAL DUPE ' : '??CHECK?? '} existing co="${h.co}" | city=${h.city} | em=${h.em || '-'} | ${h.status}`);
    }
    if (!hits.length) console.log('  (no hit — should have added; re-add)');
  }
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
