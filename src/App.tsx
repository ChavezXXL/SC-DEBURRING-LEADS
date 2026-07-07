import React, { lazy, Suspense, useCallback, useState } from 'react';
import { Menu, X, Loader2 } from 'lucide-react';

import type { Lead, AiMode, TabKey } from './types';
import { generatePitch, researchContact } from './services/gemini';

import { useAuth } from './auth/AuthContext';
import { useLeads } from './leads/useLeads';
import { useLeadCrud } from './leads/useLeadCrud';
import { useLeadFilters } from './leads/useLeadFilters';
import { LeadsTab } from './leads/LeadsTab';
import { AddLeadModal } from './leads/AddLeadModal';

import { Sidebar } from './shell/Sidebar';
import { FancyLogo } from './shell/FancyLogo';

import { TodayTab } from './tabs/TodayTab';
import { OutreachTab } from './tabs/OutreachTab';
import { PipelineTab } from './tabs/PipelineTab';
import { AutoOutreach } from './tabs/AutoOutreach';
// Heavy tabs are code-split so the initial bundle only loads what most users need.
const AiBrain = lazy(() => import('./tabs/AiBrain').then((m) => ({ default: m.AiBrain })));
const AdminPanel = lazy(() =>
  import('./admin/AdminPanel').then((m) => ({ default: m.AdminPanel })),
);
const SettingsTab = lazy(() =>
  import('./settings/SettingsTab').then((m) => ({ default: m.SettingsTab })),
);

import { AiModal } from './modals/AiModal';
import { DeleteModal } from './modals/DeleteModal';
import { BoltChat } from './modals/BoltChat';

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

