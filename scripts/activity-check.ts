/** What moved recently? Funnel snapshot + anything touched in the last 3 days. */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const STAGED = /draft staged|pending send/i;

async function main() {
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

  const byStatus: Record<string, number> = {};
  all.forEach((l) => { byStatus[l.status] = (byStatus[l.status] || 0) + 1; });

  const active = all.filter((l) => !['dead', 'research_pending', 'research_rejected'].includes(l.status));
  const staged = active.filter((l) => STAGED.test(l.notes || '') && l.em?.trim());

  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const recent = all
    .filter((l) => l.lastContactedAt && new Date(l.lastContactedAt).getTime() > cutoff)
    .sort((a, b) => new Date(b.lastContactedAt).getTime() - new Date(a.lastContactedAt).getTime());

  console.log('=== FUNNEL NOW ===');
  console.log('  total:', all.length, '| by status:', JSON.stringify(byStatus));
  console.log('  staged drafts still pending send:', staged.length);
  console.log('  leads with a street address:', all.filter((l) => l.address?.trim()).length);
  console.log('  leads with exact lat/lng:', all.filter((l) => typeof l.lat === 'number').length);

  console.log('\n=== TOUCHED IN LAST 3 DAYS ===');
  if (!recent.length) console.log('  (nothing logged)');
  recent.slice(0, 15).forEach((l) => {
    console.log(`  ${new Date(l.lastContactedAt).toLocaleString()} | ${l.co} | status=${l.status} | touches=${l.touchCount || 0}`);
  });
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.message || e); process.exit(1); });
