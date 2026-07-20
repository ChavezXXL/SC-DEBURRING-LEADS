/** Deploy firestore.rules via the Firebase Rules REST API using the service
 * account (no firebase CLI / interactive login needed). Creating the ruleset
 * validates syntax server-side BEFORE we release it, and we print the current
 * ruleset name first so a rollback is one PATCH away. */
import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps, getApp } from 'firebase-admin/app';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const PID = 'sc-deburring-leads';
const RULES_PATH = String.raw`C:\Users\scpre\SC LEADS PP\firestore.rules`;
const BASE = `https://firebaserules.googleapis.com/v1/projects/${PID}`;

async function token(): Promise<string> {
  if (!getApps().length) {
    initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: PID });
  }
  const cred = getApp().options.credential as any;
  const t = await cred.getAccessToken();
  return t.access_token as string;
}

async function main() {
  const at = await token();
  const auth = { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' };

  // Current release -> rollback target.
  const cur = await fetch(`${BASE}/releases/cloud.firestore`, { headers: auth });
  const curJson: any = await cur.json();
  console.log('Current ruleset (ROLLBACK TARGET):', curJson.rulesetName || '(none / new release)');

  // Create the new ruleset — this VALIDATES the source and rejects syntax errors.
  const source = readFileSync(RULES_PATH, 'utf8');
  const rs = await fetch(`${BASE}/rulesets`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: source }] } }),
  });
  const rsJson: any = await rs.json();
  if (!rs.ok) throw new Error('ruleset create/validate FAILED: ' + JSON.stringify(rsJson, null, 2));
  const rulesetName = rsJson.name as string;
  console.log('Created + validated ruleset:', rulesetName);

  // Point the cloud.firestore release at the new ruleset.
  const rel = await fetch(`${BASE}/releases/cloud.firestore`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ release: { name: `projects/${PID}/releases/cloud.firestore`, rulesetName } }),
  });
  const relJson: any = await rel.json();
  if (!rel.ok) throw new Error('release update FAILED: ' + JSON.stringify(relJson, null, 2));
  console.log('RELEASED. Live ruleset is now:', relJson.rulesetName || rulesetName);
  console.log('Rollback if needed: PATCH release rulesetName ->', curJson.rulesetName || '(none)');
  process.exit(0);
}
main().catch((e) => { console.error('FATAL:', e.message || e); process.exit(1); });
