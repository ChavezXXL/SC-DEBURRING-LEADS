import React from 'react';
import { FileText } from 'lucide-react';
import type { Lead } from '../../types';

interface LeadCardNotesProps {
  lead: Lead;
  editId: string | null;
  setEditId: (id: string | null) => void;
  draft: string;
  setDraft: (draft: string) => void;
  saveNote: (id: string, notes: string) => void;
}

export const LeadCardNotes: React.FC<LeadCardNotesProps> = ({
  lead,
  editId,
  setEditId,
  draft,
  setDraft,
  saveNote,
}) => {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-1 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
        <FileText size={12} />
        Call Log / Notes
      </div>

      {editId === lead.id ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Log calls, follow-ups, who you spoke to, research found..."
            className="min-h-[100px] w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
          />
          <div className="flex gap-2">
            <button
              onClick={() => saveNote(lead.id, draft)}
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
            >
              Save
            </button>
            <button
              onClick={() => setEditId(null)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => {
            setEditId(lead.id);
            setDraft(lead.notes || '');
          }}
          className={`min-h-[44px] cursor-text whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed transition-colors hover:border-zinc-700 ${
            lead.notes ? 'text-zinc-300' : 'italic text-zinc-600'
          }`}
        >
          {lead.notes || 'Click to add notes...'}
        </div>
      )}
    </div>
  );
};
