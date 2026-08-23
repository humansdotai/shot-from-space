/**
 * THE SKY FIGURE — the geometry behind every orbit drawing on the file.
 *
 * ==================================================================
 * WHY THIS FILE EXISTS
 * ==================================================================
 * <SearchingForPass /> used to carry this arithmetic inline. It is now
 * shared with <SkyFigure />, which draws the same camera at four times the
 * size and adds a second layer to it — the REAL tracked fleet, propagated
 * from published orbital elements. One camera, one projection, one set of
 * constants, so the small figure and the large one can never disagree about
 * where the target is or which way the plane leans.
 *
 * Nothing in here reads a clock, touches the DOM or fetches anything. It is
 * pure arithmetic and it runs identically on the server and in the browser —
 * which is what lets the first paint be a real frame rather than a hole.
 *
 * ==================================================================
 * THE TWO THINGS DRAWN, AND WHERE EACH COMES FROM
 * ==================================================================
 *   THE PLANE     `buildGeometry()`. The orbit plane THIS mission is tasked
 *                 on, derived from the record: inclination, altitude, the
 *                 look azimuth and the off-nadir angle. It is a PLANE, not a
 *                 position — a static drawing of the geometry the pass will
 *                 be made under, and the same derivation <OrbitPlot /> uses.
 *
 *   THE FLEET     `fleetPoint()`. Real spacecraft at real propagated
 *                 sub-points. `subPointAt()` from lib/satellites/propagate
 *                 against the CelesTrak element set — the same call, the
 *                 same numbers, as <LiveGlobe /> and <FleetTracker />. The
 *                 marker moves because the satellite moves.
 *
 * NEITHER IS A CLAIM THAT A NAMED SPACECRAFT IS FLYING THIS MISSION. Tasking
 * is brokered at capture time and the file never names one; see the header of
 * `lib/satellites/fleet.ts`. What the drawing says is "this is the sky over
 * your target", which is true and checkable.
 *
 * ==================================================================
 * ALTITUDE IS EXAGGERATED, RADIALLY, BY A STATED FACTOR
 * ==================================================================
 * Low Earth orbit is a skin: 500 km on a 6371 km planet is 1.08 R, which at
 * this drawing size is a hairline outside the limb and unreadable. Both
 * layers are lifted by the SAME linear factor (ALT_EXAGGERATION), so the
 * fleet and the tasked plane stay comparable and a higher orbit still draws
 * higher than a lower one.
 *
 * The exaggeration is RADIAL ONLY. A satellite's angular position — which is
 * the part that means anything, because it is what is under it — is exact.
 */
import { EARTH_RADIUS_KM, crossTrackAngleDeg } from '@/lib/missions/conditions';
import { subPointAt, type SubPoint } from '@/lib/satellites/propagate';
import type { SatRec } from 'satellite.js';

export const RAD = Math.PI / 180;
export const DEG = 180 / Math.PI;

/** Radial exaggeration, both layers. See the note above. */
export const ALT_EXAGGERATION = 7;

/** Camera offset from the target, so the ellipse opens instead of edge-on. */
export const CAMERA_OFFSET_DEG = 32;

/** Drawing box, viewBox units. Square, because the figure is centred. */
export const VIEW = { size: 152, c: 76 } as const;

/** Samples per revolution of the tasked plane. 2° steps. */
export const SAMPLES = 180;

/** Trail dots on the plane marker, in samples behind it. */
export const LAG_1 = 5;
export const LAG_2 = 10;

/** How much of the arc arriving at the capture point is accented. */
export const LEAD_IN_FRACTION = 0.16;

/**
 * THE SHELL THE DRAWING IS SIZED AGAINST, in kilometres.
 *
 * The Earth is drawn small enough that the highest thing on the plate still
 * closes inside the box. That used to be the mission's own orbit — but the
 * figure now also carries the tracked fleet, and the fleet flies HIGHER than
 * a typical tasking: Sentinel-2C is at about 806 km against a mission's
 * 460-620 km. Sizing against the mission alone put the fleet outside the
 * viewBox, where SVG happily draws it and the reader sees satellites in the
 * margins.
 *
 * 820 km is the top of `lib/satellites/fleet.ts` plus a little headroom. It
 * is a DRAWING constant and not a claim: no readout prints it, and a mission
 * flying higher than it still sizes against its own altitude because the
 * maximum of the two is what is used.
 */
export const SHELL_CEILING_KM = 820;

