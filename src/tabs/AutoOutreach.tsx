import React, { useEffect, useState } from 'react';
import {
  Zap, ZapOff, Play, Settings, Mail, Clock, AlertCircle, Check,
  ChevronDown, Loader2, Send, Eye, Sparkles, Copy,
} from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, collection, query, orderBy, limit } from 'firebase/firestore';
import type { Lead, AutoOutreachSettings, OutreachLog } from '../types';
import { generateOutreachEmail } from '../services/gemini';
import { useToast } from '../ui/Toast';

interface AutoOutreachProps {
  leads: Lead[];
}

const DEFAULT_SETTINGS: AutoOutreachSettings = {
  enabled: false,
  mode: 'all_new',
  dailyLimit: 15,
};

const MODE_LABELS: Record<string, { label: string; desc: string }> = {
  all_new: { label: 'All New Leads', desc: 'Emails every lead with status "new"' },
  tier1: { label: 'Tier 1 Only', desc: 'Only high-priority "Call Now" leads' },
  tagged: { label: 'Tagged Only', desc: 'Only leads you manually queue' },
};

export function AutoOutreach({ leads }: AutoOutreachProps) {
  const toast = useToast();
  const [settings, setSettings] = useState<AutoOutreachSettings>(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState<OutreachLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewLead, setPreviewLead] = useState<Lead | null>(null);
  const [previewEmail, setPreviewEmail] = useState<{ subject: string; body: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);

  // Listen to settings from Firebase
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'auto-outreach'), (snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...snap.data() } as AutoOutreachSettings);
      }
    });
    return unsub;
  }, []);

  // Listen to outreach logs
  useEffect(() => {
    const q = query(collection(db, 'outreach-logs'), orderBy('sentAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as OutreachLog)));
    });
    return unsub;
  }, []);

  const saveSettings = async (update: Partial<AutoOutreachSettings>) => {
    setSaving(true);
    const next = { ...settings, ...update };
    setSettings(next);
    try {
      await setDoc(doc(db, 'settings', 'auto-outreach'), next, { merge: true });
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
    setSaving(false);
  };

  // Count eligible leads based on current mode
  const eligibleLeads = leads.filter((l) => {
    if (l.status !== 'new') return false;
    if (!l.em) return false;
    if (settings.mode === 'tier1' && l.t !== 1) return false;
    if (settings.mode === 'tagged' && !(l as any).queued_for_outreach) return false;
    return true;
  });

  const todaySent = logs.filter(
    (l) => l.sentAt.slice(0, 10) === new Date().toISOString().slice(0, 10)
  ).length;

  const handlePreview = async (lead: Lead) => {
    setPreviewLead(lead);
    setPreviewLoading(true);
    setPreviewEmail(null);
    try {
      const result = await generateOutreachEmail(lead);
      setPreviewEmail(result);
    } catch (e: any) {
      setPreviewEmail({ subject: 'Error', body: e?.message || 'Failed to generate' });
    }
    setPreviewLoading(false);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-100">
          Autopilot
        </h1>
        <p className="text-xs text-slate-400">
          Automated prospecting queue — drafts and sends emails daily without you lifting a finger.
        </p>
      </div>

      {/* Main Controls */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {/* Enable/Disable Toggle */}
        <div className="rounded-xl bg-apex-850 ring-1 ring-white/10 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-500">
            <Zap size={14} /> Status
          </div>
          <button
            onClick={() => saveSettings({ enabled: !settings.enabled })}
            className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-bold transition-all ${
              settings.enabled
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-apex-800 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-2">
              {settings.enabled ? <Zap size={16} /> : <ZapOff size={16} />}
              {settings.enabled ? 'ACTIVE' : 'PAUSED'}
            </span>
            <div
              className={`h-5 w-9 rounded-full transition-colors ${
                settings.enabled ? 'bg-emerald-500' : 'bg-white/15'
              }`}
            >
              <div
                className={`mt-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  settings.enabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
        </div>

        {/* Mode Selector */}
        <div className="rounded-xl bg-apex-850 ring-1 ring-white/10 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-500">
            <Settings size={14} /> Mode
          </div>
          <div className="relative">
            <button
              onClick={() => setShowModeDropdown(!showModeDropdown)}
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-apex-800 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:border-white/20 hover:bg-white/10"
            >
              <span>{MODE_LABELS[settings.mode]?.label}</span>
              <ChevronDown size={14} className={`transition-transform ${showModeDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showModeDropdown && (
              <div className="absolute z-10 mt-1 w-full rounded-lg bg-apex-800 py-1 shadow-xl shadow-black/60 ring-1 ring-white/10">
                {Object.entries(MODE_LABELS).map(([key, { label, desc }]) => (
                  <button
                    key={key}
                    onClick={() => {
                      saveSettings({ mode: key as any });
                      setShowModeDropdown(false);
                    }}
                    className={`flex w-full flex-col items-start px-4 py-2.5 text-left transition-colors hover:bg-white/5 ${
                      settings.mode === key ? 'bg-white/5' : ''
                    }`}
                  >
                    <span className="text-sm font-medium text-slate-200">{label}</span>
                    <span className="text-[11px] text-slate-400">{desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Volume */}
        <div className="rounded-xl bg-apex-850 ring-1 ring-white/10 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-500">
            <Mail size={14} /> Daily Volume
          </div>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums text-orange-400">{settings.dailyLimit}</span>
            <span className="text-xs text-slate-400">emails/day</span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={settings.dailyLimit}
            onChange={(e) => saveSettings({ dailyLimit: Number(e.target.value) })}
            className="w-full accent-orange-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>5</span>
            <span>25</span>
            <span>50</span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-apex-850 ring-1 ring-white/10 p-4 text-center">
          <div className="text-2xl font-semibold tabular-nums text-blue-400">{eligibleLeads.length}</div>
          <div className="mt-1 text-[11px] text-slate-400">In Queue</div>
        </div>
        <div className="rounded-xl bg-apex-850 ring-1 ring-white/10 p-4 text-center">
          <div className="text-2xl font-semibold tabular-nums text-emerald-400">{todaySent}</div>
          <div className="mt-1 text-[11px] text-slate-400">Sent Today</div>
        </div>
        <div className="rounded-xl bg-apex-850 ring-1 ring-white/10 p-4 text-center">
          <div className="text-2xl font-semibold tabular-nums text-orange-400">{logs.length}</div>
          <div className="mt-1 text-[11px] text-slate-400">Total Sent</div>
        </div>
      </div>

      {/* Preview Queue */}
      <div className="mb-6 rounded-xl bg-apex-850 ring-1 ring-white/10 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-500">
            <Eye size={14} /> Next Up — Preview Queue
          </div>
          <span className="text-[11px] tabular-nums text-slate-400">{eligibleLeads.length} leads ready</span>
        </div>

        {eligibleLeads.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-apex-800 px-4 py-3 text-xs text-slate-400 ring-1 ring-white/10">
            <AlertCircle size={14} />
            No eligible leads. Change mode or add leads with emails.
          </div>
        ) : (
          <div className="space-y-2">
            {eligibleLeads.slice(0, 8).map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between rounded-lg bg-apex-800 px-4 py-2.5 ring-1 ring-white/10"
              >
                <div
                  className="min-w-0 flex-1 truncate pr-3"
                  title={`${lead.co} · ${lead.pm || lead.who || 'No contact'} · ${lead.em || 'No email'}`}
                >
                  <span className="text-sm font-medium text-slate-200">{lead.co}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {lead.pm || lead.who || 'No contact'} · {lead.em || 'No email'}
                  </span>
                </div>
                <button
                  onClick={() => handlePreview(lead)}
                  disabled={previewLoading && previewLead?.id === lead.id}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-[11px] font-medium text-orange-300 transition-colors hover:bg-orange-500/20 disabled:opacity-50"
                >
                  {previewLoading && previewLead?.id === lead.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Eye size={12} />
                  )}
                  Preview
                </button>
              </div>
            ))}
            {eligibleLeads.length > 8 && (
              <div className="text-center text-[11px] text-slate-400">
                +{eligibleLeads.length - 8} more
              </div>
            )}
          </div>
        )}

        {/* Email Preview */}
        {previewEmail && previewLead && (
          <div className="mt-4 rounded-xl border border-orange-500/30 bg-apex-800 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-400">
                Preview for {previewLead.co}
              </span>
              <button
                onClick={() => { setPreviewEmail(null); setPreviewLead(null); }}
                className="rounded-md px-1.5 py-0.5 text-xs text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
              >
                Close
              </button>
            </div>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-widest text-slate-500">
              Subject
            </div>
            <input
              value={previewEmail.subject}
              onChange={(e) => setPreviewEmail({ ...previewEmail, subject: e.target.value })}
              className="mb-3 w-full rounded-lg border border-white/10 bg-apex-850 px-3 py-1.5 text-sm text-slate-100 transition focus:border-apex-accent/60 focus:outline-none focus:ring-1 focus:ring-apex-accent/50"
            />
            <div className="mb-1 text-[10px] font-medium uppercase tracking-widest text-slate-500">
              Body
            </div>
            <textarea
              value={previewEmail.body}
              onChange={(e) => setPreviewEmail({ ...previewEmail, body: e.target.value })}
              rows={10}
              className="mb-3 w-full resize-none rounded-lg border border-white/10 bg-apex-850 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-200 transition focus:border-apex-accent/60 focus:outline-none focus:ring-1 focus:ring-apex-accent/50"
            />
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(previewLead.em || '')}&su=${encodeURIComponent(previewEmail.subject)}&body=${encodeURIComponent(previewEmail.body)}`}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold shadow-lg transition-all ${
                  previewLead.em
                    ? 'bg-apex-accent text-white shadow-orange-950/50 hover:brightness-110'
                    : 'pointer-events-none bg-white/10 text-slate-500'
                }`}
              >
                <Send size={13} /> Send via Gmail
              </a>
              <button
                onClick={() => handlePreview(previewLead)}
                disabled={previewLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
              >
                {previewLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                Regenerate
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`Subject: ${previewEmail.subject}\n\n${previewEmail.body}`);
                    toast('Copied');
                  } catch {}
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-apex-850 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10"
              >
                <Copy size={13} /> Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Outreach Log */}
      <div className="rounded-xl bg-apex-850 ring-1 ring-white/10 p-5">
        <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-500">
          <Clock size={14} /> Outreach Log
        </div>

        {logs.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-apex-800 px-4 py-3 text-xs text-slate-400 ring-1 ring-white/10">
            <Mail size={14} />
            No emails sent yet. Enable autopilot and it runs daily at 8am PT.
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-lg bg-apex-800 px-4 py-2.5 ring-1 ring-white/10"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200 truncate" title={log.company}>
                      {log.company}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                        log.status === 'sent'
                          ? 'bg-blue-500/10 text-blue-300 ring-blue-500/30'
                          : log.status === 'opened'
                          ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
                          : log.status === 'replied'
                          ? 'bg-orange-500/10 text-orange-300 ring-orange-500/30'
                          : 'bg-red-500/10 text-red-300 ring-red-500/30'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400 truncate">
                    {log.contact} · {log.subject}
                  </div>
                </div>
                <div className="ml-4 text-[10px] tabular-nums text-slate-400 whitespace-nowrap">
                  {new Date(log.sentAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
