import { NextRequest, NextResponse } from 'next/server';
import { reverseGeocode } from '@/lib/geocode';

// Server-side proxy so GOOGLE_MAPS_API_KEY never reaches the browser. The
// client only ever calls this route, never Google directly.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const lat = typeof body?.lat === 'number' ? body.lat : null;
  const lng = typeof body?.lng === 'number' ? body.lng : null;

  if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ ok: false, error: 'lat and lng are required numbers.' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'Location lookup is not configured on the server.' },
      { status: 500 }
    );
  }

  const result = await reverseGeocode(lat, lng, apiKey);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, ...result.location });
}
