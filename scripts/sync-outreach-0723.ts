/** Reconcile the big 2026-07-22/23 outreach batch into the CRM.
 *  - each cold intro -> `emailed` (add the company if it's not in the CRM yet)
 *  - bounces -> flag the dead address, don't upgrade
 *  - actionable auto-replies / a real reply -> captured as notes / new contact
 * Matches by EMAIL first, then a strict name check. Never downgrades a warmer
 * status. Dry-run by default; --commit to write. */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const TENANT = 'sc-deburring';
const D = '2026-07-23';
const COLDER = new Set(['new', 'called', 'voicemail']);

type Row = { co: string; em: string; note?: string };

// Straight cold intros / warm check-ins -> emailed (add if missing).
const EMAILED: Row[] = [
  { co: 'Monogram Aerospace Fasteners', em: 'technicalsales.monogram@trimas.com' },
  { co: 'Bristol Industries', em: 'Bristol-Sales@bristolind.com' },
  { co: 'FIT Fastener', em: 'fit-sales@fitfastener.com' },
  { co: 'California Machine Specialties', em: 'info@calmachine.com' },
  { co: '3V Fasteners', em: '3V-Sales@3vfasteners.com' },
  { co: 'American Drilling', em: 'sales@americandrill.com', note: 'Torrance operation.' },
  { co: 'California Screw Products', em: 'sales-csp@calscrew.net', note: 'Paramount.' },
  { co: 'ACE Clearwater', em: 'wperry@aceclearwater.com', note: 'Formed/machined/welded aero assemblies.' },
  { co: 'Aerospace Fittings', em: 'rfq@aerospacefittings.com' },
  { co: 'Hydra-Electric', em: 'info@hydraelectric.com' },
  { co: 'Briles Aerospace', em: 'sales@brilesaerospace.com' },
  { co: 'VACCO', em: 'purchasing@vacco.com', note: 'Valves.' },
  { co: 'Allfast', em: 'aerospace.sales@trimas.com' },
  { co: 'Aerofit', em: 'Aerofit-Sales@aerofit.com', note: 'Aerospace fittings.' },
  { co: 'LeFiell', em: 'sales@lefiell.com', note: 'Complex aircraft tube/structures.' },
  { co: 'Beyond Precision Manufacturing', em: 'sales@beyond-mfg.com' },
  { co: 'Skurka Aerospace', em: 'sales1@skurka-aero.com' },
  { co: 'MP Aero', em: 'info@mpaero.com', note: 'Valencia.' },
  { co: 'West Coast Aerospace', em: 'sales@westcoastaerospace.com' },
  { co: 'Mason Controls', em: 'mason.sales@masoncontrols.com' },
  { co: 'Frazier Aviation', em: 'info@frazieraviation.com', note: 'San Fernando — local.' },
  { co: 'PTI Technologies', em: 'aerospace@ptitechnologies.com' },
  { co: 'Circle Seal Controls (CIRCOR)', em: 'guillermo.montano@circor.com', note: 'Contact Guillermo Montano.' },
  { co: 'SC Hydraulic Engineering', em: 'chris@schydraulic.com', note: 'Contact Christopher.' },
  { co: 'Dante Valve', em: 'sales@dantevalve.com' },
  { co: 'Jaco Engineering', em: 'info@jacoengineering.com' },
  { co: 'Lamsco West', em: 'sales@lamscowest.com' },
  { co: 'Vast Space', em: 'info@vastspace.com' },
  { co: 'Hydro Fitting', em: 'sales@hydrofitting.com' },
  { co: 'Tamshell', em: 'sales@tamshell.com' },
  { co: '5th Axis', em: 'whsales@5thaxis.com' },
  { co: 'Shur-Lok', em: 'sales@shur-lok.com', note: 'PCC Airframe. Auto-reply asks new vendors to reach a sales rep.' },
  { co: 'Hartwell', em: 'info@hartwellcorp.com', note: 'Contact out of office; follow up next week.' },
  // Already-in-CRM shops that got a fresh personalized email to a better inbox
  { co: 'Neill Aircraft', em: 'estimating@neillaircraft.com', note: 'Emailed the estimating inbox (also hiring a deburr tech).' },
  { co: 'Johnson Manufacturing', em: 'sales@johnsonmfginc.com', note: 'Emailed sales@ (also has Rene Rua in purchasing).' },
  { co: 'Acromil', em: 'info@acromil.com', note: 'Emailed info@ (also hiring a bench deburr machinist).' },
  { co: 'Hydraulics International', em: 'alirezag@hiinet.com', note: 'Followed up a 2025 thread with Ali (Alireza Golbahar). They normally deburr in-house.' },
];

