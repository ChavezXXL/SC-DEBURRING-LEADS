import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  Palette,
  RefreshCw,
} from 'lucide-react';
import type { AdminEvent } from '../types';
import { useAdminApi } from './useAdminApi';

/**
 * Platform activity feed — the audit trail. Every admin action lands here
 * (written server-side; clients can't forge or erase entries). Newest first.
 */
export function ActivityFeed() {
  const { listActivity } = useAdminApi();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    listActivity()
      .then(setEvents)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [listActivity]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="mt-6 rounded-2xl bg-apex-850 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-apex-accent" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
            Activity
          </span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          aria-label="Refresh activity"
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-300 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && events.length === 0 ? (
        <div className="space-y-3 p-4" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-white/5 motion-safe:animate-pulse" />
              <div className="h-3 flex-1 max-w-[70%] rounded bg-white/5 motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      ) : failed ? (
        <div className="px-4 py-6 text-center text-xs text-slate-500">
          Couldn't load activity.{' '}
          <button onClick={load} className="text-orange-400 hover:text-orange-300">
            Retry
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-slate-500">
          No activity yet — actions you take here (create a client, change a plan,
          reset a password) show up in this trail.
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {events.slice(0, 20).map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
              <EventIcon action={e.action} />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-200">
                  <span className="font-medium">{actionLabel(e.action)}</span>
                  {e.targetTenantId && (
                    <span className="ml-1.5 rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 ring-1 ring-white/10">
                      {e.targetTenantId}
                    </span>
                  )}
                </div>
                {e.detail && (
                  <div className="mt-0.5 truncate text-[11px] text-slate-500" title={e.detail}>
                    {e.detail}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] tabular-nums text-slate-500">{timeAgo(e.at)}</div>
                {e.actorEmail && (
                  <div
                    className="mt-0.5 max-w-[140px] truncate text-[9px] text-slate-600"
                    title={e.actorEmail}
                  >
                    {e.actorEmail}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EventIcon({ action }: { action: string }) {
  const base = 'grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1';
  if (action === 'client.created') {
    return (
      <span className={`${base} bg-emerald-500/10 text-emerald-300 ring-emerald-500/30`}>
        <Plus size={13} />
      </span>
    );
  }
  if (action === 'tenant.deleted') {
    return (
      <span className={`${base} bg-red-500/10 text-red-300 ring-red-500/30`}>
        <Trash2 size={13} />
      </span>
    );
  }
  if (action === 'password.reset') {
    return (
      <span className={`${base} bg-amber-500/10 text-amber-300 ring-amber-500/30`}>
        <KeyRound size={13} />
      </span>
    );
  }
  if (action === 'branding.updated') {
    return (
      <span className={`${base} bg-blue-500/10 text-blue-300 ring-blue-500/30`}>
        <Palette size={13} />
      </span>
    );
  }
  return (
    <span className={`${base} bg-white/5 text-slate-300 ring-white/10`}>
      <Pencil size={13} />
    </span>
  );
}

function actionLabel(action: string): string {
  switch (action) {
    case 'client.created':
      return 'Client created';
    case 'tenant.updated':
      return 'Tenant updated';
    case 'tenant.deleted':
      return 'Tenant deleted';
    case 'password.reset':
      return 'Password reset';
    case 'branding.updated':
      return 'Branding updated';
    default:
      return action;
  }
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
