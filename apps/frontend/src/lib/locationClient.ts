// Calls this app's own /api/location/* routes — never Google directly, and
// never through the FastAPI `api` axios client in src/lib/api.ts.

export interface ReverseGeocodeResult {
  ok: boolean;
  error?: string;
  pincode?: string | null;
  area?: string | null;
  formattedAddress?: string;
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const res = await fetch('/api/location/reverse-geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  });
  return res.json();
}

export type LocationSource = 'gps' | 'manual';

export interface StoredLocation {
  pincode: string | null;
  area: string | null;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
  source: LocationSource;
  resolvedAt: number;
}

const LOCATION_KEY = 'shopassist:location';

// Only a GPS-resolved location goes stale — a manual entry stands until the
// customer edits it again (docs/shopassist-ui-plan.md §5.3: "editable ...
// drives everything below"). Google Maps Platform's terms also bound how
// long a geocoded result may be cached — recheck this figure against current
// ToS before this reaches real users.
const GPS_TTL_MS = 6 * 60 * 60 * 1000;

export function getStoredLocation(): StoredLocation | null {
  const raw = localStorage.getItem(LOCATION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredLocation;
    if (parsed.source === 'gps' && Date.now() - parsed.resolvedAt > GPS_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredLocation(location: StoredLocation) {
  localStorage.setItem(LOCATION_KEY, JSON.stringify(location));
}

interface EmptyLocationDemandPayload {
  pincode: string | null;
  area: string | null;
  lat: number | null;
  lng: number | null;
  source: LocationSource;
  timestamp: number;
}

// Seam for docs/shopassist-risk-register.md B-07 ("capture the pincode as a
// demand signal"). Not called anywhere yet — the merchant list has no
// location-based filtering, so "zero merchants at this location" cannot
// occur until that (separate, larger) work ships. Wire this up then, not
// before, so it isn't misattributed to today's unrelated category/search
// empty state.
export function reportEmptyLocationDemand(payload: EmptyLocationDemandPayload) {
  console.info('[demand-signal] no merchants at location', payload);
}
