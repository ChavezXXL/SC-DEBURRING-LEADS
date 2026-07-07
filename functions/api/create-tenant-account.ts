/**
 * POST /api/create-tenant-account
 *
 * Super-admin only endpoint. Spins up a brand-new tenant + first user account
 * + sends them a welcome email. Server-side so creating a new account doesn't
 * sign the super-admin out of their own browser session.
 *
 * Body:
 *   {
 *     idToken: string,            // requester's Firebase ID token (proves super-admin)
 *     tenantId: string,           // slug, e.g. "acme-machine"
 *     tenantName: string,         // display name, e.g. "Acme Machine Shop"
 *     ownerEmail: string,
 *     ownerPassword: string,      // temp password set by super-admin
 *     primaryColor?: string,
 *   }
 *
 * Required Cloudflare Pages env / secrets:
 *   FIREBASE_SERVICE_ACCOUNT  – the full service-account JSON, one line
 *   RESEND_API_KEY            – for the welcome email
 *   RESEND_DOMAIN             – e.g. "scprecisiondeburring.com"
 *   APP_URL                   – e.g. "https://apx-crm.pages.dev" (where the welcome email points)
 */

import { logAdminAction } from '../_shared/admin';

interface Env {
  FIREBASE_SERVICE_ACCOUNT: string;
  RESEND_API_KEY: string;
  RESEND_DOMAIN?: string;
  APP_URL?: string;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

interface Body {
  idToken: string;
  tenantId: string;
  tenantName: string;
  ownerEmail: string;
  ownerPassword: string;
  primaryColor?: string;
}

// ----- JWT signing & helpers (shared shape with workers/auto-outreach) -----

function base64urlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(sa: ServiceAccount, scopes: string[]): Promise<string> {
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
  const headerB64 = base64urlEncode(enc.encode(JSON.stringify(header)));
  const claimsB64 = base64urlEncode(enc.encode(JSON.stringify(claims)));
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
  const jwt = `${signingInput}.${base64urlEncode(signature)}`;

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

// Verify the caller's Firebase ID token, returning the uid + email.
async function verifyIdToken(idToken: string, projectId: string, accessToken: string): Promise<{ uid: string; email: string }> {
  // Project-scoped accounts:lookup is an admin endpoint: it 403s "unregistered
  // caller" unless authenticated with the service-account access token. The
  // idToken in the body identifies (and validates) which user is calling.
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!resp.ok) {
    throw new Error('Invalid ID token');
  }
  const json: any = await resp.json();
  const user = json?.users?.[0];
  if (!user?.localId) throw new Error('Invalid ID token (no localId)');
  return { uid: user.localId, email: user.email || '' };
}

// Firestore helpers
function toFirestoreValue(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toFirestoreValue(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function fromFirestoreValue(v: any): any {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  return null;
}

async function firestoreGet(projectId: string, token: string, path: string): Promise<any | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Firestore GET ${path}: ${resp.status}`);
  return await resp.json();
}

async function firestoreSet(
  projectId: string,
  token: string,
  path: string,
  data: Record<string, any>,
): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFirestoreValue(v);
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!resp.ok) throw new Error(`Firestore SET ${path}: ${resp.status} ${await resp.text()}`);
}

// Create a Firebase Auth user via Identity Toolkit admin endpoint
async function createAuthUser(
  projectId: string,
  token: string,
  email: string,
  password: string,
): Promise<string> {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, emailVerified: false }),
    },
  );
  const json: any = await resp.json();
  if (!resp.ok) {
    throw new Error(json?.error?.message || `Auth create failed: ${resp.status}`);
  }
  return json.localId as string;
}

// Send the welcome email via Resend
async function sendWelcomeEmail(
  env: Env,
  toEmail: string,
  tenantName: string,
  password: string,
): Promise<void> {
  const fromDomain = env.RESEND_DOMAIN || 'scprecisiondeburring.com';
  const appUrl = env.APP_URL || 'https://apx-crm.pages.dev';
  const subject = `Your ${tenantName} CRM is ready`;
  const text = `Welcome to your CRM.

We've set up an account for ${tenantName}. Here's how to sign in:

  URL:      ${appUrl}
  Email:    ${toEmail}
  Password: ${password}

For security, please sign in and change your password right away.

If you didn't expect this email, ignore it.

Santiago Chavez
Apex Growth
(818) 389-4234
`;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Apex Growth <welcome@${fromDomain}>`,
      to: [toEmail],
      subject,
      text,
    }),
  });
  // Email failure shouldn't roll back the account creation. Log it.
  if (!resp.ok) {
    console.error('Welcome email failed:', resp.status, await resp.text());
  }
}

