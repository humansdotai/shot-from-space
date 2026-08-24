import { IconResolution } from '@/components/fui/icons';
import type { BriefCardProps } from './types';
import { Body, Lead, List, Note } from './ui';

/**
 * CARD 04 · WHAT WILL RESOLVE
 *
 * The ground sample distance, and honestly what it does and does not show.
 *
 * THE ONE VALUE is `mission.orbit.gsdM` — metres per pixel on the ground, as
 * the tasking order holds it. It is not converted, not averaged across the
 * catalogue and not softened.
 *
 * WHY THIS CARD IS WRITTEN THE WAY IT IS. The single most expensive
 * misunderstanding this product can sell is a customer who expects to see a
 * person, a number plate or something through a window, and finds out on
 * delivery. So the card states the limit in the same breath as the number,
 * in the customer's terms rather than in pixels, and the two lists are given
 * equal weight: the second one is not a footnote.
 *
 * THE LISTS ARE THE SITE'S OWN. Both are subsets of the lists on
 * `/how-it-works`, string for string — that page is where the promise about
 * resolution is made, and a brief card that paraphrased it would be a
 * fifteenth contradiction rather than a shorter version of the same claim.
 * If a line changes there, change it here to match; do not reword it.
 */
const RESOLVES = [
  'The shape, colour and pitch of a roof',
  'The driveway, and parked cars as distinct rectangles',
  'A pool, a patio, a lawn, individual mature trees',
  'The street pattern your address sits inside',
] as const;

const DOES_NOT_RESOLVE = [
  'Faces — a person is a mark two pixels across',
  'Number plates, house numbers, any text on the ground',
  'Windows, and anything on the other side of one',
  'Anything indoors, under a canopy or under a tree',
] as const;

export function WhatWillResolve({ mission, className }: BriefCardProps) {
  return (
    <Body className={className}>
      <Lead
        icon={<IconResolution size={18} />}
        label="Ground sample distance"
        mono
        value={`${mission.orbit.gsdM} m`}
        sub={<span className="text-note">One pixel on the ground</span>}
      />

      <div className="mt-8 grid grid-cols-1 gap-x-[var(--grid-gap-x)] gap-y-8 md:grid-cols-2">
        <List title="Resolves" items={RESOLVES} />
        <List title="Does not resolve" items={DOES_NOT_RESOLVE} tone="dim" />
      </div>

      <Note className="mt-7">
        At this scale a house is a small shape and a car is a few pixels. Nothing in the second
        list appears at any print size — a larger sheet enlarges the pixel, it does not add
        detail. This is a portrait of a place, not surveillance of the people in it.
      </Note>
    </Body>
  );
}
