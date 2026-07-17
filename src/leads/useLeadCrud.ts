import { useState } from 'react';
import {
  deleteDoc,
  deleteField,
  doc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Lead, LeadStatus, VisitOutcome } from '../types';
import {
  OperationType,
  extractErrorMessage,
  handleFirestoreError,
} from './firestore-errors';

const FLASH_MS = 2000;

// Firestore caps a single writeBatch at 500 ops; stay well under it.
const BATCH_CHUNK = 400;

/** Split ids into <=BATCH_CHUNK-sized groups so no batch exceeds the limit. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Shared field-builders — the SINGLE source of truth for what each write sets.
// Both the single-lead handlers and their bulk counterparts call these, so the
// per-lead field logic (stamps, touch bump, status guards, dated notes) can
// never drift between the two paths. tenantId is never touched: every write is
// a { merge: true } patch on the existing doc, so the stored tenantId stays.
// ---------------------------------------------------------------------------

/** Fields for "I emailed them" — bumps touch tracking, stamps notes, and only
 *  ever UPGRADES status (new/called/voicemail → emailed; never downgrades). */
function markEmailedFields(lead: Lead): Partial<Lead> {
  const today = new Date().toISOString().slice(0, 10);
  const stamp = `[${today}] Emailed (marked from app).`;
  const fields: Partial<Lead> = {
    lastContactedAt: new Date().toISOString(),
    touchCount: (lead.touchCount || 0) + 1,
    notes: lead.notes ? `${lead.notes}\n${stamp}` : stamp,
  };
  if (['new', 'called', 'voicemail'].includes(lead.status)) {
    fields.status = 'emailed';
  }
  return fields;
}

/** Fields for "I called them" — bumps touch tracking, stamps notes, and only
 *  ever UPGRADES status (new → called; never downgrades a warmer lead). */
function logCallFields(lead: Lead): Partial<Lead> {
  const today = new Date().toISOString().slice(0, 10);
  const stamp = `[${today}] Called (logged from app).`;
  const fields: Partial<Lead> = {
    lastContactedAt: new Date().toISOString(),
    touchCount: (lead.touchCount || 0) + 1,
    notes: lead.notes ? `${lead.notes}\n${stamp}` : stamp,
  };
  if (lead.status === 'new') {
    fields.status = 'called';
  }
  return fields;
}

/** Fields for a status change — auto-logs the change as a dated note, but only
 *  when the status actually changes (matches the single-lead handler exactly). */
function setStatusFields(lead: Lead | undefined, st: LeadStatus): Partial<Lead> {
  const oldStatus = lead?.status || 'unknown';
  if (oldStatus !== st) {
    const stamp = `[${new Date().toLocaleDateString()} — Status: ${oldStatus} → ${st}]`;
    const newNotes = lead?.notes ? lead.notes + '\n\n' + stamp : stamp;
    return { status: st, notes: newNotes };
  }
  return { status: st };
}

const VISIT_FOLLOW_UP_DAYS: Record<VisitOutcome, number | null> = {
  'Met buyer': 2,
  'Left capability packet': 3,
  'Asked to return': 7,
  'No access': 7,
  'Not a fit': null,
};

function localYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface UseLeadCrudArgs {
  /** Current leads array — used to compute status-change notes. */
  leads: Lead[];
  /** Tenant scoping. New writes get stamped with this id when present. */
  tenantId: string | undefined;
  /** Called after every successful Firestore delete so the UI hides the lead. */
  markDeleted: (id: string) => void;
}

/**
 * All Firestore write paths for leads, behind one hook so App.tsx stops
 * being a god component.
 *
 * Returns:
 *   - saved      flashes true for ~2s after every successful write
 *   - appError   user-visible error string (null when clean)
 *   - handlers   { addLead, setStatus, updateLead, saveNote,
 *                  setReminder, markEmailed, logCall, deleteLead }
 */
