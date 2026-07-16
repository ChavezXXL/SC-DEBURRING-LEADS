export type LeadStatus =
  | 'research_pending'
  | 'research_rejected'
  | 'new'
  | 'called'
  | 'emailed'
  | 'visited'
  | 'voicemail'
  | 'interested'
  | 'quote'
  | 'dead'
  | 'client';

export type PipelineLeadStatus = Exclude<
  LeadStatus,
  'research_pending' | 'research_rejected'
>;

export interface Lead {
  id: string;
  /** Multi-tenant scoping. Each tenant only sees leads with their tenantId.
   * Optional for backward-compat — legacy leads pre-multi-tenant don't have it,
   * and the migration script tags those with tenantId="sc-deburring". */
  tenantId?: string;
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
  /** Public-research context. These fields are populated while a company is
   * waiting in the Research Queue and remain as provenance after approval. */
  researchSignal?: string;
  researchSignalDate?: string;
  researchWhy?: string;
  researchSourceUrls?: string[];
  researchNextStep?: string;
  researchCreatedAt?: string;
  researchUpdatedAt?: string;
  researchDecisionAt?: string;
}

export interface StatusDef {
  k: PipelineLeadStatus;
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

export type TabKey =
  | 'today'
  | 'leads'
  | 'research'
  | 'outreach'
  | 'pipeline'
  | 'admin'
  | 'settings';

/**
 * A tenant = one business that logs into the CRM.
 * Santiago is the first tenant (sc-deburring). Each marketing-agency client
 * he onboards becomes another tenant.
 */
export interface Tenant {
  id: string;            // slug, e.g. "sc-deburring"
  name: string;          // display name, e.g. "SC Deburring LLC"
  ownerEmail: string;    // who can manage this tenant
  primaryColor?: string; // hex, used to "suit them" — defaults to neutral
  logoUrl?: string;      // optional custom logo
  createdAt: string;     // ISO timestamp
  plan?: 'trial' | 'paid' | 'internal';
  disabled?: boolean;    // super-admin can disable a tenant; blocks all reads
  disabledAt?: string;
  lastActivityAt?: string;
}

/** Stats row for the admin panel. Computed server-side per tenant. */
export interface TenantStats extends Tenant {
  leadCount: number;
  userCount: number;
}

/**
 * A user = one Firebase Auth account.
 * Maps a Firebase Auth UID to the tenant they belong to + their role.
 */
export interface UserProfile {
  uid: string;
  email: string;
  tenantId: string;          // which tenant's data this user sees
  role: 'super-admin' | 'owner' | 'member';
  displayName?: string;
  createdAt: string;
}
