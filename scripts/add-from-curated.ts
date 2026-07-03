/**
 * Add the curated 2026-06-30 web-sweep prospects to the CRM (tagged sc-deburring),
 * deduped against LIVE CRM by normalized name + email. Phones pulled from the
 * workflow notes. Dry-run by default; --commit to write.
 *   cd "C:\Users\scpre\SC LEADS PP" && npx tsx scripts/add-from-curated.ts [--commit]
 */
import { existsSync, readFileSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const CURATED = String.raw`C:\Users\scpre\AppData\Local\Temp\claude\C--Users-scpre-SC-DEBURR-MARKETING\c46d0ac7-80be-4db5-9553-323f89ead618\scratchpad\curated.json`;
const OUT = String.raw`C:\Users\scpre\AppData\Local\Temp\claude\C--Users-scpre-SC-DEBURR-MARKETING\c46d0ac7-80be-4db5-9553-323f89ead618\tasks\wi1oi3nv0.output`;
const TENANT = 'sc-deburring';

const norm = (s: string) => (s || '').toLowerCase()
  .replace(/\([^)]*\)/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '')
  .replace(/(incorporated|inc|llc|corp|corporation|ltd|limited|company|co)$/, '')
  .replace(/(incorporated|inc|llc|corp|corporation|ltd|limited|company|co)$/, '');

// Skip this one — PCC/Berkshire giant, vertically integrated, not an outsourced-deburring buyer.
const SKIP = new Set(['Airdrome Precision Components'].map(norm));
const T1 = new Set(['Farrar Aerospace', 'U.S. Precision Sheet Metal'].map(norm));
const normEm = (s: string) => (s || '').toLowerCase().trim();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const rand = () => Math.random().toString(36).slice(2, 7);

const region = (city = ''): string => {
  const c = city.toLowerCase();
  if (/valencia|santa clarita|saugus|newhall|castaic/.test(c)) return 'Santa Clarita Valley';
  if (/chatsworth|sun valley|pacoima|van nuys|sylmar|north hollywood|simi/.test(c)) return 'San Fernando Valley';
  if (/anaheim|yorba|brea|fullerton|garden grove|santa ana|irvine|orange|tustin|costa mesa|placentia/.test(c)) return 'Orange County';
  if (/ontario|corona|riverside|chino|rancho|san bernardino|pomona|fontana/.test(c)) return 'Inland Empire';
  if (/gardena|torrance|hawthorne|carson|compton|harbor|lawndale|el segundo/.test(c)) return 'South Bay';
  if (/escondido|san diego|vista|carlsbad|poway/.test(c)) return 'San Diego';
  return 'SoCal';
};
const phoneFrom = (notes = ''): string => {
  const m = notes.match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/);
  return m ? m[0].trim() : '';
};

async function main() {
  const commit = process.argv.includes('--commit');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();

  const curated = JSON.parse(readFileSync(CURATED, 'utf8'));
  const out = JSON.parse(readFileSync(OUT, 'utf8'));
  const allFound = (out.result && out.result.companies) || out.companies || [];
  const notesByName = new Map<string, string>();
  for (const c of allFound) notesByName.set(norm(c.co), c.notes || '');

  const rows = [
    ...curated.email.map((r: any) => ({ ...r, _emailable: true })),
    ...curated.call.map((r: any) => ({ ...r, _emailable: false })),
  ].filter((r: any) => !SKIP.has(norm(r.co)));

  const snap = await db.collection('leads').get();
  const existCo = new Set(snap.docs.map(d => norm((d.data() as any).co)).filter(Boolean));
  const existEm = new Set(snap.docs.map(d => normEm((d.data() as any).em)).filter(Boolean));

  let added = 0; const skipped: string[] = [];
  for (const r of rows) {
    const k = norm(r.co);
    const em = normEm(r.email);
    if (existCo.has(k) || (em && existEm.has(em))) { skipped.push(`${r.co} (already in CRM)`); continue; }

    const ph = phoneFrom(notesByName.get(k) || '');
    const note = r._emailable
      ? `Added 2026-06-30 (web sweep). Draft staged ${new Date().toISOString().slice(0, 10)} — pending Santiago's send. ${r.reason || ''}`.trim()
      : `Added 2026-06-30 (web sweep). CALL ONLY — no public sales inbox. ${r.reason || ''}`.trim();

    const id = `${slug(r.co).slice(0, 40)}-${rand()}`;
    const data: any = {
      id, tenantId: TENANT, t: T1.has(k) ? 1 : 2, r: region(r.city), co: r.co, city: r.city || '',
      ph, em: r.email || '', web: r.web || '', who: '', role: '', pm: '', pm_title: '',
      parts: r.parts || '', pitch: r.quality || '', status: 'new', notes: note, touchCount: 0,
    };
    console.log(`  ${commit ? '+' : '~'} ${r.co} — ${r.city} [${region(r.city)}, T${data.t}] ${r.email || '(call)'} ${ph || ''}`);
    if (commit) { await db.collection('leads').doc(id).set(data); added++; }
    existCo.add(k); if (em) existEm.add(em);
  }

  console.log('---');
  console.log(commit ? `DONE. Added ${added}, skipped ${skipped.length}.` : `DRY RUN. Would add ${rows.length - skipped.length}, skip ${skipped.length}. Re-run with --commit.`);
  skipped.forEach(s => console.log('  skip: ' + s));
  process.exit(0);
}
main().catch(e => { console.error('ERROR:', e.code || '', e.message || e); process.exit(1); });
