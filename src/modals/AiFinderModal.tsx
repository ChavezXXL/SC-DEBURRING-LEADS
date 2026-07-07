import React, { useEffect } from 'react';
import { X, Sparkles, Loader2, Search } from 'lucide-react';

interface AiFinderModalProps {
  setShowAiFinder: (show: boolean) => void;
  aiFinderQuery: string;
  setAiFinderQuery: (query: string) => void;
  aiFinderLoading: boolean;
  handleFindLeads: () => void;
}

export const AiFinderModal: React.FC<AiFinderModalProps> = ({
  setShowAiFinder,
  aiFinderQuery,
  setAiFinderQuery,
  aiFinderLoading,
  handleFindLeads,
}) => {
  // Esc closes the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAiFinder(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setShowAiFinder]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => setShowAiFinder(false)}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-apex-850 p-6 shadow-2xl shadow-black/60 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-lg font-bold text-orange-400">
              <Sparkles size={20} /> AI Prospector
            </div>
            <div className="text-xs font-mono text-slate-400">
              Find new leads and add them to your database automatically.
            </div>
          </div>

          <button
            onClick={() => setShowAiFinder(false)}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
            Search Query
          </label>
          <textarea
            value={aiFinderQuery}
            onChange={(e) => setAiFinderQuery(e.target.value)}
            placeholder="e.g. Find 5 aerospace machine shops in San Diego that might need deburring services"
            className="min-h-[100px] w-full rounded-xl border border-white/10 bg-apex-800 p-4 text-sm text-slate-100 placeholder-slate-500 transition-all focus:border-apex-accent/60 focus:outline-none focus:ring-1 focus:ring-apex-accent/60"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowAiFinder(false)}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 transition-colors hover:text-slate-100"
          >
            Cancel
          </button>

          <button
            onClick={handleFindLeads}
            disabled={!aiFinderQuery.trim() || aiFinderLoading}
            className="flex items-center gap-2 rounded-xl bg-apex-accent px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-950/50 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
          >
            {aiFinderLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Searching...
              </>
            ) : (
              <>
                <Search size={16} /> Find Leads
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
