import { useCallback } from 'react';
import { auth } from '../firebase';
import type { TenantStats } from '../types';
import { apiFetch } from '../services/api';

/**
 * Hook giving the Admin Panel typed wrappers around the /api/admin/* endpoints.
 * Each call attaches the current Firebase ID token so the server can verify
 * super-admin role before doing anything.
 *
 * All calls go through apiFetch, so an unconfigured server (function returning
 * the SPA's index.html) throws a typed ApiError('not-configured') instead of
 * JSON-parse garbage — callers can render the friendly setup callout.
 */
export function useAdminApi() {
  const getToken = useCallback(async (): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not signed in');
    return await user.getIdToken();
  }, []);

  const listTenants = useCallback(async (): Promise<TenantStats[]> => {
    const token = await getToken();
    const data = await apiFetch<{ tenants?: TenantStats[] }>('/api/admin/list-tenants', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data.tenants || [];
  }, [getToken]);

  const updateTenant = useCallback(
    async (args: {
      tenantId: string;
      disabled?: boolean;
      plan?: 'trial' | 'paid' | 'internal';
      name?: string;
      primaryColor?: string;
    }) => {
      const token = await getToken();
      return await apiFetch('/api/admin/update-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token, ...args }),
      });
    },
    [getToken],
  );

  const deleteTenant = useCallback(
    async (tenantId: string, confirm: string) => {
      const token = await getToken();
      return await apiFetch<{
        summary: { leadsDeleted: number; logsDeleted: number; usersDeleted: number };
      }>('/api/admin/delete-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token, tenantId, confirm }),
      });
    },
    [getToken],
  );

  const resetPassword = useCallback(
    async (targetUid: string) => {
      const token = await getToken();
      return await apiFetch<{ success: true; email: string; newPassword: string }>(
        '/api/admin/reset-password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token, targetUid }),
        },
      );
    },
    [getToken],
  );

  return { listTenants, updateTenant, deleteTenant, resetPassword };
}
