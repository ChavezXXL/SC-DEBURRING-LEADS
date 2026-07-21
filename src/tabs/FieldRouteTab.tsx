import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Check,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Pencil,
  Route,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { Lead, VisitOutcome } from '../types';
import { getLeadScore, type LeadScore } from '../utils/leadScore';
import { isClientLead } from '../utils/leadActivity';
import { RouteMap, type MapPoint } from './RouteMap';

const SHOP_ADDRESS = '12734 Branford St, Pacoima, CA 91331';
const SHOP_COORDS: [number, number] = [34.2625, -118.427];
const MAX_ROUTE_STOPS = 8;
/** Stable identity so the map's rebuild effect doesn't fire on every render. */
const MAP_SHOP = { coords: SHOP_COORDS, label: 'SC Deburring' };

type Coords = [number, number];
type ViewMode = 'prospects' | 'clients' | 'all';

const VISIT_OUTCOMES: VisitOutcome[] = [
  'Met buyer',
  'Left capability packet',
  'Asked to return',
  'No access',
  'Not a fit',
];

const CITY_COORDS: Record<string, Coords> = {
  anaheim: [33.8366, -117.9143],
  brea: [33.9167, -117.9001],
  burbank: [34.1808, -118.309],
  camarillo: [34.2164, -119.0376],
  'canoga park': [34.2011, -118.5981],
  'canyon country': [34.4233, -118.472],
  cerritos: [33.8583, -118.0648],
  chatsworth: [34.2572, -118.6012],
  commerce: [34.0006, -118.1598],
  compton: [33.8958, -118.2201],
  'costa mesa': [33.6411, -117.9187],
  downey: [33.9401, -118.1332],
  'el segundo': [33.9192, -118.4165],
  fullerton: [33.8704, -117.9242],
  gardena: [33.8883, -118.3089],
  glendale: [34.1425, -118.2551],
  hawthorne: [33.9164, -118.3526],
  irvine: [33.6846, -117.8265],
  lancaster: [34.6868, -118.1542],
  'long beach': [33.7701, -118.1937],
  monrovia: [34.1443, -118.0019],
  moorpark: [34.2856, -118.882],
  newhall: [34.3864, -118.5301],
  norwalk: [33.9022, -118.0817],
  'north hollywood': [34.187, -118.3813],
  northridge: [34.2381, -118.5301],
  oxnard: [34.1975, -119.1771],
  pacoima: SHOP_COORDS,
  palmdale: [34.5794, -118.1165],
  paramount: [33.8895, -118.1598],
  placentia: [33.8722, -117.8703],
  'san fernando': [34.2819, -118.439],
  'san gabriel': [34.0961, -118.1058],
  'santa ana': [33.7455, -117.8677],
  'santa clarita': [34.3917, -118.5426],
  'santa fe springs': [33.9472, -118.0853],
  saugus: [34.4114, -118.5363],
  'simi valley': [34.2694, -118.7815],
  'south el monte': [34.0519, -118.0467],
  'sun valley': [34.2175, -118.3704],
  sylmar: [34.3078, -118.4492],
  'thousand oaks': [34.1706, -118.8376],
  torrance: [33.8358, -118.3406],
  valencia: [34.4568, -118.5759],
  'van nuys': [34.1899, -118.4514],
  // Wider SoCal coverage — these cities appear in the CRM but were dropping off
  // the map (no pin) because they weren't listed. Inland Empire, San Diego,
  // Ventura county, and the LA/OC gaps.
  'agoura hills': [34.1533, -118.7615],
  azusa: [34.1336, -117.9076],
  bakersfield: [35.3733, -119.0187],
  'buena park': [33.8675, -117.9981],
  carlsbad: [33.1581, -117.3506],
  carson: [33.8317, -118.282],
  chino: [34.0122, -117.6889],
  'chino hills': [33.9898, -117.7326],
  'city of industry': [34.0197, -117.9587],
  corona: [33.8753, -117.5664],
  covina: [34.09, -117.8903],
  'el cajon': [32.7948, -116.9625],
  escondido: [33.1192, -117.0864],
  fontana: [34.0922, -117.435],
  'garden grove': [33.7739, -117.9414],
  glendora: [34.1361, -117.8653],
  goleta: [34.4358, -119.8276],
  'harbor city': [33.7906, -118.2967],
  'huntington beach': [33.6595, -117.9988],
  irwindale: [34.107, -117.9351],
  'la mirada': [33.9172, -118.012],
  'los angeles': [34.0522, -118.2437],
  'moreno valley': [33.9425, -117.2297],
  murrieta: [33.5539, -117.2139],
  'national city': [32.6781, -117.0992],
  'newbury park': [34.1836, -118.9137],
  oceanside: [33.1959, -117.3795],
  ontario: [34.0633, -117.6509],
  orange: [33.7879, -117.8531],
  pasadena: [34.1478, -118.1445],
  pomona: [34.0551, -117.7523],
  poway: [32.9628, -117.0359],
  'rancho cucamonga': [34.1064, -117.5931],
  riverside: [33.9806, -117.3755],
  'san bernardino': [34.1083, -117.2898],
  'san diego': [32.7157, -117.1611],
  'san marcos': [33.1434, -117.1661],
  'santa barbara': [34.4208, -119.6982],
  temecula: [33.4936, -117.1484],
  tustin: [33.7458, -117.8261],
  ventura: [34.2746, -119.229],
  vista: [33.2, -117.2425],
  whittier: [33.9792, -118.0328],
};

