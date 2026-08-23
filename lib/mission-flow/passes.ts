/**
 * /mission — capture windows, computed.
 *
 * Screen 7 is a computation moment, and the computation is real: this
 * module takes the buyer's coordinates, pulls published orbital elements
 * for the tracked fleet from `lib/integrations/celestrak.ts`, and runs
 * the SGP4 propagator in `lib/satellites/propagate.ts` over them to find
 * when a satellite is actually above the horizon at that place.
 *
 * ------------------------------------------------------------------
 * WHAT A WINDOW IS, AND WHAT IT IS NOT
 * ------------------------------------------------------------------
 * A window is a CALENDAR DAY on which the tracked fleet passes high
 * enough over the target to image it. It is geometry, and geometry is
 * the honest part of the promise.
 *
 * It is NOT a booking, NOT a named spacecraft, and NOT a guarantee of
 * weather. The satellite that flies a mission is chosen by the operator
 * at tasking time (see `lib/satellites/fleet.ts`) and is very often none
 * of the eight this site tracks. `PASS_ATTRIBUTION` says exactly that on
 * the screen, next to the dates.
 *
 * ------------------------------------------------------------------
 * WHEN THE ORBITS ARE NOT AVAILABLE
 * ------------------------------------------------------------------
 * CelesTrak already degrades to a bundled snapshot, so real elements are
 * nearly always present. If even the snapshot cannot be propagated — an
 * unusable element set, a decayed object — the windows fall back to the
 * fixed offsets in `INDICATIVE_WINDOW_OFFSET_DAYS`, `indicative` is set,
 * and every surface that renders them prints `INDICATIVE_NOTICE`.
 * Nothing is ever presented as propagated when it was not.
 */

import { fetchFleetElements } from '@/lib/integrations/celestrak';
import { elementAgeHours, nextPass, toSatrec } from '@/lib/satellites/propagate';
import {
  INDICATIVE_WINDOW_OFFSET_DAYS,
  PASS_MIN_ELEVATION_DEG,
  PASS_SEARCH_HOURS,
  PASS_STEP_SECONDS,
  PASS_WINDOW_COUNT,
  TASKING_LEAD_DAYS,
} from './config';

export interface PassWindow {
  /** UTC calendar day of the tasking opportunity, `YYYY-MM-DD`. */
  date: string;
  /** The day the mission has to be commissioned by to make that tasking. */
  commitBy: string;
  /** How many qualifying passes the fleet makes over the target that day. */
  passes: number;
  /** Highest elevation reached that day, degrees. Zero when indicative. */
  peakElevationDeg: number;
}

export interface PassWindowResult {
  windows: PassWindow[];
  /** True when the dates were derived from config rather than propagated. */
  indicative: boolean;
  /** Provenance of the elements, so the screen can print it. */
  elements: {
    source: 'live' | 'snapshot' | 'none';
    obtainedAt: string | null;
    /** How many element sets were usable by SGP4. */
    usable: number;
    /** Age of the freshest element set at computation time, hours. */
    freshestAgeHours: number | null;
  };
}

/** `YYYY-MM-DD` in UTC. Dates here are days, never instants. */
function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDay(d);
}

function indicativeWindows(now: Date): PassWindow[] {
  const today = utcDay(now);
  return INDICATIVE_WINDOW_OFFSET_DAYS.slice(0, PASS_WINDOW_COUNT).map((offset) => {
    const date = addDays(today, offset);
    return { date, commitBy: addDays(date, -TASKING_LEAD_DAYS), passes: 0, peakElevationDeg: 0 };
  });
}

/**
 * The next capture windows over a point.
 *
 * Server-only: `fetchFleetElements()` uses the Next data cache. Never
 * throws — screen 7 has to render an answer either way.
 */
export async function captureWindows(
  lat: number,
  lon: number,
  now: Date = new Date(),
): Promise<PassWindowResult> {
  let fleet;
  try {
    fleet = await fetchFleetElements();
  } catch {
    return { windows: indicativeWindows(now), indicative: true, elements: { source: 'none', obtainedAt: null, usable: 0, freshestAgeHours: null } };
  }

  const observer = { latitude: lat, longitude: lon, heightM: 0 };
  const byDay = new Map<string, { passes: number; peak: number }>();
  let usable = 0;
  let freshestAgeHours: number | null = null;

  for (const element of fleet.elements) {
    const rec = toSatrec(element);
    if (!rec) continue;
    usable += 1;

    const age = elementAgeHours(element, now);
    if (freshestAgeHours === null || age < freshestAgeHours) freshestAgeHours = age;

    // Walk this satellite's passes forward across the search span. The
    // cursor jumps past each rise so the next sweep cannot re-find it.
    let cursor = now;
    const end = now.getTime() + PASS_SEARCH_HOURS * 3_600_000;

    // A LEO satellite makes at most ~15 revolutions a day; the cap is a
    // guard against a pathological element set, not a real limit.
    for (let guard = 0; guard < 64; guard += 1) {
      const remainingHours = (end - cursor.getTime()) / 3_600_000;
      if (remainingHours <= 0) break;

      const pass = nextPass(rec, cursor, observer, {
        minElevation: PASS_MIN_ELEVATION_DEG,
        withinHours: remainingHours,
        stepSeconds: PASS_STEP_SECONDS,
      });
      if (!pass) break;

      const day = utcDay(pass.rises);
      const entry = byDay.get(day) ?? { passes: 0, peak: 0 };
      entry.passes += 1;
      entry.peak = Math.max(entry.peak, pass.peakElevation);
      byDay.set(day, entry);

      // Clear of this pass: a pass is minutes long, an orbit is ~90.
      cursor = new Date(pass.rises.getTime() + 20 * 60_000);
    }
  }

  const today = utcDay(now);
  const windows: PassWindow[] = [...byDay.entries()]
    .map(([date, v]) => ({
      date,
      commitBy: addDays(date, -TASKING_LEAD_DAYS),
      passes: v.passes,
      peakElevationDeg: Math.round(v.peak),
    }))
    // A window whose commissioning deadline is today or already gone is
    // not an offer. `>` rather than `>=` on purpose: these days are UTC
    // and the reader is not, so a deadline that falls on the current UTC
    // day may already be yesterday where they are standing. Dropping it
    // is the honest answer; showing it and hoping is not.
    .filter((w) => w.commitBy > today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, PASS_WINDOW_COUNT);

  const elements = {
    source: fleet.source,
    obtainedAt: fleet.obtainedAt,
    usable,
    freshestAgeHours: freshestAgeHours === null ? null : Math.round(freshestAgeHours * 10) / 10,
  };

  if (windows.length === 0) {
    return { windows: indicativeWindows(now), indicative: true, elements };
  }

  return { windows, indicative: false, elements };
}
