import type { Lead, LeadStatus } from '../types';

/**
 * One-click Gmail draft templates (SC Deburring tenant outreach copy).
 * Cold = never worked with us. Warm = past/active relationship, so the
 * check-in template is used instead — clients must never get the cold pitch.
 */

export interface OutreachTemplate {
  subject: string;
  body: string;
}

/** Statuses that mean "they know us" — these always get the warm template. */
const WARM_STATUSES: LeadStatus[] = ['client', 'visited', 'interested', 'quote'];

export function isWarmLead(lead: Lead): boolean {
  return WARM_STATUSES.includes(lead.status);
}

export const COLD_TEMPLATE: OutreachTemplate = {
  subject: 'deburring help when your bench gets backed up',
  body:
    "Hi,\n\nMy name's Santiago — I run SC Precision Deburring in Pacoima. We do hand and microscope deburring, flash and heavy burr grinding, and edge finishing on already-machined aerospace parts, titanium through aluminum.\n\nTwo things we're known for: the quality, and how fast it goes back out. Most of our customers come to us because they needed the parts yesterday — we move quick and they still leave done right. Honestly, we're one of the better shops around here for this.\n\nIf you ever get backed up, or have a batch you'd rather hand off, we're here. We pick up and drop off anywhere in SoCal.\n\nSantiago Chavez\nSC Precision Deburring · Pacoima\n(818) 389-4234 · scprecisiondeburring.com",
};

export const WARM_TEMPLATE: OutreachTemplate = {
  subject: 'checking in from SC Precision Deburring',
  body:
    "Hi,\n\nIt's Santiago at SC Precision Deburring in Pacoima — we did some deburring for you a while back and I wanted to check in. What are you running these days?\n\nIf deburring or finishing is piling up, we've got the capacity right now and we're quick — happy to grab your next batch whenever it's useful.\n\nSantiago Chavez\nSC Precision Deburring · Pacoima\n(818) 389-4234 · scprecisiondeburring.com",
};

/** Gmail compose URL for this lead, warm/cold template picked by status. */
export function buildGmailUrl(lead: Lead): string {
  const t = isWarmLead(lead) ? WARM_TEMPLATE : COLD_TEMPLATE;
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    lead.em,
  )}&su=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.body)}`;
}
