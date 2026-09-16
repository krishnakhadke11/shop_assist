// Server-only: parses a Google Geocoding API reverse-geocode response into
// the small shape this app actually displays. Two real gotchas live here on
// purpose, isolated from the route handler so they're easy to reason about:
//
// 1. `postal_code` is often absent from results[0] and only present on a
//    coarser, later result — every result's address_components must be
//    scanned, not just the first.
// 2. The "area" half of the display string (e.g. "Bandra West") is usually a
//    sublocality, not a locality — prefer sublocality_level_1 > sublocality
//    > locality so it matches the granularity the UI previously hardcoded.

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GeocodeResult {
  address_components: AddressComponent[];
  formatted_address: string;
}

interface GeocodeApiResponse {
  status: string;
  results: GeocodeResult[];
  error_message?: string;
}

export interface ParsedLocation {
  pincode: string | null;
  area: string | null;
  formattedAddress: string;
}

function findComponent(results: GeocodeResult[], type: string): string | null {
  for (const result of results) {
    const match = result.address_components.find((c) => c.types.includes(type));
    if (match) return match.long_name;
  }
  return null;
}

export function parseGeocodeResponse(data: GeocodeApiResponse): ParsedLocation {
  if (data.status !== 'OK' || data.results.length === 0) {
    return { pincode: null, area: null, formattedAddress: '' };
  }

  const pincode = findComponent(data.results, 'postal_code');
  const area =
    findComponent(data.results, 'sublocality_level_1') ??
    findComponent(data.results, 'sublocality') ??
    findComponent(data.results, 'locality');

  const formattedAddress = [pincode, area].filter(Boolean).join(', ') || data.results[0].formatted_address;

  return { pincode, area, formattedAddress };
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  apiKey: string
): Promise<{ ok: true; location: ParsedLocation } | { ok: false; error: string }> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return { ok: false, error: 'Could not reach the geocoding service.' };
  }

  if (!response.ok) {
    return { ok: false, error: `Geocoding request failed (${response.status}).` };
  }

  const data = (await response.json()) as GeocodeApiResponse;

  if (data.status !== 'OK') {
    return { ok: false, error: data.error_message ?? `Geocoding returned status ${data.status}.` };
  }

  return { ok: true, location: parseGeocodeResponse(data) };
}
