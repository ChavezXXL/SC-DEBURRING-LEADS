import React, { useMemo } from 'react';
import { X, Sparkles, Microscope, Loader2, UserPlus, Save } from 'lucide-react';
import type { Lead, AiMode } from '../types';
import { renderMarkdown } from '../utils/markdown';

interface AiModalProps {
  aiModal: { lead: Lead; mode: AiMode };
  setAiModal: (modal: { lead: Lead; mode: AiMode } | null) => void;
  aiLoading: boolean;
  aiText: string;
  cp: string | null;
  copy: (id: string, text: string) => void;
  saveNote: (id: string, notes: string) => void;
  updateLeadFields?: (id: string, fields: Partial<Lead>) => void;
}

/** Parse AI research text to extract contact info */
function parseContactInfo(text: string): Partial<Lead> {
  const fields: Partial<Lead> = {};

  // Try to extract name — look for **Name** or bold name patterns
  const namePatterns = [
    /\*\*([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\*\*\s*[–—-]\s*\*\*([^*]+)\*\*/,
    /Best Contact.*?:\s*\*\*([A-Z][a-z]+ [A-Z][a-z]+)\*\*/,
    /(?:Contact|Name|Person):\s*([A-Z][a-z]+ [A-Z][a-z]+)/,
  ];
  for (const pat of namePatterns) {
    const m = text.match(pat);
    if (m) {
      fields.pm = m[1];
      if (m[2]) fields.pm_title = m[2].trim();
      break;
    }
  }

  // Extract title if not found above
  if (!fields.pm_title) {
    const titlePatterns = [
      /(?:Title|Position|Role):\s*\*?\*?([^*\n]+)\*?\*?/i,
      /[–—-]\s*\*\*([^*]+)\*\*/,
      /(?:VP|Vice President|Director|Manager|President|Owner|CEO|COO|CFO|CTO)[^.\n]*/i,
    ];
    for (const pat of titlePatterns) {
      const m = text.match(pat);
      if (m) {
        fields.pm_title = m[1]?.trim() || m[0]?.trim();
        break;
      }
    }
  }

  // Extract email
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) {
    fields.em = emailMatch[0];
  }

  // Extract phone
  const phoneMatch = text.match(/(?:\+1\s?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  if (phoneMatch) {
    fields.ph = phoneMatch[0];
  }

  return fields;
}

export const AiModal: React.FC<AiModalProps> = ({
  aiModal,
  setAiModal,
  aiLoading,
  aiText,
  cp,
  copy,
  saveNote,
  updateLeadFields,
}) => {
  const parsedContact = useMemo(() => {
    if (aiModal.mode !== 'research' || !aiText) return null;
    const info = parseContactInfo(aiText);
    return Object.keys(info).length > 0 ? info : null;
  }, [aiText, aiModal.mode]);

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
            {/* Rendered markdown instead of raw pre */}
            <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-xs leading-relaxed text-zinc-300">
              {renderMarkdown(aiText)}
            </div>

            {/* Extracted contact info preview */}
            {parsedContact && updateLeadFields && (
              <div className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-violet-400">
                  <UserPlus size={14} /> Found Contact Info — Save to Lead?
                </div>
                <div className="mb-3 space-y-1 text-xs">
                  {parsedContact.pm && (
                    <div className="flex gap-2">
                      <span className="text-zinc-500 w-16">Name:</span>
                      <span className="text-zinc-200 font-medium">{parsedContact.pm}</span>
                    </div>
                  )}
                  {parsedContact.pm_title && (
                    <div className="flex gap-2">
                      <span className="text-zinc-500 w-16">Title:</span>
                      <span className="text-zinc-200 font-medium">{parsedContact.pm_title}</span>
                    </div>
                  )}
                  {parsedContact.em && (
                    <div className="flex gap-2">
                      <span className="text-zinc-500 w-16">Email:</span>
                      <span className="text-violet-400 font-medium">{parsedContact.em}</span>
                    </div>
                  )}
                  {parsedContact.ph && (
                    <div className="flex gap-2">
                      <span className="text-zinc-500 w-16">Phone:</span>
                      <span className="text-zinc-200 font-medium">{parsedContact.ph}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    updateLeadFields(aiModal.lead.id, parsedContact);
                    // Also save to notes
                    const stamp = `[${new Date().toLocaleDateString()} — Contact Research]\n${aiText}`;
                    void saveNote(
                      aiModal.lead.id,
                      (aiModal.lead.notes ? aiModal.lead.notes + '\n\n' : '') + stamp
                    );
                    setAiModal(null);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:bg-violet-400"
                >
                  <Save size={13} /> Save Contact Info + Notes
                </button>
              </div>
            )}

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
                Save to Notes Only
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
