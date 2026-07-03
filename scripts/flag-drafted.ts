/**
 * Flag CRM leads (matched by email) as "drafted, pending send". Reusable.
 *   cd "C:\Users\scpre\SC LEADS PP"
 *   npx tsx scripts/flag-drafted.ts --commit a@x.com b@y.com ...
 * Idempotent (won't double-add the note). Omit --commit to preview.
 */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const MARK = '[2026-06-23] Cold email DRAFTED in Gmail (approved template), pending send.';
const normEm = (s: string) => (s || '').toLowerCase().trim();

async function main() {
  const commit = process.argv.includes('--commit');
  const emails = process.argv.slice(2).filter(a => a.includes('@')).map(normEm);
  if (!emails.length) { console.error('Pass one or more emails.'); process.exit(1); }
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const leads = (await db.collection('leads').get()).docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  const byEmail = new Map(leads.filter(l => l.em).map(l => [normEm(l.em), l]));
  let flagged = 0, skipped = 0, missing = 0;
  for (const em of emails) {
    const lead = byEmail.get(em);
    if (!lead) { console.log(`  ! no lead for ${em}`); missing++; continue; }
    if ((lead.notes || '').includes(MARK)) { skipped++; continue; }
    const notes = `${(lead.notes || '').trim()}\n${MARK}`.trim();
    console.log(`  ${commit ? '+' : '~'} ${lead.co} <${em}>`);
    if (commit) { await db.collection('leads').doc(lead.id).set({ notes }, { merge: true }); flagged++; }
  }
  console.log(`--- ${commit ? `flagged ${flagged}` : 'DRY RUN'}, skipped ${skipped}, missing ${missing}`);
  process.exit(0);
}
main().catch(e => { console.error('ERROR:', e.code || '', e.message || e); process.exit(1); });
