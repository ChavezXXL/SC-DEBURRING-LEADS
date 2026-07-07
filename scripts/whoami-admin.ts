/** Diagnose the super-admin setup: Santiago's role/tenant + the tenants list. */
import { existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const EMAIL = 'scprecisiondeburring@gmail.com';

async function main() {
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const auth = getAuth();
  const db = getFirestore();

  const u = await auth.getUserByEmail(EMAIL);
  console.log('AUTH USER:', EMAIL, '→ uid', u.uid);
  const prof = await db.collection('users').doc(u.uid).get();
  console.log('users/' + u.uid + ' exists:', prof.exists, '→', JSON.stringify(prof.data()));

  // any OTHER user docs (to see if a separate admin already exists)
  const allUsers = await db.collection('users').get();
  console.log('\nALL users docs (', allUsers.size, '):');
  allUsers.forEach(d => { const x = d.data() as any; console.log('  ', d.id, '| email:', x.email, '| role:', x.role, '| tenantId:', x.tenantId); });

  const tenants = await db.collection('tenants').get();
  console.log('\nTENANTS (', tenants.size, '):');
  tenants.forEach(d => { const x = d.data() as any; console.log('  ', d.id, '| name:', x.name, '| owner:', x.ownerEmail, '| plan:', x.plan); });
  process.exit(0);
}
main().catch(e => { console.error('ERROR:', e.code || '', e.message || e); process.exit(1); });
