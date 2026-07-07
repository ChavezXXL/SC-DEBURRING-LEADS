import React from 'react';

/**
 * Dark loading skeleton shown while a code-split tab chunk is fetched.
 * Matches the Apex system: apex-850 card surface, white/10 hairline, and a
 * slow orange-tinted shimmer sweep (motion-safe only, so reduced-motion users
 * get a static placeholder). Deliberately generic — it stands in for any tab
 * for the ~1 network frame it takes the chunk to arrive.
 */
export function TabSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-fade-in" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {/* Title block */}
      <div className="mb-6">
        <Shimmer className="h-7 w-48 rounded-lg" />
        <Shimmer className="mt-2 h-3 w-72 rounded" />
      </div>

      {/* Card stack */}
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl bg-apex-850 ring-1 ring-white/10 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Shimmer className="h-4 w-40 rounded" />
                <Shimmer className="mt-2 h-3 w-24 rounded" />
              </div>
              <Shimmer className="h-8 w-20 shrink-0 rounded-lg" />
            </div>
            <div className="mt-4 space-y-2">
              <Shimmer className="h-3 w-full rounded" />
              <Shimmer className="h-3 w-4/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A single shimmering bar. The moving highlight is a CSS gradient on a
 * pseudo-scale that sweeps left→right; falls back to a flat apex-800 fill
 * when the user prefers reduced motion.
 */
function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-apex-800 ${className}`}
    >
      <div className="absolute inset-0 motion-safe:animate-skeleton-sweep bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}
