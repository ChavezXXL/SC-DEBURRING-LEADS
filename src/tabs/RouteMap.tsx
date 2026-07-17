import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

/** Group non-exact points that share a rounded coordinate and fan them out on a
 * small ring, so a dozen leads pinned to the same city centroid don't stack into
 * one unclickable blob. Verified (exact) coordinates are left exactly where they are. */
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
    // Deterministic fan-out: rings of 8, radius grows per ring (~0.45km steps).
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

function dotIcon(color: string, selected: boolean): L.DivIcon {
  const size = selected ? 18 : 14;
  const ring = selected ? `,0 0 0 4px ${color}55` : `,0 0 0 1px ${color}88`;
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid ${INK};box-shadow:0 1px 3px rgba(0,0,0,.6)${ring}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
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

/**
 * RouteMap — an interactive Leaflet map rendered inside the CRM (no Google embed,
 * no paid API). Free CARTO dark tiles matched to the app's graphite theme. Shows
 * the shop, every company in view, and the ordered route drawn as a numbered line.
 */
export function RouteMap({ shop, points, route, selectedId, onSelect, className }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fitSigRef = useRef<string>('');
  const selRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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
    mapRef.current = map;
    // The tab animates in; recompute size once layout settles, then keep the map
    // sized to any later container change (sidebar toggle, responsive reflow) —
    // Leaflet only auto-handles window resizes, not container-only ones.
    const t = setTimeout(() => map.invalidateSize(), 60);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      // Reset derived-view refs so a re-created map (StrictMode remount) re-fits
      // instead of reusing this instance's stale signature.
      fitSigRef.current = '';
      selRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild markers + route line whenever the data or selection changes.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const routeIndex = new Map<string, number>();
    route.forEach((r, i) => routeIndex.set(r.id, r.stopNo ?? i + 1));

    // Dedupe by id; a route stop's data wins over the plain list entry.
    const byId = new Map<string, MapPoint>();
    for (const p of points) byId.set(p.id, p);
    for (const r of route) byId.set(r.id, r);
    const merged = [...byId.values()];

    const display = spreadCoords(merged);

    for (const p of merged) {
      const coords = display.get(p.id) ?? p.coords;
      const selected = p.id === selectedId;
      const stopNo = routeIndex.get(p.id);
      const icon = stopNo
        ? numberIcon(stopNo, selected)
        : dotIcon(p.tier === 2 ? BLUE : ORANGE, selected);
      const marker = L.marker(coords, { icon, zIndexOffset: stopNo ? 1000 : selected ? 500 : 0 });
      marker.bindTooltip(
        `<span style="font-weight:600">${esc(p.label)}</span>${p.city ? `<br><span style="opacity:.7">${esc(p.city)}</span>` : ''}`,
        { direction: 'top', offset: [0, -12], opacity: 0.95 },
      );
      marker.on('click', () => onSelectRef.current(p.id));
      marker.addTo(layer);
    }

    // Route line: shop -> each stop, in order.
    if (route.length) {
      const line: Coords[] = [shop.coords, ...route.map((r) => display.get(r.id) ?? r.coords)];
      L.polyline(line, {
        color: ORANGE,
        weight: 3,
        opacity: 0.85,
        dashArray: '6 9',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layer);
    }

    // Shop marker last so it sits on top.
    L.marker(shop.coords, { icon: shopIcon(), zIndexOffset: 2000 })
      .bindTooltip(`<span style="font-weight:600">${esc(shop.label)}</span><br><span style="opacity:.7">Start</span>`, {
        direction: 'top',
        offset: [0, -14],
        opacity: 0.95,
      })
      .addTo(layer);

    // Fit bounds only when the set of pins/route actually changes (not on mere
    // selection), so clicking a company doesn't jump the whole map around.
    // Signature = the SET of pins (order-independent). Route stops already live in
    // `merged`, so a pure stop reorder keeps the same signature and won't refit —
    // which means it won't throw away a zoom/pan the user set by hand.
    const sig = merged.map((p) => p.id).sort().join(',');
    if (sig !== fitSigRef.current) {
      fitSigRef.current = sig;
      const latlngs: Coords[] = [shop.coords, ...merged.map((p) => display.get(p.id) ?? p.coords)];
      if (latlngs.length > 1) {
        map.fitBounds(L.latLngBounds(latlngs.map((c) => L.latLng(c[0], c[1]))).pad(0.18));
      } else {
        map.setView(shop.coords, 11);
      }
    } else if (selectedId && selectedId !== selRef.current) {
      // Selection changed from the list — nudge the pin into view if it's off-screen.
      const c = display.get(selectedId);
      if (c) map.panInside(L.latLng(c[0], c[1]), { padding: [48, 48] });
    }
    selRef.current = selectedId;
  }, [points, route, selectedId, shop]);

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
