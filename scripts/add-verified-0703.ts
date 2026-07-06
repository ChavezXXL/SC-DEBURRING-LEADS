/**
 * 2026-07-03 VERIFIED batch. 3 confirmed-live deburr-hiring shops (call targets — no
 * clean sales inbox) + 2 normal email prospects. Every hiring claim checked on the
 * actual source today. Dry-run default; --commit.
 *   cd "C:\Users\scpre\SC LEADS PP" && npx tsx scripts/add-verified-0703.ts [--commit]
 */
import { existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const TENANT = 'sc-deburring';

type L = { co: string; city: string; r: string; ph: string; em: string; web: string; parts: string; pitch: string; notes: string };
const LEADS: L[] = [
  // --- confirmed live deburr reqs; CALL (published inbox is HR/recruiting, not sales) ---
  { co: 'Aluminum Precision Products', city: 'Santa Ana', r: 'Orange County', ph: '(714) 546-8125', em: '', web: 'https://www.aluminumprecision.com',
    parts: 'Aluminum impression-die & open-die forgings with integrated machining', pitch: 'Established forging house, ITAR',
    notes: 'Added 2026-07-03. HIRING (verified live today): "Deburrer 1st Shift" + "Deburrer 2nd Shift" + Grinder (ZipRecruiter/Glassdoor/LinkedIn). No sales inbox (only apphr@) — CALL (714) 546-8125.' },
  { co: 'Advanced Machining & Tooling (AMT)', city: 'Poway', r: 'San Diego', ph: '(858) 486-9050', em: '', web: 'https://www.amtmfg.com',
    parts: 'Difficult-to-machine aerospace & gas-turbine parts in exotic metals (EDM, waterjet, CNC)', pitch: 'AS9100 + ISO 9001, small business',
    notes: 'Added 2026-07-03. HIRING (verified live today): "Manufacturing Deburr Technician" on their Paylocity portal. Owner contact terry@amtmfg.com (Santiago eyeball). Poway = San Diego (far). CALL (858) 486-9050.' },
  { co: 'Vitesse Systems', city: 'Harbor City', r: 'South Bay', ph: '', em: '', web: 'https://vitessesys.com',
    parts: 'RF/antenna feed & machined assemblies for aerospace/defense (former Spacetime Engineering)', pitch: 'AS9100-class defense supplier',
    notes: 'Added 2026-07-03. HIRING (verified live today): "Deburring & Metal Finishing Technician I" finishing RF components (6:00a-2:30p). Only careers@vitessesys.com published (recruiting) — CALL; get # from vitessesys.com/locations.' },
  // --- normal email prospects (real sales inbox; not a hot-deburr claim) ---
  { co: 'Flight Works', city: 'Irvine', r: 'Orange County', ph: '', em: 'sales@flightworksinc.com', web: 'https://www.flightworksinc.com',
    parts: 'Miniature gear pumps, flow-control components, space propulsion & UAV fuel systems', pitch: 'Small precision space/aero/medical shop; hiring machine ops (busy)',
    notes: 'Added 2026-07-03 (job-board sweep). Busy/growing (machine-operator hiring). Draft staged 2026-07-03 — pending send.' },
  { co: 'ITL Dental', city: 'Irvine', r: 'Orange County', ph: '', em: 'sales@itldental.com', web: 'https://www.itldental.com',
    parts: 'OEM dental implants, abutments, drivers, surgical accessories (titanium)', pitch: 'ISO 13485 + MDSAP, FDA & CE MDR; implant polishing/finishing is core work',
    notes: 'Added 2026-07-03 (medical sweep). ISO 13485 implant OEM — finishing-heavy. Draft staged 2026-07-03 — pending send.' },
];

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const rand = () => Math.random().toString(36).slice(2, 7);

async function main() {
  const commit = process.argv.includes('--commit');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').get();
  const existCo = new Set(snap.docs.map(d => norm((d.data() as any).co)));
  const existEm = new Set(snap.docs.map(d => (d.data() as any).em?.toLowerCase()).filter(Boolean));

  let added = 0;
  for (const l of LEADS) {
    if (existCo.has(norm(l.co)) || (l.em && existEm.has(l.em.toLowerCase()))) { console.log(`  skip (in CRM): ${l.co}`); continue; }
    const id = `${slug(l.co).slice(0, 40)}-${rand()}`;
    const data: any = { id, tenantId: TENANT, t: 2, r: l.r, co: l.co, city: l.city, ph: l.ph, em: l.em, web: l.web,
      who: '', role: '', pm: '', pm_title: '', parts: l.parts, pitch: l.pitch, status: 'new', notes: l.notes, touchCount: 0 };
    console.log(`  ${commit ? '+' : '~'} ${l.co} — ${l.city} ${l.em || '(CALL ' + l.ph + ')'}`);
    if (commit) { await db.collection('leads').doc(id).set(data); added++; }
    existCo.add(norm(l.co)); if (l.em) existEm.add(l.em.toLowerCase());
  }
  console.log('---');
  console.log(commit ? `DONE. Added ${added}.` : `DRY RUN. Re-run with --commit.`);
  process.exit(0);
}
main().catch(e => { console.error('ERROR:', e.code || '', e.message || e); process.exit(1); });
