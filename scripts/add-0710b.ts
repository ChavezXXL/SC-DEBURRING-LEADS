/** Growth push 2026-07-10 (wave B) — 17 net-new from the untapped-ground sweep
 * (Antelope Valley, SCV, SGV, OC + hiring signals + adjacent finisher).
 * Idempotent dedup. Statuses = 'new'. Emailable ones go through the repeat-guard
 * + draft step separately. 9 are call/RFQ-only. 2 hot (call-only) hiring deburrers. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const NEW_LEADS = [
  { co: 'Aero Bending Company', city: 'Palmdale', r: 'AV', em: '', ph: '',
    web: 'https://aerobending.com', t: 1, fit: 'HOT',
    parts: 'Precision tube bending, sheet-metal fab & CNC machining for aerospace primes; welding/brazing/waterjet',
    hiring: 'LIVE Production Technician req explicitly naming manual & machine-assisted / CNC deburring (Indeed/ZipRecruiter 2026). CALL/RFQ-only — no public email.' },
  { co: 'Johnny\'s Machine & Tools (JMT Inc.)', city: 'Norwalk', r: 'LA', em: '', ph: '',
    web: 'https://jmtinc.com', t: 1, fit: 'HOT',
    parts: 'AS9100D/ITAR 5-axis precision machining for aerospace & defense incl. aerospace GEARS; 17 CNC machines',
    hiring: 'OPEN "Deburr Bench" req — hand-deburring aerospace gears with electric/pneumatic tools (Glassdoor/Indeed 2026). CALL/RFQ-only — /contact 403s, no public email.' },
  { co: 'Crown Precision', city: 'Irwindale', r: 'SGV', em: 'crownsales@crownprecision.com', ph: '',
    web: 'https://crownprecision.com', t: 2, fit: 'GOOD',
    parts: 'High-precision CNC turning/milling/grinding & assemblies; steel/aluminum/Ti/bronze/aircraft alloys; built-to-print aerospace', hiring: 'None found.' },
  { co: 'Vinaco Precision Machining', city: 'Chatsworth', r: 'SFV', em: 'quote@vinacoprecision.com', ph: '',
    web: 'https://vinacoprecision.com', t: 2, fit: 'GOOD',
    parts: 'Low/high-volume close-tolerance CNC machining; aerospace/defense/telecom/energy/commercial', hiring: 'None found. 20 min from Pacoima.' },
  { co: 'JAH Machine', city: 'Brea', r: 'OC', em: 'sales@jahmachine.com', ph: '',
    web: 'https://jahmachine.com', t: 2, fit: 'GOOD',
    parts: 'AS9100D/ITAR complete-fabrication CNC shop; 3/4/5-axis machining, grinding, welding, tooling; aerospace/nuclear/defense', hiring: 'None found.' },
  { co: 'Ram Aerospace', city: 'Brea', r: 'OC', em: 'info@ramaerospace.com', ph: '',
    web: 'https://ramaerospace.com', t: 2, fit: 'GOOD',
    parts: 'AS9100D/ISO9001 precision CNC machining & contract mfg; milling/turning/5-axis/subassembly; aerospace/defense/medical/oil&gas', hiring: 'None found.' },
  { co: 'M.A. Machining Aerospace', city: 'Santa Ana', r: 'OC', em: 'contact@maaerospace.com', ph: '',
    web: 'https://maaerospace.com', t: 2, fit: 'GOOD',
    parts: 'In-house CNC machining (mills/lathes/4-axis) of aerospace flight hardware & fixtures, medical surgical components', hiring: 'None found.' },
  { co: 'My Machine Inc', city: 'Baldwin Park', r: 'SGV', em: 'info@mymachineinc.com', ph: '',
    web: 'https://mymachineinc.com', t: 2, fit: 'GOOD',
    parts: 'AS9100D/ISO9001 precision aerospace CNC machining, inspection, assembly; supplies Boeing/Lockheed/SpaceX', hiring: 'None found.' },
  { co: 'Radical Fabrications', city: 'Lancaster', r: 'AV', em: 'rodolfo@radfabmachining.com', ph: '',
    web: 'https://radfabmachining.com', t: 2, fit: 'GOOD',
    parts: 'CNC milling/turning, welding & custom fab; aerospace tooling, fixtures, prototypes to production', hiring: 'None found. Owner-name inbox (Rodolfo).' },
  { co: 'JVC Precision', city: 'Santa Ana', r: 'OC', em: 'Juan@jvcnc.com', ph: '',
    web: 'https://jvcnc.com', t: 2, fit: 'GOOD',
    parts: 'CNC milling/turning/finishing incl. titanium for aerospace; engineering & prototyping', hiring: 'None found. Owner-name inbox (Juan).' },
  { co: 'Aerotech Precision Machining', city: 'Lancaster', r: 'AV', em: '', ph: '',
    web: 'https://aerotechpmi.com', t: 2, fit: 'GOOD',
    parts: 'Precision machining of metal & composite components on multi-axis lathes/mills; aerospace/medical/military; dock-to-dock delivery to LA/OC', hiring: 'None found. CALL/RFQ-only.' },
  { co: 'EM Aerospace', city: 'Lancaster', r: 'AV', em: '', ph: '(661) 206-7388',
    web: 'https://emaerospace.net', t: 2, fit: 'GOOD',
    parts: 'Precision-machined aerospace bushings, spacers, standoffs to NAS/military/OEM specs (small parts)', hiring: 'None found. CALL-only, ph (661) 206-7388.' },
  { co: 'Paragon Precision', city: 'Valencia', r: 'SCV', em: '', ph: '',
    web: 'https://paragon-precision.com', t: 2, fit: 'GOOD',
    parts: '4/5-axis machining of complex turbomachinery components; milling/turning/grinding/EDM/CMM; AS9100D, ITAR', hiring: 'None found. CALL/RFQ-only.' },
  { co: 'Advanced Techno Cut', city: 'Valencia', r: 'SCV', em: '', ph: '',
    web: 'https://atc-cnc.com', t: 2, fit: 'GOOD',
    parts: '5-axis CNC machining of Ti/aluminum/Inconel/steel; molds, fixtures, prototypes; supplies SpaceX/Boeing/Lockheed/NASA JPL', hiring: 'None found. CALL/RFQ-only.' },
  { co: 'Price Manufacturing', city: 'Riverside', r: 'IE', em: '', ph: '(951) 371-5660',
    web: 'https://pricemfg.com', t: 2, fit: 'GOOD',
    parts: 'Precision CNC & screw machining, custom aluminum parts to .0001-.0005in; aerospace/medical/automotive (tiny parts)', hiring: 'None found. CALL-only, ph (951) 371-5660.' },
  { co: 'Align Precision', city: 'City of Industry', r: 'SGV', em: '', ph: '(714) 961-9200',
    web: 'https://alignprecision.com', t: 2, fit: 'GOOD',
    parts: 'Complex large structural aerospace/defense parts & assemblies (fighter/commercial aircraft, rotorcraft, space); Ti/steel/Inconel/aluminum', hiring: 'None found. CALL-only, ph (714) 961-9200.' },
  { co: 'Barry Avenue Plating', city: 'Los Angeles', r: 'LA', em: '', ph: '(310) 478-0078',
    web: 'https://barryavenueplating.com', t: 2, fit: 'ADJACENT',
    parts: 'NADCAP/AS9100 aerospace metal finishing & plating (anodize/cad/chrome/electroless nickel/zinc)',
    hiring: 'ADJACENT ANGLE — receives machined parts that must be deburred BEFORE plating; could refer or subcontract. CALL-only, ph (310) 478-0078.' },
];

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const existing = new Set<string>();
  snap.forEach((d) => { const c = norm((d.data() as any).co); if (c.length > 3) existing.add(c); });

  let added = 0;
  for (const L of NEW_LEADS) {
    const n = norm(L.co);
    let dupe = existing.has(n);
    if (!dupe) for (const e of existing) { if (e.length > 5 && n.length > 5 && (e.startsWith(n.slice(0, 10)) || n.startsWith(e.slice(0, 10)))) { dupe = true; break; } }
    if (dupe) { console.log('SKIP (already in CRM):', L.co); continue; }
    const id = n.slice(0, 24) + '-' + L.co.length.toString(36) + n.slice(-3);
    const notes =
      `[2026-07-10] Added — untapped-ground sweep (agent web-verified). FIT: ${L.fit}.` +
      `\n  Makes: ${L.parts}` +
      `\n  Hiring/notes: ${L.hiring}` +
      (L.em ? '' : '\n  CALL/RFQ-ONLY — no public email.');
    await db.collection('leads').doc(id).set({
      id, tenantId: 'sc-deburring', status: 'new', notes,
      t: L.t, r: L.r, co: L.co, city: L.city, ph: L.ph, em: L.em, web: L.web,
      who: '', role: '', pm: '', pm_title: '', parts: L.parts.slice(0, 180), pitch: '', touchCount: 0,
    });
    existing.add(n);
    console.log(`ADDED [${L.fit}] t${L.t}:`, L.co, L.em ? `(${L.em})` : '(CALL-ONLY)');
    added++;
  }
  console.log(`\nDone — ${added} added, ${NEW_LEADS.length - added} skipped.`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
