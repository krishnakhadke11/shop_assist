'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearPendingOtp, getPendingOtp, requestOtp, setSession, verifyOtp } from '@/lib/authClient';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function OtpVerifyPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | undefined>();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const pending = getPendingOtp();
    if (!pending) {
      router.replace('/auth/phone');
      return;
    }
    setPhone(pending.phone);
    setDevCode(pending.devCode);
    inputRefs.current[0]?.focus();
  }, [router]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const code = digits.join('');

  const focusIndex = (index: number) => {
    inputRefs.current[index]?.focus();
    inputRefs.current[index]?.select();
  };

  const handleChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    const next = [...digits];
    next[index] = clean[clean.length - 1];
    setDigits(next);
    if (index < OTP_LENGTH - 1) focusIndex(index + 1);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      focusIndex(index - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    focusIndex(Math.min(pasted.length, OTP_LENGTH - 1));
  };

  const handleVerify = async () => {
    if (!phone || code.length !== OTP_LENGTH || verifying || locked) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyOtp(phone, code);
      if (!result.ok) {
        setError(result.error ?? 'Something went wrong. Try again.');
        if (result.locked) setLocked(true);
        setDigits(Array(OTP_LENGTH).fill(''));
        focusIndex(0);
        return;
      }
      clearPendingOtp();
      setSession({ phone, token: result.token! });
      router.push('/');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!phone || secondsLeft > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const result = await requestOtp(phone);
      if (!result.ok) {
        setError(result.error ?? 'Could not resend the code.');
        return;
      }
      setDevCode(result.devCode);
      setDigits(Array(OTP_LENGTH).fill(''));
      setLocked(false);
      setSecondsLeft(RESEND_SECONDS);
      focusIndex(0);
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setResending(false);
    }
  };

  if (!phone) return null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-ink mb-2">Enter the code</h1>
        <p className="text-base leading-relaxed text-ink/80 mb-1">
          We sent a 6-digit code by SMS to{' '}
          <span className="font-semibold text-ink">+91 {phone}</span>.
        </p>
        <button
          type="button"
          onClick={() => router.push('/auth/phone')}
          className="text-sm font-semibold text-accent underline underline-offset-2 mb-6"
        >
          Change number
        </button>

        {devCode && (
          <div className="mb-6 rounded-lg border border-dashed border-amber bg-amber-bg px-4 py-3 text-sm text-ink/80">
            <span className="font-bold text-amber uppercase tracking-wide text-xs">Dev mock</span>
            <br />
            No SMS is actually sent — use <span className="font-mono font-bold">{devCode}</span> to
            continue.
          </div>
        )}

        <div
          className="flex justify-between gap-2 mb-4"
          onPaste={handlePaste}
          role="group"
          aria-label="6-digit verification code"
        >
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              value={digit}
              disabled={locked}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-full text-center text-xl font-bold text-ink rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand disabled:opacity-40"
              style={{ height: '56px' }}
              aria-label={`Digit ${index + 1}`}
            />
          ))}
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-error-bg px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleVerify}
          disabled={code.length !== OTP_LENGTH || verifying || locked}
          className="w-full rounded-xl bg-brand font-extrabold text-white text-base tracking-wide disabled:opacity-40 disabled:cursor-not-allowed transition-opacity mb-4"
          style={{ minHeight: '56px' }}
        >
          {verifying ? 'Verifying…' : 'Verify'}
        </button>

        <div className="text-center text-sm">
          {secondsLeft > 0 ? (
            <span className="text-ink/70">
              Resend code in <span className="font-semibold text-accent">0:{String(secondsLeft).padStart(2, '0')}</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="font-semibold text-accent underline underline-offset-2 disabled:opacity-50"
            >
              {resending ? 'Resending…' : "Didn't get it? Resend code"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
