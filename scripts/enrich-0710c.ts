/** 2026-07-10 dossier enrich — verified phones + decision-makers for the 6 anchor
 * targets (web-verified by research agent: their sites, job boards, LinkedIn/ZoomInfo).
 * Match by exact co name (as stored). Adds ph/who if missing; appends dossier note. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const D = [
  { co: 'Alva Manufacturing', ph: '(714) 237-0925', who: 'Joaquin Perez — Operations Mgr',
    note: '[2026-07-10] DOSSIER: decision-makers Tam Nguyen (President, tam.nguyen@alvamfg.com), Joaquin Perez (Ops — owns deburr bench, joaquin.perez@alvamfg.com), David Clark (BizDev). Ph (714) 237-0925. Runs 7am-11:30pm + weekends; live Precision Deburrer req on own site ($17-22/hr → price-frame as overflow relief). Boeing/Lockheed/Northrop/Raytheon parts; rebranding to Alva Precision Technologies. ANGLE: speed-for-speed, first lot free 48hr, ask for Joaquin. Ranked #1 anchor target.' },
  { co: 'Aero Mechanism Precision', ph: '', who: '',
    note: '' }, // placeholder skip
  { co: 'Johnny\'s Machine & Tools (JMT Inc.)', ph: '(562) 404-2014', who: 'Shop manager/owner (family-run, unpublished)',
    note: '[2026-07-10] DOSSIER: ph (562) 404-2014 (site-verified). 14926 Bloomfield Ave, Norwalk. Family-run since 1979, AS9100 (site cert), 17 CNCs, 2 CMMs. Aerospace GEARS + landing-gear parts in Ti/Inconel/Waspaloy. Live "Deburr Bench" req on own careers page + 2nd-shift lead machinist. ANGLE: "gear teeth are the worst edges in the business — microscope work is all we do." Easiest close; modest ceiling. Ranked #5.' },
  { co: 'Aero Bending Company', ph: '(661) 948-2363', who: 'Robert Burns — President & Owner',
    note: '[2026-07-10] DOSSIER: Robert Burns President/Owner (LinkedIn-verified). Ph (661) 948-2363. 560 Auto Center Dr, Palmdale. Since 1944, AS9100D + NADCAP; NEW approval on Lockheed/Northrop programs = ramping (5 open jobs incl. CNC Deburr & Polish tech). CAUTION: weakest fit of the six — tube/sheet parts, likely in-house finishing dept. One test lot before investing more. Ranked #6.' },
];

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  for (const j of D) {
    if (!j.note) continue;
    const q = await db.collection('leads').where('tenantId', '==', 'sc-deburring').where('co', '==', j.co).get();
    if (q.empty) { console.log('NOT FOUND:', j.co); continue; }
    for (const d of q.docs) {
      const x = d.data() as any;
      if ((x.notes || '').includes('[2026-07-10] DOSSIER:')) { console.log('already:', j.co); continue; }
      const fields: any = { notes: (x.notes ? x.notes + '\n' : '') + j.note };
      if (j.ph && !x.ph) fields.ph = j.ph;
      if (j.who && !x.who) fields.who = j.who.slice(0, 80);
      await d.ref.set(fields, { merge: true });
      console.log('enriched:', j.co, j.ph || '');
    }
  }

  // GlenDee/MGI, RTCA, Moseys — names vary in CRM; match by prefix
  const extra = [
    { pre: 'GlenDee', ph: '(805) 523-2422', who: 'Richard McAlevey — GM',
      note: '[2026-07-10] DOSSIER: Glenn D. Grossman (President/Owner), Richard McAlevey (GM — ask for him), Kevin Rall (Dir Procurement). Ph (805) 523-2422, info@mgius.com. AS9100, veteran-owned since 1975, ~57 people, Raytheon/Boeing/BAE/Northrop customers. Live deburr req BOTH shifts $19-23.50 "willing to train" = can\'t hire. CAUTION: pain is in SHEET METAL dept — confirm part type on the call. Ranked #3.' },
    { pre: 'RTCA', ph: '(818) 407-0291', who: 'Jason Keck — GM Chatsworth',
      note: '[2026-07-10] DOSSIER: Jason Keck GM Chatsworth (818) 407-0291 (their own contact page; sales@ bounces — PHONE ONLY; ap-ca@rtcaerospace.com works for docs). 5 plants, 150+ CNCs, AS9100D; Simi site = Swiss turning (ex-Vanderhorst) = microscope-size parts. Deburr Tech (All Levels) LIVE at BOTH sites $20-23. CAUTION: Simi markets in-house finishing; expect ASL/vendor-approval friction — fire the vendor packet fast. Ranked #2.' },
    { pre: 'Moseys', ph: '(562) 556-5633', who: 'Russell Collins — Plant Mgr',
      note: '[2026-07-10] DOSSIER: Bob Mosey (Owner), Russell Collins (Plant Mgr — best first conversation), Israel Cureño (Procurement — writes POs). Main (562) 556-5633, support (714) 693-4840 (both site-verified). 3 shifts + lights-out, 21 spindles, 99.8% on-time published, 5-yr plan to double revenue. No live deburr req BUT their site lists deburring among managed OUTSIDE PROCESSES — they already buy it. Closest PAMCO profile. Ranked #4.' },
  ];
  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  for (const e of extra) {
    let hit = 0;
    for (const d of snap.docs) {
      const x = d.data() as any;
      if (!(x.co || '').startsWith(e.pre)) continue;
      if ((x.notes || '').includes('[2026-07-10] DOSSIER:')) { console.log('already:', x.co); hit++; continue; }
      const fields: any = { notes: (x.notes ? x.notes + '\n' : '') + e.note };
      if (e.ph && !x.ph) fields.ph = e.ph;
      if (e.who && !x.who) fields.who = e.who.slice(0, 80);
      await d.ref.set(fields, { merge: true });
      console.log('enriched:', x.co, e.ph);
      hit++;
    }
    if (!hit) console.log('NOT FOUND (prefix):', e.pre);
  }
  console.log('\nDone.');
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
