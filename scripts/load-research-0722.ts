/** Load verified 2026-07-22 research into the CRM:
 *  - live deburr-hiring shops -> new tier-1 leads (or a fresh note if they exist)
 *  - existing clients -> a specific expansion ask
 *  - warm leads -> a concrete reconnect ask
 * Dry-run by default; --commit to write. Never changes status or contacts. */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const TENANT = 'sc-deburring';
const TODAY = '2026-07-22';

type Row = { co: string; city: string; region: string; signal: string; ask: string };

const HIRING: Row[] = [
  { co: 'Axis Precision Prototyping', city: 'Santa Ana', region: 'Orange County', signal: 'HIRING Deburr Technician $19-22/hr (posted this week)', ask: 'Send one lot this week — we deburr it free so you see turnaround before committing.' },
  { co: 'Allied Mechanical', city: 'Ontario', region: 'Inland Empire', signal: 'HIRING Deburr on BOTH 1st and 2nd shift $19-24/hr', ask: 'Absorb the swing-shift overflow so they only hire one shift instead of two.' },
  { co: 'Advanced Metal Mfg', city: 'Simi Valley', region: 'Simi Valley', signal: 'HIRING Grinder/Deburr Operator (precision sheet metal) $18-20/hr', ask: 'Same-day pickup and drop-off on finishing while the seat stays empty.' },
  { co: 'Johnson Manufacturing', city: 'Huntington Beach', region: 'Orange County', signal: 'HIRING Entry Level Deburr Operator $17-25/hr with paid training', ask: 'We cover the work today at a known rate instead of paying a training ramp.' },
  { co: 'Neill Aircraft Company', city: 'Long Beach', region: 'Long Beach / Paramount', signal: 'HIRING Deburr Technician $18.50-22/hr, aerospace components', ask: 'Free first lot to prove finish quality before they fill the seat.' },
  { co: 'RTC Aerospace', city: 'Chatsworth', region: 'San Fernando Valley', signal: 'HIRING Deburr Technician SWING shift $20-24/hr + $2 differential', ask: 'Take the swing-shift overflow — ten minutes down the 118 from Pacoima.' },
  { co: 'Senior Aerospace Spencer', city: 'Valencia', region: 'Santa Clarita / Valencia', signal: 'HIRING Deburr Technician from $18/hr, parts off their mills and lathes', ask: 'Catch the mill/lathe output the bench cannot keep up with, starting with one lot.' },
  { co: 'ACROMIL', city: 'Corona', region: 'Inland Empire', signal: 'HIRING Bench Deburr Machinist $22-25/hr', ask: 'Free trial lot with a firm return date so they can test us against a deadline.' },
  { co: 'Premier Gear & Machining', city: 'Corona', region: 'Inland Empire', signal: 'HIRING Deburring (aerospace gears) — available immediately', ask: 'Take gear deburring off the floor this week so nothing ships late while they hire.' },
  { co: 'Sonfarrel Aerospace', city: 'Anaheim', region: 'Orange County', signal: 'HIRING Deflash & Deburr $18-19/hr', ask: 'Per-part quote on deflash/deburr so they stop competing for scarce bench labor.' },
  { co: 'CAMTECH', city: 'Irvine', region: 'Orange County', signal: 'HIRING part-time Deburr/Bench Tech — MICROSCOPE work', ask: 'Microscope deburring on demand instead of a part-time hire they must keep busy.' },
];

// Already in the CRM — just add the fresh signal.
const HIRING_EXISTING: Row[] = [
  { co: 'Crissair', city: 'Valencia', region: '', signal: 'HIRING Deburring Technician $18-24/hr, blueprint deburr of precision aero parts', ask: 'Ask for one blueprint-driven lot as a trial to show they can outsource the fussy work.' },
  { co: 'Votaw Precision Technologies', city: 'Santa Fe Springs', region: '', signal: 'HIRING Bench/Deburr $20-30/hr, hand-finishing aerospace components', ask: 'Fixed per-part price that beats a $30/hr bench seat plus burden.' },
];

const CLIENTS: Row[] = [
  { co: 'W Machine Works', city: '', region: '', signal: 'Makes manifolds, valve bodies, housings in Ti/high-temp for F-35, Apache, 737 MAX', ask: 'Send the manifolds and valve bodies — cross-hole and internal-passage deburr is our specialty.' },
  { co: 'Delta Hi-Tech', city: '', region: '', signal: 'Delta MEDICAL is a separate 38,000 sqft division, 37 Swiss CNCs, ISO 13485', ask: 'Put us on the Delta Medical Swiss parts — we deburr and inspect under a microscope.' },
  { co: 'S&H Machine', city: '', region: '', signal: 'Runs TWO campuses — Burbank HQ and a second plant in South El Monte', ask: 'Who handles bench work at the South El Monte building — can we pick it up like Burbank?' },
  { co: 'Coronado Manufacturing', city: '', region: '', signal: 'Lists Deburring & Finishing as an IN-HOUSE capability (so the bench is theirs to bottleneck)', ask: 'When your deburr bench is the bottleneck, overflow to us same-week instead of parts sitting.' },
  { co: 'H&H Machining Center', city: '', region: '', signal: 'Also runs medical implants/surgical instruments under ISO 13485 in a 10,000 sqft shop', ask: 'Route medical implant and instrument finishing to us — no floor space needed for a bench cell.' },
  { co: 'Alziebler', city: '', region: '', signal: 'Added a Puma 2600SY II turning center Dec 2023; NO deburring listed anywhere on their site', ask: 'Let us take the bench work off the Puma so turned parts do not back up behind the hog-outs.' },
  { co: 'American Precision Tool', city: '', region: '', signal: 'Softgel dies/wedges for pharma + Swiss machining; only "light parts finishing" in-house', ask: 'Beyond aerospace, let us take the edge work on softgel die and Swiss parts.' },
  { co: 'Alpha Machinery', city: '', region: '', signal: 'Services list SHEET METAL and airframe components alongside CNC milling', ask: 'Send the edge break and hole deburr on sheet metal/airframe details, not just milled parts.' },
];

