// Calls this Next.js app's own mock auth routes (/api/auth/*) — not the
// FastAPI backend in src/lib/api.ts, which has no auth endpoints yet.

export interface RequestOtpResult {
  ok: boolean;
  error?: string;
  devCode?: string;
}

export interface VerifyOtpResult {
  ok: boolean;
  error?: string;
  locked?: boolean;
  token?: string;
}

export async function requestOtp(phone: string): Promise<RequestOtpResult> {
  const res = await fetch('/api/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  return res.json();
}

export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  return res.json();
}

const PENDING_KEY = 'shopassist:pendingOtp';

interface PendingOtp {
  phone: string;
  devCode?: string;
}

export function setPendingOtp(pending: PendingOtp) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function getPendingOtp(): PendingOtp | null {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingOtp;
  } catch {
    return null;
  }
}

export function clearPendingOtp() {
  sessionStorage.removeItem(PENDING_KEY);
}

const SESSION_KEY = 'shopassist:session';

export interface Session {
  phone: string;
  token: string;
}

// localStorage, not sessionStorage — a verified session should survive
// a closed tab, unlike the in-progress OTP flow above.
export function setSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
