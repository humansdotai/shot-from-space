import { clsx as cn } from 'clsx';
import type { CSSProperties } from 'react';
import {
  EARTH_RADIUS_KM,
  compassPoint,
  crossTrackAngleDeg,
  orbitalPeriodMin,
} from '@/lib/missions/conditions';
import type { MissionDTO } from '@/lib/types';
import { formatCoordsHemisphere } from '@/lib/utils';

/**
 * Ground-following ink and rules, written out rather than imported from
 * `./ui`: that module is `'use client'` and reaches `@/lib/fonts` through
 * `./layout`, and this plot is a pure server-renderable drawing that should
 * not drag `next/font` into every consumer. The values are the same two
 * strings the mission kit uses.
 */
const INK_DIM = 'text-[color:var(--ink-dim)]';
const RULE = 'border-[color:var(--rule)]';

/**
 * THE ORBIT PLOT — the pass, drawn from the mission's own numbers.
 *
 * ==================================================================
 * WHAT THIS IS
 * ==================================================================
 * <OrbitDiagram /> (components/fui) is a 132px garnish: a stylised ellipse
 * with a marker on it. This is the instrument version of the same idea, for
 * the one page that is a flight report — a globe under an orthographic
 * camera, the real orbit plane, the capture point, the pass direction, and
 * the ground track projected on an equirectangular plate beneath with the
 * target marked on it.
 *
 * DENSITY: exactly ONE of these per viewport, and it replaces the
 * <OrbitDiagram /> on any page that carries it. Two orbits on one screen is
 * two claims about where the satellite is.
 *
 * ==================================================================
 * THE GEOMETRY IS REAL. Every line below is derived, not drawn by eye.
 * ==================================================================
 *
 *   ORBIT PLANE      Inclination comes from `mission.orbit.inclination`
 *                    ("SSO 97.9°" → 97.9°). The right ascension of the
 *                    ascending node is SOLVED, not chosen: it is the value
 *                    that puts the ground track past the target at exactly
 *                    the cross-track distance the mission's `offNadirDeg`
 *                    implies (`crossTrackAngleDeg`, standard slant-range
 *                    geometry). A 4.3° off-nadir look at 480 km puts the
 *                    track 0.31° of arc from the target, and that is where
 *                    the drawing puts it.
 *
 *   WHICH SIDE       `mission.orbit.azimuthDeg` is read as the LOOK azimuth
 *                    — the bearing from the target to the spacecraft, which
 *                    is the quantity that pairs with an off-nadir angle. Two
 *                    node solutions satisfy the cross-track distance, one
 *                    either side of the target; the one whose sub-satellite
 *                    point actually bears `azimuthDeg` from the target is the
 *                    one drawn. (It is NOT read as a ground-track heading: a
 *                    sun-synchronous track runs near-polar, and the record's
 *                    82–148° would contradict its own inclination field. The
 *                    look azimuth is the reading that makes the record
 *                    self-consistent, and it is the one the plot uses.)
 *
 *   PERIOD           Kepler, from `altitudeKm`. 520 km → 94.9 min. It is a
 *                    readout AND it is what sets the ground track's westward
 *                    drift between revolutions, so the three tracks on the
 *                    plate are spaced by the Earth's real rotation during one
 *                    real period (~24.8° at 95 minutes).
 *
 *   GROUND TRACK     The sub-satellite point of the same sampled orbit, with
 *                    the Earth turning underneath at 360°/86164 s. The epoch
 *                    is the capture, so the central track passes the target
 *                    by exactly the cross-track distance above.
 *
 * TWO HONEST DISTORTIONS, both stated on the plot itself:
 *   · ALTITUDE IS EXAGGERATED ×7. At true scale a 520 km orbit is a ring 8%
 *     larger than the Earth — a hairline outside the limb, and unreadable.
 *     The exaggeration is linear in altitude, so a 620 km mission still draws
 *     a visibly higher orbit than a 450 km one.
 *   · THE VIEW IS ROLLED by the house track angle (`//ELIPSE 53°` → 53°), the
 *     same number <OrbitDiagram /> tilts by, so the drawing agrees with the
 *     label the poster prints. North is therefore not up on the globe, and
 *     the pole is marked so it can be found. North IS up on the ground plate.
 *
 * ==================================================================
 * MOTION
 * ==================================================================
 * The spacecraft travels the orbit on a CSS motion path — `offset-path`
 * takes the same path string that strokes the track, so it can never drift
 * off its own orbit. `linear`, because an orbit has constant angular
 * character and the house ease would be a lie here.
 *
 * The path STARTS at the capture point, which is what makes reduced motion
 * free: `offset-distance: 0%` is the capture point, so parking the marker is
 * `animation: none` and nothing else. Under `prefers-reduced-motion: reduce`
 * there is NO loop at all — not a slowed one, not a frozen final frame — and
 * the caption says so.
 *
 * ==================================================================
 * HYDRATION
 * ==================================================================
 * Every coordinate that reaches an attribute goes through `p3()`. Math.sin
 * and Math.cos may differ in the last ULP between the server's V8 and the
 * browser's, and `51.502577388071444` vs `51.50257738807145` is a mismatch
 * React refuses to patch. Three decimals is far below a subpixel at every
 * width this renders at, and nothing here reads a clock.
 */

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Sidereal day, seconds — what the ground track's drift is measured against. */
const SIDEREAL_DAY_S = 86_164.0905;

