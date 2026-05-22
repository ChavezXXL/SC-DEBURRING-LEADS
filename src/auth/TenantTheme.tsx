import React, { ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';

const DEFAULT_PRIMARY = '#2563eb'; // tailwind blue-600 — keeps SC Deburring on the default look

/**
 * TenantTheme — applies the current tenant's primary color as a CSS variable
 * (`--tenant-primary`) on the document root. Used by the sidebar accent bar
 * and a few other "their identity" touchpoints. Most of the UI stays neutral
 * slate so functional colors (red = delete, green = success) read the same
 * across all tenants.
 *
 * Also updates document.title to the tenant's business name when signed in.
 */
export function TenantTheme({ children }: { children: ReactNode }) {
  const { tenant } = useAuth();
  const primary = tenant?.primaryColor || DEFAULT_PRIMARY;

  useEffect(() => {
    document.documentElement.style.setProperty('--tenant-primary', primary);
    document.documentElement.style.setProperty(
      '--tenant-primary-soft',
      hexToRgba(primary, 0.1),
    );
    document.documentElement.style.setProperty(
      '--tenant-primary-ring',
      hexToRgba(primary, 0.25),
    );
  }, [primary]);

  useEffect(() => {
    if (tenant?.name) {
      document.title = `${tenant.name} CRM`;
    }
  }, [tenant?.name]);

  return <>{children}</>;
}

/** Convert "#RRGGBB" to "rgba(r,g,b,alpha)". Falls back to the default on parse fail. */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(37, 99, 235, ${alpha})`; // fallback to blue-600
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
