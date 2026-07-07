import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, X, Loader2, LayoutGrid, ArrowRight, Search } from 'lucide-react';

import type { Lead, TabKey, LeadStatus } from './types';
import { STATUS } from './data';
import { useToast } from './ui/Toast';

import { useAuth } from './auth/AuthContext';
import { useLeads } from './leads/useLeads';
import { PLATFORM_WORKSPACE } from './auth/useWorkspace';
import { useWorkspaceCtx } from './auth/WorkspaceContext';
import { MobileNav } from './shell/MobileNav';
import { CommandPalette } from './shell/CommandPalette';
import { useLeadCrud } from './leads/useLeadCrud';
import { useLeadFilters } from './leads/useLeadFilters';
import { useLeadSort } from './leads/useLeadSort';
import { useLeadSelection } from './leads/useLeadSelection';
import { downloadLeadsCsv } from './leads/leadsCsv';
import { LeadsTab } from './leads/LeadsTab';

import { Sidebar } from './shell/Sidebar';
import { FancyLogo } from './shell/FancyLogo';
import { TabSkeleton } from './shell/TabSkeleton';

import { TodayTab } from './tabs/TodayTab';

// Code-splitting: only Today + Leads (the two most-used screens) ship in the
// entry chunk. Everything else is a separate chunk fetched on first open, so
// the initial download is smaller and Firebase-heavy screens don't block boot.
const OutreachTab = lazy(() =>
  import('./tabs/OutreachTab').then((m) => ({ default: m.OutreachTab })),
);
const PipelineTab = lazy(() =>
  import('./tabs/PipelineTab').then((m) => ({ default: m.PipelineTab })),
);
const AdminPanel = lazy(() =>
  import('./admin/AdminPanel').then((m) => ({ default: m.AdminPanel })),
);
const SettingsTab = lazy(() =>
  import('./settings/SettingsTab').then((m) => ({ default: m.SettingsTab })),
);

// Modals are gated behind boolean state and only mount when opened, so lazy
// import is free of open/close complexity — the chunk arrives before paint.
const AddLeadModal = lazy(() =>
  import('./leads/AddLeadModal').then((m) => ({ default: m.AddLeadModal })),
);
const BulkDeleteModal = lazy(() =>
  import('./modals/BulkDeleteModal').then((m) => ({ default: m.BulkDeleteModal })),
);

import { DeleteModal } from './modals/DeleteModal';

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

// PWA shortcut deep links: /?tab=leads etc. Parsed once at module load.
const VALID_TABS: TabKey[] = ['today', 'leads', 'outreach', 'pipeline', 'admin', 'settings'];
const URL_TAB: TabKey | null = (() => {
  try {
    const t = new URLSearchParams(window.location.search).get('tab') as TabKey | null;
    return t && VALID_TABS.includes(t) ? t : null;
  } catch {
    return null;
  }
})();

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
 *   - Modal coordination (AddLead / Delete)
 *   - Sidebar/main layout
 */
/**
 * Shown on the lead-scoped tabs when a super-admin is in the tenant-less
 * Platform Console — there's no client selected, so there are no leads to show.
 * Points them at the admin console or the workspace switcher.
 */
