/**
 * Deterministic pass telemetry.
 *
 * Every number a customer sees beside their frame — sensor, inclination,
 * ground track, altitude, GSD, azimuth, off-nadir, cloud — is generated here
 * from the mission code. Same code in, same numbers out, forever: the demo
 * survives a restart, a reseed and a screenshot taken three days apart.
 *
 * In live mode these values are overwritten by whatever the constellation
 * operator actually reports (see lib/integrations/skyfi.ts).
 */
import { seededUnit } from '@/lib/utils';
import { CLOUD_THRESHOLD_PCT } from '@/lib/guarantees';
import type { OrbitData } from '@/lib/types';

/** Deterministic integer in [min, max] from a seed. */
export function seededInt(seed: string, min: number, max: number): number {
  return min + Math.floor(seededUnit(seed) * (max - min + 1));
}

/** Deterministic float in [min, max] rounded to `dp` decimals. */
export function seededFloat(seed: string, min: number, max: number, dp = 1): number {
  const v = min + seededUnit(seed) * (max - min);
  return Number(v.toFixed(dp));
}

/** Deterministic pick from a list. */
export function seededPick<T>(seed: string, items: readonly T[]): T {
  return items[Math.floor(seededUnit(seed) * items.length) % items.length];
}

/**
 * The commercial very-high-resolution optical sensors a tasking broker would
 * realistically assign. Designations are generic on purpose — no third-party
 * constellation names appear anywhere in the product.
 */
const SENSORS = [
  'HR / OPTICAL',
  'VHR / OPTICAL',
  'HR2 / PAN+MS',
] as const;

/** Sun-synchronous inclinations cluster tightly around 97–98.7°. */
const INCLINATIONS = ['SSO 97.4°', 'SSO 97.9°', 'SSO 98.2°', 'SSO 98.6°'] as const;

/**
 * Full orbit block for a mission. `cloudPct` here is the FORECAST made when
 * the collection is booked, so it may legitimately sit above the published
 * threshold — that is what a re-task is for. The value measured on the frame
 * we actually keep is `missionCaptureCloudPct()` below, which cannot.
 */
export function missionTelemetry(code: string): OrbitData {
  const c = code.toUpperCase();
  const sensor = seededPick(`sensor:${c}`, SENSORS);
  return {
    sensor,
    inclination: seededPick(`incl:${c}`, INCLINATIONS),
    // The house format for a ground track, e.g. "//ELIPSE 33°".
    track: `//ELIPSE ${seededInt(`track:${c}`, 18, 62)}°`,
    altitudeKm: seededInt(`alt:${c}`, 450, 620),
    // VHR sensors resolve 0.3–0.7 m; the PAN+MS bird is a touch coarser.
    gsdM: sensor === 'VHR / OPTICAL'
      ? seededFloat(`gsd:${c}`, 0.3, 0.4, 2)
      : seededFloat(`gsd:${c}`, 0.45, 0.75, 2),
    azimuthDeg: seededInt(`az:${c}`, 82, 148),
    offNadirDeg: seededFloat(`nadir:${c}`, 1.2, 12.4, 1),
    cloudPct: seededInt(`cloud:${c}`, 0, 24),
  };
}

/**
 * Cloud measured on the frame that was KEPT.
 *
 * The guarantee is that cloud above CLOUD_THRESHOLD_PCT over the target fails
 * the frame and the pass is re-tasked, so an accepted capture can never report
 * more than the threshold. Generating this from the same 0–24% range as the
 * forecast is what produced missions displayed as accepted at 14% and 21% on
 * a site promising that 10% fails — the contradiction the customer can see.
 */
export function missionCaptureCloudPct(code: string): number {
  return seededInt(`cloudcap:${c(code)}`, 0, CLOUD_THRESHOLD_PCT);
}

/**
 * A plausible collection window: opens 2–5 days after tasking is accepted and
 * stays open for 7–14 days, which is what a real revisit schedule over a
 * single point looks like at these inclinations.
 */
export function missionCaptureWindow(code: string, from: Date = new Date()) {
  const c = code.toUpperCase();
  const day = 86_400_000;
  const opensInDays = seededInt(`winopen:${c}`, 2, 5);
  const lengthDays = seededInt(`winlen:${c}`, 7, 14);
  const opensAt = new Date(from.getTime() + opensInDays * day);
  // Windows open on the morning descending node, not at a random minute.
  opensAt.setUTCHours(seededInt(`winhour:${c}`, 8, 11), seededInt(`winmin:${c}`, 0, 59), 0, 0);
  const closesAt = new Date(opensAt.getTime() + lengthDays * day);
  return { opensAt, closesAt, lengthDays };
}

/** Number of scheduled passes across the window — shown in the timeline. */
export function missionPassCount(code: string): number {
  return seededInt(`passes:${c(code)}`, 3, 7);
}

function c(code: string) {
  return code.toUpperCase();
}
