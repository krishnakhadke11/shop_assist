// Shared in-memory state for the dummy OTP flow (route handlers only).
// Resets on every server restart — this is a mock, not persistence.

export const DUMMY_OTP = '123456';
export const MAX_ATTEMPTS = 5;
export const RESEND_SECONDS = 30;

interface OtpEntry {
  code: string;
  attempts: number;
  sentAt: number;
}

const globalForMock = globalThis as unknown as { __otpStore?: Map<string, OtpEntry> };

export const otpStore: Map<string, OtpEntry> =
  globalForMock.__otpStore ?? (globalForMock.__otpStore = new Map());

export function isValidIndianMobile(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}
