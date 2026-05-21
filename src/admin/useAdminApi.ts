import { useCallback } from 'react';
import { auth } from '../firebase';
import type { TenantStats } from '../types';

/**
 * Hook giving the Admin Panel typed wrappers around the /api/admin/* endpoints.
 * Each call attaches the current Firebase ID token so the server can verify
 * super-admin role before doing anything.
 */
export function useAdminApi() {
  const getToken = useCallback(async (): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not signed in');
    return await user.getIdToken();
  }, []);

  const listTenants = useCallback(async (): Promise<TenantStats[]> => {
    const token = await getToken();
    const resp = await fetch('/api/admin/list-tenants', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || `Failed (${resp.status})`);
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
      const resp = await fetch('/api/admin/update-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token, ...args }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || `Failed (${resp.status})`);
      return data;
    },
    [getToken],
  );

  const deleteTenant = useCallback(
    async (tenantId: string, confirm: string) => {
      const token = await getToken();
      const resp = await fetch('/api/admin/delete-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token, tenantId, confirm }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || `Failed (${resp.status})`);
      return data;
    },
    [getToken],
  );

  const resetPassword = useCallback(
    async (targetUid: string) => {
      const token = await getToken();
      const resp = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token, targetUid }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || `Failed (${resp.status})`);
      return data as { success: true; email: string; newPassword: string };
    },
    [getToken],
  );

  return { listTenants, updateTenant, deleteTenant, resetPassword };
}
