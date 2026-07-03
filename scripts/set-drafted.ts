/**
 * Set email + "drafted, pending send" note on CRM leads matched by COMPANY name.
 * For leads that had no email on file. Args: "Company Name=email" pairs.
 *   npx tsx scripts/set-drafted.ts --commit "L&M Machining Corp=mikemai@lmcnc.com" ...
 * Idempotent. Omit --commit to preview.
 */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const MARK = '[2026-06-23] Cold email DRAFTED in Gmail (approved template), pending send.';
const normCo = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function main() {
  const commit = process.argv.includes('--commit');
  const pairs = process.argv.slice(2).filter(a => a.includes('=')).map(a => {
    const i = a.indexOf('='); return { co: a.slice(0, i), em: a.slice(i + 1) };
  });
  if (!pairs.length) { console.error('Pass "Company=email" pairs.'); process.exit(1); }
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const leads = (await db.collection('leads').get()).docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  let done = 0, miss = 0;
  for (const p of pairs) {
    const b = normCo(p.co);
    const lead = leads.find(l => { const a = normCo(l.co); return a && (a === b || a.includes(b) || b.includes(a)); });
    if (!lead) { console.log(`  ! no lead for ${p.co}`); miss++; continue; }
    const notes = (lead.notes || '').includes(MARK) ? lead.notes : `${(lead.notes || '').trim()}\n${MARK}`.trim();
    console.log(`  ${commit ? '+' : '~'} ${lead.co} <- ${p.em}`);
    if (commit) { await db.collection('leads').doc(lead.id).set({ em: p.em, notes }, { merge: true }); done++; }
  }
  console.log(`--- ${commit ? `updated ${done}` : 'DRY RUN'}, missing ${miss}`);
  process.exit(0);
}
main().catch(e => { console.error('ERROR:', e.code || '', e.message || e); process.exit(1); });
