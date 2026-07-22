/** Remove stale "Draft staged / pending send" marker lines from lead notes.
 * Those drafts were written in a voice the owner rejected — this un-flags the
 * leads so nothing shows as "ready to send". ONLY the marker lines are removed:
 * company info, research notes, call logs, status, touch counts all stay.
 *
 *   npx tsx scripts/clear-staged-drafts.ts            # dry-run
 *   npx tsx scripts/clear-staged-drafts.ts --commit   # write
 */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const MARKER = /draft staged|pending send|drafted in gmail|gmail draft/i;

async function main() {
  const commit = process.argv.includes('--commit');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

  const hits = all.filter((l) => MARKER.test(l.notes || ''));
  console.log(`MODE: ${commit ? 'COMMIT (writing)' : 'DRY-RUN (no writes)'}`);
  console.log(`Leads carrying a staged-draft marker: ${hits.length}\n`);

  // Marker text is often mixed INTO a line that also carries real research
  // (verified emails, certs, source). So strip only the offending SENTENCE and
  // keep the rest of the line. Drop the line only if nothing survives.
  const scrubLine = (line: string): string | null => {
    if (!MARKER.test(line)) return line;
    const sentences = line.split(/(?<=\.)\s+/);
    const kept = sentences.filter((s) => !MARKER.test(s));
    const rebuilt = kept.join(' ').replace(/\s{2,}/g, ' ').trim();
    // A leftover bare date stamp like "[2026-07-09]" carries no information.
    if (!rebuilt || /^\[\d{4}-\d{2}-\d{2}\][\s.\-—]*$/.test(rebuilt)) return null;
    return rebuilt;
  };

  let changed = 0;
  let removedSentences = 0;
  for (const l of hits) {
    const before: string = l.notes || '';
    const outLines: string[] = [];
    const dropped: string[] = [];
    for (const line of before.split('\n')) {
      const scrubbed = scrubLine(line);
      if (scrubbed === null) {
        if (line.trim()) dropped.push(line.trim());
        continue;
      }
      if (scrubbed !== line) dropped.push('(partial) ' + line.trim());
      outLines.push(scrubbed);
    }
    const after = outLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (after === before) continue;
    changed++;
    removedSentences += dropped.length;
    if (changed <= 6) {
      console.log(`--- ${l.co}`);
      dropped.forEach((d) => console.log(`    SCRUB: ${d.slice(0, 110)}`));
      console.log(`    KEPT: ${after.replace(/\n/g, ' | ').slice(0, 190)}`);
      console.log(`    notes: ${before.length} -> ${after.length} chars\n`);
    }
    if (commit) await db.collection('leads').doc(l.id).set({ notes: after }, { merge: true });
  }
  console.log(`${commit ? 'Updated' : 'Would update'} ${changed} leads · ${removedSentences} lines touched.`);
  console.log('Status, touchCount, contacts, emails, research: untouched.');
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.message || e); process.exit(1); });
