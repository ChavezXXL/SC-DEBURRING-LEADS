import React from 'react';
import { Phone, PhoneCall, Mail, MailCheck, MailPlus, Copy, Globe, Search, Briefcase, ClipboardList, Microscope, Sparkles, Send, Zap } from 'lucide-react';
import type { Lead, AiMode } from '../../types';
import { buildGmailUrl, isWarmLead } from '../../outreach/templates';

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
  onQueueOutreach?: (lead: Lead) => void;
  onMarkEmailed?: (lead: Lead) => void;
  onLogCall?: (lead: Lead) => void;
}

export const LeadCardActions: React.FC<LeadCardActionsProps> = ({ lead, cp, copy, qs, handleAI, showEmail, setShowEmail, onQueueOutreach, onMarkEmailed, onLogCall }) => {
  // buildGmailUrl picks the template from status — warm statuses (client,
  // visited, interested, quote) can never get the cold pitch.
  const warm = isWarmLead(lead);
  return (
    <>
      <div className="flex flex-wrap gap-2 py-3">
        {lead.ph && (
          <a
            href={`tel:${lead.ph}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
          >
            <Phone size={14} /> {lead.ph}
          </a>
        )}

        {onLogCall && (
          <button
            onClick={() => onLogCall(lead)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
            title="Log a call touch — sets last contacted, bumps touch count, stamps notes"
          >
            <PhoneCall size={14} /> Log call
          </button>
        )}

        {lead.em && (
          <>
            <a
              href={`mailto:${lead.em}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
            >
              <Mail size={14} /> Email
            </a>

            <button
              onClick={() => copy(`em_${lead.id}`, lead.em)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                cp === `em_${lead.id}`
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                  : 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
              }`}
            >
              <Copy size={14} /> {cp === `em_${lead.id}` ? 'Copied!' : 'Copy Email'}
            </button>

            <a
              href={buildGmailUrl(lead)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition-colors hover:bg-sky-500/20"
              title={warm ? 'Open a pre-written check-in draft in Gmail' : 'Open a pre-written cold intro draft in Gmail'}
            >
              <MailPlus size={14} /> {warm ? 'Check in' : 'Draft email'}
            </a>

            {onMarkEmailed && (
              <button
                onClick={() => onMarkEmailed(lead)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/20 bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-300 transition-colors hover:bg-teal-500/20"
                title="Log an email touch — sets last contacted, bumps touch count, stamps notes"
              >
                <MailCheck size={14} /> Mark emailed
              </button>
            )}

            {lead.status === 'client' && (
              <span className="inline-flex items-center self-center rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-amber-300 ring-1 ring-amber-500/40">
                CLIENT
              </span>
            )}
          </>
        )}

        {lead.web && (
          <a
            href={lead.web}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/20"
          >
            <Globe size={14} /> Site
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-white/10 py-3">
        <a
          href={qs.google(lead.co)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-apex-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-slate-100"
        >
          <Search size={14} /> Google
        </a>

        <a
          href={qs.linkedin(lead.co)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
        >
          <Briefcase size={14} /> LinkedIn
        </a>

        <a
          href={qs.indeed(lead.city)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
        >
          <ClipboardList size={14} /> Indeed
        </a>

        <button
          onClick={() => handleAI(lead, 'research')}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/20"
        >
          <Microscope size={14} /> Research Contact
        </button>

        <button
          onClick={() => handleAI(lead, 'pitch')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-300 transition-colors hover:bg-orange-500/20"
        >
          <Sparkles size={14} /> AI Pitch
        </button>

        <button
          onClick={() => setShowEmail(!showEmail)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
            showEmail
              ? 'border-orange-500/40 bg-orange-500/20 text-orange-300'
              : 'border-orange-500/30 bg-apex-accent text-white hover:brightness-110'
          }`}
        >
          <Send size={14} /> {showEmail ? 'Close Email' : 'Quick Email'}
        </button>

        {onQueueOutreach && lead.status === 'new' && lead.em && (
          <button
            onClick={() => onQueueOutreach(lead)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              (lead as any).queued_for_outreach
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-violet-500/20 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20'
            }`}
          >
            <Zap size={14} /> {(lead as any).queued_for_outreach ? 'Queued' : 'Queue Outreach'}
          </button>
        )}
      </div>
    </>
  );
};
