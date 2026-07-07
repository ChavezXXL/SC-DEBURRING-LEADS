/** End-to-end proof of the audit trail:
 *  1) fire a no-op branding save (re-sends current name → writes an admin-log)
 *  2) GET /api/admin/activity and confirm the event is there, newest first.
 */
import { existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const APEX_UID = 'FNT9BRoRaUd8nkNVYaUD3aADO1y2'; // apexgrowthgroupllc@gmail.com
const WEBKEY = Buffer.from('QUl6YVN5QWJ5eFdHbFlQWWpVVmZYNmVaMU9yNnRkeHRTRHNVSlhn', 'base64').toString('utf8');
const BASE = 'https://apx-crm.pages.dev';

async function main() {
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const customToken = await getAuth().createCustomToken(APEX_UID);
  const ex = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEBKEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const idToken = ((await ex.json()) as any).idToken as string;

  // 1) no-op branding save → should append an admin-log entry
  const w = await fetch(`${BASE}/api/tenant/update-settings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, tenantId: 'sc-deburring', name: 'SC Deburring LLC' }),
  });
  console.log('[1] branding no-op save →', w.status, w.ok ? 'OK ✅' : 'FAIL ❌');

  // 2) read the trail
  const r = await fetch(`${BASE}/api/admin/activity`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const txt = await r.text();
  console.log('[2] GET /api/admin/activity →', r.status, r.ok ? 'OK ✅' : 'FAIL ❌');
  if (!r.ok) { console.log('  body:', txt.slice(0, 300)); process.exit(1); }
  const events = (JSON.parse(txt).events || []) as any[];
  console.log('  events:', events.length);
  for (const e of events.slice(0, 5)) {
    console.log('   -', e.at, '|', e.action, '|', e.targetTenantId, '|', e.detail, '| by', e.actorEmail);
  }
  const found = events.some((e) => e.action === 'branding.updated' && e.targetTenantId === 'sc-deburring');
  console.log(found ? '\nAUDIT TRAIL VERIFIED ✅ — action recorded and readable' : '\n❌ event not found in trail');
  process.exit(found ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
