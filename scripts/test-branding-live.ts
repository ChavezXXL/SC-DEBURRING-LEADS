/** Verify the Admin drawer's "Save branding" path: super-admin edits a tenant's
 * settings via /api/tenant/update-settings. No-op change (re-sends current name). */
import { existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const APEX_UID = 'FNT9BRoRaUd8nkNVYaUD3aADO1y2'; // apexgrowthgroupllc@gmail.com (super-admin)
const WEBKEY = Buffer.from('QUl6YVN5QWJ5eFdHbFlQWWpVVmZYNmVaMU9yNnRkeHRTRHNVSlhn', 'base64').toString('utf8');
const BASE = 'https://apx-crm.pages.dev';

async function main() {
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const customToken = await getAuth().createCustomToken(APEX_UID);
  const ex = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEBKEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const exJson: any = await ex.json();
  const idToken = exJson.idToken as string;

  // Re-send SC Deburring's current name only — a genuine no-op, proves the path.
  const r = await fetch(`${BASE}/api/tenant/update-settings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, tenantId: 'sc-deburring', name: 'SC Deburring LLC' }),
  });
  const txt = await r.text();
  console.log('POST /api/tenant/update-settings (super-admin → sc-deburring) →', r.status, r.ok ? 'OK ✅' : 'FAIL ❌');
  console.log('  body:', txt.slice(0, 200));
  process.exit(r.ok ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
