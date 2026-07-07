import { useCallback, useEffect, useState } from 'react';
import type { UserProfile } from '../types';

/**
 * Sentinel tenantId for the tenant-less Platform Console. A super-admin whose
 * home profile.tenantId is this value (or who selects "Platform Console" in the
 * switcher) operates Apex Growth itself — managing client tenants — rather than
 * being welded to any one client's leads.
 */
export const PLATFORM_WORKSPACE = '__platform__';

const LS_KEY = 'apx_active_workspace';

/**
 * Super-admin workspace switching.
 *
 * The core multi-tenant fix: a super-admin is NOT bound to a single tenant.
 * They can operate as any client tenant (seeing that tenant's leads/pipeline)
 * or sit in the Platform Console (no tenant data — just the admin surface).
 *
 * Non-super-admins are always pinned to their own tenant and never see the
 * switcher, so their experience is unchanged.
 *
 * Returns:
 *   workspaceId       — current selection: a tenantId, or PLATFORM_WORKSPACE
 *   effectiveTenantId — tenantId to scope data hooks to (undefined in console)
 *   isPlatformConsole — true when a super-admin is in the tenant-less console
 *   isSuperAdmin      — convenience flag
 *   setWorkspace      — switch workspace (persists to localStorage)
 */
export function useWorkspace(profile: UserProfile | null) {
  const isSuperAdmin = profile?.role === 'super-admin';
  const homeTenantId = profile?.tenantId || '';

  const [workspaceId, setWorkspaceId] = useState<string>(() => {
    if (!isSuperAdmin) return homeTenantId;
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) return saved;
    } catch {
      /* localStorage unavailable — fall through to default */
    }
    // Default: the super-admin's home tenant if it's a real one, else the
    // Platform Console (used by a platform admin with no client tenant).
    return homeTenantId && homeTenantId !== PLATFORM_WORKSPACE
      ? homeTenantId
      : PLATFORM_WORKSPACE;
  });

  // Profile can arrive AFTER first render — the provider mounts above AuthGate,
  // so on a page reload this hook initializes with profile=null and workspaceId
  // ''. Once the profile lands: pin non-super-admins to their tenant, and for
  // super-admins adopt the stored selection (or seed the default). Without the
  // stored-adoption branch a super-admin reload would sit at '' forever — no
  // workspace, no leads subscription, infinite loader.
  useEffect(() => {
    if (!profile) return;
    if (!isSuperAdmin) {
      if (homeTenantId && homeTenantId !== workspaceId) setWorkspaceId(homeTenantId);
      return;
    }
    if (workspaceId) return; // already resolved (init ran with the profile present)
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LS_KEY);
    } catch {
      /* ignore */
    }
    setWorkspaceId(
      stored ||
        (homeTenantId && homeTenantId !== PLATFORM_WORKSPACE
          ? homeTenantId
          : PLATFORM_WORKSPACE),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, isSuperAdmin, homeTenantId, workspaceId]);

  const setWorkspace = useCallback((id: string) => {
    setWorkspaceId(id);
    try {
      localStorage.setItem(LS_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const isPlatformConsole = isSuperAdmin && workspaceId === PLATFORM_WORKSPACE;
  const effectiveTenantId = isPlatformConsole ? undefined : workspaceId || undefined;

  return {
    workspaceId,
    effectiveTenantId,
    isPlatformConsole,
    isSuperAdmin,
    setWorkspace,
  };
}
