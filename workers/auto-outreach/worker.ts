/**
 * Cloudflare Worker — auto-outreach scheduled job.
 *
 * Replaces the old `netlify/functions/auto-outreach.ts`. Runs daily at 8am PT
 * (15:00 UTC). Pulls eligible leads from Firestore, drafts a personalized
 * cold email via Gemini, sends via Resend, logs the send.
 *
 * Deploy separately from the Pages project:
 *   cd workers/auto-outreach
 *   npx wrangler deploy
 *
 * Required env vars (set via `wrangler secret put` or the Cloudflare dashboard):
 *   FIREBASE_SERVICE_ACCOUNT  - the full service-account JSON (one line)
 *   GEMINI_API_KEY            - Google AI Studio key
 *   RESEND_API_KEY            - Resend key
 *   RESEND_DOMAIN             - e.g. "scprecisiondeburring.com"
 *
 * Why Workers (not Pages Functions): scheduled cron triggers run on Workers.
 * Why no firebase-admin: that package depends on Node-only modules. We
 * authenticate to Firestore by signing a JWT with the service account using
 * WebCrypto and exchanging it for an access token at the Google OAuth endpoint.
 */

interface Env {
  FIREBASE_SERVICE_ACCOUNT: string;
  GEMINI_API_KEY: string;
  RESEND_API_KEY: string;
  RESEND_DOMAIN?: string;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

interface Lead {
  id: string;
  t?: number;
  co?: string;
  city?: string;
  em?: string;
  who?: string;
  role?: string;
  pm?: string;
  pm_title?: string;
  parts?: string;
  pitch?: string;
  status?: string;
  tenantId?: string;
  queued_for_outreach?: boolean;
}

const ANGLES = [
  'overflow_capacity',
  'quality_pain',
  'speed',
  'local_convenience',
  'cost_reduction',
  'specialty_expertise',
];

// --------------------------------------------------------------------------
// Firestore REST helpers
// --------------------------------------------------------------------------

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

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
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

// Convert a plain JS object into the Firestore "values" wire format.
function toFirestoreValue(v: any): any {
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

function fromFirestoreValue(v: any): any {
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

function docToObject(doc: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (!doc?.fields) return out;
  for (const [k, v] of Object.entries(doc.fields)) {
    out[k] = fromFirestoreValue(v);
  }
  return out;
}

async function firestoreGet(
  projectId: string,
  token: string,
  path: string,
): Promise<any | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Firestore GET ${path}: ${resp.status}`);
  return await resp.json();
}

async function firestorePatch(
  projectId: string,
  token: string,
  path: string,
  data: Record<string, any>,
  updateMask?: string[],
): Promise<void> {
  const mask = updateMask
    ? '?' + updateMask.map((m) => `updateMask.fieldPaths=${encodeURIComponent(m)}`).join('&')
    : '';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}${mask}`;
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
  if (!resp.ok) throw new Error(`Firestore PATCH ${path}: ${resp.status} ${await resp.text()}`);
}

async function firestoreCreate(
  projectId: string,
  token: string,
  collectionPath: string,
  data: Record<string, any>,
): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}`;
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFirestoreValue(v);
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!resp.ok) throw new Error(`Firestore CREATE ${collectionPath}: ${resp.status} ${await resp.text()}`);
}

async function firestoreStructuredQuery(
  projectId: string,
  token: string,
  body: any,
): Promise<any[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Firestore query: ${resp.status} ${await resp.text()}`);
  return await resp.json();
}

// --------------------------------------------------------------------------
// Gemini
// --------------------------------------------------------------------------

