/**
 * GET /mission/fleet → published orbital elements for the tracked fleet.
 *
 * ------------------------------------------------------------------------
 * WHY THIS EXISTS SEPARATELY FROM `/mission/passes`
 * ------------------------------------------------------------------------
 * `/mission/passes` answers questions the SERVER has already reduced to a
 * result: which calendar days carry a window, how old the elements were when
 * it decided. The Target and Framing sections need something different — the
 * ELEMENT SETS themselves — because what they draw is a live thing:
 *
 *   · the next crossing of the buyer's own sky, propagated over their
 *     coordinates and re-propagated as the clock moves;
 *   · the sky track of that crossing, sampled horizon to horizon;
 *   · the satellite's orbital phase and sub-point, which are what make
 *     <OrbitGlyph /> and <OrbitFigure /> move — they move because the
 *     satellite moves.
 *
 * None of that can be precomputed on the server without freezing it, and
 * SGP4 is cheap enough to run in the browser at 1 Hz (see the note at the
 * head of `lib/satellites/propagate.ts`, which is isomorphic for exactly
 * this reason).
 *
 * WHAT IS SENT is what CelesTrak published, unaltered, plus `source` — live
 * or the bundled snapshot — so the readout can attribute its numbers rather
 * than assert them. Nothing here is invented and nothing is rounded; the
 * sections do their own rounding and print the element age beside it.
 *
 * The element sets are NOT imported into the client bundle. They are
 * fetched, once, by the sections that draw them; a phone that never opens
 * `/mission` never downloads an orbit.
 *
 * ------------------------------------------------------------------------
 * CACHING, AND WHY THERE IS NO `force-dynamic` HERE
 * ------------------------------------------------------------------------
 * CelesTrak is run on donated bandwidth and asks that clients not re-request
 * an element set more often than it changes; `lib/integrations/celestrak.ts`
 * honours that with a three-hour `next.revalidate` on one request covering
 * the whole fleet.
 *
 * `export const dynamic = 'force-dynamic'` would quietly undo it: it flips
 * the default fetch cache to `no-store`, so every page view would open a
 * fresh connection to CelesTrak. This route therefore carries the same three
 * hours instead. It costs nothing: propagation is what makes the readout
 * move, not re-fetching — SGP4 runs against a FIXED element set and produces
 * a new position every second. Nothing here reads a clock, so there is no
 * server instant to go stale either; the browser ages the elements against
 * its own clock and prints how old they are.
 */
import { fetchFleetElements } from '@/lib/integrations/celestrak';

/** Three hours, matching the element set's own revalidation window. */
export const revalidate = 10800;

export async function GET() {
  const fleet = await fetchFleetElements();
  return Response.json({
    source: fleet.source,
    obtainedAt: fleet.obtainedAt,
    elements: fleet.elements,
  });
}
