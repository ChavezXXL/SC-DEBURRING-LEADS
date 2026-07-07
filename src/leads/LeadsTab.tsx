import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Lead, LeadStatus, AiMode } from '../types';
import { REGIONS, STATUS } from '../data';
import { LeadCard } from './LeadCard';
import { isDueFollowUp, isHiringSignal } from './useLeadFilters';
import type { LeadFilterState, LeadFilterSetters } from './useLeadFilters';

interface LeadsTabProps {
  visibleLeads: Lead[];
  filtered: Lead[];
  filters: LeadFilterState;
  setters: LeadFilterSetters;

  // Card open/note state owned by App (so survives tab switches)
  openId: string | null;
  setOpenId: (id: string | null) => void;
  editId: string | null;
  setEditId: (id: string | null) => void;
  draft: string;
  setDraft: (d: string) => void;
  cp: string | null;
  copy: (id: string, text: string) => void;
  qs: {
    google: (co: string) => string;
    linkedin: (co: string) => string;
    indeed: (city: string) => string;
  };

  // CRUD callbacks (from useLeadCrud)
  setStatus: (id: string, st: LeadStatus) => void | Promise<void>;
  saveNote: (id: string, notes: string) => void | Promise<void>;
  setReminder: (id: string, d: string | null) => void | Promise<void>;
  queueOutreach: (lead: Lead) => void | Promise<void>;
  markEmailed: (lead: Lead) => void | Promise<void>;
  logCall: (lead: Lead) => void | Promise<void>;

  // Modal/AI handlers (from App)
  handleAI: (lead: Lead, mode: AiMode) => void;
  onDelete: (id: string, co: string) => void;
  onAddLeadClick: () => void;
}

/**
 * The Leads tab — search + filter toolbar + HOT 5 banner + list of LeadCards.
 *
 * Filter state lives in useLeadFilters (owned by App) so the Sidebar's
 * clickable pipeline stat cards can drive it from outside the tab.
 */
