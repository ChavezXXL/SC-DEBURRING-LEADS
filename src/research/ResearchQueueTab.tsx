import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  RotateCcw,
  SearchCheck,
  ShieldCheck,
  UserRoundSearch,
  X,
  XCircle,
} from 'lucide-react';
import type { Lead } from '../types';
import { findDuplicateLead } from './useResearchQueue';

type QueueFilter = 'pending' | 'approved' | 'rejected' | 'all';

interface ResearchQueueTabProps {
  candidates: Lead[];
  activeLeads: Lead[];
  busyId: string | null;
  error: string | null;
  clearError: () => void;
  approve: (candidate: Lead) => Promise<void>;
  reject: (candidate: Lead) => Promise<void>;
  restore: (candidate: Lead) => Promise<void>;
  onLeadClick: (id: string) => void;
}

const sourceLabel = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Source';
  }
};

const statusOf = (lead: Lead): QueueFilter => {
  if (lead.status === 'research_pending') return 'pending';
  if (lead.status === 'research_rejected') return 'rejected';
  return 'approved';
};

export function ResearchQueueTab({
  candidates,
  activeLeads,
  busyId,
  error,
  clearError,
  approve,
  reject,
  restore,
  onLeadClick,
}: ResearchQueueTabProps) {
  const [filter, setFilter] = useState<QueueFilter>('pending');

  const approved = useMemo(
    () => activeLeads.filter((lead) => Boolean(lead.researchCreatedAt)),
    [activeLeads],
  );
  const allItems = useMemo(() => [...candidates, ...approved], [candidates, approved]);
  const shown = useMemo(
    () => allItems.filter((lead) => filter === 'all' || statusOf(lead) === filter),
    [allItems, filter],
  );
  const pending = candidates.filter((lead) => lead.status === 'research_pending');
  const rejected = candidates.filter((lead) => lead.status === 'research_rejected');
  const duplicateCount = pending.filter((lead) => findDuplicateLead(lead, activeLeads)).length;

  const filters: Array<{ key: QueueFilter; label: string; count: number }> = [
    { key: 'pending', label: 'Needs review', count: pending.length },
    { key: 'approved', label: 'Approved', count: approved.length },
    { key: 'rejected', label: 'Rejected', count: rejected.length },
    { key: 'all', label: 'All', count: allItems.length },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 motion-safe:animate-fade-in">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">
            <SearchCheck size={15} />
            Approval-only research
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100">Research Queue</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Review researched companies before they enter the active CRM. Nothing in this queue sends an email or contacts a company.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/25">
          <ShieldCheck size={15} />
          Outreach disabled
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Needs review', value: pending.length, Icon: Clock3, color: 'text-orange-400' },
          { label: 'Approved', value: approved.length, Icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Possible duplicates', value: duplicateCount, Icon: AlertTriangle, color: 'text-amber-400' },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-2xl bg-apex-850 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">{label}</span>
              <Icon size={16} className={color} />
            </div>
            <div className="mt-3 text-2xl font-semibold tabular-nums text-slate-100">{value}</div>
          </div>
        ))}
      </section>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-2xl bg-red-500/10 p-4 text-red-300 ring-1 ring-red-500/30">
          <div className="flex gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div className="text-sm">{error}</div>
          </div>
          <button onClick={clearError} className="rounded-lg p-1.5 hover:bg-red-500/15" aria-label="Dismiss error">
            <X size={15} />
          </button>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-apex-900 p-1 ring-1 ring-white/10">
        {filters.map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
              filter === item.key
                ? 'bg-apex-accent/15 text-orange-300 ring-1 ring-apex-accent/25'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            {item.label}
            <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] tabular-nums">{item.count}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-apex-900/50 px-6 py-16 text-center">
          <SearchCheck className="mx-auto text-slate-600" size={34} />
          <h2 className="mt-4 text-base font-semibold text-slate-200">
            {filter === 'pending' ? 'No companies waiting for approval' : `No ${filter} research yet`}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            New companies found through the research workflow will appear here with their signals, sources, and recommended next step.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((lead) => {
            const itemStatus = statusOf(lead);
            const duplicate = itemStatus === 'pending' ? findDuplicateLead(lead, activeLeads) : undefined;
            const isBusy = busyId === lead.id;
            return (
              <article key={lead.id} className="rounded-2xl bg-apex-850 p-5 ring-1 ring-white/10 shadow-sm shadow-black/30">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-100">{lead.co}</h2>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ring-1 ${
                        itemStatus === 'pending'
                          ? 'bg-orange-500/10 text-orange-300 ring-orange-500/25'
                          : itemStatus === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25'
                            : 'bg-slate-500/10 text-slate-400 ring-slate-500/25'
                      }`}>
                        {itemStatus}
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-400 ring-1 ring-white/10">
                        Tier {lead.t || 2}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                      {(lead.city || lead.r) && (
                        <span className="flex items-center gap-1.5"><MapPin size={13} />{[lead.city, lead.r].filter(Boolean).join(' · ')}</span>
                      )}
                      {lead.researchSignalDate && (
                        <span className="flex items-center gap-1.5"><CalendarDays size={13} />Signal: {lead.researchSignalDate}</span>
                      )}
                      {(lead.role || lead.pm_title) && (
                        <span className="flex items-center gap-1.5"><UserRoundSearch size={13} />Target: {lead.pm_title || lead.role}</span>
                      )}
                    </div>

                    {lead.researchSignal && (
                      <div className="mt-4 rounded-xl bg-apex-800 p-3 ring-1 ring-white/8">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fresh signal</div>
                        <p className="mt-1.5 text-sm leading-6 text-slate-200">{lead.researchSignal}</p>
                      </div>
                    )}

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Why it matters</div>
                        <p className="mt-1.5 text-sm leading-6 text-slate-300">{lead.researchWhy || lead.pitch || 'No fit analysis added yet.'}</p>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Next research step</div>
                        <p className="mt-1.5 text-sm leading-6 text-slate-300">{lead.researchNextStep || 'Verify the right operations or purchasing contact.'}</p>
                      </div>
                    </div>

                    {lead.researchSourceUrls && lead.researchSourceUrls.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {lead.researchSourceUrls.slice(0, 4).map((url, index) => (
                          <a
                            key={`${url}-${index}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
                          >
                            {sourceLabel(url)} <ExternalLink size={12} />
                          </a>
                        ))}
                      </div>
                    )}

                    {duplicate && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200 ring-1 ring-amber-500/25">
                        <AlertTriangle size={15} />
                        Possible duplicate of <strong>{duplicate.co}</strong>.
                        <button onClick={() => onLeadClick(duplicate.id)} className="font-semibold underline underline-offset-2 hover:text-amber-100">
                          Open existing lead
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 lg:w-44 lg:flex-col">
                    {itemStatus === 'pending' && (
                      <>
                        <button
                          onClick={() => void approve(lead)}
                          disabled={isBusy || Boolean(duplicate)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-apex-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-950/40 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <CheckCircle2 size={16} /> Approve to Leads
                        </button>
                        <button
                          onClick={() => void reject(lead)}
                          disabled={isBusy}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 ring-1 ring-white/10 hover:bg-red-500/10 hover:text-red-300 hover:ring-red-500/25 disabled:opacity-40"
                        >
                          <XCircle size={16} /> Reject
                        </button>
                      </>
                    )}
                    {itemStatus === 'rejected' && (
                      <button
                        onClick={() => void restore(lead)}
                        disabled={isBusy}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
                      >
                        <RotateCcw size={16} /> Review again
                      </button>
                    )}
                    {itemStatus === 'approved' && (
                      <button
                        onClick={() => onLeadClick(lead.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/25 hover:bg-emerald-500/15"
                      >
                        Open Lead <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
