import React, { useMemo, useState } from 'react';
import {
  Brain, AlertTriangle, Users, Trophy, Clock, Mail, Phone,
  Zap, TrendingUp, Trash2, ChevronDown, ChevronUp, Merge,
  Search, Star, Target, BarChart3, Loader2, Microscope,
  CalendarCheck, PhoneCall, SendHorizonal, Globe, SkipForward,
} from 'lucide-react';
import type { Lead, AiMode } from '../types';

interface AiBrainProps {
  leads: Lead[];
  onLeadClick: (id: string) => void;
  onDeleteLead: (id: string, co: string) => void;
  setStatus: (id: string, st: any) => void;
  handleAI?: (lead: Lead, mode: AiMode) => void;
}

// --- Duplicate detection: only truly same company names ---
function normalize(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .toLowerCase()
    // Strip common suffixes
    .replace(/\b(inc\.?|llc\.?|corp\.?|corporation|co\.?|company|ltd\.?|limited|the)\b/g, '')
    // Strip parenthetical like (ADI)
    .replace(/\([^)]*\)/g, '')
    // Strip special chars, keep only letters numbers spaces
    .replace(/[^a-z0-9 ]/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function isDuplicate(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  // Exact match after normalization
  if (na === nb) return true;
  // One contains the other fully (e.g. "American Precision Tool" vs "American Precision Tool & Engineering")
  if (na.length >= 8 && nb.length >= 8) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  return false;
}

function findDuplicates(leads: Lead[]): Lead[][] {
  const groups: Lead[][] = [];
  const used = new Set<string>();

  for (let i = 0; i < leads.length; i++) {
    if (!leads[i]?.co || used.has(leads[i].id)) continue;
    const group = [leads[i]];

    for (let j = i + 1; j < leads.length; j++) {
      if (!leads[j]?.co || used.has(leads[j].id)) continue;
      if (isDuplicate(leads[i].co, leads[j].co)) {
        group.push(leads[j]);
        used.add(leads[j].id);
      }
    }

    if (group.length > 1) {
      used.add(leads[i].id);
      groups.push(group);
    }
  }
  return groups;
}

// --- Priority scoring ---
function priorityScore(lead: Lead): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (lead.t === 1) { score += 30; reasons.push('Tier 1'); }
  if (lead.pm) { score += 25; reasons.push('Named PM'); }
  if (lead.em) { score += 15; reasons.push('Has email'); }
  if (lead.ph) { score += 10; reasons.push('Has phone'); }

  if (lead.status === 'interested') { score += 35; reasons.push('Interested!'); }
  else if (lead.status === 'quote') { score += 30; reasons.push('Quote sent'); }
  else if (lead.status === 'called' || lead.status === 'emailed') { score += 10; reasons.push('In contact'); }
  else if (lead.status === 'new') { score += 5; reasons.push('Untouched'); }
  else if (lead.status === 'dead') { score -= 50; }
  else if (lead.status === 'client') { score -= 20; }

  if ((lead.parts || '').toLowerCase().includes('aerospace')) { score += 10; reasons.push('Aerospace'); }
  if ((lead.pitch || '').toLowerCase().includes('active hire') || (lead.pitch || '').toLowerCase().includes('deburr')) { score += 15; reasons.push('Active need'); }

  return { score, reasons };
}

