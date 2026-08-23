/**
 * GET /mission/passes?op=windows&lat&lon  → the capture windows for screen 7
 * GET /mission/passes?op=fleet           → what the fleet elements are right now
 * GET /mission/passes?op=overhead&lat&lon → which tracked spacecraft cross that sky
 *
 * Screen 7 shows two sequential steps and each one is a real request that
 * does real work. Neither is a timer.
 *
 *   `windows` runs SGP4 over the buyer's coordinates against published
 *   orbital elements and returns the calendar days a tracked satellite is
 *   actually above their horizon. This is the slow one; it is slow because
 *   it is propagating.
 *
 *   `fleet` reports which element sets are usable and how old they are, so
 *   the screen can say where its dates came from instead of implying a
 *   booking system that does not exist.
 *
 * It lives inside `app/mission` because the propagator and the CelesTrak
 * client are server-only — the element sets and the 13-frame imagery
 * catalogue have no business in a phone's JavaScript bundle.
 */
import { z } from 'zod';
import { FLEET } from '@/lib/satellites/fleet';
import { captureWindows } from '@/lib/mission-flow/passes';
import { overheadPasses } from '@/lib/mission-flow/overhead';

/*
   NO `force-dynamic`, AND THAT IS DELIBERATE.

   This handler reads `lat`/`lon` off the request, so Next already treats it
   as dynamic — the directive bought nothing. What it DID do is flip the
   default fetch cache to `no-store`, which reaches inside
   `fetchFleetElements()` and cancels the three-hour `next.revalidate` on the
   CelesTrak request. CelesTrak runs on donated bandwidth and asks that
   clients not re-request an element set more often than it changes;
   `lib/integrations/celestrak.ts` is written around that promise and this
   directive was quietly breaking it.

   Re-fetching buys nothing anyway: propagation is what makes a readout move,
   not re-fetching. SGP4 runs against a FIXED element set and yields a new
   position every second, and the browser ages those elements against its own
   clock and prints how old they are.

   `app/mission/fleet/route.ts` carries the same reasoning at more length.
*/
export const revalidate = 10800;

const Query = z.object({
  op: z.enum(['windows', 'fleet', 'overhead']).default('windows'),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
});

function bad(detail: string) {
  return Response.json({ error: 'INVALID_QUERY', detail }, { status: 400 });
}

export async function GET(req: Request) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) {
    return bad('Required: op=windows or op=overhead with lat and lon, or op=fleet.');
  }

  const { op, lat, lon } = parsed.data;

  if (op === 'fleet') {
    // The roster is a fixed, documented list of real spacecraft; the
    // provenance of their elements is not, so it is computed rather than
    // asserted. `captureWindows` is not called here — a fleet reading is
    // about the constellation, not about anyone's coordinates.
    const { elements } = await captureWindows(0, 0, new Date());
    return Response.json({
      tracked: FLEET.length,
      source: elements.source,
      obtainedAt: elements.obtainedAt,
      usable: elements.usable,
      freshestAgeHours: elements.freshestAgeHours,
    });
  }

  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return bad(`op=${op} requires lat and lon.`);
  }

  /* THE SAME PROPAGATION, AT TWO RESOLUTIONS.
     `windows` groups the passes onto the calendar days a buyer can commit
     to; `overhead` keeps them per spacecraft, which is what shows a
     commission is a tasking rather than a more expensive print. Both run
     the SGP4 walk under the same thresholds from `mission-flow/config.ts`,
     so a screen may render them side by side without them disagreeing. */
  try {
    const result = op === 'overhead' ? await overheadPasses(lat, lon) : await captureWindows(lat, lon);
    return Response.json(result);
  } catch (err) {
    console.error('[mission/passes]', err);
    // The screen has to render something true; an error here is reported
    // as an error, not papered over with plausible dates.
    return Response.json(
      { error: 'PASS_SEARCH_FAILED', detail: 'Pass windows could not be computed.' },
      { status: 503 },
    );
  }
}
