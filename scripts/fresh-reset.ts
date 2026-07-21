/** Mint one fresh password-reset link for the SC login (single-use). */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const EMAIL = process.argv[2] || 'scprecisiondeburring@gmail.com';

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  }
  const link = await getAuth().generatePasswordResetLink(EMAIL);
  console.log(`FRESH RESET LINK for ${EMAIL}:`);
  console.log(link);
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.code || '', e.message || e); process.exit(1); });
