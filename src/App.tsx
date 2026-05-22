import React, { lazy, Suspense, useState } from 'react';
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
  const tenantId = tenant?.id;

  const { visibleLeads, loading, dbError, markDeleted } = useLeads(tenantId);
  const crud = useLeadCrud({ leads: visibleLeads, tenantId, markDeleted });
  const { state: filterState, setters: filterSetters, filtered } = useLeadFilters(visibleLeads);

  const [tab, setTab] = useState<TabKey>('leads');
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

  const handleAddLead = async () => {
    const ok = await crud.addLead(newLeadForm);
    if (ok) {
      setShowAddLead(false);
      setNewLeadForm({ ...EMPTY_LEAD_FORM });
    }
  };

  const handleSaveNote = async (id: string, notes: string) => {
    await crud.saveNote(id, notes);
    setEditId(null);
  };

  const handleDelete = async (id: string) => {
    const scrollEl = document.querySelector('main');
    const scrollPos = scrollEl?.scrollTop || 0;
    await crud.deleteLead(id);
    if (openId === id) setOpenId(null);
    setDeleteModal(null);
    requestAnimationFrame(() => {
      if (scrollEl) scrollEl.scrollTop = scrollPos;
    });
  };

  /** Cross-tab "show me this lead" — switch to Leads, open the card, scroll to it. */
  const jumpToLead = (id: string) => {
    setTab('leads');
    filterSetters.resetAll();
    filterSetters.setHot5(false);
    setOpenId(id);
    setTimeout(() => {
      const el = document.getElementById(`lead-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  // ---- early loading guard ------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-blue-500" size={32} />
          <div className="text-sm text-slate-500">Loading your CRM…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-700 selection:bg-blue-500/20">
      {/* Mobile header */}
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
          <div className="mx-auto mb-6 flex max-w-5xl items-start gap-3 rounded-2xl bg-red-50 ring-1 ring-red-200/60 p-4 text-red-700">
            <X size={20} className="mt-0.5 shrink-0" />
            <div>
              <div className="mb-1 text-sm font-semibold">Database Connection Error</div>
              <div className="text-xs leading-relaxed opacity-80">{dbError}</div>
            </div>
          </div>
        )}

        {crud.appError && (
          <div className="mx-auto mb-6 flex max-w-5xl items-start justify-between gap-3 rounded-2xl bg-red-50 ring-1 ring-red-200/60 p-4 text-red-700 shadow-sm">
            <div className="flex gap-3">
              <X size={20} className="mt-0.5 shrink-0" />
              <div>
                <div className="mb-1 text-sm font-semibold">Error</div>
                <div className="text-xs leading-relaxed opacity-80">{crud.appError}</div>
              </div>
            </div>
            <button
              onClick={() => crud.setAppError(null)}
              className="shrink-0 p-1 hover:bg-red-100 rounded-md transition-colors"
            >
              <X size={16} />
            </button>
          </div>
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
            handleAI={handleAI}
            onDelete={(id, co) => setDeleteModal({ id, co })}
            onAddLeadClick={() => setShowAddLead(true)}
          />
        )}

        {tab === 'outreach' && <OutreachTab />}
        {tab === 'autopilot' && <AutoOutreach leads={visibleLeads} />}
        {tab === 'pipeline' && <PipelineTab leads={visibleLeads} onLeadClick={jumpToLead} />}
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
