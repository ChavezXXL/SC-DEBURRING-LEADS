import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Check,
  Sparkles,
  Kanban,
  Brain,
  Zap,
  LogOut,
  Shield,
} from 'lucide-react';
import type { Lead, TabKey, Tenant, UserProfile } from '../types';
import { FancyLogo } from './FancyLogo';

interface SidebarProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  leads: Lead[];
  saved: boolean;
  onPipelineClick?: (filterType: string) => void;
  // Multi-tenant: shown at bottom of sidebar
  tenant?: Tenant | null;
  profile?: UserProfile | null;
  onSignOut?: () => void;
  onCreateAccount?: () => void; // super-admin only
}

/**
 * iOS-style sidebar.
 * Light background, soft rounded corners, subtle slate dividers, blue accents.
 */
export function Sidebar({
  mobileMenuOpen,
  setMobileMenuOpen,
  tab,
  setTab,
  leads,
  saved,
  onPipelineClick,
  tenant,
  profile,
  onSignOut,
  onCreateAccount,
}: SidebarProps) {
  const S = {
    total: leads.length,
    t1: leads.filter((l) => l.t === 1).length,
    withPM: leads.filter((l) => !!l.pm).length,
    active: leads.filter((l) => !['new', 'dead', 'client'].includes(l.status)).length,
    warm: leads.filter((l) => l.status === 'interested' || l.status === 'quote').length,
    clients: leads.filter((l) => l.status === 'client').length,
  };

  const navItem = (
    key: TabKey,
    label: string,
    Icon: React.ComponentType<{ size?: number }>,
    badge?: number,
  ) => {
    const active = tab === key;
    return (
      <button
        onClick={() => {
          setTab(key);
          setMobileMenuOpen(false);
        }}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
          active
            ? 'bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <Icon size={16} />
        <span>{label}</span>
        {typeof badge === 'number' && (
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${
              active
                ? 'bg-blue-500/15 text-blue-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto bg-white/90 backdrop-blur-xl ring-1 ring-slate-200/70 p-5 transition-transform duration-300 md:static md:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div>
        {/* Brand */}
        <div className="mb-7 hidden items-center gap-3 md:flex">
          <FancyLogo className="h-10 w-10" />
          <div>
            <div className="text-sm font-semibold tracking-tight text-slate-900">
              {tenant?.name || 'SC Deburring'}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-400">
              CRM
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="mb-8 space-y-1">
          {navItem('leads', 'Leads', LayoutDashboard, leads.length)}
          {navItem('outreach', 'Outreach', MessageSquare)}
          {navItem('pipeline', 'Pipeline', Kanban)}
          {navItem('brain', 'AI Brain', Brain)}
          {navItem('autopilot', 'Autopilot', Zap)}
          {profile?.role === 'super-admin' && navItem('admin', 'Admin', Shield)}
        </nav>

        {/* Pipeline status */}
        <div className="border-t border-slate-200/70 pt-5">
          <div className="mb-3 text-[10px] uppercase tracking-widest text-slate-400 font-medium">
            Pipeline
          </div>

          <div className="space-y-1">
            {[
              { label: 'Total Leads', val: S.total, c: 'text-slate-700', id: 'total' },
              { label: 'Tier 1 — Call Now', val: S.t1, c: 'text-orange-600', id: 't1' },
              { label: 'Named Contacts', val: S.withPM, c: 'text-emerald-600', id: 'pm' },
              { label: 'In Pipeline', val: S.active, c: 'text-blue-600', id: 'active' },
              { label: 'Interested', val: S.warm, c: 'text-green-600', id: 'warm' },
              { label: 'Clients', val: S.clients, c: 'text-amber-600', id: 'clients' },
            ].map((stat) => (
              <div
                key={stat.label}
                onClick={() => onPipelineClick?.(stat.id)}
                className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100"
              >
                <span className="text-xs text-slate-500">{stat.label}</span>
                <span className={`text-sm font-semibold ${stat.c}`}>{stat.val}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-1000"
              style={{ width: `${Math.round((S.clients / Math.max(S.total, 1)) * 100)}%` }}
            />
          </div>

          <div className="mt-2 text-[10px] text-slate-400">
            {Math.round((S.clients / Math.max(S.total, 1)) * 100)}% converted
          </div>
        </div>
      </div>

      {/* Footer: tenant + user + sign-out */}
      <div className="mt-6 space-y-3">
        {saved && (
          <div className="flex items-center gap-1 text-[11px] text-emerald-600">
            <Check size={12} />
            Saved
          </div>
        )}

        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 ring-1 ring-emerald-200/60 px-3 py-2 text-xs font-medium text-emerald-700">
          <Sparkles size={14} />
          Gemini AI Active
        </div>

        {/* Create-account button now lives inside the Admin tab. */}

        {profile && (
          <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200/70 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-slate-900">
                  {profile.email}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                  {profile.role === 'super-admin' ? 'Super Admin' : profile.role}
                </div>
              </div>
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 transition"
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
