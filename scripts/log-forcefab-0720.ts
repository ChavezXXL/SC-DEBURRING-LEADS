/** 2026-07-20: log the Force Fabrication conversation (first reply of the campaign).
 * Santiago emailed Justin Gamble directly 7/17 (own words, named contact);
 * Justin replied 7/18: soft no — in-house deburr staff; "if something changes
 * or larger projects come up, we'll let you know." → future-file, no pushing. */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`, 'utf8'))), projectId: 'sc-deburring-leads' });
  }
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  const note = '[2026-07-20] REPLIED (first conversation of the campaign). Santiago emailed Justin Gamble (justin@forcefab.com) directly 7/17; Justin replied 7/18: "we currently have deburr personnel conducting everything we do. If something changes or larger projects come up, we\'ll let you know." SOFT NO / FUTURE FILE — do NOT push. Contacts: Justin Gamble P (805) 754-2235 C (805) 338-4800, mike@forcefab.com cc\'d. Oxnard. Next: one gracious close-out reply (leave the free-sample-lot door open), then 90-day drip only. Their "if larger projects come up" = the exact moment we exist for.';
  let hit = 0;
  for (const d of snap.docs) {
    const x = d.data() as any;
    if (!(x.co || '').toLowerCase().includes('force fab')) continue;
    if ((x.notes || '').includes('[2026-07-20] REPLIED')) { hit++; continue; }
    const fields: any = {
      status: ['dead', 'client'].includes(x.status) ? x.status : 'interested',
      lastContactedAt: '2026-07-18T17:31:28.000Z',
      notes: (x.notes ? x.notes + '\n' : '') + note,
      who: x.who || 'Justin Gamble',
      ph: x.ph || '(805) 754-2235',
    };
    await d.ref.set(fields, { merge: true });
    console.log('logged:', x.co, '(status →', fields.status + ')');
    hit++;
  }
  if (!hit) console.log('Force Fab lead not found');
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
