/** Create the 'apex-growth' tenant — Apex Growth's own agency workspace.
 * Website form submissions land here as leads. Idempotent. */
import { existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  const ref = db.collection('tenants').doc('apex-growth');
  const existing = await ref.get();
  if (existing.exists) {
    console.log('tenants/apex-growth already exists:', JSON.stringify(existing.data()));
  } else {
    await ref.set({
      id: 'apex-growth',
      name: 'Apex Growth — Agency',
      ownerEmail: 'apexgrowthgroupllc@gmail.com',
      primaryColor: '#F26D21',
      createdAt: new Date().toISOString(),
      plan: 'internal',
    });
    console.log('Created tenants/apex-growth ✅');
  }
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
