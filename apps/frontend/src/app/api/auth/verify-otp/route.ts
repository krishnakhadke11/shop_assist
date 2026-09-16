import { NextRequest, NextResponse } from 'next/server';
import { MAX_ATTEMPTS, otpStore } from '@/lib/mockAuth';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === 'string' ? body.phone : '';
  const code = typeof body?.code === 'string' ? body.code : '';

  const entry = otpStore.get(phone);

  await new Promise((resolve) => setTimeout(resolve, 400));

  if (!entry) {
    return NextResponse.json(
      { ok: false, error: 'Code expired. Request a new one.' },
      { status: 400 }
    );
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { ok: false, error: 'Too many attempts. Request a new code.', locked: true },
      { status: 429 }
    );
  }

  if (entry.code !== code) {
    entry.attempts += 1;
    const attemptsLeft = MAX_ATTEMPTS - entry.attempts;
    if (attemptsLeft <= 0) {
      otpStore.delete(phone);
      return NextResponse.json(
        { ok: false, error: 'Too many attempts. Request a new code.', locked: true },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { ok: false, error: `Wrong code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.` },
      { status: 400 }
    );
  }

  otpStore.delete(phone);

  return NextResponse.json({
    ok: true,
    // Mock session token — a real backend issues this after OTP verification.
    token: `mock-session-${phone}-${Date.now()}`,
  });
}
