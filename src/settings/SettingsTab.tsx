import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  AlertCircle,
  Check,
  Copy,
  Download,
  KeyRound,
  Loader2,
  Lock,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useWorkspaceCtx } from '../auth/WorkspaceContext';
import { apiFetch, isNotConfigured, ApiError } from '../services/api';
import { ServerSetupCallout } from '../ui/ServerSetupCallout';
import { useInstallPrompt } from '../shell/useInstallPrompt';
import { useToast } from '../ui/Toast';
import { COLD_TEMPLATE, WARM_TEMPLATE, type OutreachTemplate } from '../outreach/templates';
import { downloadLeadsCsv } from '../leads/leadsCsv';
import type { Lead } from '../types';

/**
 * Settings tab — visible to tenant owners + super-admin.
 *
 * Sections:
 *   1. Workspace  — business name, brand color, logo (server-persisted)
 *   2. Account    — signed-in email + password reset (auth-context flow)
 *   3. Outreach   — read-only viewer of the locked cold/warm templates
 *   4. Data       — one-click CSV export of the live leads array
 */

interface SettingsTabProps {
  /** Live tenant leads — App's single useLeads subscription, passed down
   * (no second Firestore listener). Powers the CSV export. */
  leads: Lead[];
}

export function SettingsTab({ leads }: SettingsTabProps) {
  const { profile, user, resetPassword } = useAuth();
  // The ACTIVE workspace's tenant — for owners that's their own tenant; for a
  // super-admin it follows the switcher (null in the Platform Console).
  const { activeTenant: tenant } = useWorkspaceCtx();
  const toast = useToast();
  // Native "Install app" affordance — only renders where the browser offered
  // an install prompt (Chrome/Edge/Android) and the app isn't already installed.
  const { canInstall, promptInstall } = useInstallPrompt();
  const isSuperAdmin = profile?.role === 'super-admin';
  const [name, setName] = useState(tenant?.name || '');
  const [primaryColor, setPrimaryColor] = useState(tenant?.primaryColor || '#2563eb');
  const [logoUrl, setLogoUrl] = useState(tenant?.logoUrl || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  // Password reset state
  const [pwBusy, setPwBusy] = useState(false);
  const [pwSent, setPwSent] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    setName(tenant?.name || '');
    setPrimaryColor(tenant?.primaryColor || '#2563eb');
    setLogoUrl(tenant?.logoUrl || '');
  }, [tenant?.id, tenant?.name, tenant?.primaryColor, tenant?.logoUrl]);

  // Platform admins (super-admin, no client tenant) get a personal account view
  // — no workspace branding of their own. Only a real owner with no tenant loaded
  // is an actual error state.
  if (!tenant && !isSuperAdmin) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center text-sm text-slate-300">
        No tenant loaded.
      </div>
    );
  }

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotConfigured(false);
    if (!user) {
      setError('Not signed in.');
      return;
    }
    if (!tenant) return;
    setBusy(true);
    try {
      const idToken = await user.getIdToken();
      await apiFetch('/api/tenant/update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          tenantId: tenant.id,
          name,
          primaryColor,
          logoUrl,
        }),
      });
      toast('Saved');
    } catch (e: any) {
      if (isNotConfigured(e)) {
        setNotConfigured(true);
      } else if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError(e?.message || 'Network error');
      }
    } finally {
      setBusy(false);
    }
  };

  // Same reset flow the login screen's "forgot password" uses (auth context).
  const onResetPassword = async () => {
    if (!profile?.email || pwBusy) return;
    setPwError(null);
    setPwSent(false);
    setPwBusy(true);
    try {
      await resetPassword(profile.email);
      setPwSent(true);
      toast('Reset email sent');
    } catch (e: any) {
      const code: string = e?.code || '';
      setPwError(
        code.includes('too-many-requests')
          ? 'Too many requests. Wait a minute and try again.'
          : e?.message || 'Could not send reset email',
      );
    } finally {
      setPwBusy(false);
    }
  };

  const onCopyTemplate = async (label: string, t: OutreachTemplate) => {
    try {
      await navigator.clipboard.writeText(`Subject: ${t.subject}\n\n${t.body}`);
      toast(`Copied — ${label}`);
    } catch {
      toast('Copy failed — select the text manually');
    }
  };

  const onExportCsv = () => {
    downloadLeadsCsv(leads, `leads-${new Date().toISOString().slice(0, 10)}.csv`);
    toast(`Exported ${leads.length} lead${leads.length === 1 ? '' : 's'} to CSV`);
  };

  const readOnlyByRole = profile?.role === 'member';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <SettingsIcon size={20} className="text-apex-accent" />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Settings</h1>
        </div>
        <p className="text-xs text-slate-400">
          {isSuperAdmin && !tenant
            ? 'Your platform account, the locked outreach voice, and data export. Edit a client’s branding from the Admin tab.'
            : 'Workspace branding, your account, the locked outreach voice, and data export.'}
        </p>
      </div>

      {/* Read-only stats — tenant owners only (a platform admin has no tenant) */}
      {tenant && (
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ReadOnlyCard label="Tenant slug" value={tenant.id} mono />
        <ReadOnlyCard
          label="Plan"
          value={(tenant.plan || 'trial').toUpperCase()}
          accentClass={
            tenant.plan === 'paid'
              ? 'text-emerald-400'
              : tenant.plan === 'internal'
                ? 'text-slate-300'
                : 'text-amber-400'
          }
        />
        <ReadOnlyCard
          label="Created"
          value={
            tenant.createdAt
              ? new Date(tenant.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : '—'
          }
        />
      </div>
      )}

      {/* INSTALL APP — only shown when the browser offers a native install and
          the app isn't already running standalone. */}
      {canInstall && (
        <Section
          title="Install app"
          hint="Add Apex CRM to your home screen or desktop — opens in its own window, launches faster, and works offline for the leads you've already loaded."
        >
          <button
            onClick={promptInstall}
            className="inline-flex items-center gap-2 rounded-xl bg-apex-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-950/50 hover:brightness-110 active:scale-[0.99] transition"
          >
            <Smartphone size={14} />
            Install app
          </button>
        </Section>
      )}

      {/* 1 · WORKSPACE — owners edit their own; a platform admin edits client
          branding from the Admin tab, so they see a pointer instead. */}
      {tenant ? (
      <form onSubmit={onSave}>
        <Section
          title="Workspace"
          hint="Branding for this workspace — shows in the sidebar and browser tab."
        >
          <div className="space-y-5">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Business name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={readOnlyByRole}
                className="mt-1 w-full rounded-xl border border-white/10 bg-apex-800 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-apex-accent/60 focus:border-apex-accent/60 transition disabled:opacity-50"
              />
              <span className="mt-1 block text-[10px] text-slate-400">
                Shows in the sidebar header and your browser tab title.
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Brand primary color
              </span>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  disabled={readOnlyByRole}
                  className="h-10 w-14 cursor-pointer rounded-xl border border-white/10 bg-apex-800 disabled:opacity-50"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  disabled={readOnlyByRole}
                  placeholder="#2563eb"
                  className="flex-1 rounded-xl border border-white/10 bg-apex-800 px-3 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-apex-accent/60 focus:border-apex-accent/60 disabled:opacity-50"
                />
                <div
                  className="h-10 w-10 rounded-xl ring-1 ring-white/10"
                  style={{ background: primaryColor }}
                  title="Preview"
                />
              </div>
              <span className="mt-1 block text-[10px] text-slate-400">
                Shows as the accent stripe in the sidebar and a few UI highlights.
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Logo URL (optional)
              </span>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                disabled={readOnlyByRole}
                placeholder="https://example.com/logo.png"
                className="mt-1 w-full rounded-xl border border-white/10 bg-apex-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-apex-accent/60 focus:border-apex-accent/60 transition disabled:opacity-50"
              />
              <span className="mt-1 block text-[10px] text-slate-400">
                Paste any public image URL. Replaces the default badge in the sidebar.
              </span>
            </label>

            {notConfigured && <ServerSetupCallout />}

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 ring-1 ring-red-500/30 px-3 py-2 text-xs text-red-300">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={busy || readOnlyByRole}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-apex-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-950/50 hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                {busy ? 'Saving…' : 'Save changes'}
              </button>
              {readOnlyByRole && (
                <span className="text-xs text-slate-400">
                  Only the tenant owner can change these.
                </span>
              )}
            </div>
          </div>
        </Section>
      </form>
      ) : (
        <Section
          title="Workspace"
          hint="You're the platform admin — you don't have your own workspace branding."
        >
          <p className="text-sm leading-relaxed text-slate-300">
            To edit a client's business name, brand color, or logo, open the{' '}
            <span className="font-medium text-slate-100">Admin</span> tab, click the
            client, and use the{' '}
            <span className="font-medium text-slate-100">Branding</span> section in
            their panel.
          </p>
        </Section>
      )}

      {/* 2 · ACCOUNT */}
      <Section title="Account" hint="Who's signed in, and how to change your password.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-100" title={profile?.email}>
              {profile?.email}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-400">
              {profile?.role === 'super-admin' ? 'Super Admin' : profile?.role}
            </div>
          </div>
          <button
            onClick={onResetPassword}
            disabled={pwBusy}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-apex-800 ring-1 ring-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-slate-100 transition disabled:opacity-50"
          >
            {pwBusy ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
            {pwBusy ? 'Sending…' : 'Send password reset email'}
          </button>
        </div>
        {pwSent && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30 px-3 py-2 text-xs text-emerald-300">
            <Check size={14} className="mt-0.5 shrink-0" />
            <span>Reset email sent to {profile?.email}. Check your inbox.</span>
          </div>
        )}
        {pwError && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 ring-1 ring-red-500/30 px-3 py-2 text-xs text-red-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{pwError}</span>
          </div>
        )}
      </Section>

      {/* 3 · OUTREACH TEMPLATES */}
      <Section
        title="Outreach templates"
        hint="Locked outreach voice — used by the Draft email buttons on Today and lead cards. Cold goes to new shops; warm goes to anyone who already knows us."
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
            <Lock size={10} /> LOCKED
          </span>
        }
      >
        <div className="space-y-4">
          <TemplateBlock
            label="Cold intro"
            note="New shops — never worked with us"
            template={COLD_TEMPLATE}
            onCopy={onCopyTemplate}
          />
          <TemplateBlock
            label="Warm check-in"
            note="Clients + interested/quoted/visited — they know us"
            template={WARM_TEMPLATE}
            onCopy={onCopyTemplate}
          />
        </div>
      </Section>

      {/* 4 · DATA */}
      <Section title="Data" hint="Your leads belong to you — take them anywhere.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-slate-100">Export leads (CSV)</div>
            <div className="mt-0.5 text-xs text-slate-400">
              {leads.length} lead{leads.length === 1 ? '' : 's'} · company, city, region,
              tier, status, contacts, touch history. Opens in Excel or Sheets.
            </div>
          </div>
          <button
            onClick={onExportCsv}
            disabled={leads.length === 0}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-apex-800 ring-1 ring-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={12} />
            Export leads (CSV)
          </button>
        </div>
      </Section>
    </div>
  );
}

