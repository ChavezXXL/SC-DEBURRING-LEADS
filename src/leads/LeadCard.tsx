import React, { useState } from 'react';
import type { Lead, LeadStatus, AiMode } from '../types';
import { LeadCardHeader } from './LeadCard/LeadCardHeader';
import { LeadCardActions } from './LeadCard/LeadCardActions';
import { LeadCardDetails } from './LeadCard/LeadCardDetails';
import { LeadCardNotes } from './LeadCard/LeadCardNotes';
import { LeadCardStatus } from './LeadCard/LeadCardStatus';
import { QuickEmail } from './LeadCard/QuickEmail';

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
  setReminder: (id: string, reminderDate: string | null) => void;
  onQueueOutreach?: (lead: Lead) => void;
  onMarkEmailed?: (lead: Lead) => void;
  onLogCall?: (lead: Lead) => void;
}

const LeadCardComponent: React.FC<LeadCardProps> = ({
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
  setReminder,
  onQueueOutreach,
  onMarkEmailed,
  onLogCall,
}) => {
  const isDead = lead.status === 'dead';
  const isOpen = openId === lead.id;
  const [showEmail, setShowEmail] = useState(false);

  return (
    <div
      id={`lead-${lead.id}`}
      className={`overflow-hidden rounded-2xl bg-apex-850 ring-1 ring-white/10 transition-all duration-200 hover:ring-white/20 hover:shadow-md hover:shadow-black/40 ${
        isDead ? 'opacity-50' : ''
      }`}
    >
      <LeadCardHeader lead={lead} isOpen={isOpen} setOpenId={setOpenId} />

      {isOpen && (
        <div className="border-t border-white/10 bg-apex-900/40 px-4 pb-4 pt-2">
          <LeadCardActions
            lead={lead}
            cp={cp}
            copy={copy}
            qs={qs}
            handleAI={handleAI}
            showEmail={showEmail}
            setShowEmail={setShowEmail}
            onQueueOutreach={onQueueOutreach}
            onMarkEmailed={onMarkEmailed}
            onLogCall={onLogCall}
          />
          {showEmail && (
            <QuickEmail
              lead={lead}
              onClose={() => setShowEmail(false)}
              onEmailSent={(id) => {
                setStatus(id, 'emailed');
              }}
            />
          )}
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

/**
 * With ~275 leads live, an un-memoized card list re-rendered every card on
 * every keystroke/filter toggle — the main source of scroll + typing jank.
 * This comparator skips re-rendering a card unless something it actually shows
 * changed: its own lead data, whether it's the open card, or (only while open)
 * the shared edit/copy state. Parent callbacks are stabilized in App.tsx.
 */
export const LeadCard = React.memo(LeadCardComponent, (prev, next) => {
  if (prev.lead !== next.lead) return false;
  const wasOpen = prev.openId === prev.lead.id;
  const isOpen = next.openId === next.lead.id;
  if (wasOpen !== isOpen) return false;
  // The open card (only ever one) always re-renders so it gets fresh callbacks
  // and edit/copy state. Collapsed cards — the other ~274 — skip the churn from
  // typing in search, filter toggles, and unrelated status flashes.
  return !isOpen;
});
