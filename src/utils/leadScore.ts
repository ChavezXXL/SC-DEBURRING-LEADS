import type { Lead } from '../types';

const NEED_SIGNAL_RE = /hiring|deburr|deflash|finisher|hand finish|bench|backlog|overflow|bottleneck/i;
const HARD_PART_RE = /aerospace|defen[cs]e|space|fitting|valve|manifold|cross[- ]drill|intersection|internal|titanium|inconel|hardened|fastener|hydraulic|gear/i;
const VOLUME_RE = /high[- ]volume|production|recurring|cnc|machines|spindles|contract|award|expansion|ramp|shift|supplier/i;

export interface LeadScore {
  score: number;
  reasons: string[];
  nextAction: string;
}

function combinedSignal(lead: Lead): string {
  return [
    lead.parts,
    lead.pitch,
    lead.role,
    lead.notes,
    lead.researchSignal,
    lead.researchWhy,
  ]
    .filter(Boolean)
    .join(' ');
}

export function nextLeadAction(lead: Lead): string {
  if (lead.status === 'client') return 'Ask for another recurring part or a referral';
  if (lead.status === 'quote') return 'Follow up on the open quote';
  if (lead.status === 'interested') return 'Ask for a drawing, quantity and trial lot';
  if (lead.status === 'visited') return 'Follow up on the visit and ask for one part';
  if (lead.status === 'emailed') return 'Call the buyer and reference the email';
  if (lead.status === 'voicemail') return 'Call again, then send a short email';
  if (lead.status === 'called') return 'Follow up with the named contact';
  if (lead.status === 'dead') return 'Keep out of active prospecting';
  if (!lead.pm?.trim()) return 'Find the purchasing or outside-processing contact';
  if (!lead.ph?.trim() && !lead.em?.trim()) return 'Verify a direct phone or email';
  if (lead.ph?.trim()) return 'Call first and ask about overflow or a difficult part';
  return 'Send a personalized introduction, then schedule the call';
}

/**
 * Transparent 0–100 opportunity score. It intentionally uses only CRM facts,
 * never invented company data, so the owner can see why a lead ranks highly.
 */
export function getLeadScore(lead: Lead): LeadScore {
  if (lead.status === 'dead') {
    return { score: 0, reasons: ['Marked dead'], nextAction: nextLeadAction(lead) };
  }

  const reasons: string[] = [];
  const signal = combinedSignal(lead);
  let score = 0;

  if (lead.status === 'client') {
    score += 35;
    reasons.push('Existing relationship');
  } else if (lead.t === 1) {
    score += 18;
    reasons.push('Tier 1 priority');
  } else {
    score += 8;
  }

  if (NEED_SIGNAL_RE.test(signal)) {
    score += 22;
    reasons.push('Deburr or capacity signal');
  }
  if (HARD_PART_RE.test(signal)) {
    score += 15;
    reasons.push('Burr-prone aerospace work');
  }
  if (VOLUME_RE.test(signal)) {
    score += 12;
    reasons.push('Production-volume signal');
  }
  if (lead.pm?.trim()) {
    score += 15;
    reasons.push('Named decision-maker');
  }
  if (lead.em?.trim()) {
    score += 8;
    reasons.push('Email available');
  }
  if (lead.ph?.trim()) {
    score += 5;
    reasons.push('Phone available');
  }
  if (lead.address?.trim()) {
    score += 5;
    reasons.push('Visit-ready address');
  }
  if (lead.researchSourceUrls?.length) {
    score += 5;
    reasons.push('Public evidence saved');
  }

  if (lead.status === 'interested') score += 18;
  if (lead.status === 'quote') score += 22;

  return {
    score: Math.min(100, score),
    reasons,
    nextAction: nextLeadAction(lead),
  };
}

export function compareLeadScore(a: Lead, b: Lead): number {
  return getLeadScore(b).score - getLeadScore(a).score || a.t - b.t || a.co.localeCompare(b.co);
}
