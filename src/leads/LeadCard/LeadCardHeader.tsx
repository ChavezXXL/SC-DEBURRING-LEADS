import React from 'react';
import { ChevronDown, ChevronUp, User, MapPin } from 'lucide-react';
import type { Lead } from '../../types';
import { STATUS } from '../../data';
import { isHiringSignal } from '../useLeadFilters';

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
      className={`flex cursor-pointer items-center justify-between gap-4 border-l-4 px-5 py-4 ${
        isClient
          ? 'border-l-amber-500'
          : lead.t === 1
            ? 'border-l-orange-500'
            : 'border-l-transparent'
      }`}
      onClick={() => setOpenId(isOpen ? null : lead.id)}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-100 md:text-base">{lead.co}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
              lead.t === 1
                ? 'bg-orange-500/10 text-orange-300 ring-orange-500/30'
                : 'bg-blue-500/10 text-blue-300 ring-blue-500/30'
            }`}
          >
            {lead.t === 1 ? 'T1' : 'T2'}
          </span>
          {isHiringSignal(lead) && (
            <span
              className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold tracking-wide text-amber-300 ring-1 ring-amber-500/40"
              title="Notes show a hiring signal — they're overloaded on deburr/finishing right now"
            >
              HIRING
            </span>
          )}
          {hasPM && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
              PM
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          {hasPM ? (
            <span className="flex items-center gap-1 font-medium text-amber-300">
              <User size={12} /> {lead.pm} · {lead.pm_title}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-400">
              <User size={12} /> {lead.who}
            </span>
          )}
          <span className="flex items-center gap-1 text-slate-400">
            <MapPin size={12} /> {lead.city}
          </span>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{
            background: st.bg,
            color: st.tx,
            boxShadow: `inset 0 0 0 1px ${st.dot}4D`,
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
          {st.label}
        </span>
        <span className="text-slate-400">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </div>
    </div>
  );
};
