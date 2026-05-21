/**
 * Shared helpers for the /api/admin/* and /api/create-tenant-account endpoints.
 *
 * Note: Cloudflare Pages Functions don't import from outside `functions/`, but
 * sibling imports inside `functions/` work fine. This file is referenced via
 * `../_shared/admin` from any function under functions/api/.
 *
 * Everything here uses WebCrypto + fetch — no Node-only deps.
 */

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

export interface AdminEnv {
  FIREBASE_SERVICE_ACCOUNT: string;
  RESEND_API_KEY?: string;
  RESEND_DOMAIN?: string;
  APP_URL?: string;
}

// ---- base64url + PEM ------------------------------------------------------

export function b64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ---- service-account OAuth ------------------------------------------------

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/firebase',
  'https://www.googleapis.com/auth/cloud-platform',
];

export async function getAccessToken(
  sa: ServiceAccount,
  scopes: string[] = DEFAULT_SCOPES,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const enc = new TextEncoder();
  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const claimsB64 = b64url(enc.encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${claimsB64}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    enc.encode(signingInput),
  );
  const jwt = `${signingInput}.${b64url(signature)}`;
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });
  if (!resp.ok) {
    throw new Error(`OAuth exchange failed: ${resp.status} ${await resp.text()}`);
  }
  const json: any = await resp.json();
  return json.access_token as string;
}

// ---- Firestore value codec ------------------------------------------------

export function toFirestoreValue(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toFirestoreValue) } };
  }
  if (typeof v === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toFirestoreValue(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

export function fromFirestoreValue(v: any): any {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in v) {
    const out: Record<string, any> = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) {
      out[k] = fromFirestoreValue(val);
    }
    return out;
  }
  return null;
}

export function docToObject(doc: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (!doc?.fields) return out;
  for (const [k, v] of Object.entries(doc.fields)) {
    out[k] = fromFirestoreValue(v);
  }
  return out;
}

// ---- Firestore REST helpers ----------------------------------------------

const FS_BASE = 'https://firestore.googleapis.com/v1';

export async function firestoreGet(
  projectId: string,
  token: string,
  path: string,
): Promise<any | null> {
  const url = `${FS_BASE}/projects/${projectId}/databases/(default)/documents/${path}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Firestore GET ${path}: ${resp.status}`);
  return await resp.json();
}

export async function firestoreSet(
  projectId: string,
  token: string,
  path: string,
  data: Record<string, any>,
): Promise<void> {
  const url = `${FS_BASE}/projects/${projectId}/databases/(default)/documents/${path}`;
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFirestoreValue(v);
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!resp.ok) throw new Error(`Firestore SET ${path}: ${resp.status} ${await resp.text()}`);
}

export async function firestorePatch(
  projectId: string,
  token: string,
  path: string,
  data: Record<string, any>,
  updateMask: string[],
): Promise<void> {
  const mask = updateMask
    .map((m) => `updateMask.fieldPaths=${encodeURIComponent(m)}`)
    .join('&');
  const url = `${FS_BASE}/projects/${projectId}/databases/(default)/documents/${path}?${mask}`;
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFirestoreValue(v);
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!resp.ok) throw new Error(`Firestore PATCH ${path}: ${resp.status} ${await resp.text()}`);
}

export async function firestoreDelete(
  projectId: string,
  token: string,
  path: string,
): Promise<void> {
  const url = `${FS_BASE}/projects/${projectId}/databases/(default)/documents/${path}`;
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Firestore DELETE ${path}: ${resp.status}`);
  }
}

export async function firestoreListCollection(
  projectId: string,
  token: string,
  collectionPath: string,
  pageSize = 300,
): Promise<any[]> {
  const docs: any[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(
      `${FS_BASE}/projects/${projectId}/databases/(default)/documents/${collectionPath}`,
    );
    url.searchParams.set('pageSize', String(pageSize));
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`Firestore LIST ${collectionPath}: ${resp.status}`);
    const json: any = await resp.json();
    if (json.documents) docs.push(...json.documents);
    pageToken = json.nextPageToken;
  } while (pageToken);
  return docs;
}

export async function firestoreStructuredQuery(
  projectId: string,
  token: string,
  body: any,
): Promise<any[]> {
  const url = `${FS_BASE}/projects/${projectId}/databases/(default)/documents:runQuery`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Firestore query: ${resp.status} ${await resp.text()}`);
  return await resp.json();
}

