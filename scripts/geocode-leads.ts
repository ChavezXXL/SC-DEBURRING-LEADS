/** Geocode leads to REAL lat/lng via free OpenStreetMap Nominatim, so map pins
 * are the actual shop instead of a city-center blob. Only writes a result that
 * lands within SoCal and near the lead's known city (guards wrong matches);
 * otherwise leaves the lead for the city-centroid fallback — never degrades.
 *
 *   npx tsx scripts/geocode-leads.ts            # dry-run, first 15
 *   npx tsx scripts/geocode-leads.ts --all      # dry-run, all
 *   npx tsx scripts/geocode-leads.ts --all --commit   # write lat/lng
 */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;
const UA = 'SC-Deburring-CRM/1.0 (quotes@scprecisiondeburring.com)';
const CLIENTISH = new Set(['dead', 'research_pending', 'research_rejected']);

// City centroids (mirror of the app) — used for the wrong-match distance guard.
const CITY: Record<string, [number, number]> = {
  anaheim:[33.8366,-117.9143],brea:[33.9167,-117.9001],burbank:[34.1808,-118.309],camarillo:[34.2164,-119.0376],'canoga park':[34.2011,-118.5981],'canyon country':[34.4233,-118.472],cerritos:[33.8583,-118.0648],chatsworth:[34.2572,-118.6012],commerce:[34.0006,-118.1598],compton:[33.8958,-118.2201],'costa mesa':[33.6411,-117.9187],downey:[33.9401,-118.1332],'el segundo':[33.9192,-118.4165],fullerton:[33.8704,-117.9242],gardena:[33.8883,-118.3089],glendale:[34.1425,-118.2551],hawthorne:[33.9164,-118.3526],irvine:[33.6846,-117.8265],lancaster:[34.6868,-118.1542],'long beach':[33.7701,-118.1937],monrovia:[34.1443,-118.0019],moorpark:[34.2856,-118.882],newhall:[34.3864,-118.5301],norwalk:[33.9022,-118.0817],'north hollywood':[34.187,-118.3813],northridge:[34.2381,-118.5301],oxnard:[34.1975,-119.1771],pacoima:[34.2625,-118.427],palmdale:[34.5794,-118.1165],paramount:[33.8895,-118.1598],placentia:[33.8722,-117.8703],'san fernando':[34.2819,-118.439],'san gabriel':[34.0961,-118.1058],'santa ana':[33.7455,-117.8677],'santa clarita':[34.3917,-118.5426],'santa fe springs':[33.9472,-118.0853],saugus:[34.4114,-118.5363],'simi valley':[34.2694,-118.7815],'south el monte':[34.0519,-118.0467],'sun valley':[34.2175,-118.3704],sylmar:[34.3078,-118.4492],'thousand oaks':[34.1706,-118.8376],torrance:[33.8358,-118.3406],valencia:[34.4568,-118.5759],'van nuys':[34.1899,-118.4514],'agoura hills':[34.1533,-118.7615],azusa:[34.1336,-117.9076],bakersfield:[35.3733,-119.0187],'buena park':[33.8675,-117.9981],carlsbad:[33.1581,-117.3506],carson:[33.8317,-118.282],chino:[34.0122,-117.6889],'chino hills':[33.9898,-117.7326],'city of industry':[34.0197,-117.9587],corona:[33.8753,-117.5664],covina:[34.09,-117.8903],'el cajon':[32.7948,-116.9625],escondido:[33.1192,-117.0864],fontana:[34.0922,-117.435],'garden grove':[33.7739,-117.9414],glendora:[34.1361,-117.8653],goleta:[34.4358,-119.8276],'harbor city':[33.7906,-118.2967],'huntington beach':[33.6595,-117.9988],irwindale:[34.107,-117.9351],'la mirada':[33.9172,-118.012],'los angeles':[34.0522,-118.2437],'moreno valley':[33.9425,-117.2297],murrieta:[33.5539,-117.2139],'national city':[32.6781,-117.0992],'newbury park':[34.1836,-118.9137],oceanside:[33.1959,-117.3795],ontario:[34.0633,-117.6509],orange:[33.7879,-117.8531],pasadena:[34.1478,-118.1445],pomona:[34.0551,-117.7523],poway:[32.9628,-117.0359],'rancho cucamonga':[34.1064,-117.5931],riverside:[33.9806,-117.3755],'san bernardino':[34.1083,-117.2898],'san diego':[32.7157,-117.1611],'san marcos':[33.1434,-117.1661],'santa barbara':[34.4208,-119.6982],temecula:[33.4936,-117.1484],tustin:[33.7458,-117.8261],ventura:[34.2746,-119.229],vista:[33.2,-117.2425],whittier:[33.9792,-118.0328],
};
const norm = (c: string) => (c || '').toLowerCase().replace(/,?\s+ca(?:lifornia)?(?:\s+\d{5})?$/i, '').trim();
const miles = (a: [number, number], b: [number, number]) => {
  const R = 3958.8, dLat = ((b[0]-a[0])*Math.PI)/180, dLng = ((b[1]-a[1])*Math.PI)/180;
  const h = Math.sin(dLat/2)**2 + Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geocode(q: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&addressdetails=1&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const j: any = await r.json();
  if (!Array.isArray(j) || !j.length) return null;
  return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon), label: j[0].display_name };
}

async function main() {
  const commit = process.argv.includes('--commit');
  const all = process.argv.includes('--all');
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  let leads = raw.filter((l) => !CLIENTISH.has(l.status) && !(typeof l.lat === 'number' && typeof l.lng === 'number') && (l.co || l.address));
  if (!all) leads = leads.slice(0, 15);

  console.log(`MODE: ${commit ? 'COMMIT (writing lat/lng)' : 'DRY-RUN (no writes)'} | candidates: ${leads.length}\n`);
  let hit = 0, rejected = 0, miss = 0;
  for (const l of leads) {
    const q = l.address?.trim() ? `${l.address}, ${l.city || ''} CA` : `${l.co}, ${l.city || ''}, CA, USA`;
    let res: { lat: number; lng: number; label: string } | null = null;
    try { res = await geocode(q); } catch { res = null; }
    await sleep(1100); // Nominatim: max ~1 req/sec

    const centroid = CITY[norm(l.city)];
    const inSoCal = res && res.lat > 32.4 && res.lat < 35.6 && res.lng > -120.6 && res.lng < -116.0;
    const nearCity = res && (!centroid || miles([res.lat, res.lng], centroid) <= 18);

    if (res && inSoCal && nearCity) {
      hit++;
      const d = centroid ? miles([res.lat, res.lng], centroid).toFixed(1) + 'mi from center' : 'no centroid';
      console.log(`✅ ${l.co} (${l.city}) -> ${res.lat.toFixed(4)},${res.lng.toFixed(4)} [${d}]`);
      if (commit) await db.collection('leads').doc(l.id).set({ lat: res.lat, lng: res.lng }, { merge: true });
    } else if (res) {
      rejected++;
      console.log(`⚠️  ${l.co} (${l.city}) -> rejected (${inSoCal ? 'far from city' : 'outside SoCal'}): ${res.label.slice(0, 60)}`);
    } else {
      miss++;
      console.log(`—  ${l.co} (${l.city}) -> no match`);
    }
  }
  console.log(`\nEXACT: ${hit} | rejected: ${rejected} | no-match: ${miss} | (rest keep city-centroid pin)`);
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.message || e); process.exit(1); });