/* ---- building blocks ------------------------------------------------------ */

function Section({
  title,
  hint,
  badge,
  children,
}: {
  title: string;
  hint?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-2xl bg-apex-850 ring-1 ring-white/10 p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
            {title}
          </div>
          {badge}
        </div>
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        <div className="mt-3 h-px bg-white/10" />
      </div>
      {children}
    </section>
  );
}

function TemplateBlock({
  label,
  note,
  template,
  onCopy,
}: {
  label: string;
  note: string;
  template: OutreachTemplate;
  onCopy: (label: string, t: OutreachTemplate) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-apex-800 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-100">{label}</div>
          <div className="text-[11px] text-slate-400">{note}</div>
        </div>
        <button
          onClick={() => onCopy(label, template)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-apex-850 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-slate-100"
        >
          <Copy size={12} /> Copy
        </button>
      </div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-widest text-slate-400">
        Subject
      </div>
      <div className="mb-3 rounded-lg bg-apex-850 ring-1 ring-white/10 px-3 py-2 font-mono text-[11px] text-slate-200">
        {template.subject}
      </div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-widest text-slate-400">
        Body
      </div>
      <pre className="whitespace-pre-wrap rounded-lg bg-apex-850 ring-1 ring-white/10 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
        {template.body}
      </pre>
    </div>
  );
}

function ReadOnlyCard({
  label,
  value,
  mono,
  accentClass,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accentClass?: string;
}) {
  return (
    <div className="rounded-2xl bg-apex-850 ring-1 ring-white/10 px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
        {label}
      </div>
      <div
        className={`mt-1 text-sm ${mono ? 'font-mono' : ''} ${accentClass || 'text-slate-100'}`}
      >
        {value}
      </div>
    </div>
  );
}
