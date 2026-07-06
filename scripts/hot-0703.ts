/**
 * 2026-07-03 hiring-signal batch: add 3 new hot leads + stamp hiring signals on
 * 5 existing CRM leads (so they surface in the Today tab's Calls list).
 * S&H Machine is a CLIENT — do NOT touch for cold outreach (expansion call only).
 * Dry-run default; --commit to write.
 *   cd "C:\Users\scpre\SC LEADS PP" && npx tsx scripts/hot-0703.ts [--commit]
 */
import { existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const TENANT = 'sc-deburring';
const TODAY = '2026-07-03';

const NEW_LEADS = [
  { co: 'Pro-Dex Inc', city: 'Irvine', r: 'Orange County', t: 2, em: 'sales@pro-dex.com', web: 'https://www.pro-dex.com',
    parts: 'Surgical powered drivers + medical device contract manufacturing (machining + assembly)',
    pitch: 'NASDAQ: PDEX, FDA-registered, Irvine + Tustin plants',
    notes: `Added ${TODAY} (job-board sweep). HIRING "Polish & Deburr Technician" (SimplyHired, Jul 2026) — finishing bench is strained. Draft staged ${TODAY} — pending send.` },
  { co: 'Threadlock Precision', city: 'Cypress', r: 'Orange County', t: 2, em: 'contact@threadlockprecision.com', web: 'https://www.threadlockprecision.com',
    parts: 'Aerospace/defense precision machining — milling, Swiss turning, large-format gantry, assembly',
    pitch: 'D.E. Shaw-backed multi-plant group (acquired J&F Machine, R&S Machining) — growing fast',
    notes: `Added ${TODAY} (job-board sweep). HIRING "Deburr Operator" at Cypress plant (SimplyHired, Jul 2026). Draft staged ${TODAY} — pending send.` },
  { co: 'Nytron Aerospace — Manufacturing Systems', city: 'Santa Ana', r: 'Orange County', t: 2, em: 'info@nytron.aero', web: 'https://mfg.nytron.aero',
    parts: 'CNC milling, turning, EDM & assembly for spacecraft, launch vehicles, missiles (formerly JK Engineering)',
    pitch: 'Space/defense manufacturer, Nytron engineering + NDT group',
    notes: `Added ${TODAY} (job-board sweep). HIRING "Deburr Operator", Santa Ana (SimplyHired, Jul 2026). Draft staged ${TODAY} — pending send.` },
];

// Existing CRM leads that are HIRING deburr roles right now → stamp signal + fill missing contact info.
const UPDATES: { match: string; note: string; em?: string; ph?: string }[] = [
  { match: 'marples gears',
    note: `[${TODAY}] HIRING "Deburr Technician" ($12-16/hr + $1,000 signing bonus) on their OWN employment page + 4 more roles (QC, 2x CNC, CMM) — slammed. Draft staged ${TODAY} — pending send.`,
    em: 'info@marplesgearsinc.com' },
  { match: 'camtech',
    note: `[${TODAY}] HIRING "Deburr/Bench Technician" (own careers page, "Just Posted" Jul 2026; posting says 95% of work under microscope — SC's exact niche) + 3 CNC roles + estimator. NO published email — CALL 949-263-8911.`,
    ph: '949-263-8911' },
  { match: 'mulgrew aircraft',
    note: `[${TODAY}] HIRING "Bench/Deburrer" (SimplyHired, Jul 2026). Published inbox is customerfeedback@ (odd for cold pitch) — better to CALL; person contact mikehoushiar@mulgrewaircraft.com on their contact page (Santiago eyeball).` },
  { match: 'crissair',
    note: `[${TODAY}] HIRING "Deburring Technician" ($18-24/hr, Indeed/Glassdoor — deburring valve bodies w/ abrasive wheels/rotary tools/hand scraping). ~20 min from Pacoima. No email published — CALL 661-367-3300.`,
    ph: '661-367-3300' },
  { match: 'acra aerospace',
    note: `[${TODAY}] HIRING "Lead Deburr Operator", Anaheim — posted 3 days ago (SimplyHired). Site has form only; directory lists Winnie Mopera x217 (wmopera@acraaerospace.com — person email, Santiago eyeball before using). CALL first.` },
];

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const rand = () => Math.random().toString(36).slice(2, 7);

async function main() {
  const commit = process.argv.includes('--commit');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').get();
  const all = snap.docs.map(d => ({ ref: d.ref, id: d.id, ...(d.data() as any) }));
  const existCo = new Set(all.map(l => norm(l.co)));

  // adds
  for (const s of NEW_LEADS) {
    if (existCo.has(norm(s.co)) || all.some(l => (l.em || '').toLowerCase() === s.em.toLowerCase())) {
      console.log(`  skip (already in CRM): ${s.co}`); continue;
    }
    const id = `${slug(s.co).slice(0, 40)}-${rand()}`;
    const data: any = { id, tenantId: TENANT, t: s.t, r: s.r, co: s.co, city: s.city, ph: '', em: s.em, web: s.web,
      who: '', role: '', pm: '', pm_title: '', parts: s.parts, pitch: s.pitch, status: 'new', notes: s.notes, touchCount: 0 };
    console.log(`  ${commit ? '+' : '~'} ADD ${s.co} — ${s.city} ${s.em}`);
    if (commit) await db.collection('leads').doc(id).set(data);
  }

  // updates
  for (const u of UPDATES) {
    const hits = all.filter(l => norm(l.co).includes(u.match));
    if (!hits.length) { console.log(`  !! no CRM match for "${u.match}"`); continue; }
    for (const h of hits) {
      if (h.status === 'client') { console.log(`  BLOCKED (client): ${h.co}`); continue; }
      const patch: any = { notes: ((h.notes || '') + '\n' + u.note).trim() };
      if (u.em && !h.em) patch.em = u.em;
      if (u.ph && !h.ph) patch.ph = u.ph;
      console.log(`  ${commit ? '>' : '~'} STAMP ${h.co} [${h.status}]${u.em && !h.em ? ' +email' : ''}${u.ph && !h.ph ? ' +phone' : ''}`);
      if (commit) await h.ref.set(patch, { merge: true });
    }
  }
  console.log(commit ? 'DONE.' : 'DRY RUN — re-run with --commit.');
  process.exit(0);
}
main().catch(e => { console.error('ERROR:', e.code || '', e.message || e); process.exit(1); });