const REGION_COORDS: Record<string, Coords> = {
  'Sun Valley / Pacoima': SHOP_COORDS,
  'San Fernando Valley': [34.238, -118.53],
  'Glendale / Burbank': [34.169, -118.282],
  'South LA / Commerce': [34.001, -118.16],
  'Gardena / South Bay': [33.87, -118.33],
  'Long Beach / Paramount': [33.83, -118.18],
  'Santa Fe Springs': [33.9472, -118.0853],
  'Santa Clarita / Valencia': [34.424, -118.559],
  'Simi Valley': [34.2694, -118.7815],
  'Moorpark / Ventura': [34.27, -118.95],
  Oxnard: [34.1975, -119.1771],
  'Brea / OC': [33.89, -117.9],
  'San Gabriel Valley / Chino': [34.05, -117.98],
  'Antelope Valley': [34.63, -118.135],
  'Orange County': [33.72, -117.84],
  'Los Angeles Central': [34.0522, -118.2437],
  'Inland Empire': [34.05, -117.5],
  'San Diego': [32.7157, -117.1611],
  'Santa Barbara': [34.4208, -119.6982],
  'South Bay': [33.87, -118.33],
};

/** Region strings vary in the CRM (abbreviations, casing). Map the common
 * variants onto a canonical REGION_COORDS key so a lead still gets a pin. */
const REGION_ALIAS: Record<string, string> = {
  IE: 'Inland Empire',
  'Inland empire': 'Inland Empire',
  SD: 'San Diego',
  'San diego': 'San Diego',
  LA: 'Los Angeles Central',
  'Los Angeles': 'Los Angeles Central',
  SoCal: 'Los Angeles Central',
  OC: 'Orange County',
  SGV: 'San Gabriel Valley / Chino',
};

function normalizeCity(city: string): string {
  return city
    .toLowerCase()
    .replace(/,?\s+ca(?:lifornia)?(?:\s+\d{5})?$/i, '')
    .trim();
}

function coordsForLead(lead: Lead): Coords | null {
  if (typeof lead.lat === 'number' && typeof lead.lng === 'number') {
    return [lead.lat, lead.lng];
  }
  const cityHit = CITY_COORDS[normalizeCity(lead.city)];
  if (cityHit) return cityHit;
  const region = REGION_COORDS[lead.r] ?? REGION_COORDS[REGION_ALIAS[lead.r] ?? ''];
  return region ?? null;
}

function milesBetween(a: Coords, b: Coords): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthMiles = 3958.8;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthMiles * Math.asin(Math.sqrt(h));
}

function distanceFromShop(lead: Lead): number {
  const coords = coordsForLead(lead);
  return coords ? milesBetween(SHOP_COORDS, coords) : Number.POSITIVE_INFINITY;
}

function leadDestination(lead: Lead): string {
  return lead.address?.trim() || `${lead.co}, ${lead.city}, CA`;
}

/** Turn a lead into a map pin, or null when we can't place it anywhere. */
function leadToPoint(lead: Lead): MapPoint | null {
  const coords = coordsForLead(lead);
  if (!coords) return null;
  return {
    id: lead.id,
    coords,
    label: lead.co,
    city: lead.city,
    tier: lead.t,
    exact: typeof lead.lat === 'number' && typeof lead.lng === 'number',
  };
}

