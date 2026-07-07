import { useEffect, useRef } from 'react';

/**
 * Dialog focus contract:
 *   - while `active`, move focus to the element you attach the returned ref to
 *     (first input, or a safe default button)
 *   - when the dialog closes, hand focus BACK to whatever opened it, so
 *     keyboard users never lose their place on the page.
 *
 * Works both for conditionally-mounted modals (active defaults to true, the
 * effect runs on mount/unmount) and always-mounted ones gated by an `open`
 * prop (pass it as `active`).
 */
export function useModalFocus<T extends HTMLElement>(active: boolean = true) {
  const initialFocusRef = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement as HTMLElement | null;
    // Let the dialog paint first, then focus its first field.
    const raf = requestAnimationFrame(() => initialFocusRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [active]);

  return initialFocusRef;
}
