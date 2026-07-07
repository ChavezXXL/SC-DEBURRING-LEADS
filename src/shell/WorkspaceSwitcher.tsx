import React, { useEffect, useRef, useState } from 'react';
import { ChevronsUpDown, Check, Building2, LayoutGrid, Loader2 } from 'lucide-react';
import { PLATFORM_WORKSPACE } from '../auth/useWorkspace';
import { useWorkspaceCtx } from '../auth/WorkspaceContext';

interface Props {
  workspaceId: string;
  onSelect: (id: string) => void;
}

/**
 * Super-admin workspace picker. Sits in the sidebar brand area and lets the
 * platform operator jump between the Platform Console (manage all clients) and
 * any individual client tenant (operate their leads). Only rendered for
 * super-admins — everyone else sees a static tenant chip.
 *
 * The client list comes from the workspace context (one shared fetch with the
 * ⌘K palette); opening the menu refreshes it so new clients appear.
 */
export function WorkspaceSwitcher({ workspaceId, onSelect }: Props) {
  const { tenantsDirectory: tenants, directoryLoading: loading, refreshDirectory } =
    useWorkspaceCtx();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Refresh the directory when the menu opens — cheap, and a just-created
  // client shows up without a page reload.
  useEffect(() => {
    if (open) refreshDirectory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside-click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isConsole = workspaceId === PLATFORM_WORKSPACE;
  const current = tenants.find((t) => t.id === workspaceId);
  const label = isConsole ? 'Platform Console' : current?.name || workspaceId || 'Select workspace';
  const sub = isConsole ? 'Apex Growth · all clients' : `${current?.leadCount ?? '—'} leads`;

  const choose = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg bg-white/5 ring-1 ring-white/10 px-2 py-1.5 text-left transition hover:bg-white/10"
        title="Switch workspace"
      >
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${
            isConsole ? 'bg-apex-accent/15 text-orange-300' : 'bg-white/10 text-slate-300'
          }`}
        >
          {isConsole ? <LayoutGrid size={13} /> : <Building2 size={13} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-semibold text-slate-100">{label}</span>
          <span className="block truncate text-[9px] text-slate-500">{sub}</span>
        </span>
        <ChevronsUpDown size={13} className="shrink-0 text-slate-500" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl bg-apex-850 ring-1 ring-white/10 shadow-xl shadow-black/50">
          <div className="px-2.5 pt-2 pb-1 text-[9px] uppercase tracking-widest text-slate-500">
            Platform
          </div>
          <MenuRow
            active={isConsole}
            icon={<LayoutGrid size={13} />}
            title="Platform Console"
            sub="Manage all client accounts"
            accent
            onClick={() => choose(PLATFORM_WORKSPACE)}
          />

          <div className="mt-1 border-t border-white/5 px-2.5 pt-2 pb-1 text-[9px] uppercase tracking-widest text-slate-500">
            Client workspaces
          </div>
          {loading && (
            <div className="flex items-center gap-2 px-2.5 py-2 text-[11px] text-slate-500">
              <Loader2 size={12} className="animate-spin" /> Loading clients…
            </div>
          )}
          {!loading && tenants.length === 0 && (
            <div className="px-2.5 py-2 text-[11px] text-slate-500">No client tenants yet.</div>
          )}
          <div className="max-h-64 overflow-y-auto pb-1">
            {tenants.map((t) => (
              <MenuRow
                key={t.id}
                active={t.id === workspaceId}
                icon={<Building2 size={13} />}
                title={t.name}
                sub={`${t.leadCount} leads · ${t.plan || 'trial'}`}
                onClick={() => choose(t.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuRow({
  active,
  icon,
  title,
  sub,
  accent,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  sub: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition hover:bg-white/5 ${
        active ? 'bg-white/5' : ''
      }`}
    >
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${
          accent ? 'bg-apex-accent/15 text-orange-300' : 'bg-white/10 text-slate-300'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium text-slate-100">{title}</span>
        <span className="block truncate text-[9px] text-slate-500">{sub}</span>
      </span>
      {active && <Check size={13} className="shrink-0 text-orange-300" />}
    </button>
  );
}
