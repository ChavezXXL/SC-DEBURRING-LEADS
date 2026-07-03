/**
 * Diagnose + repair the tenant tag on leads.
 * The app shows only leads where tenantId === "sc-deburring" (useLeads query).
 * Any lead saved without that tag is invisible in the UI even though it's in the DB.
 * Dry-run prints the breakdown; --commit re-tags every stray lead to sc-deburring.
 * Run: cd "C:\Users\scpre\SC LEADS PP" && npx tsx scripts/tenant-fix.ts [--commit]
 */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const TARGET = 'sc-deburring';

async function main() {
  const commit = process.argv.includes('--commit');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').get();
  console.log('TOTAL leads in collection:', snap.size);

  const byTenant: Record<string, { count: number; statuses: Record<string, number>; samples: string[] }> = {};
  snap.forEach(d => {
    const x = d.data() as any;
    const t = x.tenantId === undefined ? '<missing>' : x.tenantId === null ? '<null>' : x.tenantId === '' ? '<empty>' : String(x.tenantId);
    byTenant[t] ??= { count: 0, statuses: {}, samples: [] };
    byTenant[t].count++;
    const st = x.status || '<none>';
    byTenant[t].statuses[st] = (byTenant[t].statuses[st] || 0) + 1;
    if (byTenant[t].samples.length < 8) byTenant[t].samples.push(x.co || d.id);
  });

  console.log('\n=== BREAKDOWN BY tenantId ===');
  for (const [t, info] of Object.entries(byTenant)) {
    console.log(`\ntenantId="${t}"  →  ${info.count} leads`);
    console.log('  statuses:', JSON.stringify(info.statuses));
    console.log('  samples :', info.samples.join(', '));
  }

  const needFix = snap.docs.filter(d => (d.data() as any).tenantId !== TARGET);
  console.log(`\n${needFix.length} leads are NOT tagged "${TARGET}" → hidden from the app.`);

  if (!commit) {
    console.log(`\nDRY RUN. Re-run with --commit to tag all ${needFix.length} as "${TARGET}" so every lead shows.`);
    return;
  }
  let n = 0;
  for (let i = 0; i < needFix.length; i += 400) {
    const batch = db.batch();
    for (const d of needFix.slice(i, i + 400)) { batch.update(d.ref, { tenantId: TARGET }); n++; }
    await batch.commit();
  }
  console.log(`✔ Re-tagged ${n} leads to tenantId="${TARGET}". They will all appear now.`);
}
main().catch(e => { console.error('ERROR:', e.code || '', e.message || e); process.exit(1); });
