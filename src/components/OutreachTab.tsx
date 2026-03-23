import React, { useEffect, useMemo, useState } from 'react';
import { Send, Loader2, Check, AlertCircle } from 'lucide-react';
import { SCRIPTS, OBJECTIONS } from '../data';
import { sendEmail } from '../services/email';

export function OutreachTab() {
  const [cp, setCp] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'playbooks' | 'cadence' | 'objections'>('playbooks');
  const [channelFilter, setChannelFilter] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [persona, setPersona] = useState({
    name: 'Bridget',
    company: 'B&B Manufacturing',
    parts: 'aerospace brackets',
    owner: 'Anthony',
  });
  const [emailTo, setEmailTo] = useState('');
  const [selectedEmailScriptId, setSelectedEmailScriptId] = useState<string>('s3');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCp(id);
      setTimeout(() => setCp(null), 2200);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  const channels = useMemo(() => ['All', ...Array.from(new Set(SCRIPTS.map((s) => s.cat)))], []);

  const filteredScripts = useMemo(() => {
    return SCRIPTS.filter((script) => {
      const channelMatch = channelFilter === 'All' || script.cat === channelFilter;
      if (!channelMatch) return false;

      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        script.title.toLowerCase().includes(q) ||
        script.use.toLowerCase().includes(q) ||
        script.body.toLowerCase().includes(q)
      );
    });
  }, [channelFilter, query]);

  const scriptsByCategory = useMemo(() => {
    return ['Cold Call', 'Email', 'Text', 'Walk-In', 'LinkedIn'].map((cat) => ({
      cat,
      items: filteredScripts.filter((sc) => sc.cat === cat),
    }));
  }, [filteredScripts]);

  const applyTokens = (body: string) =>
    body
      .replaceAll('[NAME]', persona.name)
      .replaceAll('[OWNER NAME]', persona.name)
      .replaceAll('[COMPANY]', persona.company)
      .replaceAll('[PARTS TYPE]', persona.parts)
      .replaceAll('Anthony', persona.owner);

  const emailScripts = useMemo(() => SCRIPTS.filter((s) => s.cat === 'Email'), []);
  const selectedEmailScript = useMemo(
    () => emailScripts.find((s) => s.id === selectedEmailScriptId) || emailScripts[0],
    [emailScripts, selectedEmailScriptId]
  );

  useEffect(() => {
    if (!selectedEmailScript) return;
    const personalized = applyTokens(selectedEmailScript.body);
    const lines = personalized.split('\n');
    const subjectLine = lines[0]?.toLowerCase().startsWith('subject:')
      ? lines[0].replace(/^subject:\s*/i, '')
      : `Deburring support for ${persona.company}`;
    const bodyWithoutSubject = lines[0]?.toLowerCase().startsWith('subject:')
      ? lines.slice(2).join('\n')
      : personalized;
    setEmailSubject(subjectLine);
    setEmailBody(bodyWithoutSubject);
  }, [selectedEmailScript, persona.name, persona.company, persona.parts, persona.owner]);

  const draftMailto = useMemo(() => {
    const encodedSubject = encodeURIComponent(emailSubject);
    const encodedBody = encodeURIComponent(emailBody);
    return `mailto:${emailTo}?subject=${encodedSubject}&body=${encodedBody}`;
  }, [emailTo, emailSubject, emailBody]);

  const cadence = [
    { day: 'Day 0', action: 'Cold call + voicemail', detail: 'Use call script and ask for a test job.' },
    { day: 'Day 1', action: 'Email follow-up', detail: 'Send direct value email with one clear CTA.' },
    { day: 'Day 3', action: 'LinkedIn touch', detail: 'Connect + short DM referencing prior outreach.' },
    { day: 'Day 5', action: 'Text message', detail: 'Short check-in if mobile is known.' },
    { day: 'Day 8', action: 'Second call', detail: 'Reference earlier attempts and ask for 5-minute window.' },
    { day: 'Day 12', action: 'Send proof', detail: 'Share quality proof or a sample success line.' },
    { day: 'Day 14', action: 'Breakup note', detail: 'Close loop politely and leave door open.' },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-zinc-100">
          Outreach Command Center
        </h1>
        <p className="text-xs font-mono text-zinc-500">Playbooks, cadence engine, and objection lab</p>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {[
          { id: 'playbooks', label: 'Playbooks' },
          { id: 'cadence', label: 'Cadence Builder' },
          { id: 'objections', label: 'Objection Lab' },
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id as typeof activeView)}
            className={`rounded-xl border px-4 py-2 text-left text-sm font-semibold transition-colors ${
              activeView === view.id
                ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
                : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      <div className="mb-8 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-6">
        <div className="mb-3 text-[10px] font-bold font-mono uppercase tracking-widest text-orange-500">
          Core opener
        </div>
        <div className="text-lg font-light italic leading-relaxed text-amber-100/90">
          "We're SC Precision Deburring in Pacoima — 35 years aerospace deburring. We take
          deburring off machinists' plates so your CNCs stay running. Can I earn a test job?"
        </div>
      </div>

      {activeView === 'playbooks' && (
        <>
          <div className="mb-6 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
            <div className="mb-3 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
              Personalization controls
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <input
                value={persona.name}
                onChange={(e) => setPersona((p) => ({ ...p, name: e.target.value }))}
                placeholder="Contact name"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
              />
              <input
                value={persona.company}
                onChange={(e) => setPersona((p) => ({ ...p, company: e.target.value }))}
                placeholder="Company"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
              />
              <input
                value={persona.parts}
                onChange={(e) => setPersona((p) => ({ ...p, parts: e.target.value }))}
                placeholder="Parts type"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
              />
              <input
                value={persona.owner}
                onChange={(e) => setPersona((p) => ({ ...p, owner: e.target.value }))}
                placeholder="Your name"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
              />
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="mb-3 text-[10px] font-bold font-mono uppercase tracking-widest text-blue-400">
              One-click Email Draft
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-3">
                <label className="block text-[11px] font-semibold text-zinc-400">Recipient email</label>
                <input
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="buyer@company.com"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
                />

                <label className="block text-[11px] font-semibold text-zinc-400">Email script</label>
                <select
                  value={selectedEmailScriptId}
                  onChange={(e) => setSelectedEmailScriptId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
                >
                  {emailScripts.map((script) => (
                    <option key={script.id} value={script.id}>
                      {script.title}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <button
                    onClick={() => window.open(draftMailto, '_blank')}
                    disabled={!emailTo.trim()}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                      emailTo.trim()
                        ? 'border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                        : 'cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-500'
                    }`}
                  >
                    Open Draft
                  </button>
                  <SendEmailButton
                    to={emailTo}
                    subject={emailSubject}
                    body={emailBody}
                    fromName={persona.owner}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-[11px] font-semibold text-zinc-400">Subject</label>
                <input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
                />

                <label className="block text-[11px] font-semibold text-zinc-400">Draft body (review before send)</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200"
                />
              </div>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {channels.map((channel) => (
              <button
                key={channel}
                onClick={() => setChannelFilter(channel)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  channelFilter === channel
                    ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
                    : 'border-zinc-800 bg-zinc-900/40 text-zinc-400'
                }`}
              >
                {channel}
              </button>
            ))}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search script, scenario, wording..."
              className="min-w-[220px] flex-1 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-300"
            />
          </div>

          {scriptsByCategory.map(({ cat, items }) => {
            if (!items.length) return null;
            return (
              <div key={cat} className="mb-10">
                <div className="mb-4 flex items-center gap-2 border-b border-zinc-800 pb-2 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
                  {items[0].icon} {cat}
                </div>

                <div className={`grid gap-4 ${items.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                  {items.map((sc) => {
                    const personalized = applyTokens(sc.body);
                    return (
                      <div key={sc.id} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
                        <div className="mb-4 flex items-start justify-between gap-4">
                          <div>
                            <div className="mb-1 text-sm font-bold text-zinc-100">{sc.title}</div>
                            <div className="text-[11px] italic text-zinc-500">Use: {sc.use}</div>
                          </div>

                          <button
                            onClick={() => copy(sc.id, personalized)}
                            className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                              cp === sc.id
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-800'
                            }`}
                          >
                            {cp === sc.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>

                        <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800/50 bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-300">
                          {personalized}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}

      {activeView === 'cadence' && (
        <div className="space-y-4">
          {cadence.map((step, idx) => (
            <div key={step.day} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-mono uppercase tracking-wider text-orange-400">{step.day}</div>
                <div className="text-[11px] text-zinc-500">Step {idx + 1} / {cadence.length}</div>
              </div>
              <div className="mb-1 text-sm font-bold text-zinc-100">{step.action}</div>
              <div className="text-xs text-zinc-400">{step.detail}</div>
            </div>
          ))}
        </div>
      )}

      {activeView === 'objections' && (
        <div>
          <div className="mb-4 border-b border-zinc-800 pb-2 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
            Objection Handling
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {OBJECTIONS.map((o, i) => (
              <div key={i} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
                <div className="mb-2 text-xs font-bold text-red-400">"{o.q}"</div>
                <div className="mb-3 text-xs leading-relaxed text-zinc-400">→ {o.a}</div>
                <button
                  onClick={() => copy(`obj-${i}`, o.a)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${
                    cp === `obj-${i}`
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                  }`}
                >
                  {cp === `obj-${i}` ? 'Copied' : 'Copy response'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function SendEmailButton({ to, subject, body, fromName, leadId, onSent }: {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  leadId?: string;
  onSent?: (result: { emailId?: string; sentAt?: string }) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSend = async () => {
    if (!to.trim()) return;
    setStatus('sending');
    setErrorMsg('');

    const result = await sendEmail({ to, subject, body, fromName, leadId });

    if (result.success) {
      setStatus('sent');
      onSent?.({ emailId: result.emailId, sentAt: result.sentAt });
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setStatus('error');
      setErrorMsg(result.error || 'Send failed');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleSend}
        disabled={!to.trim() || status === 'sending'}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
          status === 'sent'
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
            : status === 'error'
            ? 'border-red-500/40 bg-red-500/10 text-red-400'
            : to.trim()
            ? 'border-orange-500/40 bg-orange-500 text-white hover:bg-orange-400'
            : 'cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-500'
        }`}
      >
        {status === 'sending' && <Loader2 size={14} className="animate-spin" />}
        {status === 'sent' && <Check size={14} />}
        {status === 'error' && <AlertCircle size={14} />}
        {status === 'idle' && <Send size={14} />}
        {status === 'sending' ? 'Sending...' : status === 'sent' ? 'Sent!' : status === 'error' ? 'Failed' : 'Send Now'}
      </button>
      {status === 'error' && errorMsg && (
        <div className="text-[10px] text-red-400">{errorMsg}</div>
      )}
    </div>
  );
}