const WARM: Row[] = [
  { co: 'Force Fabrication', city: '', region: '', signal: 'Apr 18 2026: added a 6000W fiber laser to grow sheet-metal cutting capacity (CEO Justin Gamble quoted)', ask: 'Congrats on the 6000W laser — can we take deburr/edge break on the laser-cut overflow so cutting capacity is not waiting on the bench?' },
  { co: 'Pacific Sky Supply', city: '', region: '', signal: 'Mar 2026: USAF approved 3 more part numbers, completing their T56 2nd-stage vane suite', ask: 'Saw the March approvals filled out your vane suite — want us carrying hand/microscope deburr on that run?' },
  { co: 'Triumph Actuation', city: '', region: '', signal: 'Valencia site has TWO open Machinist reqs at $22-34/hr right now', ask: 'You are adding machinists — can we take deburr/finishing on the actuator parts coming off them instead of hiring bench?' },
  { co: 'Bandy Manufacturing', city: '', region: '', signal: 'Acquired by Novaria Group Jan 2025, still Burbank under president Roger Seaman', ask: 'Now inside Novaria and pushing volume — can we take deburr on a lot of hinge/pin work so throughput is not capped by the bench?' },
  { co: 'ESM Aerospace', city: '', region: '', signal: 'Capabilities list sheet metal, CNC, EDM, brazing — NO deburring/finishing listed at all', ask: 'You do not list deburring anywhere — can we run a free sample lot so you can quote finishing on your next job?' },
];

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(inc|llc|corp|corporation|co|company|ltd)\b/g, '').trim();

async function main() {
  const commit = process.argv.includes('--commit');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', TENANT).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  // Guard short/empty names: a doc with a blank `co` normalises to '' and would
  // match EVERY company via startsWith(''), silently swallowing writes.
  const findLead = (co: string) => {
    const n = norm(co);
    if (n.length < 4) return undefined;
    return all.find((l) => {
      const ln = norm(l.co);
      if (ln.length < 4) return false;
      return ln === n || ln.startsWith(n) || n.startsWith(ln);
    });
  };

  console.log(`MODE: ${commit ? 'COMMIT' : 'DRY-RUN'}\n`);
  let created = 0, noted = 0, skipped = 0;

  const appendNote = async (lead: any, tag: string, r: Row) => {
    const line = `[${TODAY}] ${tag} — ${r.signal}. ASK: ${r.ask}`;
    if ((lead.notes || '').includes(r.signal.slice(0, 40))) { skipped++; return; }
    const notes = lead.notes ? `${lead.notes}\n${line}` : line;
    console.log(`  NOTE  ${lead.co}: ${tag}`);
    noted++;
    if (commit) await db.collection('leads').doc(lead.id).set({ notes }, { merge: true });
  };

  console.log('--- HIRING SIGNALS (new leads) ---');
  for (const r of HIRING) {
    const existing = findLead(r.co);
    if (existing) { await appendNote(existing, 'HIRING SIGNAL', r); continue; }
    const id = norm(r.co).replace(/\s+/g, '-') + '-' + Math.random().toString(36).slice(2, 7);
    const lead = {
      id, tenantId: TENANT, status: 'new', t: 1, r: r.region || 'Other',
      co: r.co, city: r.city, ph: '', em: '', web: '', who: '', role: '', pm: '', pm_title: '',
      parts: '', pitch: 'Overflow deburring so they do not have to hire bench staff',
      notes: `[${TODAY}] HIRING SIGNAL (verified) — ${r.signal}. ASK: ${r.ask} NOTE: phone/contact still to look up.`,
    };
    console.log(`  NEW   ${r.co} (${r.city})`);
    created++;
    if (commit) await db.collection('leads').doc(id).set(lead);
  }

  console.log('\n--- HIRING SIGNALS (already in CRM) ---');
  for (const r of HIRING_EXISTING) {
    const lead = findLead(r.co);
    if (lead) await appendNote(lead, 'HIRING SIGNAL', r);
    else console.log(`  ?? not found: ${r.co}`);
  }

  console.log('\n--- CLIENT EXPANSION ASKS ---');
  for (const r of CLIENTS) {
    const lead = findLead(r.co);
    if (lead) await appendNote(lead, 'EXPANSION', r);
    else console.log(`  ?? not found: ${r.co}`);
  }

  console.log('\n--- WARM RECONNECT AMMO ---');
  for (const r of WARM) {
    const lead = findLead(r.co);
    if (lead) await appendNote(lead, 'RECONNECT', r);
    else console.log(`  ?? not found: ${r.co}`);
  }

  console.log(`\n${commit ? 'Wrote' : 'Would write'}: ${created} new leads, ${noted} notes added, ${skipped} already present.`);
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.message || e); process.exit(1); });
