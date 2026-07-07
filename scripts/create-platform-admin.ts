/**
 * Provision a separate PLATFORM admin — a super-admin NOT tied to any client
 * tenant. Lands in the Platform Console; can switch into any client workspace.
 *
 * Safe by design: creates the Auth user with a random throwaway password, then
 * prints an official Firebase password-reset link so the owner sets their own
 * password. This script never sets a usable password.
 *
 * Usage:  npx tsx scripts/create-platform-admin.ts <email> ["Display Name"]
 * Example: npx tsx scripts/create-platform-admin.ts a.chavez.xxl@gmail.com "Apex Growth"
 */
import { randomBytes } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const PLATFORM_WORKSPACE = '__platform__';

const email = (process.argv[2] || '').trim().toLowerCase();
const displayName = process.argv[3] || 'Apex Growth';

if (!email || !email.includes('@')) {
  console.error('Usage: npx tsx scripts/create-platform-admin.ts <email> ["Display Name"]');
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

  // 1) Auth user — reuse if it already exists, else create with a random pw.
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    console.log('Auth user already exists →', uid);
  } catch {
    const created = await auth.createUser({
      email,
      emailVerified: false,
      password: randomBytes(24).toString('base64url'), // throwaway; reset below
      displayName,
    });
    uid = created.uid;
    console.log('Created Auth user →', uid);
  }

  // 2) Platform super-admin profile (tenant-less).
  await db.collection('users').doc(uid).set(
    {
      uid,
      email,
      tenantId: PLATFORM_WORKSPACE,
      role: 'super-admin',
      displayName,
      createdAt: new Date().toISOString(),
    },
    { merge: true },
  );
  console.log('Wrote users/' + uid, '→ role super-admin, tenantId', PLATFORM_WORKSPACE);

  // 3) Official reset link so the owner sets their own password.
  const link = await auth.generatePasswordResetLink(email);
  console.log('\n=== SET-PASSWORD LINK (send to owner) ===\n' + link + '\n');
  console.log('Or: open apx-crm.pages.dev → "Forgot password" → enter', email);
  process.exit(0);
}
main().catch((e) => {
  console.error('ERROR:', e?.message || e);
  process.exit(1);
});
