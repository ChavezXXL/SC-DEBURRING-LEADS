/** Revive 3 leads already in CRM but stuck (June form-blitz, never submitted,
 * no email on file). The hiring-signal sweep found working emails — add them +
 * research + tier so they become workable. Exact co-name match only. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const REVIVE = [
  { co: 'Aero Mechanism Precision', em: 'info@aeromechanism.com', t: 1,
    note: '[2026-07-10] Email found (agent web-verified): info@aeromechanism.com. Prior June form-blitz never submitted (CAPTCHA). HOT: LIVE full-time Deburring Technician req (Indeed) — they literally can\'t staff finishing. Chatsworth, ~20 min from Pacoima; CNC mill/turn aero+defense, much gov work, ISO9001/AS9100. FIT: HOT.',
    parts: 'CNC milling & turning of high-end aerospace & defense parts (much gov work); 15+ CNC machines; ISO9001/AS9100' },
  { co: 'O&S Precision Inc', em: 'info@oands.com', t: 1,
    note: '[2026-07-10] Email found (agent web-verified): info@oands.com. Full-service precision CNC — military + commercial aerospace + medical devices; 35+ yrs. Chatsworth, ~20 min from Pacoima. FIT: GREAT.',
    parts: 'Full-service precision CNC machining; military aerospace, commercial aerospace & medical devices; 35+ yrs' },
  { co: 'Darmark Corporation', em: 'thomas@darmark.com', t: 2,
    note: '[2026-07-10] Email found (agent web-verified): thomas@darmark.com (owner Thomas — person inbox, softer opener). Prior June form-blitz never submitted (reCAPTCHA). 3-5 axis CNC + screw machining of high-temp alloys + turnkey assemblies; aero/medical/semi/power-gen; AS9100D. Poway. FIT: GOOD.',
    parts: '3-5 axis CNC milling, turning & screw machining of high-temp alloys + assemblies; aero/medical/semiconductor/power-gen; AS9100D' },
];

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  for (const R of REVIVE) {
    const q = await db.collection('leads').where('tenantId', '==', 'sc-deburring').where('co', '==', R.co).get();
    if (q.empty) { console.log('NOT FOUND:', R.co); continue; }
    for (const d of q.docs) {
      const x = d.data() as any;
      if ((x.notes || '').includes('[2026-07-10] Email found')) { console.log('already revived:', R.co); continue; }
      const fields: any = { em: R.em, t: R.t, notes: (x.notes ? x.notes + '\n' : '') + R.note };
      if (!x.parts || x.parts.length < 20) fields.parts = R.parts.slice(0, 180);
      await d.ref.set(fields, { merge: true });
      console.log(`REVIVED t${R.t}:`, R.co, '→', R.em);
    }
  }
  console.log('\nDone.');
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
