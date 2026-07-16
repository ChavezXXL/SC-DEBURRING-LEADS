/**
 * Reconcile SC's full client / do-not-contact list INTO the CRM so cold-outreach
 * filters (which key off status==='client') actually block every past client.
 * Any CRM lead whose name matches the client list but isn't status 'client' gets
 * flipped to 'client' with a note. Dry-run default; --commit to write.
 *   cd "C:\Users\scpre\SC LEADS PP" && npx tsx scripts/reconcile-clients.ts [--commit]
 */
import { existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;

// From growth_engine/engine/DO-NOT-CONTACT.md + client-reactivation.md (past clients).
const CLIENTS = [
  'Alziebler', 'American Precision Tool', 'Delta Hi-Tech', 'ERA Industries', 'Euro Machine',
  'F&L Machine', 'Fontal Control', 'G&H Precision', 'Gadget CNC', 'Gerhardt Gear', 'H&H Machining',
  'Hydromach', 'J&S Machine Works', 'Jolfa Tools', 'LA Propoint', 'Lansair', "Lee's Enterprise",
  'Lund Dunn Machine', 'MachineWorks Mfg', 'Magjes Engineering', 'MAP Deburring', 'NAE Machine',
  'PAMCO', 'Photo-Sonics', 'S&H Machine', 'Tecfar', 'UDASH Corp', 'W Machine Works',
  'Western Precision Aero', 'Wilmanco', 'Coronado Manufacturing',
];

// Strip ONLY corporate suffixes (repeatedly), never industry words — keep the
// distinctive core so both sides collapse identically.
const base = (s: string) => {
  let x = (s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '');
  let prev;
  do { prev = x; x = x.replace(/(incorporated|inc|llc|corp|corporation|ltd|limited|company|co)$/, ''); } while (x !== prev);
  return x;
};
// match on exact core, or a clear prefix (guarded by length to avoid tiny false hits)
const isMatch = (leadCo: string, clientList: string[]) => {
  const l = base(leadCo);
  if (!l) return false;
  return clientList.some(c => { const k = base(c); return k.length >= 5 && (k === l || l.startsWith(k) || k.startsWith(l)); });
};

async function main() {
  const commit = process.argv.includes('--commit');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').get();

  const matches: { id: string; co: string; status: string }[] = [];
  snap.forEach(d => {
    const x = d.data() as any;
    if (isMatch(x.co, CLIENTS)) matches.push({ id: d.id, co: x.co, status: x.status });
  });

  console.log(`Client list: ${CLIENTS.length} names. CRM leads matching: ${matches.length}`);
  // 'anchor' (2026-07-10 ladder status: a client at ≥$10K/mo standing work) is
  // client-equivalent — never downgrade it back to plain 'client'.
  const toFlip = matches.filter(m => m.status !== 'client' && m.status !== 'anchor');
  console.log(`Already status=client: ${matches.length - toFlip.length}`);
  console.log(`Would flip to client: ${toFlip.length}`);
  toFlip.forEach(m => console.log(`  ${commit ? '>' : '~'} ${m.co}  (was: ${m.status})`));

  if (commit) {
    for (const m of toFlip) {
      await db.collection('leads').doc(m.id).update({
        status: 'client',
        notes: `Reconciled to CLIENT 2026-07-01 (on SC do-not-contact list — past/current client, was "${m.status}"). Do NOT cold-email; reactivation = call/check-in.`,
      });
    }
    console.log(`DONE. Flipped ${toFlip.length} to client.`);
  } else {
    console.log('DRY RUN. Re-run with --commit to flip.');
  }
  process.exit(0);
}
main().catch(e => { console.error('ERROR:', e.code || '', e.message || e); process.exit(1); });
