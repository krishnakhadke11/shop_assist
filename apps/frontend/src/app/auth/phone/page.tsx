'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { requestOtp, setPendingOtp } from '@/lib/authClient';

function isValidIndianMobile(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

export default function PhoneEntryPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = isValidIndianMobile(phone);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || !consent || loading) return;

    setLoading(true);
    setError(null);
    try {
      const result = await requestOtp(phone);
      if (!result.ok) {
        setError(result.error ?? 'Could not send the code. Try again.');
        return;
      }
      setPendingOtp({ phone, devCode: result.devCode });
      router.push('/auth/otp');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-ink mb-2">Enter your mobile number</h1>
        <p className="text-base leading-relaxed text-ink/80 mb-6">
          The shop needs your number to confirm your order.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="phone" className="block text-sm font-semibold text-accent uppercase tracking-wide mb-2">
            Mobile number
          </label>
          <div className="flex items-stretch gap-2 mb-2">
            <span
              aria-hidden="true"
              className="flex items-center justify-center px-4 rounded-xl border border-gray-200 bg-gray-50 text-base font-semibold text-ink"
            >
              +91
            </span>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="flex-1 min-w-0 rounded-xl border border-gray-200 px-4 text-lg tracking-wide text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
              style={{ minHeight: '56px' }}
              aria-invalid={phone.length > 0 && !valid}
              aria-describedby="phone-hint"
            />
          </div>
          {phone.length > 0 && !valid && (
            <p id="phone-hint" className="text-sm text-error mb-2">
              Enter a valid 10-digit mobile number.
            </p>
          )}

          <label className="flex items-start gap-3 mt-6 mb-8 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-5 w-5 flex-none accent-brand"
            />
            <span className="text-sm leading-relaxed text-ink/80">
              I agree to receive an SMS with a verification code, and order updates for orders
              placed with this number.
            </span>
          </label>

          {error && (
            <div role="alert" className="mb-4 rounded-lg bg-error-bg px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!valid || !consent || loading}
            className="w-full rounded-xl bg-brand font-extrabold text-white text-base tracking-wide disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ minHeight: '56px' }}
          >
            {loading ? 'Sending code…' : 'Send OTP'}
          </button>
        </form>
      </div>
    </main>
  );
}
