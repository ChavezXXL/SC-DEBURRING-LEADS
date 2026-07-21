/** Generate password-reset links for the CRM accounts WITHOUT touching any
 * role/tenant/profile (the old fix-login.ts re-promoted SC to super-admin).
 * Bypasses email delivery entirely — the owner opens the link and sets a new
 * password directly. Read-only except for the reset link itself. */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const EMAILS = [
  'scprecisiondeburring@gmail.com',
  'a.chavez.xxl@gmail.com',
  'apexgrowthgroupllc@gmail.com',
];

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  }
  const auth = getAuth();

  for (const email of EMAILS) {
    console.log('\n============================================================');
    try {
      const u = await auth.getUserByEmail(email);
      const providers = u.providerData.map((p) => p.providerId).join(',') || 'password';
      console.log(`ACCOUNT: ${email}`);
      console.log(`  exists: yes | uid: ${u.uid} | disabled: ${u.disabled} | providers: ${providers}`);
      if (!providers.includes('password')) {
        console.log('  ⚠ no password provider — this account may sign in a different way.');
      }
      const link = await auth.generatePasswordResetLink(email);
      console.log('  RESET LINK (open, set a new password, then sign in):');
      console.log('  ' + link);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        console.log(`ACCOUNT: ${email}\n  exists: NO — there is no login for this email.`);
      } else {
        console.log(`ACCOUNT: ${email}\n  ERROR: ${e.code || ''} ${e.message || e}`);
      }
    }
  }
  console.log('\n============================================================');
  process.exit(0);
}
main().catch((e) => { console.error('FATAL:', e.message || e); process.exit(1); });
