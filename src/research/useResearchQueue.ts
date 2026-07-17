import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Lead } from '../types';

const normalizeCompany = (value: string) =>
  (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const normalizeEmail = (value: string) => (value || '').toLowerCase().trim();

const normalizeWebsite = (value: string) => {
  const raw = (value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
};

/** Find an existing active CRM lead using the strongest stable identifiers.
 * Company is checked first, then direct email and website domain. */
export function findDuplicateLead(candidate: Lead, activeLeads: Lead[]): Lead | undefined {
  const company = normalizeCompany(candidate.co);
  const email = normalizeEmail(candidate.em);
  const website = normalizeWebsite(candidate.web);

  return activeLeads.find((lead) => {
    if (company && normalizeCompany(lead.co) === company) return true;
    if (email && normalizeEmail(lead.em) === email) return true;
    return Boolean(website && normalizeWebsite(lead.web) === website);
  });
}

interface UseResearchQueueArgs {
  tenantId: string | undefined;
  activeLeads: Lead[];
}

/** Approval-only transitions for research candidates.
 * Candidates already live in /leads but use a non-outreach status, so approval
 * is a small merge patch rather than a copy/delete operation. */
export function useResearchQueue({ tenantId, activeLeads }: UseResearchQueueArgs) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ensureCandidate = (candidate: Lead) => {
    if (!tenantId || candidate.tenantId !== tenantId) {
      throw new Error('This research candidate does not belong to the active workspace.');
    }
  };

  const run = async (candidate: Lead, action: () => Promise<void>): Promise<boolean> => {
    setBusyId(candidate.id);
    setError(null);
    try {
      ensureCandidate(candidate);
      await action();
      return true;
    } catch (err: any) {
      const message = err?.message || 'Could not update the research queue.';
      setError(message);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const approve = async (candidate: Lead) => {
    if (candidate.status !== 'research_pending') return false;
    const duplicate = findDuplicateLead(candidate, activeLeads);
    if (duplicate) {
      setError(`${candidate.co} matches an existing lead: ${duplicate.co}.`);
      return false;
    }

    const now = new Date().toISOString();
    const stamp = `[${now.slice(0, 10)}] Approved from Research Queue. No outreach sent.`;
    const notes = candidate.notes ? `${candidate.notes}\n${stamp}` : stamp;

    return run(candidate, () =>
      updateDoc(doc(db, 'leads', candidate.id), {
          status: 'new',
          notes,
          researchDecisionAt: now,
          researchUpdatedAt: now,
        }),
    );
  };

  const reject = async (candidate: Lead) => {
    if (candidate.status !== 'research_pending') return false;
    const now = new Date().toISOString();
    const stamp = `[${now.slice(0, 10)}] Research candidate rejected. No outreach sent.`;
    const notes = candidate.notes ? `${candidate.notes}\n${stamp}` : stamp;

    return run(candidate, () =>
      updateDoc(doc(db, 'leads', candidate.id), {
          status: 'research_rejected',
          notes,
          researchDecisionAt: now,
          researchUpdatedAt: now,
        }),
    );
  };

  const restore = async (candidate: Lead) => {
    if (candidate.status !== 'research_rejected') return false;
    const now = new Date().toISOString();
    const stamp = `[${now.slice(0, 10)}] Restored to Research Queue for review.`;
    const notes = candidate.notes ? `${candidate.notes}\n${stamp}` : stamp;

    return run(candidate, () =>
      updateDoc(doc(db, 'leads', candidate.id), {
          status: 'research_pending',
          notes,
          researchDecisionAt: '',
          researchUpdatedAt: now,
        }),
    );
  };

  return {
    busyId,
    error,
    clearError: () => setError(null),
    approve,
    reject,
    restore,
  };
}