/**
 * Altitude exaggeration. Linear, so relative altitudes survive it. Stated on
 * the plot; see the header.
 */
const ALT_EXAGGERATION = 7;

/**
 * Angle between the camera and the target, degrees. See `viewBasis`.
 *
 * 32° is not a taste decision. The camera sits (90 − this) from the orbit
 * normal, so the projected ellipse has a minor semi-axis of
 * `orbitRadius · cos(58°) ≈ 0.53 · orbitRadius`. Below about 39° that value
 * drops under the Earth's radius, which is what makes part of the ring pass
 * BEHIND the body and gives the drawing its depth. Above it the whole orbit
 * clears the limb and the plot flattens into a ring around a disc.
 */
const CAMERA_OFFSET_DEG = 32;

/** Globe panel, in viewBox units. */
const GLOBE = { w: 640, h: 430, cx: 320, cy: 205, r: 112 } as const;

/** Ground-track plate, in viewBox units. Exactly 2 px per degree, both axes. */
const PLATE = { w: 720, h: 360, cx: 360, cy: 180, perDeg: 2 } as const;

/** Samples per revolution on the drawn orbit. 2.5° in true anomaly. */
const ORBIT_SAMPLES = 144;

/** Samples per revolution on each ground track. */
const TRACK_SAMPLES = 132;

/** How much of the orbit ahead of the capture is drawn as the lead-in. */
const LEAD_IN_FRACTION = 0.17;

/**
 * The width the whole instrument is composed at, across the six steps. The
 * globe, both readout rails, the ground plate and the footnote all take it,
 * so the plot is one column and not four stacked elements of different
 * widths.
 */
const WIDTH =
  'mx-auto w-full max-w-[420px] sm:max-w-[480px] xl:max-w-[560px] 2xl:max-w-[600px] xl2:max-w-[680px] xl3:max-w-[760px]';

/* ------------------------------------------------------------------ */
/* Vector maths                                                       */
/* ------------------------------------------------------------------ */

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

function norm(v: Vec3): Vec3 {
  const m = Math.sqrt(dot(v, v)) || 1;
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

const scale = (v: Vec3, k: number): Vec3 => ({ x: v.x * k, y: v.y * k, z: v.z * k });

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

/** Unit vector for a geographic position. */
function fromLatLon(latDeg: number, lonDeg: number): Vec3 {
  const phi = latDeg * RAD;
  const lam = lonDeg * RAD;
  return {
    x: Math.cos(phi) * Math.cos(lam),
    y: Math.cos(phi) * Math.sin(lam),
    z: Math.sin(phi),
  };
}

/** Geographic position of a unit vector. */
function toLatLon(v: Vec3): { lat: number; lon: number } {
  const u = norm(v);
  return { lat: Math.asin(u.z) * DEG, lon: Math.atan2(u.y, u.x) * DEG };
}

/** Initial great-circle bearing from one geographic point to another. */
function bearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const p1 = from.lat * RAD;
  const p2 = to.lat * RAD;
  const dl = (to.lon - from.lon) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) * DEG) % 360 + 360) % 360;
}

/** Signed difference between two bearings, −180..180. */
function bearingDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

