import React, { useMemo } from 'react';
import { Activity, Clock } from 'lucide-react';
import type { Lead } from '../../types';
import { STATUS } from '../../data';
import {
  parseNotesTimeline,
  relativeDay,
  absoluteDate,
} from '../../utils/leadActivity';

interface LeadCardTimelineProps {
  lead: Lead;
}

/**
 * Read-only ACTIVITY TIMELINE, fully derived from the lead's own `notes`
 * string (no new data, no new listener). Dated lines like
 * `[2026-07-06] Emailed (marked from app).` or `[7/6/2026 — Status: new →
 * emailed]` become timeline rows on a small dot/line rail, newest first.
 *
 * A compact facts row above it shows touchCount, last-contacted (relative),
 * and the current status pill. Freeform (undated) note lines are NOT shown
 * here — LeadCardNotes still owns and renders/edits those.
 *
 * Computed from `lead` inside the card, so it costs nothing until the card is
 * open and doesn't affect the memoized collapsed-card path.
 */
export const LeadCardTimeline: React.FC<LeadCardTimelineProps> = ({ lead }) => {
  const now = Date.now();
  const { entries } = useMemo(() => parseNotesTimeline(lead.notes), [lead.notes]);

  const st = STATUS.find((s) => s.k === lead.status) || STATUS[0];
  const touches = lead.touchCount || 0;

  const lastContacted = useMemo(() => {
    if (!lead.lastContactedAt) return null;
    const d = new Date(lead.lastContactedAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [lead.lastContactedAt]);

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-1 text-[10px] font-bold font-mono uppercase tracking-widest text-slate-500">
        <Activity size={12} />
        Activity Timeline
      </div>

      {/* Compact facts row */}
      <div className="mb-3 flex flex-wrap items-center gap-2 tabular-nums">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-apex-800 px-2.5 py-1 text-[11px] font-medium text-slate-300 ring-1 ring-white/10">
          <span className="font-semibold text-slate-100">{touches}</span>
          {touches === 1 ? 'touch' : 'touches'}
        </span>

        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-apex-800 px-2.5 py-1 text-[11px] font-medium text-slate-300 ring-1 ring-white/10"
          title={lastContacted ? absoluteDate(lastContacted) : 'No contact logged yet'}
        >
          <Clock size={11} className="text-slate-500" />
          {lastContacted ? (
            <>
              last contact{' '}
              <span className="font-semibold text-slate-100">
                {relativeDay(lastContacted, now)}
              </span>
            </>
          ) : (
            'never contacted'
          )}
        </span>

        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{
            background: st.bg,
            color: st.tx,
            boxShadow: `inset 0 0 0 1px ${st.dot}4D`,
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
          {st.label}
        </span>
      </div>

      {/* Timeline rail */}
      {entries.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-apex-800 px-4 py-3 text-xs italic text-slate-400">
          No activity yet — log a call or email and it shows up here.
        </div>
      ) : (
        <ol className="relative ml-1 space-y-3 border-l border-white/10 pl-4">
          {entries.map((e) => (
            <li key={e.key} className="relative">
              {/* dot on the rail */}
              <span
                aria-hidden
                className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-apex-accent ring-2 ring-apex-900"
              />
              <div className="flex flex-col gap-0.5">
                <time
                  dateTime={e.date.toISOString().slice(0, 10)}
                  title={absoluteDate(e.date)}
                  className="text-[10px] font-medium uppercase tracking-wide tabular-nums text-slate-500"
                >
                  {relativeDay(e.date, now)}
                </time>
                <span className="text-xs leading-relaxed text-slate-300">{e.text}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
