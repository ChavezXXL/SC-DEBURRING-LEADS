import React from 'react';

export function FancyLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`shrink-0 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="sc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="50%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
        <linearGradient id="sc-grad-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="100%" stopColor="#fca5a5" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      
      {/* Background Hexagon */}
      <path
        d="M50 5 L93.3 30 L93.3 70 L50 95 L6.7 70 L6.7 30 Z"
        fill="url(#sc-grad)"
        stroke="url(#sc-grad-light)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      
      {/* Inner Hexagon Outline */}
      <path
        d="M50 12 L87 33.5 L87 66.5 L50 88 L13 66.5 L13 33.5 Z"
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="1"
      />

      {/* Fancy 'S' */}
      <path
        d="M 45 35 C 45 25, 25 25, 25 35 C 25 45, 45 45, 45 55 C 45 65, 25 65, 25 55"
        fill="none"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
        filter="url(#glow)"
      />
      
      {/* Fancy 'C' */}
      <path
        d="M 75 35 C 60 25, 50 35, 50 50 C 50 65, 60 75, 75 65"
        fill="none"
        stroke="#ffedd5"
        strokeWidth="6"
        strokeLinecap="round"
        filter="url(#glow)"
      />
    </svg>
  );
}
