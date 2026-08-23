/**
 * THE GLOBE — a wireframe Earth with the tracked fleet on it, to scale.
 *
 * Four files and no dependency beyond `satellite.js`, which the repository
 * already pins at 6.0.2:
 *
 *   projection.ts   the entire 3D engine — an orthographic camera as a 3×3
 *                   matrix, plus the occlusion rule that makes a wireframe
 *                   read as a sphere. Eighty lines of arithmetic.
 *   coastline.ts    Natural Earth 110m, simplified and varint-encoded to
 *                   5.7 kB. Public domain, vendored deliberately.
 *   track.ts        one revolution of a real orbit, from the real elements.
 *   LiveGlobe.tsx   the Canvas 2D paint loop, the hit targets and the card.
 *
 * `components/landing/GlobeBand.tsx` is the only consumer on the homepage.
 */
export { LiveGlobe } from './LiveGlobe';
export { EARTH_RADIUS_KM } from './projection';
