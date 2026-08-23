import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  ecfToLookAngles,
  eciToEcf,
  gstime,
  json2satrec,
  propagate,
  type SatRec,
} from 'satellite.js';
import type { GpElement } from '@/lib/integrations/celestrak';

/**
 * SGP4 — where a satellite is, from its published elements.
 *
 * Pure, isomorphic, and deliberately so: the server renders the first frame
 * with it and the client re-runs it every second against the SAME element set,
 * so the readout moves without a single extra request to CelesTrak. Nothing in
 * here touches the network, the DOM or a clock it was not handed.
 *
 * ------------------------------------------------------------------------
 * WHAT THESE NUMBERS ARE — AND ARE NOT
 * ------------------------------------------------------------------------
 * They are a PROPAGATION, not telemetry. Nobody is downlinking a position to
 * this page. SGP4 is an analytic model run forward from an element set that
 * was fitted at a stated epoch, and its error grows with the time since that
 * epoch — on the order of a kilometre or so per day for objects in low Earth
 * orbit, more for anything actively manoeuvring.
 *
 * That is why every readout built on this module prints the element epoch and
 * its age in hours, and why `elementAgeHours` is exported alongside the
 * position rather than hidden. A sub-point quoted to three decimal places
 * with no indication that its elements are four days old is a false precision
 * this page refuses to offer.
 *
 * ------------------------------------------------------------------------
 * FRAMES
 * ------------------------------------------------------------------------
 * SGP4 returns TEME — an inertial frame the Earth rotates inside. Converting
 * it takes Greenwich mean sidereal time for the instant in question:
 *
 *   subpoint    ECI -> geodetic directly, giving latitude, longitude, height
 *   look angles ECI -> ECF first, because an observer standing on the ground
 *               rotates with it, then ECF -> azimuth / elevation / range
 *
 * Using the wrong one is the classic error and it does not look wrong: it
 * produces plausible numbers that are silently hours out of phase.
 *
 * ------------------------------------------------------------------------
 * WHY satellite.js IS PINNED TO 6.0.2 AND MUST NOT BE RANGED UP TO 7
 * ------------------------------------------------------------------------
 * 7.x ships ESM-only with an "exports" map that declares "import" and
 * "module-sync" and NO "default" condition. Turbopack cannot resolve that for
 * the client graph, and it does not error — it stalls. A trivial client
 * component containing nothing but an import of the package hangs
 * "Compiling /route ..." indefinitely; the dev server stays up and every
 * other route keeps serving, so it presents as one page mysteriously never
 * responding rather than as a build failure. transpilePackages does not fix
 * it. This was diagnosed by bisecting to a two-line probe route.
 *
 * 6.0.2 carries the same API surface this module uses — json2satrec included
 * — with a classic main + module dual build, and compiles in under two
 * seconds. The version is pinned exactly, not caret-ranged, so that a future
 * "npm install" cannot quietly reintroduce a hang that looks like a network
 * problem.
 */

/** Everything a card shows about where a satellite is right now. */
export type SubPoint = {
  /** Degrees north, positive. */
  latitude: number;
  /** Degrees east, positive, normalised to -180..180. */
  longitude: number;
  /** Height above the WGS-84 ellipsoid, kilometres. */
  altitudeKm: number;
  /** Inertial speed, kilometres per second. */
  speedKmS: number;
};

/** Where a satellite is in an observer's sky. */
export type LookAngle = {
  /** Degrees above the horizon. Negative means below it. */
  elevation: number;
  /** Degrees clockwise from true north. */
  azimuth: number;
  /** Slant range, kilometres. */
  rangeKm: number;
};

export type Observer = {
  latitude: number;
  longitude: number;
  /** Metres above the ellipsoid. Zero is fine for this purpose. */
  heightM?: number;
};

const DEG = Math.PI / 180;

/**
 * Element set -> propagator.
 *
 * `json2satrec` consumes the OMM/GP record CelesTrak serves directly, so no
 * TLE line is ever assembled or parsed here — the fixed-column TLE format is
 * the single most error-prone step in this whole pipeline and it is skipped.
 */
export function toSatrec(element: GpElement): SatRec | null {
  try {
    const rec = json2satrec(element as unknown as Parameters<typeof json2satrec>[0]);
    // satrec.error is non-zero when the elements are unusable (a decayed
    // object, an out-of-range eccentricity). Those must not reach a readout.
    return rec && rec.error === 0 ? rec : null;
  } catch {
    return null;
  }
}

/**
 * CelesTrak stamps EPOCH as UTC but writes it without a zone designator, so
 * `new Date()` would read it as LOCAL time. In a UTC+3 browser that is a
 * three-hour error in the element age, and a silent one.
 */
