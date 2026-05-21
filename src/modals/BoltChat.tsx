import React, { useState, useRef, useEffect } from 'react';
import { Zap, X, Send, Loader2, Trash2, Bot, Plus, Check, Search } from 'lucide-react';
import { chatWithBolt, findNewLeads } from '../services/gemini';
import type { Lead } from '../types';

interface Message {
  id: string;
  role: 'user' | 'bolt';
  text: string;
  ts: number;
  /** If Bolt found companies, attach them here so we can render Add buttons */
  foundLeads?: Lead[];
}

interface BoltChatProps {
  leads: Lead[];
  onAddLead?: (lead: Lead) => void;
}

export function BoltChat({ leads, onAddLead }: BoltChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'bolt',
      text: "Hey, I'm Bolt — your AI sales assistant. Ask me anything:\n\n• \"Find deburring leads in Orange County\"\n• \"Show me all Tier 1 leads with no contact\"\n• \"Write a cold email for [company]\"\n• \"What's my pipeline looking like?\"\n\nWhat do you need?",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Detect if user wants to find new companies
  const isFindRequest = (msg: string) => {
    const lower = msg.toLowerCase();
    const findWords = ['find', 'search', 'look for', 'get me', 'show me new', 'prospect', 'discover', 'hunt', 'give me', 'new leads', 'more leads', 'add companies', 'add leads', 'find me'];
    const targetWords = ['lead', 'compan', 'shop', 'manufacturer', 'machine', 'vendor', 'supplier', 'business', 'prospect', 'client', 'in orange', 'in san', 'in los', 'in the valley', 'in socal', 'county', 'area', 'deburring'];
    const hasFindWord = findWords.some(w => lower.includes(w));
    const hasTargetWord = targetWords.some(w => lower.includes(w));
    // Also trigger if they say "find leads in [place]" or "find [anything] in [place]"
    const directPattern = /find.*(?:in |near |around )/i.test(msg);
    return (hasFindWord && hasTargetWord) || directPattern;
  };

  // Detect if user is asking about a specific company (URL or company name)
  const isCompanyLookup = (msg: string) => {
    const lower = msg.toLowerCase();
    const hasUrl = /https?:\/\//.test(msg) || /www\./.test(msg) || /\.com|\.net|\.org|\.io/.test(lower);
    const lookupWords = ['tell me about', 'look up', 'research', 'check out', 'what about', 'who to contact', 'add this', 'add them'];
    const hasLookup = lookupWords.some(w => lower.includes(w));
    return hasUrl || hasLookup;
  };

  // Search for companies and show add buttons
  const [searching, setSearching] = useState(false);
  const handleFindCompanies = async (query: string) => {
    setSearching(true);
    try {
      const newLeads = await findNewLeads(query);
      if (newLeads.length > 0) {
        const existingNames = new Set(leads.map(l => l.co.toLowerCase()));
        const freshLeads = newLeads.filter(l => !existingNames.has((l.co || '').toLowerCase()));
        setMessages((prev) => [
          ...prev,
          {
            id: `f-${Date.now()}`,
            role: 'bolt',
            text: freshLeads.length > 0
              ? `Found ${freshLeads.length} new companies! Hit + to add any to your database:`
              : `Found ${newLeads.length} companies but they're all already in your leads.`,
            ts: Date.now(),
            foundLeads: freshLeads.length > 0 ? freshLeads : undefined,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: `f-${Date.now()}`, role: 'bolt', text: "Couldn't find new companies for that search. Try a different area or industry.", ts: Date.now() },
        ]);
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { id: `f-${Date.now()}`, role: 'bolt', text: `Search failed: ${e?.message || 'Try again.'}`, ts: Date.now() },
      ]);
    }
    setSearching(false);
  };

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: msg,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, text: m.text }));

      // Always get Bolt's text reply
      const reply = await chatWithBolt(msg, leads, history);

      // If it's a company lookup, try to extract company info and offer Add button
      if (isCompanyLookup(msg)) {
        // Try to extract company name from Bolt's reply
        const companyMatch = reply.match(/\*\*(?:Company|Company Overview|About)\*\*[:\s]*([^\n*]+)/i)
          || reply.match(/(?:about|talk about|found)\s+([A-Z][A-Za-z\s&.,']+?)(?:\.|,|\n|located)/i);
        const companyName = companyMatch?.[1]?.trim() || '';

        // Extract other details from reply
        const cityMatch = reply.match(/(?:located (?:at|in).*?,\s*)([A-Za-z\s]+),\s*CA/i) || reply.match(/([A-Za-z\s]+),\s*CA/);
        const phoneMatch = reply.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
        const webMatch = msg.match(/https?:\/\/[^\s]+/) || reply.match(/https?:\/\/[^\s]+/);

        if (companyName) {
          const leadId = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
          const alreadyExists = leads.some(l => l.co.toLowerCase() === companyName.toLowerCase());

          const newLead: Lead = {
            id: leadId,
            t: 2,
            r: 'Other',
            co: companyName,
            city: cityMatch?.[1]?.trim() || '',
            ph: phoneMatch?.[0] || '',
            em: '',
            web: webMatch?.[0]?.replace(/[).,]+$/, '') || '',
            who: '',
            role: '',
            pm: '',
            pm_title: '',
            parts: '',
            pitch: '',
            status: 'new',
            notes: '',
          };

          setMessages((prev) => [
            ...prev,
            {
              id: `b-${Date.now()}`,
              role: 'bolt',
              text: reply,
              ts: Date.now(),
              foundLeads: alreadyExists ? undefined : [newLead],
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { id: `b-${Date.now()}`, role: 'bolt', text: reply, ts: Date.now() },
          ]);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { id: `b-${Date.now()}`, role: 'bolt', text: reply, ts: Date.now() },
        ]);
      }

      // If it's a find request, ALSO search for structured leads to add
      if (isFindRequest(msg)) {
        handleFindCompanies(msg);
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'bolt',
          text: `Error: ${e?.message || 'Something went wrong. Try again.'}`,
          ts: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLead = (lead: Lead) => {
    if (onAddLead) {
      onAddLead(lead);
      setAddedIds((prev) => new Set(prev).add(lead.id));
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'bolt',
        text: "Chat cleared. What do you need?",
        ts: Date.now(),
      },
    ]);
    setAddedIds(new Set());
  };

  return (
    <>
      {/* Floating Bolt Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/25 transition-all hover:scale-110 hover:bg-orange-400 hover:shadow-orange-500/40 active:scale-95"
        >
          <Zap size={24} fill="currentColor" />
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-0 right-0 z-50 flex h-[600px] w-full flex-col border-l border-t border-slate-200 bg-white shadow-2xl sm:bottom-6 sm:right-6 sm:h-[560px] sm:w-[420px] sm:rounded-2xl sm:border">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15">
                <Zap size={16} className="text-orange-500" fill="currentColor" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Bolt</div>
                <div className="text-[10px] font-mono text-slate-400">
                  AI Sales Assistant · {leads.length} leads loaded
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                title="Clear chat"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id}>
                <div
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {msg.role === 'bolt' && (
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-orange-500/10">
                      <Bot size={13} className="text-orange-500" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-orange-500 text-white'
                        : 'border border-slate-200 bg-white/60 text-slate-700'
                    }`}
                  >
                    <pre className="whitespace-pre-wrap font-sans">{msg.text}</pre>
                  </div>
                </div>

                {/* Found leads with Add buttons */}
                {msg.foundLeads && msg.foundLeads.length > 0 && (
                  <div className="ml-8 mt-2 space-y-1.5">
                    {msg.foundLeads.map((fl) => {
                      const isAdded = addedIds.has(fl.id);
                      return (
                        <div
                          key={fl.id}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-slate-800 truncate">
                              {fl.co}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {fl.city} · {fl.parts || 'Manufacturing'} {fl.em ? `· ${fl.em}` : ''}
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddLead(fl)}
                            disabled={isAdded}
                            className={`ml-2 flex h-7 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold transition-all ${
                              isAdded
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-orange-500 text-white hover:bg-orange-400'
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <Check size={12} /> Added
                              </>
                            ) : (
                              <>
                                <Plus size={12} /> Add
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-orange-500/10">
                  <Bot size={13} className="text-orange-500" />
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2.5 text-[13px] text-slate-400">
                  <Loader2 size={14} className="animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-1.5 border-t border-slate-200 px-3 pt-2">
            <button
              onClick={() => {
                setInput('Find machining leads in Orange County');
                // Auto-send after a tick so input state updates
                setTimeout(() => {
                  const fakeMsg = 'Find machining leads in Orange County';
                  const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: fakeMsg, ts: Date.now() };
                  setMessages((prev) => [...prev, userMsg]);
                  setLoading(true);
                  setInput('');
                  chatWithBolt(fakeMsg, leads, []).then(reply => {
                    setMessages((prev) => [...prev, { id: `b-${Date.now()}`, role: 'bolt', text: reply, ts: Date.now() }]);
                    handleFindCompanies(fakeMsg);
                  }).catch(() => {}).finally(() => setLoading(false));
                }, 50);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] text-slate-500 transition-colors hover:border-orange-500/30 hover:text-orange-400"
            >
              <Search size={10} className="mr-1 inline" />Find leads
            </button>
            <button
              onClick={() => { setInput('Write a cold email for '); inputRef.current?.focus(); }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] text-slate-500 transition-colors hover:border-orange-500/30 hover:text-orange-400"
            >
              Email draft
            </button>
            <button
              onClick={() => { setInput("What's my pipeline looking like?"); }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] text-slate-500 transition-colors hover:border-orange-500/30 hover:text-orange-400"
            >
              Pipeline stats
            </button>
          </div>

          {/* Input */}
          <div className="border-t-0 p-3 pt-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 focus-within:border-orange-500/50 focus-within:ring-1 focus-within:ring-orange-500/50">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Ask Bolt anything..."
                disabled={loading || searching}
                className="flex-1 bg-transparent py-1.5 text-sm text-slate-800 placeholder-slate-400 outline-none disabled:opacity-50"
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading || searching}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-white transition-all hover:bg-orange-400 disabled:opacity-30 disabled:hover:bg-orange-500"
              >
                <Send size={13} />
              </button>
            </div>
            <div className="mt-1.5 text-center text-[10px] font-mono text-slate-300">
              {searching ? 'Searching for companies...' : 'Powered by Gemini AI · SC Precision Deburring'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
