'use client';

import { clsx as cn } from 'clsx';
import { INK } from '@/components/purchase/fields';
import { CAPTURE_GSD_BASIS, CAPTURE_GSD_CM } from '@/lib/mission-flow/config';
import { FieldRow, FieldTable, PanelDisclosure, PanelGroup, PanelHead, PanelStack } from './Panel';
import type { MissionTarget } from '@/lib/mission-flow/state';

/**
 * SECTION 2 — FRAMING (was screen 5, `How it works`).
 *
 * ------------------------------------------------------------------
 * A NARRATION SCREEN BECOMES A SIDE NOTE ON A DECISION
 * ------------------------------------------------------------------
 * Screen 5 carried no decision at all: three lines and a `Continue`.
 * CONFIGURATOR.md is explicit that a screen of pure narration may fold
 * into an adjacent section, and this is the one it belongs to — the
 * decision lives in the preview column, where the capture footprint sits
 * on a basemap (`components/frame/FrameOnMap.tsx`, mounted by
 * <FramingStage />). Everything in this panel exists to tell the buyer
 * what they get out of the square they are moving.
 *
 * ------------------------------------------------------------------
 * WHAT WAS CUT HERE, 2026-08, AND WHY
 * ------------------------------------------------------------------
 * The owner's measurement: 2,769 words to buy a print, and this step
 * carried 430 of them for a decision that is made entirely on the map
 * above it. Three things went.
 *
 * THE NUMBERED NARRATION. `01 A spacecraft crosses this sky…` was the
 * fourth place in the flow that the next crossing is printed — Target
 * draws it as a sky chart, Window counts down to it and lists the fleet,
 * Review counts down to it again. Restating it here bought the buyer
 * nothing they could act on while dragging a map. `03 The frame you
 * place here is what it is pointed at` said what the standfirst says,
 * one line lower.
 *
 * THE `THE PASS THOSE NUMBERS CAME FROM` BLOCK — an orbit glyph, a live
 * slant range, a four-row table and a hundred-word note about how
 * elevation trades against air mass. All of it true, none of it a fact
 * about where the square goes. With it went this step's second SGP4
 * search over the same coordinates.
 *
 * WHAT SURVIVED, AND HAD TO. `CAPTURE_GSD_CM` is what the money buys and
 * it stays on the surface. `CAPTURE_GSD_BASIS` is the sentence that
 * stops it being a promise the system cannot keep — the exact figure
 * depends on the spacecraft assigned and how far off nadir it flies — so
 * it stays too, verbatim, one tap away in the disclosure attached to the
 * figure it qualifies. A resolution claim on a product that sells
 * resolution never stands on its own; it does not have to shout to
 * stand.
 *
 * WHAT IS NOT REPEATED HERE. That the basemap is reference imagery, who
 * serves it, at what ground sample, and where the frame centre currently
 * sits: <FrameOnMap /> prints all four under the map, in more detail
 * than a panel note could, and saying it twice would make the second one
 * look like a different claim.
 */
/* The target is still the prop <MissionFlow /> passes and still what
   gates this section from rendering at all; nothing in the panel reads
   it any more, because everything that did was a second printing of a
   fact another step already owns. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function FramingSection({ target }: { target: MissionTarget }) {
  return (
    <PanelStack>
      <PanelHead eyebrow="Capture · 02" title="Where the frame falls.">
        Move the ground under the square. What is inside it is what your mission captures.
      </PanelHead>

      <PanelGroup label="What the frame gets you">
        <FieldTable>
          <FieldRow label="Ground sample ordered" value={String(CAPTURE_GSD_CM)} unit="cm/px" />
        </FieldTable>

        <p className={cn('max-w-[var(--measure)] pt-4 text-body', INK)}>
          Your print carries the telemetry of the pass that takes it.
        </p>

        <PanelDisclosure className="pt-2" summary="What that figure depends on">
          {CAPTURE_GSD_BASIS}
        </PanelDisclosure>
      </PanelGroup>
    </PanelStack>
  );
}
