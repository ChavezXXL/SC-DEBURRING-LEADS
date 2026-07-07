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

import { apiFetch } from './api';

export async function sendEmail(req: SendEmailRequest): Promise<SendEmailResponse> {
  if (!req.to || !req.subject || !req.body) {
    return { success: false, error: 'Missing required fields: to, subject, body' };
  }

  try {
    // apiFetch guards against the unconfigured-server case (HTML instead of
    // JSON) so callers get a human message, never "Unexpected token '<'".
    return await apiFetch<SendEmailResponse>('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error — check your connection' };
  }
}
