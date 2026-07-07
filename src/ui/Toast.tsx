import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { Check } from 'lucide-react';

/**
 * Apex toast system — one tiny context, zero deps.
 *
 * `const toast = useToast(); toast('Lead added');`
 *
 * Behavior:
 *   - bottom-center on mobile, bottom-right on desktop (floats above Bolt's FAB)
 *   - apex-850 panel with the standard white/10 hairline
 *   - auto-dismisses after ~2.5s, max 2 stacked (oldest drops first)
 *   - motion-safe slide+fade in; reduced-motion users get an instant appear
 */

type ToastFn = (message: string) => void;

interface ToastItem {
  id: number;
  message: string;
}

const TOAST_MS = 2500;
const MAX_STACK = 2;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback<ToastFn>((message) => {
    const id = ++seq.current;
    setToasts((prev) => [...prev, { id, message }].slice(-MAX_STACK));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_MS);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {/* bottom-24 clears the Bolt floating button (bottom-6 + 56px tall). */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex max-w-[92vw] items-center gap-2 rounded-xl bg-apex-850 px-4 py-2.5 text-sm text-slate-200 shadow-lg shadow-black/50 ring-1 ring-white/10 motion-safe:animate-toast-in sm:max-w-sm"
          >
            <Check size={14} className="shrink-0 text-emerald-400" aria-hidden />
            <span className="truncate" title={t.message}>
              {t.message}
            </span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
