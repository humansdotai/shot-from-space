/**
 * /mission — what the reveal is actually showing.
 *
 * MOCK MODE. No keyed tile provider is configured, so there is no
 * satellite basemap to zoom into. What exists instead is
 * `/api/geocode/static`, which crops the nearest public-domain archive
 * scene from `lib/imagery.ts` — real Landsat/USGS frames with real,
 * sourced acquisition dates — deterministically per coordinate.
 *
 * This module answers the only question screen 1 is allowed to answer
 * out loud: WHAT IS THIS PICTURE. It returns the scene's own city, its
 * own acquisition date at the precision its own record supports, how far
 * the scene is from the target, and whether that distance is close
 * enough for the date to be quoted as the archive date over the buyer's
 * coordinates at all.
 *
 * Beyond `ARCHIVE_MATCH_RADIUS_KM` the frame is a stand-in for somewhere
 * else, so no date is quoted and screen 1 says the imagery is undated.
 * Under it the scene plausibly contains the target and its date is
 * stated. In BOTH cases screen 1 prints `REVEAL_SOURCE_NOTICE`, because
 * the crop is not geo-registered either way and that is not a detail to
 * bury.
 */

import { acquisitionLabel } from '@/lib/imagery';
import { frameDistanceKm, pickFrameForCoords } from '@/lib/missions/frames';
import { ARCHIVE_MATCH_RADIUS_KM } from './config';

export interface SceneInfo {
  slug: string;
  city: string;
  countryCode: string;
  /** Kilometres between the target and the centre of the scene. */
  distanceKm: number;
  /** True when the scene plausibly covers the target. */
  matched: boolean;
  /**
   * The scene's own acquisition date, formatted at the precision its
   * record supports. Null when the record states none, and null when the
   * scene is a stand-in — there is no archive date for that place to give.
   */
  acquired: string | null;
  /** Platform the scene was taken from, and its published altitude. */
  sensor: string;
  altitudeKm: number;
  /** Where the frame came from. Printed as the provenance link. */
  credit: string;
}

export function sceneFor(lat: number, lon: number): SceneInfo {
  const frame = pickFrameForCoords(lat, lon);
  const distanceKm = frameDistanceKm(lat, lon);
  const matched = distanceKm <= ARCHIVE_MATCH_RADIUS_KM;
  const label = acquisitionLabel(frame.acquired);

  return {
    slug: frame.slug,
    city: frame.city,
    countryCode: frame.countryCode,
    distanceKm: Math.round(distanceKm),
    matched,
    acquired: matched && frame.acquired.date && frame.acquired.precision !== 'UNKNOWN' ? label : null,
    sensor: frame.orbit.sensor,
    altitudeKm: frame.orbit.altitudeKm,
    credit: frame.credit,
  };
}
