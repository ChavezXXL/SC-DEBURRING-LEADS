/**
 * Add the 13 high-quality "Triumph-tier" targets (2026-06-30 hunt) to the SC LEADS CRM.
 * Dedupes by normalized company name + email vs the live tenant. Status "new".
 * Auth: serviceAccount.json. Dry-run by default; pass --commit to write.
 *   cd "C:\Users\scpre\SC LEADS PP" && npx tsx scripts/add-targets-0630.ts [--commit]
 */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const TENANT_ID = 'sc-deburring';
const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;

interface NL { co: string; city: string; r: string; t: 1 | 2; web?: string; parts?: string; pitch?: string; notes: string; }
const N = 'Added 2026-06-30 from high-quality target hunt (Triumph-tier). Not yet contacted — pull buyer/quality/ops contact via LinkedIn/Apollo or site form.';
const NEW: NL[] = [
  { co: 'PneuDraulics', city: 'Rancho Cucamonga', r: 'Inland Empire', t: 1, web: 'https://pneudraulics.com', parts: 'Aerospace hydraulic manifolds, solenoid/relief valves, actuators, reservoirs (5000 psi). 8575 Helms Ave 91730.', pitch: 'Top deburr fit: dense cross-drilled manifold blocks. Pull SQE/supply-chain.', notes: N },
  { co: 'CIRCOR Aerospace', city: 'Corona', r: 'Inland Empire', t: 1, web: 'https://aerospace.circor.com', parts: 'Fluid control + landing gear: manifolds, cross-drilled valve bodies, regulators. AS9100, 95k sq ft.', pitch: 'High part-count cross-drilled bodies in stainless/Ti/Inconel.', notes: N },
  { co: 'Woodward HRT', city: 'Santa Clarita', r: 'Santa Clarita / Valencia', t: 1, web: 'https://woodward.com', parts: 'Electro-hydraulic servovalves, pressure/flow control valves. 25200 W Rye Canyon Rd 91355.', pitch: 'Servovalve micro-bores = mandatory microscope deburr = SC niche. SC already runs Santa Clarita.', notes: N },
  { co: 'B&E Manufacturing', city: 'Garden Grove', r: 'Orange County', t: 1, web: 'https://bandemfg.com', parts: 'Precision AN/AS/MS/NAS hydraulic tube fittings (flared/flareless). LISI Aerospace. AS9100/ISO.', pitch: 'Pure PAMCO-profile fitting house — exactly SC\'s best current client type.', notes: N },
  { co: 'Permaswage', city: 'Gardena', r: 'Gardena / South Bay', t: 1, web: 'https://permaswage.com', parts: 'AN/AS/MS/NAS + specialty fittings, unions, swage connectors. PCC Fasteners. 14800 S Figueroa St 90247.', pitch: 'High-volume fittings/unions, burr-heavy bores/seats. PCC volume.', notes: N },
  { co: 'California Precision Hydraulics', city: 'Agoura Hills', r: 'Other', t: 1, web: 'https://cphyd.com', parts: 'Pistons, hydraulic pump/motor parts, valve bodies for CSD/IDG. FAA/EASA repair station. 5330 Derry Ave.', pitch: 'Closest fluid-power target to Pacoima (down the 101). Cross-bore exotic-alloy work.', notes: N },
  { co: 'NMG Aerospace', city: 'Orange County', r: 'Orange County', t: 1, web: 'https://nmgaerospace.com', parts: 'Hydraulic valves from check valves to complex manifolds; design/test/qualify.', pitch: 'Dedicated valve/manifold house = dense cross-drilling.', notes: N },
  { co: 'RPI Rapid Precision', city: 'Orange County', r: 'Orange County', t: 1, parts: '37-yr OC shop, 24/7 lights-out 5-axis on Inconel/Ti/Hastelloy/stainless.', pitch: 'High-volume exotic-alloy = constant deburr/edge-break. Verify exact entity.', notes: N },
  { co: 'Whippany Actuation Systems', city: 'Southern California', r: 'Other', t: 2, web: 'https://whipactsys.com', parts: 'Electromechanical/hydromechanical actuation components & actuators (75+ yrs).', pitch: 'Actuator bodies/pistons w/ intersecting ports. CONFIRM CA facility before routing.', notes: N },
  { co: 'Aerospace Manufacturing Inc', city: 'Valencia', r: 'Santa Clarita / Valencia', t: 2, web: 'https://aerospacemfg.net', parts: 'Welded + machined aircraft components for Boeing, Lockheed, L3Harris (est. 2002).', pitch: 'Volume welded/machined parts; inside SC\'s Santa Clarita loop.', notes: N },
  { co: 'Inland Machine Company', city: 'Rancho Cucamonga', r: 'Inland Empire', t: 2, web: 'https://inlandmachinecompany.com', parts: 'CNC precision machining, military + commercial aerospace, AS9100-compliant. 10762 Edison Court 91730.', pitch: 'IE route density with PneuDraulics + CIRCOR.', notes: N },
  { co: 'Aero Chip Inc', city: 'Santa Fe Springs', r: 'Other', t: 2, parts: 'CNC machining + assembly for aerospace (est. 1986); Boeing, Northrop.', pitch: 'Assembly + complex CNC = deburr before fit-up.', notes: N },
  { co: 'Alloy Valves and Controls', city: 'Santa Ana', r: 'Orange County', t: 2, parts: 'Valves / valve bodies, flow-control. 3210 S Susan St 92704.', pitch: 'Valve bodies = highest-burr feature set. Confirm aerospace vs industrial mix.', notes: N },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const rand = () => Math.random().toString(36).substring(2, 7);
const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function main() {
  const commit = process.argv.includes('--commit');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const leads = (await db.collection('leads').get()).docs.map(d => (d.data() as any));
  const existCo = new Set(leads.map(l => norm(l.co)).filter(Boolean));
  let added = 0; const skipped: string[] = [];
  for (const s of NEW) {
    const n = norm(s.co);
    if ([...existCo].some(e => e === n || e.includes(n) || n.includes(e))) { skipped.push(s.co); continue; }
    const id = `${slug(s.co).slice(0, 40)}-${rand()}`;
    const data: any = { id, tenantId: TENANT_ID, t: s.t, r: s.r, co: s.co, city: s.city, ph: '', em: '', web: s.web ?? '', who: '', role: '', pm: '', pm_title: '', parts: s.parts ?? '', pitch: s.pitch ?? '', status: 'new', notes: s.notes, touchCount: 0 };
    console.log(`  ${commit ? '+' : '~'} ${s.co} — ${s.city} (tier ${s.t})`);
    if (commit) { await db.collection('leads').doc(id).set(data); added++; }
    existCo.add(n);
  }
  console.log('---');
  console.log(commit ? `[add] DONE. Added ${added}, skipped ${skipped.length} dupes.` : `[add] DRY RUN. Would add ${NEW.length - skipped.length}, skip ${skipped.length}. Re-run with --commit.`);
  if (skipped.length) console.log('skipped:', skipped.join(', '));
  process.exit(0);
}
main().catch(e => { console.error('ERROR:', e.code || '', e.message || e); process.exit(1); });
