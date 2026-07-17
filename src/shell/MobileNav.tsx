import React from 'react';
import {
  ListTodo,
  LayoutDashboard,
  Kanban,
  Route,
  MessageSquare,
  Shield,
  Settings as SettingsIcon,
} from 'lucide-react';
import type { TabKey } from '../types';

interface MobileNavProps {
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  role?: 'super-admin' | 'owner' | 'member';
  /** Leads with a reminder due today or earlier — shows as a badge on Today. */
  dueCount?: number;
  /** Slide the bar away while the drawer menu is open. */
  hidden?: boolean;
}

/**
 * Bottom tab bar — phones only (md:hidden). The four money screens plus the
 * role's power tab, Apple-style: icon + tiny label, molten-orange active
 * state, safe-area padding for gesture-nav iPhones. The hamburger drawer stays
 * for everything else (pipeline stats, sign-out, workspace switcher).
 */
export function MobileNav({ tab, setTab, role, dueCount = 0, hidden }: MobileNavProps) {
  const items: Array<{
    key: TabKey;
    label: string;
    Icon: React.ComponentType<{ size?: number }>;
    badge?: number;
  }> = [
    { key: 'today', label: 'Today', Icon: ListTodo, badge: dueCount },
    { key: 'leads', label: 'Leads', Icon: LayoutDashboard },
    { key: 'field-route', label: 'Route', Icon: Route },
    { key: 'pipeline', label: 'Pipeline', Icon: Kanban },
  ];
  if (role === 'super-admin') {
    items.push({ key: 'admin', label: 'Admin', Icon: Shield });
    items.push({ key: 'settings', label: 'Settings', Icon: SettingsIcon });
  } else if (role === 'owner') {
    items.push({ key: 'outreach', label: 'Outreach', Icon: MessageSquare });
    items.push({ key: 'settings', label: 'Settings', Icon: SettingsIcon });
  } else {
    items.push({ key: 'outreach', label: 'Outreach', Icon: MessageSquare });
  }

  return (
    <nav
      aria-label="Primary"
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-apex-900/95 backdrop-blur-xl transition-transform duration-300 md:hidden ${
        hidden ? 'translate-y-full' : 'translate-y-0'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch justify-around px-2">
        {items.map(({ key, label, Icon, badge }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 transition-colors ${
                active ? 'text-orange-400' : 'text-slate-500 active:text-slate-300'
              }`}
            >
              <span className="relative">
                <Icon size={20} />
                {typeof badge === 'number' && badge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 grid min-w-[16px] place-items-center rounded-full bg-apex-accent px-1 text-[9px] font-bold leading-4 text-white ring-2 ring-apex-900">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
