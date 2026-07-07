import type { Lead } from '../types';

/**
 * Pure, dependency-free helpers for the lead-tracking depth features:
 *   - relative-time formatting ("3d ago", "in 2d", "today")
 *   - parsing the freeform `notes` string into a dated activity timeline
 *   - reminder/follow-up date classification (overdue / today / future)
 *
 * The single-lead write handlers (markEmailed / logCall / setReminder /
 * setStatus) append dated lines to `notes`, so `notes` IS the timeline source.
 * Nothing here writes — it only reads a Lead and derives view data.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** A local YYYY-MM-DD string for `d` (matches how reminderDate is stored). */
export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today as YYYY-MM-DD (local). */
export function todayYmd(now: number = Date.now()): string {
  return toYmd(new Date(now));
}

/**
 * Parse a date token from a stamped note line. Handles both shapes the app
 * writes: ISO `YYYY-MM-DD` (markEmailed/logCall/setReminder) and the
 * locale `M/D/YYYY` used by status-change stamps. Returns a Date at local
 * midnight, or null if it can't be parsed.
 */
export function parseStampDate(token: string): Date | null {
  const iso = token.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const us = token.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    let year = Number(us[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, Number(us[1]) - 1, Number(us[2]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Midnight-aligned whole-day delta: (target - reference) in days. */
function dayDiff(target: Date, reference: Date): number {
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const b = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  ).getTime();
  return Math.round((a - b) / DAY_MS);
}

/**
 * Compact relative-time label from a date to `now`. Past dates read
 * "3d ago"; future dates read "in 2d"; same calendar day is "today".
 * Falls back to weeks/months for larger gaps so labels stay short.
 */
export function relativeDay(date: Date, now: number = Date.now()): string {
  const diff = dayDiff(date, new Date(now)); // >0 future, <0 past
  const abs = Math.abs(diff);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';

  let unit: string;
  if (abs < 7) unit = `${abs}d`;
  else if (abs < 30) unit = `${Math.round(abs / 7)}w`;
  else if (abs < 365) unit = `${Math.round(abs / 30)}mo`;
  else unit = `${Math.round(abs / 365)}y`;

  return diff < 0 ? `${unit} ago` : `in ${unit}`;
}

/** Absolute long date for tooltips, e.g. "Mon, Jul 6, 2026". */
export function absoluteDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export interface ActivityEntry {
  /** Local-midnight date the entry is stamped with. */
  date: Date;
  /** The human text after the date token (e.g. "Emailed (marked from app)."). */
  text: string;
  /** Stable-ish key for React lists. */
  key: string;
}

export interface ParsedNotes {
  /** Dated timeline entries, most-recent first. */
  entries: ActivityEntry[];
  /** Lines that carry no leading date stamp — freeform notes, in order. */
  freeform: string[];
}

// A line is a dated entry if it STARTS with a bracketed date token. Matches:
//   [2026-07-06] Emailed (marked from app).
//   [7/6/2026 — Status: new → emailed]
//   [7/6/2026 — Contact Research]
const STAMP_LINE_RE = /^\s*\[\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:[—\-]\s*)?([^\]]*)\]\s*(.*)$/;

/**
 * Split `notes` into dated timeline entries + freeform lines.
 *
 * Every line beginning with a `[date …]` token becomes a timeline entry; the
 * entry text is whatever followed the date inside the bracket (status stamps)
 * plus anything after the bracket (markEmailed/logCall). Any other non-empty
 * line is treated as a freeform note and kept verbatim. Entries come back
 * sorted most-recent first (stable within the same day, newest occurrence up).
 */
export function parseNotesTimeline(notes: string | undefined): ParsedNotes {
  const entries: ActivityEntry[] = [];
  const freeform: string[] = [];
  if (!notes) return { entries, freeform };

  const lines = notes.split('\n');
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '');
    if (line.trim() === '') return;

    const m = line.match(STAMP_LINE_RE);
    if (m) {
      const date = parseStampDate(m[1]);
      if (date) {
        const inside = (m[2] || '').trim(); // text that lived inside the bracket
        const after = (m[3] || '').trim(); // text after the bracket
        const text = [inside, after].filter(Boolean).join(' ').trim();
        entries.push({
          date,
          text: text || 'Activity logged',
          key: `${i}-${m[1]}`,
        });
        return;
      }
    }
    freeform.push(line);
  });

  // Most-recent first. Preserve original order for same-day entries by using
  // the source index as a tiebreaker (later line = more recent that day).
  entries.sort((a, b) => {
    const d = b.date.getTime() - a.date.getTime();
    if (d !== 0) return d;
    return Number(b.key.split('-')[0]) - Number(a.key.split('-')[0]);
  });

  return { entries, freeform };
}

export type ReminderState = 'overdue' | 'today' | 'future';

/** Classify a reminderDate relative to today: overdue / today / future. */
export function reminderState(
  reminderDate: string,
  now: number = Date.now(),
): ReminderState {
  const d = parseStampDate(reminderDate);
  if (!d) return 'future';
  const diff = dayDiff(d, new Date(now));
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'future';
}

/**
 * A manually-scheduled follow-up that has come due — reminderDate on or before
 * today. This is DISTINCT from `isDueFollowUp` (the auto-derived "emailed, went
 * quiet" heuristic): this one only fires when the user picked a date.
 */
export function isReminderDue(l: Lead, now: number = Date.now()): boolean {
  if (!l.reminderDate) return false;
  const st = reminderState(l.reminderDate, now);
  return st === 'overdue' || st === 'today';
}
