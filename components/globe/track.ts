import type { SatRec } from 'satellite.js';
import { subPointAt } from '@/lib/satellites/propagate';
import { EARTH_RADIUS_KM, latLonToUnit } from './projection';

/**
 * THE ORBIT TRACK — one full revolution, propagated, not drawn.
 *
 * Every point on this path is an SGP4 solution for a real instant: the same
 * `subPointAt` the card's readout prints, evaluated at 240 times across one
 * orbital period centred on now. Nothing about it is parametric. If the
 * elements say the satellite is retrograde and sun-synchronous at 98°, the
 * path leans the way a 98° orbit leans, and if they say it is decaying the
 * path spirals, because the only input is the propagator.
 *
 * ------------------------------------------------------------------------
 * IT IS AN EARTH-FIXED PATH, AND THAT IS THE HONEST ONE HERE
 * ------------------------------------------------------------------------
 * The globe is Earth-fixed — the coastline does not move under the drawing —
 * so the track has to be too. What that produces is the GROUND TRACK, lifted
 * to the satellite's true altitude at every sample: the familiar sine that
 * walks westward about 24° per revolution because the Earth turned underneath
 * it. It is not the closed ellipse an inertial frame would show, and the
 * caption says which one it is rather than letting the reader assume.
 *
 * ------------------------------------------------------------------------
 * COST
 * ------------------------------------------------------------------------
 * 240 propagations, roughly a millisecond, computed ONCE when a satellite is
 * selected and then only re-projected. It never runs inside the paint loop.
 */

/** Samples across one revolution. 240 puts a vertex every ~24 seconds. */
const SAMPLES = 240;

/**
 * Positions in EARTH RADII, three floats per sample, ordered in time.
 *
 * Earth radii rather than kilometres because that is what the projection
 * consumes: the globe is drawn at radius 1, so a satellite 705 km up is
 * drawn at 1.1107, and the ratio on screen is the ratio in space. Returning
 * kilometres and scaling at the draw site is where that honesty gets lost.
 */
export function orbitTrack(rec: SatRec, at: Date, periodMinutes: number): Float32Array | null {
  if (!(periodMinutes > 0) || !Number.isFinite(periodMinutes)) return null;

  const spanMs = periodMinutes * 60_000;
  const start = at.getTime() - spanMs / 2;
  const step = spanMs / SAMPLES;

  const xyz = new Float32Array((SAMPLES + 1) * 3);
  let written = 0;

  for (let i = 0; i <= SAMPLES; i += 1) {
    const point = subPointAt(rec, new Date(start + i * step));
    if (!point) return null;

    const at3 = written * 3;
    latLonToUnit(point.latitude, point.longitude, xyz, at3);

    const r = 1 + point.altitudeKm / EARTH_RADIUS_KM;
    xyz[at3] *= r;
    xyz[at3 + 1] *= r;
    xyz[at3 + 2] *= r;
    written += 1;
  }

  return xyz;
}
