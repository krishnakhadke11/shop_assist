import { NextRequest, NextResponse } from 'next/server';
import { DUMMY_OTP, isValidIndianMobile, otpStore } from '@/lib/mockAuth';

// Mock endpoint — no real SMS is sent. Swaps for a real backend call
// (same request/response shape) once /auth exists on the FastAPI service.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === 'string' ? body.phone : '';

  if (!isValidIndianMobile(phone)) {
    return NextResponse.json(
      { ok: false, error: 'Enter a valid 10-digit mobile number.' },
      { status: 400 }
    );
  }

  otpStore.set(phone, { code: DUMMY_OTP, attempts: 0, sentAt: Date.now() });

  // Simulate SMS delivery latency.
  await new Promise((resolve) => setTimeout(resolve, 500));

  return NextResponse.json({
    ok: true,
    // Dev-only: a mock backend has no SMS provider, so the code is
    // handed back here for the UI to display as a visible dev hint.
    devCode: DUMMY_OTP,
  });
}
