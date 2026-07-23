/** Write verified street addresses onto CRM leads so map pins land on the real
 * building instead of a city centre. Only fills a BLANK address — never
 * overwrites. Dry-run by default; --commit to write. */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const TENANT = 'sc-deburring';

const ADDR: [string, string][] = [
  ['Alpha Machinery', '3233 N San Fernando Rd Unit 6, Los Angeles, CA 90065'],
  ['Alziebler', '12734 Branford Street, Unit 12, Pacoima, CA 91331'],
  ['American Precision Tool', '10314 Norris Ave, Units H-J, Pacoima, CA 91331'],
  ['Coronado Manufacturing', '8991 Glenoaks Blvd, Sun Valley, CA 91352'],
  ['Delta Hi-Tech', '9600 De Soto Ave, Chatsworth, CA 91311'],
  ['G&H Precision', '11950 Vose St, North Hollywood, CA 91605'],
  ['H&H Machining Center', '29170 Avenue Penn, Suite C, Valencia, CA 91355'],
  ['S&H Machine', '900 N Lake Street, Burbank, CA 91502'],
  ['W Machine Works', '13814 Del Sur St, San Fernando, CA 91340'],
  ['Aero Mechanism', '21700 Marilla Street, Chatsworth, CA 91311'],
  ['Force Fabrication', '2233 Statham Blvd, Oxnard, CA 93033'],
  ['Acromil', '18421 Railroad Street, City of Industry, CA 91748'],
  ['Allied Mechanical', '1720 S Bon View Ave, Ontario, CA 91761'],
  ['CAMTECH', '8710 Research Drive, Irvine, CA 92618'],
  ['Crissair', '28909 Avenue Williams, Valencia, CA 91355'],
  ['Votaw Precision', '13153 Lakeland Road, Santa Fe Springs, CA 90670'],
  ['Bandy Manufacturing', '3420 N San Fernando Blvd, Burbank, CA 91504'],
  ['ESM Aerospace', '1203 W Isabel St, Burbank, CA 91506'],
  ['Pacific Sky Supply', '8230 San Fernando Road, Sun Valley, CA 91352'],
  ['Triumph Actuation', '28150 W Harrison Parkway, Valencia, CA 91355'],
];

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function main() {
  const commit = process.argv.includes('--commit');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', TENANT).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

  console.log(`MODE: ${commit ? 'COMMIT' : 'DRY-RUN'}\n`);
  let n = 0;
  for (const [name, address] of ADDR) {
    const q = norm(name);
    // Guard blank/short names — a doc with an empty `co` would match everything.
    const hits = all.filter((l) => {
      const ln = norm(l.co);
      return ln.length > 3 && (ln.includes(q) || q.includes(ln));
    });
    if (!hits.length) { console.log(`  ?? no match: ${name}`); continue; }
    for (const l of hits) {
      if (l.address?.trim()) { console.log(`  = ${l.co}: already has an address`); continue; }
      console.log(`  + ${l.co} -> ${address}`);
      n++;
      if (commit) await db.collection('leads').doc(l.id).set({ address }, { merge: true });
    }
  }
  console.log(`\n${commit ? 'Wrote' : 'Would write'} ${n} addresses.`);
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.message || e); process.exit(1); });
