import React, { useState, useMemo, useEffect } from 'react';
import { Mail, Send, Copy, Check, X, Sparkles, Loader2 } from 'lucide-react';
import { SCRIPTS } from '../../data';
import type { Lead } from '../../types';
import { generatePitch } from '../../services/gemini';

interface QuickEmailProps {
  lead: Lead;
  onClose: () => void;
  onEmailSent?: (leadId: string) => void;
}

const EMAIL_SCRIPTS = SCRIPTS.filter((s) => s.cat === 'Email');

function fillTemplate(template: string, lead: Lead): string {
  const contact = lead.pm || lead.who || 'there';
  const firstName = contact.split(' ')[0];
  return template
    .replace(/\[NAME\]/g, firstName)
    .replace(/\[OWNER NAME\]/g, firstName)
    .replace(/\[COMPANY\]/g, lead.co)
    .replace(/\[PARTS TYPE\]/g, lead.parts || 'precision components')
    .replace(/\[CITY\]/g, lead.city || 'your area');
}

function extractSubjectAndBody(filled: string): { subject: string; body: string } {
  const subjectMatch = filled.match(/^Subject:\s*(.+)\n/m);
  const subject = subjectMatch ? subjectMatch[1].trim() : `Deburring support for ${filled}`;
  const body = subjectMatch ? filled.replace(/^Subject:\s*.+\n/m, '').trim() : filled;
  return { subject, body };
}

export const QuickEmail: React.FC<QuickEmailProps> = ({ lead, onClose, onEmailSent }) => {
  const [selectedId, setSelectedId] = useState(EMAIL_SCRIPTS[0]?.id || '');
  const [toEmail, setToEmail] = useState(lead.em || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const selectedScript = useMemo(
    () => EMAIL_SCRIPTS.find((s) => s.id === selectedId),
    [selectedId]
  );

  useEffect(() => {
    if (selectedScript) {
      const filled = fillTemplate(selectedScript.body, lead);
      const parsed = extractSubjectAndBody(filled);
      setSubject(parsed.subject);
      setBody(parsed.body);
    }
  }, [selectedId, lead]);

  const handleAiDraft = async () => {
    setAiLoading(true);
    try {
      const result = await generatePitch(lead);
      if (result) {
        const emailMatch = result.match(/COLD EMAIL\s*\n(?:Subject:\s*(.+)\n)?([\s\S]*?)(?:\n\s*CALL OPENER|$)/i);
        if (emailMatch) {
          setSubject(emailMatch[1]?.trim() || `Deburring support for ${lead.co}`);
          setBody(emailMatch[2]?.trim() || result);
        } else {
          setBody(result);
        }
        setSelectedId('');
      }
    } catch (e: any) {
      setBody(`Error generating email: ${e?.message || 'Try again'}`);
    } finally {
      setAiLoading(false);
    }
  };

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const copyAll = async () => {
    const full = `To: ${toEmail}\nSubject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="mt-3 rounded-xl border border-orange-500/20 bg-zinc-950 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-orange-400">
          <Mail size={15} /> Quick Email
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
          <X size={15} />
        </button>
      </div>

      {/* Template Picker */}
      <div className="mb-3">
        <div className="mb-1.5 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          Template
        </div>
        <div className="flex flex-wrap gap-2">
          {EMAIL_SCRIPTS.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelectedId(s.id); setShowPicker(false); }}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                selectedId === s.id
                  ? 'border-orange-500/30 bg-orange-500/10 text-orange-400'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              {s.title}
            </button>
          ))}
          <button
            onClick={handleAiDraft}
            disabled={aiLoading}
            className="flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-400 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
          >
            {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            AI Draft
          </button>
        </div>
      </div>

      {/* To Field */}
      <div className="mb-2">
        <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-zinc-500">To</div>
        <input
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
          placeholder="email@company.com"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
        />
        {!toEmail && (
          <div className="mt-1 text-[10px] text-amber-500/70">
            No email on file — use Research Contact to find one
          </div>
        )}
      </div>

      {/* Subject */}
      <div className="mb-2">
        <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          Subject
        </div>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
        />
      </div>

      {/* Body */}
      <div className="mb-3">
        <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          Body
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <a
          href={gmailUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => onEmailSent?.(lead.id)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold shadow-lg transition-all ${
            toEmail.trim()
              ? 'bg-orange-500 text-white shadow-orange-500/20 hover:bg-orange-400'
              : 'pointer-events-none bg-zinc-700 text-zinc-400'
          }`}
        >
          <Send size={13} /> Open in Gmail — Ready to Send
        </a>

        <button
          onClick={copyAll}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            copied
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy All'}
        </button>
      </div>
    </div>
  );
};
