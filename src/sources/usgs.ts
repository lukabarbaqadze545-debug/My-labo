import type { AdapterContext, FetchOutcome } from './types';

/**
 * USGS earthquake feed — live, keyless, CORS-enabled.
 * Used by the Earth Science lab so students can look at real measurements from
 * the last day rather than a textbook table.
 */

export interface QuakeEvent {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  depthKm: number;
  longitude: number;
  latitude: number;
  url: string;
}

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

export async function fetchRecentQuakes({ signal }: AdapterContext = {}): Promise<FetchOutcome<QuakeEvent[]>> {
  try {
    const response = await fetch(FEED, { headers: { Accept: 'application/json' }, ...(signal ? { signal } : {}) });
    if (!response.ok) return { status: 'unavailable', reason: `USGS: HTTP ${response.status}` };

    const payload = (await response.json()) as {
      features?: {
        id?: string;
        properties?: { mag?: number; place?: string; time?: number; url?: string };
        geometry?: { coordinates?: number[] };
      }[];
    };

    const events: QuakeEvent[] = [];
    for (const feature of payload.features ?? []) {
      const props = feature.properties ?? {};
      const coords = feature.geometry?.coordinates ?? [];
      const [lon, lat, depth] = coords;
      if (typeof props.mag !== 'number' || typeof lon !== 'number' || typeof lat !== 'number') continue;
      events.push({
        id: feature.id ?? `${lat},${lon},${props.time}`,
        magnitude: props.mag,
        place: props.place ?? 'უცნობი ადგილი',
        time: props.time ?? Date.now(),
        depthKm: typeof depth === 'number' ? depth : 0,
        longitude: lon,
        latitude: lat,
        url: props.url ?? 'https://earthquake.usgs.gov/earthquakes/map/',
      });
    }

    if (events.length === 0) {
      return { status: 'unavailable', reason: 'ბოლო 24 საათში 2.5+ მაგნიტუდის მიწისძვრა არ დაფიქსირებულა' };
    }
    events.sort((a, b) => b.time - a.time);
    return { status: 'ok', data: events, fetchedAt: Date.now() };
  } catch {
    return { status: 'unavailable', reason: 'ქსელი მიუწვდომელია' };
  }
}
