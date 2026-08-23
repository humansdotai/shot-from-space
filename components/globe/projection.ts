/**
 * THE PROJECTION — an orthographic globe in about eighty lines of arithmetic.
 *
 * This is the whole reason no 3D library ships with this section. Everything
 * the band draws is a point on, or just above, a sphere; an orthographic
 * camera turns that into two multiplications and a sign test. There is no
 * mesh, no material, no depth buffer and no scene graph, because a wireframe
 * Earth needs none of them.
 *
 * ------------------------------------------------------------------------
 * THE FRAME
 * ------------------------------------------------------------------------
 * Right-handed, Earth-fixed, in units of one Earth radius:
 *
 *   x  towards 0°N 0°E   (the Gulf of Guinea)
 *   y  towards 0°N 90°E  (the Indian Ocean off Sumatra)
 *   z  towards the north pole
 *
 * That is the same convention `satellite.js` hands back from
 * `eciToGeodetic` once it has been read as latitude and longitude, so a
 * sub-point from `lib/satellites/propagate.ts` drops straight in.
 *
 * ------------------------------------------------------------------------
 * THE CAMERA
 * ------------------------------------------------------------------------
 * Orthographic, looking down −y, with +x to the right of the screen and +z
 * up it. Two view angles are applied before that:
 *
 *   YAW    spins the globe about its own polar axis. This is the auto-
 *          rotation and the horizontal drag. It is a CAMERA spin — the
 *          Earth's real rotation is 0.0042°/s and nothing here pretends
 *          otherwise; the satellites are placed from their propagated
 *          latitude and longitude, so they ride the globe correctly
 *          whichever way it is turned.
 *   PITCH  leans the pole towards or away from the viewer. Vertical drag.
 *          Positive brings the north pole forward.
 *
 * Composed once per frame into a 3×3 matrix, so a point costs nine
 * multiplies and six adds and nothing is allocated:
 *
 *   X  screen right      U  screen up      D  towards the viewer
 *
 * ------------------------------------------------------------------------
 * OCCLUSION — the one rule that makes it read as a sphere
 * ------------------------------------------------------------------------
 * Under an orthographic camera a point at radius r is hidden by the unit
 * sphere if and only if it is behind the plane of the limb (D < 0) AND its
 * projection falls inside the limb (X² + U² < 1, both already scaled by r).
 * A satellite at r = 1.11 clears the second test near the edge of the disc,
 * which is exactly right: it stays visible over the horizon for a moment
 * after its sub-point has turned away, because it physically is.
 */

/** A set of polylines on the unit sphere, flattened for the paint loop. */
export type Polylines = {
  /** Unit vectors, three floats per point, x/y/z as described above. */
  xyz: Float32Array;
  /** First point index of each polyline, with a trailing sentinel. */
  bounds: Uint32Array;
};

const DEG = Math.PI / 180; // radians per degree

/** WGS-84 mean radius, kilometres. The scale everything else is quoted in. */
export const EARTH_RADIUS_KM = 6371;

/** Latitude and longitude in degrees to a unit vector, written into `out`. */
export function latLonToUnit(latDeg: number, lonDeg: number, out: Float32Array, at: number): void {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const c = Math.cos(lat);
  out[at] = c * Math.cos(lon);
  out[at + 1] = c * Math.sin(lon);
  out[at + 2] = Math.sin(lat);
}

/**
 * The view matrix, row-major as [X row, D row, U row].
 *
 * Kept as a plain nine-element array the caller owns and reuses, so a frame
 * allocates nothing at all.
 */
export function viewMatrix(yaw: number, pitch: number, out: Float64Array): Float64Array {
  const sa = Math.sin(yaw);
  const ca = Math.cos(yaw);
  const sb = Math.sin(pitch);
  const cb = Math.cos(pitch);

  // X = ca·x − sa·y
  out[0] = ca;
  out[1] = -sa;
  out[2] = 0;
  // D = cb·sa·x + cb·ca·y + sb·z
  out[3] = cb * sa;
  out[4] = cb * ca;
  out[5] = sb;
  // U = −sb·sa·x − sb·ca·y + cb·z
  out[6] = -sb * sa;
  out[7] = -sb * ca;
  out[8] = cb;

  return out;
}

/**
 * A graticule on the unit sphere: meridians every `stepDeg`, parallels every
 * `stepDeg`, each sampled every `sampleDeg`.
 *
 * Built once per mount and then only rotated, which is the point of keeping
 * it in the same flat form as the coastline — one paint routine draws both.
 */
export function graticule(stepDeg = 30, sampleDeg = 3): Polylines {
  const meridians = Math.round(360 / stepDeg);
  const perMeridian = Math.round(180 / sampleDeg) + 1;
  // Parallels stop short of the poles: a parallel at ±90° is a single point.
  const parallelLats: number[] = [];
  for (let lat = -90 + stepDeg; lat <= 90 - stepDeg; lat += stepDeg) parallelLats.push(lat);
  const perParallel = Math.round(360 / sampleDeg) + 1;

  const count = meridians * perMeridian + parallelLats.length * perParallel;
  const xyz = new Float32Array(count * 3);
  const bounds = new Uint32Array(meridians + parallelLats.length + 1);

  let p = 0;
  let line = 0;

  for (let m = 0; m < meridians; m += 1) {
    bounds[line] = p;
    line += 1;
    const lon = -180 + m * stepDeg;
    for (let i = 0; i < perMeridian; i += 1) {
      latLonToUnit(-90 + i * sampleDeg, lon, xyz, p * 3);
      p += 1;
    }
  }

  for (const lat of parallelLats) {
    bounds[line] = p;
    line += 1;
    for (let i = 0; i < perParallel; i += 1) {
      latLonToUnit(lat, -180 + i * sampleDeg, xyz, p * 3);
      p += 1;
    }
  }

  bounds[line] = p;
  return { xyz, bounds };
}
