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
  subject: 'Precision deburring support',
  body:
    'Hi,\n\nSantiago here, owner of SC Deburring. I wanted to reach out and introduce my company. We’re a precision deburring company here in Southern California.\n\nI saw your team handles [specific parts or manufacturing work]. We specialize in precision hand and microscope deburring, internal intersections, edge breaks, blending, and finishing on difficult machined parts.\n\nI’m sure your team already has deburring handled in-house or through a supplier you trust. If you ever get backed up, need a faster turnaround, or have a difficult part that needs extra attention, give us a shot. We’re known for high-quality work and fast turnaround.\n\nFeel free to look at our website and get a better idea of our work.\n\nThank you!\n\nSantiago Chavez\nPresident, SC DEBURRING LLC\n(818) 389-4234\nSALES@SCPRECISIONDEBURRING.COM\nhttps://scprecisiondeburring.com/',
};

export const WARM_TEMPLATE: OutreachTemplate = {
  subject: 'checking in from SC Precision Deburring',
  body:
    'Hi,\n\nSantiago here from SC Deburring. I wanted to check in and see how things are going.\n\nIf your team gets backed up or has a difficult part that needs extra attention, keep us in mind. We’d be happy to take a look.\n\nThank you!\n\nSantiago Chavez\nPresident, SC DEBURRING LLC\n(818) 389-4234\nSALES@SCPRECISIONDEBURRING.COM\nhttps://scprecisiondeburring.com/',
};

/** Keep CRM-generated cold drafts factual and company-specific. */
function coldTemplateFor(lead: Lead): OutreachTemplate {
  const companyLine = lead.parts?.trim()
    ? `I saw the type of work ${lead.co} handles, including ${lead.parts.trim()}`
    : `I saw the precision manufacturing work ${lead.co} handles.`;
  const factualLine = companyLine.endsWith('.') ? companyLine : `${companyLine}.`;

  return {
    ...COLD_TEMPLATE,
    body: COLD_TEMPLATE.body.replace(
      'I saw your team handles [specific parts or manufacturing work].',
      factualLine,
    ),
  };
}

/** Gmail compose URL for this lead, warm/cold template picked by status. */
export function buildGmailUrl(lead: Lead): string {
  const t = isWarmLead(lead) ? WARM_TEMPLATE : coldTemplateFor(lead);
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    lead.em,
  )}&su=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.body)}`;
}
