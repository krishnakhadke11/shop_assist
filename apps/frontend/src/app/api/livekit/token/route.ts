import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { MERCHANTS } from '@/lib/dummyData';

// Dev/demo harness only (apps/frontend/CLAUDE.md — "LiveKit voice-call
// harness"). NOT session-gated: this app's auth (src/lib/authClient.ts) has
// nothing server-side to verify a session against (in-memory OTP store,
// resets on restart), so there is no real identity to check here yet. Room
// name and participant identity are therefore generated server-side and
// never taken from the client — the request body carries a merchantId only,
// so a caller can mint a token but can never choose or spoof another
// session's room.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const merchantId = typeof body?.merchantId === 'string' ? body.merchantId : '';

  const merchant = MERCHANTS.find((m) => m.id === merchantId);
  if (!merchant) {
    return NextResponse.json({ error: 'Unknown merchantId.' }, { status: 400 });
  }

  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'Voice call is not configured on the server.' },
      { status: 500 }
    );
  }

  const identity = randomUUID();
  const roomName = `demo-${merchant.id}-${randomUUID().slice(0, 8)}`;

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    attributes: { merchantId: merchant.id, merchantName: merchant.name },
  });
  token.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true });

  const jwt = await token.toJwt();

  return NextResponse.json({ token: jwt, url, roomName });
}
