/**
 * One-time migration: tag every existing lead in Firestore with
 * `tenantId: "sc-deburring"`. After this runs, when Santiago logs in as
 * the sc-deburring tenant, he sees all his existing 177 leads. New
 * tenants will see an empty CRM.
 *
 * Run with:
 *   cd "C:\Users\scpre\SC LEADS PP"
 *   npx tsx scripts/migrate-tenant.ts
 *
 * Requires a GOOGLE_APPLICATION_CREDENTIALS env var pointing at a Firebase
 * service-account JSON, OR being run from a machine that's already signed in
 * via `gcloud auth application-default login`.
 *
 * Safe to re-run — it skips any lead that already has a tenantId.
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const TENANT_ID = 'sc-deburring';

async function main() {
  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId: 'sc-deburring-leads',
    });
  }
  const db = getFirestore();

  console.log(`[migrate] Loading leads from Firestore...`);
  const snap = await db.collection('leads').get();
  console.log(`[migrate] Found ${snap.size} leads.`);

  let updated = 0;
  let skipped = 0;
  const batchSize = 400;
  let batch = db.batch();
  let pending = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.tenantId) {
      skipped++;
      continue;
    }
    batch.set(doc.ref, { tenantId: TENANT_ID }, { merge: true });
    updated++;
    pending++;
    if (pending >= batchSize) {
      await batch.commit();
      console.log(`[migrate] Committed batch of ${pending}...`);
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending > 0) {
    await batch.commit();
    console.log(`[migrate] Committed final batch of ${pending}.`);
  }

  console.log(`[migrate] Done. Updated: ${updated}, Skipped (already tagged): ${skipped}`);
}

main().catch((err) => {
  console.error('[migrate] ERROR:', err);
  process.exit(1);
});
