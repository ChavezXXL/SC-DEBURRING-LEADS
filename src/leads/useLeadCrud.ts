import { useState } from 'react';
import {
  deleteDoc,
  deleteField,
  doc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Lead, LeadStatus } from '../types';
import { findNewLeads } from '../services/gemini';
import {
  OperationType,
  extractErrorMessage,
  handleFirestoreError,
} from './firestore-errors';

const FLASH_MS = 2000;

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
 *   - handlers   { addLead, findLeads, setStatus, updateLead, saveNote,
 *                  setReminder, addLeadFromBolt, markEmailed, queueOutreach,
 *                  deleteLead }
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

  /** Gemini-generated batch insert. Returns number written or throws. */
  const findLeads = async (q: string): Promise<number> => {
    if (!q.trim()) return 0;
    if (!requireTenant()) return 0;
    let newLeads: Partial<Lead>[];
    try {
      newLeads = await findNewLeads(q);
    } catch (e: any) {
      setAppError('Error generating leads from AI: ' + (e?.message || String(e)));
      throw e;
    }
    if (!Array.isArray(newLeads) || newLeads.length === 0) {
      setAppError('No leads found. Try a different search query.');
      return 0;
    }
    try {
      const batch = writeBatch(db);
      newLeads.forEach((lead, index) => {
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
          ...tenantStamp,
        };
        batch.set(doc(db, 'leads', uniqueId), safeLead);
      });
      await batch.commit();
      return newLeads.length;
    } catch (e: any) {
      surface(e, OperationType.WRITE, 'leads');
      return 0;
    }
  };

  /** Set a lead's status; auto-logs the change as a note timestamp. */
  const setStatus = async (id: string, st: LeadStatus) => {
    try {
      const lead = leads.find((l) => l.id === id);
      const oldStatus = lead?.status || 'unknown';
      if (oldStatus !== st) {
        const stamp = `[${new Date().toLocaleDateString()} — Status: ${oldStatus} → ${st}]`;
        const newNotes = lead?.notes ? lead.notes + '\n\n' + stamp : stamp;
        await setDoc(
          doc(db, 'leads', id),
          { status: st, notes: newNotes },
          { merge: true },
        );
      } else {
        await setDoc(doc(db, 'leads', id), { status: st }, { merge: true });
      }
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

  const setReminder = async (id: string, reminderDate: string | null) => {
    try {
      if (reminderDate === null) {
        await setDoc(
          doc(db, 'leads', id),
          { reminderDate: deleteField() },
          { merge: true },
        );
      } else {
        await setDoc(doc(db, 'leads', id), { reminderDate }, { merge: true });
      }
      flashSaved();
    } catch (e: any) {
      surface(e, OperationType.UPDATE, `leads/${id}`);
    }
  };

  const addLeadFromBolt = async (lead: Lead) => {
    if (!requireTenant()) return;
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
        ...tenantStamp,
      };
      await setDoc(doc(db, 'leads', lead.id), fullLead);
      flashSaved();
    } catch (e: any) {
      surface(e, OperationType.CREATE, `leads/${lead.id}`);
    }
  };

  /** One-click "I emailed them" — bumps touch tracking, stamps the notes,
   * and only ever upgrades status (new/called/voicemail → emailed). */
  const markEmailed = async (lead: Lead) => {
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
    try {
      await setDoc(doc(db, 'leads', lead.id), fields, { merge: true });
      flashSaved();
    } catch (e: any) {
      surface(e, OperationType.UPDATE, `leads/${lead.id}`);
    }
  };

  const queueOutreach = async (lead: Lead) => {
    try {
      const current = (lead as any).queued_for_outreach;
      await setDoc(
        doc(db, 'leads', lead.id),
        { queued_for_outreach: !current },
        { merge: true },
      );
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

  return {
    saved,
    appError,
    setAppError,
    addLead,
    findLeads,
    setStatus,
    updateLead,
    saveNote,
    setReminder,
    addLeadFromBolt,
    markEmailed,
    queueOutreach,
    deleteLead,
  };
}
