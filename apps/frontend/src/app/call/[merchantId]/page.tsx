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

  const goBack = () => router.replace('/');

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
      onDisconnected={goBack}
      onError={(err) => setError(err.message)}
    >
      <CallScreen merchant={merchant} onEndCall={goBack} />
    </LiveKitRoom>
  );
}
