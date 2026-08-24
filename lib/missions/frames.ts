/**
 * Frame selection.
 *
 * In mock mode there is no real capture, so every mission is backed by a
 * public-domain frame from lib/imagery.ts. The choice is deterministic —
 * the geographically nearest catalogue frame to the target — so a mission's
 * imagery never changes between requests, restarts or reseeds.
 *
 * In live mode this is replaced by the downlinked SkyFi capture:
 * lib/integrations/skyfi.ts `fetchCapture()` returns the real asset URL and
 * `imagerySlug` becomes irrelevant.
 */
import { CATALOGUE, HERO_FRAME, type CatalogueFrame } from '@/lib/imagery';

/** Great-circle distance in km. Standard haversine. */
export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Plausibility score for using `frame` to represent a target. Lower is better.
 *
 * Distance is the main term, but a raw nearest-neighbour search over a
 * 13-frame catalogue produces the occasional absurdity — an arctic river delta
 * is geometrically closest to Tokyo, and it does not read as a city from
 * orbit. So a frame more than 15° of latitude away from the target picks up a
 * penalty: latitude band is a good proxy for how the ground looks.
 */
function frameScore(lat: number, lon: number, frame: CatalogueFrame): number {
  const km = haversineKm(lat, lon, frame.lat, frame.lon);
  const latGap = Math.max(0, Math.abs(lat - frame.lat) - 15);
  return km + latGap * 120;
}

/**
 * The most plausible catalogue frame for a target. Deterministic: the slug is
 * the tiebreak, so a tie never flips between calls or between processes.
 */
export function pickFrameForCoords(lat: number, lon: number): CatalogueFrame {
  let best = HERO_FRAME;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const frame of CATALOGUE) {
    const score = frameScore(lat, lon, frame);
    if (score < bestScore - 0.0001 || (Math.abs(score - bestScore) <= 0.0001 && frame.slug < best.slug)) {
      best = frame;
      bestScore = score;
    }
  }
  return best;
}

/** Convenience: the slug only. */
export function pickFrameSlugForCoords(lat: number, lon: number): string {
  return pickFrameForCoords(lat, lon).slug;
}

/** Distance in km from a target to the frame that will represent it. */
export function frameDistanceKm(lat: number, lon: number): number {
  const f = pickFrameForCoords(lat, lon);
  return haversineKm(lat, lon, f.lat, f.lon);
}
