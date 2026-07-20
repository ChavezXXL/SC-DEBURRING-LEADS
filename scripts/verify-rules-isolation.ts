/** Verify tenant isolation after a rules deploy. As the SC Deburring OWNER
 * (a non-super-admin), prove:
 *   [A] querying own tenant's leads still works (200) — no lockout
 *   [B] querying ALL leads with no tenant filter is DENIED (loose-list hole shut)
 *   [C] querying another tenant's leads is DENIED (no cross-tenant read)
 * Super-admins legitimately bypass, so the owner is the meaningful test. */
import { existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const PID = 'sc-deburring-leads';
const WEBKEY = Buffer.from('QUl6YVN5QWJ5eFdHbFlQWWpVVmZYNmVaMU9yNnRkeHRTRHNVSlhn', 'base64').toString('utf8');
const OWNER_UID = 'GKkhq82345cuQC0yb6rMx4fqAxB2'; // scprecisiondeburring@gmail.com, owner/sc-deburring

async function idTokenFor(uid: string): Promise<string> {
  const ct = await getAuth().createCustomToken(uid);
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEBKEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: ct, returnSecureToken: true }),
  });
  const j: any = await r.json();
  if (!r.ok) throw new Error('token exchange failed: ' + JSON.stringify(j));
  return j.idToken;
}

async function query(idToken: string, tenantId?: string) {
  const structuredQuery: any = { from: [{ collectionId: 'leads' }], limit: 3 };
  if (tenantId) {
    structuredQuery.where = { fieldFilter: { field: { fieldPath: 'tenantId' }, op: 'EQUAL', value: { stringValue: tenantId } } };
  }
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PID}/databases/(default)/documents:runQuery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ structuredQuery }),
  });
  return { status: r.status, ok: r.ok };
}

async function main() {
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: PID });
  const idt = await idTokenFor(OWNER_UID);

  const a = await query(idt, 'sc-deburring');
  const b = await query(idt); // no filter
  const c = await query(idt, 'apex-growth');

  const line = (label: string, r: { status: number; ok: boolean }, wantOk: boolean) => {
    const pass = r.ok === wantOk;
    console.log(`  ${pass ? 'PASS ✅' : 'FAIL ❌'}  ${label} -> ${r.status} (${r.ok ? 'allowed' : 'denied'}, wanted ${wantOk ? 'allowed' : 'denied'})`);
    return pass;
  };

  console.log('=== Tenant isolation (as SC Deburring owner) ===');
  const p1 = line('[A] own tenant (sc-deburring)', a, true);
  const p2 = line('[B] ALL leads, no filter', b, false);
  const p3 = line('[C] another tenant (apex-growth)', c, false);

  const allPass = p1 && p2 && p3;
  console.log(allPass ? '\nALL ISOLATION CHECKS PASSED ✅' : '\nSOME CHECKS FAILED ❌ — consider rollback');
  process.exit(allPass ? 0 : 2);
}
main().catch((e) => { console.error('FATAL:', e.message || e); process.exit(1); });
