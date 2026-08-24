/**
 * /mission — WHICH SPACECRAFT CROSS THIS SKY, AND WHEN.
 *
 * `passes.ts` answers the buyer's question at the resolution they buy at:
 * a calendar day. This module answers the question underneath it — the one
 * that makes a commission legible as a commission rather than as a more
 * expensive print:
 *
 *   Of the eight real satellites this site tracks, which ones actually go
 *   over these coordinates in the next seven days, when is the first of
 *   them, and how high does it climb?
 *
 * Every field below is an SGP4 propagation of a published element set from
 * `lib/integrations/celestrak.ts`, run with the same thresholds
 * (`PASS_MIN_ELEVATION_DEG`, `PASS_SEARCH_HOURS`, `PASS_STEP_SECONDS`) that
 * `captureWindows()` uses, so a satellite list and a window list rendered on
 * the same screen cannot contradict each other.
 *
 * ------------------------------------------------------------------
 * WHAT THIS IS ALLOWED TO SAY, AND WHAT IT IS NOT
 * ------------------------------------------------------------------
 * ALLOWED: "these tracked spacecraft pass over your coordinates, at these
 * instants, reaching these elevations." That is geometry, it is computed
 * here, and it is checkable against any public pass predictor.
 *
 * NOT ALLOWED, and not derivable from anything in this repository:
 *
 *   · Which spacecraft flies the mission. Tasking is brokered at capture
 *     time (`lib/satellites/fleet.ts`) and is very often none of these
 *     eight. No caller may present this list as an assignment.
 *   · A capture-success PROBABILITY. That needs a cloud forecast bound to
 *     a future pass and an operator commitment, and this system has
 *     neither. There is no percentage in the type below, on purpose. What
 *     stands in its place is the re-task guarantee in `lib/guarantees.ts`,
 *     which is a promise the business actually made.
 *
 * ------------------------------------------------------------------
 * WHY THE PHASE FIELDS ARE HERE
 * ------------------------------------------------------------------
 * `meanAnomalyDeg`, `periodMinutes` and `epochMs` are the three numbers
 * <OrbitGlyph /> needs to put its marker where the satellite is in its
 * revolution — the same derivation <FleetTracker /> does. They are sent so
 * the browser can advance the marker on its own clock without shipping the
 * element sets, the catalogue or SGP4 to a phone.
 */

import { fetchFleetElements } from '@/lib/integrations/celestrak';
import { FLEET, fleetMember } from '@/lib/satellites/fleet';
import {
  elementAgeHours,
  epochDate,
  lookAngleAt,
  nextPass,
  periodMinutes,
  toSatrec,
  type Observer,
} from '@/lib/satellites/propagate';
import type { SatRec } from 'satellite.js';
import {
  PASS_MIN_ELEVATION_DEG,
  PASS_SEARCH_HOURS,
  PASS_STEP_SECONDS,
} from './config';

/** One tracked spacecraft, against one set of coordinates. */
export interface OverheadSatellite {
  noradId: number;
  /** From `lib/satellites/fleet.ts`, not from the element set's OBJECT_NAME. */
  name: string;
  operator: string;
  /** Operator-published ground sample distance at nadir. Not measured here. */
  gsd: string;
  access: 'Open data' | 'Commercial tasking';

  /** ISO instant it next clears the threshold over the target. */
  risesAt: string;
  /** Highest elevation that first pass reaches, degrees. */
  peakElevationDeg: number;
  /** Qualifying passes over the target inside the search span. */
  passes: number;
  /** The best elevation any of those passes reaches, degrees. */
  bestElevationDeg: number;
  /** Elevation over the target at `computedAt`. Negative is below horizon. */
  elevationNowDeg: number;

  /** Orbital inclination, degrees. Tilts <OrbitGlyph />'s ring. */
  inclinationDeg: number;
  /** Minutes for one revolution, from the element set's mean motion. */
  periodMinutes: number;
  /** Mean anomaly at epoch, degrees, and the epoch itself in ms. */
  meanAnomalyDeg: number;
  epochMs: number;
  /** Age of this satellite's element set at `computedAt`, hours. */
  elementAgeHours: number;
}

export interface OverheadResult {
  /** The instant the propagation was run. Every figure is relative to it. */
  computedAt: string;
  observer: { lat: number; lon: number };
  /** The two thresholds the figures were produced under. */
  minElevationDeg: number;
  searchHours: number;
  /** How many spacecraft are in the tracked roster at all. */
  tracked: number;
  /** Those with at least one qualifying pass, soonest first. */
  satellites: OverheadSatellite[];
  /** Tracked spacecraft with no qualifying pass in the span. Names only. */
  silent: string[];
  /**
   * The same passes grouped onto UTC calendar days, which is the unit a
   * capture window is sold in. Present so a window row can print how high
   * the best pass of that day actually climbs.
   */
  days: OverheadDay[];
  /** Provenance of the elements, so a screen can attribute rather than assert. */
  elements: {
    source: 'live' | 'snapshot' | 'none';
    obtainedAt: string | null;
    usable: number;
    freshestAgeHours: number | null;
  };
}

/** One UTC day of the tracked fleet's passes over the target. */
export interface OverheadDay {
  /** `YYYY-MM-DD`, UTC. A window is a day, never an instant. */
  date: string;
  /** Qualifying passes by the tracked fleet on that day. */
  passes: number;
  /** The highest elevation any of them reaches, degrees. */
  peakElevationDeg: number;
}

