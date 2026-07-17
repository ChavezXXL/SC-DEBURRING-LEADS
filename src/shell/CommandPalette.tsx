import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Building2,
  LayoutGrid,
  ListTodo,
  LayoutDashboard,
  Kanban,
  MessageSquare,
  Shield,
  Settings as SettingsIcon,
  Plus,
  Download,
  Upload,
  Route,
  SearchCheck,
  CornerDownLeft,
} from 'lucide-react';
import type { Lead, TabKey } from '../types';
import { STATUS } from '../data';
import { PLATFORM_WORKSPACE } from '../auth/useWorkspace';
import { useWorkspaceCtx } from '../auth/WorkspaceContext';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  leads: Lead[];
  onJumpToLead: (id: string) => void;
  onNavigate: (tab: TabKey) => void;
  onAddLead: () => void;
  onImport: () => void;
  onExport: () => void;
  onSelectWorkspace: (id: string) => void;
  role?: 'super-admin' | 'owner' | 'member';
}

interface Item {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  run: () => void;
}

/**
 * ⌘K command palette — search leads, jump tabs, fire quick actions, and (for
 * the super-admin) switch workspaces, all from one input. Opens with Cmd/Ctrl+K
 * on desktop or the search button in the headers on mobile.
 */
export function CommandPalette({
  open,
  onClose,
  leads,
  onJumpToLead,
  onNavigate,
  onAddLead,
  onImport,
  onExport,
  onSelectWorkspace,
  role,
}: CommandPaletteProps) {
  const { isSuperAdmin, tenantsDirectory, workspaceId } = useWorkspaceCtx();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fresh state each open; focus the input once mounted.
  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const query = q.trim().toLowerCase();
    const match = (s: string | undefined) => !!s && s.toLowerCase().includes(query);
    const out: Item[] = [];

    // — Leads (only when typing — the empty palette shows commands) —
    if (query) {
      const scored = leads
        .map((l) => {
          const co = (l.co || '').toLowerCase();
          let score = -1;
          if (co.startsWith(query)) score = 0;
          else if (co.includes(query)) score = 1;
          else if (match(l.city) || match(l.pm) || match(l.who) || match(l.em)) score = 2;
          return { l, score };
        })
        .filter((x) => x.score >= 0)
        .sort((a, b) => a.score - b.score)
        .slice(0, 8);
      for (const { l } of scored) {
        const st = STATUS.find((s) => s.k === l.status);
        out.push({
          id: `lead-${l.id}`,
          group: 'Leads',
          label: l.co,
          sub: [l.city, st?.label].filter(Boolean).join(' · '),
          icon: <Building2 size={15} />,
          run: () => onJumpToLead(l.id),
        });
      }
    }

    // — Actions —
    const actions: Item[] = [
      {
        id: 'act-add',
        group: 'Actions',
        label: 'Add lead',
        icon: <Plus size={15} />,
        run: onAddLead,
      },
      {
        id: 'act-import',
        group: 'Actions',
        label: 'Import leads (CSV)',
        icon: <Upload size={15} />,
        run: onImport,
      },
      {
        id: 'act-export',
        group: 'Actions',
        label: 'Export leads (CSV)',
        icon: <Download size={15} />,
        run: onExport,
      },
    ];

    // — Navigate —
    const navDefs: Array<{ key: TabKey; label: string; icon: React.ReactNode; roles?: string[] }> = [
      { key: 'today', label: 'Go to Today', icon: <ListTodo size={15} /> },
      { key: 'leads', label: 'Go to Leads', icon: <LayoutDashboard size={15} /> },
      { key: 'field-route', label: 'Go to Field Route', icon: <Route size={15} /> },
      {
        key: 'research',
        label: 'Go to Research Queue',
        icon: <SearchCheck size={15} />,
        roles: ['owner', 'super-admin'],
      },
      { key: 'pipeline', label: 'Go to Pipeline', icon: <Kanban size={15} /> },
      { key: 'outreach', label: 'Go to Outreach', icon: <MessageSquare size={15} /> },
      {
        key: 'settings',
        label: 'Go to Settings',
        icon: <SettingsIcon size={15} />,
        roles: ['owner', 'super-admin'],
      },
      { key: 'admin', label: 'Go to Admin', icon: <Shield size={15} />, roles: ['super-admin'] },
    ];
    const nav: Item[] = navDefs
      .filter((d) => !d.roles || (role && d.roles.includes(role)))
      .map((d) => ({
        id: `nav-${d.key}`,
        group: 'Navigate',
        label: d.label,
        icon: d.icon,
        run: () => onNavigate(d.key),
      }));

    // — Workspaces (super-admin) —
    const workspaces: Item[] = [];
    if (isSuperAdmin) {
      if (workspaceId !== PLATFORM_WORKSPACE) {
        workspaces.push({
          id: 'ws-platform',
          group: 'Workspaces',
          label: 'Platform Console',
          sub: 'Manage all clients',
          icon: <LayoutGrid size={15} />,
          run: () => onSelectWorkspace(PLATFORM_WORKSPACE),
        });
      }
      for (const t of tenantsDirectory) {
        if (t.id === workspaceId) continue;
        workspaces.push({
          id: `ws-${t.id}`,
          group: 'Workspaces',
          label: `Open ${t.name}`,
          sub: `${t.leadCount} leads`,
          icon: <Building2 size={15} />,
          run: () => onSelectWorkspace(t.id),
        });
      }
    }

    const staticItems = [...actions, ...nav, ...workspaces].filter(
      (i) => !query || i.label.toLowerCase().includes(query) || match(i.sub),
    );
    return [...out, ...staticItems];
  }, [
    q,
    leads,
    role,
    isSuperAdmin,
    tenantsDirectory,
    workspaceId,
    onJumpToLead,
    onNavigate,
    onAddLead,
    onImport,
    onExport,
    onSelectWorkspace,
  ]);

  // Clamp/reset the highlight as the result set changes.
  useEffect(() => {
    setIdx((i) => Math.min(i, Math.max(items.length - 1, 0)));
  }, [items.length]);

  // Keep the highlighted row in view while arrowing.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  if (!open) return null;

  const runItem = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runItem(items[idx]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm motion-safe:animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-apex-850 shadow-2xl shadow-black/60 ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search size={16} className="shrink-0 text-slate-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search leads, actions, workspaces…"
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            aria-label="Search"
          />
          <kbd className="hidden shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-white/10 sm:block">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto py-1.5">
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              Nothing matches "{q}".
            </div>
          )}
          {items.map((item, i) => {
            const header =
              item.group !== lastGroup ? (
                <div
                  key={`h-${item.group}`}
                  className="px-4 pb-1 pt-2.5 text-[9px] uppercase tracking-widest text-slate-500"
                >
                  {item.group}
                </div>
              ) : null;
            lastGroup = item.group;
            const active = i === idx;
            return (
              <React.Fragment key={item.id}>
                {header}
                <button
                  data-idx={i}
                  onClick={() => runItem(item)}
                  onMouseMove={() => setIdx(i)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                    active ? 'bg-white/5' : ''
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                      active
                        ? 'bg-apex-accent/15 text-orange-300'
                        : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-100">{item.label}</span>
                    {item.sub && (
                      <span className="block truncate text-[10px] text-slate-500">{item.sub}</span>
                    )}
                  </span>
                  {active && <CornerDownLeft size={13} className="shrink-0 text-slate-500" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2 text-[10px] text-slate-500">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span className="ml-auto">Apex Growth</span>
        </div>
      </div>
    </div>
  );
}
