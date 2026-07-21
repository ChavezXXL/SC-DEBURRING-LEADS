/** Diagnose Field Route map coverage: how many active leads actually get a pin,
 * and which cities/regions are unmapped (so we know what to add). Read-only. */
import { existsSync } from 'fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = String.raw`C:\Users\scpre\SC LEADS PP\serviceAccount.json`;

const CITY_KEYS = new Set(['anaheim','brea','burbank','camarillo','canoga park','canyon country','cerritos','chatsworth','commerce','compton','costa mesa','downey','el segundo','fullerton','gardena','glendale','hawthorne','irvine','lancaster','long beach','monrovia','moorpark','newhall','norwalk','north hollywood','northridge','oxnard','pacoima','palmdale','paramount','placentia','san fernando','san gabriel','santa ana','santa clarita','santa fe springs','saugus','simi valley','south el monte','sun valley','sylmar','thousand oaks','torrance','valencia','van nuys','agoura hills','azusa','bakersfield','buena park','carlsbad','carson','chino','chino hills','city of industry','corona','covina','el cajon','escondido','fontana','garden grove','glendora','goleta','harbor city','huntington beach','irwindale','la mirada','los angeles','moreno valley','murrieta','national city','newbury park','oceanside','ontario','orange','pasadena','pomona','poway','rancho cucamonga','riverside','san bernardino','san diego','san marcos','santa barbara','temecula','tustin','ventura','vista','whittier']);
const REGION_KEYS = new Set(['Sun Valley / Pacoima','San Fernando Valley','Glendale / Burbank','South LA / Commerce','Gardena / South Bay','Long Beach / Paramount','Santa Fe Springs','Santa Clarita / Valencia','Simi Valley','Moorpark / Ventura','Oxnard','Brea / OC','San Gabriel Valley / Chino','Antelope Valley','Orange County','Los Angeles Central','Inland Empire','San Diego','Santa Barbara','South Bay']);
const REGION_ALIAS: Record<string, string> = { IE:'Inland Empire','Inland empire':'Inland Empire', SD:'San Diego','San diego':'San Diego', LA:'Los Angeles Central','Los Angeles':'Los Angeles Central', SoCal:'Los Angeles Central', OC:'Orange County', SGV:'San Gabriel Valley / Chino' };
const CLIENTISH = new Set(['dead','research_pending','research_rejected']);
const regionOk = (r: string) => REGION_KEYS.has(r) || REGION_KEYS.has(REGION_ALIAS[r] || '');

const norm = (c: string) => (c || '').toLowerCase().replace(/,?\s+ca(?:lifornia)?(?:\s+\d{5})?$/i, '').trim();

async function main() {
  if (!getApps().length) initializeApp({ credential: existsSync(KEY) ? cert(KEY) : applicationDefault(), projectId: 'sc-deburring-leads' });
  const db = getFirestore();
  const snap = await db.collection('leads').where('tenantId', '==', 'sc-deburring').get();
  const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const leads: any[] = raw.filter((l) => !CLIENTISH.has(l.status));

  let exact = 0, viaCity = 0, viaRegion = 0, unmapped = 0;
  const missCities = new Map<string, number>();
  const missRegions = new Map<string, number>();
  const haveAddr = leads.filter((l) => l.address?.trim()).length;

  for (const l of leads) {
    if (typeof l.lat === 'number' && typeof l.lng === 'number') { exact++; continue; }
    if (CITY_KEYS.has(norm(l.city))) { viaCity++; continue; }
    if (regionOk(l.r)) { viaRegion++; continue; }
    unmapped++;
    const ck = norm(l.city) || '(blank city)';
    missCities.set(ck, (missCities.get(ck) || 0) + 1);
    missRegions.set(l.r || '(blank region)', (missRegions.get(l.r || '(blank region)') || 0) + 1);
  }

  console.log('=== MAP COVERAGE (active leads) ===');
  console.log('  total active:', leads.length);
  console.log('  exact lat/lng     :', exact);
  console.log('  mapped via city   :', viaCity);
  console.log('  mapped via region :', viaRegion);
  console.log('  UNMAPPED (no pin) :', unmapped, `(${Math.round((unmapped/leads.length)*100)}%)`);
  console.log('  have a street address:', haveAddr, '(could be geocoded to an exact pin)');

  console.log('\n=== UNMAPPED CITIES (add these to CITY_COORDS) ===');
  [...missCities.entries()].sort((a,b)=>b[1]-a[1]).forEach(([c,n]) => console.log(`  ${String(n).padStart(3)}  ${c}`));
  console.log('\n=== their regions (for REGION_COORDS fallback) ===');
  [...missRegions.entries()].sort((a,b)=>b[1]-a[1]).forEach(([r,n]) => console.log(`  ${String(n).padStart(3)}  ${r}`));
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.message || e); process.exit(1); });
