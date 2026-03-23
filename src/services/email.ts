export interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  leadId?: string;
  fromName?: string;
}

export interface SendEmailResponse {
  success: boolean;
  emailId?: string;
  leadId?: string;
  sentAt?: string;
  error?: string;
}

export async function sendEmail(req: SendEmailRequest): Promise<SendEmailResponse> {
  if (!req.to || !req.subject || !req.body) {
    return { success: false, error: 'Missing required fields: to, subject, body' };
  }

  try {
    const res = await fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || `Server error (${res.status})` };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error — check your connection' };
  }
}
