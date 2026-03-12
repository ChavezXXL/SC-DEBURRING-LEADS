import React from 'react';
import { ChevronDown, ChevronUp, User, MapPin } from 'lucide-react';
import type { Lead } from '../../types';
import { STATUS } from '../../data';

interface LeadCardHeaderProps {
  lead: Lead;
  isOpen: boolean;
  setOpenId: (id: string | null) => void;
}

export const LeadCardHeader: React.FC<LeadCardHeaderProps> = ({ lead, isOpen, setOpenId }) => {
  const st = STATUS.find((s) => s.k === lead.status) || STATUS[0];
  const isClient = lead.status === 'client';
  const hasPM = !!lead.pm;

  return (
    <div
      className={`flex cursor-pointer items-center justify-between gap-4 border-l-4 p-4 ${
        isClient
          ? 'border-l-amber-500'
          : lead.t === 1
            ? 'border-l-orange-500'
            : 'border-l-zinc-800'
      }`}
      onClick={() => setOpenId(isOpen ? null : lead.id)}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-zinc-100">{lead.co}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold font-mono ${
              lead.t === 1
                ? 'bg-orange-500/10 text-orange-500'
                : 'bg-blue-500/10 text-blue-400'
            }`}
          >
            {lead.t === 1 ? 'T1' : 'T2'}
          </span>
          {hasPM && (
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold font-mono text-amber-500">
              PM
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          {hasPM ? (
            <span className="flex items-center gap-1 font-medium text-amber-500">
              <User size={12} /> {lead.pm} · {lead.pm_title}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-zinc-500">
              <User size={12} /> {lead.who}
            </span>
          )}
          <span className="flex items-center gap-1 text-zinc-600">
            <MapPin size={12} /> {lead.city}
          </span>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{ background: st.bg, color: st.tx }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
          {st.label}
        </span>
        <span className="text-zinc-600">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </div>
    </div>
  );
};
