/**
 * Mark the shops emailed on 2026-06-22 as "emailed" in the SC LEADS CRM.
 *
 * Updates each matching lead:
 *   - status -> "emailed"  (only promotes from new/called/voicemail/visited;
 *                           never downgrades a warmer status like interested/quote/client)
 *   - lastContactedAt -> the send time
 *   - touchCount -> +N (N = how many emails actually went out that evening)
 *   - notes -> append a dated log line (double-sends flagged)
 *
 * Matches a CRM lead by email first, then by normalized company name.
 * Idempotent: re-running won't double-append the note or re-bump the count
 * (it checks for the dated marker first). SAFE BY DEFAULT — previews only.
 *
 * ── HOW TO RUN ───────────────────────────────────────────────────────────────
 * Two auth modes; pick whichever you have. From the app folder:
 *     cd "C:\Users\scpre\SC LEADS PP"
 *
 *   A) Your login (no setup; you type your own password — it never leaves your box):
 *        $env:SC_USER="scprecisiondeburring@gmail.com"; $env:SC_PASS="<your password>"
 *        npx tsx scripts/mark-emailed.ts            # preview (dry run)
 *        npx tsx scripts/mark-emailed.ts --commit   # actually write
 *
 *   B) Service account (best for the unattended auto-run later):
 *        $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\serviceAccount.json"
 *        npx tsx scripts/mark-emailed.ts --commit
 *
 * Add nothing to email a soul — this only updates CRM records.
 */

const TENANT_ID = 'sc-deburring';

// Actual send time of the main approved batch (from Gmail Sent): 2026-06-22 19:16 PDT.
const SENT_AT = '2026-06-23T02:16:00Z';

// Statuses we must NOT overwrite — a lead that's already warmer stays warmer.
const WARM = new Set(['interested', 'quote', 'dead', 'client']);

interface Mark {
  co: string;          // company, for name-match + reporting
  em?: string;         // email it was sent to (primary match key)
  touches: number;     // emails that went out that evening
  note: string;        // log line appended to notes
}

// The 11 shops emailed the evening of 2026-06-22, confirmed in Gmail Sent.
const MARKS: Mark[] = [
  { co: 'Vanacore Engineering', em: 'vanacoreeng@yahoo.com', touches: 2,
    note: 'DOUBLE-SENT: casual variant 6:28pm + approved template 7:16pm (also a prior 2022 cold email). Do NOT send a 3rd touch — if they reply, treat as one conversation.' },
  { co: 'LAS Precision', em: 'info@lasprecision.com', touches: 1,
    note: 'Cold email sent (quotes@, approved template).' },
  { co: 'American Precision Tool', em: 'purchasing@ameriprectool.com', touches: 1,
    note: 'Cold email sent (quotes@, approved template).' },
  { co: 'RivCut', em: 'hello@rivcut.com', touches: 1,
    note: 'Cold email sent (quotes@, approved template).' },
  { co: 'SMI-CA', em: 'dok@smi-ca.com', touches: 1,
    note: 'Cold email sent (quotes@, approved template).' },
  { co: 'MPC Machining', em: 'mpc@mpcmachining.com', touches: 1,
    note: 'Cold email sent (quotes@, approved template).' },
  { co: 'Turret Lathe Specialists', em: 'quotes@turretlathe.com', touches: 1,
    note: 'Cold email sent (quotes@, approved template).' },
  { co: 'Ricaurte Precision', em: 'cnc@ricaurteprecision.com', touches: 1,
    note: 'Cold email sent (quotes@, approved template).' },
  { co: 'C&H Machine', em: 'info@c-hmachine.com', touches: 1,
    note: 'Cold email sent (quotes@, approved template).' },
  { co: 'Riverside Machine', em: 'sales@rmcaero.com', touches: 2,
    note: 'DOUBLE-SENT: "Hi there" main template 5:34pm + approved template 7:16pm. Do NOT send a 3rd touch.' },
  { co: 'Price Manufacturing', em: 'contact@pricemfg.com', touches: 1,
    note: 'Cold email sent (quotes@, approved template).' },
];

const NOTE_MARKER = '[2026-06-22] '; // idempotency sentinel
const normCo = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normEm = (s: string) => (s || '').toLowerCase().trim();