/* ------------------------------------------------------------------ */
/* Vector maths                                                       */
/* ------------------------------------------------------------------ */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export function norm(v: Vec3): Vec3 {
  const m = Math.sqrt(dot(v, v)) || 1;
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

export const scale = (v: Vec3, k: number): Vec3 => ({ x: v.x * k, y: v.y * k, z: v.z * k });

export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

export function fromLatLon(latDeg: number, lonDeg: number): Vec3 {
  const phi = latDeg * RAD;
  const lam = lonDeg * RAD;
  return {
    x: Math.cos(phi) * Math.cos(lam),
    y: Math.cos(phi) * Math.sin(lam),
    z: Math.sin(phi),
  };
}

export function toLatLon(v: Vec3): { lat: number; lon: number } {
  const u = norm(v);
  return { lat: Math.asin(u.z) * DEG, lon: Math.atan2(u.y, u.x) * DEG };
}

/** Initial great-circle bearing from one geographic point to another. */
export function bearing(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): number {
  const p1 = from.lat * RAD;
  const p2 = to.lat * RAD;
  const dl = (to.lon - from.lon) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (((Math.atan2(y, x) * DEG) % 360) + 360) % 360;
}

/** Signed difference between two bearings, −180..180. */
export function bearingDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Three decimals. Every number that reaches an attribute passes through here.
 * `Math.sin` can differ in the last ULP between the server's V8 and the
 * browser's, and React refuses to patch `51.502577388071444` against
 * `51.50257738807145`. Three decimals is far below a subpixel in a 152-unit
 * viewBox drawn at any size this file uses.
 */
export function p3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** The leading number of a house string: "SSO 97.4°" → 97.4. */
export function degreesIn(text: string, fallback: number): number {
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : fallback;
}

/** Position on a circular orbit, in Earth radii. `u` increasing is flight. */
export function orbitPoint(u: number, inc: number, raan: number, radius: number): Vec3 {
  const cu = Math.cos(u);
  const su = Math.sin(u);
  const ci = Math.cos(inc);
  const si = Math.sin(inc);
  const cO = Math.cos(raan);
  const sO = Math.sin(raan);
  return {
    x: radius * (cu * cO - su * ci * sO),
    y: radius * (cu * sO + su * ci * cO),
    z: radius * (su * si),
  };
}

/**
 * The node that puts the orbit plane at signed angular distance `offsetDeg`
 * from the target. N · T = sin i cos φ sin(Ω − λ) + cos i sin φ, set equal to
 * sin(offset) and solved for Ω.
 */
export function raanFor(incRad: number, lat: number, lon: number, offsetDeg: number): number {
  const phi = lat * RAD;
  const lam = lon * RAD;
  const denom = Math.sin(incRad) * Math.cos(phi);
  if (Math.abs(denom) < 1e-9) return lam;
  const s = clamp((Math.sin(offsetDeg * RAD) - Math.cos(incRad) * Math.sin(phi)) / denom, -1, 1);
  return lam + Math.asin(s);
}

/** The `u` at which the orbit passes closest to the target. */
export function closestApproach(inc: number, raan: number, target: Vec3, steps: number) {
  let best = { u: 0, angle: Infinity };
  for (let k = 0; k < steps; k++) {
    const u = (2 * Math.PI * k) / steps;
    const p = norm(orbitPoint(u, inc, raan, 1));
    const angle = Math.acos(clamp(dot(p, target), -1, 1));
    if (angle < best.angle) best = { u, angle };
  }
  return best;
}

/** What `viewBasis` hands back: a point in Earth radii → a point on the plate. */
export interface Projected {
  sx: number;
  sy: number;
  depth: number;
  /** True when the Earth is in the way. */
  occluded: boolean;
}

export type Project = (point: Vec3) => Projected;

/**
 * The camera. Sits CAMERA_OFFSET_DEG off the target, leaning out of the orbit
 * plane, then the whole view is rolled by the house track angle — so the
 * drawing agrees with the `//ELIPSE nn°` the record prints.
 */
export function viewBasis(
  target: Vec3,
  planeNormal: Vec3,
  rollRad: number,
  globeR: number,
): Project {
  const lean = norm(add(planeNormal, scale(target, -dot(planeNormal, target))));
  const v = norm(
    add(
      scale(target, Math.cos(CAMERA_OFFSET_DEG * RAD)),
      scale(lean, Math.sin(CAMERA_OFFSET_DEG * RAD)),
    ),
  );

  const spin: Vec3 = { x: 0, y: 0, z: 1 };
  const upRaw = add(spin, scale(v, -dot(spin, v)));
  const up =
    Math.sqrt(dot(upRaw, upRaw)) < 1e-6 ? norm(cross(v, { x: 1, y: 0, z: 0 })) : norm(upRaw);
  const right = norm(cross(up, v));

  const cr = Math.cos(rollRad);
  const sr = Math.sin(rollRad);

  return function project(point: Vec3): Projected {
    const rx = dot(point, right);
    const ry = dot(point, up);
    const depth = dot(point, v);
    const x = rx * cr - ry * sr;
    const y = rx * sr + ry * cr;
    return {
      sx: VIEW.c + x * globeR,
      sy: VIEW.c - y * globeR,
      depth,
      occluded: depth < 0 && Math.hypot(x, y) < 1,
    };
  };
}

/* ------------------------------------------------------------------ */
/* Path building                                                      */
/* ------------------------------------------------------------------ */

export function polyline(points: { sx: number; sy: number }[]): string {
  if (points.length === 0) return '';
  const head = `M ${p3(points[0].sx)},${p3(points[0].sy)}`;
  const rest = points
    .slice(1)
    .map((pt) => `L ${p3(pt.sx)},${p3(pt.sy)}`)
    .join(' ');
  return `${head}${rest ? ` ${rest}` : ''}`;
}

/** Runs of consecutive points that pass `keep`, as path strings. */
export function runs<T extends { sx: number; sy: number }>(points: T[], keep: (pt: T) => boolean) {
  const out: string[] = [];
  let current: T[] = [];
  for (const pt of points) {
    if (keep(pt)) current.push(pt);
    else {
      if (current.length > 1) out.push(polyline(current));
      current = [];
    }
  }
  if (current.length > 1) out.push(polyline(current));
  return out;
}

/* ------------------------------------------------------------------ */
/* The tasked plane, computed once per mission record                 */
/* ------------------------------------------------------------------ */

export interface Geometry {
  globeR: number;
  orbitFront: string[];
  orbitBack: string[];
  leadIn: string[];
  parallels: string[];
  meridians: string[];
  target: { x: number; y: number };
  /** Flat [x0,y0,x1,y1,…] for SAMPLES points. Read by the frame loop. */
  pts: number[];
  /** Earth in the way, per sample. */
  behind: boolean[];
  /** Parked transforms for the static frame: craft, then the two trail dots. */
  parked: { x: number; y: number }[];
  /** The camera, so the live-fleet layer draws through the same lens. */
  project: Project;
}

export function buildGeometry(
  lat: number,
  lon: number,
  inclination: string,
  track: string,
  altitudeKm: number,
  azimuthDeg: number,
  offNadirDeg: number,
): Geometry {
  const inc = degreesIn(inclination, 97.9) * RAD;
  const rollRad = degreesIn(track, 33) * RAD;
  const crossTrackDeg = crossTrackAngleDeg(offNadirDeg, altitudeKm);

  const target = fromLatLon(lat, lon);
  const targetGeo = { lat, lon };

  /* Which side of the target the track passes. Both signs satisfy the
     cross-track distance; the survivor is the one whose sub-satellite point
     at closest approach actually bears `azimuthDeg` from the target. Read as
     the LOOK azimuth, for the reason OrbitPlot sets out at length. */
  const candidates = [crossTrackDeg, -crossTrackDeg].map((offset) => {
    const node = raanFor(inc, lat, lon, offset);
    const search = closestApproach(inc, node, target, 1440);
    const sub = toLatLon(orbitPoint(search.u, inc, node, 1));
    return {
      raan: node,
      u: search.u,
      error: Math.abs(bearingDelta(bearing(targetGeo, sub), azimuthDeg)),
    };
  });
  const chosen = candidates[0].error <= candidates[1].error ? candidates[0] : candidates[1];

  /* The orbit as a multiple of the Earth's radius, and then the Earth sized
     so that the whole SHELL — this mission's ring and every tracked
     spacecraft above it — closes inside the box with a 6-unit margin. A
     mission at 620 km still draws a bigger ring than one at 460, which is the
     honest way to keep one drawing legible across the constellation; what
     the ceiling fixes is the Earth's size, so the fleet cannot leave the
     plate. See SHELL_CEILING_KM. */
  const orbitRatio = 1 + (Math.max(0, altitudeKm) / EARTH_RADIUS_KM) * ALT_EXAGGERATION;
  const shellRatio =
    1 + (Math.max(altitudeKm, SHELL_CEILING_KM) / EARTH_RADIUS_KM) * ALT_EXAGGERATION;
  const globeR = p3(clamp((VIEW.c - 6) / shellRatio, 22, 46));

  const planeNormal = norm({
    x: Math.sin(inc) * Math.sin(chosen.raan),
    y: -Math.sin(inc) * Math.cos(chosen.raan),
    z: Math.cos(inc),
  });
  const project = viewBasis(target, planeNormal, rollRad, globeR);

  /* Sampled FROM the capture, so index 0 is the closest approach and the
     parked frame needs no arithmetic at all. */
  const samples = Array.from({ length: SAMPLES }, (_, k) => {
    const u = chosen.u + (2 * Math.PI * k) / SAMPLES;
    return project(orbitPoint(u, inc, chosen.raan, orbitRatio));
  });

  const pts: number[] = [];
  const behind: boolean[] = [];
  for (const s of samples) {
    pts.push(p3(s.sx), p3(s.sy));
    behind.push(s.occluded);
  }

  const leadCount = Math.max(4, Math.round(SAMPLES * LEAD_IN_FRACTION));
  const leadSamples = [...samples.slice(SAMPLES - leadCount), samples[0]];

  /* Graticule. Thirty degrees both ways — enough curvature for the disc to
     read as a body at the sizes this figure is actually drawn (208px and up),
     where the old three-parallel version read as a wireframe hoop. It is a
     graticule and not a coastline on purpose: `components/globe/coastline.ts`
     is 2,049 points, which is the right trade for a 600px canvas and the
     wrong one for an inline SVG that has to be serialised into the HTML of
     every mission file. */
  const parallels: string[] = [];
  for (let plat = -60; plat <= 60; plat += 30) {
    const ring = Array.from({ length: 121 }, (_, k) => project(fromLatLon(plat, -180 + k * 3)));
    parallels.push(...runs(ring, (s) => s.depth >= 0));
  }
  const meridians: string[] = [];
  for (let plon = -180; plon < 180; plon += 30) {
    const arc = Array.from({ length: 37 }, (_, k) => project(fromLatLon(-90 + k * 5, plon)));
    meridians.push(...runs(arc, (s) => s.depth >= 0));
  }

  const t = project(target);
  const parkedAt = (index: number) => {
    const i = (((index % SAMPLES) + SAMPLES) % SAMPLES) * 2;
    return { x: pts[i], y: pts[i + 1] };
  };

  return {
    globeR,
    orbitFront: runs(samples, (s) => !s.occluded),
    orbitBack: runs(samples, (s) => s.occluded),
    leadIn: runs(leadSamples, (s) => !s.occluded),
    parallels,
    meridians,
    target: { x: p3(t.sx), y: p3(t.sy) },
    pts,
    behind,
    parked: [parkedAt(0), parkedAt(-LAG_1), parkedAt(-LAG_2)],
    project,
  };
}

/* ------------------------------------------------------------------ */
/* The live fleet, through the same camera                            */
/* ------------------------------------------------------------------ */

/** One tracked spacecraft, placed on the plate at one instant. */
export interface FleetPoint {
  x: number;
  y: number;
  /** True when the Earth is between the camera and the spacecraft. */
  occluded: boolean;
  /** The propagated sub-point itself, unrounded. */
  sub: SubPoint;
}

/**
 * WHERE A REAL SPACECRAFT IS, DRAWN.
 *
 * `subPointAt(rec, when)` and nothing else: the identical call
 * <LiveGlobe /> and <FleetTracker /> make. The geodetic sub-point becomes a
 * unit vector in the Earth-fixed frame the target already lives in, is lifted
 * to `1 + h/R * ALT_EXAGGERATION`, and goes through the same `project`.
 *
 * So the marker's angular position on the plate is the satellite's real
 * angular position relative to the target, exactly. Only the radius is
 * stretched, and it is stretched by the same factor as the tasked plane.
 */
export function fleetPoint(rec: SatRec, when: Date, project: Project): FleetPoint | null {
  const sub = subPointAt(rec, when);
  if (!sub) return null;

  const unit = fromLatLon(sub.latitude, sub.longitude);
  const radius = 1 + (Math.max(0, sub.altitudeKm) / EARTH_RADIUS_KM) * ALT_EXAGGERATION;
  const q = project(scale(unit, radius));

  return {
    x: q.sx,
    y: q.sy,
    occluded: q.occluded,
    sub,
  };
}
