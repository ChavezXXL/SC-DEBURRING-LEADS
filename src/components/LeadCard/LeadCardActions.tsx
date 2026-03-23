import React from 'react';
import { Phone, Mail, Copy, Globe, Search, Briefcase, ClipboardList, Microscope, Sparkles, Send } from 'lucide-react';
import type { Lead, AiMode } from '../../types';

interface LeadCardActionsProps {
  lead: Lead;
  cp: string | null;
  copy: (id: string, text: string) => void;
  qs: {
    google: (co: string) => string;
    linkedin: (co: string) => string;
    indeed: (city: string) => string;
  };
  handleAI: (lead: Lead, mode: AiMode) => void;
  showEmail: boolean;
  setShowEmail: (show: boolean) => void;
}

export const LeadCardActions: React.FC<LeadCardActionsProps> = ({ lead, cp, copy, qs, handleAI, showEmail, setShowEmail }) => {
  return (
    <>
      <div className="flex flex-wrap gap-2 py-3">
        {lead.ph && (
          <a
            href={`tel:${lead.ph}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
          >
            <Phone size={14} /> {lead.ph}
          </a>
        )}

        {lead.em && (
          <>
            <a
              href={`mailto:${lead.em}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
            >
              <Mail size={14} /> Email
            </a>

            <button
              onClick={() => copy(`em_${lead.id}`, lead.em)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                cp === `em_${lead.id}`
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                  : 'border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
              }`}
            >
              <Copy size={14} /> {cp === `em_${lead.id}` ? 'Copied!' : 'Copy Email'}
            </button>
          </>
        )}

        {lead.web && (
          <a
            href={lead.web}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-400 transition-colors hover:bg-violet-500/20"
          >
            <Globe size={14} /> Site
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-zinc-800/50 py-3">
        <a
          href={qs.google(lead.co)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          <Search size={14} /> Google
        </a>

        <a
          href={qs.linkedin(lead.co)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
        >
          <Briefcase size={14} /> LinkedIn
        </a>

        <a
          href={qs.indeed(lead.city)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-500 transition-colors hover:bg-amber-500/20"
        >
          <ClipboardList size={14} /> Indeed
        </a>

        <button
          onClick={() => handleAI(lead, 'research')}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/20"
        >
          <Microscope size={14} /> Research Contact
        </button>

        <button
          onClick={() => handleAI(lead, 'pitch')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-500 transition-colors hover:bg-orange-500/20"
        >
          <Sparkles size={14} /> AI Pitch
        </button>

        <button
          onClick={() => setShowEmail(!showEmail)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
            showEmail
              ? 'border-orange-500/40 bg-orange-500/20 text-orange-400'
              : 'border-orange-500/30 bg-orange-500 text-white hover:bg-orange-400'
          }`}
        >
          <Send size={14} /> {showEmail ? 'Close Email' : 'Quick Email'}
        </button>
      </div>
    </>
  );
};
