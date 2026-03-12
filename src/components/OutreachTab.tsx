import React, { useState } from 'react';
import { SCRIPTS, OBJECTIONS } from '../data';

export function OutreachTab() {
  const [cp, setCp] = useState<string | null>(null);

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCp(id);
      setTimeout(() => setCp(null), 2200);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-zinc-100">
          Outreach Scripts
        </h1>
        <p className="text-xs font-mono text-zinc-500">7 battle-tested scripts + objection handling</p>
      </div>

      <div className="mb-10 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-6">
        <div className="mb-3 text-[10px] font-bold font-mono uppercase tracking-widest text-orange-500">
          Memorize this one-liner
        </div>
        <div className="text-lg font-light italic leading-relaxed text-amber-100/90">
          "We're SC Precision Deburring in Pacoima — 35 years aerospace deburring. We take
          deburring off machinists' plates so your CNCs stay running. Can I earn a test job?"
        </div>
      </div>

      {['Cold Call', 'Email', 'Text', 'Walk-In', 'LinkedIn'].map((cat) => {
        const items = SCRIPTS.filter((sc) => sc.cat === cat);
        if (!items.length) return null;

        return (
          <div key={cat} className="mb-10">
            <div className="mb-4 flex items-center gap-2 border-b border-zinc-800 pb-2 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
              {items[0].icon} {cat}
            </div>

            <div className={`grid gap-4 ${items.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              {items.map((sc) => (
                <div key={sc.id} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-1 text-sm font-bold text-zinc-100">{sc.title}</div>
                      <div className="text-[11px] italic text-zinc-500">Use: {sc.use}</div>
                    </div>

                    <button
                      onClick={() => copy(sc.id, sc.body)}
                      className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                        cp === sc.id
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      {cp === sc.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800/50 bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-400">
                    {sc.body}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div>
        <div className="mb-4 border-b border-zinc-800 pb-2 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
          Objection Handling
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {OBJECTIONS.map((o, i) => (
            <div key={i} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
              <div className="mb-2 text-xs font-bold text-red-400">"{o.q}"</div>
              <div className="text-xs leading-relaxed text-zinc-400">→ {o.a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
