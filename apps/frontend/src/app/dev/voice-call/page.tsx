import { VoiceCallHarness } from '@/components/VoiceCallHarness';

// Dev-only entry point for the LiveKit voice-call harness — intentionally
// not in the bottom nav or linked from Home. See apps/frontend/CLAUDE.md.
export default function VoiceCallDevPage() {
  return <VoiceCallHarness />;
}
