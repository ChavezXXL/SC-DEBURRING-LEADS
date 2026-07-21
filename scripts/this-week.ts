/** Pull the live CRM and rank the most actionable "get a new client" targets
 * for this week. Read-only. Prints top targets + funnel counts for planning. */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const HIRE = /hiring|deburr|deflash|finisher|hand finish|bench|backlog|overflow|bottleneck|opening/i;
const HARD = /aerospace|defen[cs]e|space|fitting|valve|manifold|cross[- ]drill|titanium|inconel|gear|hydraulic|fastener/i;
const STAGED = /draft staged|pending send/i;
const CLIENTISH = new Set(['client', 'anchor', 'dead', 'research_pending', 'research_rejected']);

function score(l: any): number {
  const sig = [l.parts, l.pitch, l.role, l.notes, l.researchSignal, l.researchWhy].filter(Boolean).join(' ');
  let s = l.t === 1 ? 18 : 8;
  if (HIRE.test(sig)) s += 22;
  if (HARD.test(sig)) s += 15;
  if (l.pm?.trim()) s += 15;
  if (l.em?.trim()) s += 8;
  if (l.ph?.trim()) s += 5;
  if (l.address?.trim()) s += 5;
  if (l.status === 'interested') s += 18;
  if (l.status === 'quote') s += 22;
  return Math.min(100, s);
}

async function main() {
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  const all: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const active = all.filter((l) => !CLIENTISH.has(l.status));
  const byStatus: Record<string, number> = {};
  all.forEach((l) => { byStatus[l.status] = (byStatus[l.status] || 0) + 1; });

  const staged = active.filter((l) => STAGED.test(l.notes || '') && l.em?.trim());
  const hiring = active.filter((l) => HIRE.test([l.parts, l.pitch, l.role, l.notes, l.researchSignal, l.researchWhy].filter(Boolean).join(' ')));
  const callable = active.filter((l) => l.ph?.trim());

  console.log('=== FUNNEL (tenant sc-deburring) ===');
  console.log('  total leads:', all.length, '| active (not client/dead/research):', active.length);
  console.log('  by status:', JSON.stringify(byStatus));
  console.log('  staged drafts pending send:', staged.length, '| hiring-signal:', hiring.length, '| have phone:', callable.length);

  const ranked = [...active].sort((a, b) => score(b) - score(a)).slice(0, 14);
  console.log('\n=== TOP 14 TARGETS THIS WEEK ===');
  ranked.forEach((l, i) => {
    const sig = [l.parts, l.pitch, l.role, l.notes, l.researchSignal, l.researchWhy].filter(Boolean).join(' ');
    const why = HIRE.test(sig) ? 'HIRING/overflow signal' : HARD.test(sig) ? 'burr-prone aero work' : l.t === 1 ? 'tier-1 priority' : 'prospect';
    console.log(`${String(i + 1).padStart(2)}. [${score(l)}] ${l.co}${l.city ? ' — ' + l.city : ''} | ${l.status} | why: ${why}`);
    console.log(`     ph:${l.ph || '—'}  em:${l.em || '—'}  pm:${l.pm || '—'}`);
  });
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.message || e); process.exit(1); });
