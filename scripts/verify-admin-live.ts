/** Hit the LIVE deployed admin endpoints with a real idToken to prove the fix. */
import { existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
// Default: Santiago (super-admin). Pass a uid as argv[2] to test another user.
const UID = process.argv[2] || 'GKkhq82345cuQC0yb6rMx4fqAxB2';
const WEBKEY = Buffer.from('QUl6YVN5QWJ5eFdHbFlQWWpVVmZYNmVaMU9yNnRkeHRTRHNVSlhn', 'base64').toString('utf8');
const BASE = 'https://apx-crm.pages.dev';

async function main() {
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const customToken = await getAuth().createCustomToken(UID);
  const ex = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEBKEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const exJson: any = await ex.json();
  if (!ex.ok) { console.log('signInWithCustomToken FAILED', ex.status, JSON.stringify(exJson)); process.exit(1); }
  const idToken = exJson.idToken as string;
  console.log('minted idToken (len', idToken.length, ')\n');

  // TEST: live GET /api/admin/list-tenants with Bearer header
  const r = await fetch(`${BASE}/api/admin/list-tenants`, {
    method: 'GET', headers: { Authorization: `Bearer ${idToken}` },
  });
  const txt = await r.text();
  console.log('GET /api/admin/list-tenants →', r.status, r.ok ? 'OK ✅' : 'FAIL ❌');
  if (r.ok) {
    const j = JSON.parse(txt);
    console.log('  tenants returned:', j.tenants?.length);
    for (const t of j.tenants || []) console.log('   -', t.id, '|', t.name, '| leads:', t.leadCount, '| users:', t.userCount, '| plan:', t.plan);
  } else {
    console.log('  body:', txt.slice(0, 300));
  }
  process.exit(r.ok ? 0 : 1);
}
main().catch(e => { console.error('ERROR:', e.message || e); process.exit(1); });
