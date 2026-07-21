import React, { useRef } from 'react';
import { FileText } from 'lucide-react';
import type { Lead } from '../../types';
import { renderMarkdown } from '../../utils/markdown';

interface LeadCardNotesProps {
  lead: Lead;
  editId: string | null;
  setEditId: (id: string | null) => void;
  draft: string;
  setDraft: (draft: string) => void;
  saveNote: (id: string, notes: string, baseline?: string) => void;
}

export const LeadCardNotes: React.FC<LeadCardNotesProps> = ({
  lead,
  editId,
  setEditId,
  draft,
  setDraft,
  saveNote,
}) => {
  // The notes value the editor was seeded from — lets saveNote tell which
  // activity stamps landed after editing started (so it won't clobber them).
  const baselineRef = useRef('');
  const beginEdit = () => {
    baselineRef.current = lead.notes || '';
    setEditId(lead.id);
    setDraft(lead.notes || '');
  };
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[10px] font-bold font-mono uppercase tracking-widest text-slate-500">
          <FileText size={12} />
          Call Log / Notes
        </div>
        {lead.notes && editId !== lead.id && (
          <button
            onClick={beginEdit}
            className="rounded px-2 py-0.5 text-[10px] font-mono text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
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
            className="min-h-[100px] w-full resize-y rounded-lg border border-white/10 bg-apex-800 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-apex-accent/60 focus:outline-none focus:ring-1 focus:ring-apex-accent/60"
          />
          <div className="flex gap-2">
            <button
              onClick={() => saveNote(lead.id, draft, baselineRef.current)}
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
            >
              Save
            </button>
            <button
              onClick={() => setEditId(null)}
              className="rounded-lg border border-white/10 bg-apex-800 px-4 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => {
            if (!lead.notes) beginEdit();
          }}
          className={`min-h-[44px] rounded-lg border border-white/10 bg-apex-800 p-4 text-xs leading-relaxed transition-colors ${
            lead.notes
              ? 'text-slate-300'
              : 'cursor-text italic text-slate-400 hover:border-white/20'
          }`}
        >
          {lead.notes ? renderMarkdown(lead.notes) : 'Click to add notes...'}
        </div>
      )}
    </div>
  );
};
