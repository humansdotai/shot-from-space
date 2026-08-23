/**
 * /mission — arriving.
 *
 * The homepage section sends `/mission?address=…&lat=…&lon=…`. Nothing
 * else is required and nothing else is read. All three can be absent, in
 * which case screen 1 asks for a place instead of revealing one; a
 * malformed lat/lon is treated exactly like an absent one.
 */

import { LANDMARKS } from './config';
import type { MissionTarget } from './state';
import { isFutureIsoDate, isLatitude, isLongitude } from './state';

export const PARAM_ADDRESS = 'address';
export const PARAM_LAT = 'lat';
export const PARAM_LON = 'lon';
/** `?from=YYYY-MM-DD` — the earliest capture date the buyer will accept.
 *  Absent means first available, which is also what an unusable value
 *  degrades to. */
export const PARAM_FROM = 'from';
/** `?step=` — the screen, so Back and Forward walk the flow. */
export const PARAM_STEP = 'step';

function num(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * A target from the query string, or null. Both coordinates must be
 * present and in range: half a fix is not a place, and quietly defaulting
 * the missing half would point the satellite at the wrong ground.
 */
export function targetFromSearch(search: URLSearchParams): MissionTarget | null {
  const lat = num(search.get(PARAM_LAT));
  const lon = num(search.get(PARAM_LON));
  if (!isLatitude(lat) || !isLongitude(lon)) return null;

  const label = (search.get(PARAM_ADDRESS) ?? '').trim();
  return {
    label: label ? label.slice(0, 200) : formatDecimal(lat, lon),
    lat,
    lon,
    address: null,
  };
}

/**
 * The earliest acceptable capture date from the query string, or null.
 *
 * NULL IS THE SAFE ANSWER AND IT IS WHAT EVERY FAILURE RETURNS — absent,
 * malformed, a date behind us, a date beyond the horizon, or a
 * well-shaped impossible one like `2026-02-30`. The degrade is "first
 * available", which is the default the flow already handles and the only
 * mode the system can speak about with confidence. Throwing, or carrying
 * a stale date into the Window section, would both be worse: one breaks
 * the arrival, the other quietly skips windows the buyer could have had.
 */
export function earliestFromSearch(search: URLSearchParams): string | null {
  const raw = search.get(PARAM_FROM);
  return isFutureIsoDate(raw) ? raw : null;
}

/** `51.5074° N, 0.1278° W` — the fallback label when no address was sent. */
export function formatDecimal(lat: number, lon: number, dp = 4): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(dp)}° ${ns}, ${Math.abs(lon).toFixed(dp)}° ${ew}`;
}

/** The same pair set for a telemetry line: no comma, uppercase hemispheres. */
export function telemetryCoords(lat: number, lon: number, dp = 4): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(dp)}° ${ns} ${Math.abs(lon).toFixed(dp)}° ${ew}`;
}

/* ------------------------------------------------------------------ */
/* Landmarks                                                           */
/* ------------------------------------------------------------------ */

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * One line of recognition when the target is somewhere the reader would
 * already know the name of. Nearest wins; nothing is returned when the
 * target is not inside any landmark's stated radius.
 */
export function landmarkFor(lat: number, lon: number): (typeof LANDMARKS)[number] | null {
  let best: (typeof LANDMARKS)[number] | null = null;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const l of LANDMARKS) {
    const km = haversineKm(lat, lon, l.lat, l.lon);
    if (km <= l.radiusKm && km < bestKm) {
      best = l;
      bestKm = km;
    }
  }
  return best;
}
