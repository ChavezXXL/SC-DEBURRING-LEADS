/**
 * Set a user's role (and optionally tenantId) in Firestore. Used to shape the
 * admin hierarchy: promote a platform super-admin, or demote a login to a plain
 * client "owner".
 *
 * Usage:  npx tsx scripts/set-role.ts <email> <super-admin|owner|member> [tenantId]
 * Example: npx tsx scripts/set-role.ts scprecisiondeburring@gmail.com owner sc-deburring
 */
import { existsSync, readFileSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const ROLES = ['super-admin', 'owner', 'member'];

const email = (process.argv[2] || '').trim().toLowerCase();
const role = (process.argv[3] || '').trim();
const tenantId = (process.argv[4] || '').trim(); // optional

if (!email || !ROLES.includes(role)) {
  console.error('Usage: npx tsx scripts/set-role.ts <email> <super-admin|owner|member> [tenantId]');
  process.exit(1);
}

async function main() {
  if (!getApps().length) {
    initializeApp({
      credential: existsSync(KEY) ? cert(JSON.parse(readFileSync(KEY, 'utf8'))) : applicationDefault(),
      projectId: 'sc-deburring-leads',
    });
  }
  const auth = getAuth();
  const db = getFirestore();

  const u = await auth.getUserByEmail(email);
  const ref = db.collection('users').doc(u.uid);
  const before = (await ref.get()).data() as any;
  console.log('BEFORE:', email, '→', JSON.stringify(before));

  const update: Record<string, any> = { role };
  if (tenantId) update.tenantId = tenantId;
  await ref.set(update, { merge: true });

  const after = (await ref.get()).data() as any;
  console.log('AFTER :', email, '→', JSON.stringify(after));
  process.exit(0);
}
main().catch((e) => {
  console.error('ERROR:', e?.message || e);
  process.exit(1);
});
