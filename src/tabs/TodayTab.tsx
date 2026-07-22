import React, { useMemo } from 'react';
import { Phone, PhoneCall, MailCheck, MailPlus, MessagesSquare, CalendarClock, Target, Check } from 'lucide-react';
import type { Lead } from '../types';
import { isDueFollowUp, isHiringSignal } from '../leads/useLeadFilters';
import { isReminderDue, isClientLead, parseStampDate, relativeDay, absoluteDate, reminderState, parseNotesTimeline, todayYmd } from '../utils/leadActivity';
import { buildGmailUrl } from '../outreach/templates';
import { OverviewPanel } from './OverviewPanel';
import { compareLeadScore, getLeadScore } from '../utils/leadScore';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Notes flagged "call only" belong on the call list even without a hiring mention. */
const CALL_ONLY_RE = /call only/i;

/** lastContactedAt as epoch ms — missing/invalid sorts as 0 (oldest). */
function contactedAtMs(l: Lead): number {
  if (!l.lastContactedAt) return 0;
  const t = new Date(l.lastContactedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Gmail search scoped to this lead — bumps get replied IN thread, never as a fresh cold email. */
function threadSearchUrl(em: string): string {
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent('to:' + em)}`;
}

interface TodayTabProps {
  /** Live tenant leads — App's single useLeads subscription, passed down. */
  leads: Lead[];
  logCall: (lead: Lead) => void | Promise<void>;
  markEmailed: (lead: Lead) => void | Promise<void>;
  /** Jump to the full card on the Leads tab. */
  onLeadClick: (id: string) => void;
}

/**
 * The "Today" command center — the daily execution list, derived entirely
 * from the live leads array (no extra Firestore listener):
 *   1. Calls to make   — hiring-signal shops + the 2 coldest past clients
 *   2. Bumps due       — emailed, went quiet; reply in the existing thread
 *   3. Ready to send   — untouched new leads with an email on file
 */
export function TodayTab({ leads, logCall, markEmailed, onLeadClick }: TodayTabProps) {
  const now = Date.now();

  const { stats, topOpportunities, hotCalls, checkIns, bumps, ready, scheduled } = useMemo(() => {
    const tierFirst = (a: Lead, b: Lead) =>
      compareLeadScore(a, b);

    // reminderDate as epoch ms (local midnight); missing sorts last.
    const reminderMs = (l: Lead): number => {
      const d = l.reminderDate ? parseStampDate(l.reminderDate) : null;
      return d ? d.getTime() : Number.POSITIVE_INFINITY;
    };

    return {
      stats: {
        total: leads.length,
        fresh: leads.filter((l) => l.status === 'new').length,
        emailed: leads.filter((l) => l.status === 'emailed').length,
        warm: leads.filter((l) => l.status === 'interested' || l.status === 'quote').length,
        clients: leads.filter(isClientLead).length,
        bumpsDue: leads.filter((l) => isDueFollowUp(l)).length,
        scheduledDue: leads.filter((l) => isReminderDue(l)).length,
      },
      topOpportunities: leads
        .filter((l) => !isClientLead(l) && l.status !== 'dead')
        .sort(compareLeadScore)
        .slice(0, 5),
      // Manually-scheduled follow-ups that have come due (reminderDate <= today).
      // Most overdue first. Distinct from bumps (auto "emailed, went quiet").
      scheduled: leads
        .filter((l) => isReminderDue(l))
        .sort((a, b) => reminderMs(a) - reminderMs(b)),
      hotCalls: leads
        .filter(
          (l) =>
            (isHiringSignal(l) || CALL_ONLY_RE.test(l.notes || '')) &&
            (l.status === 'new' || l.status === 'called'),
        )
        .sort(tierFirst),
      checkIns: leads
        .filter(isClientLead)
        .sort((a, b) => contactedAtMs(a) - contactedAtMs(b))
        .slice(0, 2),
      bumps: leads
        .filter((l) => isDueFollowUp(l))
        .sort((a, b) => contactedAtMs(a) - contactedAtMs(b)),
      ready: leads
        .filter((l) => !!l.em?.trim() && l.status === 'new' && (l.touchCount || 0) === 0)
        .sort(tierFirst)
        .slice(0, 10),
    };
  }, [leads]);

  const dateLine = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const daysSince = (l: Lead) => Math.max(0, Math.floor((now - contactedAtMs(l)) / DAY_MS));

  if (leads.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-100">Today</h1>
        <p className="mb-6 text-xs text-slate-400">{dateLine}</p>
        <div className="rounded-2xl bg-apex-850 ring-1 ring-white/10 px-8 py-16 text-center text-sm text-slate-300">
          No leads in this workspace yet. Add leads on the Leads tab and the day's work builds
          itself here.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-100">Today</h1>
        <p className="text-xs text-slate-400">
          {dateLine} · calls first, then bumps, then new sends.
        </p>
      </div>

      {/* OVERVIEW — at-a-glance funnel + this-week + momentum, above the to-dos */}
      <OverviewPanel leads={leads} />

      {/* Daily goals are derived from the same lead activity already saved in
          the CRM. No second checklist and no double entry. */}
      <DailyGoals leads={leads} />

      {/* Stat chips */}
      <div className="mb-6 flex flex-wrap items-center gap-2 tabular-nums">
        <StatChip label="Total leads" value={stats.total} />
        <StatChip label="New" value={stats.fresh} />
        <StatChip label="Emailed" value={stats.emailed} />
        <StatChip label="Interested+Quote" value={stats.warm} />
        <StatChip label="Clients" value={stats.clients} />
        <StatChip label="Bumps due" value={stats.bumpsDue} highlight={stats.bumpsDue > 0} />
        <StatChip
          label="Follow-ups due"
          value={stats.scheduledDue}
          highlight={stats.scheduledDue > 0}
        />
      </div>

      <Section
        title="Best opportunities now"
        hint="Ranked from the facts already saved in the CRM. Work the top of this list first."
      >
        <div className="divide-y divide-white/5">
          {topOpportunities.map((lead) => {
            const opportunity = getLeadScore(lead);
            return (
              <div
                key={lead.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CoButton lead={lead} onLeadClick={onLeadClick} />
                    <TierPill t={lead.t} />
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                      {opportunity.score}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{opportunity.nextAction}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {lead.ph && <BigPhone ph={lead.ph} />}
                  <button
                    onClick={() => onLeadClick(lead.id)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                  >
                    Open lead
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* CALLS TO MAKE */}
      <Section title="Calls to make">
        <GroupLabel label="Hot (hiring signals)" count={hotCalls.length} tone="orange" />
        {hotCalls.length === 0 ? (
          <EmptyLine text="No hiring-signal shops to call. Scan the job boards and tag new ones." />
        ) : (
          <div className="divide-y divide-white/5">
            {hotCalls.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CoButton lead={lead} onLeadClick={onLeadClick} />
                    <TierPill t={lead.t} />
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">{lead.city}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {lead.ph && <BigPhone ph={lead.ph} />}
                  <LogCallButton lead={lead} logCall={logCall} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5">
          <GroupLabel label="Check-ins (past clients)" count={checkIns.length} tone="amber" />
        </div>
        {checkIns.length === 0 ? (
          <EmptyLine text="No past clients on the books yet." />
        ) : (
          <div className="divide-y divide-white/5">
            {checkIns.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <CoButton lead={lead} onLeadClick={onLeadClick} />
                  <div className="mt-0.5 text-xs text-slate-400">
                    {lead.city}
                    {' · '}
                    {contactedAtMs(lead) === 0
                      ? 'no contact logged'
                      : `${daysSince(lead)}d since contact`}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {lead.ph && <BigPhone ph={lead.ph} />}
                  {lead.em && (
                    <a
                      href={buildGmailUrl(lead)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition-colors hover:bg-sky-500/20"
                      title="Open a pre-written check-in draft in Gmail"
                    >
                      <MailPlus size={14} /> Check in
                    </a>
                  )}
                  <LogCallButton lead={lead} logCall={logCall} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* FOLLOW-UPS SCHEDULED — the manually-picked reminderDate kind, distinct
          from the auto-derived "Bumps due" below. Only leads whose reminder is
          on or before today appear here. */}
      <Section
        title="Follow-ups scheduled"
        hint="You set a reminder date on these and it's here or overdue. Open the card, then log the call or email."
      >
        {scheduled.length === 0 ? (
          <EmptyLine text="No scheduled follow-ups due. Set a date on any lead's card to see it here." />
        ) : (
          <div className="divide-y divide-white/5">
            {scheduled.map((lead) => {
              const d = lead.reminderDate ? parseStampDate(lead.reminderDate) : null;
              const overdue =
                lead.reminderDate && reminderState(lead.reminderDate) === 'overdue';
              return (
                <div
                  key={lead.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CoButton lead={lead} onLeadClick={onLeadClick} />
                      <TierPill t={lead.t} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                      <CalendarClock size={12} className={overdue ? 'text-amber-400' : 'text-slate-500'} />
                      <span
                        className={`font-medium tabular-nums ${overdue ? 'text-amber-300' : 'text-slate-300'}`}
                        title={d ? absoluteDate(d) : undefined}
                      >
                        {d
                          ? overdue
                            ? `Overdue · ${relativeDay(d)}`
                            : `Due ${relativeDay(d)}`
                          : 'Due'}
                      </span>
                      {lead.city && <span className="text-slate-500">· {lead.city}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {lead.ph && <BigPhone ph={lead.ph} />}
                    <LogCallButton lead={lead} logCall={logCall} />
                    {lead.em && (
                      <MarkEmailedButton
                        lead={lead}
                        markEmailed={markEmailed}
                        title="Log the email after you send it"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* BUMPS DUE */}
      <Section
        title="Bumps due"
        hint="Emailed, went quiet. Reply in the existing thread — never start a new cold email."
      >
        {bumps.length === 0 ? (
          <EmptyLine text="Nothing due. Put the time into new outreach." />
        ) : (
          <div className="divide-y divide-white/5">
            {bumps.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <CoButton lead={lead} onLeadClick={onLeadClick} />
                  <div className="mt-0.5 truncate text-xs text-slate-400" title={lead.em}>
                    {lead.em}
                    {' · '}
                    <span className="font-medium tabular-nums text-violet-300">
                      {daysSince(lead)}d since contact
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {lead.em?.trim() && (
                    <a
                      href={threadSearchUrl(lead.em)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/20"
                      title="Find the existing Gmail thread and reply there"
                    >
                      <MessagesSquare size={14} /> Open thread
                    </a>
                  )}
                  <MarkEmailedButton lead={lead} markEmailed={markEmailed} title="Log the bump after you send it" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* READY TO SEND */}
      <Section
        title="Ready to send"
        hint="Untouched new leads with an email on file — tier 1 first, ten max."
      >
        {ready.length === 0 ? (
          <EmptyLine text="No untouched leads with an email on file. Time to prospect." />
        ) : (
          <div className="divide-y divide-white/5">
            {ready.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CoButton lead={lead} onLeadClick={onLeadClick} />
                    <TierPill t={lead.t} />
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-400" title={lead.em}>
                    {lead.city}
                    {lead.city && lead.em ? ' · ' : ''}
                    {lead.em}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={buildGmailUrl(lead)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition-colors hover:bg-sky-500/20"
                    title="Open a pre-written cold intro draft in Gmail"
                  >
                    <MailPlus size={14} /> Draft email
                  </a>
                  <MarkEmailedButton lead={lead} markEmailed={markEmailed} title="Log the send — sets last contacted, bumps touch count, stamps notes" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ---- small building blocks -------------------------------------------------

const DAILY_TARGETS = {
  research: 10,
  drafts: 10,
  emails: 10,
  followUps: 5,
  replies: 1,
} as const;

/** Counts today's saved CRM activity. This deliberately reads the lead record
 * instead of maintaining a second task database: logging the real work checks
 * off the matching goal automatically. */
function DailyGoals({ leads }: { leads: Lead[] }) {
  const goals = useMemo(() => {
    const today = todayYmd();
    let research = 0;
    let drafts = 0;
    let emails = 0;
    let followUps = 0;
    let replies = 0;

    for (const lead of leads) {
      const entries = parseNotesTimeline(lead.notes).entries.filter(
        (entry) => todayYmd(entry.date.getTime()) === today,
      );
      const texts = entries.map((entry) => entry.text.toLowerCase());

      if (
        lead.researchCreatedAt?.startsWith(today) ||
        lead.researchDecisionAt?.startsWith(today) ||
        texts.some((text) => /research|hiring signal/.test(text))
      ) research++;

      if (texts.some((text) => /draft staged|draft ready|gmail draft|prepared draft/.test(text))) {
        drafts++;
      }

      const contactedToday = lead.lastContactedAt?.startsWith(today) ?? false;
      const emailedToday = texts.some((text) => /emailed|email sent|cold intro sent/.test(text));
      if (contactedToday && (lead.status === 'emailed' || emailedToday)) emails++;
      else if (emailedToday) emails++;

      if (texts.some((text) => /follow[- ]?up|bump sent|floating this back up/.test(text))) {
        followUps++;
      }

      if (
        ['interested', 'quote', 'sample', 'po'].includes(lead.status) &&
        texts.some((text) => /replied|responded|interested|rfq|quote received|trial/.test(text))
      ) replies++;
    }

    return [
      { label: 'Companies researched', value: research, target: DAILY_TARGETS.research },
      { label: 'Drafts prepared', value: drafts, target: DAILY_TARGETS.drafts },
      { label: 'Emails sent', value: emails, target: DAILY_TARGETS.emails },
      { label: 'Follow-ups sent', value: followUps, target: DAILY_TARGETS.followUps },
      { label: 'Replies / opportunities', value: replies, target: DAILY_TARGETS.replies },
    ];
  }, [leads]);

  const completed = goals.filter((goal) => goal.value >= goal.target).length;

  return (
    <section className="mb-6 rounded-2xl bg-apex-850 p-4 shadow-lg shadow-black/40 ring-1 ring-white/10 md:p-5" aria-label="Today's sales goals">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-slate-500">
          <Target size={13} /> Today's goals
        </div>
        <span className="text-xs tabular-nums text-slate-400">{completed}/{goals.length} complete</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {goals.map((goal) => {
          const done = goal.value >= goal.target;
          const pct = Math.min(100, Math.round((goal.value / goal.target) * 100));
          return (
            <div key={goal.label} className={`rounded-xl p-3 ring-1 ${done ? 'bg-emerald-500/10 ring-emerald-500/30' : 'bg-apex-800 ring-white/10'}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] leading-4 text-slate-400">{goal.label}</span>
                {done && <Check size={14} className="shrink-0 text-emerald-300" />}
              </div>
              <div className={`mt-2 text-xl font-semibold tabular-nums ${done ? 'text-emerald-200' : 'text-slate-100'}`}>
                {goal.value}<span className="text-xs font-normal text-slate-500">/{goal.target}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/25">
                <div className={`h-full rounded-full ${done ? 'bg-emerald-400' : 'bg-orange-400'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">Updates automatically when activity is logged on a lead. Bounces do not count as replies or opportunities.</p>
    </section>
  );
}

function StatChip({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs ring-1 ${
        highlight
          ? 'bg-violet-500/10 text-violet-300 ring-violet-500/30'
          : 'bg-apex-850 text-slate-400 ring-white/10'
      }`}
    >
      {label}
      <span className={`font-semibold ${highlight ? 'text-violet-200' : 'text-slate-100'}`}>
        {value}
      </span>
    </span>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-2xl bg-apex-850 ring-1 ring-white/10 shadow-lg shadow-black/40 p-4 md:p-5">
      <div
        className={`text-[10px] font-medium uppercase tracking-widest text-slate-500 ${
          hint ? 'mb-1' : 'mb-3'
        }`}
      >
        {title}
      </div>
      {hint && <p className="mb-3 text-xs text-slate-400">{hint}</p>}
      {children}
    </section>
  );
}