export function useLeadCrud({ leads, tenantId, markDeleted }: UseLeadCrudArgs) {
  const [saved, setSaved] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), FLASH_MS);
  };

  const surface = (e: any, op: OperationType, path: string | null) => {
    try {
      handleFirestoreError(e, op, path);
    } catch (err) {
      setAppError('Database Error: ' + extractErrorMessage(err));
      throw err;
    }
  };

  const tenantStamp = tenantId ? { tenantId } : {};

  /** Creates must carry a tenantId — untagged leads are invisible to every
   * tenant-scoped query (this bug already happened once). */
  const requireTenant = (): boolean => {
    if (tenantId) return true;
    setAppError('No workspace loaded — refresh and sign in again before adding leads.');
    return false;
  };

  /** Create a brand-new lead from the Add Lead modal form. */
  const addLead = async (form: Partial<Lead>): Promise<boolean> => {
    if (!form.co?.trim()) return false;
    if (!requireTenant()) return false;
    const id =
      form.co.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
      '-' +
      Math.random().toString(36).substring(2, 7);
    const lead: Lead = {
      id,
      status: 'new',
      notes: '',
      t: (form.t as 1 | 2) ?? 2,
      r: form.r ?? 'Other',
      co: form.co ?? '',
      city: form.city ?? '',
      ...(form.address?.trim() ? { address: form.address.trim() } : {}),
      ...(typeof form.lat === 'number' ? { lat: form.lat } : {}),
      ...(typeof form.lng === 'number' ? { lng: form.lng } : {}),
      who: form.who ?? '',
      role: form.role ?? '',
      pm: form.pm ?? '',
      pm_title: form.pm_title ?? '',
      parts: form.parts ?? '',
      pitch: form.pitch ?? '',
      ph: form.ph ?? '',
      em: form.em ?? '',
      web: form.web ?? '',
      ...(form.reminderDate ? { reminderDate: form.reminderDate } : {}),
      ...tenantStamp,
    };
    try {
      await setDoc(doc(db, 'leads', id), lead);
      flashSaved();
      return true;
    } catch (e: any) {
      surface(e, OperationType.CREATE, `leads/${id}`);
      return false;
    }
  };

  /** Set a lead's status; auto-logs the change as a note timestamp. */
  const setStatus = async (id: string, st: LeadStatus) => {
    try {
      const lead = leads.find((l) => l.id === id);
      await setDoc(doc(db, 'leads', id), setStatusFields(lead, st), { merge: true });
      flashSaved();
    } catch (e: any) {
      surface(e, OperationType.UPDATE, `leads/${id}`);
    }
  };

  const updateLead = async (id: string, fields: Partial<Lead>) => {
    try {
      await setDoc(doc(db, 'leads', id), fields, { merge: true });
      flashSaved();
    } catch (e: any) {
      surface(e, OperationType.UPDATE, `leads/${id}`);
    }
  };

  const saveNote = async (id: string, notes: string) => {
    try {
      await setDoc(doc(db, 'leads', id), { notes }, { merge: true });
      flashSaved();
    } catch (e: any) {
      surface(e, OperationType.UPDATE, `leads/${id}`);
    }
  };

  /**
   * Set or clear a lead's follow-up reminder. Both branches are { merge: true }
   * patches on the existing doc, so tenantId (and every other field) is
   * preserved — identical write shape to markEmailed. Each also appends a dated
   * timeline line to `notes` so the change shows up in the activity timeline.
   */
  const setReminder = async (id: string, reminderDate: string | null) => {
    try {
      const lead = leads.find((l) => l.id === id);
      const today = new Date().toISOString().slice(0, 10);
      if (reminderDate === null) {
        const stamp = `[${today}] Follow-up cleared.`;
        const notes = lead?.notes ? `${lead.notes}\n${stamp}` : stamp;
        await setDoc(
          doc(db, 'leads', id),
          { reminderDate: deleteField(), notes },
          { merge: true },
        );
      } else {
        const stamp = `[${today}] Follow-up set for ${reminderDate}.`;
        const notes = lead?.notes ? `${lead.notes}\n${stamp}` : stamp;
        await setDoc(doc(db, 'leads', id), { reminderDate, notes }, { merge: true });
      }
      flashSaved();
    } catch (e: any) {
      surface(e, OperationType.UPDATE, `leads/${id}`);
    }
  };

  /** One-click "I emailed them" — bumps touch tracking, stamps the notes,
   * and only ever upgrades status (new/called/voicemail → emailed). */
  const markEmailed = async (lead: Lead) => {
    try {
      await setDoc(doc(db, 'leads', lead.id), markEmailedFields(lead), { merge: true });
      flashSaved();
    } catch (e: any) {
      surface(e, OperationType.UPDATE, `leads/${lead.id}`);
    }
  };

  /** One-click "I called them" — bumps touch tracking, stamps the notes,
   * and only ever upgrades status (new → called; never downgrades an
   * emailed/interested/client lead back to called). */
  const logCall = async (lead: Lead) => {
    try {
      await setDoc(doc(db, 'leads', lead.id), logCallFields(lead), { merge: true });
      flashSaved();
    } catch (e: any) {
      surface(e, OperationType.UPDATE, `leads/${lead.id}`);
    }
  };

  /** Log an in-person field-sales visit and schedule the natural next touch.
   * Warm stages are never downgraded to "visited". Choosing "Not a fit" is
   * explicit and moves the lead out of active prospecting. */
  const logVisit = async (lead: Lead, outcome: VisitOutcome) => {
    try {
      const now = new Date();
      const today = localYmd(now);
      const stamp = `[${today}] Visit — ${outcome}.`;
      const fields: Partial<Lead> = {
        lastVisitedAt: now.toISOString(),
        lastVisitOutcome: outcome,
        lastContactedAt: now.toISOString(),
        touchCount: (lead.touchCount || 0) + 1,
        notes: lead.notes ? `${lead.notes}\n${stamp}` : stamp,
      };

      if (outcome === 'Not a fit') {
        fields.status = 'dead';
      } else if (['new', 'called', 'emailed', 'voicemail'].includes(lead.status)) {
        fields.status = 'visited';
      }

      const followUpDays = VISIT_FOLLOW_UP_DAYS[outcome];
      if (followUpDays !== null) {
        const followUp = new Date(now);
        followUp.setDate(followUp.getDate() + followUpDays);
        fields.reminderDate = localYmd(followUp);
      }

      await setDoc(doc(db, 'leads', lead.id), fields, { merge: true });
      flashSaved();
    } catch (e: any) {
      surface(e, OperationType.UPDATE, `leads/${lead.id}`);
    }
  };

  /** Always marks deleted locally + tries server delete (best effort).
   *  Returns immediately so the UI can restore scroll position. */
  const deleteLead = async (id: string) => {
    markDeleted(id);
    try {
      await deleteDoc(doc(db, 'leads', id));
    } catch {
      /* security rules may block — that's OK, local mark is enough */
    }
    flashSaved();
  };

  // ---- BULK write paths ---------------------------------------------------
  // Each mirrors its single-lead handler exactly by reusing the same shared
  // field-builder per lead, then commits the patches in writeBatch chunks of
  // <=400 ops. Every op is a { merge: true } set on the existing doc, so
  // tenantId (and any field not in the patch) is preserved. Returns the number
  // of leads actually changed so the caller can fire one accurate toast.

  /** Look up the live leads for the given ids, dropping any that vanished. */
  const resolve = (ids: string[]): Lead[] => {
    const byId = new Map(leads.map((l) => [l.id, l]));
    return ids.map((id) => byId.get(id)).filter((l): l is Lead => !!l);
  };

  /** Commit an array of [id, fields] patches in <=400-op batches. */
  const commitPatches = async (
    patches: [string, Partial<Lead>][],
    path: string,
  ): Promise<number> => {
    if (patches.length === 0) return 0;
    try {
      for (const group of chunk(patches, BATCH_CHUNK)) {
        const batch = writeBatch(db);
        for (const [id, fields] of group) {
          batch.set(doc(db, 'leads', id), fields, { merge: true });
        }
        await batch.commit();
      }
      flashSaved();
      return patches.length;
    } catch (e: any) {
      surface(e, OperationType.WRITE, path);
      return 0;
    }
  };

  const bulkMarkEmailed = async (ids: string[]): Promise<number> => {
    const patches = resolve(ids).map(
      (lead) => [lead.id, markEmailedFields(lead)] as [string, Partial<Lead>],
    );
    return commitPatches(patches, 'leads (bulk markEmailed)');
  };

  const bulkLogCall = async (ids: string[]): Promise<number> => {
    const patches = resolve(ids).map(
      (lead) => [lead.id, logCallFields(lead)] as [string, Partial<Lead>],
    );
    return commitPatches(patches, 'leads (bulk logCall)');
  };

  /** Only writes leads whose status actually changes, so the returned count
   *  reflects real moves (matches the single handler's "changed" semantics). */
  const bulkSetStatus = async (ids: string[], st: LeadStatus): Promise<number> => {
    const patches = resolve(ids)
      .filter((lead) => lead.status !== st)
      .map((lead) => [lead.id, setStatusFields(lead, st)] as [string, Partial<Lead>]);
    return commitPatches(patches, 'leads (bulk setStatus)');
  };

  /** Marks every id deleted locally (identical to the single delete), then
   *  best-effort batch-deletes the docs. Local marks stick even if rules block. */
  const bulkDelete = async (ids: string[]): Promise<number> => {
    ids.forEach((id) => markDeleted(id));
    try {
      for (const group of chunk(ids, BATCH_CHUNK)) {
        const batch = writeBatch(db);
        for (const id of group) batch.delete(doc(db, 'leads', id));
        await batch.commit();
      }
    } catch {
      /* security rules may block — local marks are enough */
    }
    flashSaved();
    return ids.length;
  };

  return {
    saved,
    appError,
    setAppError,
    addLead,
    setStatus,
    updateLead,
    saveNote,
    setReminder,
    markEmailed,
    logCall,
    logVisit,
    deleteLead,
    bulkMarkEmailed,
    bulkLogCall,
    bulkSetStatus,
    bulkDelete,
  };
}
