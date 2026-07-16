/** Repair the 0709 enrichment: an empty-co lead matched everything (startsWith('')
 * is always true) and swallowed Romi + RKL research. Clean it, enrich the real two. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const STAMP = '[2026-07-09] Draft staged (research batch) — pending send.';

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();

  // 1) Clean the empty-co doc: strip the wrongly-appended research + stamp lines.
  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  for (const d of snap.docs) {
    const x = d.data() as any;
    if ((x.co || '').trim() !== '') continue;
    console.log('empty-co doc found:', d.id, '| ph:', x.ph, '| notes len:', (x.notes || '').length);
    let notes = String(x.notes || '');
    const cut = notes.indexOf('[2026-07-09] RESEARCH');
    if (cut >= 0) notes = notes.slice(0, cut).replace(/\s+$/, '');
    await d.ref.set({ notes, t: 2, who: '', parts: '' }, { merge: true });
    console.log('  cleaned (research stripped, t reset to 2).');
  }

  // 2) Properly enrich the two real leads.
  const fixes = [
    {
      co: 'Romi Industries', fit: 'GREAT',
      block: `[2026-07-09] RESEARCH — FIT: GREAT. 11-50 person AS9100D/ITAR build-to-print CNC + sheet metal (~$6M rev), 20 min from Pacoima — right size to machine precision parts without a full-time deburr bench.\n  Makes: Build-to-print 4-axis CNC, sheet metal, assemblies\n  Size: 11-50 employees, ~$6M rev, Santa Clarita | Certs: AS9100D, ISO 9001, ITAR\n  Contact: Jay Patel — President\n  Hiring: none found`,
      who: 'Jay Patel — President', parts: 'Build-to-print 4-axis CNC, sheet metal, assemblies',
    },
    {
      co: 'RKL Technologies', fit: 'GREAT',
      block: `[2026-07-09] RESEARCH — FIT: GREAT. AS9100D + ISO 13485 medical/aero CNC — microscope-deburr work; small veteran-owned, no finishing dept.\n  Makes: Tight-tolerance turning/milling/EDM + AM post-processing\n  Size: Small, est 1983, SDVOSB, Corona | Certs: AS9100D, ISO 13485, ISO 9001\n  Contact: Kip Sullivan — CEO; Torry Lamp — co-owner\n  Alt email: torry@rkltech.com\n  Hiring: none found`,
      who: 'Kip Sullivan — CEO', parts: 'Tight-tolerance turning/milling/EDM + AM post-processing',
    },
  ];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  for (const f of fixes) {
    const fn = norm(f.co);
    const hit = snap.docs.find((d) => { const dn = norm((d.data() as any).co || ''); return dn.length > 3 && (dn === fn || dn.startsWith(fn) || fn.startsWith(dn)); });
    if (!hit) { console.log('STILL NO MATCH:', f.co); continue; }
    const x = hit.data() as any;
    if ((x.notes || '').includes('[2026-07-09] RESEARCH')) { console.log('already enriched:', x.co); continue; }
    await hit.ref.set({
      notes: (x.notes ? x.notes + '\n' : '') + f.block + '\n' + STAMP,
      t: 1, who: x.who || f.who, parts: (!x.parts || x.parts.length < 20) ? f.parts : x.parts,
    }, { merge: true });
    console.log('enriched [GREAT]', x.co);
  }
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