export function LeadsTab({
  visibleLeads,
  filtered,
  filters,
  setters,
  openId,
  setOpenId,
  editId,
  setEditId,
  draft,
  setDraft,
  cp,
  copy,
  qs,
  setStatus,
  saveNote,
  setReminder,
  queueOutreach,
  markEmailed,
  logCall,
  handleAI,
  onDelete,
  onAddLeadClick,
}: LeadsTabProps) {
  const { regF, stF, tierF, pmOnly, remindersOnly, q, hot5, dueFollowUp, hiringOnly } = filters;
  const {
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
  } = setters;

  // Debounced search: the input stays instant (local state) while the heavy
  // re-filter + re-render of ~275 cards only fires after typing settles.
  const [qInput, setQInput] = useState(q);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Power shortcuts, Leads tab only: "/" focuses search, "n" opens Add Lead.
  // Ignored while typing in any field so they never eat real input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return;
      }
      // Dead while any dialog is up — shortcuts belong to the list, not modals.
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        onAddLeadClick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAddLeadClick]);

  // Keep the box in sync when q is cleared/changed elsewhere (reset, sidebar).
  useEffect(() => {
    setQInput(q);
  }, [q]);

  useEffect(() => {
    if (qInput === q) return;
    debRef.current = setTimeout(() => setQ(qInput), 180);
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [qInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const namedPMs = useMemo(
    () => visibleLeads.filter((l) => !!l.pm).length,
    [visibleLeads],
  );

  // Live count for the "Due follow-up" chip — independent of active filters.
  const dueCount = useMemo(
    () => visibleLeads.filter((l) => isDueFollowUp(l)).length,
    [visibleLeads],
  );

  // Live count for the "Hiring" chip — shops whose notes carry a hiring signal.
  const hiringCount = useMemo(
    () => visibleLeads.filter((l) => isHiringSignal(l)).length,
    [visibleLeads],
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-100">
            {hot5 ? "Today's Pipeline" : 'Leads'}
          </h1>
          <p className="text-xs tabular-nums text-slate-400">
            {filtered.length} of {visibleLeads.length} leads · {REGIONS.length - 1} regions ·{' '}
            {namedPMs} named purchasing managers
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onAddLeadClick}
            className="flex items-center gap-2 rounded-xl bg-apex-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-950/50 transition hover:brightness-110 active:scale-[0.99]"
          >
            + Add Lead
            <kbd
              aria-hidden
              className="hidden rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white/80 md:inline-block"
            >
              N
            </kbd>
          </button>
        </div>
      </div>

      {hot5 && filtered.length > 0 && (
        <div className="mb-6 rounded-2xl bg-orange-500/10 ring-1 ring-orange-500/30 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-orange-300 text-sm flex items-center gap-2">
                🔥 Today's {filtered.length} — your move
              </div>
              <div className="mt-1 text-xs text-slate-300 leading-relaxed">
                Tier-1 leads with named decision-makers and verified emails. Send{' '}
                {filtered.length} emails before lunch — that's your daily goal. After each send,
                expand the card and mark status &quot;emailed&quot; so it drops off the list.
              </div>
            </div>
            <button
              onClick={() => setHot5(false)}
              className="shrink-0 rounded-xl bg-apex-800 ring-1 ring-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-slate-100"
              title="Exit HOT 5 mode and view all leads"
            >
              View all leads
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-apex-850 ring-1 ring-white/10 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            ref={searchRef}
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search company, contact, city, parts..."
            className="w-full rounded-xl bg-apex-800 py-2 pl-9 pr-8 text-sm text-slate-100 placeholder-slate-500 ring-1 ring-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-apex-accent/60"
          />
          {!qInput && (
            <kbd
              aria-hidden
              className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-white/10 md:block"
            >
              /
            </kbd>
          )}
          {qInput && (
            <button
              onClick={() => {
                setQInput('');
                setQ('');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <select
          value={regF}
          onChange={(e) => setRegF(e.target.value)}
          className="cursor-pointer rounded-xl bg-apex-800 px-3 py-2 text-xs text-slate-300 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-apex-accent/60"
        >
          {REGIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>

        <select
          value={tierF}
          onChange={(e) => setTierF(e.target.value)}
          className="cursor-pointer rounded-xl bg-apex-800 px-3 py-2 text-xs text-slate-300 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-apex-accent/60"
        >
          <option value="all">All Tiers</option>
          <option value="1">Tier 1 — Call Now</option>
          <option value="2">Tier 2 — Target</option>
        </select>

        <select
          value={stF}
          onChange={(e) => setStF(e.target.value)}
          className="cursor-pointer rounded-xl bg-apex-800 px-3 py-2 text-xs text-slate-300 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-apex-accent/60"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Pipeline</option>
          {STATUS.map((st) => (
            <option key={st.k} value={st.k}>
              {st.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            if (!hot5) resetAll();
            setHot5(!hot5);
          }}
          className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
            hot5
              ? 'bg-apex-accent text-white shadow-sm shadow-orange-950/50'
              : 'bg-orange-500/10 text-orange-300 ring-1 ring-orange-500/30 hover:bg-orange-500/20'
          }`}
          title="Show top 5 actionable leads to contact today (new + has email + has named PM)"
        >
          {hot5 ? '🔥 HOT 5 ACTIVE' : '🔥 HOT 5 TODAY'}
        </button>

        <button
          onClick={() => {
            if (!dueFollowUp) setHot5(false); // HOT 5 only shows new leads — mutually exclusive
            setDueFollowUp(!dueFollowUp);
          }}
          className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-all ${
            dueFollowUp
              ? 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/40'
              : 'bg-apex-800 text-slate-300 ring-1 ring-white/10 hover:bg-white/10'
          }`}
          title="Emailed 4+ days ago, fewer than 3 touches, no reply — time to follow up"
        >
          Due follow-up
          <span
            className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              dueFollowUp ? 'bg-violet-500/25 text-violet-200' : 'bg-white/10 text-slate-300'
            }`}
          >
            {dueCount}
          </span>
        </button>

        <button
          onClick={() => {
            if (!hiringOnly) setHot5(false); // HOT 5 only shows its own top 5 — mutually exclusive
            setHiringOnly(!hiringOnly);
          }}
          className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-all ${
            hiringOnly
              ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40'
              : 'bg-apex-800 text-slate-300 ring-1 ring-white/10 hover:bg-white/10'
          }`}
          title="Notes show a hiring signal — deburr/finisher openings mean they're overloaded right now"
        >
          Hiring
          <span
            className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              hiringOnly ? 'bg-amber-500/25 text-amber-200' : 'bg-white/10 text-slate-300'
            }`}
          >
            {hiringCount}
          </span>
        </button>

        <button
          onClick={() => setPmOnly(!pmOnly)}
          className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-all ${
            pmOnly
              ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40'
              : 'bg-apex-800 text-slate-300 ring-1 ring-white/10 hover:bg-white/10'
          }`}
        >
          {pmOnly ? 'Named PM Only' : 'Named PMs Only'}
        </button>

        <button
          onClick={() => setRemindersOnly(!remindersOnly)}
          className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-all ${
            remindersOnly
              ? 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/40'
              : 'bg-apex-800 text-slate-300 ring-1 ring-white/10 hover:bg-white/10'
          }`}
        >
          {remindersOnly ? 'Reminders Only' : 'Reminders'}
        </button>
      </div>

      {filtered.length === 0 ? (
        visibleLeads.length === 0 ? (
          // Brand-new account — no leads at all yet. Welcoming onboarding state.
          <div className="rounded-2xl bg-apex-850 ring-1 ring-white/10 py-16 px-8 text-center">
            <div className="text-2xl">👋</div>
            <h2 className="mt-4 text-lg font-semibold text-slate-100">
              Welcome to your CRM
            </h2>
            <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Your account is fresh — no leads yet. Click <strong className="text-slate-200">+ Add Lead</strong>{' '}
              above to enter your first one, or use the AI assistant in the bottom right
              to find leads in your area.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={onAddLeadClick}
                className="inline-flex items-center gap-2 rounded-xl bg-apex-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-950/50 transition hover:brightness-110 active:scale-[0.99]"
              >
                + Add your first lead
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-apex-850 ring-1 ring-white/10 py-16 px-8 text-center">
            <div className="text-2xl">🔍</div>
            <p className="mt-3 text-sm text-slate-400">No leads match your filters.</p>
            <button
              onClick={() => {
                resetAll();
                setHot5(false);
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-apex-800 px-4 py-2 text-xs font-medium text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-slate-100"
            >
              Clear all filters
            </button>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              openId={openId}
              setOpenId={setOpenId}
              editId={editId}
              setEditId={setEditId}
              draft={draft}
              setDraft={setDraft}
              setStatus={setStatus}
              saveNote={saveNote}
              setReminder={setReminder}
              setDeleteModal={(m) => m && onDelete(m.id, m.co)}
              handleAI={handleAI}
              cp={cp}
              copy={copy}
              qs={qs}
              onQueueOutreach={queueOutreach}
              onMarkEmailed={markEmailed}
              onLogCall={logCall}
            />
          ))}
        </div>
      )}
    </div>
  );
}
