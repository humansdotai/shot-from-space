import type { MissionStage } from '@/lib/types';

/**
 * One-tap queries offered under the transcript, three per stage.
 *
 * These are the questions customers actually ask at each point in the mission.
 * They are the reason the channel feels alive on a phone: nobody types on a
 * train.
 *
 * Set in sentence case because they are shell UI, not telemetry — the operator
 * matches them case-insensitively on a normalised string, so the wording, not
 * the casing, is what carries the intent.
 *
 * Every prompt here maps onto an intent handled by the scripted operator in
 * lib/integrations/llm.ts. If a prompt is added, add its intent there first.
 */
export const SUGGESTED_QUERIES: Record<MissionStage, readonly [string, string, string]> = {
  MISSION_CONFIRMED: [
    'What happens next?',
    'When is the satellite tasked?',
    'Can I change the address?',
  ],
  SATELLITE_TASKED: [
    'When is the capture window?',
    'What if it is cloudy?',
    'Can I change the address?',
  ],
  CAPTURE_WINDOW: [
    'When is the next pass?',
    'What if it is cloudy?',
    'Why is it taking so long?',
  ],
  IMAGE_ACQUIRED: [
    'What does the preview mean?',
    'Can I get the digital file?',
    'Where does it print?',
  ],
  PROCESSING: [
    'Why is it taking so long?',
    'Where does it print?',
    'When will it ship?',
  ],
  PRINT: [
    'Where does it print?',
    'When will it ship?',
    'Can I change the address?',
  ],
  SHIPPED: [
    'Where is my package?',
    'When will it arrive?',
    'Can I change the address?',
  ],
  FINAL_APPROACH: [
    'Where is my package?',
    'What if I miss the delivery?',
    'How do I hang it?',
  ],
  DELIVERED: [
    'Can I get the digital file?',
    'How do I hang it?',
    'Can I order another?',
  ],
};

export function suggestionsFor(stage: MissionStage): readonly string[] {
  return SUGGESTED_QUERIES[stage] ?? SUGGESTED_QUERIES.MISSION_CONFIRMED;
}
