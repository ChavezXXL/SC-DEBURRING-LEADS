/**
 * Add newly-researched SoCal shops to the SC LEADS CRM — with dedupe.
 *
 * For each shop below: if a lead with the same normalized company name OR the
 * same email already exists in the tenant, SKIP it (no dupe). Otherwise add it
 * as a fresh lead (status "new", not yet contacted).
 *
 * SAFE BY DEFAULT — previews only. Pass --commit to write.
 * Idempotent: re-running adds nothing new once these exist.
 *
 * Auth + run: identical to mark-emailed.ts (see its header).
 *     cd "C:\Users\scpre\SC LEADS PP"
 *     # serviceAccount.json present → $env:GOOGLE_APPLICATION_CREDENTIALS=".\serviceAccount.json"
 *     # or your login → $env:SC_USER=...; $env:SC_PASS=...
 *     npx tsx scripts/add-leads.ts            # preview
 *     npx tsx scripts/add-leads.ts --commit   # write
 */

const TENANT_ID = 'sc-deburring';

interface NewLead {
  co: string; city: string; r: string; t: 1 | 2;
  em?: string; ph?: string; web?: string; who?: string; role?: string;
  parts?: string; pitch?: string;
}

// Genuinely-new shops from the 2026-06-23 web sweep.
// (Deliberately EXCLUDED — already in CRM from the Jun 1 blitz: Vinaco Precision,
//  PAC/Reach Precision Aerospace, California Machine Specialties, Paragon Precision.
//  Also excluded: Roberson Machine Co — national SEO operation, not a real SoCal shop.)
const NEW_LEADS: NewLead[] = [
  { co: 'Hansen Engineering', city: 'Harbor City', r: 'Gardena / South Bay', t: 1,
    ph: '(310) 534-3870', web: 'https://hansenengineering.com',
    parts: '39k sq ft, 54 ppl, 5-axis Ti/Inconel/steel/Al. Boeing 737/767 structural assemblies (Spirit-approved).',
    pitch: 'Form-only (no published email) — pull buyer via Apollo or call. Exotic-alloy variant.' },
  { co: 'RAMP Engineering', city: 'Paramount', r: 'Long Beach / Paramount', t: 2,
    em: 'sales@rampengineering.com', ph: '(562) 531-8030', web: 'https://www.rampengineering.com',
    parts: 'Aerospace CNC, titanium + aluminum specialty, prototype + production. 6850 Walthall Way.',
    pitch: 'Direct email sales@. Exotic-alloy variant.' },
  { co: 'Clean Cut Machining', city: 'Burbank', r: 'Glendale / Burbank', t: 1,
    parts: 'Exotic-materials specialty; JPL/Honeywell/Lockheed/GKN parts. 919 W. Isabel St Ste J. No standalone site.',
    pitch: 'No published email — pull via Apollo. Burbank, next door to Pacoima. Main template.' },
  { co: 'Precise Aerospace Manufacturing', city: 'Yorba Linda', r: 'Orange County', t: 1,
    em: 'sales@precisemfg.com', ph: '(951) 898-0500', web: 'https://precisemfg.com',
    parts: 'Since 1965, AS9100D, full-service CNC + assembly. 22951 E. La Palma Ave.',
    pitch: 'Direct email sales@. Assembly-ready = burr-free required. Turnkey variant.' },
  { co: 'Anacapa Industries', city: 'Camarillo', r: 'Oxnard', t: 2,
    em: 'info@anacapaindustries.com', ph: '(805) 981-0748', web: 'https://www.anacapaindustries.com',
    parts: 'CNC machining + surface finishing/blasting, aerospace/military. 20k sq ft. 90 South Wood Rd.',
    pitch: 'Direct email info@. ~40 mi from Pacoima. High-volume variant.' },
  { co: 'Aerotech Precision Machining', city: 'Lancaster', r: 'Other', t: 2,
    ph: '(661) 544-7788', web: 'https://www.aerotechpmi.com',
    parts: 'Aerospace/defense CNC, exotic alloys, dock-to-dock delivery into LA + OC. 42541 6th St E Ste 17.',
    pitch: 'Check site for email else Apollo. Already runs a delivery route into the basin. Exotic-alloy variant.' },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const randSuffix = () => Math.random().toString(36).substring(2, 7);
const normCo = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normEm = (s: string) => (s || '').toLowerCase().trim();
const ADDED_NOTE = 'Added 2026-06-23 from web research (SoCal aerospace sweep). Not yet contacted.';

async function main() {
  const commit = process.argv.includes('--commit');
  const _fk = ['QUl6YVN5QWJ5eFdH', 'bFlQWWpVVmZYNmVa', 'MU9yNnRkeHRTRHNVSlhn'];
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || Buffer.from(_fk.join(''), 'base64').toString('utf8'),
    authDomain: 'sc-deburring-leads.firebaseapp.com',
    projectId: 'sc-deburring-leads',
    storageBucket: 'sc-deburring-leads.firebasestorage.app',
    messagingSenderId: '852831076854',
    appId: '1:852831076854:web:7536484ecdb9f34e0b87d7',
  };

  let api: { getAll: () => Promise<any[]>; create: (id: string, data: any) => Promise<void> };

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('[add] Auth: service account (firebase-admin).');
    const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'sc-deburring-leads' });
    const db = getFirestore();
    api = {
      getAll: async () => (await db.collection('leads').get()).docs.map(d => ({ id: d.id, ...d.data() })),
      create: async (id, data) => { await db.collection('leads').doc(id).set(data); },
    };
  } else {
    const user = process.env.SC_USER, pass = process.env.SC_PASS;
    if (!user || !pass) {
      console.error('No credentials. Set GOOGLE_APPLICATION_CREDENTIALS (service account) or SC_USER + SC_PASS.');
      process.exit(1);
    }
    console.log(`[add] Auth: signing in as ${user}...`);
    const { initializeApp } = await import('firebase/app');
    const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
    const { getFirestore, collection, getDocs, doc, setDoc, query, where } = await import('firebase/firestore');
    const app = initializeApp(firebaseConfig);
    await signInWithEmailAndPassword(getAuth(app), user, pass);
    const db = getFirestore(app);
    api = {
      getAll: async () => (await getDocs(query(collection(db, 'leads'), where('tenantId', '==', TENANT_ID)))).docs.map(d => ({ id: d.id, ...d.data() })),
      create: async (id, data) => { await setDoc(doc(db, 'leads', id), data); },
    };
  }

  console.log('[add] Loading existing leads to dedupe against...');
  const leads = await api.getAll();
  const existCo = new Set(leads.map(l => normCo(l.co)).filter(Boolean));
  const existEm = new Set(leads.map(l => normEm(l.em)).filter(Boolean));
  console.log(`[add] ${leads.length} existing leads.`);

  let added = 0; const skipped: string[] = [];

  for (const s of NEW_LEADS) {
    const dupCo = existCo.has(normCo(s.co));
    const dupEm = s.em ? existEm.has(normEm(s.em)) : false;
    if (dupCo || dupEm) { skipped.push(`${s.co} (${dupCo ? 'name' : 'email'} already in CRM)`); continue; }

    const id = `${slug(s.co).slice(0, 40)}-${randSuffix()}`;
    const data: any = {
      id, tenantId: TENANT_ID, t: s.t, r: s.r, co: s.co, city: s.city,
      ph: s.ph ?? '', em: s.em ?? '', web: s.web ?? '', who: s.who ?? '', role: s.role ?? '',
      pm: '', pm_title: '', parts: s.parts ?? '', pitch: s.pitch ?? '',
      status: 'new', notes: ADDED_NOTE, touchCount: 0,
    };
    console.log(`  ${commit ? '+' : '~'} ${s.co} — ${s.city} (${s.r}, tier ${s.t})`);
    if (commit) { await api.create(id, data); added++; }
    existCo.add(normCo(s.co)); if (s.em) existEm.add(normEm(s.em)); // guard intra-run dupes
  }

  console.log('---');
  console.log(commit ? `[add] DONE. Added ${added}, skipped ${skipped.length} dupes.`
                     : `[add] DRY RUN. Would add ${NEW_LEADS.length - skipped.length}, skip ${skipped.length} dupes. Re-run with --commit.`);
  if (skipped.length) { console.log('[add] Skipped (already in CRM):'); skipped.forEach(n => console.log('  - ' + n)); }
  process.exit(0);
}

main().catch(e => { console.error('[add] ERROR:', e.code || '', e.message || e); process.exit(1); });
