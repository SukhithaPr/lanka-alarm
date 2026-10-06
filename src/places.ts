import stationsRaw from './data/stations.json';
import { distanceM } from './geo';
import type { LatLon, Place, PlaceKind } from './types';

interface Raw {
  id: string;
  n: string;
  s: string;
  t: string;
  a?: string[];
  la: number;
  lo: number;
}

const toPlaces = (raw: Raw[], kind: PlaceKind): Place[] =>
  raw.map((r) => ({ id: r.id, name: r.n, kind, lat: r.la, lon: r.lo, sub: [r.s, r.t].filter(Boolean).join(' · ') || undefined, alt: r.a?.join(' ') }));

const STATIONS = toPlaces(stationsRaw as Raw[], 'station');

export type Filter = 'all' | 'station';

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, '').trim();

/** Offline search over bundled Sri Lanka railway stations. */
export function searchLocal(query: string, filter: Filter, near?: LatLon | null): Place[] {
  const q = norm(query);
  if (!q) return [];
  const pool = STATIONS;
  const hits: { p: Place; score: number }[] = [];
  for (const p of pool) {
    const hay = norm(`${p.name} ${p.sub ?? ''} ${p.alt ?? ''}`);
    const idx = hay.indexOf(q);
    if (idx < 0) continue;
    // Exact name (or official alias) first, then names that start with the text (shorter first), then the rest.
    const names = [p.name, ...(p.alt ? p.alt.split(' ') : [])].map(norm);
    const nameN = norm(p.name);
    let score = names.includes(q) ? -2 : nameN.startsWith(q) ? Math.min(nameN.length, 40) / 100 : 1;
    if (near) score += Math.min(distanceM(near, p) / 400000, 0.9);
    hits.push({ p, score });
  }
  return hits.sort((a, b) => a.score - b.score).slice(0, 12).map((h) => h.p);
}

/** Nearest bundled railway stations to a point, e.g. after dropping a pin. */
export function nearestStations(at: LatLon, limit = 3): (Place & { distM: number })[] {
  return STATIONS
    .map((p) => ({ ...p, distM: distanceM(at, p) }))
    .sort((a, b) => a.distM - b.distM)
    .slice(0, limit);
}

interface NominatimHit {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
}

/**
 * Online place search, limited to Sri Lanka. Only the text you type is sent,
 * never your position. Call it on an explicit search, not per keystroke:
 * the public server does not allow search-as-you-type.
 */
export async function searchOnline(query: string, signal?: AbortSignal): Promise<Place[]> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=lk&limit=6&accept-language=en' +
    `&q=${encodeURIComponent(query)}`;
  // Nominatim rejects anonymous clients (403), so identify the app. No personal data here.
  const res = await fetch(url, { signal, headers: { 'User-Agent': 'LankaAlarm/0.1 (location alarm app, Sri Lanka)' } });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const hits = (await res.json()) as NominatimHit[];
  return hits.map((h) => ({
    id: `n${h.place_id}`,
    name: h.name || h.display_name.split(',')[0],
    sub: h.display_name.split(',').slice(1, 3).join(',').trim(),
    kind: 'place' as const,
    lat: parseFloat(h.lat),
    lon: parseFloat(h.lon),
  }));
}

export interface RoadRoute {
  line: [number, number][];
  distanceM: number;
  durationS: number;
}

/** Opt-in only: this sends both coordinates to the public OSRM demo server. */
export async function fetchRoadRoute(from: LatLon, to: LatLon): Promise<RoadRoute | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const json = await res.json();
    const r = json.routes?.[0];
    if (!r) return null;
    return {
      line: r.geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]),
      distanceM: r.distance,
      durationS: r.duration,
    };
  } catch {
    return null;
  }
}
