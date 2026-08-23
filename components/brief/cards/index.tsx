/**
 * THE MISSION BRIEF CARDS — six subjects, in reading order.
 *
 * Six white cards on black, one subject each, read in about ten seconds:
 * where we are looking · the pass · conditions · what will resolve · next
 * steps · what arrives.
 *
 * ==================================================================
 * THE RULE THESE CARDS ARE BUILT ON
 * ==================================================================
 * Every value on every card is read off the mission record or off an
 * existing derivation, and nothing is re-typed:
 *
 *   place / coordinates / footprint  the mission row
 *   pass geometry                    `mission.orbit`
 *   conditions                       `lib/missions/conditions.ts`
 *   stages                           `MISSION_STAGES`, `STAGE_LABEL`,
 *                                    `STAGE_DESCRIPTION`, the mission's events
 *   object                           `mission.format`, `lib/pricing.ts`
 *   materials and packaging          `MATERIALS` / `PACKAGING`
 *   guarantees                       `lib/guarantees.ts`
 *
 * WHERE THE RECORD HOLDS NOTHING, THE CARD SAYS SO. There is no invented
 * pass time on these cards, no countdown, no placeholder weather and no
 * "coming soon" — a card with one honest line beats a card with six invented
 * ones, and a mission at MISSION_CONFIRMED is meant to read as a mission that
 * has not happened yet.
 *
 * OWNERSHIP. The deck follows the rules the mission page already applies. A
 * shared or public viewer gets the city-level place, two-decimal coordinates
 * and none of the private block; the owner gets four decimals and the capture
 * footprint. Pass `variant="shared"` on `/s/[code]`.
 *
 * ==================================================================
 * USING THEM
 * ==================================================================
 *     import { BriefDeck } from '@/components/brief';
 *     import { briefCards } from '@/components/brief/cards';
 *
 *     <BriefDeck open={open} onClose={close} code={mission.code}
 *                cards={briefCards(mission, variant)} />
 *
 * `briefCards()` returns the deck's own `BriefCard[]`, in order, with each
 * card's subject as its `title` — the DECK renders that as the card's <h3>,
 * so no card body carries a heading of its own. The individual components
 * are exported too, for a surface that wants one card outside a deck.
 *
 * A card body renders CONTENT ONLY: no fill, no border, no radius, no shadow
 * and no motion. Cards follow their ground through `--ink` / `--ink-dim` /
 * `--rule`, so they are correct inside the deck's `.surface-light` sheet
 * without naming a colour, and every one of them is a pure function of the
 * mission — safe on the server and identical after hydration.
 */

import type { BriefCard } from '../BriefDeck';
import { Conditions, conditionsCardTitle } from './Conditions';
import { NextSteps } from './NextSteps';
import { ThePass } from './ThePass';
import type { BriefCardProps } from './types';
import { WhatArrives } from './WhatArrives';
import { WhatWillResolve } from './WhatWillResolve';
import { WhereWeAreLooking } from './WhereWeAreLooking';

export type { BriefCardProps } from './types';

export { WhereWeAreLooking } from './WhereWeAreLooking';
export { ThePass } from './ThePass';
export { Conditions, conditionsCardTitle } from './Conditions';
export { WhatWillResolve } from './WhatWillResolve';
export { NextSteps } from './NextSteps';
export { WhatArrives } from './WhatArrives';

/**
 * The deck, in order.
 *
 * No `eyebrow` on any card. The deck offers one and the six subjects do not
 * need it — a kicker that restates the title is the flatness this deck was
 * built to avoid, and the one genuinely useful kicker (whether the conditions
 * were measured or forecast) is already in the conditions title.
 */
export function briefCards(
  mission: BriefCardProps['mission'],
  variant: BriefCardProps['variant'] = 'owner',
): BriefCard[] {
  const props = { mission, variant };
  return [
    { id: 'target', title: 'Where we are looking', content: <WhereWeAreLooking {...props} /> },
    { id: 'pass', title: 'The pass', content: <ThePass {...props} /> },
    { id: 'conditions', title: conditionsCardTitle(mission), content: <Conditions {...props} /> },
    /* THE ONE WIDE SHEET. Card 04 is the only card whose honest form is
       two parallel lists — what the ground sample distance resolves and
       what it does not — and at the narrow measure those two become one
       long column at every width, which puts the second list below the
       fold and makes the less flattering half the half nobody reads. The
       wide sheet lets them stand side by side from 768 up. It is a fact
       about the content, not an emphasis; see the note at the head of
       ../BriefDeck.tsx before giving a second card one. */
    {
      id: 'resolution',
      title: 'What will resolve',
      size: 'wide',
      content: <WhatWillResolve {...props} />,
    },
    { id: 'next-steps', title: 'Next steps', content: <NextSteps {...props} /> },
    { id: 'what-arrives', title: 'What arrives', content: <WhatArrives {...props} /> },
  ];
}
