import React, { useEffect, useState } from 'react';
import {
  Phone,
  Mail,
  Copy,
  Globe,
  Search,
  Briefcase,
  Sparkles,
  Microscope,
  ChevronDown,
  ChevronUp,
  User,
  FileText,
  MessageSquare,
  LayoutDashboard,
  Check,
  X,
  Loader2,
  ClipboardList,
  MapPin,
  Menu,
} from 'lucide-react';

import { RAW, STATUS, REGIONS, SCRIPTS, OBJECTIONS } from './data';
import type { Lead, LeadStatus } from './types';
import { generatePitch, researchContact, findNewLeads } from './services/gemini';
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, writeBatch } from 'firebase/firestore';

const safeRaw = Array.isArray(RAW) ? RAW : [];

const INIT_LEADS: Lead[] = safeRaw.map((l) => ({
  ...l,
  status: 'new',
  notes: '',
}));

const EMPTY_LEAD_FORM: Partial<Lead> = {
  co: '',
  city: '',
  who: '',
  role: '',
  pm: '',
  pm_title: '',
  parts: '',
  pitch: '',
  ph: '',
  em: '',
  web: '',
  t: 2,
  r: 'Other',
};

const qs = {
  google: (co: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(
      `"${co}" purchasing manager OR procurement OR owner contact`
    )}`,
  linkedin: (co: string) =>
    `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
      `${co} purchasing manager procurement`
    )}`,
  indeed: (city: string) =>
    `https://www.indeed.com/jobs?q=${encodeURIComponent('deburring')}&l=${encodeURIComponent(
      `${city}, CA`
    )}`,
};

type TabKey = 'leads' | 'outreach';
type AiMode = 'pitch' | 'research';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string;
    providerInfo?: {
      providerId: string;
      displayName?: string;
      email?: string;
      photoUrl?: string;
    }[];
  }
}

function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const msg = error?.message || String(error);
  const code = error?.code || '';

  if (
    code.includes('permission-denied') ||
    msg.toLowerCase().includes('missing or insufficient permissions')
  ) {
    const errInfo: FirestoreErrorInfo = {
      error: msg,
      authInfo: {
        userId: undefined, // Add auth info if you have auth setup
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }
  
  console.error('Firestore Error:', error);
  throw error;
}

export default function App() {
  const [leads, setLeads] = useState<Lead[]>(INIT_LEADS);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>('leads');
  const [regF, setRegF] = useState('All Regions');
  const [stF, setStF] = useState('all');
  const [tierF, setTierF] = useState('all');
  const [pmOnly, setPmOnly] = useState(false);
  const [q, setQ] = useState('');

  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);
  const [cp, setCp] = useState<string | null>(null);

  const [aiModal, setAiModal] = useState<{ lead: Lead; mode: AiMode } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  const [showAiFinder, setShowAiFinder] = useState(false);
  const [aiFinderQuery, setAiFinderQuery] = useState('');
  const [aiFinderLoading, setAiFinderLoading] = useState(false);

  const [showAddLead, setShowAddLead] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState<Partial<Lead>>({ ...EMPTY_LEAD_FORM });

  const handleAddLead = async () => {
    if (!newLeadForm.co?.trim()) return;

    const id =
      newLeadForm.co.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
      '-' +
      Math.random().toString(36).substring(2, 7);

    const lead: Lead = {
      id,
      status: 'new',
      notes: '',
      t: (newLeadForm.t as 1 | 2) ?? 2,
      r: newLeadForm.r ?? 'Other',
      co: newLeadForm.co ?? '',
      city: newLeadForm.city ?? '',
      who: newLeadForm.who ?? '',
      role: newLeadForm.role ?? '',
      pm: newLeadForm.pm ?? '',
      pm_title: newLeadForm.pm_title ?? '',
      parts: newLeadForm.parts ?? '',
      pitch: newLeadForm.pitch ?? '',
      ph: newLeadForm.ph ?? '',
      em: newLeadForm.em ?? '',
      web: newLeadForm.web ?? '',
    };

    try {
      await setDoc(doc(db, 'leads', id), lead);
      setShowAddLead(false);
      setNewLeadForm({ ...EMPTY_LEAD_FORM });
    } catch (e: any) {
      handleFirestoreError(e, OperationType.CREATE, `leads/${id}`);
    }
  };

  const handleFindLeads = async () => {
    if (!aiFinderQuery.trim()) return;

    setAiFinderLoading(true);

    try {
      const newLeads = await findNewLeads(aiFinderQuery);

      if (!Array.isArray(newLeads) || newLeads.length === 0) {
        setShowAiFinder(false);
        setAiFinderQuery('');
        return;
      }

      const batch = writeBatch(db);

      newLeads.forEach((lead: Partial<Lead>, index: number) => {
        const baseId =
          lead.id ||
          (lead.co || `lead-${index}`)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        const uniqueId = `${baseId}-${Math.random().toString(36).substring(2, 7)}`;

        const safeLead: Lead = {
          id: uniqueId,
          status: 'new',
          notes: '',
          co: lead.co ?? '',
          city: lead.city ?? '',
          who: lead.who ?? '',
          role: lead.role ?? '',
          pm: lead.pm ?? '',
          pm_title: lead.pm_title ?? '',
          parts: lead.parts ?? '',
          pitch: lead.pitch ?? '',
          ph: lead.ph ?? '',
          em: lead.em ?? '',
          web: lead.web ?? '',
          t: (lead.t as 1 | 2) ?? 2,
          r: lead.r ?? 'Other',
        };

        batch.set(doc(db, 'leads', uniqueId), safeLead);
      });

      await batch.commit();
      setShowAiFinder(false);
      setAiFinderQuery('');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'leads');
    } finally {
      setAiFinderLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'leads'),
      async (snapshot) => {
        try {
          const dbLeads = snapshot.docs.map((d) => d.data() as Lead);

          if (snapshot.empty) {
            const batch = writeBatch(db);
            INIT_LEADS.forEach((lead) => {
              batch.set(doc(db, 'leads', lead.id), lead);
            });
            await batch.commit();
            setLeads(INIT_LEADS);
          } else {
            const mergedLeads = [...dbLeads];
            const missingBaseLeads = INIT_LEADS.filter(
              (baseLead) => !dbLeads.some((l) => l.id === baseLead.id)
            );

            if (missingBaseLeads.length > 0) {
              const batch = writeBatch(db);
              missingBaseLeads.forEach((lead) => {
                batch.set(doc(db, 'leads', lead.id), lead, { merge: true });
                mergedLeads.push(lead);
              });
              await batch.commit();
            }

            setLeads(mergedLeads);
          }

          setLoading(false);
          setDbError(null);
        } catch (error: any) {
          console.error('Firestore snapshot handling error:', error);
          setDbError(error?.message || 'Failed to process database data');
          setLoading(false);
        }
      },
      (error: any) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'leads');
        } catch (err: any) {
          setDbError(err?.message || 'Failed to connect to database');
        }
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const setStatus = async (id: string, st: LeadStatus) => {
    try {
      await setDoc(doc(db, 'leads', id), { status: st }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `leads/${id}`);
    }
  };

  const saveNote = async (id: string, notes: string) => {
    try {
      await setDoc(doc(db, 'leads', id), { notes }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditId(null);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `leads/${id}`);
    }
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCp(id);
      setTimeout(() => setCp(null), 2200);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  const handleAI = async (lead: Lead, mode: AiMode) => {
    setAiModal({ lead, mode });
    setAiLoading(true);
    setAiText('');

    try {
      const result = mode === 'pitch' ? await generatePitch(lead) : await researchContact(lead);
      setAiText(result || '');
    } catch (e: any) {
      setAiText('Error: ' + (e?.message || 'Unknown error'));
    } finally {
      setAiLoading(false);
    }
  };

  const filtered = leads.filter((l) => {
    if (regF !== 'All Regions' && l.r !== regF) return false;
    if (stF !== 'all' && l.status !== stF) return false;
    if (tierF === '1' && l.t !== 1) return false;
    if (tierF === '2' && l.t !== 2) return false;
    if (pmOnly && !l.pm) return false;

    if (q) {
      const lq = q.toLowerCase();
      return (
        (l.co || '').toLowerCase().includes(lq) ||
        (l.who || '').toLowerCase().includes(lq) ||
        (l.pm || '').toLowerCase().includes(lq) ||
        (l.parts || '').toLowerCase().includes(lq) ||
        (l.city || '').toLowerCase().includes(lq)
      );
    }

    return true;
  });

  const S = {
    total: leads.length,
    t1: leads.filter((l) => l.t === 1).length,
    withPM: leads.filter((l) => !!l.pm).length,
    active: leads.filter((l) => !['new', 'dead', 'client'].includes(l.status)).length,
    warm: leads.filter((l) => l.status === 'interested').length,
    clients: leads.filter((l) => l.status === 'client').length,
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-300">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-orange-500" size={32} />
          <div className="animate-pulse text-sm font-mono text-zinc-500">
            Connecting to Firebase...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 font-sans text-zinc-300 selection:bg-orange-500/30">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-zinc-800/50 bg-zinc-900/90 backdrop-blur-md z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-sm font-bold text-white shadow-lg shadow-orange-500/20">
            SC
          </div>
          <div className="text-sm font-bold tracking-tight text-zinc-100">SC Deburring</div>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-zinc-400 hover:text-zinc-200">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-zinc-800/50 bg-zinc-950 md:bg-zinc-900/50 p-6 transition-transform duration-300 md:static md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div>
          <div className="mb-8 hidden md:flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-lg font-bold text-white shadow-lg shadow-orange-500/20">
              SC
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-zinc-100">SC Deburring</div>
              <div className="mt-0.5 text-[10px] font-mono tracking-widest text-zinc-500">
                PROSPECT HQ
              </div>
            </div>
          </div>

          <nav className="mb-8 space-y-1">
            <button
              onClick={() => { setTab('leads'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold tracking-wide transition-colors ${
                tab === 'leads'
                  ? 'bg-zinc-800/80 text-orange-500'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <LayoutDashboard size={16} />
              LEADS
              <span className="ml-auto rounded-full bg-zinc-950 px-2 py-0.5 text-[10px] font-mono text-zinc-500">
                {leads.length}
              </span>
            </button>

            <button
              onClick={() => { setTab('outreach'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold tracking-wide transition-colors ${
                tab === 'outreach'
                  ? 'bg-zinc-800/80 text-orange-500'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <MessageSquare size={16} />
              OUTREACH
            </button>
          </nav>

          <div className="border-t border-zinc-800/50 pt-5">
            <div className="mb-4 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              Pipeline Status
            </div>

            <div className="space-y-3">
              {[
                { label: 'Total Leads', val: S.total, c: 'text-zinc-400' },
                { label: 'Tier 1 — Call Now', val: S.t1, c: 'text-orange-400' },
                { label: 'Named Contacts', val: S.withPM, c: 'text-emerald-400' },
                { label: 'In Pipeline', val: S.active, c: 'text-blue-400' },
                { label: 'Interested', val: S.warm, c: 'text-green-400' },
                { label: 'Clients', val: S.clients, c: 'text-amber-400' },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{stat.label}</span>
                  <span className={`font-mono text-sm font-bold ${stat.c}`}>{stat.val}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 h-1 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-1000"
                style={{ width: `${Math.round((S.clients / Math.max(S.total, 1)) * 100)}%` }}
              />
            </div>
            <div className="mt-2 text-[10px] font-mono text-zinc-500">
              {Math.round((S.clients / Math.max(S.total, 1)) * 100)}% converted
            </div>
          </div>
        </div>

        <div>
          {saved && (
            <div className="mb-2 flex items-center gap-1 text-[10px] font-mono text-emerald-400">
              <Check size={12} />
              Saved
            </div>
          )}
          <div className="flex w-full items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-400">
            <Sparkles size={14} />
            Gemini AI Active
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="max-h-screen flex-1 overflow-y-auto p-4 pt-20 md:p-8 md:pt-8 w-full">
        {dbError && (
          <div className="mx-auto mb-6 flex max-w-5xl items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
            <X size={20} className="mt-0.5 shrink-0" />
            <div>
              <div className="mb-1 text-sm font-bold">Database Connection Error</div>
              <div className="text-xs leading-relaxed opacity-80">{dbError}</div>
            </div>
          </div>
        )}

        {tab === 'leads' && (
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h1 className="mb-1 text-2xl font-bold tracking-tight text-zinc-100">
                  Aerospace Lead Database v2
                </h1>
                <p className="text-xs font-mono text-zinc-500">
                  {filtered.length} of {leads.length} leads · {REGIONS.length - 1} regions ·{' '}
                  {S.withPM} named purchasing managers
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddLead(true)}
                  className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  + Add Lead
                </button>

                <button
                  onClick={() => setShowAiFinder(true)}
                  className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-bold text-zinc-900 shadow-lg shadow-white/5 transition-colors hover:bg-white"
                >
                  <Sparkles size={16} className="text-orange-500" />
                  AI Prospector
                </button>
              </div>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-3">
              <div className="relative min-w-[200px] flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  size={16}
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search company, contact, city, parts..."
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-8 text-sm text-zinc-200 transition-all focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                />
                {q && (
                  <button
                    onClick={() => setQ('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <select
                value={regF}
                onChange={(e) => setRegF(e.target.value)}
                className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400 focus:border-orange-500/50 focus:outline-none"
              >
                {REGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>

              <select
                value={tierF}
                onChange={(e) => setTierF(e.target.value)}
                className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400 focus:border-orange-500/50 focus:outline-none"
              >
                <option value="all">All Tiers</option>
                <option value="1">Tier 1 — Call Now</option>
                <option value="2">Tier 2 — Target</option>
              </select>

              <select
                value={stF}
                onChange={(e) => setStF(e.target.value)}
                className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400 focus:border-orange-500/50 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                {STATUS.map((st) => (
                  <option key={st.k} value={st.k}>
                    {st.label}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setPmOnly(!pmOnly)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium font-mono transition-colors ${
                  pmOnly
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700'
                }`}
              >
                {pmOnly ? 'Named PM Only' : 'Named PMs Only'}
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="py-20 text-center text-sm text-zinc-500">
                No leads match your filters.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map((lead) => {
                  const st = STATUS.find((s) => s.k === lead.status) || STATUS[0];
                  const isDead = lead.status === 'dead';
                  const isClient = lead.status === 'client';
                  const hasPM = !!lead.pm;
                  const isOpen = openId === lead.id;

                  return (
                    <div
                      key={lead.id}
                      className={`overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/40 transition-all duration-200 hover:border-zinc-700/80 hover:shadow-lg hover:shadow-black/20 ${
                        isDead ? 'opacity-50' : ''
                      }`}
                    >
                      <div
                        className={`flex cursor-pointer items-center justify-between gap-4 border-l-4 p-4 ${
                          isClient
                            ? 'border-l-amber-500'
                            : lead.t === 1
                              ? 'border-l-orange-500'
                              : 'border-l-zinc-800'
                        }`}
                        onClick={() => setOpenId(isOpen ? null : lead.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-zinc-100">{lead.co}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold font-mono ${
                                lead.t === 1
                                  ? 'bg-orange-500/10 text-orange-500'
                                  : 'bg-blue-500/10 text-blue-400'
                              }`}
                            >
                              {lead.t === 1 ? 'T1' : 'T2'}
                            </span>
                            {hasPM && (
                              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold font-mono text-amber-500">
                                PM
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            {hasPM ? (
                              <span className="flex items-center gap-1 font-medium text-amber-500">
                                <User size={12} /> {lead.pm} · {lead.pm_title}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-zinc-500">
                                <User size={12} /> {lead.who}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-zinc-600">
                              <MapPin size={12} /> {lead.city}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-3">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                            style={{ background: st.bg, color: st.tx }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
                            {st.label}
                          </span>
                          <span className="text-zinc-600">
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </span>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="border-t border-zinc-800/50 bg-zinc-900/20 px-4 pb-4 pt-2">
                          <div className="flex flex-wrap gap-2 py-3">
                            {lead.ph && (
                              <a
                                href={`tel:${lead.ph}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
                              >
                                <Phone size={14} /> {lead.ph}
                              </a>
                            )}

                            {lead.em && (
                              <>
                                <a
                                  href={`mailto:${lead.em}`}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
                                >
                                  <Mail size={14} /> Email
                                </a>

                                <button
                                  onClick={() => copy(`em_${lead.id}`, lead.em)}
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                    cp === `em_${lead.id}`
                                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                      : 'border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
                                  }`}
                                >
                                  <Copy size={14} /> {cp === `em_${lead.id}` ? 'Copied!' : 'Copy Email'}
                                </button>
                              </>
                            )}

                            {lead.web && (
                              <a
                                href={lead.web}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-400 transition-colors hover:bg-violet-500/20"
                              >
                                <Globe size={14} /> Site
                              </a>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 border-t border-zinc-800/50 py-3">
                            <a
                              href={qs.google(lead.co)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
                            >
                              <Search size={14} /> Google
                            </a>

                            <a
                              href={qs.linkedin(lead.co)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
                            >
                              <Briefcase size={14} /> LinkedIn
                            </a>

                            <a
                              href={qs.indeed(lead.city)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-500 transition-colors hover:bg-amber-500/20"
                            >
                              <ClipboardList size={14} /> Indeed
                            </a>

                            <button
                              onClick={() => handleAI(lead, 'research')}
                              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/20"
                            >
                              <Microscope size={14} /> Research Contact
                            </button>

                            <button
                              onClick={() => handleAI(lead, 'pitch')}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-500 transition-colors hover:bg-orange-500/20"
                            >
                              <Sparkles size={14} /> AI Pitch
                            </button>
                          </div>

                          <div className="mb-4 grid grid-cols-1 gap-4 rounded-xl border border-zinc-800/50 bg-zinc-950/50 p-4 md:grid-cols-2">
                            {hasPM && (
                              <div className="col-span-1 md:col-span-2">
                                <div className="mb-1 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
                                  Purchasing Manager
                                </div>
                                <div className="text-xs font-semibold text-violet-400">
                                  {lead.pm} — {lead.pm_title}
                                </div>
                              </div>
                            )}

                            {lead.role && (
                              <div>
                                <div className="mb-1 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
                                  Role / Contact
                                </div>
                                <div className="text-xs text-zinc-400">{lead.role}</div>
                              </div>
                            )}

                            {lead.ph && (
                              <div>
                                <div className="mb-1 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
                                  Phone
                                </div>
                                <div className="text-xs text-zinc-400">{lead.ph}</div>
                              </div>
                            )}

                            {lead.em && (
                              <div className="col-span-1 md:col-span-2">
                                <div className="mb-1 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
                                  Email Address
                                </div>
                                <div className="text-xs font-semibold text-violet-400">{lead.em}</div>
                              </div>
                            )}

                            <div className="col-span-1 md:col-span-2">
                              <div className="mb-1 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
                                Parts and Programs
                              </div>
                              <div className="text-xs leading-relaxed text-zinc-400">{lead.parts}</div>
                            </div>

                            <div className="col-span-1 md:col-span-2">
                              <div className="mb-1 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
                                Pitch Angle
                              </div>
                              <div className="text-xs leading-relaxed text-amber-500">{lead.pitch}</div>
                            </div>
                          </div>

                          <div className="mb-4">
                            <div className="mb-2 flex items-center gap-1 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
                              <FileText size={12} />
                              Call Log / Notes
                            </div>

                            {editId === lead.id ? (
                              <div className="space-y-2">
                                <textarea
                                  autoFocus
                                  value={draft}
                                  onChange={(e) => setDraft(e.target.value)}
                                  placeholder="Log calls, follow-ups, who you spoke to, research found..."
                                  className="min-h-[100px] w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => saveNote(lead.id, draft)}
                                    className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditId(null)}
                                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  setEditId(lead.id);
                                  setDraft(lead.notes || '');
                                }}
                                className={`min-h-[44px] cursor-text whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed transition-colors hover:border-zinc-700 ${
                                  lead.notes ? 'text-zinc-300' : 'italic text-zinc-600'
                                }`}
                              >
                                {lead.notes || 'Click to add notes...'}
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="mb-2 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500">
                              Update Status
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {STATUS.map((statusOption) => (
                                <button
                                  key={statusOption.k}
                                  onClick={() => setStatus(lead.id, statusOption.k)}
                                  className="rounded-full border px-3 py-1 text-[11px] font-medium transition-all duration-200"
                                  style={{
                                    background:
                                      lead.status === statusOption.k
                                        ? statusOption.dot
                                        : statusOption.bg,
                                    color: lead.status === statusOption.k ? '#fff' : statusOption.tx,
                                    borderColor: `${statusOption.dot}40`,
                                  }}
                                >
                                  {statusOption.label}
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

        {tab === 'outreach' && (
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
        )}
      </main>

      {aiModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setAiModal(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-lg font-bold text-orange-500">
                  {aiModal.mode === 'pitch' ? (
                    <>
                      <Sparkles size={20} /> AI Pitch Generator
                    </>
                  ) : (
                    <>
                      <Microscope size={20} /> Research Contact
                    </>
                  )}
                </div>
                <div className="text-xs font-mono text-zinc-500">
                  {aiModal.lead.co} · {aiModal.lead.pm || aiModal.lead.who} · {aiModal.lead.city}
                </div>
              </div>

              <button onClick={() => setAiModal(null)} className="text-zinc-500 transition-colors hover:text-zinc-300">
                <X size={24} />
              </button>
            </div>

            {aiLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <Loader2 size={32} className="animate-spin text-orange-500" />
                <div className="text-xs font-mono text-zinc-500">
                  {aiModal.mode === 'pitch' ? 'Generating personalized pitch...' : 'Researching contact info...'}
                </div>
              </div>
            ) : (
              <>
                <pre className="mb-5 whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 p-5 font-mono text-xs leading-relaxed text-zinc-300">
                  {aiText}
                </pre>

                <div className="flex gap-3">
                  <button
                    onClick={() => copy('ai', aiText)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition-all ${
                      cp === 'ai'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-orange-500/30 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20'
                    }`}
                  >
                    {cp === 'ai' ? 'Copied!' : 'Copy to Clipboard'}
                  </button>

                  <button
                    onClick={() => {
                      const stamp = `[${new Date().toLocaleDateString()} — ${
                        aiModal.mode === 'pitch' ? 'AI Pitch' : 'Contact Research'
                      }]\n${aiText}`;
                      void saveNote(
                        aiModal.lead.id,
                        (aiModal.lead.notes ? aiModal.lead.notes + '\n\n' : '') + stamp
                      );
                      setAiModal(null);
                    }}
                    className="flex-1 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2.5 text-sm font-bold text-blue-400 transition-all hover:bg-blue-500/20"
                  >
                    Save to Notes
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showAiFinder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setShowAiFinder(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-lg font-bold text-orange-500">
                  <Sparkles size={20} /> AI Prospector
                </div>
                <div className="text-xs font-mono text-zinc-500">
                  Find new leads and add them to your database automatically.
                </div>
              </div>

              <button onClick={() => setShowAiFinder(false)} className="text-zinc-500 transition-colors hover:text-zinc-300">
                <X size={24} />
              </button>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                Search Query
              </label>
              <textarea
                value={aiFinderQuery}
                onChange={(e) => setAiFinderQuery(e.target.value)}
                placeholder="e.g. Find 5 aerospace machine shops in San Diego that might need deburring services"
                className="min-h-[100px] w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-200 transition-all focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAiFinder(false)}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-zinc-400 transition-colors hover:text-zinc-200"
              >
                Cancel
              </button>

              <button
                onClick={handleFindLeads}
                disabled={!aiFinderQuery.trim() || aiFinderLoading}
                className="flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {aiFinderLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Searching...
                  </>
                ) : (
                  <>
                    <Search size={16} /> Find Leads
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setShowAddLead(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="mb-1 text-lg font-bold text-zinc-100">Add New Lead</div>
                <div className="text-xs font-mono text-zinc-500">
                  Manually enter a new company into the database.
                </div>
              </div>

              <button onClick={() => setShowAddLead(false)} className="text-zinc-500 transition-colors hover:text-zinc-300">
                <X size={24} />
              </button>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Company Name *
                </label>
                <input
                  value={newLeadForm.co ?? ''}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, co: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                  placeholder="Acme Aerospace"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  City
                </label>
                <input
                  value={newLeadForm.city ?? ''}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, city: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                  placeholder="Burbank"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Region
                </label>
                <select
                  value={newLeadForm.r ?? 'Other'}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, r: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                >
                  {REGIONS
                    .filter((r) => r !== 'All Regions')
                    .map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  General Contact
                </label>
                <input
                  value={newLeadForm.who ?? ''}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, who: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Contact Role
                </label>
                <input
                  value={newLeadForm.role ?? ''}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, role: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                  placeholder="Owner / GM"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Purchasing Manager
                </label>
                <input
                  value={newLeadForm.pm ?? ''}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, pm: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                  placeholder="Jane Smith"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  PM Title
                </label>
                <input
                  value={newLeadForm.pm_title ?? ''}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, pm_title: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                  placeholder="Purchasing Manager"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Phone
                </label>
                <input
                  value={newLeadForm.ph ?? ''}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, ph: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                  placeholder="(818) 555-1234"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Email
                </label>
                <input
                  value={newLeadForm.em ?? ''}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, em: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                  placeholder="buyer@company.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Website
                </label>
                <input
                  value={newLeadForm.web ?? ''}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, web: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                  placeholder="https://company.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Tier
                </label>
                <select
                  value={newLeadForm.t ?? 2}
                  onChange={(e) =>
                    setNewLeadForm({ ...newLeadForm, t: Number(e.target.value) as 1 | 2 })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                >
                  <option value={1}>Tier 1 — Call Now</option>
                  <option value={2}>Tier 2 — Target</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Parts / Industry
                </label>
                <input
                  value={newLeadForm.parts ?? ''}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, parts: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                  placeholder="Aerospace components"
                />
              </div>

              <div className="col-span-2">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Pitch Angle
                </label>
                <input
                  value={newLeadForm.pitch ?? ''}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, pitch: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
                  placeholder="Why do they need deburring?"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAddLead(false)}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-zinc-400 transition-colors hover:text-zinc-200"
              >
                Cancel
              </button>

              <button
                onClick={handleAddLead}
                disabled={!newLeadForm.co?.trim()}
                className="rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
              >
                Save Lead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}