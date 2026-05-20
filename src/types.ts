export type LeadStatus =
  | 'new'
  | 'called'
  | 'emailed'
  | 'visited'
  | 'voicemail'
  | 'interested'
  | 'quote'
  | 'dead'
  | 'client';

export interface Lead {
  id: string;
  t: 1 | 2;
  r: string;
  co: string;
  city: string;
  ph: string;
  em: string;
  web: string;
  who: string;
  role: string;
  pm: string;
  pm_title: string;
  parts: string;
  pitch: string;
  status: LeadStatus;
  notes: string;
  /** ISO date string (YYYY-MM-DD) for the next reminder/follow-up to act on this lead. Optional. */
  reminderDate?: string;
  /** ISO timestamp of when this lead was last contacted (email/call/text). Powers "stale leads" view. */
  lastContactedAt?: string;
  /** Total touches across all channels. Increment when sending email, logging a call, etc. */
  touchCount?: number;
}

export interface StatusDef {
  k: LeadStatus;
  label: string;
  dot: string;
  bg: string;
  tx: string;
}

export interface ScriptDef {
  id: string;
  cat: 'Cold Call' | 'Email' | 'Text' | 'Walk-In' | 'LinkedIn';
  icon: string;
  title: string;
  use: string;
  body: string;
}

export interface ObjectionDef {
  q: string;
  a: string;
}

export type TabKey = 'leads' | 'outreach' | 'pipeline' | 'brain' | 'autopilot';
export type AiMode = 'pitch' | 'research';

export type OutreachMode = 'all_new' | 'tier1' | 'tagged';

export interface AutoOutreachSettings {
  enabled: boolean;
  mode: OutreachMode;
  dailyLimit: number;
}

export interface OutreachLog {
  id: string;
  leadId: string;
  company: string;
  contact: string;
  email: string;
  subject: string;
  body: string;
  sentAt: string;
  status: 'sent' | 'opened' | 'replied' | 'bounced';
}