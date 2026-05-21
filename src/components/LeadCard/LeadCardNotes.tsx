import React from 'react';
import { FileText } from 'lucide-react';
import type { Lead } from '../../types';
import { renderMarkdown } from '../../utils/markdown';

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
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[10px] font-bold font-mono uppercase tracking-widest text-slate-400">
          <FileText size={12} />
          Call Log / Notes
        </div>
        {lead.notes && editId !== lead.id && (
          <button
            onClick={() => {
              setEditId(lead.id);
              setDraft(lead.notes || '');
            }}
            className="rounded px-2 py-0.5 text-[10px] font-mono text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
          >
            Edit
          </button>
        )}
      </div>

      {editId === lead.id ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Log calls, follow-ups, who you spoke to, research found..."
            className="min-h-[100px] w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
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
              className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => {
            if (!lead.notes) {
              setEditId(lead.id);
              setDraft(lead.notes || '');
            }
          }}
          className={`min-h-[44px] rounded-lg border border-slate-200 bg-white p-4 text-xs leading-relaxed transition-colors ${
            lead.notes
              ? 'text-slate-700'
              : 'cursor-text italic text-slate-300 hover:border-slate-300'
          }`}
        >
          {lead.notes ? renderMarkdown(lead.notes) : 'Click to add notes...'}
        </div>
      )}
    </div>
  );
};
