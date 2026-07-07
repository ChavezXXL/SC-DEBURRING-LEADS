import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { useWorkspace } from './useWorkspace';
import { useAdminApi } from '../admin/useAdminApi';
import type { Tenant, TenantStats } from '../types';

/**
 * WorkspaceContext — the single source of truth for "which workspace am I
 * operating right now."
 *
 * Wraps the useWorkspace selection hook and adds:
 *   activeTenant     — LIVE tenant doc for the current workspace (onSnapshot,
 *                      so a branding edit re-skins the app instantly). Null in
 *                      the Platform Console. Rules allow this read: owners can
 *                      read their own tenant, super-admins any tenant.
 *   tenantsDirectory — client list for super-admins (switcher + ⌘K palette
 *                      share ONE fetch instead of each fetching).
 *
 * Sits ABOVE TenantTheme in main.tsx so theming/title follow the active
 * workspace, not the login's home tenant.
 */

interface WorkspaceCtx {
  workspaceId: string;
  effectiveTenantId: string | undefined;
  isPlatformConsole: boolean;
  isSuperAdmin: boolean;
  setWorkspace: (id: string) => void;
  /** Live doc for the ACTIVE workspace's tenant (null in Platform Console). */
  activeTenant: Tenant | null;
  /** Super-admin only: all tenants w/ stats. Empty for everyone else. */
  tenantsDirectory: TenantStats[];
  directoryLoading: boolean;
  refreshDirectory: () => void;
}

const Ctx = createContext<WorkspaceCtx | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, profile, tenant: homeTenant } = useAuth();
  const ws = useWorkspace(profile);
  const { listTenants } = useAdminApi();

  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [tenantsDirectory, setTenantsDirectory] = useState<TenantStats[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);

  // Live subscription to the active workspace's tenant doc.
  useEffect(() => {
    if (!user || !ws.effectiveTenantId) {
      setActiveTenant(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'tenants', ws.effectiveTenantId),
      (snap) => setActiveTenant(snap.exists() ? (snap.data() as Tenant) : null),
      () => {
        // Read denied / offline — fall back to the home tenant doc if it's the
        // same workspace, else null. The app renders fine with a null tenant.
        setActiveTenant(
          homeTenant && homeTenant.id === ws.effectiveTenantId ? homeTenant : null,
        );
      },
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ws.effectiveTenantId]);

  // Client directory — super-admins only. One fetch shared by the sidebar
  // switcher and the command palette.
  const refreshDirectory = useCallback(() => {
    if (!user || !ws.isSuperAdmin) return;
    setDirectoryLoading(true);
    listTenants()
      .then(setTenantsDirectory)
      .catch(() => {
        /* not-configured/offline — switcher still offers Platform + home */
      })
      .finally(() => setDirectoryLoading(false));
  }, [user, ws.isSuperAdmin, listTenants]);

  useEffect(() => {
    refreshDirectory();
  }, [refreshDirectory]);

  const value: WorkspaceCtx = {
    workspaceId: ws.workspaceId,
    effectiveTenantId: ws.effectiveTenantId,
    isPlatformConsole: ws.isPlatformConsole,
    isSuperAdmin: ws.isSuperAdmin,
    setWorkspace: ws.setWorkspace,
    activeTenant,
    tenantsDirectory,
    directoryLoading,
    refreshDirectory,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspaceCtx(): WorkspaceCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorkspaceCtx must be used inside <WorkspaceProvider>');
  return ctx;
}