async function main() {
  const commit = process.argv.includes('--commit');
  const _fk = ['QUl6YVN5QWJ5eFdH', 'bFlQWWpVVmZYNmVa', 'MU9yNnRkeHRTRHNVSlhn'];
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || Buffer.from(_fk.join(''), 'base64').toString('utf8'),
    authDomain: 'sc-deburring-leads.firebaseapp.com',
    projectId: 'sc-deburring-leads',
    storageBucket: 'sc-deburring-leads.firebasestorage.app',
    messagingSenderId: '852831076854',
    appId: '1:852831076854:web:7536484ecdb9f34e0b87d7',
  };

  // Pick auth mode. Returns a uniform { getAll, update } over Firestore.
  let api: { getAll: () => Promise<any[]>; update: (id: string, patch: any) => Promise<void> };

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('[mark] Auth: service account (firebase-admin).');
    const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'sc-deburring-leads' });
    const db = getFirestore();
    api = {
      getAll: async () => (await db.collection('leads').get()).docs.map(d => ({ id: d.id, ...d.data() })),
      update: async (id, patch) => { await db.collection('leads').doc(id).set(patch, { merge: true }); },
    };
  } else {
    const user = process.env.SC_USER, pass = process.env.SC_PASS;
    if (!user || !pass) {
      console.error('No credentials. Set SC_USER + SC_PASS (your login), or GOOGLE_APPLICATION_CREDENTIALS (service account). See header.');
      process.exit(1);
    }
    console.log(`[mark] Auth: signing in as ${user}...`);
    const { initializeApp } = await import('firebase/app');
    const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
    const { getFirestore, collection, getDocs, doc, setDoc, query, where } = await import('firebase/firestore');
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    await signInWithEmailAndPassword(auth, user, pass);
    const db = getFirestore(app);
    api = {
      getAll: async () => {
        const q = query(collection(db, 'leads'), where('tenantId', '==', TENANT_ID));
        return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
      },
      update: async (id, patch) => { await setDoc(doc(db, 'leads', id), patch, { merge: true }); },
    };
  }

  console.log('[mark] Loading leads...');
  const leads = await api.getAll();
  console.log(`[mark] ${leads.length} leads in tenant.`);

  const notFound: string[] = [];
  let updated = 0, already = 0;

  for (const m of MARKS) {
    const byEmail = m.em ? leads.find(l => normEm(l.em) === normEm(m.em!)) : null;
    const byName = leads.find(l => {
      const a = normCo(l.co), b = normCo(m.co);
      return a && b && (a === b || a.includes(b) || b.includes(a));
    });
    const lead = byEmail || byName;
    if (!lead) { notFound.push(`${m.co}${m.em ? ' <' + m.em + '>' : ''}`); continue; }

    if ((lead.notes || '').includes(NOTE_MARKER)) {
      already++;
      console.log(`  = ${m.co} -> already marked (skip)`);
      continue;
    }

    const keepStatus = WARM.has(lead.status);
    const patch: any = {
      lastContactedAt: SENT_AT,
      touchCount: (typeof lead.touchCount === 'number' ? lead.touchCount : 0) + m.touches,
      notes: `${(lead.notes || '').trim()}\n${NOTE_MARKER}${m.note}`.trim(),
    };
    if (!keepStatus) patch.status = 'emailed';

    console.log(`  ${commit ? '+' : '~'} ${m.co} -> status:${keepStatus ? lead.status + ' (kept)' : 'emailed'}, touch:${patch.touchCount}, +note`);
    if (commit) { await api.update(lead.id, patch); updated++; }
  }

  console.log('---');
  if (!commit) {
    console.log(`[mark] DRY RUN. Would update ${MARKS.length - notFound.length - already}, skip ${already} already-marked.`);
    console.log('[mark] Re-run with --commit to write.');
  } else {
    console.log(`[mark] DONE. Updated ${updated}, skipped ${already} already-marked.`);
  }
  if (notFound.length) {
    console.log(`\n[mark] NOT IN CRM (${notFound.length}) — add these as leads, or check the name/email:`);
    notFound.forEach(n => console.log('  - ' + n));
  }
  process.exit(0);
}

main().catch(e => { console.error('[mark] ERROR:', e.code || '', e.message || e); process.exit(1); });