// Past customers he re-opened.
const CHECKIN: Row[] = [
  { co: "Lee's Enterprise", em: 'tom@leesenterprise.com', note: 'REPLIED 2026-07-23 — Tom: "I will keep you in mind for sure, don\'t have anything at this time though." Soft no, door open. Past customer.' },
  { co: 'O&S', em: 'sales@oands.com', note: 'Past customer — previously reviewed + sampled parts. Re-opened 2026-07-23.' },
  { co: 'J&S', em: 'SR@jnsusa.com', note: 'Past customer check-in 2026-07-23.' },
];

// Bounced or dead addresses — flag, do not mark emailed.
const BOUNCED: Row[] = [
  { co: 'Astro-Tek', em: 'info@astro-tek.com', note: 'BOUNCED 2026-07-23 — info@astro-tek.com does not exist. Need a new contact.' },
  { co: 'SoCal Machining', em: 'info@socalmachining.com', note: 'BOUNCED 2026-07-23 — info@socalmachining.com does not exist. Anaheim shop; find a real contact.' },
  { co: 'CEC Vibration Products', em: 'info@cecvp.com', note: 'BOUNCED 2026-07-23 — "message too large" (day-ray.com server). RESEND without the image signature; the address is fine.' },
];

// Auto-replies that carry a real next step.
const ACTION: { match: string; note: string; setPm?: string; setEm?: string; markEmailed?: boolean }[] = [
  { match: 'moseys', note: 'Emailed 2026-07-23. AUTO-REPLY — Ken Lavin no longer at Moseys. Redirect to John Zmuda: Johnz@moseys.com.', setPm: 'John Zmuda', setEm: 'Johnz@moseys.com', markEmailed: true },
  { match: 'rtc aerospace', note: 'BOUNCED 2026-07-23 — chrisbennett@rtcaerospace.com mailbox FULL. Use sales@rtcaerospace.com / GM Jason Keck (818) 407-0291 instead.' },
  { match: 'bandy', note: 'Emailed 2026-07-23. AUTO-REPLY — Bandy acknowledged the request, has a healthy quote backlog. Give it time, then nudge.', markEmailed: true },
];

const norm = (s: string) =>
  (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|llc|corp|corporation|co|company|ltd|the|group)\b/g, '').replace(/\s+/g, ' ').trim();

