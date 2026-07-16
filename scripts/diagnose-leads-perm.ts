/** Reproduce the CRM "Missing or insufficient permissions" on leads list.
 * Mints a real idToken per account and runs the EXACT client query through
 * the Firestore REST API (which enforces security rules), so we see the same
 * allow/deny the browser sees. Also dumps tenant.disabled + every user. */
import { existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const PID = 'sc-deburring-leads';
const WEBKEY = Buffer.from('QUl6YVN5QWJ5eFdHbFlQWWpVVmZYNmVaMU9yNnRkeHRTRHNVSlhn', 'base64').toString('utf8');

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

async function listLeads(idToken: string, tenantId: string) {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PID}/databases/(default)/documents:runQuery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'leads' }],
        where: { fieldFilter: { field: { fieldPath: 'tenantId' }, op: 'EQUAL', value: { stringValue: tenantId } } },
        limit: 3,
      },
    }),
  });
  const txt = await r.text();
  return { status: r.status, ok: r.ok, body: txt.slice(0, 240) };
}

async function main() {
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: PID });
  const db = getFirestore();

  console.log('=== TENANTS ===');
  const ts = await db.collection('tenants').get();
  ts.forEach((d) => { const x = d.data() as any; console.log(`  ${d.id} | disabled=${x.disabled} | plan=${x.plan} | name=${x.name}`); });

  console.log('\n=== USERS ===');
  const us = await db.collection('users').get();
  const accounts: { uid: string; email: string; tenantId: string; role: string }[] = [];
  us.forEach((d) => { const x = d.data() as any; accounts.push({ uid: d.id, email: x.email, tenantId: x.tenantId, role: x.role }); console.log(`  ${x.email} | role=${x.role} | tenantId=${x.tenantId} | uid=${d.id}`); });

  console.log('\n=== REPRODUCE LEADS LIST (as each account, scoped to their tenant) ===');
  for (const a of accounts) {
    const scope = a.tenantId === '__platform__' ? 'sc-deburring' : a.tenantId; // platform admin would switch into a client
    try {
      const idt = await idTokenFor(a.uid);
      const res = await listLeads(idt, scope);
      console.log(`  ${a.email} (role ${a.role}) list leads[tenantId=${scope}] -> ${res.status} ${res.ok ? 'OK ✅' : 'DENIED ❌ ' + res.body}`);
    } catch (e: any) {
      console.log(`  ${a.email}: ERROR ${e.message}`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error('FATAL:', e.message || e); process.exit(1); });
