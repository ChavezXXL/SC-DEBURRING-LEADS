/** Growth push 2026-07-10 — add 16 net-new SoCal prospects from the
 * hiring-signal prospecting sweep (agent web-verified, cross-checked vs the
 * full CRM exclude list). Statuses = 'new'. NO drafts staged here — the
 * emailable ones go through the Gmail repeat-guard + draft step separately.
 * 3 are call/RFQ-only (no public email): Quality EDM, Moseys, TOMI. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const NEW_LEADS = [
  { co: 'Alva Manufacturing', city: 'Placentia', r: 'OC', em: 'rapidquote@alvamfg.com', ph: '',
    web: 'https://www.alvamanufacturing.com', t: 1,
    parts: '3-5 axis complex CNC machining, fab & assembly; space/aerospace/defense/medical; "critical spaceflight parts"; ~40 CNC machines, ~65 employees',
    fit: 'HOT', hiring: 'LIVE Precision Deburring/Finisher Technician req (mechanical deburr tools + small bead blaster) — Indeed/ZipRecruiter; also HR@alvamfg.com' },
  { co: 'Aero Mechanism Precision', city: 'Chatsworth', r: 'SFV', em: 'info@aeromechanism.com', ph: '',
    web: 'https://www.aeromechanism.com', t: 1,
    parts: 'CNC milling & turning of high-end aerospace & defense parts (much gov work); 15+ CNC machines; ISO9001/AS9100',
    fit: 'HOT', hiring: 'LIVE full-time Deburring Technician req (40 hrs + OT/weekends) — Indeed. 20 min from Pacoima.' },
  { co: 'U.S. Swiss', city: 'San Bernardino', r: 'IE', em: 'sales@usswiss.com', ph: '',
    web: 'https://www.swissmachining.com', t: 1,
    parts: 'Precision Swiss CNC micro-machining (7-axis): medical screws, dental implants, pins, standoffs; medical/dental/aero/military; ISO9001+ITAR',
    fit: 'GREAT', hiring: 'Tiny Swiss parts = microscope-deburr sweet spot. None found.' },
  { co: 'Precision One Medical', city: 'Oceanside', r: 'SD', em: 'info@precisiononemedical.com', ph: '',
    web: 'https://www.precisiononemedical.com', t: 1,
    parts: 'STAR Swiss-style CNC machining of dental-implant parts (tiny = microscope-scale finishing); 47,000 sq ft',
    fit: 'GREAT', hiring: 'None found.' },
  { co: 'KD Precision Machining', city: 'Corona', r: 'IE', em: 'info@kdprecision.com', ph: '',
    web: 'https://kdprecision.com', t: 1,
    parts: 'CNC turning, milling & 5-axis of close-tolerance hard-to-machine alloys; aerospace/defense; AS9100 Rev D',
    fit: 'GREAT', hiring: 'None found.' },
  { co: 'O&S Precision', city: 'Chatsworth', r: 'SFV', em: 'info@oands.com', ph: '',
    web: 'https://oands.com', t: 1,
    parts: 'Full-service precision CNC machining; military aerospace, commercial aerospace & medical devices; 35+ yrs',
    fit: 'GREAT', hiring: 'None found. 20 min from Pacoima — pickup easy.' },
  { co: 'Industrial Tool & Die', city: 'Santa Ana', r: 'OC', em: 'info@itdinc.us', ph: '',
    web: 'https://www.itdinc.us', t: 2,
    parts: 'Wire & sinker EDM, custom molds/inserts, trim dies, CNC machining & grinding; aerospace/medical/electrical-connector',
    fit: 'GOOD', hiring: 'None found.' },
  { co: 'Means Engineering', city: 'Carlsbad', r: 'SD', em: 'info@meanseng.com', ph: '',
    web: 'https://meanseng.com', t: 2,
    parts: 'Precision CNC machining + welding + cleanroom assembly; medical, semiconductor equipment, industrial & military',
    fit: 'GOOD', hiring: 'Active careers page (no specific finishing req confirmed).' },
  { co: 'Veridiam', city: 'El Cajon', r: 'SD', em: 'sales@veridiam.com', ph: '',
    web: 'https://www.veridiam.com', t: 2,
    parts: 'Precision fabrication of exotic metals (titanium, nickel superalloys, specialty stainless); aerospace/defense/medical/nuclear/space; also Oceanside plant',
    fit: 'GOOD', hiring: 'Active careers page (no specific finishing req confirmed). Larger fabricator.' },
  { co: 'Turret Lathe Specialists', city: 'Anaheim', r: 'OC', em: 'quotes@turretlathe.com', ph: '',
    web: 'https://www.turretlathe.com', t: 2,
    parts: 'CNC turning/milling/grinding of shafts, housings, impellers (SS, Ti, Inconel, Monel); aerospace/defense/cryogenic/energy',
    fit: 'GOOD', hiring: 'None found.' },
  { co: 'Infinity Precision (IPI)', city: 'Simi Valley', r: 'Ventura', em: 'sales@ipinc-usa.com', ph: '',
    web: 'https://www.infinityprecision-inc.com', t: 2,
    parts: 'CNC milling & turning, honing, hydroforming/metal forming; aerospace; woman-owned, AS9100',
    fit: 'GOOD', hiring: 'None found. 25 min from Pacoima.' },
  { co: 'Darmark Corporation', city: 'Poway', r: 'SD', em: 'thomas@darmark.com', ph: '',
    web: 'https://darmark.com', t: 2,
    parts: '3-5 axis CNC milling, turning & screw machining of high-temp alloys + turnkey assemblies; aerospace/medical/semiconductor/power-gen; AS9100D',
    fit: 'GOOD', hiring: 'None found. NOTE: published inbox is owner (Thomas) — person-name inbox, softer opener.' },
  { co: 'Vanacore Engineering', city: 'Chatsworth', r: 'SFV', em: 'vanacoreeng@yahoo.com', ph: '',
    web: 'https://vanacorecnc.com', t: 2,
    parts: 'CNC machine shop; aerospace, defense, automotive & medical',
    fit: 'GOOD', hiring: 'None found. Inbox is a Yahoo business address. 20 min from Pacoima.' },
  { co: 'Quality EDM', city: 'Anaheim', r: 'OC', em: '', ph: '(714) 283-9220',
    web: 'https://qualityedm.com', t: 2,
    parts: 'Wire, sinker & fast-hole EDM; aerospace/missile, medical/dental, satellite/antenna, military; NADCAP + AS9100D',
    fit: 'GOOD', hiring: 'None found. CALL-ONLY — no public email (only on-page email was their web dev). Use RFQ form + phone.' },
  { co: 'Moseys Production Machinists', city: 'Anaheim', r: 'OC', em: '', ph: '(562) 556-5633',
    web: 'https://moseys.com', t: 2,
    parts: 'Assembly-ready precision CNC parts 0.050"-24" (Al, SS, Ti, Inconel); aerospace/medical/defense; AS9100D, NADCAP, ITAR',
    fit: 'GOOD', hiring: 'Active careers page. CALL-ONLY — contact form + phone, no public email.' },
  { co: 'TOMI Engineering', city: 'Santa Ana', r: 'OC', em: '', ph: '(714) 556-1474',
    web: 'https://tomiengineering.com', t: 2,
    parts: 'Precision machining of airframe components, valve/actuator housings, wing fittings, brackets (Al, Ti, SS, Inconel); aerospace/defense; AS9100/ITAR',
    fit: 'GOOD', hiring: 'None found. CALL-ONLY — contact form + phone, no public email.' },
];

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();

  // dedup base: all existing sc-deburring co names, normalized
  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const existing = new Set<string>();
  snap.forEach((d) => { const c = norm((d.data() as any).co); if (c.length > 3) existing.add(c); });

  let added = 0;
  for (const L of NEW_LEADS) {
    const n = norm(L.co);
    // guard: exact or containment match against any existing co
    let dupe = existing.has(n);
    if (!dupe) for (const e of existing) { if (e.length > 4 && n.length > 4 && (e.startsWith(n) || n.startsWith(e))) { dupe = true; break; } }
    if (dupe) { console.log('SKIP (already in CRM):', L.co); continue; }

    const id = n + '-' + L.co.length.toString(36) + n.slice(0, 3);
    const notes =
      `[2026-07-10] Added — net-new hiring-signal sweep (agent web-verified). FIT: ${L.fit}.` +
      `\n  Makes: ${L.parts}` +
      `\n  Hiring/notes: ${L.hiring}` +
      (L.em ? '' : '\n  CALL-ONLY — no public email; use RFQ form + phone.');
    await db.collection('leads').doc(id).set({
      id, tenantId: 'sc-deburring', status: 'new', notes,
      t: L.t, r: L.r, co: L.co, city: L.city, ph: L.ph, em: L.em, web: L.web,
      who: '', role: '', pm: '', pm_title: '', parts: L.parts.slice(0, 180), pitch: '', touchCount: 0,
    });
    existing.add(n);
    console.log(`ADDED [${L.fit}] t${L.t}:`, L.co, L.em ? `(${L.em})` : '(CALL-ONLY)');
    added++;
  }
  console.log(`\nDone — ${added} new leads added, ${NEW_LEADS.length - added} skipped as dupes.`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
