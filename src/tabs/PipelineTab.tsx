import React from 'react';
import type { Lead, LeadStatus } from '../types';
import { STATUS } from '../data';
import { Calendar, MapPin, User } from 'lucide-react';

interface PipelineTabProps {
  leads: Lead[];
  onLeadClick: (id: string) => void;
  /** Move a lead to another stage (from useLeadCrud). */
  setStatus: (id: string, st: LeadStatus) => void | Promise<void>;
}

export function PipelineTab({ leads, onLeadClick, setStatus }: PipelineTabProps) {
  // Group leads by status
  const leadsByStatus: Record<LeadStatus, Lead[]> = {
    new: [],
    called: [],
    emailed: [],
    visited: [],
    voicemail: [],
    interested: [],
    quote: [],
    sample: [],
    po: [],
    dead: [],
    client: [],
    anchor: [],
  };

  leads.forEach((lead) => {
    if (leadsByStatus[lead.status]) {
      leadsByStatus[lead.status].push(lead);
    }
  });

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-6 shrink-0">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-100">
          Pipeline
        </h1>
        <p className="text-xs text-slate-400">
          Where each deal stands. Click a card to open it — use its stage menu to move it.
        </p>
      </div>

      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {STATUS.map((st) => {
          const columnLeads = leadsByStatus[st.k];
          if (!columnLeads) return null;

          return (
            <div
              key={st.k}
              className="flex w-72 shrink-0 flex-col rounded-xl bg-apex-900 ring-1 ring-white/10"
            >
              <div
                className="flex items-center justify-between border-b border-white/10 p-3"
                style={{ borderTop: `3px solid ${st.dot}` }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: st.dot }}
                  />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: st.tx }}>
                    {st.label}
                  </span>
                </div>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium tabular-nums text-slate-300 ring-1 ring-white/10">
                  {columnLeads.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                <div className="flex flex-col gap-3">
                  {columnLeads.map((lead) => {
                    const isReminderPast = lead.reminderDate ? new Date(lead.reminderDate) < new Date(new Date().setHours(0, 0, 0, 0)) : false;
                    const isReminderToday = lead.reminderDate ? lead.reminderDate === new Date().toISOString().split('T')[0] : false;

                    return (
                      <div
                        key={lead.id}
                        onClick={() => onLeadClick(lead.id)}
                        className="cursor-pointer rounded-xl bg-apex-850 p-3 ring-1 ring-white/10 transition-all hover:shadow-md hover:shadow-black/40 hover:ring-white/20"
                      >
                        <div className="mb-2 text-sm font-semibold text-slate-100 line-clamp-1" title={lead.co}>
                          {lead.co}
                        </div>

                        <div className="mb-2 flex flex-col gap-1.5 text-[11px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <User size={12} />
                            <span className="line-clamp-1" title={lead.pm || lead.who || undefined}>{lead.pm || lead.who || 'No contact'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} />
                            <span className="line-clamp-1">{lead.city || 'No city'}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ${
                              lead.t === 1
                                ? 'bg-orange-500/10 text-orange-300 ring-orange-500/30'
                                : 'bg-blue-500/10 text-blue-300 ring-blue-500/30'
                            }`}
                          >
                            {lead.t === 1 ? 'T1' : 'T2'}
                          </span>

                          {lead.reminderDate && (
                            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold tabular-nums ring-1 ${
                              isReminderPast ? 'bg-red-500/10 text-red-300 ring-red-500/30' :
                              isReminderToday ? 'bg-orange-500/10 text-orange-300 ring-orange-500/30' :
                              'bg-blue-500/10 text-blue-300 ring-blue-500/30'
                            }`}>
                              <Calendar size={10} />
                              {new Date(lead.reminderDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>

                        {/* Stage menu — the working replacement for drag-and-drop. */}
                        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.status}
                            onChange={(e) => void setStatus(lead.id, e.target.value as LeadStatus)}
                            title="Move this lead to another stage"
                            className="w-full cursor-pointer rounded-lg bg-apex-800 px-2 py-1.5 text-[11px] font-medium text-slate-100 ring-1 ring-white/10 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-apex-accent/60"
                          >
                            {STATUS.map((s) => (
                              <option key={s.k} value={s.k}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                  {columnLeads.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
                      <div className="text-xs font-medium text-slate-300">
                        Nothing in {st.label.toLowerCase() === 'client' ? 'Clients' : st.label}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        Move a lead here with its stage menu.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
