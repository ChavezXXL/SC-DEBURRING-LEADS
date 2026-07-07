import React, { useEffect, useState } from 'react';
import {
  X,
  Loader2,
  ShieldOff,
  ShieldCheck,
  Trash2,
  Mail,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { TenantStats } from '../types';
import { useAdminApi } from './useAdminApi';
import { useModalFocus } from '../ui/useModalFocus';

interface Props {
  tenant: TenantStats | null;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Slide-in drawer with all the per-tenant management actions:
 *   - change plan (Trial / Paid / Internal)
 *   - disable / re-enable
 *   - delete (with double-confirm matching the tenant slug)
 *   - reset password for the owner's account (only if you know their UID,
 *     which we don't have in the tenant doc — needs a /api/admin/list-users
 *     endpoint to expand. Deferred for now.)
 */
export function TenantDetailDrawer({ tenant, onClose, onChanged }: Props) {
  const { updateTenant, deleteTenant } = useAdminApi();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

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
    setBusy('plan');
    setError(null);
    try {
      await updateTenant({ tenantId: tenant.id, plan });
      setSuccess(`Plan updated to ${plan}.`);
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setBusy(null);
    }
  };

  const handleToggleDisabled = async () => {
    setBusy('disable');
    setError(null);
    try {
      await updateTenant({ tenantId: tenant.id, disabled: !tenant.disabled });
      setSuccess(tenant.disabled ? 'Tenant re-enabled.' : 'Tenant disabled.');
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== tenant.id) {
      setError(`Type "${tenant.id}" exactly to confirm deletion.`);
      return;
    }
    setBusy('delete');
    setError(null);
    try {
      const result = await deleteTenant(tenant.id, deleteConfirm);
      setSuccess(
        `Deleted. Removed ${result.summary.leadsDeleted} leads, ${result.summary.logsDeleted} logs, ${result.summary.usersDeleted} users.`,
      );
      onChanged();
      setTimeout(() => onClose(), 1200);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setBusy(null);
    }
  };

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
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/10 bg-apex-850/95 backdrop-blur px-6 py-4">
          <div>
            <div className="text-base font-semibold text-slate-100">{tenant.name}</div>
            <div className="mt-0.5 text-xs text-slate-400">
              {tenant.ownerEmail}
            </div>
            <div className="mt-1 text-[10px] font-mono text-slate-500">
              tenant id: {tenant.id}
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-slate-100 transition"
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
              <div className="mt-0.5 text-lg font-semibold text-slate-100">
                {tenant.leadCount}
              </div>
            </div>
            <div className="rounded-xl bg-apex-800 ring-1 ring-white/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                Users
              </div>
              <div className="mt-0.5 text-lg font-semibold text-slate-100">
                {tenant.userCount}
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
                accent="bg-amber-500/15 text-amber-300 ring-amber-500/40"
              />
              <PlanBtn
                label="Paid"
                active={tenant.plan === 'paid'}
                onClick={() => handleSetPlan('paid')}
                disabled={busy === 'plan'}
                accent="bg-emerald-500/15 text-emerald-300 ring-emerald-500/40"
              />
              <PlanBtn
                label="Internal"
                active={tenant.plan === 'internal'}
                onClick={() => handleSetPlan('internal')}
                disabled={busy === 'plan'}
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
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
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

          {/* Delete */}
          <Section title="Danger zone" danger>
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
                className="mt-1 w-full rounded-xl border border-white/10 bg-apex-800 px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/60"
              />
            </label>
            <button
              onClick={handleDelete}
              disabled={busy === 'delete' || deleteConfirm !== tenant.id}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 active:scale-[0.99] transition disabled:opacity-40 disabled:cursor-not-allowed"
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
  accent,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium ring-1 transition disabled:opacity-50 ${
        active
          ? accent
          : 'bg-apex-800 text-slate-400 ring-white/10 hover:bg-white/10 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
