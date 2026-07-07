import React, { useEffect, useState } from 'react';
import {
  X,
  Loader2,
  ShieldOff,
  ShieldCheck,
  Trash2,
  KeyRound,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { TenantStats } from '../types';
import { useAdminApi } from './useAdminApi';
import { useModalFocus } from '../ui/useModalFocus';
import { useToast } from '../ui/Toast';

interface Props {
  tenant: TenantStats | null;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Slide-in drawer with all the per-tenant management actions:
 *   - change plan (Trial / Paid / Internal)
 *   - disable / re-enable
 *   - reset the owner's password (looks up their uid from the users collection
 *     by ownerEmail + tenantId, then hits /api/admin/reset-password which sets a
 *     fresh temp password and emails it)
 *   - delete (with double-confirm matching the tenant slug)
 */
export function TenantDetailDrawer({ tenant, onClose, onChanged }: Props) {
  const { updateTenant, deleteTenant, resetPassword } = useAdminApi();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [resetPw, setResetPw] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset the transient per-tenant UI state whenever a different tenant opens
  // (so a stale "password reset" panel or confirm text can't leak across rows).
  useEffect(() => {
    setError(null);
    setSuccess(null);
    setDeleteConfirm('');
    setResetPw(null);
    setCopied(false);
  }, [tenant?.id]);

  // Esc closes the drawer (only while open).
  useEffect(() => {
    if (!tenant) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tenant, onClose]);

  // Focus starts on Close; returns to the tenant row's context on dismiss.
  const closeRef = useModalFocus<HTMLButtonElement>(!!tenant);

  if (!tenant) return null;

  const handleSetPlan = async (plan: 'trial' | 'paid' | 'internal') => {
    if (plan === tenant.plan) return; // no-op — already on this plan
    setBusy('plan');
    setError(null);
    setSuccess(null);
    try {
      await updateTenant({ tenantId: tenant.id, plan });
      setSuccess(`Plan updated to ${plan}.`);
      toast(`Plan set to ${plan} — ${tenant.name}`);
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Failed to update plan.');
    } finally {
      setBusy(null);
    }
  };

  const handleToggleDisabled = async () => {
    const disabling = !tenant.disabled;
    setBusy('disable');
    setError(null);
    setSuccess(null);
    try {
      await updateTenant({ tenantId: tenant.id, disabled: disabling });
      setSuccess(disabling ? 'Tenant disabled.' : 'Tenant re-enabled.');
      toast(`${disabling ? 'Disabled' : 'Re-enabled'} — ${tenant.name}`);
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Failed to change access.');
    } finally {
      setBusy(null);
    }
  };

  const handleResetPassword = async () => {
    setBusy('reset');
    setError(null);
    setSuccess(null);
    setResetPw(null);
    setCopied(false);
    try {
      if (!tenant.ownerEmail) {
        throw new Error('No owner email on file for this tenant.');
      }
      // The reset endpoint takes a uid, but the tenant doc only carries the
      // owner's email. Look their account up in the users collection, scoped to
      // THIS tenant, so we never reset the wrong person's password.
      const snap = await getDocs(
        query(
          collection(db, 'users'),
          where('tenantId', '==', tenant.id),
          where('email', '==', tenant.ownerEmail),
          limit(1),
        ),
      );
      const ownerUid = snap.docs[0]?.id;
      if (!ownerUid) {
        throw new Error(
          `Couldn't find the owner account (${tenant.ownerEmail}) for this tenant.`,
        );
      }
      const result = await resetPassword(ownerUid);
      setResetPw({ email: result.email, password: result.newPassword });
      setSuccess(`New password generated for ${result.email} (also emailed).`);
      toast(`Password reset — ${tenant.name}`);
    } catch (e: any) {
      setError(e?.message || 'Failed to reset password.');
    } finally {
      setBusy(null);
    }
  };

  const copyResetPw = async () => {
    if (!resetPw) return;
    const text = `URL: ${window.location.origin}\nEmail: ${resetPw.email}\nPassword: ${resetPw.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the value is still visible to copy by hand */
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== tenant.id) {
      setError(`Type "${tenant.id}" exactly to confirm deletion.`);
      return;
    }
    setBusy('delete');
    setError(null);
    setSuccess(null);
    try {
      const result = await deleteTenant(tenant.id, deleteConfirm);
      setSuccess(
        `Deleted. Removed ${result.summary.leadsDeleted} leads, ${result.summary.logsDeleted} logs, ${result.summary.usersDeleted} users.`,
      );
      toast(`Deleted — ${tenant.name}`);
      onChanged();
      setTimeout(() => onClose(), 1200);
    } catch (e: any) {
      setError(e?.message || 'Failed to delete tenant.');
    } finally {
      setBusy(null);
    }
  };

  const isProtected = tenant.id === 'sc-deburring';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm motion-safe:animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Manage ${tenant.name}`}
        className="h-full w-full max-w-md overflow-y-auto bg-apex-850 shadow-2xl shadow-black/60 ring-1 ring-white/10 motion-safe:animate-drawer-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-apex-850/95 backdrop-blur px-6 py-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-100" title={tenant.name}>
              {tenant.name}
            </div>
            <div className="mt-0.5 truncate text-xs text-slate-400" title={tenant.ownerEmail}>
              {tenant.ownerEmail}
            </div>
            <div className="mt-1 truncate text-[10px] font-mono text-slate-500" title={tenant.id}>
              tenant id: {tenant.id}
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-apex-800 ring-1 ring-white/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                Leads
              </div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-100">
                {tenant.leadCount ?? 0}
              </div>
            </div>
            <div className="rounded-xl bg-apex-800 ring-1 ring-white/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                Users
              </div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-100">
                {tenant.userCount ?? 0}
              </div>
            </div>
            <div className="rounded-xl bg-apex-800 ring-1 ring-white/10 px-3 py-2 col-span-2">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                Created
              </div>
              <div className="mt-0.5 text-sm text-slate-300">
                {tenant.createdAt
                  ? new Date(tenant.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'unknown'}
              </div>
            </div>
          </div>

          {/* Plan */}
          <Section title="Plan">
            <div className="flex gap-2">
              <PlanBtn
                label="Trial"
                active={tenant.plan === 'trial' || !tenant.plan}
                onClick={() => handleSetPlan('trial')}
                disabled={busy === 'plan'}
                loading={busy === 'plan'}
                accent="bg-amber-500/15 text-amber-300 ring-amber-500/40"
              />
              <PlanBtn
                label="Paid"
                active={tenant.plan === 'paid'}
                onClick={() => handleSetPlan('paid')}
                disabled={busy === 'plan'}
                loading={busy === 'plan'}
                accent="bg-emerald-500/15 text-emerald-300 ring-emerald-500/40"
              />
              <PlanBtn
                label="Internal"
                active={tenant.plan === 'internal'}
                onClick={() => handleSetPlan('internal')}
                disabled={busy === 'plan'}
                loading={busy === 'plan'}
                accent="bg-white/15 text-slate-200 ring-white/25"
              />
            </div>
            <div className="mt-2 text-[10px] text-slate-500">
              For now, payment is tracked manually. Toggle "Paid" when a client
              has paid you. Stripe integration is a future phase.
            </div>
          </Section>

          {/* Disable */}
          <Section title="Access">
            <button
              onClick={handleToggleDisabled}
              disabled={busy === 'disable'}
              className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
                tenant.disabled
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/25'
              }`}
            >
              {busy === 'disable' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : tenant.disabled ? (
                <ShieldCheck size={14} />
              ) : (
                <ShieldOff size={14} />
              )}
              {tenant.disabled ? 'Re-enable tenant' : 'Disable tenant'}
            </button>
            <div className="mt-2 text-[10px] text-slate-500">
              Disabled tenants stay in the system but their users can't load
              any data. They see a "Account disabled" message.
            </div>
          </Section>

          {/* Owner password reset */}
          <Section title="Owner password">
            <button
              onClick={handleResetPassword}
              disabled={busy === 'reset'}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-apex-800 px-4 py-2.5 text-sm font-medium text-slate-200 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-slate-100 disabled:opacity-50"
            >
              {busy === 'reset' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <KeyRound size={14} />
              )}
              {busy === 'reset' ? 'Resetting…' : 'Reset owner password'}
            </button>
            <div className="mt-2 text-[10px] text-slate-500">
              Generates a fresh temporary password for{' '}
              <span className="text-slate-400">{tenant.ownerEmail || 'the owner'}</span>,
              sets it on their account, and emails it to them. Show it below to
              hand off directly.
            </div>

            {resetPw && (
              <div className="mt-3 rounded-xl bg-apex-800 ring-1 ring-white/10 p-4 text-sm">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-widest text-slate-500">
                  New login (also emailed)
                </div>
                <div className="truncate">
                  <span className="text-slate-400">Email:</span>{' '}
                  <span className="font-mono text-slate-100" title={resetPw.email}>
                    {resetPw.email}
                  </span>
                </div>
                <div className="truncate">
                  <span className="text-slate-400">Password:</span>{' '}
                  <span className="font-mono text-slate-100">{resetPw.password}</span>
                </div>
                <button
                  onClick={copyResetPw}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-xs text-orange-400 hover:text-orange-300"
                >
                  <Copy size={12} /> {copied ? 'Copied!' : 'Copy all'}
                </button>
              </div>
            )}
          </Section>

          {/* Delete */}
          <Section title="Danger zone" danger>
            {isProtected ? (
              <div className="rounded-xl bg-apex-800 px-3 py-2.5 text-xs text-slate-400 ring-1 ring-white/10">
                The <span className="font-mono text-slate-300">sc-deburring</span>{' '}
                tenant can't be deleted. Disable it instead if you ever need to.
              </div>
            ) : (
              <>
                <label className="block text-xs text-slate-300">
                  Type{' '}
                  <code className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-300 ring-1 ring-red-500/30 font-mono">
                    {tenant.id}
                  </code>{' '}
                  to confirm:
                  <input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    onKeyDown={(e) => {
                      // Single-field form: Enter confirms (only once the slug matches).
                      if (e.key === 'Enter' && deleteConfirm === tenant.id) void handleDelete();
                    }}
                    placeholder={tenant.id}
                    aria-label={`Type ${tenant.id} to confirm deletion`}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-apex-800 px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/60"
                  />
                </label>
                <button
                  onClick={handleDelete}
                  disabled={busy === 'delete' || deleteConfirm !== tenant.id}
                  className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 active:scale-[0.99] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy === 'delete' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Delete tenant + all data
                </button>
                <div className="mt-2 text-[10px] text-slate-500">
                  Permanently removes the tenant, all their users, all their leads
                  and outreach logs. Irreversible.
                </div>
              </>
            )}
          </Section>

          {success && (
            <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30 px-3 py-2 text-xs text-emerald-300">
              <Check size={14} className="mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-500/10 ring-1 ring-red-500/30 px-3 py-2 text-xs text-red-300">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  danger,
}: {
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div>
      <div
        className={`mb-2 text-[10px] uppercase tracking-widest font-medium ${
          danger ? 'text-red-400' : 'text-slate-500'
        }`}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function PlanBtn({
  label,
  active,
  onClick,
  disabled,
  loading,
  accent,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium ring-1 transition disabled:opacity-50 ${
        active
          ? accent
          : 'bg-apex-800 text-slate-400 ring-white/10 hover:bg-white/10 hover:text-slate-200'
      }`}
    >
      {loading && active && <Loader2 size={12} className="animate-spin" />}
      {label}
    </button>
  );
}
