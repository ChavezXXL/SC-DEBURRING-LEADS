/**
 * Diagnose + repair the CRM admin login via Firebase Admin SDK (service account).
 * - Checks whether the Auth user exists for the email.
 * - Ensures the /users/{uid} profile is super-admin on tenant sc-deburring (so all leads show).
 * - Generates a password-reset link directly (bypasses email delivery + the broken client key).
 * Run:  cd "C:\Users\scpre\SC LEADS PP" && npx tsx scripts/fix-login.ts [--create]
 */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const EMAIL = 'scprecisiondeburring@gmail.com';
const TENANT = 'sc-deburring';

async function main() {
  const allowCreate = process.argv.includes('--create');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const auth = getAuth();
  const db = getFirestore();

  let user;
  try {
    user = await auth.getUserByEmail(EMAIL);
    console.log('✔ AUTH USER EXISTS — uid:', user.uid, '| disabled:', user.disabled, '| sign-in providers:', (user.providerData.map(p => p.providerId).join(',') || 'password'));
  } catch (e: any) {
    if (e.code === 'auth/user-not-found') {
      console.log('✖ NO AUTH USER for', EMAIL, '— THIS is why no reset email arrives (Firebase silently ignores resets for non-existent accounts).');
      if (!allowCreate) { console.log('→ Re-run with --create to create the login.'); process.exit(0); }
      const tmp = 'Tmp' + Math.random().toString(36).slice(2, 11) + '!9Az';
      user = await auth.createUser({ email: EMAIL, emailVerified: true, password: tmp });
      console.log('✔ CREATED login — uid:', user.uid);
    } else { throw e; }
  }

  await db.collection('users').doc(user.uid).set(
    { uid: user.uid, email: EMAIL, tenantId: TENANT, role: 'super-admin', createdAt: new Date().toISOString() },
    { merge: true },
  );
  console.log('✔ PROFILE ensured — role: super-admin, tenantId:', TENANT, '(super-admin sees all leads)');

  const link = await auth.generatePasswordResetLink(EMAIL);
  console.log('\n========== PASSWORD RESET LINK (open this, set a password, then log in) ==========');
  console.log(link);
  console.log('===================================================================================');
  process.exit(0);
}
main().catch(e => { console.error('ERROR:', e.code || '', e.message || e); process.exit(1); });
