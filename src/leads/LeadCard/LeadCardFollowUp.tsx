import React from 'react';
import { CalendarClock, X } from 'lucide-react';
import type { Lead } from '../../types';
import { useToast } from '../../ui/Toast';
import { absoluteDate, parseStampDate, relativeDay, reminderState } from '../../utils/leadActivity';

interface LeadCardFollowUpProps {
  lead: Lead;
  setReminder: (id: string, reminderDate: string | null) => void | Promise<void>;
}

/**
 * SCHEDULE FOLLOW-UP control for the expanded card. A dark-styled native
 * <input type="date"> writes `reminderDate` through the existing setReminder
 * handler (a { merge: true } patch — tenantId preserved), and a Clear button
 * removes it. Fires a toast on set and clear. Shows a live status line so the
 * user sees whether the chosen date is overdue / today / upcoming.
 */
export const LeadCardFollowUp: React.FC<LeadCardFollowUpProps> = ({ lead, setReminder }) => {
  const toast = useToast();
  const value = lead.reminderDate || '';
  const parsed = value ? parseStampDate(value) : null;
  const state = value ? reminderState(value) : null;

  const onPick = (next: string) => {
    if (!next) return;
    void setReminder(lead.id, next);
    const d = parseStampDate(next);
    toast(`Follow-up set for ${d ? absoluteDate(d) : next} — ${lead.co}`);
  };

  const onClear = () => {
    void setReminder(lead.id, null);
    toast(`Follow-up cleared — ${lead.co}`);
  };

  const stateText =
    state === 'overdue'
      ? 'overdue'
      : state === 'today'
        ? 'due today'
        : parsed
          ? relativeDay(parsed)
          : '';
  const stateTone =
    state === 'overdue' || state === 'today' ? 'text-amber-300' : 'text-slate-400';

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-1 text-[10px] font-bold font-mono uppercase tracking-widest text-slate-500">
        <CalendarClock size={12} />
        Schedule Follow-up
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-apex-800 p-3">
        <input
          type="date"
          value={value}
          onChange={(e) => onPick(e.target.value)}
          aria-label={`Set a follow-up date for ${lead.co}`}
          className="rounded-lg border border-white/10 bg-apex-850 px-3 py-1.5 text-xs text-slate-100 tabular-nums ring-0 transition-colors focus:border-apex-accent/60 focus:outline-none focus:ring-1 focus:ring-apex-accent/60 [color-scheme:dark]"
        />

        {value ? (
          <>
            <span className={`text-xs font-medium tabular-nums ${stateTone}`} title={parsed ? absoluteDate(parsed) : undefined}>
              {stateText}
            </span>
            <button
              onClick={onClear}
              aria-label={`Clear the follow-up date for ${lead.co}`}
              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-white/10 bg-apex-850 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-slate-100"
            >
              <X size={12} /> Clear
            </button>
          </>
        ) : (
          <span className="text-xs text-slate-500">No follow-up scheduled</span>
        )}
      </div>
    </div>
  );
};
