/**
 * Add the curated 2026-07-01 web-sweep prospects (San Diego / Ventura / Inland Empire / optics)
 * to the CRM, tagged sc-deburring, deduped vs LIVE CRM by name + email. Dry-run default; --commit.
 *   cd "C:\Users\scpre\SC LEADS PP" && npx tsx scripts/add-0701.ts [--commit]
 */
import { existsSync, readFileSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const CURATED = process.argv.find(a => a.endsWith('.json')) || String.raw`C:\Users\scpre\AppData\Local\Temp\claude\C--Users-scpre-SC-DEBURR-MARKETING\c46d0ac7-80be-4db5-9553-323f89ead618\scratchpad\curated2.json`;
const TENANT = 'sc-deburring';

const norm = (s: string) => (s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '')
  .replace(/(incorporated|inc|llc|corp|corporation|ltd|limited|company|co)$/, '')
  .replace(/(incorporated|inc|llc|corp|corporation|ltd|limited|company|co)$/, '');
const normEm = (s: string) => (s || '').toLowerCase().trim();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const rand = () => Math.random().toString(36).slice(2, 7);

const region = (city = ''): string => {
  const c = city.toLowerCase();
  if (/san diego|national city|poway|oceanside|escondido|el cajon|chula vista|santee|vista|carlsbad/.test(c)) return 'San Diego';
  if (/goleta|santa barbara|carpinteria/.test(c)) return 'Santa Barbara';
  if (/oxnard|camarillo|ventura|moorpark|thousand oaks|simi/.test(c)) return 'Ventura County';
  if (/temecula|murrieta|corona|norco|ontario|rancho|fontana|san bernardino|chino|pomona|moreno valley|riverside|upland|redlands/.test(c)) return 'Inland Empire';
  if (/valencia|santa clarita/.test(c)) return 'Santa Clarita Valley';
  if (/costa mesa|lake forest|irvine|anaheim|santa ana|brea|fullerton|garden grove|orange|tustin/.test(c)) return 'Orange County';
  return 'SoCal';
};

async function main() {
  const commit = process.argv.includes('--commit');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const cur = JSON.parse(readFileSync(CURATED, 'utf8'));
  const rows = [
    ...cur.email.map((r: any) => ({ ...r, _flag: false })),
    ...cur.flag.map((r: any) => ({ ...r, _flag: true })),
  ];

  const snap = await db.collection('leads').get();
  const existCo = new Set(snap.docs.map(d => norm((d.data() as any).co)).filter(Boolean));
  const existEm = new Set(snap.docs.map(d => normEm((d.data() as any).em)).filter(Boolean));

  let added = 0; const skipped: string[] = [];
  for (const r of rows) {
    const k = norm(r.co), em = normEm(r.email);
    if (existCo.has(k) || (em && existEm.has(em))) { skipped.push(r.co); continue; }
    const note = r._flag
      ? `Added 2026-07-01 (web sweep: SD/Ventura/IE/optics). HAS EMAIL (${r.email}) but it's owner-name/unverified — Santiago eyeball before sending.`
      : `Added 2026-07-01 (web sweep: SD/Ventura/IE/optics). Draft staged 2026-07-01 — pending send.`;
    const id = `${slug(r.co).slice(0, 40)}-${rand()}`;
    const data: any = {
      id, tenantId: TENANT, t: 2, r: region(r.city), co: r.co, city: r.city || '',
      ph: '', em: r.email || '', web: r.web || '', who: '', role: '', pm: '', pm_title: '',
      parts: r.parts || '', pitch: r.quality || '', status: 'new', notes: note, touchCount: 0,
    };
    console.log(`  ${commit ? '+' : '~'} ${r.co} — ${r.city} [${region(r.city)}] ${r.email}${r._flag ? '  (FLAG)' : ''}`);
    if (commit) { await db.collection('leads').doc(id).set(data); added++; }
    existCo.add(k); if (em) existEm.add(em);
  }
  console.log('---');
  console.log(commit ? `DONE. Added ${added}, skipped ${skipped.length}.` : `DRY RUN. Would add ${rows.length - skipped.length}, skip ${skipped.length}. Re-run with --commit.`);
  if (skipped.length) console.log('skipped: ' + skipped.join(', '));
  process.exit(0);
}
main().catch(e => { console.error('ERROR:', e.code || '', e.message || e); process.exit(1); });