/**
 * HOW HIGH A PASS ACTUALLY CLIMBS.
 *
 * `nextPass()` reports a peak from a 30-second walk, which is right for the
 * countdown it was written for and wrong for a number printed on a purchase
 * screen: a satellite crossing near the zenith moves at about a degree a
 * second, so a 30-second sample can land either side of the apex and
 * under-read it by five to eight degrees. Checked against a 5-second sweep,
 * a day peak of 83° was being reported as 79°.
 *
 * So the apex is found here instead — coarse to locate it, then a
 * one-second sweep across the minute around it, which brings the figure
 * inside a degree of a continuous solution for about a hundred extra
 * propagations per pass. An elevation on a screen that sells sight lines
 * has to be the elevation.
 */
function peakElevation(rec: SatRec, rises: Date, observer: Observer): number {
  const start = rises.getTime();
  let bestT = start;
  let best = -90;

  for (let t = start; t < start + 20 * 60_000; t += 15_000) {
    const e = lookAngleAt(rec, new Date(t), observer)?.elevation ?? -90;
    if (e < 0 && t > start + 60_000) break;
    if (e > best) {
      best = e;
      bestT = t;
    }
  }

  for (let t = bestT - 15_000; t <= bestT + 15_000; t += 1000) {
    const e = lookAngleAt(rec, new Date(t), observer)?.elevation ?? -90;
    if (e > best) best = e;
  }

  return best;
}

/**
 * The tracked fleet's passes over one point.
 *
 * Server-only: `fetchFleetElements()` uses the Next data cache. Never
 * throws — a screen that asked has to be given an answer, and an empty
 * `satellites` list with `usable: 0` is a truthful one.
 */
export async function overheadPasses(
  lat: number,
  lon: number,
  now: Date = new Date(),
): Promise<OverheadResult> {
  const base: OverheadResult = {
    computedAt: now.toISOString(),
    observer: { lat, lon },
    minElevationDeg: PASS_MIN_ELEVATION_DEG,
    searchHours: PASS_SEARCH_HOURS,
    tracked: FLEET.length,
    satellites: [],
    silent: [],
    days: [],
    elements: { source: 'none', obtainedAt: null, usable: 0, freshestAgeHours: null },
  };

  let fleet;
  try {
    fleet = await fetchFleetElements();
  } catch {
    return base;
  }

  const observer = { latitude: lat, longitude: lon, heightM: 0 };
  const satellites: OverheadSatellite[] = [];
  const silent: string[] = [];
  const byDay = new Map<string, { passes: number; peak: number }>();
  let usable = 0;
  let freshestAgeHours: number | null = null;

  for (const element of fleet.elements) {
    const member = fleetMember(element.NORAD_CAT_ID);
    if (!member) continue;

    const rec = toSatrec(element);
    if (!rec) continue;
    usable += 1;

    const age = elementAgeHours(element, now);
    if (freshestAgeHours === null || age < freshestAgeHours) freshestAgeHours = age;

    // The same forward walk `captureWindows()` does, kept per satellite
    // rather than collapsed onto calendar days.
    const end = now.getTime() + PASS_SEARCH_HOURS * 3_600_000;
    let cursor = now;
    let first: { rises: Date; peak: number } | null = null;
    let count = 0;
    let best = 0;

    for (let guard = 0; guard < 64; guard += 1) {
      const remainingHours = (end - cursor.getTime()) / 3_600_000;
      if (remainingHours <= 0) break;

      const pass = nextPass(rec, cursor, observer, {
        minElevation: PASS_MIN_ELEVATION_DEG,
        withinHours: remainingHours,
        stepSeconds: PASS_STEP_SECONDS,
      });
      if (!pass) break;

      const peak = peakElevation(rec, pass.rises, observer);
      if (!first) first = { rises: pass.rises, peak };
      count += 1;
      best = Math.max(best, peak);

      const day = pass.rises.toISOString().slice(0, 10);
      const entry = byDay.get(day) ?? { passes: 0, peak: 0 };
      entry.passes += 1;
      entry.peak = Math.max(entry.peak, peak);
      byDay.set(day, entry);
      // A pass is minutes long and an orbit is about ninety, so clearing
      // twenty minutes cannot skip a second pass and cannot re-find this one.
      cursor = new Date(pass.rises.getTime() + 20 * 60_000);
    }

    if (!first) {
      // A real answer, not a failure: a sun-synchronous satellite genuinely
      // does not cross every point inside a seven-day span.
      silent.push(member.name);
      continue;
    }

    satellites.push({
      noradId: element.NORAD_CAT_ID,
      name: member.name,
      operator: member.operator,
      gsd: member.gsd,
      access: member.access,
      risesAt: first.rises.toISOString(),
      peakElevationDeg: Math.round(first.peak),
      passes: count,
      bestElevationDeg: Math.round(best),
      elevationNowDeg: Math.round(lookAngleAt(rec, now, observer)?.elevation ?? -90),
      inclinationDeg: element.INCLINATION,
      periodMinutes: Math.round(periodMinutes(element) * 10) / 10,
      meanAnomalyDeg: element.MEAN_ANOMALY,
      epochMs: epochDate(element).getTime(),
      elementAgeHours: Math.round(age * 10) / 10,
    });
  }

  satellites.sort((a, b) => a.risesAt.localeCompare(b.risesAt));

  const days: OverheadDay[] = [...byDay.entries()]
    .map(([date, v]) => ({ date, passes: v.passes, peakElevationDeg: Math.round(v.peak) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    ...base,
    satellites,
    silent,
    days,
    elements: {
      source: fleet.source,
      obtainedAt: fleet.obtainedAt,
      usable,
      freshestAgeHours: freshestAgeHours === null ? null : Math.round(freshestAgeHours * 10) / 10,
    },
  };
}
