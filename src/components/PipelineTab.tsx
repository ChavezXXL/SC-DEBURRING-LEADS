import React from 'react';
import type { Lead, LeadStatus } from '../types';
import { STATUS } from '../data';
import { Calendar, MapPin, User } from 'lucide-react';

interface PipelineTabProps {
  leads: Lead[];
  onLeadClick: (id: string) => void;
}

export function PipelineTab({ leads, onLeadClick }: PipelineTabProps) {
  // Group leads by status
  const leadsByStatus: Record<LeadStatus, Lead[]> = {
    new: [],
    called: [],
    emailed: [],
    visited: [],
    voicemail: [],
    interested: [],
    quote: [],
    dead: [],
    client: [],
  };

  leads.forEach((lead) => {
    if (leadsByStatus[lead.status]) {
      leadsByStatus[lead.status].push(lead);
    }
  });

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-6 shrink-0">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-zinc-100">
          Sales Pipeline
        </h1>
        <p className="text-xs font-mono text-zinc-500">
          Drag-and-drop coming soon. Click a lead to view details.
        </p>
      </div>

      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {STATUS.map((st) => {
          const columnLeads = leadsByStatus[st.k];
          if (!columnLeads) return null;

          return (
            <div
              key={st.k}
              className="flex w-72 shrink-0 flex-col rounded-xl border border-zinc-800/60 bg-zinc-900/20"
            >
              <div
                className="flex items-center justify-between border-b border-zinc-800/60 p-3"
                style={{ borderTop: `3px solid ${st.dot}` }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: st.dot }}
                  />
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    {st.label}
                  </span>
                </div>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
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
                        className="cursor-pointer rounded-lg border border-zinc-800/80 bg-zinc-900/80 p-3 transition-all hover:border-zinc-700 hover:shadow-lg hover:shadow-black/20"
                      >
                        <div className="mb-2 font-bold text-zinc-100 text-sm line-clamp-1">
                          {lead.co}
                        </div>
                        
                        <div className="mb-2 flex flex-col gap-1.5 text-[11px] text-zinc-500">
                          <div className="flex items-center gap-1.5">
                            <User size={12} />
                            <span className="line-clamp-1">{lead.pm || lead.who || 'No contact'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} />
                            <span className="line-clamp-1">{lead.city || 'No city'}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold font-mono ${
                              lead.t === 1
                                ? 'bg-orange-500/10 text-orange-500'
                                : 'bg-blue-500/10 text-blue-400'
                            }`}
                          >
                            {lead.t === 1 ? 'T1' : 'T2'}
                          </span>

                          {lead.reminderDate && (
                            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold font-mono ${
                              isReminderPast ? 'bg-red-500/10 text-red-500' : 
                              isReminderToday ? 'bg-orange-500/10 text-orange-500' : 
                              'bg-blue-500/10 text-blue-400'
                            }`}>
                              <Calendar size={10} />
                              {new Date(lead.reminderDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {columnLeads.length === 0 && (
                    <div className="py-8 text-center text-xs italic text-zinc-600">
                      No leads
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
