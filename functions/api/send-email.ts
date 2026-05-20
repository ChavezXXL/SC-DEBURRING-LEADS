/**
 * Cloudflare Pages Function — POST /api/send-email
 *
 * Mirrors the existing Netlify function in `netlify/functions/send-email.ts`
 * but uses Cloudflare's PagesFunction signature. Resend's HTTP API works fine
 * from Workers — no Node-only deps. Set RESEND_API_KEY in CF Pages env vars.
 */

interface Env {
  RESEND_API_KEY: string;
  RESEND_DOMAIN?: string;
}

interface EmailBody {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
}

// PagesFunction type comes from @cloudflare/workers-types — we use a minimal
// inline signature here so we don't need that dep just to compile locally.
type CtxArg = { request: Request; env: Env };

export const onRequestPost = async ({ request, env }: CtxArg): Promise<Response> => {
  try {
    const { to, subject, body, fromName } = (await request.json()) as EmailBody;

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const fromDomain = env.RESEND_DOMAIN || 'scprecisiondeburring.com';
    const fromLabel = fromName || 'Santiago - SC Deburring';

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromLabel} <outreach@${fromDomain}>`,
        to: [to],
        subject,
        text: body,
      }),
    });

    const json: any = await resp.json();
    if (!resp.ok) {
      return new Response(
        JSON.stringify({ success: false, error: json?.message || 'Resend error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailId: json?.id,
        sentAt: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