function optimizeStops(stops: Lead[]): Lead[] {
  const remaining = [...stops];
  const ordered: Lead[] = [];
  let current = SHOP_COORDS;

  while (remaining.length) {
    remaining.sort((a, b) => {
      const aCoords = coordsForLead(a);
      const bCoords = coordsForLead(b);
      const aDistance = aCoords ? milesBetween(current, aCoords) : Number.POSITIVE_INFINITY;
      const bDistance = bCoords ? milesBetween(current, bCoords) : Number.POSITIVE_INFINITY;
      if (aDistance !== bDistance) return aDistance - bDistance;
      if (a.t !== b.t) return a.t - b.t;
      return a.co.localeCompare(b.co);
    });
    const next = remaining.shift()!;
    ordered.push(next);
    current = coordsForLead(next) ?? current;
  }

  return ordered;
}

function loadRouteIds(key: string): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

interface FieldRouteTabProps {
  leads: Lead[];
  /** Active tenant id — scopes the saved route so a workspace switch neither
   * wipes it nor leaks one tenant's route into another. */
  workspaceKey?: string;
  onLeadClick: (id: string) => void;
  onUpdateAddress: (id: string, address: string) => Promise<void>;
  onLogVisit: (lead: Lead, outcome: VisitOutcome) => Promise<void>;
}

