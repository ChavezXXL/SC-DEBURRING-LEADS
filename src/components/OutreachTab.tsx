import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Check, Send, Mail, Phone, MessageSquare, Users, Briefcase, Target, Clock, ChevronRight } from 'lucide-react';
import { SCRIPTS, OBJECTIONS } from '../data';

type View = 'email' | 'scripts' | 'cadence' | 'objections';

export function OutreachTab() {
  const [cp, setCp] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>('email');
  const [channelFilter, setChannelFilter] = useState<string>('All');
  const [query, setQuery] = useState('');

  // Email composer state
  const [emailTo, setEmailTo] = useState('');
  const [contactName, setContactName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [partsType, setPartsType] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('s3');
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

  const emailScripts = useMemo(() => SCRIPTS.filter((s) => s.cat === 'Email'), []);

  const applyTokens = (text: string) =>
    text
      .replaceAll('[NAME]', contactName || 'there')
      .replaceAll('[OWNER NAME]', contactName || 'there')
      .replaceAll('[COMPANY]', companyName || 'your company')
      .replaceAll('[PARTS TYPE]', partsType || 'precision components');

  const selectedTemplate = useMemo(
    () => emailScripts.find((s) => s.id === selectedTemplateId) || emailScripts[0],
    [emailScripts, selectedTemplateId]
  );

  useEffect(() => {
    if (!selectedTemplate) return;
    const filled = applyTokens(selectedTemplate.body);
    const lines = filled.split('\n');
    const hasSubject = lines[0]?.toLowerCase().startsWith('subject:');
    setEmailSubject(hasSubject ? lines[0].replace(/^subject:\s*/i, '') : `Deburring support for ${companyName || 'your company'}`);
    setEmailBody(hasSubject ? lines.slice(2).join('\n') : filled);
  }, [selectedTemplateId, contactName, companyName, partsType]);

  const gmailUrl = useMemo(() => {
    if (!emailTo.trim()) return '#';
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailTo)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  }, [emailTo, emailSubject, emailBody]);

  const channels = useMemo(() => ['All', ...Array.from(new Set(SCRIPTS.map((s) => s.cat)))], []);

  const filteredScripts = useMemo(() => {
    return SCRIPTS.filter((script) => {
      const channelMatch = channelFilter === 'All' || script.cat === channelFilter;
      if (!channelMatch) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return script.title.toLowerCase().includes(q) || script.use.toLowerCase().includes(q) || script.body.toLowerCase().includes(q);
    });
  }, [channelFilter, query]);

  const scriptsByCategory = useMemo(() => {
    return ['Cold Call', 'Email', 'Text', 'Walk-In', 'LinkedIn']
      .map((cat) => ({ cat, items: filteredScripts.filter((sc) => sc.cat === cat) }))
      .filter(({ items }) => items.length > 0);
  }, [filteredScripts]);

  const cadence = [
    { day: 'Day 0', action: 'Cold Call + Voicemail', icon: Phone, color: 'text-emerald-400', detail: 'Call the main number. Ask for purchasing or operations by name if you have it. Use the call script. If you hit voicemail, leave a quick 20-second message — you\'re local, you do aerospace deburring, and you\'d love to earn a test job.', tip: 'Call Tue-Thu between 8-10am or 2-4pm. Monday mornings are chaos and Friday afternoons nobody picks up.' },
    { day: 'Day 1', action: 'Send Intro Email', icon: Mail, color: 'text-blue-400', detail: 'Hit them with the "Direct to Named Contact" email. Drop their company name, what they make, and why you\'re reaching out. Make it feel like you actually looked them up — because you did.', tip: 'Keep the subject under 6 words and the whole email under 80. Nobody reads long cold emails.' },
    { day: 'Day 3', action: 'LinkedIn Connect + DM', icon: Briefcase, color: 'text-violet-400', detail: 'Find the PM or owner on LinkedIn. Send a connect request with a personalized note. Once they accept, hit them with the LinkedIn DM script. Mention you sent an email.', tip: 'The connect note matters — "Hi [Name], reaching out about deburring for [Company]" beats a blank request every time.' },
    { day: 'Day 5', action: 'Text Message', icon: MessageSquare, color: 'text-amber-400', detail: 'If you have their cell, send a short text. Two sentences max. "Hey [Name], this is Anthony from SC Deburring — sent you an email about deburring overflow. Worth a quick chat?"', tip: 'Texts have a 98% open rate. But only text a direct mobile number — never blast the front desk line.' },
    { day: 'Day 8', action: 'Second Call + Follow-Up Email', icon: Phone, color: 'text-emerald-400', detail: 'Call again. "Hi, I reached out last week about deburring support — just wanted to follow up quick." After the call, send the 48-hour follow-up email.', tip: '80% of salespeople quit after one call. The second call is where the magic happens. Don\'t be the guy who gives up.' },
    { day: 'Day 12', action: 'Send Proof', icon: Target, color: 'text-orange-400', detail: 'Send something real — "We just turned 500 brackets for a shop in Chatsworth in 3 days" or a photo of your work. No fluff, just proof that you deliver.', tip: 'Name a real company or real numbers. "We work with aerospace shops" means nothing. "We turned 800 parts for Crissair last month" means everything.' },
    { day: 'Day 14', action: 'Breakup Email', icon: Clock, color: 'text-red-400', detail: 'Send the breakup template. Close the loop. Something about this — the "I\'m going to stop bugging you" angle — makes people respond more than any other email.', tip: 'This gets the highest reply rate of anything you\'ll send. 30%+ in B2B. Seriously, don\'t skip it.' },
  ];

  const views = [
    { id: 'email' as View, label: 'Email Composer', icon: Send },
    { id: 'scripts' as View, label: 'All Scripts', icon: Copy },
    { id: 'cadence' as View, label: '14-Day Cadence', icon: Clock },
    { id: 'objections' as View, label: 'Objection Handling', icon: Target },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-zinc-100">
          Outreach Command Center
        </h1>
        <p className="text-xs font-mono text-zinc-500">Email composer · Scripts · 14-day cadence · Objection handling</p>
      </div>

      {/* Core Opener */}
      <div className="mb-6 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
        <div className="mb-2 text-[10px] font-bold font-mono uppercase tracking-widest text-orange-500">
          Memorize this — your 10-second pitch
        </div>
        <div className="text-lg font-light italic leading-relaxed text-amber-100/90">
          "We're SC Precision Deburring in Pacoima — 35 years aerospace deburring. We take
          deburring off machinists' plates so your CNCs stay running. Can I earn a test job?"
        </div>
      </div>

      {/* View Tabs */}
      <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
              activeView === v.id
                ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
                : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <v.icon size={14} /> {v.label}
          </button>
        ))}
      </div>

      {/* EMAIL COMPOSER */}
      {activeView === 'email' && (
        <div className="space-y-4">
          {/* Recipient Info */}
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
            <div className="mb-4 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
              Recipient Info — fill in to personalize all templates
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-400">Email address</label>
                <input
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="buyer@company.com"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-400">Contact name</label>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Bridget, Mike, etc."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-400">Company</label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Vescio Manufacturing"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-400">Parts they make</label>
                <input
                  value={partsType}
                  onChange={(e) => setPartsType(e.target.value)}
                  placeholder="aerospace brackets, engine mounts"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Template Picker */}
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
            <div className="mb-4 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
              Pick a template
            </div>
            <div className="flex flex-wrap gap-2">
              {emailScripts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedTemplateId(s.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedTemplateId === s.id
                      ? 'border-orange-500/30 bg-orange-500/10 text-orange-400'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          {/* Email Preview + Actions */}
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <div className="mb-4 text-[10px] font-bold font-mono uppercase tracking-widest text-blue-400">
              Email Preview — edit before sending
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-400">Subject</label>
                <input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-400">Body</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-300 focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href={gmailUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold shadow-lg transition-all ${
                    emailTo.trim()
                      ? 'bg-orange-500 text-white shadow-orange-500/20 hover:bg-orange-400'
                      : 'pointer-events-none bg-zinc-700 text-zinc-400'
                  }`}
                >
                  <Send size={15} /> Open in Gmail — Ready to Send
                </a>
                <button
                  onClick={() => copy('email-draft', `Subject: ${emailSubject}\n\n${emailBody}`)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    cp === 'email-draft'
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {cp === 'email-draft' ? <Check size={15} /> : <Copy size={15} />}
                  {cp === 'email-draft' ? 'Copied!' : 'Copy Email'}
                </button>
              </div>
              {!emailTo.trim() && (
                <div className="text-[11px] text-amber-500/70">Enter a recipient email above to enable Gmail</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ALL SCRIPTS */}
      {activeView === 'scripts' && (
        <>
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
              placeholder="Search scripts..."
              className="min-w-[180px] flex-1 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-300 focus:border-orange-500/50 focus:outline-none"
            />
          </div>

          {scriptsByCategory.map(({ cat, items }) => (
            <div key={cat} className="mb-8">
              <div className="mb-3 flex items-center gap-2 border-b border-zinc-800 pb-2 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
                {items[0].icon} {cat} <span className="text-zinc-600">({items.length})</span>
              </div>
              <div className={`grid gap-3 ${items.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                {items.map((sc) => (
                  <div key={sc.id} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-zinc-100">{sc.title}</div>
                        <div className="text-[11px] italic text-zinc-500">Use: {sc.use}</div>
                      </div>
                      <button
                        onClick={() => copy(sc.id, applyTokens(sc.body))}
                        className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                          cp === sc.id
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                            : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        {cp === sc.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800/50 bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
                      {applyTokens(sc.body)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* 14-DAY CADENCE */}
      {activeView === 'cadence' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 text-xs text-orange-300">
            Follow this 14-day sequence for every new lead. Most deals close after 5-7 touches — don't stop at 2.
          </div>
          {cadence.map((step, idx) => (
            <div key={step.day} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-950 ${step.color}`}>
                  <step.icon size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-mono uppercase tracking-wider text-orange-400">{step.day}</div>
                    <div className="text-[10px] text-zinc-600">Step {idx + 1} / {cadence.length}</div>
                  </div>
                  <div className="mb-1 text-sm font-bold text-zinc-100">{step.action}</div>
                  <div className="mb-2 text-xs leading-relaxed text-zinc-400">{step.detail}</div>
                  <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300/80">
                    <span className="font-bold">Pro tip:</span> {step.tip}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* OBJECTION HANDLING */}
      {activeView === 'objections' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-red-300">
            Every objection is a buying signal in disguise. They're talking to you — that's already a win.
          </div>
          {OBJECTIONS.map((o, i) => (
            <div key={i} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
              <div className="mb-2 flex items-start gap-2">
                <span className="mt-0.5 text-red-400">Q:</span>
                <div className="text-sm font-bold text-red-400">"{o.q}"</div>
              </div>
              <div className="mb-3 flex items-start gap-2">
                <span className="mt-0.5 text-emerald-400">A:</span>
                <div className="text-xs leading-relaxed text-zinc-300">{o.a}</div>
              </div>
              <button
                onClick={() => copy(`obj-${i}`, o.a)}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${
                  cp === `obj-${i}`
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                {cp === `obj-${i}` ? 'Copied!' : 'Copy response'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