export function epochDate(element: GpElement): Date {
  const raw = element.EPOCH;
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`);
}

/** Hours between the element set's fit epoch and `now`. Can exceed 24. */
export function elementAgeHours(element: GpElement, now: Date): number {
  return (now.getTime() - epochDate(element).getTime()) / 3_600_000;
}

/** Orbital period in minutes, from the mean motion in revolutions per day. */
export function periodMinutes(element: GpElement): number {
  return element.MEAN_MOTION > 0 ? 1440 / element.MEAN_MOTION : 0;
}

/** Longitude wrapped to -180..180. `degreesLong` can return just over 180. */
function wrapLongitude(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

/** Where the satellite is over the Earth at `when`, or null if unpropagatable. */
export function subPointAt(rec: SatRec, when: Date): SubPoint | null {
  try {
    const pv = propagate(rec, when);
    if (!pv?.position || !pv.velocity) return null;

    const geo = eciToGeodetic(pv.position, gstime(when));
    const { x, y, z } = pv.velocity;

    return {
      latitude: degreesLat(geo.latitude),
      longitude: wrapLongitude(degreesLong(geo.longitude)),
      altitudeKm: geo.height,
      speedKmS: Math.sqrt(x * x + y * y + z * z),
    };
  } catch {
    return null;
  }
}

/** The satellite's position in an observer's sky at `when`. */
export function lookAngleAt(rec: SatRec, when: Date, observer: Observer): LookAngle | null {
  try {
    const pv = propagate(rec, when);
    if (!pv?.position) return null;

    // ECI -> ECF before look angles: the observer rotates with the Earth.
    const ecf = eciToEcf(pv.position, gstime(when));
    const angles = ecfToLookAngles(
      {
        latitude: observer.latitude * DEG,
        longitude: observer.longitude * DEG,
        height: (observer.heightM ?? 0) / 1000,
      },
      ecf,
    );

    return {
      elevation: angles.elevation / DEG,
      azimuth: ((angles.azimuth / DEG) % 360 + 360) % 360,
      rangeKm: angles.rangeSat,
    };
  } catch {
    return null;
  }
}

/**
 * The next time the satellite clears `minElevation` degrees over the observer.
 *
 * Coarse-to-fine: a 60-second sweep to find the first step that is above the
 * threshold, then eight bisections to pull the crossing to about a quarter of
 * a second. A pure fine sweep over the same window would be sixty times the
 * work for precision that no readout on this site prints.
 *
 * Returns null when nothing rises within `withinHours` — which is a real
 * answer, not a failure. A sun-synchronous satellite genuinely does not pass
 * over every point every day, and the copy that consumes this says so rather
 * than showing a dash.
 */
export function nextPass(
  rec: SatRec,
  from: Date,
  observer: Observer,
  { minElevation = 10, withinHours = 24, stepSeconds = 60 } = {},
): { rises: Date; peakElevation: number } | null {
  const start = from.getTime();
  const end = start + withinHours * 3_600_000;
  const step = stepSeconds * 1000;

  let previous = start;
  let previousUp = (lookAngleAt(rec, from, observer)?.elevation ?? -90) >= minElevation;

  for (let t = start + step; t <= end; t += step) {
    const when = new Date(t);
    const elevation = lookAngleAt(rec, when, observer)?.elevation ?? -90;
    const up = elevation >= minElevation;

    if (up && !previousUp) {
      // Bisect the bracket [previous, t] onto the crossing.
      let lo = previous;
      let hi = t;
      for (let i = 0; i < 8; i += 1) {
        const mid = (lo + hi) / 2;
        const e = lookAngleAt(rec, new Date(mid), observer)?.elevation ?? -90;
        if (e >= minElevation) hi = mid;
        else lo = mid;
      }

      /*
         THE APEX, COARSE THEN REFINED.

         A 30-second walk alone under-reads exactly the passes that matter
         most. Elevation moves fastest at culmination, so a near-zenith pass
         can rise and fall several degrees between two samples: an 83 degree
         overhead pass was being reported as 79. The error is largest at the
         top of the range and vanishes on a graze, which is the worst possible
         shape for a figure a buyer reads as "how good is this pass".

         So: sweep at 30 s to bracket the maximum, then ternary-search the
         bracket. Elevation over a single pass is unimodal — it rises once,
         culminates once, sets once — which is the precondition ternary search
         needs, and it holds here because the bracket never spans two passes.
         Forty iterations shrink a 60-second bracket to well under a
         millisecond; the loop is capped far below that at 24, which already
         resolves the apex to about a hundredth of a second.
      */
      let peak = minElevation;
      let peakAt = hi;
      for (let p = hi; p < hi + 20 * 60_000; p += 30_000) {
        const e = lookAngleAt(rec, new Date(p), observer)?.elevation ?? -90;
        if (e < 0) break;
        if (e > peak) {
          peak = e;
          peakAt = p;
        }
      }

      // The apex lies within one sample either side of the best sample.
      let lo2 = peakAt - 30_000;
      let hi2 = peakAt + 30_000;
      for (let i = 0; i < 24 && hi2 - lo2 > 10; i += 1) {
        const m1 = lo2 + (hi2 - lo2) / 3;
        const m2 = hi2 - (hi2 - lo2) / 3;
        const e1 = lookAngleAt(rec, new Date(m1), observer)?.elevation ?? -90;
        const e2 = lookAngleAt(rec, new Date(m2), observer)?.elevation ?? -90;
        if (e1 < e2) lo2 = m1;
        else hi2 = m2;
      }
      const refined = lookAngleAt(rec, new Date((lo2 + hi2) / 2), observer)?.elevation ?? -90;
      if (refined > peak) peak = refined;

      return { rises: new Date(hi), peakElevation: peak };
    }

    previous = t;
    previousUp = up;
  }

  return null;
}
