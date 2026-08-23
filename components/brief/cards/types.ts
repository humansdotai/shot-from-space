import type { MissionDTO } from '@/lib/types';

/**
 * THE CARD API.
 *
 * Every brief card is the same shape: one mission, one ownership variant,
 * one optional className. No card fetches, no card holds state, no card
 * takes a clock — a briefing card states what the record holds at the
 * moment it is rendered, and a value that moves while it is being read is
 * not a briefing.
 *
 * The deck shell (`components/brief/BriefDeck.tsx`) supplies the chrome: the
 * white fill, the rounded corner, the shadow, the padding, the card's <h3>
 * and the motion. A card renders CONTENT ONLY — no heading of its own — and
 * follows the ground it is put on through `--ink` / `--ink-dim` / `--rule`,
 * so it is correct inside the deck's `.surface-light` sheet without naming a
 * single colour. `briefCards()` in ./index.tsx builds the deck's array.
 */
export interface BriefCardProps {
  mission: MissionDTO;
  /**
   * Ownership, as the mission page already applies it. `owner` releases the
   * private block (4 dp coordinates, the capture footprint); `shared` — and
   * an owner variant on a mission whose `private` block was stripped — sees
   * the city-level projection at 2 dp and is told which fields are withheld
   * rather than shown a blank.
   */
  variant?: 'owner' | 'shared';
  className?: string;
}
