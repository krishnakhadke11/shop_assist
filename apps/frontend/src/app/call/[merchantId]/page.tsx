'use client';

// Full-screen call route pushed to from the Home listing's mic button
// (src/app/page.tsx's handleCall). Wires the previously dev-only LiveKit
// harness (see "LiveKit voice-call harness" in apps/frontend/CLAUDE.md) into
// the real customer flow per explicit product direction — the harness's
// documented isolation reasons (Deferred click-to-call decision, no
// server-side auth to gate the token route against) still apply and are
// unchanged by this; only the UI entry point moved.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import '@livekit/components-styles';
import { LiveKitRoom } from '@livekit/components-react';
import { getSession } from '@/lib/authClient';
import { MERCHANTS } from '@/lib/dummyData';
import { CallScreen } from '@/components/CallScreen';

interface TokenResponse {
  token: string;
  url: string;
  roomName: string;
}

export default function CallPage({ params }: { params: { merchantId: string } }) {
  const router = useRouter();
  const merchant = MERCHANTS.find((m) => m.id === params.merchantId);

  const [session, setSession] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getSession()) {
      router.replace('/auth/phone');
      return;
    }
    if (!merchant) return;

    let cancelled = false;
    fetch('/api/livekit/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId: merchant.id }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to start call.');
        if (!cancelled) setSession(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to start call.');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant?.id]);

  const [callEnded, setCallEnded] = useState(false);

  const handleEndCall = () => {
    setCallEnded(true);
  };

  const goBack = () => router.replace('/');
  const goToOrders = () => router.replace('/orders');

  if (callEnded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-ink text-white px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-brand/20 flex items-center justify-center text-3xl">
          📞
        </div>
        <div>
          <h2 className="text-xl font-black mb-1">Call Ended</h2>
          <p className="text-xs text-white/70">With {merchant?.name || 'Shop'}</p>
        </div>
        <p className="text-sm text-white/80 max-w-xs">
          If you placed an order during the call, you can track it live in the Orders tab.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs mt-2">
          <button
            type="button"
            onClick={goToOrders}
            className="w-full py-3.5 rounded-xl bg-brand text-white font-bold text-sm hover:bg-brand-strong transition-all shadow-md active:scale-95"
          >
            Track in Orders Tab →
          </button>
          <button
            type="button"
            onClick={goBack}
            className="w-full py-2.5 rounded-xl border border-white/20 bg-white/5 text-white/80 text-xs font-semibold hover:bg-white/10"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink text-white px-6 text-center">
        <p className="text-sm font-semibold">Couldn&apos;t find that shop.</p>
        <button type="button" onClick={goBack} className="text-sm font-bold text-brand">
          Back to shops
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink text-white px-6 text-center">
        <p className="text-sm font-semibold text-error-bg">{error}</p>
        <button type="button" onClick={goBack} className="text-sm font-bold text-brand">
          Back to shops
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-ink text-white">
        <p className="text-sm font-semibold text-white/70">Connecting to {merchant.name}…</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={session.url}
      token={session.token}
      connect
      audio
      video={false}
      onDisconnected={handleEndCall}
      onError={(err) => setError(err.message)}
    >
      <CallScreen merchant={merchant} onEndCall={handleEndCall} />
    </LiveKitRoom>
  );
}
