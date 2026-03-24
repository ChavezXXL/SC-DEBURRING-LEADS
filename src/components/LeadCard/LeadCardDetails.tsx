import React from 'react';
import type { Lead } from '../../types';

interface LeadCardDetailsProps {
  lead: Lead;
}

export const LeadCardDetails: React.FC<LeadCardDetailsProps> = ({ lead }) => {
  const hasPM = !!lead.pm;

  return (
    <div className="mb-4 grid grid-cols-1 gap-5 rounded-xl border border-zinc-800/50 bg-zinc-950/50 p-5 md:grid-cols-2">
      {hasPM && (
        <div className="col-span-1 md:col-span-2">
          <div className="mb-1 text-[11px] font-bold font-mono uppercase tracking-widest text-zinc-500">
            Purchasing Manager
          </div>
          <div className="text-xs font-semibold text-violet-400">
            {lead.pm} — {lead.pm_title}
          </div>
        </div>
      )}

      {lead.role && (
        <div>
          <div className="mb-1 text-[11px] font-bold font-mono uppercase tracking-widest text-zinc-500">
            Role / Contact
          </div>
          <div className="text-xs text-zinc-400">{lead.role}</div>
        </div>
      )}

      {lead.ph && (
        <div>
          <div className="mb-1 text-[11px] font-bold font-mono uppercase tracking-widest text-zinc-500">
            Phone
          </div>
          <div className="text-xs text-zinc-400">{lead.ph}</div>
        </div>
      )}

      {lead.em && (
        <div className="col-span-1 md:col-span-2">
          <div className="mb-1 text-[11px] font-bold font-mono uppercase tracking-widest text-zinc-500">
            Email Address
          </div>
          <div className="text-xs font-semibold text-violet-400">{lead.em}</div>
        </div>
      )}

      <div className="col-span-1 md:col-span-2">
        <div className="mb-1 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
          Parts and Programs
        </div>
        <div className="text-xs leading-relaxed text-zinc-400">{lead.parts}</div>
      </div>

      <div className="col-span-1 md:col-span-2">
        <div className="mb-1 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
          Pitch Angle
        </div>
        <div className="text-xs leading-relaxed text-amber-500">{lead.pitch}</div>
      </div>
    </div>
  );
};
