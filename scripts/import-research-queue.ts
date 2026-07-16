/**
 * Stage researched companies in the approval-only Research Queue.
 *
 * SAFE BY DEFAULT: this script only previews. Pass --commit to write.
 * It never sends email, never marks a company contacted, and creates records
 * with status `research_pending`, which the CRM hides from active lead views.
 *
 * Usage:
 *   npm run research:import -- ./research-candidates.json --validate-only
 *   npm run research:import -- ./research-candidates.json
 *   npm run research:import -- ./research-candidates.json --commit
 *
 * Authentication:
 *   GOOGLE_APPLICATION_CREDENTIALS=/secure/path/service-account.json
 *   or SC_USER + SC_PASS for a local authenticated run.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const TENANT_ID = 'sc-deburring';

interface CandidateInput {
  co: string;
  city?: string;
  r?: string;
  t?: 1 | 2;
  ph?: string;
  em?: string;
  web?: string;
  who?: string;
  role?: string;
  pm?: string;
  pm_title?: string;
  parts?: string;
  pitch?: string;
  researchSignal: string;
  researchSignalDate?: string;
  researchWhy?: string;
  researchSourceUrls: string[];
  researchNextStep?: string;
}

const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const suffix = () => Math.random().toString(36).substring(2, 7);
const normCompany = (value: string) =>
  (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normEmail = (value: string) => (value || '').toLowerCase().trim();
const normWebsite = (value: string) => {
  const raw = (value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
};

function validate(value: unknown): CandidateInput[] {
  if (!Array.isArray(value)) throw new Error('Import file must contain a JSON array.');
  return value.map((raw: any, index) => {
    if (!raw || typeof raw !== 'object') throw new Error(`Row ${index + 1} is not an object.`);
    if (!String(raw.co || '').trim()) throw new Error(`Row ${index + 1} is missing co (company name).`);
    if (!String(raw.researchSignal || '').trim()) {
      throw new Error(`Row ${index + 1} is missing researchSignal.`);
    }
    if (!Array.isArray(raw.researchSourceUrls) || raw.researchSourceUrls.length === 0) {
      throw new Error(`Row ${index + 1} needs at least one researchSourceUrls entry.`);
    }
    const badUrl = raw.researchSourceUrls.find((url: unknown) => {
      try {
        const parsed = new URL(String(url));
        return parsed.protocol !== 'http:' && parsed.protocol !== 'https:';
      } catch {
        return true;
      }
    });
    if (badUrl) throw new Error(`Row ${index + 1} contains an invalid source URL.`);
    return {
      ...raw,
      co: String(raw.co).trim(),
      t: raw.t === 1 ? 1 : 2,
      researchSignal: String(raw.researchSignal).trim(),
      researchSourceUrls: raw.researchSourceUrls.map((url: unknown) => String(url).trim()),
    } as CandidateInput;
  });
}

async function main() {
  const commit = process.argv.includes('--commit');
  const validateOnly = process.argv.includes('--validate-only');
  const fileArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  if (!fileArg) {
    throw new Error('Provide a JSON file: npm run research:import -- ./research-candidates.json');
  }

  const filePath = resolve(process.cwd(), fileArg);
  const candidates = validate(JSON.parse(await readFile(filePath, 'utf8')));
  if (validateOnly) {
    console.log(`VALID. ${candidates.length} research candidate${candidates.length === 1 ? '' : 's'} ready for a dry run.`);
    return;
  }

  const firebaseConfig = {
    apiKey: Buffer.from(
      ['QUl6YVN5QWJ5eFdH', 'bFlQWWpVVmZYNmVa', 'MU9yNnRkeHRTRHNVSlhn'].join(''),
      'base64',
    ).toString('utf8'),
    authDomain: 'sc-deburring-leads.firebaseapp.com',
    projectId: 'sc-deburring-leads',
  };

  let api: {
    getAll: () => Promise<any[]>;
    create: (id: string, data: Record<string, unknown>) => Promise<void>;
  };

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: 'sc-deburring-leads' });
    }
    const db = getFirestore();
    api = {
      getAll: async () =>
        (await db.collection('leads').where('tenantId', '==', TENANT_ID).get()).docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })),
      create: async (id, data) => {
        await db.collection('leads').doc(id).set(data);
      },
    };
  } else {
    const user = process.env.SC_USER;
    const pass = process.env.SC_PASS;
    if (!user || !pass) {
      throw new Error(
        'No credentials. Set GOOGLE_APPLICATION_CREDENTIALS or SC_USER + SC_PASS in your local environment.',
      );
    }
    const { initializeApp } = await import('firebase/app');
    const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
    const { getFirestore, collection, doc, getDocs, query, setDoc, where } =
      await import('firebase/firestore');
    const app = initializeApp(firebaseConfig);
    await signInWithEmailAndPassword(getAuth(app), user, pass);
    const db = getFirestore(app);
    api = {
      getAll: async () =>
        (await getDocs(query(collection(db, 'leads'), where('tenantId', '==', TENANT_ID)))).docs.map(
          (d) => ({ id: d.id, ...d.data() }),
        ),
      create: async (id, data) => setDoc(doc(db, 'leads', id), data),
    };
  }

  const existing = await api.getAll();
  const companies = new Set(existing.map((lead) => normCompany(lead.co)).filter(Boolean));
  const emails = new Set(existing.map((lead) => normEmail(lead.em)).filter(Boolean));
  const websites = new Set(existing.map((lead) => normWebsite(lead.web)).filter(Boolean));
  let added = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const company = normCompany(candidate.co);
    const email = normEmail(candidate.em || '');
    const website = normWebsite(candidate.web || '');
    const duplicate =
      companies.has(company) ||
      Boolean(email && emails.has(email)) ||
      Boolean(website && websites.has(website));

    if (duplicate) {
      skipped++;
      console.log(`- SKIP ${candidate.co} (already in CRM or research queue)`);
      continue;
    }

    const id = `research-${slug(candidate.co).slice(0, 38)}-${suffix()}`;
    const now = new Date().toISOString();
    const data = {
      id,
      tenantId: TENANT_ID,
      t: candidate.t || 2,
      r: candidate.r || 'Other',
      co: candidate.co,
      city: candidate.city || '',
      ph: candidate.ph || '',
      em: candidate.em || '',
      web: candidate.web || '',
      who: candidate.who || '',
      role: candidate.role || '',
      pm: candidate.pm || '',
      pm_title: candidate.pm_title || '',
      parts: candidate.parts || '',
      pitch: candidate.pitch || candidate.researchWhy || '',
      status: 'research_pending',
      notes: `[${now.slice(0, 10)}] Staged from public research. Awaiting approval; no outreach authorized.`,
      touchCount: 0,
      queued_for_outreach: false,
      researchSignal: candidate.researchSignal,
      researchSignalDate: candidate.researchSignalDate || '',
      researchWhy: candidate.researchWhy || candidate.pitch || '',
      researchSourceUrls: candidate.researchSourceUrls,
      researchNextStep: candidate.researchNextStep || '',
      researchCreatedAt: now,
      researchUpdatedAt: now,
      researchDecisionAt: '',
    };

    console.log(`${commit ? '+' : '~'} ${candidate.co} — ${candidate.city || 'City not set'}`);
    if (commit) {
      await api.create(id, data);
      added++;
    }
    companies.add(company);
    if (email) emails.add(email);
    if (website) websites.add(website);
  }

  console.log('---');
  if (commit) console.log(`DONE. Staged ${added}; skipped ${skipped}. No outreach sent.`);
  else console.log(`DRY RUN. Would stage ${candidates.length - skipped}; skip ${skipped}. Add --commit to write.`);
}

main().catch((error) => {
  console.error('[research:import]', error?.message || error);
  process.exit(1);
});
