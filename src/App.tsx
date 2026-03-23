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
  Trash2,
} from 'lucide-react';

import { RAW, STATUS, REGIONS, SCRIPTS, OBJECTIONS } from './data';
import type { Lead, LeadStatus, TabKey, AiMode } from './types';
import { generatePitch, researchContact, findNewLeads } from './services/gemini';
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, writeBatch, deleteDoc, deleteField } from 'firebase/firestore';

import { Sidebar } from './components/Sidebar';
import { OutreachTab } from './components/OutreachTab';
import { LeadCard } from './components/LeadCard';
import { AddLeadModal } from './components/AddLeadModal';
import { AiModal } from './components/AiModal';
import { AiFinderModal } from './components/AiFinderModal';
import { DeleteModal } from './components/DeleteModal';
import { FancyLogo } from './components/FancyLogo';
import { BoltChat } from './components/BoltChat';
import { AiBrain } from './components/AiBrain';

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

import { PipelineTab } from './components/PipelineTab';

export default function App() {
  const [leads, setLeads] = useState<Lead[]>(INIT_LEADS);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>('leads');
  const [regF, setRegF] = useState('All Regions');
  const [stF, setStF] = useState('all');
  const [tierF, setTierF] = useState('all');
  const [pmOnly, setPmOnly] = useState(false);
  const [remindersOnly, setRemindersOnly] = useState(false);
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
  const [deleteModal, setDeleteModal] = useState<{ id: string; co: string } | null>(null);
  const [appError, setAppError] = useState<string | null>(null);

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
      ...(newLeadForm.reminderDate ? { reminderDate: newLeadForm.reminderDate } : {}),
    };

    try {
      await setDoc(doc(db, 'leads', id), lead);
      setShowAddLead(false);
      setNewLeadForm({ ...EMPTY_LEAD_FORM });
    } catch (e: any) {
      try {
        handleFirestoreError(e, OperationType.CREATE, `leads/${id}`);
      } catch (err: any) {
        let msg = err.message;
        try { msg = JSON.parse(msg).error || msg; } catch {}
        setAppError('Database Error: ' + msg);
        throw err;
      }
    }
  };

  const handleFindLeads = async () => {
    if (!aiFinderQuery.trim()) return;

    setAiFinderLoading(true);

    let newLeads;
    try {
      newLeads = await findNewLeads(aiFinderQuery);
    } catch (e: any) {
      console.error('AI Error finding leads:', e);
      setAppError('Error generating leads from AI: ' + (e?.message || String(e)));
      setAiFinderLoading(false);
      return;
    }

    if (!Array.isArray(newLeads) || newLeads.length === 0) {
      setAppError('No leads found. Try a different search query.');
      setShowAiFinder(false);
      setAiFinderQuery('');
      setAiFinderLoading(false);
      return;
    }

    try {
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
          ...(lead.reminderDate ? { reminderDate: lead.reminderDate } : {}),
        };

        batch.set(doc(db, 'leads', uniqueId), safeLead);
      });

      await batch.commit();
      setShowAiFinder(false);
      setAiFinderQuery('');
    } catch (e: any) {
      try {
        handleFirestoreError(e, OperationType.WRITE, 'leads');
      } catch (err: any) {
        let msg = err.message;
        try { msg = JSON.parse(msg).error || msg; } catch {}
        setAppError('Database Error: ' + msg);
        throw err;
      }
    } finally {
      setAiFinderLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'leads'),
      async (snapshot) => {
        try {
          const dbLeads = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Lead);

          if (snapshot.empty) {
            setLeads(INIT_LEADS); // Set leads immediately
            
            try {
              const batch = writeBatch(db);
              INIT_LEADS.forEach((lead) => {
                batch.set(doc(db, 'leads', lead.id), lead);
              });
              await batch.commit();
            } catch (e) {
              console.warn('Could not write init leads to DB (might be read-only):', e);
            }
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
              
              setLeads(mergedLeads); // Set leads immediately so UI updates
              
              try {
                await batch.commit();
              } catch (e) {
                console.warn('Could not write missing base leads to DB (might be read-only):', e);
              }
            } else {
              setLeads(mergedLeads);
            }
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
      try {
        handleFirestoreError(e, OperationType.UPDATE, `leads/${id}`);
      } catch (err: any) {
        let msg = err.message;
        try { msg = JSON.parse(msg).error || msg; } catch {}
        setAppError('Database Error: ' + msg);
        throw err;
      }
    }
  };

  const saveNote = async (id: string, notes: string) => {
    try {
      await setDoc(doc(db, 'leads', id), { notes }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditId(null);
    } catch (e: any) {
      try {
        handleFirestoreError(e, OperationType.UPDATE, `leads/${id}`);
      } catch (err: any) {
        let msg = err.message;
        try { msg = JSON.parse(msg).error || msg; } catch {}
        setAppError('Database Error: ' + msg);
        throw err;
      }
    }
  };

  const setReminder = async (id: string, reminderDate: string | null) => {
    try {
      if (reminderDate === null) {
        await setDoc(doc(db, 'leads', id), { reminderDate: deleteField() }, { merge: true });
      } else {
        await setDoc(doc(db, 'leads', id), { reminderDate }, { merge: true });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      try {
        handleFirestoreError(e, OperationType.UPDATE, `leads/${id}`);
      } catch (err: any) {
        let msg = err.message;
        try { msg = JSON.parse(msg).error || msg; } catch {}
        setAppError('Database Error: ' + msg);
        throw err;
      }
    }
  };

  const handleDeleteLead = async (id: string) => {
    // Save scroll position so we can restore after re-render
    const scrollEl = document.querySelector('main');
    const scrollPos = scrollEl?.scrollTop || 0;
    try {
      await deleteDoc(doc(db, 'leads', id));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (openId === id) setOpenId(null);
      setDeleteModal(null);
      // Restore scroll position after React re-renders
      requestAnimationFrame(() => {
        if (scrollEl) scrollEl.scrollTop = scrollPos;
      });
    } catch (e: any) {
      try {
        handleFirestoreError(e, OperationType.DELETE, `leads/${id}`);
      } catch (err: any) {
        let msg = err.message;
        try { msg = JSON.parse(msg).error || msg; } catch {}
        setAppError('Database Error: ' + msg);
        throw err;
      }
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
    
    if (stF === 'active') {
      if (['new', 'dead', 'client'].includes(l.status)) return false;
    } else if (stF !== 'all' && l.status !== stF) {
      return false;
    }

    if (tierF === '1' && l.t !== 1) return false;
    if (tierF === '2' && l.t !== 2) return false;
    if (pmOnly && !l.pm) return false;
    if (remindersOnly && !l.reminderDate) return false;

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

  if (remindersOnly) {
    filtered.sort((a, b) => {
      if (!a.reminderDate) return 1;
      if (!b.reminderDate) return -1;
      return new Date(a.reminderDate).getTime() - new Date(b.reminderDate).getTime();
    });
  }

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
          <FancyLogo className="h-8 w-8 drop-shadow-lg" />
          <div className="text-sm font-bold tracking-tight text-zinc-100">SC Deburring</div>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-zinc-400 hover:text-zinc-200">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <Sidebar
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        tab={tab}
        setTab={setTab}
        leads={leads}
        saved={saved}
        onPipelineClick={(filterType) => {
          setTab('leads');
          setMobileMenuOpen(false);
          setQ('');
          setRemindersOnly(false);
          
          if (filterType === 'total') {
            setStF('all');
            setTierF('all');
            setPmOnly(false);
          } else if (filterType === 't1') {
            setStF('all');
            setTierF('1');
            setPmOnly(false);
          } else if (filterType === 'pm') {
            setStF('all');
            setTierF('all');
            setPmOnly(true);
          } else if (filterType === 'active') {
            setStF('active');
            setTierF('all');
            setPmOnly(false);
          } else if (filterType === 'warm') {
            setStF('interested');
            setTierF('all');
            setPmOnly(false);
          } else if (filterType === 'clients') {
            setStF('client');
            setTierF('all');
            setPmOnly(false);
          }
        }}
      />

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

        {appError && (
          <div className="mx-auto mb-6 flex max-w-5xl items-start justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 shadow-lg">
            <div className="flex gap-3">
              <X size={20} className="mt-0.5 shrink-0" />
              <div>
                <div className="mb-1 text-sm font-bold">Error</div>
                <div className="text-xs leading-relaxed opacity-80">{appError}</div>
              </div>
            </div>
            <button onClick={() => setAppError(null)} className="shrink-0 p-1 hover:bg-red-500/20 rounded-md transition-colors">
              <X size={16} />
            </button>
          </div>
        )}

        {tab === 'leads' && (
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h1 className="mb-1 text-2xl font-bold tracking-tight text-zinc-100">
                  Aerospace Lead Database
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
                <option value="active">Active Pipeline</option>
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

              <button
                onClick={() => setRemindersOnly(!remindersOnly)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium font-mono transition-colors ${
                  remindersOnly
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700'
                }`}
              >
                {remindersOnly ? 'Reminders Only' : 'Reminders'}
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="py-20 text-center text-sm text-zinc-500">
                No leads match your filters.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    openId={openId}
                    setOpenId={setOpenId}
                    editId={editId}
                    setEditId={setEditId}
                    draft={draft}
                    setDraft={setDraft}
                    setStatus={setStatus}
                    saveNote={saveNote}
                    setReminder={setReminder}
                    setDeleteModal={setDeleteModal}
                    handleAI={handleAI}
                    cp={cp}
                    copy={copy}
                    qs={qs}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'outreach' && <OutreachTab />}
        {tab === 'pipeline' && (
          <PipelineTab
            leads={leads}
            onLeadClick={(id) => {
              setTab('leads');
              setRegF('All Regions');
              setStF('all');
              setTierF('all');
              setPmOnly(false);
              setRemindersOnly(false);
              setQ('');
              setOpenId(id);
              
              // Scroll to the lead after a short delay to allow rendering
              setTimeout(() => {
                const el = document.getElementById(`lead-${id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 100);
            }}
          />
        )}
        {tab === 'brain' && (
          <AiBrain
            leads={leads}
            onLeadClick={(id) => {
              setTab('leads');
              setRegF('All Regions');
              setStF('all');
              setTierF('all');
              setPmOnly(false);
              setRemindersOnly(false);
              setQ('');
              setOpenId(id);
              setTimeout(() => {
                const el = document.getElementById(`lead-${id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 100);
            }}
            onDeleteLead={(id, co) => setDeleteModal({ id, co })}
            setStatus={setStatus}
          />
        )}
      </main>

      {deleteModal && (
        <DeleteModal
          deleteModal={deleteModal}
          setDeleteModal={setDeleteModal}
          handleDeleteLead={handleDeleteLead}
        />
      )}

      {aiModal && (
        <AiModal
          aiModal={aiModal}
          setAiModal={setAiModal}
          aiLoading={aiLoading}
          aiText={aiText}
          cp={cp}
          copy={copy}
          saveNote={saveNote}
        />
      )}

      {showAddLead && (
        <AddLeadModal
          newLeadForm={newLeadForm}
          setNewLeadForm={setNewLeadForm}
          setShowAddLead={setShowAddLead}
          handleAddLead={handleAddLead}
        />
      )}

      <BoltChat leads={leads} />
    </div>
  );
}
