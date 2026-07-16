/** Mine the CRM for Apex Growth web-design prospects: shops with NO website.
 * Clients first (warm upsell), then leads with contact info. Read-only. */
import { existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  const snap = await db.collection('leads').get();
  const rows: any[] = [];
  snap.forEach((d) => {
    const x = d.data() as any;
    const web = (x.web || '').trim();
    if (web) return; // has a site — not a web-design prospect
    rows.push({
      co: x.co, city: x.city || '', ph: x.ph || '', em: x.em || '',
      status: x.status || 'new', who: x.who || x.pm || '',
    });
  });
  const clients = rows.filter((r) => r.status === 'client');
  const contactable = rows.filter((r) => r.status !== 'client' && (r.em || r.ph));
  const rest = rows.filter((r) => r.status !== 'client' && !r.em && !r.ph);

  console.log(`NO-WEBSITE shops in CRM: ${rows.length} of ${snap.size} total\n`);
  console.log(`=== CLIENTS (warm upsell — they already trust Santiago): ${clients.length} ===`);
  for (const r of clients) console.log(`  ${r.co} | ${r.city} | ${r.ph} | ${r.em} | contact: ${r.who}`);
  console.log(`\n=== LEADS with email/phone: ${contactable.length} ===`);
  for (const r of contactable.slice(0, 40)) console.log(`  [${r.status}] ${r.co} | ${r.city} | ${r.ph} | ${r.em}`);
  console.log(`\n=== No contact info at all: ${rest.length} (skip) ===`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
