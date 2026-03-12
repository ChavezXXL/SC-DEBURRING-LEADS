import React from 'react';
import { Trash2 } from 'lucide-react';
import type { Lead, LeadStatus } from '../../types';
import { STATUS } from '../../data';

interface LeadCardStatusProps {
  lead: Lead;
  setStatus: (id: string, st: LeadStatus) => void;
  setDeleteModal: (modal: { id: string; co: string } | null) => void;
}

export const LeadCardStatus: React.FC<LeadCardStatusProps> = ({
  lead,
  setStatus,
  setDeleteModal,
}) => {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
          Update Status
        </div>
        <button
          onClick={() => setDeleteModal({ id: lead.id, co: lead.co })}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold font-mono uppercase tracking-widest text-red-500/70 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 size={12} />
          Delete Lead
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {STATUS.map((statusOption) => (
          <button
            key={statusOption.k}
            onClick={() => setStatus(lead.id, statusOption.k)}
            className="rounded-full border px-3 py-1 text-[11px] font-medium transition-all duration-200"
            style={{
              background:
                lead.status === statusOption.k
                  ? statusOption.dot
                  : statusOption.bg,
              color: lead.status === statusOption.k ? '#fff' : statusOption.tx,
              borderColor: `${statusOption.dot}40`,
            }}
          >
            {statusOption.label}
          </button>
        ))}
      </div>
    </div>
  );
};
