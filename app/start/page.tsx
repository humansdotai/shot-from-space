import type { Metadata } from 'next';
import { StartFlow } from '@/components/purchase/StartFlow';

export const metadata: Metadata = {
  title: 'Start a mission',
  description:
    'Name a place. A satellite is tasked over it, the frame is composed with the telemetry of its own pass, printed near you and shipped as a finished object.',
};

/**
 * /start — the mission briefing.
 *
 * The shell holds nothing. Every screen in the briefing carries its own
 * ground, its own heading and its own single decision, and the ground changes
 * partway through the sequence — so the band a screen sits on and the state
 * of the screen inside it are the same fact, and both belong to <StartFlow />.
 *
 * There is no static header above the flow. A briefing that opens under a
 * banner opens twice.
 */
export default function StartPage() {
  return (
    <main>
      <StartFlow />
    </main>
  );
}
