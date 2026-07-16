/** Ensure every tenant doc has an explicit `disabled: false`.
 * Firestore security rules do `myTenant().disabled != true`; if the field is
 * ABSENT the rules engine errors and denies non-super-admin (owner) reads.
 * Setting it explicitly makes owners able to list their own leads again. */
import { existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;

async function main() {
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('tenants').get();
  let fixed = 0;
  for (const d of snap.docs) {
    const x = d.data() as any;
    if (x.disabled === undefined) {
      await d.ref.set({ disabled: false }, { merge: true });
      console.log(`  set disabled=false on tenants/${d.id} (${x.name})`);
      fixed++;
    } else {
      console.log(`  tenants/${d.id} already has disabled=${x.disabled}`);
    }
  }
  console.log(`\nDone — ${fixed} tenant(s) patched.`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
