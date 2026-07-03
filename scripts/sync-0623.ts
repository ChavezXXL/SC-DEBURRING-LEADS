/**
 * 2026-06-23 CRM sync (admin / serviceAccount.json):
 *   PART 1 — add the 3 shops emailed Jun 22 that aren't in the CRM yet (status emailed).
 *   PART 2 — flag the 12 shops drafted today (10 batch + Precise + Anacapa) with a
 *            "drafted, pending send" note; fill in emails for Precise/Anacapa.
 * Idempotent. Dry-run by default; pass --commit to write.
 *   cd "C:\Users\scpre\SC LEADS PP" && npx tsx scripts/sync-0623.ts [--commit]
 */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const TENANT_ID = 'sc-deburring';
const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const SENT_AT = '2026-06-23T02:16:00Z';
const DRAFT_MARK = '[2026-06-23] Cold email DRAFTED in Gmail (approved template), pending send.';

const ADD_EMAILED = [
  { co: 'RivCut', city: 'Torrance', r: 'Gardena / South Bay', t: 1, em: 'hello@rivcut.com', web: 'https://rivcut.com',
    parts: 'Titanium, Inconel, aerospace alloys to ±0.001", 24hr quotes',
    note: 'Cold email sent Jun 22 2026 (approved template, quotes@). Added to CRM 2026-06-23.' },
  { co: 'SMI-CA', city: 'Santa Fe Springs', r: 'Other', t: 1, em: 'dok@smi-ca.com', web: 'https://www.smi-ca.com',
    parts: 'AS9100D, aerospace airframe brackets/housings 6061/7075/2024',
    note: 'Cold email sent Jun 22 2026 (approved template, quotes@). Added to CRM 2026-06-23.' },
  { co: 'Riverside Machine', city: 'Riverside', r: 'Other', t: 1, em: 'sales@rmcaero.com', web: 'https://rmcaero.com',
    parts: '60+ yrs, ISO 9001 + ITAR, commercial/aerospace/defense',
    note: 'DOUBLE-SENT Jun 22 2026: "Hi there" template 5:34pm + approved 7:16pm. Added to CRM 2026-06-23.' },
];

// 10 batch drafts — match existing leads by email.
const DRAFTED_EMAILS = [
  'sales@aaeroswiss.com', 'info@aceclearwater.com', 'info@avalon.aero', 'sales@haskel.com',
  'quotes@lagauge.com', 'sales@laserworxmfg.com', 'quoting@lvswiss.com', 'sales@romiindustries.com',
  'info@senga-eng.com', 'sales@wcmmanufacturing.com',
];
// Precise + Anacapa — match by company, and fill the email we drafted to.
const DRAFTED_BY_CO = [
  { co: 'Precise Aerospace Manufacturing', em: 'sales@precisemfg.com' },
  { co: 'Anacapa Industries', em: 'info@anacapaindustries.com' },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const rand = () => Math.random().toString(36).substring(2, 7);
const normCo = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normEm = (s: string) => (s || '').toLowerCase().trim();

async function main() {
  const commit = process.argv.includes('--commit');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').get();
  const leads = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  const byEmail = new Map(leads.filter(l => l.em).map(l => [normEm(l.em), l]));
  const existCo = new Set(leads.map(l => normCo(l.co)));

  let added = 0, flagged = 0, skipped = 0;

  // PART 1 — add missing emailed shops
  for (const s of ADD_EMAILED) {
    if (existCo.has(normCo(s.co)) || (s.em && byEmail.has(normEm(s.em)))) { console.log(`  = ${s.co} already in CRM (skip add)`); skipped++; continue; }
    const id = `${slug(s.co).slice(0, 40)}-${rand()}`;
    const data = { id, tenantId: TENANT_ID, t: s.t, r: s.r, co: s.co, city: s.city, ph: '', em: s.em, web: s.web,
      who: '', role: '', pm: '', pm_title: '', parts: s.parts, pitch: '', status: 'emailed',
      notes: s.note, lastContactedAt: SENT_AT, touchCount: 1 };
    console.log(`  ${commit ? '+' : '~'} ADD ${s.co} (emailed)`);
    if (commit) { await db.collection('leads').doc(id).set(data); added++; }
  }

  // PART 2a — flag the 10 batch drafts (match by email)
  for (const em of DRAFTED_EMAILS) {
    const lead = byEmail.get(normEm(em));
    if (!lead) { console.log(`  ! no lead for ${em} (skip)`); continue; }
    if ((lead.notes || '').includes(DRAFT_MARK)) { skipped++; continue; }
    const notes = `${(lead.notes || '').trim()}\n${DRAFT_MARK}`.trim();
    console.log(`  ${commit ? '+' : '~'} FLAG ${lead.co} <${em}> drafted`);
    if (commit) { await db.collection('leads').doc(lead.id).set({ notes }, { merge: true }); flagged++; }
  }

  // PART 2b — Precise + Anacapa: set email + drafted flag (match by company)
  for (const d of DRAFTED_BY_CO) {
    const lead = leads.find(l => { const a = normCo(l.co), b = normCo(d.co); return a && (a === b || a.includes(b) || b.includes(a)); });
    if (!lead) { console.log(`  ! no lead for ${d.co} (skip)`); continue; }
    if ((lead.notes || '').includes(DRAFT_MARK)) { skipped++; continue; }
    const notes = `${(lead.notes || '').trim()}\n${DRAFT_MARK}`.trim();
    console.log(`  ${commit ? '+' : '~'} FLAG ${lead.co} <${d.em}> drafted + set email`);
    if (commit) { await db.collection('leads').doc(lead.id).set({ notes, em: d.em }, { merge: true }); flagged++; }
  }

  console.log('---');
  console.log(commit ? `[sync] DONE. Added ${added}, flagged ${flagged}, skipped ${skipped}.`
                     : `[sync] DRY RUN. Would add 3, flag 12 (skip ${skipped} already-done). Re-run with --commit.`);
  process.exit(0);
}
main().catch(e => { console.error('[sync] ERROR:', e.code || '', e.message || e); process.exit(1); });