async function generateEmail(
  apiKey: string,
  lead: Lead,
): Promise<{ subject: string; body: string }> {
  const contact = lead.pm || lead.who || '';
  const firstName = contact.split(' ')[0] || 'there';
  const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];

  const prompt = `You are Santiago Chavez, owner of SC Precision Deburring — a 35-year family-owned aerospace deburring shop in Pacoima, CA. Write a cold email to a potential customer.

RULES:
- Write like a real person. Casual but professional.
- 3-5 sentences MAX. Short paragraphs.
- NEVER use: "I hope this finds you well", "I wanted to reach out", "I'm reaching out", "allow me to introduce", "please don't hesitate", "synergy", "leverage", "solutions"
- NEVER use bullet points or lists
- NEVER start with "Dear" — use "Hey ${firstName}," or "${firstName},"
- Subject line: lowercase, 2-6 words, sounds like a quick question
- End with: Santiago\\nSC Deburring LLC\\n(818) 389-4234\\nscprecisiondeburring.com\\n12734 Branford St #17, Pacoima CA 91331
- Reference something specific about their company

Company: ${lead.co}
Contact: ${firstName}
Title: ${lead.role || lead.pm_title || ''}
City: ${lead.city || 'unknown'}, CA
Makes: ${lead.parts || 'precision components'}
Angle: ${lead.pitch || 'aerospace deburring'}
Approach: ${angle.replace('_', ' ')}

Return ONLY:
Subject: [subject]

[body]`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 350 },
      }),
    },
  );
  const json: any = await resp.json();
  const text = (json?.candidates?.[0]?.content?.parts?.[0]?.text || '')
    .replace(/\[cite:\s*[\d,\s#]+\]/gi, '')
    .trim();
  const subjectMatch = text.match(/^Subject:\s*(.+)/m);
  const subject = subjectMatch ? subjectMatch[1].trim() : `quick question for ${lead.co}`;
  const body = subjectMatch ? text.replace(/^Subject:\s*.+\n*/m, '').trim() : text;
  return { subject, body };
}

// --------------------------------------------------------------------------
// Main job
// --------------------------------------------------------------------------

async function runAutoOutreach(env: Env): Promise<{ message: string; sentToday: number; results: any[] }> {
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
  const token = await getAccessToken(sa);
  const projectId = sa.project_id;

  // 1. Settings
  const settingsDoc = await firestoreGet(projectId, token, 'settings/auto-outreach');
  const settings = settingsDoc ? docToObject(settingsDoc) : { enabled: false, mode: 'all_new', dailyLimit: 15 };
  if (!settings.enabled) return { message: 'Auto-outreach is disabled', sentToday: 0, results: [] };

  // 2. Today's send count
  const today = new Date().toISOString().slice(0, 10);
  const logsResp = await firestoreStructuredQuery(projectId, token, {
    structuredQuery: {
      from: [{ collectionId: 'outreach-logs' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'sentDate' },
          op: 'EQUAL',
          value: { stringValue: today },
        },
      },
    },
  });
  const sentToday = logsResp.filter((r: any) => r.document).length;
  const dailyLimit = (settings.dailyLimit as number) || 15;
  const remaining = Math.max(0, dailyLimit - sentToday);
  if (remaining === 0) return { message: 'Daily limit reached', sentToday, results: [] };

  // 3. Eligible leads
  const filters: any[] = [
    { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'new' } } },
  ];
  if (settings.mode === 'tier1') {
    filters.push({ fieldFilter: { field: { fieldPath: 't' }, op: 'EQUAL', value: { integerValue: '1' } } });
  } else if (settings.mode === 'tagged') {
    filters.push({
      fieldFilter: {
        field: { fieldPath: 'queued_for_outreach' },
        op: 'EQUAL',
        value: { booleanValue: true },
      },
    });
  }
  const leadsResp = await firestoreStructuredQuery(projectId, token, {
    structuredQuery: {
      from: [{ collectionId: 'leads' }],
      where: { compositeFilter: { op: 'AND', filters } },
      limit: remaining,
    },
  });

  const results: any[] = [];
  let sentNow = 0;

  for (const row of leadsResp) {
    if (!row.document) continue;
    const docName = row.document.name as string; // projects/.../documents/leads/{id}
    const leadId = docName.split('/').pop()!;
    const lead = { id: leadId, ...docToObject(row.document) } as Lead;
    if (!lead.em) continue;

    try {
      const { subject, body } = await generateEmail(env.GEMINI_API_KEY, lead);
      const fromDomain = env.RESEND_DOMAIN || 'scprecisiondeburring.com';

      const sendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Santiago - SC Deburring <outreach@${fromDomain}>`,
          to: [lead.em],
          subject,
          text: body,
        }),
      });
      const sendJson: any = await sendResp.json();
      if (!sendResp.ok) {
        results.push({ leadId, company: lead.co, error: sendJson?.message || 'Resend error' });
        continue;
      }

      const logId = crypto.randomUUID();
      await firestoreCreate(projectId, token, 'outreach-logs', {
        leadId,
        company: lead.co || '',
        contact: lead.pm || lead.who || '',
        email: lead.em,
        subject,
        body,
        sentAt: new Date().toISOString(),
        sentDate: today,
        status: 'sent',
        emailId: sendJson?.id || '',
        ...(lead.tenantId ? { tenantId: lead.tenantId } : {}),
      });

      await firestorePatch(
        projectId,
        token,
        `leads/${leadId}`,
        { status: 'emailed', queued_for_outreach: false },
        ['status', 'queued_for_outreach'],
      );

      results.push({ leadId, company: lead.co, status: 'sent' });
      sentNow++;
      // Rate-limit pause between sends
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err: any) {
      results.push({ leadId, company: lead.co, error: err?.message || String(err) });
    }
  }

  return { message: 'Auto-outreach complete', sentToday: sentToday + sentNow, results };
}

// --------------------------------------------------------------------------
// Worker entry points
// --------------------------------------------------------------------------

export default {
  // Cron trigger (configured in wrangler.toml)
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runAutoOutreach(env).then((r) => console.log('auto-outreach:', JSON.stringify(r))),
    );
  },
  // Manual HTTP trigger for testing / on-demand runs
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Use POST to trigger auto-outreach manually.', { status: 405 });
    }
    try {
      const out = await runAutoOutreach(env);
      return new Response(JSON.stringify(out), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: err?.message || 'Internal error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
  },
};
