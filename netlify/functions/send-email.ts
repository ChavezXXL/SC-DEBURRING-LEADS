import type { Handler } from '@netlify/functions';
import { Resend } from 'resend';

const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'RESEND_API_KEY not configured. Add it in Netlify environment variables.' }),
    };
  }

  let payload: {
    to: string;
    subject: string;
    body: string;
    fromName?: string;
    fromEmail?: string;
    leadId?: string;
  };

  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { to, subject, body, fromName, fromEmail, leadId } = payload;

  if (!to || !subject || !body) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing required fields: to, subject, body' }),
    };
  }

  const resend = new Resend(apiKey);

  // Build HTML email with professional formatting
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a1a;">
      ${body.split('\n').map(line => line.trim() ? `<p style="margin: 0 0 12px 0;">${line}</p>` : '<br/>').join('\n')}
    </div>
  `.trim();

  // Use custom from address if configured, otherwise Resend's test domain
  const from = fromEmail
    ? `${fromName || 'Anthony'} <${fromEmail}>`
    : `${fromName || 'Anthony - SC Precision Deburring'} <onboarding@resend.dev>`;

  try {
    const result = await resend.emails.send({
      from,
      to: [to],
      subject,
      html: htmlBody,
      text: body, // plain text fallback
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        emailId: result.data?.id || null,
        leadId,
        sentAt: new Date().toISOString(),
      }),
    };
  } catch (err: any) {
    console.error('Resend error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: err?.message || 'Failed to send email',
        details: err?.statusCode ? `Resend status: ${err.statusCode}` : undefined,
      }),
    };
  }
};

export { handler };