// ---- Identity Toolkit (Firebase Auth admin) -------------------------------

const IT_BASE = 'https://identitytoolkit.googleapis.com/v1';

export async function verifyIdToken(
  idToken: string,
  projectId: string,
): Promise<{ uid: string; email: string }> {
  const resp = await fetch(`${IT_BASE}/projects/${projectId}/accounts:lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!resp.ok) throw new Error('Invalid ID token');
  const json: any = await resp.json();
  const user = json?.users?.[0];
  if (!user?.localId) throw new Error('Invalid ID token (no localId)');
  return { uid: user.localId, email: user.email || '' };
}

export async function createAuthUser(
  projectId: string,
  token: string,
  email: string,
  password: string,
): Promise<string> {
  const resp = await fetch(`${IT_BASE}/projects/${projectId}/accounts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, emailVerified: false }),
  });
  const json: any = await resp.json();
  if (!resp.ok) throw new Error(json?.error?.message || `Auth create failed: ${resp.status}`);
  return json.localId as string;
}

export async function deleteAuthUser(
  projectId: string,
  token: string,
  uid: string,
): Promise<void> {
  const resp = await fetch(`${IT_BASE}/projects/${projectId}/accounts:delete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ localId: uid }),
  });
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Auth delete failed: ${resp.status} ${await resp.text()}`);
  }
}

export async function updateAuthPassword(
  projectId: string,
  token: string,
  uid: string,
  newPassword: string,
): Promise<void> {
  const resp = await fetch(`${IT_BASE}/projects/${projectId}/accounts:update`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ localId: uid, password: newPassword }),
  });
  if (!resp.ok) {
    throw new Error(`Auth password update failed: ${resp.status} ${await resp.text()}`);
  }
}

// ---- super-admin gate -----------------------------------------------------

export async function requireSuperAdmin(
  env: AdminEnv,
  idToken: string,
): Promise<{ sa: ServiceAccount; accessToken: string; projectId: string; callerUid: string }> {
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    throw httpError(500, 'Server missing FIREBASE_SERVICE_ACCOUNT secret');
  }
  if (!idToken) throw httpError(401, 'Missing idToken');
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
  const projectId = sa.project_id;
  const accessToken = await getAccessToken(sa);
  const caller = await verifyIdToken(idToken, projectId);
  const callerProfile = await firestoreGet(projectId, accessToken, `users/${caller.uid}`);
  const role = fromFirestoreValue(callerProfile?.fields?.role);
  if (role !== 'super-admin') {
    throw httpError(403, 'Only the super-admin can do that.');
  }
  return { sa, accessToken, projectId, callerUid: caller.uid };
}

// ---- response helpers -----------------------------------------------------

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function httpError(status: number, message: string): HttpError {
  return new HttpError(status, message);
}

export function jsonResp(obj: any, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResp(err: any): Response {
  if (err instanceof HttpError) {
    return jsonResp({ error: err.message }, err.status);
  }
  console.error('handler error:', err);
  return jsonResp({ error: err?.message || 'Internal error' }, 500);
}

// ---- Resend welcome / password reset email -------------------------------

export async function sendResendEmail(
  env: AdminEnv,
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email to', to);
    return;
  }
  const fromDomain = env.RESEND_DOMAIN || 'scprecisiondeburring.com';
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Apex Growth <noreply@${fromDomain}>`,
      to: [to],
      subject,
      text,
    }),
  });
  if (!resp.ok) {
    console.error('Resend email failed:', resp.status, await resp.text());
  }
}
