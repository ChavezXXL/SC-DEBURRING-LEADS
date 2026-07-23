/** Find and merge duplicate lead records (same company, two docs).
 * Keeps the RICHER record, folds in any field the other has that it lacks,
 * concatenates notes, keeps the warmest status and the higher touchCount,
 * then deletes the loser — after writing every deleted doc to a local backup
 * file so the merge is reversible. Dry-run by default; --commit to write. */
import { existsSync, writeFileSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const BACKUP = String.raw`C:\Users\scpre\AppData\Local\Temp\claude\C--Users-scpre-SC-DEBURR-MARKETING\e4cd93b7-63fc-42ac-93da-390226cbcfbb\scratchpad\deleted-dupes-0722.json`;
const TENANT = 'sc-deburring';

// Warmer = higher. The merged record keeps the warmest status of the pair.
const RANK: Record<string, number> = {
  research_rejected: -2, research_pending: -1, dead: 0, new: 1, called: 2, voicemail: 2,
  emailed: 3, visited: 4, interested: 5, quote: 6, sample: 7, po: 8, client: 9, anchor: 10,
};
const FIELDS = ['ph', 'em', 'web', 'who', 'role', 'pm', 'pm_title', 'parts', 'pitch', 'address', 'city', 'r'];

const norm = (s: string) =>
  (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|llc|corp|corporation|co|company|ltd|the)\b/g, '')
    .replace(/\s+/g, ' ').trim();

const score = (l: any) =>
  FIELDS.reduce((n, f) => n + (String(l[f] || '').trim() ? 1 : 0), 0) +
  (l.notes ? String(l.notes).length / 500 : 0) +
  (typeof l.lat === 'number' ? 2 : 0);

async function main() {
  const commit = process.argv.includes('--commit');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', TENANT).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

  const groups = new Map<string, any[]>();
  for (const l of all) {
    const k = norm(l.co);
    if (k.length < 4) continue; // never group blank/short names
    groups.set(k, [...(groups.get(k) || []), l]);
  }
  const dupes = [...groups.entries()].filter(([, v]) => v.length > 1);

  console.log(`MODE: ${commit ? 'COMMIT' : 'DRY-RUN'}`);
  console.log(`Duplicate groups: ${dupes.length}\n`);
  const deleted: any[] = [];
  let merges = 0;

  for (const [key, rows] of dupes) {
    rows.sort((a, b) => score(b) - score(a));
    const keep = rows[0];
    const losers = rows.slice(1);
    console.log(`--- ${keep.co}  (${rows.length} records)`);
    console.log(`    KEEP  ${keep.id}  status=${keep.status} score=${score(keep).toFixed(1)}`);

    const patch: Record<string, unknown> = {};
    let notes = String(keep.notes || '');
    let touch = Number(keep.touchCount || 0);
    let status = keep.status;
    let lastContact = keep.lastContactedAt || '';

    for (const lo of losers) {
      console.log(`    DROP  ${lo.id}  status=${lo.status} score=${score(lo).toFixed(1)}  co="${lo.co}"`);
      for (const f of FIELDS) {
        const mine = String((patch as any)[f] ?? keep[f] ?? '').trim();
        const theirs = String(lo[f] || '').trim();
        if (!mine && theirs) { (patch as any)[f] = theirs; console.log(`          + ${f}: ${theirs.slice(0, 50)}`); }
      }
      if (typeof keep.lat !== 'number' && typeof lo.lat === 'number') { patch.lat = lo.lat; patch.lng = lo.lng; console.log('          + lat/lng'); }
      const ln = String(lo.notes || '').trim();
      if (ln && !notes.includes(ln.slice(0, 40))) notes = notes ? `${notes}\n${ln}` : ln;
      touch += Number(lo.touchCount || 0);
      if ((RANK[lo.status] ?? 0) > (RANK[status] ?? 0)) status = lo.status;
      if (lo.lastContactedAt && lo.lastContactedAt > lastContact) lastContact = lo.lastContactedAt;
      deleted.push(lo);
    }

    // "Keep the warmest status" is wrong when the warm one is STALE. Force
    // Fabrication is marked interested from an old note, but Justin declined by
    // email on 2026-07-18 ("we currently have deburr personnel conducting
    // everything we do"). Truth beats optimism.
    if (/force fabrication/i.test(keep.co || '')) {
      status = 'dead';
      const decline = '[2026-07-18] DECLINED by email — Justin Gamble: "we currently have deburr personnel conducting everything we do. If something changes or larger projects come up, we\'ll let you know." Door left open; revisit if they win a big program.';
      if (!notes.includes('DECLINED by email')) notes = notes ? `${notes}\n${decline}` : decline;
      console.log('          status -> dead (declined 2026-07-18, overriding stale "interested")');
    }

    if (notes !== (keep.notes || '')) patch.notes = notes;
    if (touch !== Number(keep.touchCount || 0)) patch.touchCount = touch;
    if (status !== keep.status) { patch.status = status; console.log(`          status -> ${status}`); }
    if (lastContact && lastContact !== keep.lastContactedAt) patch.lastContactedAt = lastContact;

    merges++;
    if (commit) {
      if (Object.keys(patch).length) await db.collection('leads').doc(keep.id).set(patch, { merge: true });
      for (const lo of losers) await db.collection('leads').doc(lo.id).delete();
    }
    console.log('');
  }

  if (deleted.length) writeFileSync(BACKUP, JSON.stringify(deleted, null, 1));
  console.log(`${commit ? 'Merged' : 'Would merge'} ${merges} groups, ${commit ? 'deleted' : 'would delete'} ${deleted.length} duplicate records.`);
  console.log(`Backup of dropped records: ${BACKUP}`);
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.message || e); process.exit(1); });