// ----- handler -------------------------------------------------------------

type CtxArg = { request: Request; env: Env };

export const onRequestPost = async ({ request, env }: CtxArg): Promise<Response> => {
  try {
    if (!env.FIREBASE_SERVICE_ACCOUNT) {
      return jsonResp({ error: 'Server missing FIREBASE_SERVICE_ACCOUNT secret' }, 500);
    }

    const body = (await request.json()) as Body;
    if (!body.idToken || !body.tenantId || !body.tenantName || !body.ownerEmail || !body.ownerPassword) {
      return jsonResp({ error: 'Missing required fields' }, 400);
    }
    if (body.ownerPassword.length < 6) {
      return jsonResp({ error: 'Password must be at least 6 characters' }, 400);
    }
    const slug = body.tenantId.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '');
    if (!slug) return jsonResp({ error: 'Invalid tenant ID' }, 400);

    const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
    const projectId = sa.project_id;
    const accessToken = await getAccessToken(sa, [
      'https://www.googleapis.com/auth/datastore',
      'https://www.googleapis.com/auth/firebase',
      'https://www.googleapis.com/auth/cloud-platform',
    ]);

    // 1) Verify the caller is super-admin
    const caller = await verifyIdToken(body.idToken, projectId, accessToken);
    const callerProfile = await firestoreGet(projectId, accessToken, `users/${caller.uid}`);
    const role = fromFirestoreValue(callerProfile?.fields?.role);
    if (role !== 'super-admin') {
      return jsonResp({ error: 'Only the super-admin can create accounts.' }, 403);
    }

    // 2) Make sure the tenant slug isn't taken
    const existingTenant = await firestoreGet(projectId, accessToken, `tenants/${slug}`);
    if (existingTenant) {
      return jsonResp({ error: `Tenant "${slug}" already exists. Pick a different slug.` }, 409);
    }

    // 3) Create the Firebase Auth user
    const newUid = await createAuthUser(projectId, accessToken, body.ownerEmail, body.ownerPassword);

    // 4) Create the tenant doc
    const now = new Date().toISOString();
    await firestoreSet(projectId, accessToken, `tenants/${slug}`, {
      id: slug,
      name: body.tenantName,
      ownerEmail: body.ownerEmail,
      ...(body.primaryColor ? { primaryColor: body.primaryColor } : {}),
      createdAt: now,
      plan: 'trial',
    });

    // 5) Create the user profile (role: owner of this tenant)
    await firestoreSet(projectId, accessToken, `users/${newUid}`, {
      uid: newUid,
      email: body.ownerEmail,
      tenantId: slug,
      role: 'owner',
      createdAt: now,
    });

    // 6) Send welcome email (don't block on failure)
    await sendWelcomeEmail(env, body.ownerEmail, body.tenantName, body.ownerPassword);

    // 7) Audit trail — the flagship platform event.
    await logAdminAction(projectId, accessToken, {
      action: 'client.created',
      actorUid: caller.uid,
      actorEmail: caller.email,
      targetTenantId: slug,
      detail: `${body.tenantName} — owner ${body.ownerEmail}`,
    });

    return jsonResp({
      success: true,
      tenantId: slug,
      uid: newUid,
      message: `Account created and welcome email sent to ${body.ownerEmail}.`,
    });
  } catch (err: any) {
    console.error('create-tenant-account error:', err);
    return jsonResp({ error: err?.message || 'Internal error' }, 500);
  }
};

function jsonResp(obj: any, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
