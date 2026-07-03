import React from 'react';

/** Apex Growth platform mark (chrome peak on black). Full-res source lives
 * at /apex-mark.png; this uses the resized copy so it loads instantly. */
export function FancyLogo({ className = '' }: { className?: string }) {
  return (
    <img
      src="/icon-192.png"
      alt="Apex Growth"
      className={`shrink-0 rounded-xl object-cover ${className}`}
    />
  );
}