export function FieldRouteTab({
  leads,
  workspaceKey,
  onLeadClick,
  onUpdateAddress,
  onLogVisit,
}: FieldRouteTabProps) {
  const [area, setArea] = useState('All Regions');
  const [viewMode, setViewMode] = useState<ViewMode>('prospects');
  const [search, setSearch] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  // The planned route survives a reload/app switch — field days are long.
  const storageKey = `sc_field_route_ids:${workspaceKey || 'default'}`;
  const [routeIds, setRouteIds] = useState<string[]>(() => loadRouteIds(storageKey));
  const storageKeyRef = useRef(storageKey);
  const [notice, setNotice] = useState('');
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState('');
  const [loggingVisitId, setLoggingVisitId] = useState<string | null>(null);

  // Opportunity scores are regex-heavy; compute once per leads snapshot instead
  // of inside sort comparators (which would re-score on every comparison).
  const scoreById = useMemo(() => {
    const m = new Map<string, LeadScore>();
    leads.forEach((lead) => m.set(lead.id, getLeadScore(lead)));
    return m;
  }, [leads]);
  const scoreOf = (lead: Lead): LeadScore => scoreById.get(lead.id) ?? getLeadScore(lead);

  const regions = useMemo(() => {
    const counts = new Map<string, number>();
    leads.forEach((lead) => counts.set(lead.r || 'Other', (counts.get(lead.r || 'Other') || 0) + 1));
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [leads]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return leads
      .filter((lead) => {
        if (lead.status === 'dead') return false;
        // Anchor accounts ARE clients — never show them as cold prospects.
        const isClient = isClientLead(lead);
        if (viewMode === 'prospects' && isClient) return false;
        if (viewMode === 'clients' && !isClient) return false;
        if (area !== 'All Regions' && lead.r !== area) return false;
        if (!needle) return true;
        return [lead.co, lead.city, lead.address, lead.r, lead.pm]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        // Best opportunity first, then nearest to the shop, then name.
        const scoreDifference = scoreOf(b).score - scoreOf(a).score;
        if (scoreDifference !== 0) return scoreDifference;
        const da = distanceFromShop(a);
        const db = distanceFromShop(b);
        // Un-placeable leads (Infinity) sort last, not by name above nearer ones.
        if (da !== db) {
          return (Number.isFinite(da) ? da : Infinity) - (Number.isFinite(db) ? db : Infinity);
        }
        return a.co.localeCompare(b.co);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, leads, scoreById, search, viewMode]);

  const cityClusters = useMemo(() => {
    const grouped = new Map<string, Lead[]>();
    filtered.forEach((lead) => {
      const city = lead.city || 'Unknown city';
      grouped.set(city, [...(grouped.get(city) || []), lead]);
    });
    return [...grouped.entries()].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
    );
  }, [filtered]);

  const routeLeads = useMemo(
    () =>
      routeIds
        .map((id) => leads.find((lead) => lead.id === id))
        // A stop marked dead from any other tab (Pipeline drag, Leads card)
        // must leave the route too, not just the in-tab "Not a fit" flow.
        .filter((lead): lead is Lead => !!lead && lead.status !== 'dead'),
    [leads, routeIds],
  );

  const mapPoints = useMemo(
    () => filtered.map(leadToPoint).filter(Boolean) as MapPoint[],
    [filtered],
  );
  const routeStops = useMemo(
    () =>
      routeLeads
        // Number by position in the full route so the map's pin numbers stay in
        // step with the sidebar and the Google Maps URL, even if a stop can't be
        // geocoded and is dropped from the map.
        .map((lead, i) => {
          const point = leadToPoint(lead);
          return point ? { ...point, stopNo: i + 1 } : null;
        })
        .filter(Boolean) as MapPoint[],
    [routeLeads],
  );

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? filtered[0] ?? null;

  // Reload the saved route when the workspace changes. Declared BEFORE the
  // persist effect so the new tenant's stored route is read before any write.
  useEffect(() => {
    if (storageKeyRef.current === storageKey) return;
    storageKeyRef.current = storageKey;
    setRouteIds(loadRouteIds(storageKey));
  }, [storageKey]);

  useEffect(() => {
    // Don't prune while leads are still loading — that would wipe the
    // localStorage-restored route before Firestore delivers the first snapshot.
    if (!leads.length) return;
    setRouteIds((ids) =>
      ids.filter((id) => {
        const lead = leads.find((l) => l.id === id);
        return !!lead && lead.status !== 'dead';
      }),
    );
  }, [leads]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(routeIds));
    } catch {}
  }, [routeIds, storageKey]);

  useEffect(() => {
    if (!selectedLeadId && filtered[0]) setSelectedLeadId(filtered[0].id);
  }, [filtered, selectedLeadId]);

  const routeUrl = useMemo(() => {
    if (!routeLeads.length) return '';
    const ordered = routeLeads.map(leadDestination);
    const params = new URLSearchParams({
      api: '1',
      origin: SHOP_ADDRESS,
      destination: ordered[ordered.length - 1],
      travelmode: 'driving',
    });
    if (ordered.length > 1) params.set('waypoints', ordered.slice(0, -1).join('|'));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [routeLeads]);

  const mapQuery = selectedLead ? leadDestination(selectedLead) : SHOP_ADDRESS;

  const setOptimizedRoute = (stops: Lead[]) => {
    const ordered = optimizeStops(stops.slice(0, MAX_ROUTE_STOPS));
    setRouteIds(ordered.map((lead) => lead.id));
    setNotice(
      stops.length > MAX_ROUTE_STOPS
        ? `Routes are capped at ${MAX_ROUTE_STOPS} stops here. The closest priorities were used.`
        : 'Route ordered from the Pacoima shop to the nearest next stop.',
    );
  };

  const toggleStop = (lead: Lead) => {
    if (routeIds.includes(lead.id)) {
      setRouteIds((ids) => ids.filter((id) => id !== lead.id));
      setNotice('');
      return;
    }
    if (routeIds.length >= MAX_ROUTE_STOPS) {
      setNotice(`Keep each field run to ${MAX_ROUTE_STOPS} stops. Start a second route for the rest.`);
      return;
    }
    setOptimizedRoute([...routeLeads, lead]);
  };

  const buildPriorityRoute = () => {
    const priorities = [...filtered]
      .sort(
        (a, b) =>
          scoreOf(b).score - scoreOf(a).score || a.t - b.t || a.co.localeCompare(b.co),
      )
      .slice(0, 6);
    if (!priorities.length) {
      setNotice('No companies match this area and filter yet.');
      return;
    }
    setOptimizedRoute(priorities);
  };

  const moveStop = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= routeIds.length) return;
    setRouteIds((ids) => {
      const copy = [...ids];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
    setNotice('Manual stop order saved for this route.');
  };

  const startAddressEdit = (lead: Lead) => {
    setEditingAddressId(lead.id);
    setAddressDraft(lead.address || '');
  };

  // Both writes are OPTIMISTIC: feedback lands immediately and the Firestore
  // write runs behind it. Awaiting first would wedge the whole flow in the
  // field-tab's core scenario — standing in a shop with no signal, where a
  // Firestore promise simply never settles. Latency compensation shows the
  // change locally either way; a real failure surfaces as an error notice.
  const saveAddress = (lead: Lead) => {
    const address = addressDraft.trim();
    if (!address) return;
    setEditingAddressId(null);
    setNotice(`Exact address saved for ${lead.co}.`);
    onUpdateAddress(lead.id, address).catch(() => {
      setNotice(`Could not save the address for ${lead.co} — check the connection and try again.`);
    });
  };

  const logVisitOutcome = (lead: Lead, outcome: VisitOutcome) => {
    setLoggingVisitId(null);
    if (outcome === 'Not a fit') {
      setNotice(`${lead.co} was moved out of active prospecting.`);
      setRouteIds((ids) => ids.filter((id) => id !== lead.id));
    } else {
      setNotice(`${outcome} logged for ${lead.co}. Follow-up was added automatically.`);
    }
    onLogVisit(lead, outcome).catch(() => {
      setNotice(`Could not save the visit for ${lead.co} — check the connection and log it again.`);
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300 ring-1 ring-orange-500/30">
            <Route size={13} /> Field sales
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">Field Route</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            See every company on the live map, group the nearby ones, and order the day the smart way. Hand the finished route to Google Maps only when you're ready to drive.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={buildPriorityRoute}
            className="inline-flex items-center gap-2 rounded-xl bg-apex-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-950/40 transition hover:brightness-110"
          >
            <Sparkles size={16} /> Build priority route
          </button>
          <a
            href={routeUrl || undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!routeUrl}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 transition ${
              routeUrl
                ? 'bg-white/5 text-slate-100 ring-white/15 hover:bg-white/10'
                : 'pointer-events-none bg-white/[0.03] text-slate-600 ring-white/5'
            }`}
          >
            <Navigation size={16} /> Open route in Google Maps
          </a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="In this view" value={filtered.length} detail="companies" />
        <Metric
          label="Priority"
          value={filtered.filter((lead) => lead.t === 1).length}
          detail="Tier 1 stops"
          valueClass="text-orange-300"
        />
        <Metric
          label="Today's route"
          value={routeLeads.length}
          detail={`of ${MAX_ROUTE_STOPS} stops`}
          valueClass="text-emerald-300"
        />
      </div>

      <div className="rounded-2xl bg-apex-850 p-4 ring-1 ring-white/10 md:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_260px_320px]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search company, city, address, or contact"
              className="w-full rounded-xl border border-white/10 bg-apex-800 py-3 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-apex-accent/60 focus:outline-none"
            />
          </label>
          <select
            value={area}
            onChange={(event) => {
              setArea(event.target.value);
              setSearch('');
            }}
            className="rounded-xl border border-white/10 bg-apex-800 px-3 py-3 text-sm text-slate-100 focus:border-apex-accent/60 focus:outline-none"
          >
            <option>All Regions</option>
            {regions.map(([region, count]) => (
              <option key={region} value={region}>{region} ({count})</option>
            ))}
          </select>
          <div className="grid grid-cols-3 rounded-xl bg-apex-800 p-1 ring-1 ring-white/10">
            {(['prospects', 'clients', 'all'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded-lg px-2 py-2 text-xs font-semibold capitalize transition ${
                  viewMode === mode ? 'bg-white/10 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {cityClusters.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Nearby clusters</span>
            {cityClusters.slice(0, 7).map(([city, companies]) => (
              <button
                key={city}
                onClick={() => setSearch(city)}
                className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
              >
                {city} <span className="ml-1 text-orange-300">{companies.length}</span>
              </button>
            ))}
            {(search || area !== 'All Regions') && (
              <button
                onClick={() => {
                  setSearch('');
                  setArea('All Regions');
                }}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-slate-500 hover:text-slate-200"
              >
                <X size={12} /> Reset
              </button>
            )}
          </div>
        )}
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-500/25">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl bg-apex-850 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200">{selectedLead?.co || 'SC Deburring'}</div>
                <div className="truncate text-[10px] text-slate-500">{mapQuery}</div>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200"
              >
                Full map <ExternalLink size={13} />
              </a>
            </div>
            <RouteMap
              shop={MAP_SHOP}
              points={mapPoints}
              route={routeStops}
              selectedId={selectedLead?.id ?? null}
              onSelect={setSelectedLeadId}
              className="h-[380px] w-full md:h-[480px]"
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/10 px-4 py-2.5 text-[10px] text-slate-400">
              <LegendDot color="#10b981" label="Shop" />
              <LegendDot color="#f97316" label="Priority prospect" />
              <LegendDot color="#3b82f6" label="Tier 2" />
              <span className="inline-flex items-center gap-1.5">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-orange-500 text-[8px] font-bold text-black">1</span>
                Route stop
              </span>
              {filtered.length - mapPoints.length > 0 ? (
                <span
                  className="ml-auto inline-flex items-center gap-1.5 text-amber-400/90"
                  title="These companies have no recognizable city or street address yet. Open one and add its city or address to drop it on the map."
                >
                  <MapPin size={11} /> {filtered.length - mapPoints.length} not on map — add a city/address
                </span>
              ) : (
                <span className="ml-auto text-slate-600">Tap a pin to preview · scroll to zoom off</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-apex-850 p-4 ring-1 ring-white/10">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Companies in this area</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">Best opportunities first. Preview a company, then add it to the day.</p>
              </div>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-slate-400 ring-1 ring-white/10">{filtered.length}</span>
            </div>

            <div className="max-h-[660px] space-y-2 overflow-y-auto pr-1">
              {filtered.map((lead) => {
                const inRoute = routeIds.includes(lead.id);
                const distance = distanceFromShop(lead);
                const editing = editingAddressId === lead.id;
                const opportunity = scoreOf(lead);
                return (
                  <div
                    key={lead.id}
                    className={`rounded-xl border p-3 transition ${
                      selectedLead?.id === lead.id
                        ? 'border-orange-500/40 bg-orange-500/[0.06]'
                        : 'border-white/10 bg-apex-800 hover:border-white/20'
                    }`}
                  >
                    <div className="flex gap-3">
                      <button onClick={() => setSelectedLeadId(lead.id)} className="min-w-0 flex-1 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-100">{lead.co}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${lead.t === 1 ? 'bg-orange-500/15 text-orange-300' : 'bg-blue-500/15 text-blue-300'}`}>T{lead.t}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${opportunity.score >= 75 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>{opportunity.score}</span>
                          <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] uppercase text-slate-400">{lead.status}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1"><MapPin size={11} /> {lead.city}</span>
                          {Number.isFinite(distance) && <span>{distance.toFixed(1)} mi from shop</span>}
                          {lead.pm && <span>{lead.pm}</span>}
                        </div>
                        <div className="mt-1.5 truncate text-[10px] font-medium text-orange-300/90">
                          Next: {opportunity.nextAction}
                        </div>
                      </button>
                      <button
                        onClick={() => toggleStop(lead)}
                        className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 transition ${
                          inRoute
                            ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
                            : 'bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10'
                        }`}
                      >
                        {inRoute ? <Check size={13} /> : <Navigation size={13} />}
                        {inRoute ? 'Added' : 'Add'}
                      </button>
                    </div>

                    {editing ? (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          autoFocus
                          value={addressDraft}
                          onChange={(event) => setAddressDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') saveAddress(lead);
                            if (event.key === 'Escape') setEditingAddressId(null);
                          }}
                          placeholder="Full street address"
                          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-apex-900 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-apex-accent/60 focus:outline-none"
                        />
                        <button
                          onClick={() => saveAddress(lead)}
                          disabled={!addressDraft.trim()}
                          className="rounded-lg bg-apex-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Save address
                        </button>
                        <button onClick={() => setEditingAddressId(null)} className="rounded-lg px-2 py-2 text-xs text-slate-500 hover:text-slate-200">Cancel</button>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/5 pt-2">
                        <span className={`truncate text-[10px] ${lead.address ? 'text-slate-400' : 'text-amber-400/80'}`}>
                          {lead.address || 'City-level route — add the exact street address'}
                        </span>
                        <button
                          onClick={() => startAddressEdit(lead)}
                          className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-sky-300 hover:text-sky-200"
                        >
                          <Pencil size={10} /> {lead.address ? 'Edit' : 'Add address'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {!filtered.length && (
                <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
                  <Building2 className="mx-auto mb-3 text-slate-600" size={28} />
                  <div className="text-sm font-semibold text-slate-300">No companies found</div>
                  <div className="mt-1 text-xs text-slate-500">Change the area, search, or prospect filter.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <div className="rounded-2xl bg-apex-850 p-4 ring-1 ring-white/10 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Navigation size={16} className="text-orange-300" /> Today's stops</div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Starts in Pacoima. Auto-order, then move anything manually. Log each visit as you go.</p>
              </div>
              {routeLeads.length > 0 && (
                <button onClick={() => { setRouteIds([]); setNotice(''); }} className="text-[10px] font-semibold text-slate-500 hover:text-red-300">Clear</button>
              )}
            </div>

            <div className="mt-4 rounded-xl bg-apex-800 p-3 ring-1 ring-white/10">
              <div className="flex items-start gap-2">
                <LocateFixed className="mt-0.5 shrink-0 text-emerald-300" size={14} />
                <div>
                  <div className="text-xs font-semibold text-slate-200">Start — SC Deburring</div>
                  <div className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{SHOP_ADDRESS}</div>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {routeLeads.map((lead, index) => {
                const opportunity = scoreOf(lead);
                const logging = loggingVisitId === lead.id;
                return (
                  <div key={lead.id} className="rounded-xl bg-apex-800 p-3 ring-1 ring-white/10">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-[10px] font-bold text-orange-300 ring-1 ring-orange-500/30">{index + 1}</div>
                      <button onClick={() => setSelectedLeadId(lead.id)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-1.5">
                          <div className="truncate text-xs font-semibold text-slate-200">{lead.co}</div>
                          <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">{opportunity.score}</span>
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-slate-500">{lead.address || `${lead.city} — address not verified`}</div>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button onClick={() => moveStop(index, -1)} disabled={index === 0} aria-label="Move stop up" className="rounded p-1 text-slate-500 hover:bg-white/5 hover:text-slate-200 disabled:opacity-20"><ArrowUp size={13} /></button>
                        <button onClick={() => moveStop(index, 1)} disabled={index === routeLeads.length - 1} aria-label="Move stop down" className="rounded p-1 text-slate-500 hover:bg-white/5 hover:text-slate-200 disabled:opacity-20"><ArrowDown size={13} /></button>
                        <button onClick={() => toggleStop(lead)} aria-label="Remove stop" className="rounded p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-300"><X size={13} /></button>
                      </div>
                    </div>

                    <button
                      onClick={() => setLoggingVisitId(logging ? null : lead.id)}
                      className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-violet-300 hover:text-violet-200"
                    >
                      <Check size={11} /> {logging ? 'Cancel visit log' : 'Log visit outcome'}
                    </button>

                    {logging && (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/5 pt-2">
                        {VISIT_OUTCOMES.map((outcome) => (
                          <button
                            key={outcome}
                            onClick={() => logVisitOutcome(lead, outcome)}
                            className={`rounded-lg px-2 py-1.5 text-[10px] font-semibold ring-1 transition ${
                              outcome === 'Not a fit'
                                ? 'bg-red-500/10 text-red-300 ring-red-500/25 hover:bg-red-500/20'
                                : 'bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10'
                            }`}
                          >
                            {outcome}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {!routeLeads.length && (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
                  <Route className="mx-auto mb-2 text-slate-600" size={24} />
                  <div className="text-xs font-semibold text-slate-400">No stops selected</div>
                  <div className="mt-1 text-[10px] leading-relaxed text-slate-600">Choose a region and build a priority route, or add companies one by one.</div>
                </div>
              )}
            </div>

            {routeLeads.length > 1 && (
              <button
                onClick={() => setOptimizedRoute(routeLeads)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-xs font-semibold text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10"
              >
                <Sparkles size={14} /> Re-optimize stop order
              </button>
            )}

            <a
              href={routeUrl || undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!routeUrl}
              className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                routeUrl
                  ? 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
                  : 'pointer-events-none bg-white/5 text-slate-600'
              }`}
            >
              <Navigation size={16} /> Start this route
            </a>
          </div>

          <div className="rounded-2xl bg-sky-500/[0.06] p-4 ring-1 ring-sky-500/20">
            <div className="flex gap-3">
              <MapPin className="mt-0.5 shrink-0 text-sky-300" size={17} />
              <div>
                <div className="text-xs font-semibold text-sky-200">Make the route exact</div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Existing leads can route by company and city. Add the street address as you verify each prospect and the route becomes exact.
                </p>
                {selectedLead && (
                  <button onClick={() => onLeadClick(selectedLead.id)} className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-300 hover:text-sky-200">
                    Open {selectedLead.co} in CRM <ExternalLink size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full ring-2 ring-black/40"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function Metric({
  label,
  value,
  detail,
  valueClass = 'text-slate-100',
}: {
  label: string;
  value: number;
  detail: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl bg-apex-850 p-4 ring-1 ring-white/10">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</div>
      <div className="text-xs text-slate-400">{detail}</div>
    </div>
  );
}
