import { useCallback, useMemo, useState } from 'react';
import type { Lead, LeadStatus } from '../types';
import { STATUS } from '../data';
import { compareLeadScore } from '../utils/leadScore';

/**
 * Sort control for the Leads list. Applied AFTER filtering, BEFORE render.
 *
 * `default` returns the filtered list untouched so any ordering imposed upstream
 * by useLeadFilters (HOT 5 tier-order + top-5 truncation, reminders-by-date)
 * is preserved. Picking any explicit sort overrides that ordering.
 *
 * One memoized pass over the already-filtered (<=283-item) array keeps it snappy
 * and reuses the existing search debounce — collapsed cards stay memoized.
 */
export type SortKey =
  | 'default'
  | 'activity-desc'
  | 'activity-asc'
  | 'company-az'
  | 'score'
  | 'tier'
  | 'status';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Default order' },
  { key: 'activity-desc', label: 'Newest activity' },
  { key: 'activity-asc', label: 'Oldest activity' },
  { key: 'company-az', label: 'Company A–Z' },
  { key: 'score', label: 'Best opportunity' },
  { key: 'tier', label: 'Tier (T1 first)' },
  { key: 'status', label: 'Status (pipeline)' },
];

// Pipeline order for the "Status" sort: index into the STATUS array (new → …
// → client), so leads sort in the same order the status chips are laid out.
const STATUS_ORDER = new Map<LeadStatus, number>(STATUS.map((s, i) => [s.k, i]));

/** lastContactedAt as epoch ms; missing/invalid → NaN so callers can push last. */
function contactedMs(l: Lead): number {
  if (!l.lastContactedAt) return NaN;
  const t = new Date(l.lastContactedAt).getTime();
  return Number.isNaN(t) ? NaN : t;
}

function byCompany(a: Lead, b: Lead): number {
  return (a.co || '').localeCompare(b.co || '');
}

export function useLeadSort(filtered: Lead[]) {
  const [sortKey, setSortKey] = useState<SortKey>('default');

  const sorted = useMemo(() => {
    if (sortKey === 'default') return filtered;
    // Copy so we never mutate the memoized filtered array from useLeadFilters.
    const list = filtered.slice();

    switch (sortKey) {
      case 'activity-desc':
        list.sort((a, b) => {
          const am = contactedMs(a);
          const bm = contactedMs(b);
          // Undated always sorts last regardless of direction.
          if (Number.isNaN(am) && Number.isNaN(bm)) return byCompany(a, b);
          if (Number.isNaN(am)) return 1;
          if (Number.isNaN(bm)) return -1;
          return bm - am || byCompany(a, b);
        });
        break;
      case 'activity-asc':
        list.sort((a, b) => {
          const am = contactedMs(a);
          const bm = contactedMs(b);
          if (Number.isNaN(am) && Number.isNaN(bm)) return byCompany(a, b);
          if (Number.isNaN(am)) return 1;
          if (Number.isNaN(bm)) return -1;
          return am - bm || byCompany(a, b);
        });
        break;
      case 'company-az':
        list.sort(byCompany);
        break;
      case 'score':
        list.sort(compareLeadScore);
        break;
      case 'tier':
        list.sort((a, b) => a.t - b.t || byCompany(a, b));
        break;
      case 'status':
        list.sort((a, b) => {
          const ao = STATUS_ORDER.get(a.status) ?? 999;
          const bo = STATUS_ORDER.get(b.status) ?? 999;
          return ao - bo || byCompany(a, b);
        });
        break;
    }
    return list;
  }, [filtered, sortKey]);

  const onSortChange = useCallback((k: SortKey) => setSortKey(k), []);

  return { sortKey, onSortChange, sorted };
}
