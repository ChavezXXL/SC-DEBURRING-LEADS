import { useEffect, useMemo, useState } from 'react';
import type { Lead } from '../types';

const FOLLOW_UP_AFTER_DAYS = 4;
const FOLLOW_UP_MAX_TOUCHES = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "Emailed, went quiet" — emailed ≥4 days ago with fewer than 3 touches. */
export function isDueFollowUp(l: Lead, now: number = Date.now()): boolean {
  if (l.status !== 'emailed' || !l.lastContactedAt) return false;
  const at = new Date(l.lastContactedAt).getTime();
  if (Number.isNaN(at)) return false;
  return now - at >= FOLLOW_UP_AFTER_DAYS * DAY_MS && (l.touchCount || 0) < FOLLOW_UP_MAX_TOUCHES;
}

const HIRING_SIGNAL_RE = /hiring|deburr associate|deflash|finisher/i;

/** "They're hiring deburr help" — notes carry a hiring signal, meaning the
 * shop is overloaded right now and primed for an outsourcing pitch. */
export function isHiringSignal(l: Lead): boolean {
  return HIRING_SIGNAL_RE.test(l.notes || '');
}

export interface LeadFilterState {
  regF: string;
  stF: string;
  tierF: string;
  pmOnly: boolean;
  remindersOnly: boolean;
  q: string;
  hot5: boolean;
  dueFollowUp: boolean;
  hiringOnly: boolean;
}

export interface LeadFilterSetters {
  setRegF: (v: string) => void;
  setStF: (v: string) => void;
  setTierF: (v: string) => void;
  setPmOnly: (v: boolean) => void;
  setRemindersOnly: (v: boolean) => void;
  setQ: (v: string) => void;
  setHot5: (v: boolean) => void;
  setDueFollowUp: (v: boolean) => void;
  setHiringOnly: (v: boolean) => void;
  /** Reset all filters to defaults (called by HOT 5 toggle + sidebar quick-jumps). */
  resetAll: () => void;
  /** Sidebar clicks on pipeline stat cards land here.
   *  Filter ids: 'total' | 't1' | 'pm' | 'active' | 'warm' | 'clients' */
  applyPipelineFilter: (id: string) => void;
}

/**
 * Owns the Leads-tab filter state in one place. App.tsx wires the setters
 * to both the sidebar (pipeline-stat shortcuts) and the LeadsTab (toolbar
 * controls + filtered list).
 */
export function useLeadFilters(
  visibleLeads: Lead[],
): { state: LeadFilterState; setters: LeadFilterSetters; filtered: Lead[] } {
  const [regF, setRegF] = useState('All Regions');
  const [stF, setStF] = useState('all');
  const [tierF, setTierF] = useState('all');
  const [pmOnly, setPmOnly] = useState(false);
  const [remindersOnly, setRemindersOnly] = useState(false);
  const [q, setQ] = useState('');
  const [dueFollowUp, setDueFollowUp] = useState(false);
  const [hiringOnly, setHiringOnly] = useState(false);

  // HOT 5 auto-activates once per day so the morning opens to "what to do today"
  const [hot5, setHot5] = useState(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      return localStorage.getItem('sc_leads_hot5_last_kick') !== today;
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (hot5) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem('sc_leads_hot5_last_kick', today);
      } catch {}
    }
  }, [hot5]);

  const resetAll = () => {
    setRegF('All Regions');
    setStF('all');
    setTierF('all');
    setPmOnly(false);
    setRemindersOnly(false);
    setQ('');
    setDueFollowUp(false);
    setHiringOnly(false);
  };

  const applyPipelineFilter = (id: string) => {
    setQ('');
    setRemindersOnly(false);
    setHot5(false);
    setDueFollowUp(false);
    setHiringOnly(false);
    if (id === 'total') {
      setStF('all');
      setTierF('all');
      setPmOnly(false);
    } else if (id === 't1') {
      setStF('all');
      setTierF('1');
      setPmOnly(false);
    } else if (id === 'pm') {
      setStF('all');
      setTierF('all');
      setPmOnly(true);
    } else if (id === 'active') {
      setStF('active');
      setTierF('all');
      setPmOnly(false);
    } else if (id === 'warm') {
      setStF('interested');
      setTierF('all');
      setPmOnly(false);
    } else if (id === 'clients') {
      setStF('client');
      setTierF('all');
      setPmOnly(false);
    }
  };

  const filtered = useMemo(() => {
    const now = Date.now();
    const list = visibleLeads.filter((l) => {
      if (regF !== 'All Regions' && l.r !== regF) return false;
      if (dueFollowUp && !isDueFollowUp(l, now)) return false;
      if (hiringOnly && !isHiringSignal(l)) return false;
      if (stF === 'active') {
        if (['new', 'dead', 'client'].includes(l.status)) return false;
      } else if (stF !== 'all' && l.status !== stF) {
        return false;
      }
      if (tierF === '1' && l.t !== 1) return false;
      if (tierF === '2' && l.t !== 2) return false;
      if (pmOnly && !l.pm) return false;
      if (remindersOnly && !l.reminderDate) return false;

      if (hot5) {
        if (l.status !== 'new') return false;
        if (!l.em || !l.em.trim()) return false;
        if (!l.pm || !l.pm.trim()) return false;
        if (l.reminderDate && new Date(l.reminderDate) > new Date()) return false;
      }

      if (q) {
        const lq = q.toLowerCase();
        return (
          (l.co || '').toLowerCase().includes(lq) ||
          (l.who || '').toLowerCase().includes(lq) ||
          (l.pm || '').toLowerCase().includes(lq) ||
          (l.parts || '').toLowerCase().includes(lq) ||
          (l.city || '').toLowerCase().includes(lq)
        );
      }
      return true;
    });

    if (remindersOnly) {
      list.sort((a, b) => {
        if (!a.reminderDate) return 1;
        if (!b.reminderDate) return -1;
        return new Date(a.reminderDate).getTime() - new Date(b.reminderDate).getTime();
      });
    }

    if (hot5) {
      list.sort((a, b) => {
        if (a.t !== b.t) return a.t - b.t;
        return (a.co || '').localeCompare(b.co || '');
      });
      list.splice(5);
    }

    return list;
  }, [visibleLeads, regF, stF, tierF, pmOnly, remindersOnly, q, hot5, dueFollowUp, hiringOnly]);

  return {
    state: { regF, stF, tierF, pmOnly, remindersOnly, q, hot5, dueFollowUp, hiringOnly },
    setters: {
      setRegF,
      setStF,
      setTierF,
      setPmOnly,
      setRemindersOnly,
      setQ,
      setHot5,
      setDueFollowUp,
      setHiringOnly,
      resetAll,
      applyPipelineFilter,
    },
    filtered,
  };
}
