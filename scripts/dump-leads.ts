/**
 * Read-only: dump every lead in the sc-deburring tenant to a JSON file so the
 * assistant can reconcile / dedupe / pick a draft batch. Writes nothing to the CRM.
 *
 * Auth: uses serviceAccount.json in the app root (or GOOGLE_APPLICATION_CREDENTIALS).
 * Run:  cd "C:\Users\scpre\SC LEADS PP" && npx tsx scripts/dump-leads.ts
 * Out:  ..\SC DEBURR MARKETING\crm_leads_dump.json
 */
import { existsSync, writeFileSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const OUT = String.raw`C:\Users\scpre\SC DEBURR MARKETING\crm_leads_dump.json`;

async function main() {
  if (!getApps().length) {
    initializeApp({
      credential: existsSync(KEY) ? cert(KEY) : applicationDefault(),
      projectId: 'sc-deburring-leads',
    });
  }
  const db = getFirestore();
  const snap = await db.collection('leads').get();
  const leads = snap.docs.map(d => {
    const x: any = d.data();
    return {
      id: d.id, co: x.co || '', city: x.city || '', r: x.r || '', t: x.t,
      em: x.em || '', ph: x.ph || '', pm: x.pm || '', who: x.who || '',
      status: x.status || '', touchCount: x.touchCount || 0,
      lastContactedAt: x.lastContactedAt || '',
      notes: (x.notes || '').slice(0, 240),
    };
  });
  writeFileSync(OUT, JSON.stringify({ count: leads.length, leads }, null, 2));
  // quick status tally
  const tally: Record<string, number> = {};
  const withEmail = leads.filter(l => l.em).length;
  leads.forEach(l => { tally[l.status] = (tally[l.status] || 0) + 1; });
  console.log(`OK ${leads.length} leads -> crm_leads_dump.json`);
  console.log(`with email: ${withEmail}`);
  console.log('by status:', JSON.stringify(tally));
}

main().catch(e => { console.error('DUMP_ERROR', e.code || '', e.message || e); process.exit(1); });
