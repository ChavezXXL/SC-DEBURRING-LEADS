import React from 'react';
import { Wrench, RefreshCw } from 'lucide-react';
import { NOT_CONFIGURED_MESSAGE } from '../services/api';

/**
 * The friendly "server not wired up yet" card. Shown wherever an /api/* call
 * came back as HTML or named the missing FIREBASE_SERVICE_ACCOUNT secret —
 * instead of "Unexpected token '<'" garbage. Amber, not red: it's a one-time
 * setup state, not a failure the user caused.
 */
export function ServerSetupCallout({
  onRetry,
  retrying,
}: {
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-500/30">
      <Wrench size={18} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-amber-200">
          One-time server setup needed
        </div>
        <p className="mt-1 text-xs leading-relaxed text-amber-300/90">
          {NOT_CONFIGURED_MESSAGE}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={retrying}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-200 ring-1 ring-amber-500/30 transition-colors hover:bg-amber-500/25 disabled:opacity-50"
          >
            <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} aria-hidden />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
