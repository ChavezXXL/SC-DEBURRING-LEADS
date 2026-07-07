import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield,
  Users,
  Database,
  TrendingUp,
  Plus,
  Search,
  Loader2,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import type { TenantStats } from '../types';
import { useAdminApi } from './useAdminApi';
import { TenantDetailDrawer } from './TenantDetailDrawer';
import { CreateAccountModal } from '../modals/CreateAccountModal';

/**
 * Admin Panel — visible only when the logged-in user is `super-admin`.
 * Lists every tenant in the system, lets the super-admin click in to manage
 * them (disable, change plan, delete, reset password), and create new ones.
 */
export function AdminPanel() {
  const { listTenants } = useAdminApi();
  const [tenants, setTenants] = useState<TenantStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<TenantStats | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listTenants();
      setTenants(list);
    } catch (e: any) {
      setError(e?.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const totalLeads = tenants.reduce((acc, t) => acc + (t.leadCount || 0), 0);
    const active = tenants.filter((t) => !t.disabled).length;
    const trial = tenants.filter((t) => t.plan === 'trial').length;
    const paid = tenants.filter((t) => t.plan === 'paid').length;
    const monthCutoff = new Date();
    monthCutoff.setMonth(monthCutoff.getMonth() - 1);
    const newThisMonth = tenants.filter(
      (t) => t.createdAt && new Date(t.createdAt) >= monthCutoff,
    ).length;
    return { total: tenants.length, active, trial, paid, totalLeads, newThisMonth };
  }, [tenants]);

  const filtered = q.trim()
    ? tenants.filter((t) => {
        const lq = q.toLowerCase();
        return (
          (t.name || '').toLowerCase().includes(lq) ||
          (t.ownerEmail || '').toLowerCase().includes(lq) ||
          (t.id || '').toLowerCase().includes(lq)
        );
      })
    : tenants;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Shield size={20} className="text-apex-accent" />
            <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
              Admin
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Every tenant on the platform — create accounts, change plans, disable, delete.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-apex-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-950/50 transition hover:brightness-110 active:scale-[0.99]"
        >
          <Plus size={16} />
          New client account
        </button>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={<Users size={14} />}
          label="Total tenants"
          value={stats.total}
          sub={`${stats.active} active`}
          accent="text-blue-400"
        />
        <StatCard
          icon={<TrendingUp size={14} />}
          label="Paid plans"
          value={stats.paid}
          sub={`${stats.trial} on trial`}
          accent="text-emerald-400"
        />
        <StatCard
          icon={<Database size={14} />}
          label="Leads across system"
          value={stats.totalLeads}
          accent="text-slate-200"
        />
        <StatCard
          icon={<Plus size={14} />}
          label="New this month"
          value={stats.newThisMonth}
          accent="text-amber-400"
        />
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          size={16}
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by company, owner email, or slug…"
          className="w-full rounded-2xl bg-apex-850 px-9 py-2.5 text-sm text-slate-100 placeholder-slate-500 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-apex-accent/60"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-red-500/10 ring-1 ring-red-500/30 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Couldn't load tenants</div>
            <div className="mt-0.5 text-xs opacity-80">{error}</div>
            <div className="mt-2 text-xs">
              Common cause: the Cloudflare Pages env var
              <code className="px-1 mx-1 rounded bg-red-500/20 text-red-200">
                FIREBASE_SERVICE_ACCOUNT
              </code>
              isn't set. See the deploy README.
            </div>
          </div>
        </div>
      )}

      {/* Tenant table */}
      <div className="overflow-hidden rounded-2xl bg-apex-850 ring-1 ring-white/10">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-slate-400" size={20} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            {q ? 'No tenants match your search.' : 'No tenants yet. Click "New client account" to create the first one.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-slate-500">
                <th className="px-4 py-3 text-left font-medium">Business</th>
                <th className="px-4 py-3 text-left font-medium">Owner</th>
                <th className="px-4 py-3 text-left font-medium">Plan</th>
                <th className="px-4 py-3 text-right font-medium">Leads</th>
                <th className="px-4 py-3 text-right font-medium">Users</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className="cursor-pointer border-b border-white/5 last:border-b-0 hover:bg-white/5 transition"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-100">{t.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{t.id}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{t.ownerEmail}</td>
                  <td className="px-4 py-3">
                    <PlanBadge plan={t.plan} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">
                    {t.leadCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">
                    {t.userCount}
                  </td>
                  <td className="px-4 py-3">
                    {t.disabled ? (
                      <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-300 ring-1 ring-red-500/30">
                        Disabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight size={14} className="ml-auto text-slate-500" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      <TenantDetailDrawer
        tenant={selected}
        onClose={() => setSelected(null)}
        onChanged={refresh}
      />

      {/* Create modal */}
      <CreateAccountModal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          void refresh();
        }}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl bg-apex-850 ring-1 ring-white/10 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500 font-medium">
        <span className={accent}>{icon}</span>
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${accent}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

function PlanBadge({ plan }: { plan?: string }) {
  if (plan === 'paid') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
        Paid
      </span>
    );
  }
  if (plan === 'internal') {
    return (
      <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-300 ring-1 ring-white/15">
        Internal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-amber-500/30">
      Trial
    </span>
  );
}