function GroupLabel({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: 'orange' | 'amber';
}) {
  const text = tone === 'orange' ? 'text-orange-400' : 'text-amber-400';
  const pill =
    tone === 'orange'
      ? 'bg-orange-500/10 text-orange-300 ring-1 ring-orange-500/30'
      : 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30';
  return (
    <div className={`mb-1 flex items-center gap-2 text-xs font-semibold ${text}`}>
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${pill}`}>
        {count}
      </span>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="py-2 text-sm text-slate-300">{text}</p>;
}

function CoButton({ lead, onLeadClick }: { lead: Lead; onLeadClick: (id: string) => void }) {
  return (
    <button
      onClick={() => onLeadClick(lead.id)}
      className="block max-w-full truncate text-left text-sm font-semibold text-slate-100 transition-colors hover:text-orange-400"
      title={`${lead.co} — open the full card on the Leads tab`}
    >
      {lead.co}
    </button>
  );
}

function TierPill({ t }: { t: 1 | 2 }) {
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 ${
        t === 1
          ? 'bg-orange-500/10 text-orange-300 ring-orange-500/30'
          : 'bg-blue-500/10 text-blue-300 ring-blue-500/30'
      }`}
    >
      {t === 1 ? 'T1' : 'T2'}
    </span>
  );
}

