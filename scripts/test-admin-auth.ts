/** Reproduce the server's verifyIdToken to see if it actually works. */
import { existsSync, readFileSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const UID = 'GKkhq82345cuQC0yb6rMx4fqAxB2';
const PID = 'sc-deburring-leads';
const WEBKEY = Buffer.from('QUl6YVN5QWJ5eFdHbFlQWWpVVmZYNmVaMU9yNnRkeHRTRHNVSlhn', 'base64').toString('utf8');

async function main() {
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: PID });
  const customToken = await getAuth().createCustomToken(UID);

  // exchange custom token -> idToken (like the web client does)
  const ex = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEBKEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const exJson: any = await ex.json();
  if (!ex.ok) { console.log('signInWithCustomToken FAILED', ex.status, JSON.stringify(exJson)); process.exit(1); }
  const idToken = exJson.idToken as string;
  console.log('got idToken (len', idToken.length, ')');

  // TEST A: the exact call the server makes — project-scoped lookup, NO auth header
  const a = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PID}/accounts:lookup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }),
  });
  console.log('\n[A] server-style lookup (no auth header):', a.status, a.ok ? 'OK' : 'FAIL', a.ok ? '' : (await a.text()).slice(0, 200));

  // TEST B: same but WITH a service-account bearer token (the likely fix)
  const at: any = await (app.options.credential as any).getAccessToken();
  const token = at.access_token || at.accessToken || at;
  const b = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PID}/accounts:lookup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ idToken }),
  });
  const bj: any = b.ok ? await b.json() : null;
  console.log('[B] lookup WITH bearer token:', b.status, b.ok ? ('OK — localId ' + bj?.users?.[0]?.localId) : ('FAIL ' + (await b.text()).slice(0, 200)));

  // TEST C: public form with API key (also a valid fix, no OAuth needed)
  const c = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEBKEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }),
  });
  const cj: any = c.ok ? await c.json() : null;
  console.log('[C] public lookup WITH ?key=:', c.status, c.ok ? ('OK — localId ' + cj?.users?.[0]?.localId) : ('FAIL ' + (await c.text()).slice(0, 200)));
  process.exit(0);
}
main().catch(e => { console.error('ERROR:', e.message || e); process.exit(1); });
