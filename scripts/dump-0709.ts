/** Dump lead dedupe-keys + status to scratchpad JSON (read-only). */
import { readFileSync, writeFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const OUT = String.raw`C:\Users\scpre\AppData\Local\Temp\claude\C--Users-scpre-SC-DEBURR-MARKETING\c46d0ac7-80be-4db5-9553-323f89ead618\scratchpad\crm_dump_0709.json`;

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  const snap = await db.collection('leads').get();
  const rows: any[] = [];
  snap.forEach((d) => { const x = d.data() as any; rows.push({ co: x.co || '', em: (x.em || '').toLowerCase(), web: x.web || '', city: x.city || '', status: x.status, tenantId: x.tenantId }); });
  writeFileSync(OUT, JSON.stringify(rows, null, 1));
  const sc = rows.filter((r) => r.tenantId === 'sc-deburring');
  console.log('total:', rows.length, '| sc-deburring:', sc.length);
  console.log('by status:', JSON.stringify(sc.reduce((a: any, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {})));
  console.log('clients:', sc.filter((r) => r.status === 'client').map((r) => r.co).join(' | '));
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
