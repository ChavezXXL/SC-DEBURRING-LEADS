import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Check,
  Sparkles,
  X,
  Menu,
} from 'lucide-react';
import type { Lead } from '../types';

interface SidebarProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  tab: 'leads' | 'outreach';
  setTab: (tab: 'leads' | 'outreach') => void;
  leads: Lead[];
  saved: boolean;
}

export function Sidebar({
  mobileMenuOpen,
  setMobileMenuOpen,
  tab,
  setTab,
  leads,
  saved,
}: SidebarProps) {
  const S = {
    total: leads.length,
    t1: leads.filter((l) => l.t === 1).length,
    withPM: leads.filter((l) => !!l.pm).length,
    active: leads.filter((l) => !['new', 'dead', 'client'].includes(l.status)).length,
    warm: leads.filter((l) => l.status === 'interested' || l.status === 'quote').length,
    clients: leads.filter((l) => l.status === 'client').length,
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-zinc-800/50 bg-zinc-950 md:bg-zinc-900/50 p-6 transition-transform duration-300 md:static md:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div>
        <div className="mb-8 hidden md:flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-lg font-bold text-white shadow-lg shadow-orange-500/20">
            SC
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-zinc-100">SC Deburring</div>
            <div className="mt-0.5 text-[10px] font-mono tracking-widest text-zinc-500">
              PROSPECT HQ
            </div>
          </div>
        </div>

        <nav className="mb-8 space-y-1">
          <button
            onClick={() => {
              setTab('leads');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold tracking-wide transition-colors ${
              tab === 'leads'
                ? 'bg-zinc-800/80 text-orange-500'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
            }`}
          >
            <LayoutDashboard size={16} />
            LEADS
            <span className="ml-auto rounded-full bg-zinc-950 px-2 py-0.5 text-[10px] font-mono text-zinc-500">
              {leads.length}
            </span>
          </button>

          <button
            onClick={() => {
              setTab('outreach');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold tracking-wide transition-colors ${
              tab === 'outreach'
                ? 'bg-zinc-800/80 text-orange-500'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
            }`}
          >
            <MessageSquare size={16} />
            OUTREACH
          </button>
        </nav>

        <div className="border-t border-zinc-800/50 pt-5">
          <div className="mb-4 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            Pipeline Status
          </div>

          <div className="space-y-3">
            {[
              { label: 'Total Leads', val: S.total, c: 'text-zinc-400' },
              { label: 'Tier 1 — Call Now', val: S.t1, c: 'text-orange-400' },
              { label: 'Named Contacts', val: S.withPM, c: 'text-emerald-400' },
              { label: 'In Pipeline', val: S.active, c: 'text-blue-400' },
              { label: 'Interested', val: S.warm, c: 'text-green-400' },
              { label: 'Clients', val: S.clients, c: 'text-amber-400' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">{stat.label}</span>
                <span className={`font-mono text-sm font-bold ${stat.c}`}>{stat.val}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 h-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-1000"
              style={{ width: `${Math.round((S.clients / Math.max(S.total, 1)) * 100)}%` }}
            />
          </div>
          <div className="mt-2 text-[10px] font-mono text-zinc-500">
            {Math.round((S.clients / Math.max(S.total, 1)) * 100)}% converted
          </div>
        </div>
      </div>

      <div>
        {saved && (
          <div className="mb-2 flex items-center gap-1 text-[10px] font-mono text-emerald-400">
            <Check size={12} />
            Saved
          </div>
        )}
        <div className="flex w-full items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-400">
          <Sparkles size={14} />
          Gemini AI Active
        </div>
      </div>
    </aside>
  );
}
