import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';

export type Coords = [number, number];

export interface MapPoint {
  id: string;
  coords: Coords;
  label: string;
  city?: string;
  tier?: 1 | 2;
  /** True when the lead has verified lat/lng (don't jitter these). */
  exact?: boolean;
  /** Route position to label this pin with. Keeps map numbers aligned with the
   * sidebar/Google Maps even when an un-geocodable stop is skipped on the map. */
  stopNo?: number;
}

interface RouteMapProps {
  /** The origin marker — the shop. */
  shop: { coords: Coords; label: string };
  /** Every selectable company in the current view. */
  points: MapPoint[];
  /** Ordered route stops (drawn as a numbered line from the shop). */
  route: MapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

const ORANGE = '#f97316';
const BLUE = '#3b82f6';
const EMERALD = '#10b981';
const INK = '#0b0d12';

/** Company/city names go into tooltip innerHTML, so escape them. */
function esc(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  );
}

/** Fan route stops that share a city centroid onto a small ring so the numbered
 * pins don't stack. (Companies don't need this — they cluster instead.) */
function spreadCoords(all: MapPoint[]): Map<string, Coords> {
  const out = new Map<string, Coords>();
  const groups = new Map<string, MapPoint[]>();

  for (const p of all) {
    if (p.exact) {
      out.set(p.id, p.coords);
      continue;
    }
    const key = `${p.coords[0].toFixed(3)},${p.coords[1].toFixed(3)}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(p);
    else groups.set(key, [p]);
  }

  for (const bucket of groups.values()) {
    if (bucket.length === 1) {
      out.set(bucket[0].id, bucket[0].coords);
      continue;
    }
    bucket.forEach((p, i) => {
      const ring = Math.floor(i / 8);
      const radius = 0.004 + ring * 0.004;
      const angle = (2 * Math.PI * (i % 8)) / 8 + ring * 0.4;
      out.set(p.id, [
        p.coords[0] + radius * Math.sin(angle),
        p.coords[1] + radius * Math.cos(angle),
      ]);
    });
  }

  return out;
}

/** SOLID dot = we have the company's real street address, so the pin is the
 * actual building. HOLLOW ring = we only know the city, so the pin is a city
 * centre guess — the map should not imply precision it doesn't have. */
function dotIcon(color: string, selected: boolean, exact: boolean): L.DivIcon {
  const size = selected ? 18 : 14;
  const sel = selected ? `,0 0 0 4px ${color}55` : '';
  if (exact) {
    return L.divIcon({
      className: '',
      html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid ${INK};box-shadow:0 1px 3px rgba(0,0,0,.6),0 0 0 1px ${color}88${sel}"></span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }
  const s = size + 2;
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:${s}px;height:${s}px;border-radius:9999px;background:${color}1f;border:2.5px solid ${color};opacity:.9;box-shadow:0 1px 3px rgba(0,0,0,.45)${sel}"></span>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  });
}

function numberIcon(n: number, selected: boolean): L.DivIcon {
  const size = 28;
  const ring = selected ? `,0 0 0 4px ${ORANGE}55` : '';
  return L.divIcon({
    className: '',
    html: `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:9999px;background:${ORANGE};color:${INK};font:700 13px/1 ui-sans-serif,system-ui,sans-serif;border:2px solid ${INK};box-shadow:0 1px 4px rgba(0,0,0,.6)${ring}">${n}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function shopIcon(): L.DivIcon {
  const size = 30;
  return L.divIcon({
    className: '',
    html: `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:9999px;background:${EMERALD};border:2px solid ${INK};box-shadow:0 1px 5px rgba(0,0,0,.6)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>
    </span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Cluster badge — a dark, orange count matching the app (no default blue). */
function clusterIcon(count: number): L.DivIcon {
  const size = count < 10 ? 34 : count < 30 ? 40 : 46;
  const inner = size - 10;
  return L.divIcon({
    className: '',
    html: `<div style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:9999px;background:rgba(249,115,22,.20);border:1.5px solid ${ORANGE};box-shadow:0 1px 7px rgba(0,0,0,.55)">
      <span style="display:grid;place-items:center;width:${inner}px;height:${inner}px;border-radius:9999px;background:${ORANGE};color:${INK};font:700 ${count < 100 ? 13 : 11}px/1 ui-sans-serif,system-ui,sans-serif">${count}</span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * RouteMap — an interactive Leaflet map rendered inside the CRM (no Google embed,
 * no paid API). Free CARTO dark tiles matched to the app's graphite theme.
 * Companies cluster by area (tap a badge to fan them out); the shop and the
 * numbered route stops stay as always-visible pins with the route line.
 */
export function RouteMap({ shop, points, route, selectedId, onSelect, className }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const fitSigRef = useRef<string>('');
  const selRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  // Markers by lead id so selection can restyle/pan WITHOUT tearing down and
  // re-clustering the whole set (which flickered and collapsed spiderfied groups).
  const markersRef = useRef<
    Map<string, { marker: L.Marker; makeIcon: (sel: boolean) => L.DivIcon }>
  >(new Map());
  const selectedIdRef = useRef<string | null>(selectedId);
  selectedIdRef.current = selectedId;

  // Init once. Cleanup fully so React 19 StrictMode's double-mount re-inits clean.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    const map = L.map(container, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    }).setView(shop.coords, 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    clusterRef.current = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 55,
      chunkedLoading: true,
      iconCreateFunction: (cluster) => clusterIcon(cluster.getChildCount()),
    });
    map.addLayer(clusterRef.current);
    mapRef.current = map;
    // The tab animates in; recompute size once layout settles, then keep the map
    // sized to any later container change (sidebar toggle, responsive reflow) —
    // Leaflet only auto-handles window resizes, not container-only ones.
    const t = setTimeout(() => map.invalidateSize(), 60);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);

    // Scroll-to-zoom starts OFF so scrolling the page past the map doesn't get
    // hijacked — but that made zooming a chore. Clicking or touching the map is
    // clear intent, so turn it on then; turn it back off when the pointer leaves.
    const enableScroll = () => map.scrollWheelZoom.enable();
    const disableScroll = () => map.scrollWheelZoom.disable();
    map.on('click', enableScroll);
    map.on('focus', enableScroll);
    container.addEventListener('touchstart', enableScroll, { passive: true });
    map.on('mouseout', disableScroll);
    map.on('blur', disableScroll);

    return () => {
      clearTimeout(t);
      ro.disconnect();
      container.removeEventListener('touchstart', enableScroll);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      clusterRef.current = null;
      fitSigRef.current = '';
      selRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build markers + route line when the DATA changes (not on selection). Splitting
  // selection out avoids clearing/re-clustering every marker on each click (which
  // flickered, collapsed spiderfied clusters, and could ghost markers mid-chunk).
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    const cluster = clusterRef.current;
    if (!map || !layer || !cluster) return;
    layer.clearLayers();
    cluster.clearLayers();
    markersRef.current.clear();

    const routeIndex = new Map<string, number>();
    route.forEach((r, i) => routeIndex.set(r.id, r.stopNo ?? i + 1));

    // Dedupe by id; a route stop's data wins over the plain list entry.
    const byId = new Map<string, MapPoint>();
    for (const p of points) byId.set(p.id, p);
    for (const r of route) byId.set(r.id, r);
    const merged = [...byId.values()];

    // Route stops get fanned so same-city numbers don't stack; companies sit on
    // the raw centroid so the cluster groups everything in a city into one badge.
    const routeDisplay = spreadCoords(route);
    const bounds: Coords[] = [shop.coords];
    const sel = selectedIdRef.current;

    const tip = (p: MapPoint) =>
      `<span style="font-weight:600">${esc(p.label)}</span>${p.city ? `<br><span style="opacity:.7">${esc(p.city)}</span>` : ''}`;

    const companyMarkers: L.Marker[] = [];
    for (const p of merged) {
      const stopNo = routeIndex.get(p.id);
      if (stopNo) {
        const coords = routeDisplay.get(p.id) ?? p.coords;
        bounds.push(coords);
        const makeIcon = (s: boolean) => numberIcon(stopNo, s);
        const m = L.marker(coords, { icon: makeIcon(p.id === sel), zIndexOffset: 1000 });
        m.bindTooltip(tip(p), { direction: 'top', offset: [0, -12], opacity: 0.95 });
        m.on('click', () => onSelectRef.current(p.id));
        m.addTo(layer);
        markersRef.current.set(p.id, { marker: m, makeIcon });
      } else {
        bounds.push(p.coords);
        const color = p.tier === 2 ? BLUE : ORANGE;
        const isExact = !!p.exact;
        const makeIcon = (s: boolean) => dotIcon(color, s, isExact);
        const m = L.marker(p.coords, { icon: makeIcon(p.id === sel), zIndexOffset: p.id === sel ? 500 : 0 });
        m.bindTooltip(tip(p), { direction: 'top', offset: [0, -12], opacity: 0.95 });
        m.on('click', () => onSelectRef.current(p.id));
        companyMarkers.push(m);
        markersRef.current.set(p.id, { marker: m, makeIcon });
      }
    }
    cluster.addLayers(companyMarkers);

    // Route line: shop -> each stop, in order.
    if (route.length) {
      const line: Coords[] = [shop.coords, ...route.map((r) => routeDisplay.get(r.id) ?? r.coords)];
      L.polyline(line, {
        color: ORANGE,
        weight: 3,
        opacity: 0.85,
        dashArray: '6 9',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layer);
    }

    // Shop marker on the always-visible layer, on top.
    L.marker(shop.coords, { icon: shopIcon(), zIndexOffset: 2000 })
      .bindTooltip(`<span style="font-weight:600">${esc(shop.label)}</span><br><span style="opacity:.7">Start</span>`, {
        direction: 'top',
        offset: [0, -14],
        opacity: 0.95,
      })
      .addTo(layer);

    // Fit bounds only when the SET of pins/route changes (order-independent), so
    // clicking a company or reordering stops doesn't throw away a hand-set zoom.
    const sig = merged.map((p) => p.id).sort().join(',');
    if (sig !== fitSigRef.current) {
      fitSigRef.current = sig;
      if (bounds.length > 1) {
        map.fitBounds(L.latLngBounds(bounds.map((c) => L.latLng(c[0], c[1]))).pad(0.18));
      } else {
        map.setView(shop.coords, 11);
      }
    }
  }, [points, route, shop]);

  // Selection: just restyle the affected markers and nudge the selected one into
  // view — no rebuild. On a genuine change (not initial mount) pan so a company
  // picked from the list gives map feedback even if it's off-screen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const prev = selRef.current;
    if (prev && prev !== selectedId) {
      const e = markersRef.current.get(prev);
      if (e) e.marker.setIcon(e.makeIcon(false));
    }
    if (selectedId) {
      const e = markersRef.current.get(selectedId);
      if (e) {
        e.marker.setIcon(e.makeIcon(true));
        if (prev && prev !== selectedId) {
          map.panInside(e.marker.getLatLng(), { padding: [48, 48] });
        }
      }
    }
    selRef.current = selectedId;
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ background: '#0b0d12' }}
      aria-label="Field route map"
      role="application"
    />
  );
}
