import React from 'react';
import { X, Sparkles, Microscope, Loader2 } from 'lucide-react';
import type { Lead, AiMode } from '../types';

interface AiModalProps {
  aiModal: { lead: Lead; mode: AiMode };
  setAiModal: (modal: { lead: Lead; mode: AiMode } | null) => void;
  aiLoading: boolean;
  aiText: string;
  cp: string | null;
  copy: (id: string, text: string) => void;
  saveNote: (id: string, notes: string) => void;
}

export const AiModal: React.FC<AiModalProps> = ({
  aiModal,
  setAiModal,
  aiLoading,
  aiText,
  cp,
  copy,
  saveNote,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={() => setAiModal(null)}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-lg font-bold text-orange-500">
              {aiModal.mode === 'pitch' ? (
                <>
                  <Sparkles size={20} /> AI Pitch Generator
                </>
              ) : (
                <>
                  <Microscope size={20} /> Research Contact
                </>
              )}
            </div>
            <div className="text-xs font-mono text-zinc-500">
              {aiModal.lead.co} · {aiModal.lead.pm || aiModal.lead.who} · {aiModal.lead.city}
            </div>
          </div>

          <button onClick={() => setAiModal(null)} className="text-zinc-500 transition-colors hover:text-zinc-300">
            <X size={24} />
          </button>
        </div>

        {aiLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <Loader2 size={32} className="animate-spin text-orange-500" />
            <div className="text-xs font-mono text-zinc-500">
              {aiModal.mode === 'pitch' ? 'Generating personalized pitch...' : 'Researching contact info...'}
            </div>
          </div>
        ) : (
          <>
            <pre className="mb-5 whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 p-5 font-mono text-xs leading-relaxed text-zinc-300">
              {aiText}
            </pre>

            <div className="flex gap-3">
              <button
                onClick={() => copy('ai', aiText)}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition-all ${
                  cp === 'ai'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-orange-500/30 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20'
                }`}
              >
                {cp === 'ai' ? 'Copied!' : 'Copy to Clipboard'}
              </button>

              <button
                onClick={() => {
                  const stamp = `[${new Date().toLocaleDateString()} — ${
                    aiModal.mode === 'pitch' ? 'AI Pitch' : 'Contact Research'
                  }]\n${aiText}`;
                  void saveNote(
                    aiModal.lead.id,
                    (aiModal.lead.notes ? aiModal.lead.notes + '\n\n' : '') + stamp
                  );
                  setAiModal(null);
                }}
                className="flex-1 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2.5 text-sm font-bold text-blue-400 transition-all hover:bg-blue-500/20"
              >
                Save to Notes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
