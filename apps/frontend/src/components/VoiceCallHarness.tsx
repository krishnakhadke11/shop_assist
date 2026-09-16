'use client';

// Dev/demo harness for the LiveKit voice-call path — see the "LiveKit
// voice-call harness" section in apps/frontend/CLAUDE.md for why this is
// isolated from the real Home-screen CallButton rather than wired into it.
// With apps/agents still unbuilt, joining a room here connects successfully
// but plays back silence — no agent will ever join. That's expected.

import { useState } from 'react';
import '@livekit/components-styles';
import { LiveKitRoom, RoomAudioRenderer, useVoiceAssistant } from '@livekit/components-react';
import { MERCHANTS } from '@/lib/dummyData';

interface TokenResponse {
  token: string;
  url: string;
  roomName: string;
}

function AgentStatus() {
  const { state } = useVoiceAssistant();
  const label: Record<typeof state, string> = {
    disconnected: 'Waiting for the assistant to join…',
    connecting: 'Connecting the assistant…',
    'pre-connect-buffering': 'Connecting the assistant…',
    initializing: 'Connecting the assistant…',
    idle: 'Assistant is idle',
    listening: 'Assistant is listening',
    thinking: 'Assistant is thinking…',
    speaking: 'Assistant is speaking',
    failed: 'Assistant connection failed',
  };
  return (
    <p className="text-sm font-semibold text-ink/70">{label[state] ?? state}</p>
  );
}

export function VoiceCallHarness() {
  const [merchantId, setMerchantId] = useState(MERCHANTS[0]?.id ?? '');
  const [session, setSession] = useState<TokenResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const startCall = async () => {
    setStatus('requesting');
    setError(null);
    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to start call.');
      setSession(data);
      setStatus('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start call.');
      setStatus('error');
    }
  };

  const endCall = () => {
    setSession(null);
    setStatus('idle');
  };

  return (
    <div className="max-w-md mx-auto p-5">
      <h1 className="text-lg font-bold text-ink mb-1">Voice call harness</h1>
      <p className="text-sm text-ink/70 mb-4">
        An AI assistant listens in Hindi, Marathi or English — this is a test
        room, not the shopkeeper. Dev-only: not linked from the app.
      </p>

      {status !== 'connected' && (
        <div className="flex flex-col gap-3">
          <select
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
          >
            {MERCHANTS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={startCall}
            disabled={status === 'requesting'}
            className="rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {status === 'requesting' ? 'Starting…' : 'Start test call'}
          </button>
          {status === 'error' && (
            <p className="text-sm font-semibold text-error">{error}</p>
          )}
        </div>
      )}

      {status === 'connected' && session && (
        <LiveKitRoom
          serverUrl={session.url}
          token={session.token}
          connect
          audio
          video={false}
          onDisconnected={endCall}
          onError={(err) => {
            setError(err.message);
            setStatus('error');
          }}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-brand-strong">
              Connected to room {session.roomName}
            </p>
            <AgentStatus />
            <button
              type="button"
              onClick={endCall}
              className="rounded-xl bg-error px-4 py-3 text-sm font-bold text-white"
            >
              End call
            </button>
          </div>
          <RoomAudioRenderer />
        </LiveKitRoom>
      )}
    </div>
  );
}
