import React, { useEffect, useState } from 'react';
import { DollarSign, X } from 'lucide-react';
import type { Lead } from '../../types';
import { useToast } from '../../ui/Toast';

interface LeadCardValueProps {
  lead: Lead;
  setValue: (id: string, value: number | null) => void | Promise<void>;
}

/**
 * DEAL VALUE control for the expanded card. Sizes the lead in $/month once it
 * becomes a recurring account; the Pipeline board sums these per column so the
 * board reads like a Salesforce pipeline ("$X/mo in this stage"). Writes go
 * through setValue (a { merge: true } patch — tenantId preserved) which also
 * stamps the change into the activity timeline. Commits on blur/Enter — not on
 * every keystroke — so typing "8000" doesn't fire four writes.
 */
export const LeadCardValue: React.FC<LeadCardValueProps> = ({ lead, setValue }) => {
  const toast = useToast();
  const [draft, setDraft] = useState<string>(lead.value != null ? String(lead.value) : '');

  // Keep the draft in sync when the lead doc changes underneath us (snapshot).
  useEffect(() => {
    setDraft(lead.value != null ? String(lead.value) : '');
  }, [lead.value]);

  const commit = () => {
    const raw = draft.trim();
    // Empty (including a browser number-input "bad input" state, which reports
    // value === '') is treated as "no change" — NOT a clear. Clearing a stored
    // value is only ever done via the explicit Clear button, so fat-fingering
    // "5e" and tabbing away can never silently wipe a real deal size.
    if (raw === '') {
      setDraft(lead.value != null ? String(lead.value) : '');
      return;
    }
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < 0) {
      setDraft(lead.value != null ? String(lead.value) : '');
      return;
    }
    if (n === lead.value) return;
    void setValue(lead.id, n);
    toast(`Deal value set: $${n.toLocaleString('en-US')}/mo — ${lead.co}`);
  };

  const onClear = () => {
    setDraft('');
    if (lead.value != null) {
      void setValue(lead.id, null);
      toast(`Deal value cleared — ${lead.co}`);
    }
  };

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-1 text-[10px] font-bold font-mono uppercase tracking-widest text-slate-500">
        <DollarSign size={12} />
        Deal Value
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-apex-800 p-3">
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            value={draft}
            placeholder="e.g. 5000"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            aria-label={`Estimated monthly deal value for ${lead.co}`}
            className="w-28 rounded-lg border border-white/10 bg-apex-850 px-3 py-1.5 text-xs text-slate-100 tabular-nums ring-0 transition-colors focus:border-apex-accent/60 focus:outline-none focus:ring-1 focus:ring-apex-accent/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-xs text-slate-400">/mo</span>
        </div>

        {lead.value != null ? (
          <>
            <span className="text-xs font-medium tabular-nums text-emerald-300">
              ${lead.value.toLocaleString('en-US')}/mo if won
            </span>
            <button
              onClick={onClear}
              aria-label={`Clear the deal value for ${lead.co}`}
              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-white/10 bg-apex-850 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-slate-100"
            >
              <X size={12} /> Clear
            </button>
          </>
        ) : (
          <span className="text-xs text-slate-500">Not sized yet — what's this worth monthly?</span>
        )}
      </div>
    </div>
  );
};