/** Big tap-to-call target — the phone number IS the button. */
function BigPhone({ ph }: { ph: string }) {
  return (
    <a
      href={`tel:${ph}`}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-500/10 px-4 py-2 text-base font-semibold tabular-nums text-emerald-300 ring-1 ring-emerald-500/30 transition-colors hover:bg-emerald-500/20"
    >
      <Phone size={16} /> {ph}
    </a>
  );
}

function LogCallButton({
  lead,
  logCall,
}: {
  lead: Lead;
  logCall: (lead: Lead) => void | Promise<void>;
}) {
  return (
    <button
      onClick={() => void logCall(lead)}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-apex-800 px-3 py-1.5 text-xs font-medium text-slate-300 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-slate-100"
      title="Log a call touch — sets last contacted, bumps touch count, stamps notes"
    >
      <PhoneCall size={14} /> Log call
    </button>
  );
}

function MarkEmailedButton({
  lead,
  markEmailed,
  title,
}: {
  lead: Lead;
  markEmailed: (lead: Lead) => void | Promise<void>;
  title: string;
}) {
  return (
    <button
      onClick={() => void markEmailed(lead)}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-teal-500/20 bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-300 transition-colors hover:bg-teal-500/20"
      title={title}
    >
      <MailCheck size={14} /> Mark emailed
    </button>
  );
}
