import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Lightweight multi-select layer for the Leads list.
 *
 * Selection is a Set<string> of lead ids. The key perf property: `isSelected`
 * is a single stable callback keyed on the Set, and each card only ever gets
 * its own boolean — so ticking one card re-renders one card, never the whole
 * ~283-card list (which stays memoized in LeadCard).
 *
 * `visibleIds` is the set of ids currently eligible to be selected (the active
 * FILTERED + sorted list). We prune any selected id that leaves that set so the
 * count never lies after a filter change or a bulk delete.
 */
export function useLeadSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  // Mobile: an explicit "Select" mode reveals the checkboxes (on desktop they
  // show on their own at >=sm, so this only matters on narrow screens).
  const [selectionMode, setSelectionMode] = useState(false);

  const visibleKey = useMemo(() => visibleIds.join('|'), [visibleIds]);

  // Drop selected ids that are no longer in the visible list (deleted / filtered
  // out). Only touch state when something actually changed to avoid churn.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(visibleIds);
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visible.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
    // visibleKey is the stable serialization of visibleIds.
  }, [visibleKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Select exactly the given ids (used by the header "select all filtered"). */
  const selectAll = useCallback((ids: string[]) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
    setSelectionMode(false);
  }, []);

  const count = selected.size;
  // "Select all" is checked only when every visible lead is selected (and there
  // is at least one). Partial selection drives the indeterminate state.
  const allSelected = visibleIds.length > 0 && count === visibleIds.length;
  const someSelected = count > 0 && !allSelected;

  return {
    selected,
    count,
    allSelected,
    someSelected,
    isSelected,
    toggle,
    selectAll,
    clear,
    selectionMode,
    setSelectionMode,
  };
}

export type LeadSelection = ReturnType<typeof useLeadSelection>;
