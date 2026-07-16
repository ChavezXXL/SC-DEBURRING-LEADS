/** Growth push 2026-07-09:
 *  (1) add 3 net-new verified leads (Caltron, MIMO Technik, Wire Cut Inc)
 *  (2) stamp "Draft staged" notes on the 12 leads getting Gmail drafts today.
 *  Statuses stay 'new' — drafts are pending Santiago's review, nothing sent. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const STAMP = '[2026-07-09] Draft staged (growth push) — pending send.';

const NEW_LEADS = [
  {
    co: 'Caltron Co.', city: 'Valencia', ph: '(818) 846-7000', em: 'caltronedm@gmail.com',
    web: 'https://caltronedm.com', parts: 'Wire/sinker EDM + CNC — aerospace, defense, medical; titanium/Inconel/carbide',
    t: 1, r: 'SCV', src: 'web sweep 2026-07-09 (EDM segment), site-verified contact',
  },
  {
    co: 'MIMO Technik', city: 'Carson', ph: '', em: 'printmetal@mimotechnik.com',
    web: 'https://www.mimotechnik.com', parts: 'Metal 3D printing (AS9100D, ITAR, Boeing-qualified) + 5-axis CNC — aerospace/rocketry',
    t: 1, r: 'South Bay', src: 'web sweep 2026-07-09 (metal-AM segment), site-verified contact',
  },
  {
    co: 'Wire Cut Inc.', city: 'Buena Park', ph: '(800) 494-7328', em: '',
    web: 'https://www.wirecutcompany.com', parts: 'EDM aerospace/aircraft/satellite parts, medical components — hard metals',
    t: 1, r: 'OC', src: 'web sweep 2026-07-09 (EDM segment), site-verified; CALL-ONLY (no public email)',
  },
];

// Existing status:new leads getting drafts today (exact co names from dump).
const DRAFT_COS = [
  'Precise Aerospace Manufacturing Inc',
  'Aerodyne Precision Machining',
  'Avibank Manufacturing Inc',
  'Crissair, Inc.',
  'Ace Air Manufacturing',
  'ACE Clearwater Enterprises',
  'Aaero Swiss',
  'Campbell Engineering Inc.',
  'Alpha Omega Swiss',
  'L&M Precision Inc',
];

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();

  // 1) net-new adds (skip if a same-name doc already exists — idempotent)
  for (const L of NEW_LEADS) {
    const dupe = await db.collection('leads').where('co', '==', L.co).limit(1).get();
    if (!dupe.empty) { console.log('skip (exists):', L.co); continue; }
    const id = L.co.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 7);
    const notes = `[2026-07-09] Added — ${L.src}.` + (L.em ? `\n${STAMP}` : '');
    await db.collection('leads').doc(id).set({
      id, tenantId: 'sc-deburring', status: 'new', notes,
      t: L.t, r: L.r, co: L.co, city: L.city, ph: L.ph, em: L.em, web: L.web,
      who: '', role: '', pm: '', pm_title: '', parts: L.parts, pitch: '', touchCount: 0,
    });
    console.log('ADDED:', L.co, L.em ? '(email — drafting)' : '(call-only)');
  }

  // 2) stamp existing drafted leads
  for (const co of DRAFT_COS) {
    const q = await db.collection('leads').where('co', '==', co).limit(1).get();
    if (q.empty) { console.log('NOT FOUND (no stamp):', co); continue; }
    const doc = q.docs[0];
    const x = doc.data() as any;
    if ((x.notes || '').includes(STAMP)) { console.log('already stamped:', co); continue; }
    await doc.ref.set({ notes: x.notes ? x.notes + '\n' + STAMP : STAMP }, { merge: true });
    console.log('stamped:', co, '→', x.em);
  }
  console.log('\nDone.');
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