async function main() {
  const commit = process.argv.includes('--commit');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', TENANT).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const byEmail = (em: string) => all.find((l) => (l.em || '').toLowerCase().trim() === em.toLowerCase().trim());
  // Word-boundary match only: equal, or one is a whole-word PREFIX of the other
  // ("mp aero" ~ "mp aero services"). Plain includes() false-matched
  // "monogram aerospace" to "ram aerospace".
  const byName = (co: string) => {
    const n = norm(co);
    if (n.length < 4) return undefined;
    return all.find((l) => {
      const ln = norm(l.co);
      if (ln.length < 4) return false;
      return ln === n || ln.startsWith(n + ' ') || n.startsWith(ln + ' ');
    });
  };
  const stamp = (l: any, line: string) => (l.notes ? `${l.notes}\n${line}` : line);

  console.log(`MODE: ${commit ? 'COMMIT' : 'DRY-RUN'}\n`);
  let emailed = 0, added = 0, flagged = 0, actioned = 0, checkin = 0;

  const doEmailed = async (r: Row, tag: string, counter: () => void) => {
    const lead = byEmail(r.em) || byName(r.co);
    const line = `[${D}] Emailed — ${tag}.${r.note ? ' ' + r.note : ''}`;
    if (lead) {
      if ((lead.notes || '').includes(line.slice(0, 45))) { console.log(`  = ${lead.co}: already logged`); return; }
      const patch: any = { notes: stamp(lead, line), lastContactedAt: new Date().toISOString(), touchCount: (lead.touchCount || 0) + 1 };
      if (!lead.em?.trim()) patch.em = r.em;
      if (COLDER.has(lead.status)) patch.status = 'emailed';
      console.log(`  ~ ${lead.co} (${lead.status}${patch.status ? '->emailed' : ''})`);
      counter();
      if (commit) await db.collection('leads').doc(lead.id).set(patch, { merge: true });
    } else {
      const id = norm(r.co).replace(/\s+/g, '-') + '-' + Math.random().toString(36).slice(2, 7);
      const doc = { id, tenantId: TENANT, status: 'emailed', t: 2, r: 'Other', co: r.co, city: '', ph: '', em: r.em, web: '', who: '', role: '', pm: '', pm_title: '', parts: '', pitch: 'Overflow hand/microscope deburring', lastContactedAt: new Date().toISOString(), touchCount: 1, notes: line };
      console.log(`  + NEW ${r.co}`);
      added++;
      if (commit) await db.collection('leads').doc(id).set(doc);
    }
  };

  console.log('--- COLD INTROS -> emailed ---');
  for (const r of EMAILED) await doEmailed(r, 'cold intro (your voice)', () => emailed++);

  console.log('\n--- PAST-CUSTOMER CHECK-INS ---');
  for (const r of CHECKIN) await doEmailed(r, 'reconnect (past customer)', () => checkin++);

  console.log('\n--- BOUNCES -> flag ---');
  for (const r of BOUNCED) {
    const lead = byEmail(r.em) || byName(r.co);
    if (lead) {
      if ((lead.notes || '').includes('BOUNCED 2026-07-23')) { console.log(`  = ${lead.co}: already flagged`); continue; }
      console.log(`  ! ${lead.co}: flag bad email`);
      flagged++;
      if (commit) await db.collection('leads').doc(lead.id).set({ notes: stamp(lead, `[${D}] ${r.note}`) }, { merge: true });
    } else {
      const id = norm(r.co).replace(/\s+/g, '-') + '-' + Math.random().toString(36).slice(2, 7);
      console.log(`  +! NEW ${r.co} (bounced email on file)`);
      added++;
      if (commit) await db.collection('leads').doc(id).set({ id, tenantId: TENANT, status: 'new', t: 2, r: 'Other', co: r.co, city: '', ph: '', em: '', web: '', who: '', role: '', pm: '', pm_title: '', parts: '', pitch: '', notes: `[${D}] ${r.note} (tried ${r.em})` });
    }
  }

  console.log('\n--- ACTIONABLE AUTO-REPLIES ---');
  for (const a of ACTION) {
    const lead = all.find((l) => norm(l.co).includes(norm(a.match)));
    if (!lead) { console.log(`  ?? no lead for "${a.match}"`); continue; }
    if ((lead.notes || '').includes(a.note.slice(0, 40))) { console.log(`  = ${lead.co}: already noted`); continue; }
    const patch: any = { notes: stamp(lead, `[${D}] ${a.note}`) };
    if (a.setPm && !lead.pm) patch.pm = a.setPm;
    if (a.setEm) patch.em = a.setEm; // corrected contact — override the bad one
    if (a.markEmailed) {
      patch.touchCount = (lead.touchCount || 0) + 1;
      patch.lastContactedAt = new Date().toISOString();
      if (COLDER.has(lead.status)) patch.status = 'emailed';
    }
    console.log(`  * ${lead.co}: ${a.note.slice(0, 46)}...`);
    actioned++;
    if (commit) await db.collection('leads').doc(lead.id).set(patch, { merge: true });
  }

  console.log(`\n${commit ? 'DONE' : 'PREVIEW'} — emailed:${emailed} checkins:${checkin} newAdded:${added} bouncesFlagged:${flagged} autoReplies:${actioned}`);
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.message || e); process.exit(1); });