function PlatformConsoleEmpty({ onManage }: { onManage: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center py-24 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-apex-accent/10 ring-1 ring-apex-accent/30 text-orange-300">
        <LayoutGrid size={26} />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-slate-100">Platform Console</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        You're operating Apex Growth itself — not a single client. Pick a client
        workspace from the switcher (top-left) to work their leads, or manage all
        accounts in the admin console.
      </p>
      <button
        onClick={onManage}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-apex-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500"
      >
        Manage client accounts
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

export default function App() {
  const { profile, signOut } = useAuth();
  const toast = useToast();

  // Super-admins can operate as any client tenant, or sit in the tenant-less
  // Platform Console; everyone else is pinned to their own tenant. The workspace
  // context resolves which tenantId all data + writes are scoped to, and holds
  // the LIVE tenant doc for the active workspace (branding follows the switch).
  const {
    workspaceId,
    effectiveTenantId,
    isPlatformConsole,
    isSuperAdmin,
    setWorkspace,
    activeTenant,
  } = useWorkspaceCtx();
  // Prefer the workspace selection, but fall back to the profile's tenantId so
  // lead writes are always tenant-stamped even if the tenant doc failed to load.
  const tenantId = effectiveTenantId ?? (isSuperAdmin ? undefined : profile?.tenantId);

  const { visibleLeads, loading, dbError, markDeleted } = useLeads(tenantId, {
    skip: isPlatformConsole,
  });
  const crud = useLeadCrud({ leads: visibleLeads, tenantId, markDeleted });
  const { state: filterState, setters: filterSetters, filtered } = useLeadFilters(visibleLeads);
  // Sort applies AFTER filtering, BEFORE render. `sorted` is what the Leads tab
  // actually renders (and what selection treats as the eligible set).
  const { sortKey, onSortChange, sorted } = useLeadSort(filtered);
  const selection = useLeadSelection(sorted.map((l) => l.id));

  // "Today" is the money screen — the day starts on the execution list.
  // A PWA-shortcut deep link (/?tab=…) wins over the default.
  const [tab, setTab] = useState<TabKey>(URL_TAB ?? 'today');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Role guard: a deep link (or stale state) can't strand someone on a tab
  // their role doesn't render — bounce to Today instead of a blank screen.
  useEffect(() => {
    if (!profile) return;
    if (tab === 'admin' && profile.role !== 'super-admin') setTab('today');
    if (tab === 'settings' && profile.role === 'member') setTab('today');
  }, [tab, profile]);

  // Switch workspace (super-admin only): land on Admin for the Platform Console,
  // Today for a client tenant.
  const selectWorkspace = useCallback(
    (id: string) => {
      setWorkspace(id);
      setTab(id === PLATFORM_WORKSPACE ? 'admin' : 'today');
      setMobileMenuOpen(false);
    },
    [setWorkspace],
  );

  // A platform admin with no client tenant lands on the Admin console, not an
  // empty Today. Runs once, after the profile AND the workspace both resolve
  // (workspaceId is '' for a tick on reload — deciding then would misfire).
  // An explicit ?tab= deep link wins over this default.
  const didInitTab = useRef(!!URL_TAB);
  useEffect(() => {
    if (didInitTab.current || !profile || !workspaceId) return;
    didInitTab.current = true;
    if (isPlatformConsole) setTab('admin');
  }, [profile, workspaceId, isPlatformConsole]);

  // Card UI state (shared across LeadsTab/Pipeline jumps)
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [cp, setCp] = useState<string | null>(null);

  // Modal state
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState<Partial<Lead>>({ ...EMPTY_LEAD_FORM });
  const [deleteModal, setDeleteModal] = useState<{ id: string; co: string } | null>(null);
  // Bulk delete goes through a confirm modal; holds the ids awaiting confirmation.
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);

  // ⌘K command palette — search leads, jump tabs, quick actions, workspaces.
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reminders due today or earlier — badge on the mobile Today tab.
  const dueCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return visibleLeads.filter((l) => l.reminderDate && l.reminderDate <= today).length;
  }, [visibleLeads]);

  const handleExportAll = useCallback(() => {
    if (visibleLeads.length === 0) return;
    downloadLeadsCsv(visibleLeads, `leads-${new Date().toISOString().slice(0, 10)}.csv`);
    toast(`Exported ${visibleLeads.length} lead${visibleLeads.length === 1 ? '' : 's'}`);
  }, [visibleLeads, toast]);

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

  const handleAddLead = async () => {
    const ok = await crud.addLead(newLeadForm);
    if (ok) {
      toast('Lead added');
      setShowAddLead(false);
      setNewLeadForm({ ...EMPTY_LEAD_FORM });
    }
  };

  const handleSaveNote = useCallback(async (id: string, notes: string) => {
    await crud.saveNote(id, notes);
    toast('Note saved');
    setEditId(null);
  }, [crud, toast]);

  const handleDelete = useCallback(async (id: string) => {
    const scrollEl = document.querySelector('main');
    const scrollPos = scrollEl?.scrollTop || 0;
    await crud.deleteLead(id);
    toast('Lead deleted');
    if (openId === id) setOpenId(null);
    setDeleteModal(null);
    requestAnimationFrame(() => {
      if (scrollEl) scrollEl.scrollTop = scrollPos;
    });
  }, [crud, openId, toast]);

  // ---- toast-wrapped write actions ----------------------------------------
  // Firestore latency compensation updates the snapshot instantly, so the
  // toast fires immediately (before the network round-trip) and the UI never
  // feels like it's waiting. Errors still surface through crud.appError.

  const handleMarkEmailed = useCallback((lead: Lead) => {
    toast(`Marked emailed — ${lead.co}`);
    return crud.markEmailed(lead);
  }, [crud, toast]);

  const handleLogCall = useCallback((lead: Lead) => {
    toast(`Call logged — ${lead.co}`);
    return crud.logCall(lead);
  }, [crud, toast]);

  const handleSetStatus = useCallback((id: string, st: LeadStatus) => {
    const lead = visibleLeads.find((l) => l.id === id);
    if (!lead || lead.status !== st) {
      const label = STATUS.find((s) => s.k === st)?.label ?? st;
      toast(`Moved to ${label}`);
    }
    return crud.setStatus(id, st);
  }, [crud, toast, visibleLeads]);

  // ---- bulk actions --------------------------------------------------------
  // Each fires ONE summarizing toast and clears the selection after a successful
  // write. The per-lead field logic lives in crud (shared with the singles).

  const clearSelection = selection.clear;

  const handleBulkMarkEmailed = useCallback(async (ids: string[]) => {
    const n = await crud.bulkMarkEmailed(ids);
    if (n > 0) {
      toast(`Marked ${n} emailed`);
      clearSelection();
    }
  }, [crud, toast, clearSelection]);

  const handleBulkLogCall = useCallback(async (ids: string[]) => {
    const n = await crud.bulkLogCall(ids);
    if (n > 0) {
      toast(`Logged ${n} call${n === 1 ? '' : 's'}`);
      clearSelection();
    }
  }, [crud, toast, clearSelection]);

  const handleBulkSetStatus = useCallback(async (ids: string[], st: LeadStatus) => {
    const n = await crud.bulkSetStatus(ids, st);
    const label = STATUS.find((s) => s.k === st)?.label ?? st;
    // n counts only leads that actually changed; all selected may already be there.
    toast(n > 0 ? `Moved ${n} to ${label}` : `Already ${label}`);
    if (n > 0) clearSelection();
  }, [crud, toast, clearSelection]);

  const handleBulkExport = useCallback((ids: string[]) => {
    const set = new Set(ids);
    const rows = visibleLeads.filter((l) => set.has(l.id));
    if (rows.length === 0) return;
    downloadLeadsCsv(rows, `leads-selected-${new Date().toISOString().slice(0, 10)}.csv`);
    toast(`Exported ${rows.length} lead${rows.length === 1 ? '' : 's'}`);
    clearSelection();
  }, [visibleLeads, toast, clearSelection]);

  // Delete confirms first — the actual write happens in the modal's onConfirm.
  const handleBulkDeleteRequest = useCallback((ids: string[]) => {
    if (ids.length > 0) setBulkDeleteIds(ids);
  }, []);

  const handleBulkDeleteConfirm = useCallback(async () => {
    const ids = bulkDeleteIds ?? [];
    setBulkDeleteIds(null);
    if (ids.length === 0) return;
    if (openId && ids.includes(openId)) setOpenId(null);
    const n = await crud.bulkDelete(ids);
    toast(`${n} lead${n === 1 ? '' : 's'} deleted`);
    clearSelection();
  }, [bulkDeleteIds, crud, toast, clearSelection, openId]);

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
              {isPlatformConsole ? 'Platform Console' : activeTenant?.name || 'SC Deburring'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className="rounded-lg p-2.5 text-slate-400 hover:bg-white/5 hover:text-slate-100 transition"
          >
            <Search size={20} />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="rounded-lg p-2.5 text-slate-400 hover:bg-white/5 hover:text-slate-100 transition"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
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
        tenant={activeTenant}
        profile={profile}
        isSuperAdmin={isSuperAdmin}
        isPlatformConsole={isPlatformConsole}
        workspaceId={workspaceId}
        onSelectWorkspace={selectWorkspace}
        onOpenPalette={() => setPaletteOpen(true)}
        onSignOut={() => void signOut()}
        onPipelineClick={(id) => {
          setTab('leads');
          setMobileMenuOpen(false);
          filterSetters.applyPipelineFilter(id);
        }}
      />

      <main className="max-h-screen flex-1 overflow-y-auto p-4 pt-20 pb-28 md:p-8 md:pt-8 md:pb-8 w-full">
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
              aria-label="Dismiss error"
              className="shrink-0 p-2 hover:bg-red-500/20 rounded-md transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {isPlatformConsole &&
          (tab === 'today' || tab === 'leads' || tab === 'pipeline' || tab === 'outreach') && (
            <PlatformConsoleEmpty onManage={() => setTab('admin')} />
          )}

        {!isPlatformConsole && tab === 'today' && (
          <TodayTab
            leads={visibleLeads}
            logCall={handleLogCall}
            markEmailed={handleMarkEmailed}
            onLeadClick={jumpToLead}
          />
        )}

        {!isPlatformConsole && tab === 'leads' && (
          <LeadsTab
            visibleLeads={visibleLeads}
            filtered={filtered}
            sorted={sorted}
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
            setStatus={handleSetStatus}
            saveNote={handleSaveNote}
            setReminder={crud.setReminder}
            markEmailed={handleMarkEmailed}
            logCall={handleLogCall}
            sortKey={sortKey}
            onSortChange={onSortChange}
            selectedCount={selection.count}
            allSelected={selection.allSelected}
            someSelected={selection.someSelected}
            isSelected={selection.isSelected}
            onToggleSelect={selection.toggle}
            onSelectAll={selection.selectAll}
            onClearSelection={selection.clear}
            selectionMode={selection.selectionMode}
            onToggleSelectionMode={() => selection.setSelectionMode(!selection.selectionMode)}
            onBulkMarkEmailed={handleBulkMarkEmailed}
            onBulkLogCall={handleBulkLogCall}
            onBulkSetStatus={handleBulkSetStatus}
            onBulkExport={handleBulkExport}
            onBulkDelete={handleBulkDeleteRequest}
            onDelete={(id, co) => setDeleteModal({ id, co })}
            onAddLeadClick={() => setShowAddLead(true)}
          />
        )}

        {!isPlatformConsole && tab === 'outreach' && (
          <Suspense fallback={<TabSkeleton />}>
            <OutreachTab />
          </Suspense>
        )}
        {!isPlatformConsole && tab === 'pipeline' && (
          <Suspense fallback={<TabSkeleton />}>
            <PipelineTab leads={visibleLeads} onLeadClick={jumpToLead} setStatus={handleSetStatus} />
          </Suspense>
        )}
        {tab === 'admin' && profile?.role === 'super-admin' && (
          <Suspense fallback={<TabSkeleton />}>
            <AdminPanel />
          </Suspense>
        )}
        {tab === 'settings' &&
          (profile?.role === 'owner' || profile?.role === 'super-admin') && (
            <Suspense fallback={<TabSkeleton />}>
              <SettingsTab leads={visibleLeads} />
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

      {bulkDeleteIds && (
        <Suspense fallback={null}>
          <BulkDeleteModal
            count={bulkDeleteIds.length}
            onCancel={() => setBulkDeleteIds(null)}
            onConfirm={handleBulkDeleteConfirm}
          />
        </Suspense>
      )}

      {showAddLead && (
        <Suspense fallback={null}>
          <AddLeadModal
            newLeadForm={newLeadForm}
            setNewLeadForm={setNewLeadForm}
            setShowAddLead={setShowAddLead}
            handleAddLead={handleAddLead}
          />
        </Suspense>
      )}

      {/* Phone bottom tab bar — hides while the drawer menu is open. */}
      <MobileNav
        tab={tab}
        setTab={setTab}
        role={profile?.role}
        dueCount={dueCount}
        hidden={mobileMenuOpen}
      />

      {/* ⌘K — search leads, jump tabs, quick actions, switch workspaces. */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        leads={visibleLeads}
        onJumpToLead={jumpToLead}
        onNavigate={(t) => {
          setTab(t);
          setMobileMenuOpen(false);
        }}
        onAddLead={() => setShowAddLead(true)}
        onExport={handleExportAll}
        onSelectWorkspace={selectWorkspace}
        role={profile?.role}
      />
    </div>
  );
}
