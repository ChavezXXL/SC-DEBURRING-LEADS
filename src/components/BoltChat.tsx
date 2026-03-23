import React, { useState, useRef, useEffect } from 'react';
import { Zap, X, Send, Loader2, Trash2, Bot } from 'lucide-react';
import { chatWithBolt } from '../services/gemini';
import type { Lead } from '../types';

interface Message {
  id: string;
  role: 'user' | 'bolt';
  text: string;
  ts: number;
}

interface BoltChatProps {
  leads: Lead[];
}

export function BoltChat({ leads }: BoltChatProps) {
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

      const reply = await chatWithBolt(msg, leads, history);

      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: 'bolt',
          text: reply,
          ts: Date.now(),
        },
      ]);
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

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'bolt',
        text: "Chat cleared. What do you need?",
        ts: Date.now(),
      },
    ]);
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
        <div className="fixed bottom-0 right-0 z-50 flex h-[600px] w-full flex-col border-l border-t border-zinc-800 bg-zinc-950 shadow-2xl sm:bottom-6 sm:right-6 sm:h-[560px] sm:w-[420px] sm:rounded-2xl sm:border">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15">
                <Zap size={16} className="text-orange-500" fill="currentColor" />
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-100">Bolt</div>
                <div className="text-[10px] font-mono text-zinc-500">
                  AI Sales Assistant · {leads.length} leads loaded
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                title="Clear chat"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
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
                      : 'border border-zinc-800/60 bg-zinc-900/60 text-zinc-300'
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-sans">{msg.text}</pre>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-orange-500/10">
                  <Bot size={13} className="text-orange-500" />
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-[13px] text-zinc-500">
                  <Loader2 size={14} className="animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-zinc-800 p-3">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 focus-within:border-orange-500/50 focus-within:ring-1 focus-within:ring-orange-500/50">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Ask Bolt anything..."
                disabled={loading}
                className="flex-1 bg-transparent py-1.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none disabled:opacity-50"
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-white transition-all hover:bg-orange-400 disabled:opacity-30 disabled:hover:bg-orange-500"
              >
                <Send size={13} />
              </button>
            </div>
            <div className="mt-1.5 text-center text-[10px] font-mono text-zinc-600">
              Powered by Gemini AI · SC Precision Deburring
            </div>
          </div>
        </div>
      )}
    </>
  );
}
