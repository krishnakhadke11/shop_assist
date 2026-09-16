'use client';

// Full-screen voice-call UI, pushed to from the Home listing's mic button
// (see page.tsx's handleCall). Reuses the same LiveKit primitives as the
// dev harness (VoiceCallHarness.tsx) — @livekit/components-react's
// BarVisualizer, fed the *local* participant's microphone track so the
// bars move with the caller's own voice, not the assistant's.

import { Track } from 'livekit-client';
import {
  BarVisualizer,
  RoomAudioRenderer,
  useLocalParticipant,
  useTracks,
  useVoiceAssistant,
} from '@livekit/components-react';
import { MicIcon } from '@/components/CallButton';
import { Merchant } from '@/lib/dummyData';

const ASSISTANT_STATE_LABEL: Record<ReturnType<typeof useVoiceAssistant>['state'], string> = {
  disconnected: 'Waiting for the assistant to join…',
  connecting: 'Connecting the assistant…',
  'pre-connect-buffering': 'Connecting the assistant…',
  initializing: 'Connecting the assistant…',
  idle: 'Assistant is idle',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Assistant is speaking',
  failed: 'Assistant connection failed',
};

interface CallScreenProps {
  merchant: Merchant;
  onEndCall: () => void;
}

export function CallScreen({ merchant, onEndCall }: CallScreenProps) {
  const { state } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const micTracks = useTracks([Track.Source.Microphone]);
  const localMicTrack = micTracks.find((t) => t.participant.isLocal);

  const toggleMute = () => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink text-white">
      <RoomAudioRenderer />

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-1">
            Calling
          </p>
          <h1 className="text-2xl font-extrabold">{merchant.name}</h1>
          <p className="mt-2 text-sm font-semibold text-white/70">
            {ASSISTANT_STATE_LABEL[state] ?? state}
          </p>
        </div>

        <div className="w-full max-w-xs h-32 flex items-center justify-center">
          <BarVisualizer
            track={localMicTrack}
            barCount={7}
            options={{ minHeight: 12, maxHeight: 100 }}
            className="w-full h-full"
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 pb-12 pt-4">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
          aria-pressed={!isMicrophoneEnabled}
          className={`flex items-center justify-center w-14 h-14 rounded-full border-2 ${
            isMicrophoneEnabled ? 'border-white/30 bg-white/10' : 'border-white bg-white'
          }`}
        >
          <MicIcon className={isMicrophoneEnabled ? 'text-white' : 'text-ink'} size={22} />
        </button>

        <button
          type="button"
          onClick={onEndCall}
          aria-label={`End call with ${merchant.name}`}
          className="flex items-center justify-center w-16 h-16 rounded-full bg-error"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-white rotate-[135deg]" aria-hidden="true">
            <path d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-.53 1.47l-1.44 1.16a10.65 10.65 0 006.095 6.095l1.16-1.44a1.5 1.5 0 011.47-.53l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A17.001 17.001 0 012.43 6.326 17.03 17.03 0 012 3.5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