/** Longitude folded into −180..180. */
function wrap180(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

/** Three decimals. Every number that reaches an attribute passes through here. */
function p3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** The leading number of a house string: "SSO 97.9°" → 97.9, "//ELIPSE 53°" → 53. */
function degreesIn(text: string, fallback: number): number {
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : fallback;
}

/* ------------------------------------------------------------------ */
/* Orbit construction                                                 */
/* ------------------------------------------------------------------ */

/**
 * Position on a circular orbit, in Earth radii.
 * `u` is the argument of latitude — the angle travelled from the ascending
 * node — so `u` increasing is the direction of flight.
 */
function orbitPoint(u: number, inc: number, raan: number, radius: number): Vec3 {
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
 * The right ascension of the ascending node that puts the orbit plane at
 * signed angular distance `offsetDeg` from the target.
 *
 * The plane normal is N = (sin i sin Ω, −sin i cos Ω, cos i), so
 *   N · T = sin i cos φt sin(Ω − λt) + cos i sin φt
 * and setting that equal to sin(offset) solves for Ω directly. `offsetDeg`
 * of zero puts the track exactly over the target.
 */
function raanFor(incRad: number, lat: number, lon: number, offsetDeg: number): number {
  const phi = lat * RAD;
  const lam = lon * RAD;
  const denom = Math.sin(incRad) * Math.cos(phi);
  if (Math.abs(denom) < 1e-9) return lam;
  const s = clamp(
    (Math.sin(offsetDeg * RAD) - Math.cos(incRad) * Math.sin(phi)) / denom,
    -1,
    1,
  );
  return lam + Math.asin(s);
}

/**
 * The camera.
 *
 * Looking straight down at the target would put the spacecraft on top of it
 * at closest approach — no altitude visible, no ellipse, nothing to read. The
 * camera therefore sits `CAMERA_OFFSET_DEG` away from the target, tilted out
 * of the orbit plane: the target lands at sin(45°) ≈ 0.71 of the disc radius
 * from centre (well inside the limb) and the orbit is seen 45° off its own
 * normal, which projects the circle to an ellipse of axis ratio cos(45°).
 *
 * `up` is the projected spin axis, so north is up before the roll is applied.
 */
function viewBasis(target: Vec3, planeNormal: Vec3, rollRad: number) {
  // The component of the orbit normal perpendicular to the target, which is
  // the direction the camera leans in.
  const lean = norm(add(planeNormal, scale(target, -dot(planeNormal, target))));
  const v = norm(
    add(scale(target, Math.cos(CAMERA_OFFSET_DEG * RAD)), scale(lean, Math.sin(CAMERA_OFFSET_DEG * RAD))),
  );

  const spin: Vec3 = { x: 0, y: 0, z: 1 };
  const upRaw = add(spin, scale(v, -dot(spin, v)));
  const up = Math.sqrt(dot(upRaw, upRaw)) < 1e-6 ? norm(cross(v, { x: 1, y: 0, z: 0 })) : norm(upRaw);
  const right = norm(cross(up, v));

  const cr = Math.cos(rollRad);
  const sr = Math.sin(rollRad);

  /** World point → screen point, plus depth (positive is toward the camera). */
  return function project(point: Vec3) {
    const rx = dot(point, right);
    const ry = dot(point, up);
    const depth = dot(point, v);
    const x = rx * cr - ry * sr;
    const y = rx * sr + ry * cr;
    return {
      sx: GLOBE.cx + x * GLOBE.r,
      sy: GLOBE.cy - y * GLOBE.r,
      depth,
      /** True when the Earth is in the way. */
      occluded: depth < 0 && Math.hypot(x, y) < 1,
    };
  };
}

type Projected = ReturnType<ReturnType<typeof viewBasis>>;

/* ------------------------------------------------------------------ */
/* Path building                                                      */
/* ------------------------------------------------------------------ */

/** `M x,y L x,y …` for a run of points. `close` appends the Z. */
function polyline(points: { sx: number; sy: number }[], close = false): string {
  if (points.length === 0) return '';
  const head = `M ${p3(points[0].sx)},${p3(points[0].sy)}`;
  const rest = points
    .slice(1)
    .map((pt) => `L ${p3(pt.sx)},${p3(pt.sy)}`)
    .join(' ');
  return `${head}${rest ? ` ${rest}` : ''}${close ? ' Z' : ''}`;
}

/** Runs of consecutive points that pass `keep`, as path strings. */
function runs<T>(points: T[], keep: (pt: T) => boolean, toXY: (pt: T) => { sx: number; sy: number }) {
  const out: string[] = [];
  let current: { sx: number; sy: number }[] = [];
  for (const pt of points) {
    if (keep(pt)) {
      current.push(toXY(pt));
    } else if (current.length > 1) {
      out.push(polyline(current));
      current = [];
    } else {
      current = [];
    }
  }
  if (current.length > 1) out.push(polyline(current));
  return out;
}

/* ------------------------------------------------------------------ */
/* The whole plot, computed once                                      */
/* ------------------------------------------------------------------ */

interface PlotGeometry {
  rollDeg: number;
  periodMin: number;
  /** Angular miss distance between the ground track and the target. */
  crossTrackDeg: number;
  /** The full closed orbit, starting AT the capture point. */
  orbitPath: string;
  orbitFront: string[];
  orbitBack: string[];
  leadIn: string[];
  /** Chevron marking the direction of flight at the capture point. */
  chevron: string;
  capture: Projected;
  targetScreen: Projected;
  poleScreen: Projected | null;
  /** Graticule on the visible hemisphere. */
  parallels: string[];
  meridians: string[];
  /** Ground tracks: the capture revolution and its two neighbours. */
  trackCentre: string[];
  trackNeighbours: string[];
  /** Sub-satellite point at capture, on the plate. */
  subSat: { x: number; y: number };
  targetPlate: { x: number; y: number };
  plateParallels: number[];
  plateMeridians: number[];
  /** Drift in longitude between successive revolutions, degrees. */
  driftDeg: number;
}

function buildGeometry(mission: MissionDTO): PlotGeometry {
  const o = mission.orbit;
  const inclinationDeg = degreesIn(o.inclination, 97.9);
  const rollDeg = degreesIn(o.track, 33);
  const inc = inclinationDeg * RAD;
  const periodMin = orbitalPeriodMin(o.altitudeKm);
  const crossTrackDeg = crossTrackAngleDeg(o.offNadirDeg, o.altitudeKm);

  const target = fromLatLon(mission.lat, mission.lon);
  const targetGeo = { lat: mission.lat, lon: mission.lon };

  /* --- Which side of the target the track passes -------------------- */
  // Both signs satisfy the cross-track distance. The one that survives is the
  // one whose sub-satellite point at closest approach actually bears
  // `azimuthDeg` from the target.
  const candidates = [crossTrackDeg, -crossTrackDeg].map((offset) => {
    const raan = raanFor(inc, mission.lat, mission.lon, offset);
    const search = closestApproach(inc, raan, target, 2880);
    const sub = toLatLon(orbitPoint(search.u, inc, raan, 1));
    const looked = bearing(targetGeo, sub);
    return { raan, u: search.u, error: Math.abs(bearingDelta(looked, o.azimuthDeg)) };
  });
  const chosen = candidates[0].error <= candidates[1].error ? candidates[0] : candidates[1];
  const raan = chosen.raan;

  // The orbit is sampled FROM the capture, so index 0 is the capture point,
  // `offset-distance: 0%` is the capture point, and reduced motion parks the
  // marker there with no arithmetic at all.
  const uCapture = chosen.u;

  const orbitRadius = 1 + (o.altitudeKm / EARTH_RADIUS_KM) * ALT_EXAGGERATION;
  const planeNormal = norm({
    x: Math.sin(inc) * Math.sin(raan),
    y: -Math.sin(inc) * Math.cos(raan),
    z: Math.cos(inc),
  });
  const project = viewBasis(target, planeNormal, rollDeg * RAD);

  /* --- The orbit ---------------------------------------------------- */
  const samples = Array.from({ length: ORBIT_SAMPLES }, (_, k) => {
    const u = uCapture + (2 * Math.PI * k) / ORBIT_SAMPLES;
    return { ...project(orbitPoint(u, inc, raan, orbitRadius)), u };
  });

  const orbitPath = polyline(samples, true);
  const orbitFront = runs(samples, (s) => !s.occluded, (s) => s);
  const orbitBack = runs(samples, (s) => s.occluded, (s) => s);

  // The lead-in is the arc ARRIVING at the capture, i.e. the tail of the
  // sampled loop, closed back onto index 0.
  const leadCount = Math.max(4, Math.round(ORBIT_SAMPLES * LEAD_IN_FRACTION));
  const leadSamples = [...samples.slice(ORBIT_SAMPLES - leadCount), samples[0]];
  const leadIn = runs(leadSamples, (s) => !s.occluded, (s) => s);

  const capture = samples[0];
  const chevron = chevronPath(samples[ORBIT_SAMPLES - 2], capture);

  /* --- The globe ---------------------------------------------------- */
  const parallels: string[] = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    const ring = Array.from({ length: 91 }, (_, k) => project(fromLatLon(lat, -180 + k * 4)));
    parallels.push(...runs(ring, (s) => s.depth >= 0, (s) => s));
  }
  const meridians: string[] = [];
  for (let lon = -180; lon < 180; lon += 30) {
    const arc = Array.from({ length: 37 }, (_, k) => project(fromLatLon(-90 + k * 5, lon)));
    meridians.push(...runs(arc, (s) => s.depth >= 0, (s) => s));
  }

  const targetScreen = project(target);
  const northPole = project({ x: 0, y: 0, z: 1 });
  const poleScreen = northPole.depth >= 0 ? northPole : null;

  /* --- The ground track --------------------------------------------- */
  // The Earth turns under the orbit. The epoch is the capture, so the central
  // track passes the target by exactly `crossTrackDeg`.
  const periodSec = periodMin * 60;
  const rotationPerSecond = 360 / SIDEREAL_DAY_S;
  const driftDeg = p3(rotationPerSecond * periodSec);

  const groundTrack = (revolution: number, count: number) => {
    const pts = Array.from({ length: count + 1 }, (_, k) => {
      const du = 2 * Math.PI * (revolution + k / count - 0.5);
      const u = uCapture + du;
      const seconds = (du / (2 * Math.PI)) * periodSec;
      const geo = toLatLon(orbitPoint(u, inc, raan, 1));
      const lon = wrap180(geo.lon - rotationPerSecond * seconds - mission.lon);
      return {
        x: PLATE.cx + lon * PLATE.perDeg,
        y: PLATE.cy - geo.lat * PLATE.perDeg,
        lon,
      };
    });
    // A track that crosses the plate edge is drawn as two runs, not as one
    // line ripped across the whole chart.
    const out: string[] = [];
    let current: { sx: number; sy: number }[] = [];
    let previous: number | null = null;
    for (const pt of pts) {
      if (previous !== null && Math.abs(pt.lon - previous) > 180) {
        if (current.length > 1) out.push(polyline(current));
        current = [];
      }
      current.push({ sx: pt.x, sy: pt.y });
      previous = pt.lon;
    }
    if (current.length > 1) out.push(polyline(current));
    return out;
  };

  const trackCentre = groundTrack(0, TRACK_SAMPLES);
  const trackNeighbours = [
    ...groundTrack(-1, Math.round(TRACK_SAMPLES * 0.75)),
    ...groundTrack(1, Math.round(TRACK_SAMPLES * 0.75)),
  ];

  const subGeo = toLatLon(orbitPoint(uCapture, inc, raan, 1));
  const subSat = {
    x: p3(PLATE.cx + wrap180(subGeo.lon - mission.lon) * PLATE.perDeg),
    y: p3(PLATE.cy - subGeo.lat * PLATE.perDeg),
  };
  const targetPlate = { x: PLATE.cx, y: p3(PLATE.cy - mission.lat * PLATE.perDeg) };

  // Graticule on the plate, in absolute degrees, folded into the window.
  const plateParallels = [-60, -30, 0, 30, 60].map((lat) => p3(PLATE.cy - lat * PLATE.perDeg));
  const plateMeridians: number[] = [];
  for (let lon = -180; lon < 180; lon += 30) {
    plateMeridians.push(p3(PLATE.cx + wrap180(lon - mission.lon) * PLATE.perDeg));
  }

  return {
    rollDeg,
    periodMin,
    crossTrackDeg,
    orbitPath,
    orbitFront,
    orbitBack,
    leadIn,
    chevron,
    capture,
    targetScreen,
    poleScreen,
    parallels,
    meridians,
    trackCentre,
    trackNeighbours,
    subSat,
    targetPlate,
    plateParallels,
    plateMeridians,
    driftDeg,
  };
}

/** The `u` at which the orbit passes closest to the target. */
function closestApproach(inc: number, raan: number, target: Vec3, steps: number) {
  let best = { u: 0, angle: Infinity };
  for (let k = 0; k < steps; k++) {
    const u = (2 * Math.PI * k) / steps;
    const p = norm(orbitPoint(u, inc, raan, 1));
    const angle = Math.acos(clamp(dot(p, target), -1, 1));
    if (angle < best.angle) best = { u, angle };
  }
  return best;
}

/** A small open chevron at `head`, pointing the way the marker is travelling. */
function chevronPath(tail: { sx: number; sy: number }, head: { sx: number; sy: number }): string {
  const dx = head.sx - tail.sx;
  const dy = head.sy - tail.sy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const size = 6;
  const spread = 0.6;
  const ax = head.sx - ux * size + -uy * size * spread;
  const ay = head.sy - uy * size + ux * size * spread;
  const bx = head.sx - ux * size - -uy * size * spread;
  const by = head.sy - uy * size - ux * size * spread;
  return `M ${p3(ax)},${p3(ay)} L ${p3(head.sx)},${p3(head.sy)} L ${p3(bx)},${p3(by)}`;
}

/* ------------------------------------------------------------------ */
/* Motion — one <style> element, scoped by class                       */
/* ------------------------------------------------------------------ */

/**
 * The plot owns its own keyframes rather than adding them to globals.css,
 * because they are useless to anything else on the site.
 *
 * WHY THE REDUCED-MOTION RULE SAYS `animation: none` AND NOT A DURATION.
 * globals.css collapses every animation under `prefers-reduced-motion` with
 * `animation-duration: 0.001ms !important`, inside `@layer base`. This
 * stylesheet is UNLAYERED, and the cascade reverses for important
 * declarations: an important declaration in any layer beats an important
 * unlayered one. So an important duration here would LOSE, and the marker
 * would snap to 100% — the far side of the orbit — instead of stopping.
 *
 * `animation: none` wins anyway, because it sets `animation-name`, which the
 * global rule never touches. A named animation that does not exist does not
 * run at any duration. Do not "simplify" this to an `animation-duration` or a
 * `play-state`: both are the version that breaks.
 */
const PLOT_CSS = `
.op-craft {
  offset-rotate: 0deg;
  offset-distance: 0%;
  animation: op-travel var(--op-period, 26s) linear infinite;
}
.op-flow {
  animation: op-flow 2.4s linear infinite;
}
.op-parked { display: none; }
@keyframes op-travel {
  from { offset-distance: 0%; }
  to { offset-distance: 100%; }
}
@keyframes op-flow {
  to { stroke-dashoffset: -16; }
}
@media (prefers-reduced-motion: reduce) {
  .op-craft {
    animation: none !important;
    offset-distance: 0%;
  }
  .op-flow {
    animation: none !important;
  }
  .op-live { display: none; }
  .op-parked { display: inline; }
}
`;

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

interface Readout {
  label: string;
  value: string;
}

export interface OrbitPlotProps {
  mission: MissionDTO;
  /**
   * One revolution, in ms. Slower reads calmer; never under 12s. The default
   * is 26s, which walks the marker across the disc at about the speed of a
   * second hand.
   */
  periodMs?: number;
  /** Drop the ground-track plate — the globe and its readouts only. */
  groundTrack?: boolean;
  className?: string;
}

export function OrbitPlot({
  mission,
  periodMs = 26_000,
  groundTrack = true,
  className,
}: OrbitPlotProps) {
  const g = buildGeometry(mission);
  const o = mission.orbit;

  const top: Readout[] = [
    { label: 'Inclination', value: o.inclination },
    { label: 'Altitude', value: `${o.altitudeKm} km` },
    { label: 'Period', value: `${g.periodMin} min` },
  ];
  const bottom: Readout[] = [
    { label: 'Look azimuth', value: `${o.azimuthDeg}° ${compassPoint(o.azimuthDeg)}` },
    { label: 'Off-nadir', value: `${o.offNadirDeg.toFixed(1)}°` },
    { label: 'Resolution', value: `${o.gsdM} m` },
  ];

  const craftStyle = {
    offsetPath: `path("${g.orbitPath}")`,
    '--op-period': `${Math.max(12_000, periodMs)}ms`,
  } as CSSProperties;

  return (
    <figure className={cn('flex flex-col', className)}>
      <style>{PLOT_CSS}</style>

      <figcaption
        className={cn(
          'flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-2.5',
          WIDTH,
        )}
      >
        <span className="file-s file-label-strong">Orbit plot</span>
        <span data-telemetry className="file-xs uppercase">
          {o.track} · {o.sensor}
        </span>
      </figcaption>

      <ReadoutRail items={top} />

      {/* ---- The globe ------------------------------------------------ */}
      <svg
        viewBox={`0 0 ${GLOBE.w} ${GLOBE.h}`}
        className={cn('block h-auto', WIDTH)}
        role="img"
        aria-label={
          `Orbit plot. ${o.inclination} inclination at ${o.altitudeKm} kilometres, ` +
          `period ${g.periodMin} minutes. The capture point is marked over ${mission.locationLabel}.`
        }
      >
        {/* Earth: fill, limb, graticule. The far side is not drawn — this is
            a view of a body, not a wireframe. */}
        <circle
          cx={GLOBE.cx}
          cy={GLOBE.cy}
          r={GLOBE.r}
          fill="color-mix(in srgb, var(--ink) 7%, transparent)"
        />
        <g
          fill="none"
          stroke="var(--rule)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          opacity="0.85"
        >
          {g.parallels.map((d, i) => (
            <path key={`par-${i}`} d={d} vectorEffect="non-scaling-stroke" />
          ))}
          {g.meridians.map((d, i) => (
            <path key={`mer-${i}`} d={d} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
        <circle
          cx={GLOBE.cx}
          cy={GLOBE.cy}
          r={GLOBE.r}
          fill="none"
          stroke="var(--ink-faint)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        {/* North pole, so the reader can find north under the roll. */}
        {g.poleScreen ? (
          <g stroke="var(--ink-faint)" strokeWidth="1" vectorEffect="non-scaling-stroke">
            <line
              x1={p3(g.poleScreen.sx) - 4}
              y1={p3(g.poleScreen.sy)}
              x2={p3(g.poleScreen.sx) + 4}
              y2={p3(g.poleScreen.sy)}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={p3(g.poleScreen.sx)}
              y1={p3(g.poleScreen.sy) - 4}
              x2={p3(g.poleScreen.sx)}
              y2={p3(g.poleScreen.sy) + 4}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ) : null}

        {/* The orbit behind the body — dashed, so the ring reads as closed
            without pretending the Earth is transparent. */}
        <g fill="none" stroke="var(--ink-faint)" strokeWidth="1" opacity="0.45">
          {g.orbitBack.map((d, i) => (
            <path key={`back-${i}`} d={d} strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
          ))}
        </g>

        {/* The look vector: spacecraft to target, at the capture. Its length
            IS the off-nadir offset, drawn to the same scale as everything. */}
        <line
          x1={p3(g.capture.sx)}
          y1={p3(g.capture.sy)}
          x2={p3(g.targetScreen.sx)}
          y2={p3(g.targetScreen.sy)}
          stroke="var(--accent)"
          strokeWidth="1"
          strokeDasharray="1 3"
          opacity="0.8"
          vectorEffect="non-scaling-stroke"
        />

        {/* The orbit in front of the body — solid, so front and back are
            told apart without reading the drawing twice. */}
        <g fill="none" stroke="var(--ink-faint)" strokeWidth="1">
          {g.orbitFront.map((d, i) => (
            <path key={`front-${i}`} d={d} vectorEffect="non-scaling-stroke" />
          ))}
        </g>

        {/* The lead-in: the arc arriving at the capture, solid and accented,
            with a chevron on the direction of flight. */}
        <g fill="none" stroke="var(--accent)" strokeWidth="1.25">
          {g.leadIn.map((d, i) => (
            <path key={`lead-${i}`} d={d} vectorEffect="non-scaling-stroke" />
          ))}
          <path d={g.chevron} vectorEffect="non-scaling-stroke" />
        </g>

        {/* The target on the ground. */}
        <g stroke="var(--accent)" strokeWidth="1" vectorEffect="non-scaling-stroke">
          <circle
            cx={p3(g.targetScreen.sx)}
            cy={p3(g.targetScreen.sy)}
            r="6"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={p3(g.targetScreen.sx)}
            cy={p3(g.targetScreen.sy)}
            r="1.6"
            fill="var(--accent)"
            stroke="none"
          />
        </g>

        {/* The capture point: a fixed crosshair on the track. The marker
            below travels through it once per revolution. */}
        <g
          transform={`translate(${p3(g.capture.sx)} ${p3(g.capture.sy)})`}
          stroke="var(--accent)"
          strokeWidth="1"
          fill="none"
        >
          <circle r="9" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          <line x1={-13} y1={0} x2={-9} y2={0} vectorEffect="non-scaling-stroke" />
          <line x1={9} y1={0} x2={13} y2={0} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={-13} x2={0} y2={-9} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={9} x2={0} y2={13} vectorEffect="non-scaling-stroke" />
        </g>

        {/* The spacecraft. `offset-path` is the same string that strokes the
            track; the path starts at the capture, so 0% is the capture. */}
        <g className="op-craft" style={craftStyle}>
          <rect
            x={-4.5}
            y={-2.5}
            width="9"
            height="5"
            fill="var(--ink)"
            stroke="var(--ground)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <g stroke="var(--ink)" strokeWidth="1" vectorEffect="non-scaling-stroke">
            <line x1={-9} y1={0} x2={-5} y2={0} vectorEffect="non-scaling-stroke" />
            <line x1={5} y1={0} x2={9} y2={0} vectorEffect="non-scaling-stroke" />
          </g>
        </g>
      </svg>

      <ReadoutRail items={bottom} />

      {/* ---- The ground track ----------------------------------------- */}
      {groundTrack ? (
        <>
          <div className={cn(WIDTH, 'mt-6 flex items-baseline justify-between gap-4')}>
            <span className="file-s file-label">Ground track</span>
            <span data-telemetry className="file-xs uppercase">
              Drift {g.driftDeg}° / rev
            </span>
          </div>

          <svg
            viewBox={`0 0 ${PLATE.w} ${PLATE.h}`}
            className={cn('mt-2 block h-auto border', WIDTH, RULE)}
            role="img"
            aria-label={
              `Ground track for the capture revolution and its two neighbours, ` +
              `centred on the target at ${formatCoordsHemisphere(mission.lat, mission.lon, 2)}.`
            }
          >
            <rect
              x="0"
              y="0"
              width={PLATE.w}
              height={PLATE.h}
              fill="color-mix(in srgb, var(--ink) 4%, transparent)"
            />

            <g stroke="var(--rule)" strokeWidth="1" vectorEffect="non-scaling-stroke">
              {g.plateMeridians.map((x, i) => (
                <line key={`pm-${i}`} x1={x} y1="0" x2={x} y2={PLATE.h} vectorEffect="non-scaling-stroke" />
              ))}
              {g.plateParallels.map((y, i) => (
                <line
                  key={`pp-${i}`}
                  x1="0"
                  y1={y}
                  x2={PLATE.w}
                  y2={y}
                  stroke={y === PLATE.cy ? 'var(--ink-faint)' : 'var(--rule)'}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>

            {/* The revolutions either side of the capture, at the real
                westward drift. */}
            <g fill="none" stroke="var(--ink-faint)" strokeWidth="1" opacity="0.4">
              {g.trackNeighbours.map((d, i) => (
                <path key={`tn-${i}`} d={d} strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
              ))}
            </g>

            {/* The capture revolution. The dash flow runs the way the
                spacecraft is going. */}
            <g fill="none" stroke="var(--accent)" strokeWidth="1.5">
              {g.trackCentre.map((d, i) => (
                <path
                  key={`tc-${i}`}
                  d={d}
                  className="op-flow"
                  strokeDasharray="10 6"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>

            {/* Sub-satellite point at capture, and the target beside it —
                separated by exactly the off-nadir cross-track distance. */}
            <circle
              cx={g.subSat.x}
              cy={g.subSat.y}
              r="3"
              fill="var(--accent)"
              stroke="none"
            />
            <g
              transform={`translate(${g.targetPlate.x} ${g.targetPlate.y})`}
              stroke="var(--ink)"
              strokeWidth="1"
              fill="none"
            >
              <circle r="10" vectorEffect="non-scaling-stroke" />
              <line x1={-18} y1={0} x2={-10} y2={0} vectorEffect="non-scaling-stroke" />
              <line x1={10} y1={0} x2={18} y2={0} vectorEffect="non-scaling-stroke" />
              <line x1={0} y1={-18} x2={0} y2={-10} vectorEffect="non-scaling-stroke" />
              <line x1={0} y1={10} x2={0} y2={18} vectorEffect="non-scaling-stroke" />
              {/* Look azimuth from the target, north up on this plate. */}
              <line
                x1="0"
                y1="0"
                x2={p3(26 * Math.sin(o.azimuthDeg * RAD))}
                y2={p3(-26 * Math.cos(o.azimuthDeg * RAD))}
                stroke="var(--accent)"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </svg>
        </>
      ) : null}

      {/* ---- What the reader is looking at -----------------------------
          Prose, not a readout: three subordinate clauses about how the
          drawing is projected. It takes `text-note` (sans, 13→16px) and
          sentence case — the uppercase detail ramp is for values, and
          shouting a paragraph of caveats is how a caveat stops being read. */}
      <p className={cn(WIDTH, 'mt-3.5 text-note', INK_DIM)}>
        Altitude is exaggerated ×{ALT_EXAGGERATION}, and the view is rolled {g.rollDeg}° to the
        house track. Track offset at capture is {g.crossTrackDeg}°, taken from the off-nadir
        look. The ground track is equirectangular, ±180° about the target meridian.{' '}
        <span className="op-live">
          It is tracking at one revolution every{' '}
          {Math.round(Math.max(12_000, periodMs) / 1000)} seconds.
        </span>
        <span className="op-parked">The marker is parked at the capture point.</span>
      </p>
    </figure>
  );
}

/**
 * A rail of three readouts under or over the plot — ruled top by the rows
 * themselves and bottom by the rail, so it closes like a data block. Three
 * across at every width: `LOOK AZIMUTH` at the detail size fits a third of
 * 390px with room left, and a readout that reflows to two columns on a phone
 * stops reading as an instrument panel.
 */
function ReadoutRail({ items }: { items: Readout[] }) {
  return (
    <dl className={cn('grid grid-cols-3 border-b', WIDTH, RULE)}>
      {items.map((item, i) => (
        // `.rule-row` owns the vertical padding, which steps at every
        // breakpoint; a `py-*` utility here would win and freeze it.
        <div
          key={item.label}
          className={cn('rule-row px-2 sm:px-3 xl:px-4', i > 0 && 'border-l', RULE)}
        >
          <dt className="file-xs file-label">{item.label}</dt>
          <dd data-telemetry className="file uppercase">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