// External-search helpers (Google/LinkedIn/Indeed) used by the LeadCard action row.
const qs = {
  google: (co: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(
      `"${co}" purchasing manager OR procurement OR owner contact`,
    )}`,
  linkedin: (co: string) =>
    `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
      `${co} purchasing manager procurement`,
    )}`,
  indeed: (city: string) =>
    `https://www.indeed.com/jobs?q=${encodeURIComponent('deburring')}&l=${encodeURIComponent(
      `${city}, CA`,
    )}`,
};

/**
 * App = shell + tab router. All the heavy lifting was extracted into:
 *   - useLeads          → Firestore subscription + visible-leads derivation
 *   - useLeadCrud       → all the write paths + saved/appError state
 *   - useLeadFilters    → filter state + filtered-list derivation
 *   - LeadsTab          → the Leads tab UI (toolbar, HOT 5, card list)
 *   - AdminPanel        → super-admin tenant management
 *
 * What's still here:
 *   - Tab routing
 *   - Mobile menu state
 *   - Card open/edit/draft state (so it survives tab switches)
 *   - Modal coordination (AddLead / Delete / AI / BoltChat)
 *   - AI mode handler (calls Gemini, surfaces text in AiModal)
 *   - Sidebar/main layout
 */
export default function App() {
  const { tenant, profile, signOut } = useAuth();
  // Prefer the tenant doc, but fall back to the profile's tenantId so lead
  // writes are always tenant-stamped even if the tenant doc failed to load.
  const tenantId = tenant?.id ?? profile?.tenantId;

  const { visibleLeads, loading, dbError, markDeleted } = useLeads(tenantId);
  const crud = useLeadCrud({ leads: visibleLeads, tenantId, markDeleted });
  const { state: filterState, setters: filterSetters, filtered } = useLeadFilters(visibleLeads);

  // "Today" is the money screen — the day starts on the execution list.
  const [tab, setTab] = useState<TabKey>('today');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Card UI state (shared across LeadsTab/AI Brain/Pipeline jumps)
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [cp, setCp] = useState<string | null>(null);

  // Modal state
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState<Partial<Lead>>({ ...EMPTY_LEAD_FORM });
  const [deleteModal, setDeleteModal] = useState<{ id: string; co: string } | null>(null);
  const [aiModal, setAiModal] = useState<{ lead: Lead; mode: AiMode } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  // ---- handlers ----------------------------------------------------------

  // Stable across renders so React.memo'd LeadCards don't re-render on
  // every parent update (typing in search, status flashes, etc.).
  const copy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCp(id);
      setTimeout(() => setCp(null), 2200);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  }, []);

  const handleAI = useCallback(async (lead: Lead, mode: AiMode) => {
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
  }, []);

  const handleAddLead = async () => {
    const ok = await crud.addLead(newLeadForm);
    if (ok) {
      setShowAddLead(false);
      setNewLeadForm({ ...EMPTY_LEAD_FORM });
    }
  };

  const handleSaveNote = useCallback(async (id: string, notes: string) => {
    await crud.saveNote(id, notes);
    setEditId(null);
  }, [crud]);

  const handleDelete = useCallback(async (id: string) => {
    const scrollEl = document.querySelector('main');
    const scrollPos = scrollEl?.scrollTop || 0;
    await crud.deleteLead(id);
    if (openId === id) setOpenId(null);
    setDeleteModal(null);
    requestAnimationFrame(() => {
      if (scrollEl) scrollEl.scrollTop = scrollPos;
    });
  }, [crud, openId]);

  /** Cross-tab "show me this lead" — switch to Leads, open the card, scroll to it. */
  const jumpToLead = useCallback((id: string) => {
    setTab('leads');
    filterSetters.resetAll();
    filterSetters.setHot5(false);
    setOpenId(id);
    setTimeout(() => {
      const el = document.getElementById(`lead-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [filterSetters]);

  // ---- early loading guard ------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-apex-950 text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-apex-accent" size={32} />
          <div className="text-sm text-slate-400">Loading your CRM…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-apex-950 font-sans text-slate-300 selection:bg-apex-accent/30">
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-apex-900/90 backdrop-blur-xl ring-1 ring-white/10 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <FancyLogo className="h-8 w-8" />
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-slate-100">
              Apex Growth
            </div>
            <div className="truncate text-[10px] text-slate-400">
              {tenant?.name || 'SC Deburring'}
            </div>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-100 transition"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile scrim — tap outside the drawer to close it. */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        tab={tab}
        setTab={setTab}
        leads={visibleLeads}
        saved={crud.saved}
        tenant={tenant}
        profile={profile}
        onSignOut={() => void signOut()}
        onPipelineClick={(id) => {
          setTab('leads');
          setMobileMenuOpen(false);
          filterSetters.applyPipelineFilter(id);
        }}
      />

      <main className="max-h-screen flex-1 overflow-y-auto p-4 pt-20 md:p-8 md:pt-8 w-full">
        {dbError && (
          <div className="mx-auto mb-6 flex max-w-5xl items-start gap-3 rounded-2xl bg-red-500/10 ring-1 ring-red-500/30 p-4 text-red-300">
            <X size={20} className="mt-0.5 shrink-0" />
            <div>
              <div className="mb-1 text-sm font-semibold">Database Connection Error</div>
              <div className="text-xs leading-relaxed opacity-80">{dbError}</div>
            </div>
          </div>
        )}

        {crud.appError && (
          <div className="mx-auto mb-6 flex max-w-5xl items-start justify-between gap-3 rounded-2xl bg-red-500/10 ring-1 ring-red-500/30 p-4 text-red-300 shadow-sm shadow-black/40">
            <div className="flex gap-3">
              <X size={20} className="mt-0.5 shrink-0" />
              <div>
                <div className="mb-1 text-sm font-semibold">Error</div>
                <div className="text-xs leading-relaxed opacity-80">{crud.appError}</div>
              </div>
            </div>
            <button
              onClick={() => crud.setAppError(null)}
              className="shrink-0 p-1 hover:bg-red-500/20 rounded-md transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {tab === 'today' && (
          <TodayTab
            leads={visibleLeads}
            logCall={crud.logCall}
            markEmailed={crud.markEmailed}
            onLeadClick={jumpToLead}
          />
        )}

        {tab === 'leads' && (
          <LeadsTab
            visibleLeads={visibleLeads}
            filtered={filtered}
            filters={filterState}
            setters={filterSetters}
            openId={openId}
            setOpenId={setOpenId}
            editId={editId}
            setEditId={setEditId}
            draft={draft}
            setDraft={setDraft}
            cp={cp}
            copy={copy}
            qs={qs}
            setStatus={crud.setStatus}
            saveNote={handleSaveNote}
            setReminder={crud.setReminder}
            queueOutreach={crud.queueOutreach}
            markEmailed={crud.markEmailed}
            logCall={crud.logCall}
            handleAI={handleAI}
            onDelete={(id, co) => setDeleteModal({ id, co })}
            onAddLeadClick={() => setShowAddLead(true)}
          />
        )}

        {tab === 'outreach' && <OutreachTab />}
        {tab === 'autopilot' && <AutoOutreach leads={visibleLeads} />}
        {tab === 'pipeline' && (
          <PipelineTab leads={visibleLeads} onLeadClick={jumpToLead} setStatus={crud.setStatus} />
        )}
        {tab === 'brain' && (
          <Suspense fallback={<TabSpinner />}>
            <AiBrain
              leads={visibleLeads}
              onLeadClick={jumpToLead}
              onDeleteLead={(id, co) => setDeleteModal({ id, co })}
              setStatus={crud.setStatus}
              handleAI={handleAI}
            />
          </Suspense>
        )}
        {tab === 'admin' && profile?.role === 'super-admin' && (
          <Suspense fallback={<TabSpinner />}>
            <AdminPanel />
          </Suspense>
        )}
        {tab === 'settings' &&
          (profile?.role === 'owner' || profile?.role === 'super-admin') && (
            <Suspense fallback={<TabSpinner />}>
              <SettingsTab />
            </Suspense>
          )}
      </main>

      {deleteModal && (
        <DeleteModal
          deleteModal={deleteModal}
          setDeleteModal={setDeleteModal}
          handleDeleteLead={handleDelete}
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
          saveNote={crud.saveNote}
          updateLeadFields={crud.updateLead}
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

      <BoltChat leads={visibleLeads} onAddLead={crud.addLeadFromBolt} />
    </div>
  );
}

function TabSpinner() {
  return (
    <div className="mx-auto max-w-5xl py-20 flex justify-center">
      <Loader2 className="animate-spin text-slate-400" size={20} />
    </div>
  );
}
