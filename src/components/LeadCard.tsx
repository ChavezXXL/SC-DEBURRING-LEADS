import React from 'react';
import type { Lead, LeadStatus, AiMode } from '../types';
import { LeadCardHeader } from './LeadCard/LeadCardHeader';
import { LeadCardActions } from './LeadCard/LeadCardActions';
import { LeadCardDetails } from './LeadCard/LeadCardDetails';
import { LeadCardNotes } from './LeadCard/LeadCardNotes';
import { LeadCardStatus } from './LeadCard/LeadCardStatus';

interface LeadCardProps {
  lead: Lead;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  editId: string | null;
  setEditId: (id: string | null) => void;
  draft: string;
  setDraft: (draft: string) => void;
  setStatus: (id: string, st: LeadStatus) => void;
  saveNote: (id: string, notes: string) => void;
  setDeleteModal: (modal: { id: string; co: string } | null) => void;
  handleAI: (lead: Lead, mode: AiMode) => void;
  cp: string | null;
  copy: (id: string, text: string) => void;
  qs: {
    google: (co: string) => string;
    linkedin: (co: string) => string;
    indeed: (city: string) => string;
  };
}

export const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  openId,
  setOpenId,
  editId,
  setEditId,
  draft,
  setDraft,
  setStatus,
  saveNote,
  setDeleteModal,
  handleAI,
  cp,
  copy,
  qs,
}) => {
  const isDead = lead.status === 'dead';
  const isOpen = openId === lead.id;

  return (
    <div
      className={`overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/40 transition-all duration-200 hover:border-zinc-700/80 hover:shadow-lg hover:shadow-black/20 ${
        isDead ? 'opacity-50' : ''
      }`}
    >
      <LeadCardHeader lead={lead} isOpen={isOpen} setOpenId={setOpenId} />

      {isOpen && (
        <div className="border-t border-zinc-800/50 bg-zinc-900/20 px-4 pb-4 pt-2">
          <LeadCardActions lead={lead} cp={cp} copy={copy} qs={qs} handleAI={handleAI} />
          <LeadCardDetails lead={lead} />
          <LeadCardNotes
            lead={lead}
            editId={editId}
            setEditId={setEditId}
            draft={draft}
            setDraft={setDraft}
            saveNote={saveNote}
          />
          <LeadCardStatus lead={lead} setStatus={setStatus} setDeleteModal={setDeleteModal} />
        </div>
      )}
    </div>
  );
};
