import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Check,
  AlertCircle,
  Loader2,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { apiFetch, isNotConfigured, ApiError } from '../services/api';
import { ServerSetupCallout } from '../ui/ServerSetupCallout';
import { useToast } from '../ui/Toast';

/**
 * Settings tab — visible to tenant owners + super-admin.
 *
 * Owner can change:
 *   - Business display name
 *   - Brand primary color
 *   - Logo URL (paste any https URL — Imgur, Cloudflare R2, etc.)
 *   - Their own password (sends a Firebase reset email)
 *
 * Read-only:
 *   - Tenant slug (id)
 *   - Plan badge
 *   - Created date
 */
export function SettingsTab() {
  const { tenant, profile, user } = useAuth();
  const toast = useToast();
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

  if (!tenant) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center text-sm text-slate-400">
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

  const onResetPassword = async () => {
    if (!profile?.email) return;
    setPwError(null);
    setPwSent(false);
    setPwBusy(true);
    try {
      await sendPasswordResetEmail(auth, profile.email);
      setPwSent(true);
    } catch (e: any) {
      setPwError(e?.message || 'Could not send reset email');
    } finally {
      setPwBusy(false);
    }
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
          Your workspace — business name, brand color, logo, and your account.
        </p>
      </div>

      {/* Read-only stats */}
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

      {/* Editable form */}
      <form
        onSubmit={onSave}
        className="rounded-2xl bg-apex-850 ring-1 ring-white/10 p-6 space-y-5"
      >
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-500 font-medium">
            Business
          </div>
          <div className="h-px bg-white/10" />
        </div>

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
          <span className="mt-1 block text-[10px] text-slate-500">
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
          <span className="mt-1 block text-[10px] text-slate-500">
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
          <span className="mt-1 block text-[10px] text-slate-500">
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
      </form>

      {/* Password reset */}
      <div className="mt-6 rounded-2xl bg-apex-850 ring-1 ring-white/10 p-6">
        <div className="mb-4 text-[10px] uppercase tracking-widest text-slate-500 font-medium">
          Account
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-100">{profile?.email}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
              {profile?.role}
            </div>
          </div>
          <button
            onClick={onResetPassword}
            disabled={pwBusy}
            className="inline-flex items-center gap-2 rounded-xl bg-apex-800 ring-1 ring-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-slate-100 transition disabled:opacity-50"
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
      </div>
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
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">
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
