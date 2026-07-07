import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Lead } from '../types';
import { RAW } from '../data';
import { OperationType, handleFirestoreError } from './firestore-errors';

const INIT_LEADS: Lead[] = (Array.isArray(RAW) ? RAW : []).map((l) => ({
  ...l,
  status: 'new' as const,
  notes: '',
}));

/**
 * Firestore hands us brand-new lead objects on every snapshot — even for docs
 * that didn't change. That churns object identity and forces all ~275 memoized
 * LeadCards to re-render on any single update. Reuse the previous object for any
 * lead whose serialized content is identical, so only genuinely-changed cards
 * get a new reference (and thus re-render).
 */
function reconcileLeadIdentity(prev: Lead[], next: Lead[]): Lead[] {
  if (prev.length === 0) return next;
  const prevById = new Map(prev.map((l) => [l.id, l]));
  let changed = prev.length !== next.length;
  const merged = next.map((lead) => {
    const old = prevById.get(lead.id);
    if (old && JSON.stringify(old) === JSON.stringify(lead)) return old;
    changed = true;
    return lead;
  });
  // Nothing changed at all — keep the previous array reference too.
  return changed ? merged : prev;
}

// Forced ON to match the deployed Firestore rules (auth required). With this
// off, the query ran unauthenticated and Firestore denied the leads read.
const REQUIRE_AUTH = true;

/**
 * Subscribes to the leads collection in Firestore. Scopes by tenantId when
 * one is provided; otherwise (legacy mode / auth off) returns all leads.
 *
 * Also tracks locally-deleted ids in localStorage so client-side deletes
 * stick even when Firestore rules block the actual delete.
 *
 * Seeding behavior: in legacy single-tenant mode, if the leads collection
 * is empty AND we haven't seeded before, push INIT_LEADS into Firestore once.
 * Multi-tenant accounts start blank (that's the point of "suit them").
 */
export function useLeads(tenantId: string | undefined, opts?: { skip?: boolean }) {
  const skip = opts?.skip ?? false;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('sc_deleted_leads');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    // Platform Console (super-admin, no active client workspace): intentionally
    // no leads. Resolve immediately so the shell doesn't hang on the loader.
    if (skip) {
      setLeads([]);
      setLoading(false);
      setDbError(null);
      return;
    }
    // Auth on but tenant not loaded yet — don't subscribe globally (would leak
    // other tenants' docs into the cache). AuthGate is showing Login/loading.
    if (REQUIRE_AUTH && !tenantId) return;

    const leadsRef = collection(db, 'leads');
    const leadsQuery = tenantId
      ? query(leadsRef, where('tenantId', '==', tenantId))
      : leadsRef;

    const unsub = onSnapshot(
      leadsQuery,
      async (snapshot) => {
        try {
          const dbLeads = snapshot.docs.map(
            (d) => ({ ...d.data(), id: d.id }) as Lead,
          );

          if (
            !tenantId &&
            snapshot.empty &&
            !localStorage.getItem('sc_leads_seeded')
          ) {
            // First-time setup in legacy single-tenant mode — seed once.
            setLeads(INIT_LEADS);
            localStorage.setItem('sc_leads_seeded', '1');
            try {
              const batch = writeBatch(db);
              INIT_LEADS.forEach((lead) => {
                batch.set(doc(db, 'leads', lead.id), lead);
              });
              await batch.commit();
            } catch (e) {
              console.warn('Could not write init leads to DB:', e);
            }
          } else {
            setLeads((prev) => reconcileLeadIdentity(prev, dbLeads));
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
      },
    );

    return () => unsub();
  }, [tenantId, skip]);

  // Filter out client-side-deleted leads from the visible list.
  const visibleLeads = useMemo(
    () => leads.filter((l) => !deletedIds.has(l.id)),
    [leads, deletedIds],
  );

  const markDeleted = (id: string) => {
    const next = new Set(deletedIds);
    next.add(id);
    setDeletedIds(next);
    try {
      localStorage.setItem('sc_deleted_leads', JSON.stringify([...next]));
    } catch {}
  };

  return { leads, visibleLeads, loading, dbError, markDeleted };
}
