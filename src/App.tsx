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
import { collection, onSnapshot, doc, setDoc, writeBatch, deleteDoc, deleteField, query, where } from 'firebase/firestore';
import { useAuth } from './auth/AuthContext';

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
import { AutoOutreach } from './components/AutoOutreach';
import { CreateAccountModal } from './components/CreateAccountModal';

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
  // Multi-tenant scoping. When auth is enabled, tenantId comes from the
  // logged-in user's profile. When auth is off (live site default), tenantId
  // is undefined and the app behaves like before (no filtering).
  const { tenant, profile, signOut } = useAuth();
  const tenantId = tenant?.id;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('sc_deleted_leads');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const [tab, setTab] = useState<TabKey>('leads');
  const [regF, setRegF] = useState('All Regions');
  const [stF, setStF] = useState('all');
  const [tierF, setTierF] = useState('all');
  const [pmOnly, setPmOnly] = useState(false);
  const [remindersOnly, setRemindersOnly] = useState(false);
  // HOT 5 auto-activates once per day on first visit so you open the app to "what to do today"
  const [hot5, setHot5] = useState(() => {
    try {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const lastDailyKick = localStorage.getItem('sc_leads_hot5_last_kick');
      return lastDailyKick !== today;
    } catch {
      return true;
    }
  });

  // Mark today's hot5 kick once it activates so we don't re-trigger on every render today
  useEffect(() => {
    if (hot5) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem('sc_leads_hot5_last_kick', today);
      } catch {}
    }
  }, [hot5]);
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
  const [showCreateAccount, setShowCreateAccount] = useState(false);

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
      ...(tenantId ? { tenantId } : {}),
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
          ...(tenantId ? { tenantId } : {}),
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
    // If auth is enabled but tenant hasn't loaded yet, wait — don't subscribe
    // to the global leads collection (would expose other tenants' data).
    const REQUIRE_AUTH =
      (import.meta as any).env?.VITE_REQUIRE_AUTH === 'true';
    if (REQUIRE_AUTH && !tenantId) {
      return; // AuthGate is showing Login or loading; nothing to do here.
    }

    // Tenant-scoped query when we have a tenantId; otherwise legacy (all leads).
    const leadsRef = collection(db, 'leads');
    const leadsQuery = tenantId
      ? query(leadsRef, where('tenantId', '==', tenantId))
      : leadsRef;

    const unsub = onSnapshot(
      leadsQuery,
      async (snapshot) => {
        try {
          const dbLeads = snapshot.docs
            .map((d) => ({ ...d.data(), id: d.id }) as Lead);

          // Only seed initial leads in legacy single-tenant mode. New tenants
          // get a fresh empty CRM — that's the whole point of "suit them".
          if (!tenantId && snapshot.empty && !localStorage.getItem('sc_leads_seeded')) {
            setLeads(INIT_LEADS);
            localStorage.setItem('sc_leads_seeded', '1');
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
            // Use Firebase as the source of truth — never re-seed
            setLeads(dbLeads);
            if (!localStorage.getItem('sc_leads_seeded')) {
              localStorage.setItem('sc_leads_seeded', '1');
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
  }, [tenantId]);

  const setStatus = async (id: string, st: LeadStatus) => {
    try {
      // Auto-log status change with timestamp
      const lead = leads.find((l) => l.id === id);
      const oldStatus = lead?.status || 'unknown';
      if (oldStatus !== st) {
        const stamp = `[${new Date().toLocaleDateString()} — Status: ${oldStatus} → ${st}]`;
        const newNotes = lead?.notes ? lead.notes + '\n\n' + stamp : stamp;
        await setDoc(doc(db, 'leads', id), { status: st, notes: newNotes }, { merge: true });
      } else {
        await setDoc(doc(db, 'leads', id), { status: st }, { merge: true });
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

  const updateLeadFields = async (id: string, fields: Partial<Lead>) => {
    try {
      await setDoc(doc(db, 'leads', id), fields, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      try {
        handleFirestoreError(e, OperationType.UPDATE, `leads/${id}`);
      } catch (err: any) {
        let msg = err.message;
        try { msg = JSON.parse(msg).error || msg; } catch {}
        setAppError('Database Error: ' + msg);
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

  const addLeadFromBolt = async (lead: Lead) => {
    try {
      const fullLead: Lead = {
        ...lead,
        status: 'new',
        notes: '',
        t: lead.t ?? 2,
        r: lead.r ?? 'Other',
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
        ...(tenantId ? { tenantId } : {}),
      };
      await setDoc(doc(db, 'leads', lead.id), fullLead);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      try {
        handleFirestoreError(e, OperationType.CREATE, `leads/${lead.id}`);
      } catch (err: any) {
        let msg = err.message;
        try { msg = JSON.parse(msg).error || msg; } catch {}
        setAppError('Database Error: ' + msg);
      }
    }
  };

  const queueOutreach = async (lead: Lead) => {
    try {
      const current = (lead as any).queued_for_outreach;
      await setDoc(doc(db, 'leads', lead.id), { queued_for_outreach: !current }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      try {
        handleFirestoreError(e, OperationType.UPDATE, `leads/${lead.id}`);
      } catch (err: any) {
        let msg = err.message;
        try { msg = JSON.parse(msg).error || msg; } catch {}
        setAppError('Database Error: ' + msg);
      }
    }
  };

  const handleDeleteLead = async (id: string) => {
    // Save scroll position so we can restore after re-render
    const scrollEl = document.querySelector('main');
    const scrollPos = scrollEl?.scrollTop || 0;
    // Always track deletion locally (Firebase rules may block server-side delete)
    const newDeleted = new Set(deletedIds);
    newDeleted.add(id);
    setDeletedIds(newDeleted);
    localStorage.setItem('sc_deleted_leads', JSON.stringify([...newDeleted]));

    // Try Firebase delete too (best effort)
    try { await deleteDoc(doc(db, 'leads', id)); } catch {}

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (openId === id) setOpenId(null);
    setDeleteModal(null);
    requestAnimationFrame(() => {
      if (scrollEl) scrollEl.scrollTop = scrollPos;
    });
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

  // Filter out deleted leads everywhere
  const visibleLeads = leads.filter((l) => !deletedIds.has(l.id));

  const filtered = visibleLeads.filter((l) => {
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

    // HOT 5 TODAY: only show actionable leads (new + has email + has named PM, not snoozed)
    if (hot5) {
      if (l.status !== 'new') return false;
      if (!l.em || !l.em.trim()) return false;
      if (!l.pm || !l.pm.trim()) return false;
      if (l.reminderDate && new Date(l.reminderDate) > new Date()) return false;
    }

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

  // HOT 5: sort tier-1 first then alphabetical, then take top 5
  if (hot5) {
    filtered.sort((a, b) => {
      if (a.t !== b.t) return a.t - b.t;
      return (a.co || '').localeCompare(b.co || '');
    });
    filtered.splice(5);
  }

  const S = {
    total: visibleLeads.length,
    t1: visibleLeads.filter((l) => l.t === 1).length,
    withPM: visibleLeads.filter((l) => !!l.pm).length,
    active: visibleLeads.filter((l) => !['new', 'dead', 'client'].includes(l.status)).length,
    warm: visibleLeads.filter((l) => l.status === 'interested').length,
    clients: visibleLeads.filter((l) => l.status === 'client').length,
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-blue-500" size={32} />
          <div className="text-sm text-slate-500">
            Loading your CRM…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-700 selection:bg-blue-500/20">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-xl ring-1 ring-slate-200/70 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <FancyLogo className="h-8 w-8" />
          <div className="text-sm font-semibold tracking-tight text-slate-900">
            {tenant?.name || 'SC Deburring'}
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Sidebar */}
      <Sidebar
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        tab={tab}
        setTab={setTab}
        leads={visibleLeads}
        saved={saved}
        tenant={tenant}
        profile={profile}
        onSignOut={() => {
          void signOut();
        }}
        onCreateAccount={() => setShowCreateAccount(true)}
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
          <div className="mx-auto mb-6 flex max-w-5xl items-start gap-3 rounded-2xl bg-red-50 ring-1 ring-red-200/60 p-4 text-red-700">
            <X size={20} className="mt-0.5 shrink-0" />
            <div>
              <div className="mb-1 text-sm font-semibold">Database Connection Error</div>
              <div className="text-xs leading-relaxed opacity-80">{dbError}</div>
            </div>
          </div>
        )}

        {appError && (
          <div className="mx-auto mb-6 flex max-w-5xl items-start justify-between gap-3 rounded-2xl bg-red-50 ring-1 ring-red-200/60 p-4 text-red-700 shadow-sm">
            <div className="flex gap-3">
              <X size={20} className="mt-0.5 shrink-0" />
              <div>
                <div className="mb-1 text-sm font-semibold">Error</div>
                <div className="text-xs leading-relaxed opacity-80">{appError}</div>
              </div>
            </div>
            <button onClick={() => setAppError(null)} className="shrink-0 p-1 hover:bg-red-100 rounded-md transition-colors">
              <X size={16} />
            </button>
          </div>
        )}

        {tab === 'leads' && (
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-900">
                  {hot5 ? "Today's Pipeline" : "Leads"}
                </h1>
                <p className="text-xs text-slate-500">
                  {filtered.length} of {visibleLeads.length} leads · {REGIONS.length - 1} regions ·{' '}
                  {S.withPM} named purchasing managers
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddLead(true)}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.99]"
                >
                  + Add Lead
                </button>
              </div>
            </div>

            {hot5 && filtered.length > 0 && (
              <div className="mb-6 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 ring-1 ring-orange-200/60 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-orange-700 text-sm flex items-center gap-2">
                      🔥 Today's {filtered.length} — your move
                    </div>
                    <div className="mt-1 text-xs text-slate-600 leading-relaxed">
                      Tier-1 leads with named decision-makers and verified emails. Send {filtered.length} emails before lunch — that's your daily goal. After each send, expand the card and mark status &quot;emailed&quot; so it drops off the list.
                    </div>
                  </div>
                  <button
                    onClick={() => setHot5(false)}
                    className="shrink-0 rounded-xl bg-white ring-1 ring-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    title="Exit HOT 5 mode and view all leads"
                  >
                    View all leads
                  </button>
                </div>
              </div>
            )}

            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white ring-1 ring-slate-200/70 p-3">
              <div className="relative min-w-[200px] flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search company, contact, city, parts..."
                  className="w-full rounded-xl bg-slate-50 py-2 pl-9 pr-8 text-sm text-slate-900 placeholder-slate-400 ring-1 ring-slate-200 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                {q && (
                  <button
                    onClick={() => setQ('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <select
                value={regF}
                onChange={(e) => setRegF(e.target.value)}
                className="cursor-pointer rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                {REGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>

              <select
                value={tierF}
                onChange={(e) => setTierF(e.target.value)}
                className="cursor-pointer rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="all">All Tiers</option>
                <option value="1">Tier 1 — Call Now</option>
                <option value="2">Tier 2 — Target</option>
              </select>

              <select
                value={stF}
                onChange={(e) => setStF(e.target.value)}
                className="cursor-pointer rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
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
                onClick={() => {
                  // Toggling HOT 5 clears other filters for clean focused view
                  if (!hot5) {
                    setRegF('All Regions');
                    setTierF('all');
                    setStF('all');
                    setPmOnly(false);
                    setRemindersOnly(false);
                    setQ('');
                  }
                  setHot5(!hot5);
                }}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  hot5
                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                    : 'bg-orange-50 text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100'
                }`}
                title="Show top 5 actionable leads to contact today (new + has email + has named PM)"
              >
                {hot5 ? '🔥 HOT 5 ACTIVE' : '🔥 HOT 5 TODAY'}
              </button>

              <button
                onClick={() => setPmOnly(!pmOnly)}
                className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                  pmOnly
                    ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                    : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                }`}
              >
                {pmOnly ? 'Named PM Only' : 'Named PMs Only'}
              </button>

              <button
                onClick={() => setRemindersOnly(!remindersOnly)}
                className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                  remindersOnly
                    ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
                    : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                }`}
              >
                {remindersOnly ? 'Reminders Only' : 'Reminders'}
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="py-20 text-center text-sm text-slate-400">
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
                    onQueueOutreach={queueOutreach}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'outreach' && <OutreachTab />}
        {tab === 'autopilot' && <AutoOutreach leads={visibleLeads} />}
        {tab === 'pipeline' && (
          <PipelineTab
            leads={visibleLeads}
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
            leads={visibleLeads}
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
            handleAI={handleAI}
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

      <CreateAccountModal
        open={showCreateAccount}
        onClose={() => setShowCreateAccount(false)}
      />


      {aiModal && (
        <AiModal
          aiModal={aiModal}
          setAiModal={setAiModal}
          aiLoading={aiLoading}
          aiText={aiText}
          cp={cp}
          copy={copy}
          saveNote={saveNote}
          updateLeadFields={updateLeadFields}
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

      <BoltChat leads={visibleLeads} onAddLead={addLeadFromBolt} />
    </div>
  );
}
