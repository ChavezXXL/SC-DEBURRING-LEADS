import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Lead, LeadStatus, PipelineLeadStatus } from '../types';
import { STATUS } from '../data';
import { Calendar, DollarSign, MapPin, User } from 'lucide-react';
import { reminderState } from '../utils/leadActivity';

interface PipelineTabProps {
  leads: Lead[];
  onLeadClick: (id: string) => void;
  /** Move a lead to another stage (from useLeadCrud). */
  setStatus: (id: string, st: LeadStatus) => void | Promise<void>;
}

/** Stages that count as "in play" for the summary bar (open pipeline). */
const WON_STATUSES: LeadStatus[] = ['client', 'anchor'];

/** Compact money: 8600 -> "$8.6K", 950 -> "$950". */
function fmtMoney(n: number): string {
  if (n >= 1000) {
    const k = Math.round(n / 100) / 10;
    return `$${k % 1 === 0 ? k.toFixed(0) : k}K`;
  }
  return `$${n.toLocaleString('en-US')}`;
}

export function PipelineTab({ leads, onLeadClick, setStatus }: PipelineTabProps) {
  // Which column a card is currently being dragged over (drop-target highlight).
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null);
  // The id of the lead being dragged. A ref (not state) — reading it in onDrop
  // must not lag a render behind, and dragging shouldn't re-render the board.
  const dragId = useRef<string | null>(null);
  // Some browsers fire a click on the dragged card right after drop — without
  // this guard every drag would ALSO open the lead (jump to the Leads tab).
  const suppressClick = useRef(false);
  // The horizontal scroll container, for edge auto-scroll during a drag.
  const boardRef = useRef<HTMLDivElement>(null);

  // Backstop: if the dragged card unmounts mid-drag (e.g. a Firestore snapshot
  // removes the lead), its own onDragEnd never fires and dragId/suppressClick
  // would stay stuck — freezing clicks on every card. A window-level dragend
  // listener always fires at the end of a drag and resets the refs.
  useEffect(() => {
    const reset = () => {
      dragId.current = null;
      setDragOver(null);
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    };
    window.addEventListener('dragend', reset);
    return () => window.removeEventListener('dragend', reset);
  }, []);

  // Native HTML5 drag doesn't auto-scroll inner overflow containers in Firefox/
  // Safari, so the columns past the viewport edge would be unreachable by drag.
  // Nudge the board's scroll when the pointer nears its left/right edge.
  const handleBoardDragOver = (e: React.DragEvent) => {
    const el = boardRef.current;
    if (!el || dragId.current == null) return;
    const rect = el.getBoundingClientRect();
    const EDGE = 90;
    const STEP = 26;
    if (e.clientX < rect.left + EDGE) el.scrollLeft -= STEP;
    else if (e.clientX > rect.right - EDGE) el.scrollLeft += STEP;
  };

  // Group leads by status + sum deal values per column and for the summary bar.
  // Research candidates (research_pending/rejected) are not pipeline stages, so
  // the record is keyed by PipelineLeadStatus and the guard below skips them.
  const { leadsByStatus, valueByStatus, inPlay, won } = useMemo(() => {
    const byStatus: Record<PipelineLeadStatus, Lead[]> = {
      new: [], called: [], emailed: [], visited: [], voicemail: [],
      interested: [], quote: [], sample: [], po: [], dead: [], client: [], anchor: [],
    };
    const valByStatus = {} as Record<PipelineLeadStatus, number>;
    let inPlaySum = 0;
    let wonSum = 0;
    leads.forEach((lead) => {
      const st = lead.status as PipelineLeadStatus;
      if (!byStatus[st]) return;
      byStatus[st].push(lead);
      const v = typeof lead.value === 'number' && Number.isFinite(lead.value) ? lead.value : 0;
      valByStatus[st] = (valByStatus[st] || 0) + v;
      if (WON_STATUSES.includes(st)) wonSum += v;
      else if (st !== 'dead') inPlaySum += v;
    });
    return { leadsByStatus: byStatus, valueByStatus: valByStatus, inPlay: inPlaySum, won: wonSum };
  }, [leads]);

  const endDrag = () => {
    dragId.current = null;
    setDragOver(null);
    // Clear after the (possible) post-drag click has already been dispatched.
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  };

  const dropOn = (st: LeadStatus) => {
    const id = dragId.current;
    endDrag();
    if (!id) return; // e.g. a file dragged in from the OS — nothing to move
    const lead = leads.find((l) => l.id === id);
    if (!lead) return; // deleted mid-drag — never recreate a tenantId-less ghost doc
    if (lead.status === st) return; // dropped back on its own column
    void setStatus(id, st);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-6 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-100">
            Pipeline
          </h1>
          <p className="text-xs text-slate-400">
            Drag a card to its new stage — or use the stage menu on the card.
          </p>
        </div>
        {(inPlay > 0 || won > 0) && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-500/10 px-3 py-1 text-[11px] font-semibold tabular-nums text-blue-300 ring-1 ring-blue-500/30">
              In play {fmtMoney(inPlay)}/mo
            </span>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold tabular-nums text-emerald-300 ring-1 ring-emerald-500/30">
              Won {fmtMoney(won)}/mo
            </span>
          </div>
        )}
      </div>

      <div ref={boardRef} onDragOver={handleBoardDragOver} className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {STATUS.map((st) => {
          const columnLeads = leadsByStatus[st.k];
          if (!columnLeads) return null;
          const colValue = valueByStatus[st.k] || 0;
          const isTarget = dragOver === st.k;

          return (
            <div
              key={st.k}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOver !== st.k) setDragOver(st.k);
              }}
              onDragLeave={(e) => {
                // Only clear when actually leaving the column (not entering a child).
                // WebKit/older-Firefox fire dragleave with relatedTarget=null on
                // internal moves; ignoring those stops the highlight from strobing
                // (a genuine exit is corrected by dragenter on the next column or
                // by endDrag on drop).
                const rt = e.relatedTarget as Node | null;
                if (rt && !e.currentTarget.contains(rt)) {
                  setDragOver((cur) => (cur === st.k ? null : cur));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                dropOn(st.k);
              }}
              className={`flex w-72 shrink-0 flex-col rounded-xl bg-apex-900 ring-1 transition-shadow ${
                isTarget ? 'ring-2 ring-apex-accent/70 shadow-lg shadow-black/40' : 'ring-white/10'
              }`}
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
                <div className="flex items-center gap-1.5">
                  {colValue > 0 && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-300 ring-1 ring-emerald-500/25">
                      {fmtMoney(colValue)}
                    </span>
                  )}
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium tabular-nums text-slate-300 ring-1 ring-white/10">
                    {columnLeads.length}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                <div className="flex flex-col gap-3">
                  {columnLeads.map((lead) => {
                    const remState = lead.reminderDate ? reminderState(lead.reminderDate) : null;

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => {
                          dragId.current = lead.id;
                          suppressClick.current = true;
                          e.dataTransfer.effectAllowed = 'move';
                          try {
                            e.dataTransfer.setData('text/plain', lead.id);
                          } catch {
                            /* older browsers */
                          }
                        }}
                        onDragEnd={endDrag}
                        onClick={() => {
                          if (suppressClick.current) return;
                          onLeadClick(lead.id);
                        }}
                        className="cursor-grab rounded-xl bg-apex-850 p-3 ring-1 ring-white/10 transition-all hover:shadow-md hover:shadow-black/40 hover:ring-white/20 active:cursor-grabbing"
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

                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ${
                              lead.t === 1
                                ? 'bg-orange-500/10 text-orange-300 ring-orange-500/30'
                                : 'bg-blue-500/10 text-blue-300 ring-blue-500/30'
                            }`}
                          >
                            {lead.t === 1 ? 'T1' : 'T2'}
                          </span>

                          {typeof lead.value === 'number' && lead.value > 0 && (
                            <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold tabular-nums text-emerald-300 ring-1 ring-emerald-500/30">
                              <DollarSign size={9} />
                              {fmtMoney(lead.value)}/mo
                            </span>
                          )}

                          {lead.reminderDate && (
                            <span className={`ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold tabular-nums ring-1 ${
                              remState === 'overdue' ? 'bg-red-500/10 text-red-300 ring-red-500/30' :
                              remState === 'today' ? 'bg-orange-500/10 text-orange-300 ring-orange-500/30' :
                              'bg-blue-500/10 text-blue-300 ring-blue-500/30'
                            }`}>
                              <Calendar size={10} />
                              {new Date(`${lead.reminderDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>

                        {/* Stage menu — the no-drag fallback (touch screens, keyboard). */}
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
                    <div className={`rounded-xl border border-dashed py-10 text-center transition-colors ${
                      isTarget ? 'border-apex-accent/60 bg-apex-accent/5' : 'border-white/10'
                    }`}>
                      <div className="text-xs font-medium text-slate-300">
                        {isTarget ? 'Drop to move here' : `Nothing in ${st.label.toLowerCase() === 'client' ? 'Clients' : st.label}`}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {isTarget ? ' ' : 'Drag a card here or use its stage menu.'}
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
