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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={() => setShowAiFinder(false)}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/20 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-lg font-bold text-orange-500">
              <Sparkles size={20} /> AI Prospector
            </div>
            <div className="text-xs font-mono text-slate-400">
              Find new leads and add them to your database automatically.
            </div>
          </div>

          <button
            onClick={() => setShowAiFinder(false)}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Search Query
          </label>
          <textarea
            value={aiFinderQuery}
            onChange={(e) => setAiFinderQuery(e.target.value)}
            placeholder="e.g. Find 5 aerospace machine shops in San Diego that might need deburring services"
            className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 transition-all focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowAiFinder(false)}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:text-slate-800"
          >
            Cancel
          </button>

          <button
            onClick={handleFindLeads}
            disabled={!aiFinderQuery.trim() || aiFinderLoading}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
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
