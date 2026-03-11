import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Phone, Mail, Copy, Globe, Search, Briefcase, 
  Sparkles, Microscope, ChevronDown, ChevronUp, 
  Building2, MapPin, User, FileText, MessageSquare, 
  LayoutDashboard, Check, X, Loader2, ClipboardList
} from 'lucide-react';
import { RAW, STATUS, REGIONS, SCRIPTS, OBJECTIONS } from './data';
import { Lead } from './types';
import { generatePitch, researchContact, findNewLeads } from './services/gemini';
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
  const [dbError, setDbError] = useState<string | null>(null);

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

  const [showAiFinder, setShowAiFinder] = useState(false);
  const [aiFinderQuery, setAiFinderQuery] = useState("");
  const [aiFinderLoading, setAiFinderLoading] = useState(false);

  const [showAddLead, setShowAddLead] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState<Partial<Lead>>({
    co: "", city: "", who: "", role: "", pm: "", pm_title: "", parts: "", pitch: "", ph: "", em: "", web: "", t: 2, r: "Other"
  });

  const handleAddLead = async () => {
    if (!newLeadForm.co) return;
    const id = newLeadForm.co.toLowerCase().replace(/[^a-z0-9]+/g, '-') + "-" + Math.random().toString(36).substring(2, 7);
    const lead: Lead = {
      id,
      status: "new",
      notes: "",
      t: newLeadForm.t || 2,
      r: newLeadForm.r || "Other",
      co: newLeadForm.co || "",
      city: newLeadForm.city || "",
      who: newLeadForm.who || "",
      role: newLeadForm.role || "",
      pm: newLeadForm.pm || "",
      pm_title: newLeadForm.pm_title || "",
      parts: newLeadForm.parts || "",
      pitch: newLeadForm.pitch || "",
      ph: newLeadForm.ph || "",
      em: newLeadForm.em || "",
      web: newLeadForm.web || "",
    };
    try {
      await setDoc(doc(db, "leads", id), lead);
      setShowAddLead(false);
      setNewLeadForm({ co: "", city: "", who: "", role: "", pm: "", pm_title: "", parts: "", pitch: "", ph: "", em: "", web: "", t: 2, r: "Other" });
    } catch (e: any) {
      console.error("Error adding lead:", e);
      alert("Error adding lead: " + e.message);
    }
  };

  const handleFindLeads = async () => {
    if (!aiFinderQuery) return;
    setAiFinderLoading(true);
    try {
      const newLeads = await findNewLeads(aiFinderQuery);
      const batch = writeBatch(db);
      newLeads.forEach(lead => {
        // Ensure ID is unique if AI generates a duplicate
        const uniqueId = lead.id + "-" + Math.random().toString(36).substring(2, 7);
        const ref = doc(db, "leads", uniqueId);
        batch.set(ref, { ...lead, id: uniqueId, status: "new", notes: "" });
      });
      await batch.commit();
      setShowAiFinder(false);
      setAiFinderQuery("");
    } catch (e: any) {
      console.error("Error finding leads:", e);
      alert("Error finding leads: " + e.message);
    }
    setAiFinderLoading(false);
  };

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
        
        // Start with all leads from the database
        const mergedLeads = [...dbLeads];
        
        // Add any INIT_LEADS that aren't in the database yet
        INIT_LEADS.forEach(baseLead => {
          if (!mergedLeads.find(l => l.id === baseLead.id)) {
            mergedLeads.push(baseLead);
          }
        });
        
        setLeads(mergedLeads);
      }
      setLoading(false);
      setDbError(null);
    }, (error: any) => {
      console.error("Firestore Error: ", error);
      setDbError(error.message || "Failed to connect to database");
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const setStatus = async (id: string, st: string) => {
    try {
      await setDoc(doc(db, "leads", id), { status: st }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error("Error updating status:", e);
      alert("Error updating status: " + e.message);
    }
  };

  const saveNote = async (id: string, notes: string) => {
    try {
      await setDoc(doc(db, "leads", id), { notes }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error("Error saving notes:", e);
      alert("Error saving notes: " + e.message);
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
        {dbError && (
          <div className="max-w-5xl mx-auto mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400">
            <X size={20} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm mb-1">Database Connection Error</div>
              <div className="text-xs opacity-80 leading-relaxed">
                {dbError}. Changes will not be saved. If you are using a test Firebase project, your security rules may have expired.
              </div>
            </div>
          </div>
        )}

        {tab === "leads" && (
          <div className="max-w-5xl mx-auto">
            <div className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-bold text-zinc-100 tracking-tight mb-1">Aerospace Lead Database v2</h1>
                <p className="text-xs text-zinc-500 font-mono">{filtered.length} of {leads.length} leads · {REGIONS.length - 1} regions · {S.withPM} named purchasing managers</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddLead(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors"
                >
                  + Add Lead
                </button>
                <button
                  onClick={() => setShowAiFinder(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-bold hover:bg-white transition-colors shadow-lg shadow-white/5"
                >
                  <Sparkles size={16} className="text-orange-500" />
                  AI Prospector
                </button>
              </div>
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

      {/* AI Finder Modal */}
      {showAiFinder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAiFinder(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 max-w-2xl w-full shadow-2xl shadow-black" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-lg font-bold text-orange-500 mb-1 flex items-center gap-2">
                  <Sparkles size={20}/> AI Prospector
                </div>
                <div className="text-xs text-zinc-500 font-mono">Find new leads and add them to your database automatically.</div>
              </div>
              <button onClick={() => setShowAiFinder(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Search Query</label>
              <textarea
                value={aiFinderQuery}
                onChange={e => setAiFinderQuery(e.target.value)}
                placeholder="e.g. Find 5 aerospace machine shops in San Diego that might need deburring services"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all min-h-[100px]"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAiFinder(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFindLeads}
                disabled={!aiFinderQuery || aiFinderLoading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {aiFinderLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> Searching...</>
                ) : (
                  <><Search size={16} /> Find Leads</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLead && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddLead(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-black" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-lg font-bold text-zinc-100 mb-1">Add New Lead</div>
                <div className="text-xs text-zinc-500 font-mono">Manually enter a new company into the database.</div>
              </div>
              <button onClick={() => setShowAddLead(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Company Name *</label>
                <input value={newLeadForm.co} onChange={e => setNewLeadForm({...newLeadForm, co: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50" placeholder="Acme Aerospace" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">City</label>
                <input value={newLeadForm.city} onChange={e => setNewLeadForm({...newLeadForm, city: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50" placeholder="Burbank" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Region</label>
                <select value={newLeadForm.r} onChange={e => setNewLeadForm({...newLeadForm, r: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50">
                  {REGIONS.filter(r => r !== "All Regions").map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">General Contact</label>
                <input value={newLeadForm.who} onChange={e => setNewLeadForm({...newLeadForm, who: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Contact Role</label>
                <input value={newLeadForm.role} onChange={e => setNewLeadForm({...newLeadForm, role: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50" placeholder="Owner / GM" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Purchasing Manager</label>
                <input value={newLeadForm.pm} onChange={e => setNewLeadForm({...newLeadForm, pm: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50" placeholder="Jane Smith" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Parts / Industry</label>
                <input value={newLeadForm.parts} onChange={e => setNewLeadForm({...newLeadForm, parts: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50" placeholder="Aerospace components" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Pitch Angle</label>
                <input value={newLeadForm.pitch} onChange={e => setNewLeadForm({...newLeadForm, pitch: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50" placeholder="Why do they need deburring?" />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAddLead(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-zinc-400 hover:text-zinc-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleAddLead} disabled={!newLeadForm.co} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50">
                Save Lead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
