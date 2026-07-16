import React, { useState } from 'react';
import { Check } from 'lucide-react';
import type { Lead, LeadStatus } from '../types';
import { LeadCardHeader } from './LeadCard/LeadCardHeader';
import { LeadCardActions } from './LeadCard/LeadCardActions';
import { LeadCardDetails } from './LeadCard/LeadCardDetails';
import { LeadCardTimeline } from './LeadCard/LeadCardTimeline';
import { LeadCardFollowUp } from './LeadCard/LeadCardFollowUp';
import { LeadCardValue } from './LeadCard/LeadCardValue';
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
  cp: string | null;
  copy: (id: string, text: string) => void;
  qs: {
    google: (co: string) => string;
    linkedin: (co: string) => string;
    indeed: (city: string) => string;
  };
  setReminder: (id: string, reminderDate: string | null) => void;
  setValue: (id: string, value: number | null) => void;
  onMarkEmailed?: (lead: Lead) => void;
  onLogCall?: (lead: Lead) => void;
  /** Multi-select: this card's selected bit (a plain boolean derived from the
   *  selection Set — never a new object, so the memo comparator stays cheap). */
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  /** Mobile "Select" mode — reveals the checkbox on narrow screens. */
  selectionMode?: boolean;
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
  cp,
  copy,
  qs,
  setReminder,
  setValue,
  onMarkEmailed,
  onLogCall,
  selected = false,
  onToggleSelect,
  selectionMode = false,
}) => {
  const isDead = lead.status === 'dead';
  const isOpen = openId === lead.id;
  const [showEmail, setShowEmail] = useState(false);

  // The checkbox is only wired when the parent passes a toggle handler. It shows
  // always at >=sm; on mobile only while selection mode is on.
  const selectable = !!onToggleSelect;

  return (
    <div
      id={`lead-${lead.id}`}
      className={`overflow-hidden rounded-2xl bg-apex-850 ring-1 transition-all duration-200 hover:shadow-md hover:shadow-black/40 ${
        selected ? 'ring-apex-accent/60' : 'ring-white/10 hover:ring-white/20'
      } ${isDead ? 'opacity-50' : ''}`}
    >
      <div className="flex items-stretch">
        {selectable && (
          <label
            className={`shrink-0 cursor-pointer select-none items-center justify-center self-stretch pl-3 pr-1 ${
              selectionMode ? 'flex' : 'hidden sm:flex'
            }`}
            onClick={(e) => e.stopPropagation()}
            title={selected ? 'Deselect this lead' : 'Select this lead'}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={selected}
              onChange={() => onToggleSelect!(lead.id)}
              aria-label={`Select ${lead.co}`}
            />
            <span
              aria-hidden
              className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                selected
                  ? 'border-apex-accent bg-apex-accent text-white'
                  : 'border-white/20 bg-apex-800 text-transparent hover:border-white/40'
              }`}
            >
              <Check size={14} strokeWidth={3} />
            </span>
          </label>
        )}
        <div className="min-w-0 flex-1">
          <LeadCardHeader lead={lead} isOpen={isOpen} setOpenId={setOpenId} />
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-white/10 bg-apex-900/40 px-4 pb-4 pt-2 motion-safe:animate-panel-in">
          <LeadCardActions
            lead={lead}
            cp={cp}
            copy={copy}
            qs={qs}
            showEmail={showEmail}
            setShowEmail={setShowEmail}
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
          <LeadCardValue lead={lead} setValue={setValue} />
          <LeadCardFollowUp lead={lead} setReminder={setReminder} />
          <LeadCardTimeline lead={lead} />
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
 * changed: its own lead data, whether it's the open card, its own selected bit,
 * whether checkboxes are shown, or (only while open) the shared edit/copy state.
 * Parent callbacks are stabilized in App.tsx.
 */
export const LeadCard = React.memo(LeadCardComponent, (prev, next) => {
  if (prev.lead !== next.lead) return false;
  // Selection is per-id: only THIS card's boolean matters. Toggling one card
  // (or select-all) flips one bit here, so exactly the affected cards re-render
  // — the rest of the ~283-card list stays memoized. selectionMode changes
  // rarely (mobile toggle) and legitimately reveals/hides every checkbox.
  if (prev.selected !== next.selected) return false;
  if (prev.selectionMode !== next.selectionMode) return false;
  const wasOpen = prev.openId === prev.lead.id;
  const isOpen = next.openId === next.lead.id;
  if (wasOpen !== isOpen) return false;
  // The open card (only ever one) always re-renders so it gets fresh callbacks
  // and edit/copy state. Collapsed cards — the other ~274 — skip the churn from
  // typing in search, filter toggles, and unrelated status flashes.
  return !isOpen;
});
