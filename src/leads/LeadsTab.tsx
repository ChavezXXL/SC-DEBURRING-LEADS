import React, { useMemo } from 'react';
import { Search, X } from 'lucide-react';
import type { Lead, LeadStatus, AiMode } from '../types';
import { REGIONS, STATUS } from '../data';
import { LeadCard } from './LeadCard';
import { isDueFollowUp } from './useLeadFilters';
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
  handleAI,
  onDelete,
  onAddLeadClick,
}: LeadsTabProps) {
  const { regF, stF, tierF, pmOnly, remindersOnly, q, hot5, dueFollowUp } = filters;
  const {
    setRegF,
    setStF,
    setTierF,
    setPmOnly,
    setRemindersOnly,
    setQ,
    setHot5,
    setDueFollowUp,
    resetAll,
  } = setters;

  const namedPMs = useMemo(
    () => visibleLeads.filter((l) => !!l.pm).length,
    [visibleLeads],
  );

  // Live count for the "Due follow-up" chip — independent of active filters.
  const dueCount = useMemo(
    () => visibleLeads.filter((l) => isDueFollowUp(l)).length,
    [visibleLeads],
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-900">
            {hot5 ? "Today's Pipeline" : 'Leads'}
          </h1>
          <p className="text-xs text-slate-500">
            {filtered.length} of {visibleLeads.length} leads · {REGIONS.length - 1} regions ·{' '}
            {namedPMs} named purchasing managers
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onAddLeadClick}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.99]"
          >
            + Add Lead
          </button>
        </div>
      </div>

      {hot5 && filtered.length > 0 && (
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 ring-1 ring-orange-200/60 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-orange-700 text-sm flex items-center gap-2">
                🔥 Today's {filtered.length} — your move
              </div>
              <div className="mt-1 text-xs text-slate-600 leading-relaxed">
                Tier-1 leads with named decision-makers and verified emails. Send{' '}
                {filtered.length} emails before lunch — that's your daily goal. After each send,
                expand the card and mark status &quot;emailed&quot; so it drops off the list.
              </div>
            </div>
            <button
              onClick={() => setHot5(false)}
              className="shrink-0 rounded-xl bg-white ring-1 ring-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              title="Exit HOT 5 mode and view all leads"
            >
              View all leads
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white ring-1 ring-slate-200/70 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, contact, city, parts..."
            className="w-full rounded-xl bg-slate-50 py-2 pl-9 pr-8 text-sm text-slate-900 placeholder-slate-400 ring-1 ring-slate-200 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <select
          value={regF}
          onChange={(e) => setRegF(e.target.value)}
          className="cursor-pointer rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          {REGIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>

        <select
          value={tierF}
          onChange={(e) => setTierF(e.target.value)}
          className="cursor-pointer rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="all">All Tiers</option>
          <option value="1">Tier 1 — Call Now</option>
          <option value="2">Tier 2 — Target</option>
        </select>

        <select
          value={stF}
          onChange={(e) => setStF(e.target.value)}
          className="cursor-pointer rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
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
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
            hot5
              ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
              : 'bg-orange-50 text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100'
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
          className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${
            dueFollowUp
              ? 'bg-violet-100 text-violet-700 ring-1 ring-violet-200'
              : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
          }`}
          title="Emailed 4+ days ago, fewer than 3 touches, no reply — time to follow up"
        >
          Due follow-up
          <span
            className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              dueFollowUp ? 'bg-violet-200 text-violet-800' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {dueCount}
          </span>
        </button>

        <button
          onClick={() => setPmOnly(!pmOnly)}
          className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${
            pmOnly
              ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
              : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
          }`}
        >
          {pmOnly ? 'Named PM Only' : 'Named PMs Only'}
        </button>

        <button
          onClick={() => setRemindersOnly(!remindersOnly)}
          className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${
            remindersOnly
              ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
              : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
          }`}
        >
          {remindersOnly ? 'Reminders Only' : 'Reminders'}
        </button>
      </div>

      {filtered.length === 0 ? (
        visibleLeads.length === 0 ? (
          // Brand-new account — no leads at all yet. Welcoming onboarding state.
          <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 py-16 px-8 text-center">
            <div className="text-2xl">👋</div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              Welcome to your CRM
            </h2>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Your account is fresh — no leads yet. Click <strong>+ Add Lead</strong>{' '}
              above to enter your first one, or use the AI assistant in the bottom right
              to find leads in your area.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={onAddLeadClick}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.99]"
              >
                + Add your first lead
              </button>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-sm text-slate-400">
            No leads match your filters.
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
