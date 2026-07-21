import { useMemo, type ReactNode } from 'react';
import { TrendingUp, CalendarClock, Flame, MailCheck } from 'lucide-react';
import type { Lead } from '../types';
import { isDueFollowUp, isHiringSignal } from '../leads/useLeadFilters';
import { isClientLead } from '../utils/leadActivity';

const DAY_MS = 24 * 60 * 60 * 1000;

/** lastContactedAt as epoch ms, or 0 when missing/invalid. */
function contactedAtMs(l: Lead): number {
  if (!l.lastContactedAt) return 0;
  const t = new Date(l.lastContactedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * "Reached the outreach stage" — any real evidence the lead was contacted:
 * a status past `new`, a logged touch, or a last-contacted stamp. A brand-new
 * untouched lead is the only thing that is NOT contacted, so the gap between
 * Total and Contacted is exactly the un-worked backlog.
 */
function isContacted(l: Lead): boolean {
  if (l.status !== 'new') return true;
  if ((l.touchCount || 0) > 0) return true;
  return contactedAtMs(l) > 0;
}

/** Engaged = they wrote back / are quoting: interested + quote. */
function isEngaged(l: Lead): boolean {
  return l.status === 'interested' || l.status === 'quote';
}

interface OverviewPanelProps {
  /** The live tenant leads array already passed into TodayTab — no new subscription. */
  leads: Lead[];
}

/**
 * At-a-glance INSIGHTS for the top of the Today tab. Everything is derived in a
 * single useMemo from the live `leads` array — no extra Firestore listener, no
 * fabricated trend/delta data (there is no history to trend against).
 *
 *   1. Pipeline funnel  Total → Contacted → Engaged → Client, proportional bars,
 *      with clients/total and clients/contacted conversion so leaks are obvious.
 *   2. This week        touched-in-last-7-days (from lastContactedAt), follow-ups
 *      due now, and hot hiring-signal leads.
 *   3. Momentum line    one honest sentence assembled from those same numbers.
 */
export function OverviewPanel({ leads }: OverviewPanelProps) {
  const o = useMemo(() => {
    const now = Date.now();
    const total = leads.length;

    let contacted = 0;
    let engaged = 0;
    let clients = 0;
    let touchedThisWeek = 0;
    let dueNow = 0;
    let hot = 0;

    for (const l of leads) {
      if (isContacted(l)) contacted++;
      if (isEngaged(l)) engaged++;
      if (isClientLead(l)) clients++;
      if (contactedAtMs(l) > 0 && now - contactedAtMs(l) < 7 * DAY_MS) touchedThisWeek++;
      if (isDueFollowUp(l, now)) dueNow++;
      // Count only hot shops that are still callable (new/called), matching the
      // Today "Calls to make" list — otherwise the headline number overstated it.
      if (isHiringSignal(l) && (l.status === 'new' || l.status === 'called')) hot++;
    }

    // Conversion rates — guard divide-by-zero; null renders as "—".
    const pctOfTotal = total > 0 ? Math.round((clients / total) * 100) : null;
    const pctOfContacted = contacted > 0 ? Math.round((clients / contacted) * 100) : null;

    return {
      total,
      contacted,
      engaged,
      clients,
      touchedThisWeek,
      dueNow,
      hot,
      pctOfTotal,
      pctOfContacted,
    };
  }, [leads]);

  // Funnel stages in order. Widths are proportional to `total` so the drop-off
  // at each step is visually literal. Each carries its status-hue accent.
  const stages: {
    key: string;
    label: string;
    value: number;
    bar: string;
    text: string;
  }[] = [
    { key: 'total', label: 'Total', value: o.total, bar: 'bg-slate-400/70', text: 'text-slate-200' },
    {
      key: 'contacted',
      label: 'Contacted',
      value: o.contacted,
      bar: 'bg-blue-500/70',
      text: 'text-blue-200',
    },
    {
      key: 'engaged',
      label: 'Engaged',
      value: o.engaged,
      bar: 'bg-emerald-500/70',
      text: 'text-emerald-200',
    },
    {
      key: 'client',
      label: 'Clients',
      value: o.clients,
      bar: 'bg-amber-500/80',
      text: 'text-amber-200',
    },
  ];

  const denom = Math.max(o.total, 1);

  // Honest one-liner. No hype, no arrows — just what the numbers say right now.
  const momentum = buildMomentum(o);

  return (
    <section
      className="mb-6 rounded-2xl bg-apex-850 ring-1 ring-white/10 shadow-lg shadow-black/40 p-4 md:p-5"
      aria-label="Pipeline overview"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-slate-500">
          <TrendingUp size={13} className="text-slate-500" />
          Overview
        </div>
        {/* Headline conversion — clients out of every lead in the book. */}
        <div className="flex items-baseline gap-1.5 tabular-nums">
          <span className="text-lg font-semibold text-amber-200">
            {o.pctOfTotal === null ? '—' : `${o.pctOfTotal}%`}
          </span>
          <span className="text-[11px] text-slate-500">lead → client</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ---- FUNNEL (hero, spans 2 of 3 columns on desktop) ---------------- */}
        <div className="lg:col-span-2">
          <div className="space-y-2">
            {stages.map((s, i) => {
              const prev = i === 0 ? s.value : stages[i - 1].value;
              const dropoff = prev > 0 ? prev - s.value : 0;
              const widthPct = Math.max((s.value / denom) * 100, s.value > 0 ? 4 : 0);
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <div className="w-20 shrink-0 text-right text-xs text-slate-400">{s.label}</div>
                  <div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-md bg-apex-800">
                    <div
                      className={`h-full rounded-md ${s.bar} transition-[width] duration-500`}
                      style={{ width: `${widthPct}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-2.5">
                      <span className={`text-xs font-semibold tabular-nums ${s.text}`}>
                        {s.value}
                      </span>
                      {i > 0 && dropoff > 0 && (
                        <span className="ml-auto text-[10px] tabular-nums text-slate-500">
                          −{dropoff} dropped
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Conversion read-out under the funnel — where it leaks, in numbers. */}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 pl-[92px] text-[11px] text-slate-500">
            <span className="tabular-nums">
              <span className="font-semibold text-slate-300">
                {o.pctOfContacted === null ? '—' : `${o.pctOfContacted}%`}
              </span>{' '}
              of contacted became clients
            </span>
            <span className="tabular-nums">
              <span className="font-semibold text-slate-300">{o.total - o.contacted}</span> not
              contacted yet
            </span>
          </div>
        </div>

        {/* ---- THIS WEEK (stat rail) ---------------------------------------- */}
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-2">
          <MiniStat
            icon={<MailCheck size={14} />}
            label="Touched · 7d"
            value={o.touchedThisWeek}
            tone="teal"
          />
          <MiniStat
            icon={<CalendarClock size={14} />}
            label="Bumps due"
            value={o.dueNow}
            tone="violet"
            active={o.dueNow > 0}
          />
          <MiniStat
            icon={<Flame size={14} />}
            label="Hot (hiring)"
            value={o.hot}
            tone="orange"
            active={o.hot > 0}
          />
        </div>
      </div>

      {/* ---- MOMENTUM LINE ------------------------------------------------- */}
      <p className="mt-4 border-t border-white/5 pt-3 text-xs text-slate-400">{momentum}</p>
    </section>
  );
}

// ---- building blocks -------------------------------------------------------

const TONES: Record<
  string,
  { idle: string; active: string; icon: string }
> = {
  teal: {
    idle: 'bg-apex-800 ring-white/10 text-slate-300',
    active: 'bg-teal-500/10 ring-teal-500/30 text-teal-200',
    icon: 'text-teal-300',
  },
  violet: {
    idle: 'bg-apex-800 ring-white/10 text-slate-300',
    active: 'bg-violet-500/10 ring-violet-500/30 text-violet-200',
    icon: 'text-violet-300',
  },
  orange: {
    idle: 'bg-apex-800 ring-white/10 text-slate-300',
    active: 'bg-orange-500/10 ring-orange-500/30 text-orange-200',
    icon: 'text-orange-300',
  },
};

function MiniStat({
  icon,
  label,
  value,
  tone,
  active,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: keyof typeof TONES;
  active?: boolean;
}) {
  const t = TONES[tone];
  const on = active ?? true; // "Touched" is always its accent color; the alert stats only light up when >0.
  return (
    <div
      className={`flex flex-col justify-between gap-1 rounded-xl px-3 py-2.5 ring-1 ${
        on ? t.active : t.idle
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={on ? t.icon : 'text-slate-500'}>{icon}</span>
        <span className="truncate text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** Assemble one plain-English sentence from the computed overview. */
function buildMomentum(o: {
  total: number;
  contacted: number;
  clients: number;
  dueNow: number;
  hot: number;
}): string {
  if (o.total === 0) return 'No leads yet — add some on the Leads tab and the picture builds here.';

  const parts: string[] = [`${o.contacted} of ${o.total} leads contacted`];
  parts.push(o.dueNow === 1 ? '1 waiting on a follow-up' : `${o.dueNow} waiting on a follow-up`);
  if (o.hot > 0) {
    parts.push(o.hot === 1 ? '1 hot shop to call' : `${o.hot} hot shops to call`);
  }

  const lead = parts.slice(0, -1).join(', ');
  const tail = parts[parts.length - 1];
  const sentence = parts.length > 1 ? `${lead}, and ${tail}` : tail;

  const closer =
    o.clients > 0
      ? ` ${o.clients} ${o.clients === 1 ? 'is' : 'are'} already a client.`
      : ' None have closed yet — keep the top of the funnel moving.';

  return `${sentence}.${closer}`;
}
