import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Phone, Mail, Copy, Globe, Search, Briefcase, 
  Sparkles, Microscope, ChevronDown, ChevronUp, 
  Building2, MapPin, User, FileText, MessageSquare, 
  LayoutDashboard, Check, X, Loader2, ClipboardList
} from 'lucide-react';
import { RAW, STATUS, REGIONS, SCRIPTS, OBJECTIONS } from './data';
import { Lead } from './types';
import { generatePitch, researchContact } from './services/gemini';
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const INIT_LEADS: Lead[] = RAW.map(l => ({ ...l, status: "new", notes: "" }));

const qs = {
  google: (co: string) => `https://www.google.com/search?q=${encodeURIComponent('"' + co + '" purchasing manager OR procurement OR owner contact')}`,
  linkedin: (co: string) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(co + ' purchasing manager procurement')}`,
  indeed: (city: string) => `https://www.indeed.com/jobs?q=${encodeURIComponent('deburring')}&l=${encodeURIComponent(city + ', CA')}`,
};

export default function App() {
  const [leads, setLeads] = useState<Lead[]>(INIT_LEADS);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"leads" | "outreach">("leads");
  const [regF, setRegF] = useState("All Regions");
  const [stF, setStF] = useState("all");
  const [tierF, setTierF] = useState("all");
  const [pmOnly, setPmOnly] = useState(false);
  const [q, setQ] = useState("");
  
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const [cp, setCp] = useState<string | null>(null);
  
  const [aiModal, setAiModal] = useState<{lead: Lead, mode: "pitch" | "research"} | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "leads"), (snapshot) => {
      if (snapshot.empty) {
        // Seed database if empty
        const batch = writeBatch(db);
        INIT_LEADS.forEach(lead => {
          const ref = doc(db, "leads", lead.id);
          batch.set(ref, lead);
        });
        batch.commit().catch(console.error);
        setLeads(INIT_LEADS);
      } else {
        const dbLeads = snapshot.docs.map(d => d.data() as Lead);
        // Merge with INIT_LEADS to ensure we have all base data even if schema changes
        setLeads(INIT_LEADS.map(baseLead => {
          const dbLead = dbLeads.find(l => l.id === baseLead.id);
          return dbLead ? { ...baseLead, ...dbLead } : baseLead;
        }));
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error: ", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const setStatus = async (id: string, st: string) => {
    try {
      await updateDoc(doc(db, "leads", id), { status: st });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Error updating status:", e);
    }
  };

  const saveNote = async (id: string, notes: string) => {
    try {
      await updateDoc(doc(db, "leads", id), { notes });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Error saving notes:", e);
    }
    setEditId(null);
  };

  const copy = (id: string, t: string) => {
    navigator.clipboard.writeText(t).catch(() => {});
    setCp(id);
    setTimeout(() => setCp(null), 2200);
  };

  const handleAI = async (lead: Lead, mode: "pitch" | "research") => {
    setAiModal({ lead, mode });
    setAiLoading(true);
    setAiText("");
    try {
      const result = mode === "pitch" ? await generatePitch(lead) : await researchContact(lead);
      setAiText(result || "");
    } catch (e: any) {
      setAiText("Error: " + e.message);
    }
    setAiLoading(false);
  };

  const filtered = leads.filter(l => {
    if (regF !== "All Regions" && l.r !== regF) return false;
    if (stF !== "all" && l.status !== stF) return false;
    if (tierF === "1" && l.t !== 1) return false;
    if (tierF === "2" && l.t !== 2) return false;
    if (pmOnly && !l.pm) return false;
    if (q) {
      const lq = q.toLowerCase();
      return l.co.toLowerCase().includes(lq) || 
             l.who.toLowerCase().includes(lq) || 
             (l.pm || "").toLowerCase().includes(lq) || 
             l.parts.toLowerCase().includes(lq) || 
             l.city.toLowerCase().includes(lq);
    }
    return true;
  });

  const S = {
    total: leads.length,
    t1: leads.filter(l => l.t === 1).length,
    withPM: leads.filter(l => l.pm).length,
    active: leads.filter(l => !["new", "dead", "client"].includes(l.status)).length,
    warm: leads.filter(l => l.status === "interested").length,
    clients: leads.filter(l => l.status === "client").length,
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-300">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-orange-500" size={32} />
          <div className="text-sm font-mono text-zinc-500 animate-pulse">Connecting to Firebase...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-orange-500/30">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-zinc-900/50 border-r border-zinc-800/50 flex flex-col justify-between p-6 sticky top-0 h-screen overflow-y-auto">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20">
              SC
            </div>
            <div>
              <div className="text-zinc-100 font-bold text-sm tracking-tight">SC Deburring</div>
              <div className="text-zinc-500 text-[10px] font-mono tracking-widest mt-0.5">PROSPECT HQ</div>
            </div>
          </div>

          <nav className="space-y-1 mb-8">
            <button 
              onClick={() => setTab("leads")} 
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-colors ${tab === "leads" ? "bg-zinc-800/80 text-orange-500" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"}`}
            >
              <LayoutDashboard size={16} />
              LEADS
              <span className="ml-auto bg-zinc-950 text-zinc-500 text-[10px] px-2 py-0.5 rounded-full font-mono">{leads.length}</span>
            </button>
            <button 
              onClick={() => setTab("outreach")} 
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-colors ${tab === "outreach" ? "bg-zinc-800/80 text-orange-500" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"}`}
            >
              <MessageSquare size={16} />
              OUTREACH
            </button>
          </nav>

          <div className="pt-5 border-t border-zinc-800/50">
            <div className="text-zinc-500 text-[10px] font-mono tracking-widest mb-4 uppercase">Pipeline Status</div>
            <div className="space-y-3">
              {[
                { label: "Total Leads", val: S.total, c: "text-zinc-400" },
                { label: "Tier 1 — Call Now", val: S.t1, c: "text-orange-400" },
                { label: "Named Contacts", val: S.withPM, c: "text-emerald-400" },
                { label: "In Pipeline", val: S.active, c: "text-blue-400" },
                { label: "Interested", val: S.warm, c: "text-green-400" },
                { label: "Clients", val: S.clients, c: "text-amber-400" },
              ].map(stat => (
                <div key={stat.label} className="flex justify-between items-center">
                  <span className="text-zinc-500 text-xs">{stat.label}</span>
                  <span className={`font-mono font-bold text-sm ${stat.c}`}>{stat.val}</span>
                </div>
              ))}
            </div>
            <div className="h-1 bg-zinc-800 rounded-full mt-5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-1000" style={{ width: `${Math.round(S.clients / Math.max(S.total, 1) * 100)}%` }} />
            </div>
            <div className="text-zinc-500 text-[10px] mt-2 font-mono">{Math.round(S.clients / Math.max(S.total, 1) * 100)}% converted</div>
          </div>
        </div>
        
        <div>
          {saved && <div className="text-emerald-400 text-[10px] font-mono mb-2 flex items-center gap-1"><Check size={12}/> Saved</div>}
          <div className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-emerald-500/20 bg-emerald-500/5 text-emerald-400">
            <Sparkles size={14} />
            Gemini AI Active
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto max-h-screen">
        {tab === "leads" && (
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-zinc-100 tracking-tight mb-1">Aerospace Lead Database</h1>
              <p className="text-xs text-zinc-500 font-mono">{filtered.length} of {leads.length} leads · {REGIONS.length - 1} regions · {S.withPM} named purchasing managers</p>
            </div>

            <div className="flex flex-wrap gap-3 mb-6 items-center bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <input 
                  value={q} 
                  onChange={e => setQ(e.target.value)} 
                  placeholder="Search company, contact, city, parts..." 
                  className="w-full pl-9 pr-8 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all"
                />
                {q && <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"><X size={16}/></button>}
              </div>
              
              <select value={regF} onChange={e => setRegF(e.target.value)} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-400 focus:outline-none focus:border-orange-500/50 cursor-pointer">
                {REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
              
              <select value={tierF} onChange={e => setTierF(e.target.value)} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-400 focus:outline-none focus:border-orange-500/50 cursor-pointer">
                <option value="all">All Tiers</option>
                <option value="1">Tier 1 — Call Now</option>
                <option value="2">Tier 2 — Target</option>
              </select>
              
              <select value={stF} onChange={e => setStF(e.target.value)} className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-400 focus:outline-none focus:border-orange-500/50 cursor-pointer">
                <option value="all">All Statuses</option>
                {STATUS.map(st => <option key={st.k} value={st.k}>{st.label}</option>)}
              </select>
              
              <button 
                onClick={() => setPmOnly(!pmOnly)} 
                className={`px-3 py-2 border rounded-lg text-xs font-mono font-medium transition-colors ${pmOnly ? "bg-amber-500/10 text-amber-500 border-amber-500/30" : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700"}`}
              >
                {pmOnly ? "Named PM Only" : "Named PMs Only"}
              </button>
              
              {(q || regF !== "All Regions" || tierF !== "all" || stF !== "all" || pmOnly) && (
                <button onClick={() => { setQ(""); setRegF("All Regions"); setTierF("all"); setStF("all"); setPmOnly(false); }} className="px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                  Reset
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-20 text-zinc-500 text-sm">No leads match your filters.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map(lead => {
                  const st = STATUS.find(s => s.k === lead.status) || STATUS[0];
                  const isDead = lead.status === "dead";
                  const isClient = lead.status === "client";
                  const hasPM = !!lead.pm;
                  const isOpen = openId === lead.id;

                  return (
                    <div key={lead.id} className={`bg-zinc-900/40 border border-zinc-800/60 rounded-xl transition-all duration-200 ${isDead ? 'opacity-50' : ''} hover:border-zinc-700/80 hover:shadow-lg hover:shadow-black/20 overflow-hidden`}>
                      <div 
                        className={`p-4 cursor-pointer flex items-center justify-between gap-4 border-l-4 ${isClient ? 'border-l-amber-500' : lead.t === 1 ? 'border-l-orange-500' : 'border-l-zinc-800'}`}
                        onClick={() => setOpenId(isOpen ? null : lead.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-sm text-zinc-100">{lead.co}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${lead.t === 1 ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-400'}`}>
                              {lead.t === 1 ? "T1" : "T2"}
                            </span>
                            {hasPM && <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-mono font-bold border border-amber-500/20">PM</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            {hasPM ? (
                              <span className="text-amber-500 font-medium flex items-center gap-1"><User size={12}/> {lead.pm} · {lead.pm_title}</span>
                            ) : (
                              <span className="text-zinc-500 flex items-center gap-1"><User size={12}/> {lead.who}</span>
                            )}
                            <span className="text-zinc-600 flex items-center gap-1"><MapPin size={12}/> {lead.city}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-medium" style={{ background: st.bg, color: st.tx }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                            {st.label}
                          </span>
                          <span className="text-zinc-600">
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </span>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="px-4 pb-4 pt-2 border-t border-zinc-800/50 bg-zinc-900/20">
                          <div className="flex flex-wrap gap-2 py-3">
                            {lead.ph && (
                              <a href={`tel:${lead.ph}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors">
                                <Phone size={14} /> {lead.ph}
                              </a>
                            )}
                            {lead.em && (
                              <>
                                <a href={`mailto:${lead.em}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors">
                                  <Mail size={14} /> Email
                                </a>
                                <button onClick={() => copy("em_" + lead.id, lead.em)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${cp === "em_" + lead.id ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20"}`}>
                                  <Copy size={14} /> {cp === "em_" + lead.id ? "Copied!" : "Copy Email"}
                                </button>
                              </>
                            )}
                            {lead.web && (
                              <a href={lead.web} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-lg hover:bg-violet-500/20 transition-colors">
                                <Globe size={14} /> Site
                              </a>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 py-3 border-t border-zinc-800/50">
                            <a href={qs.google(lead.co)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors">
                              <Search size={14} /> Google
                            </a>
                            <a href={qs.linkedin(lead.co)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors">
                              <Briefcase size={14} /> LinkedIn
                            </a>
                            <a href={qs.indeed(lead.city)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors">
                              <ClipboardList size={14} /> Indeed
                            </a>
                            <button onClick={() => handleAI(lead, "research")} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 transition-colors ml-auto">
                              <Microscope size={14} /> Research Contact
                            </button>
                            <button onClick={() => handleAI(lead, "pitch")} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 transition-colors">
                              <Sparkles size={14} /> AI Pitch
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-950/50 rounded-xl p-4 mb-4 border border-zinc-800/50">
                            {hasPM && (
                              <div className="col-span-1 md:col-span-2">
                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono mb-1">Purchasing Manager</div>
                                <div className="text-xs text-violet-400 font-semibold">{lead.pm} — {lead.pm_title}</div>
                              </div>
                            )}
                            {lead.role && (
                              <div>
                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono mb-1">Role / Contact</div>
                                <div className="text-xs text-zinc-400">{lead.role}</div>
                              </div>
                            )}
                            {lead.ph && (
                              <div>
                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono mb-1">Phone</div>
                                <div className="text-xs text-zinc-400">{lead.ph}</div>
                              </div>
                            )}
                            {lead.em && (
                              <div className="col-span-1 md:col-span-2">
                                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono mb-1">Email Address</div>
                                <div className="text-xs text-violet-400 font-semibold">{lead.em}</div>
                              </div>
                            )}
                            <div className="col-span-1 md:col-span-2">
                              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono mb-1">Parts and Programs</div>
                              <div className="text-xs text-zinc-400 leading-relaxed">{lead.parts}</div>
                            </div>
                            <div className="col-span-1 md:col-span-2">
                              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono mb-1">Pitch Angle</div>
                              <div className="text-xs text-amber-500 leading-relaxed">{lead.pitch}</div>
                            </div>
                          </div>

                          <div className="mb-4">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono mb-2 flex items-center gap-1"><FileText size={12}/> Call Log / Notes</div>
                            {editId === lead.id ? (
                              <div className="space-y-2">
                                <textarea 
                                  autoFocus 
                                  value={draft} 
                                  onChange={e => setDraft(e.target.value)} 
                                  placeholder="Log calls, follow-ups, who you spoke to, research found..." 
                                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 min-h-[100px] focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 resize-y"
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => saveNote(lead.id, draft)} className="px-4 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors">Save</button>
                                  <button onClick={() => setEditId(null)} className="px-4 py-1.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-xs font-medium hover:bg-zinc-700 transition-colors">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div 
                                onClick={() => { setEditId(lead.id); setDraft(lead.notes || ""); }} 
                                className={`p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs cursor-text min-h-[44px] whitespace-pre-wrap leading-relaxed transition-colors hover:border-zinc-700 ${lead.notes ? "text-zinc-300" : "text-zinc-600 italic"}`}
                              >
                                {lead.notes || "Click to add notes..."}
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono mb-2">Update Status</div>
                            <div className="flex flex-wrap gap-2">
                              {STATUS.map(st => (
                                <button 
                                  key={st.k} 
                                  onClick={() => setStatus(lead.id, st.k)} 
                                  className="px-3 py-1 text-[11px] rounded-full font-medium border transition-all duration-200"
                                  style={{
                                    background: lead.status === st.k ? st.dot : st.bg,
                                    color: lead.status === st.k ? "#fff" : st.tx,
                                    borderColor: st.dot + "40"
                                  }}
                                >
                                  {st.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "outreach" && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-zinc-100 tracking-tight mb-1">Outreach Scripts</h1>
              <p className="text-xs text-zinc-500 font-mono">7 battle-tested scripts + objection handling</p>
            </div>

            <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-6 mb-10">
              <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest font-mono mb-3">Memorize this one-liner</div>
              <div className="text-lg text-amber-100/90 leading-relaxed font-light italic">
                "We're SC Precision Deburring in Pacoima — 35 years aerospace deburring. We take deburring off machinists' plates so your CNCs stay running. Can I earn a test job?"
              </div>
            </div>

            {["Cold Call", "Email", "Text", "Walk-In", "LinkedIn"].map(cat => {
              const items = SCRIPTS.filter(sc => sc.cat === cat);
              if (!items.length) return null;
              return (
                <div key={cat} className="mb-10">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono pb-2 border-b border-zinc-800 mb-4 flex items-center gap-2">
                    {items[0].icon} {cat}
                  </div>
                  <div className={`grid gap-4 ${items.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                    {items.map(sc => (
                      <div key={sc.id} className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-5">
                        <div className="flex justify-between items-start mb-4 gap-4">
                          <div>
                            <div className="font-bold text-sm text-zinc-100 mb-1">{sc.title}</div>
                            <div className="text-[11px] text-zinc-500 italic">Use: {sc.use}</div>
                          </div>
                          <button 
                            onClick={() => copy(sc.id, sc.body)} 
                            className={`shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors ${cp === sc.id ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-800'}`}
                          >
                            {cp === sc.id ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <pre className="bg-zinc-950 border border-zinc-800/50 rounded-lg p-4 text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap font-mono">
                          {sc.body}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono pb-2 border-b border-zinc-800 mb-4">
                Objection Handling
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {OBJECTIONS.map((o, i) => (
                  <div key={i} className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4">
                    <div className="font-bold text-xs text-red-400 mb-2">"{o.q}"</div>
                    <div className="text-xs text-zinc-400 leading-relaxed">→ {o.a}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* AI Modal */}
      {aiModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAiModal(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl shadow-black" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-lg font-bold text-orange-500 mb-1 flex items-center gap-2">
                  {aiModal.mode === "pitch" ? <><Sparkles size={20}/> AI Pitch Generator</> : <><Microscope size={20}/> Research Contact</>}
                </div>
                <div className="text-xs text-zinc-500 font-mono">{aiModal.lead.co} · {aiModal.lead.pm || aiModal.lead.who} · {aiModal.lead.city}</div>
              </div>
              <button onClick={() => setAiModal(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={24} />
              </button>
            </div>

            {aiLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 size={32} className="text-orange-500 animate-spin" />
                <div className="text-xs text-zinc-500 font-mono">
                  {aiModal.mode === "pitch" ? "Generating personalized pitch..." : "Researching contact info..."}
                </div>
              </div>
            ) : (
              <>
                <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap mb-5 font-mono">
                  {aiText}
                </pre>
                <div className="flex gap-3">
                  <button 
                    onClick={() => copy("ai", aiText)} 
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${cp === "ai" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-orange-500/10 border-orange-500/30 text-orange-500 hover:bg-orange-500/20"}`}
                  >
                    {cp === "ai" ? "Copied!" : "Copy to Clipboard"}
                  </button>
                  <button 
                    onClick={() => {
                      const stamp = `[${new Date().toLocaleDateString()} — ${aiModal.mode === "pitch" ? "AI Pitch" : "Contact Research"}]\n${aiText}`;
                      saveNote(aiModal.lead.id, (aiModal.lead.notes ? aiModal.lead.notes + "\n\n" : "") + stamp);
                      setAiModal(null);
                    }} 
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
                  >
                    Save to Notes
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