export function AiBrain({ leads, onLeadClick, onDeleteLead, setStatus, handleAI }: AiBrainProps) {
  const [activeSection, setActiveSection] = useState<'overview' | 'duplicates' | 'priority' | 'stale' | 'gaps' | 'enrich'>('overview');
  const [enriching, setEnriching] = useState<string | null>(null);
  const [enrichedIds, setEnrichedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  // --- Computed insights ---
  const duplicates = useMemo(() => findDuplicates(leads), [leads]);

  const staleLeads = useMemo(() => {
    const active = leads.filter(l => !['dead', 'client', 'new'].includes(l.status));
    // Leads that are in-progress but haven't been updated (using notes as proxy)
    return active.filter(l => {
      // If they have a status but no notes, they're probably stale
      return !l.notes || (l.notes || '').length < 10;
    });
  }, [leads]);

  const missingInfo = useMemo(() => {
    return leads
      .filter(l => l.status !== 'dead')
      .map(l => {
        const gaps: string[] = [];
        if (!l.em) gaps.push('email');
        if (!l.ph) gaps.push('phone');
        if (!l.pm) gaps.push('PM name');
        if (!l.web) gaps.push('website');
        if (!l.parts) gaps.push('parts info');
        return { lead: l, gaps };
      })
      .filter(x => x.gaps.length >= 2)
      .sort((a, b) => {
        // Prioritize T1 with most gaps
        const aScore = (a.lead.t === 1 ? 100 : 0) + a.gaps.length * 10;
        const bScore = (b.lead.t === 1 ? 100 : 0) + b.gaps.length * 10;
        return bScore - aScore;
      });
  }, [leads]);

  // Leads that need research: missing email/phone but HAVE a website
  const needsResearch = useMemo(() => {
    return leads
      .filter(l => l.status !== 'dead' && !enrichedIds.has(l.id) && !skippedIds.has(l.id))
      .filter(l => (!l.em || !l.ph || !l.pm))
      .map(l => {
        const hasWeb = !!l.web && l.web.length > 3;
        const missing: string[] = [];
        if (!l.em) missing.push('email');
        if (!l.ph) missing.push('phone');
        if (!l.pm) missing.push('contact name');
        return { lead: l, hasWeb, missing };
      })
      .sort((a, b) => {
        // Prioritize: T1 first, then ones with website, then by most missing
        const aScore = (a.lead.t === 1 ? 100 : 0) + (a.hasWeb ? 50 : 0) + a.missing.length * 10;
        const bScore = (b.lead.t === 1 ? 100 : 0) + (b.hasWeb ? 50 : 0) + b.missing.length * 10;
        return bScore - aScore;
      });
  }, [leads, enrichedIds, skippedIds]);

  // Today's game plan
  const todaysPlan = useMemo(() => {
    const callFirst = leads
      .filter(l => l.t === 1 && l.pm && l.status === 'new')
      .slice(0, 5);
    const followUp = leads
      .filter(l => ['called', 'emailed', 'voicemail', 'visited'].includes(l.status) && l.notes)
      .slice(0, 5);
    const hotLeads = leads
      .filter(l => ['interested', 'quote'].includes(l.status));
    const needEmail = leads
      .filter(l => l.t === 1 && !l.em && l.web && l.status !== 'dead')
      .slice(0, 5);
    return { callFirst, followUp, hotLeads, needEmail };
  }, [leads]);

  const prioritized = useMemo(() => {
    return leads
      .filter(l => l.status !== 'dead' && l.status !== 'client')
      .map(l => ({ lead: l, ...priorityScore(l) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);
  }, [leads]);

  const stats = useMemo(() => {
    const total = leads.length;
    const t1 = leads.filter(l => l.t === 1).length;
    const withEmail = leads.filter(l => !!l.em).length;
    const withPM = leads.filter(l => !!l.pm).length;
    const contacted = leads.filter(l => !['new', 'dead'].includes(l.status)).length;
    const clients = leads.filter(l => l.status === 'client').length;
    const dead = leads.filter(l => l.status === 'dead').length;
    const hot = leads.filter(l => ['interested', 'quote'].includes(l.status)).length;
    const untouched = leads.filter(l => l.status === 'new').length;

    return { total, t1, withEmail, withPM, contacted, clients, dead, hot, untouched };
  }, [leads]);

  const sections = [
    { id: 'overview', label: 'Overview', icon: BarChart3, count: null },
    { id: 'duplicates', label: 'Duplicates', icon: Merge, count: duplicates.length },
    { id: 'priority', label: 'Call First', icon: Trophy, count: prioritized.length },
    { id: 'stale', label: 'Stale Leads', icon: Clock, count: staleLeads.length },
    { id: 'gaps', label: 'Missing Info', icon: Search, count: missingInfo.length },
    { id: 'enrich', label: 'Deep Research', icon: Microscope, count: needsResearch.filter(n => n.hasWeb).length },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500">
            <Brain size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">AI Brain</h1>
            <p className="text-xs font-mono text-zinc-500">
              Smart insights · Duplicate cleanup · Priority ranking
            </p>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="mb-6 flex flex-wrap gap-2.5">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
              activeSection === s.id
                ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
                : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <s.icon size={15} />
            {s.label}
            {s.count !== null && s.count > 0 && (
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                activeSection === s.id ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {s.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* Today's Game Plan */}
          <div className="rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-amber-500/5 p-6">
            <div className="mb-4 flex items-center gap-2 text-base font-bold text-orange-400">
              <CalendarCheck size={16} /> Today's Game Plan
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {todaysPlan.hotLeads.length > 0 && (
                <div className="rounded-lg border border-emerald-500/20 bg-zinc-950/50 p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold font-mono uppercase tracking-widest text-emerald-400">
                    <Zap size={12} /> Hot — Close These
                  </div>
                  {todaysPlan.hotLeads.map(l => (
                    <div key={l.id} onClick={() => onLeadClick(l.id)} className="cursor-pointer rounded px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
                      <span className="font-semibold">{l.co}</span> <span className="text-zinc-500">· {l.pm || 'no contact'}</span>
                    </div>
                  ))}
                </div>
              )}
              {todaysPlan.callFirst.length > 0 && (
                <div className="rounded-lg border border-orange-500/20 bg-zinc-950/50 p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold font-mono uppercase tracking-widest text-orange-400">
                    <PhoneCall size={12} /> Call First — T1 with Contacts
                  </div>
                  {todaysPlan.callFirst.map(l => (
                    <div key={l.id} onClick={() => onLeadClick(l.id)} className="cursor-pointer rounded px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
                      <span className="font-semibold">{l.co}</span> <span className="text-violet-400">· {l.pm}</span>
                    </div>
                  ))}
                </div>
              )}
              {todaysPlan.followUp.length > 0 && (
                <div className="rounded-lg border border-blue-500/20 bg-zinc-950/50 p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold font-mono uppercase tracking-widest text-blue-400">
                    <SendHorizonal size={12} /> Follow Up — In Pipeline
                  </div>
                  {todaysPlan.followUp.map(l => (
                    <div key={l.id} onClick={() => onLeadClick(l.id)} className="cursor-pointer rounded px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
                      <span className="font-semibold">{l.co}</span> <span className="text-zinc-500">· {l.status}</span>
                    </div>
                  ))}
                </div>
              )}
              {todaysPlan.needEmail.length > 0 && (
                <div className="rounded-lg border border-violet-500/20 bg-zinc-950/50 p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold font-mono uppercase tracking-widest text-violet-400">
                    <Mail size={12} /> Research — Need Emails
                  </div>
                  {todaysPlan.needEmail.map(l => (
                    <div key={l.id} onClick={() => onLeadClick(l.id)} className="cursor-pointer rounded px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
                      <span className="font-semibold">{l.co}</span> <span className="text-zinc-500">· has website, no email</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {todaysPlan.hotLeads.length === 0 && todaysPlan.callFirst.length === 0 &&
             todaysPlan.followUp.length === 0 && todaysPlan.needEmail.length === 0 && (
              <div className="text-center text-xs text-zinc-500 py-4">
                Start by researching Tier 1 leads with the Deep Research tab
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Total Leads', value: stats.total, color: 'text-zinc-100' },
              { label: 'Tier 1', value: stats.t1, color: 'text-orange-400' },
              { label: 'Hot Leads', value: stats.hot, color: 'text-emerald-400' },
              { label: 'Clients', value: stats.clients, color: 'text-amber-400' },
              { label: 'Has Email', value: stats.withEmail, color: 'text-blue-400' },
              { label: 'Named PM', value: stats.withPM, color: 'text-violet-400' },
              { label: 'Untouched', value: stats.untouched, color: 'text-zinc-400' },
              { label: 'Dead', value: stats.dead, color: 'text-red-400' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
                <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{s.label}</div>
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Quick Alerts */}
          <div className="space-y-3">
            <div className="text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
              Alerts & Recommendations
            </div>

            {duplicates.length > 0 && (
              <Alert icon={Merge} color="amber" title={`${duplicates.length} duplicate group${duplicates.length > 1 ? 's' : ''} found`}
                detail="Click 'Duplicates' tab to review and clean up" />
            )}

            {stats.untouched > 50 && (
              <Alert icon={Target} color="blue" title={`${stats.untouched} leads still untouched`}
                detail="Check 'Call First' tab for the best ones to start with" />
            )}

            {missingInfo.filter(m => m.lead.t === 1).length > 0 && (
              <Alert icon={Search} color="violet" title={`${missingInfo.filter(m => m.lead.t === 1).length} Tier 1 leads missing key info`}
                detail="Click 'Missing Info' tab to see which T1 leads need emails/contacts" />
            )}

            {staleLeads.length > 5 && (
              <Alert icon={Clock} color="orange" title={`${staleLeads.length} leads in pipeline with no activity`}
                detail="They've been contacted but have no notes — follow up or mark dead" />
            )}

            {stats.hot > 0 && (
              <Alert icon={Zap} color="emerald" title={`${stats.hot} hot lead${stats.hot > 1 ? 's' : ''} — don't let them cool off!`}
                detail="Interested or quote-sent leads need fast follow-up" />
            )}

            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
              <div className="mb-2 text-xs font-bold text-zinc-100">Pipeline Health</div>
              <div className="flex gap-1 rounded-lg overflow-hidden h-3">
                {stats.clients > 0 && <div style={{ width: `${(stats.clients / stats.total) * 100}%` }} className="bg-amber-500" title="Clients" />}
                {stats.hot > 0 && <div style={{ width: `${(stats.hot / stats.total) * 100}%` }} className="bg-emerald-500" title="Hot" />}
                {stats.contacted > 0 && <div style={{ width: `${((stats.contacted - stats.hot) / stats.total) * 100}%` }} className="bg-blue-500" title="In Contact" />}
                {stats.untouched > 0 && <div style={{ width: `${(stats.untouched / stats.total) * 100}%` }} className="bg-zinc-700" title="Untouched" />}
                {stats.dead > 0 && <div style={{ width: `${(stats.dead / stats.total) * 100}%` }} className="bg-red-500/50" title="Dead" />}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-zinc-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Clients</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Hot</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> In Contact</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-zinc-700" /> Untouched</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500/50" /> Dead</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATES */}
      {activeSection === 'duplicates' && (
        <div className="space-y-4">
          {duplicates.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
              <div className="text-emerald-400 text-sm font-bold">No duplicates found</div>
              <div className="text-xs text-zinc-500 mt-1">Your database is clean</div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-300">
                Found {duplicates.length} group{duplicates.length > 1 ? 's' : ''} of similar companies. Review and remove duplicates to keep your database clean.
              </div>
              {duplicates.map((group, idx) => (
                <div key={group[0]?.id || idx} id={`dup-group-${idx}`} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-bold text-amber-400">
                    <Merge size={14} /> Duplicate Group {idx + 1} — "{group[0]?.co}"
                  </div>
                  <div className="space-y-2">
                    {group.map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                        <div className="flex-1 cursor-pointer" onClick={() => onLeadClick(lead.id)}>
                          <div className="text-sm font-bold text-zinc-200">{lead.co}</div>
                          <div className="text-[11px] text-zinc-500">
                            {lead.city} · {lead.status} · {lead.pm || lead.who || 'No contact'}
                            {lead.em ? ` · ${lead.em}` : ''}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteLead(lead.id, lead.co); }}
                          className="ml-3 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"
                          title="Delete this duplicate"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* PRIORITY - CALL FIRST */}
      {activeSection === 'priority' && (
        <div className="space-y-2">
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 text-xs text-orange-300">
            Leads ranked by potential. Tier 1 + Named PM + Has Email + Active Need = call these first.
          </div>
          {prioritized.map((item, idx) => (
            <div
              key={item.lead.id}
              onClick={() => onLeadClick(item.lead.id)}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3 transition-colors hover:border-zinc-700"
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                idx < 3 ? 'bg-orange-500/20 text-orange-400' :
                idx < 10 ? 'bg-zinc-800 text-zinc-300' :
                'bg-zinc-900 text-zinc-500'
              }`}>
                #{idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-200 truncate">{item.lead.co}</span>
                  {item.lead.t === 1 && <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-bold text-orange-400">T1</span>}
                  {item.lead.pm && <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold text-violet-400">PM</span>}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {item.reasons.join(' · ')} — {item.lead.city}
                </div>
              </div>
              <div className={`text-sm font-bold ${
                item.score >= 60 ? 'text-emerald-400' :
                item.score >= 40 ? 'text-amber-400' :
                'text-zinc-500'
              }`}>
                {item.score}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STALE LEADS */}
      {activeSection === 'stale' && (
        <div className="space-y-2">
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 text-xs text-orange-300">
            These leads have been contacted but have no notes or follow-up. Either reach out again or mark them dead.
          </div>
          {staleLeads.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
              <div className="text-emerald-400 text-sm font-bold">No stale leads</div>
              <div className="text-xs text-zinc-500 mt-1">All active leads have notes</div>
            </div>
          ) : (
            staleLeads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
                <div className="flex-1 cursor-pointer" onClick={() => onLeadClick(lead.id)}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-200">{lead.co}</span>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold text-zinc-400">{lead.status}</span>
                  </div>
                  <div className="text-[11px] text-zinc-500">{lead.city} · {lead.pm || lead.who || 'No contact'}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onLeadClick(lead.id)}
                    className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-[11px] font-medium text-blue-400 hover:bg-blue-500/20"
                  >
                    Follow Up
                  </button>
                  <button
                    onClick={() => setStatus(lead.id, 'dead')}
                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-500/20"
                  >
                    Mark Dead
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* DEEP RESEARCH / ENRICH */}
      {activeSection === 'enrich' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-xs text-violet-300">
            <div className="font-bold mb-1">Deep Research — Find Missing Emails & Contacts</div>
            Click "Research" on any lead to have AI dig deep. Leads without a website are flagged — probably not worth the time.
          </div>

          {needsResearch.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
              <div className="text-emerald-400 text-sm font-bold">All leads have been researched!</div>
              <div className="text-xs text-zinc-500 mt-1">Or skipped because they have no website</div>
            </div>
          ) : (
            <>
              <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                {needsResearch.filter(n => n.hasWeb).length} with website · {needsResearch.filter(n => !n.hasWeb).length} no website (skip)
              </div>
              {needsResearch.map(({ lead, hasWeb, missing }) => (
                <div key={lead.id} className={`flex items-center justify-between rounded-xl border p-3 ${
                  hasWeb ? 'border-zinc-800/60 bg-zinc-900/40' : 'border-zinc-800/30 bg-zinc-900/20 opacity-50'
                }`}>
                  <div className="flex-1 cursor-pointer" onClick={() => onLeadClick(lead.id)}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-200">{lead.co}</span>
                      {lead.t === 1 && <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-bold text-orange-400">T1</span>}
                      {!hasWeb && (
                        <span className="flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                          No Website
                        </span>
                      )}
                      {hasWeb && (
                        <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                          <Globe size={9} /> {lead.web}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {missing.map(m => (
                        <span key={m} className="text-[10px] text-red-400/70">missing {m}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-3">
                    {hasWeb && handleAI ? (
                      <button
                        onClick={() => {
                          setEnriching(lead.id);
                          handleAI(lead, 'research');
                          // Mark as enriched after click
                          setEnrichedIds(prev => new Set([...prev, lead.id]));
                          setTimeout(() => setEnriching(null), 1000);
                        }}
                        disabled={enriching === lead.id}
                        className="flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-400 hover:bg-violet-500/20 disabled:opacity-50"
                      >
                        {enriching === lead.id ? <Loader2 size={12} className="animate-spin" /> : <Microscope size={12} />}
                        Research
                      </button>
                    ) : (
                      <button
                        onClick={() => setSkippedIds(prev => new Set([...prev, lead.id]))}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-700"
                      >
                        <SkipForward size={12} /> Skip
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* MISSING INFO / GAPS */}
      {activeSection === 'gaps' && (
        <div className="space-y-2">
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-xs text-violet-300">
            Leads missing 2+ key fields. Tier 1 leads shown first — use Research Contact to fill in gaps.
          </div>
          {missingInfo.slice(0, 30).map(({ lead, gaps }) => (
            <div key={lead.id} className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
              <div className="flex-1 cursor-pointer" onClick={() => onLeadClick(lead.id)}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-200">{lead.co}</span>
                  {lead.t === 1 && <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-bold text-orange-400">T1</span>}
                </div>
                <div className="text-[11px] text-zinc-500">{lead.city}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {gaps.map((g) => (
                  <span key={g} className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Alert({ icon: Icon, color, title, detail }: { icon: any; color: string; title: string; detail: string }) {
  const colors: Record<string, string> = {
    amber: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
    blue: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
    violet: 'border-violet-500/20 bg-violet-500/5 text-violet-400',
    orange: 'border-orange-500/20 bg-orange-500/5 text-orange-400',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
    red: 'border-red-500/20 bg-red-500/5 text-red-400',
  };
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${colors[color]}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div>
        <div className="text-xs font-bold">{title}</div>
        <div className="text-[11px] opacity-70">{detail}</div>
      </div>
    </div>
  );
}
