/**
 * MOSAIC GEOMETRY — the sampling grid behind <MosaicHero />.
 *
 * A satellite frame is not one picture; it is a raster of samples. This module
 * decomposes the hero rectangle into that raster: a quadtree of irregular
 * rounded cells, some left whole, some split into 2x2 and 4x4 clusters where
 * the sensor "looked harder".
 *
 * Everything here is deterministic. The only randomness is a seeded PRNG keyed
 * off the cell address, so the same viewport always produces the same field —
 * no `Math.random` at render, no hydration divergence, no flicker on remount.
 * All emitted coordinates are rounded to 3 decimals for the same reason.
 */

/** Fast, seedable 32-bit PRNG. Same input, same sequence, on every machine. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** 3 decimals. Float noise between server and client is a hydration bug. */
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * A smooth, low-frequency luminance field over the frame in normalised space.
 *
 * Tile brightness is sampled from this rather than rolled per tile, which is
 * the whole difference between "composed" and "noisy": bright cells arrive in
 * drifts and clusters, the way light actually falls across a scene, instead of
 * as salt and pepper.
 */
function luminanceField(nx: number, ny: number): number {
  const a = Math.sin(nx * 3.9 + 0.7) * Math.cos(ny * 2.6 - 1.1);
  const b = Math.sin((nx * 1.6 + ny * 2.4) * 2.7 + 2.1);
  const c = Math.cos((nx - ny) * 5.3 - 0.6);
  return clamp(0.5 + 0.26 * a + 0.18 * b + 0.1 * c, 0, 1);
}

export interface MosaicTile {
  /** Cell rectangle in CSS pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Cell centre, cached — the pointer falloff reads it every frame. */
  cx: number;
  cy: number;
  /** Subdivision depth. 0 is a whole root cell; 4 is the finest cluster. */
  depth: number;
  /** Gutter between the drawn tile and its cell edge. */
  inset: number;
  radius: number;
  /** 0 at the closed corner of the composition, 1 at the open one. */
  openness: number;
  /**
   * Resting opacity of the cell when it is painting a sampled colour — how
   * completely this cell replaces the picture with its own average.
   */
  cover: number;
  /** Fallback veil opacity, used only until the frame is available to sample. */
  veil: number;
  /** Resting opacity of the light wash on top of it. Most tiles have none. */
  light: number;
  /** Light target colour, premixed so the render loop never branches. */
  lr: number;
  lg: number;
  lb: number;
  /**
   * Per-cell exposure. Each cell was read by the sensor at its own gain, so
   * neighbours differ in value even where the scene does not — this is what
   * makes the field read as a quilt of samples instead of a blurred photo.
   */
  expo: number;
  /** Hot tiles breathe; the rest merely drift. */
  hot: boolean;
  phase: number;
  speed: number;
}

/** Ink used by the field. Mirrors --color-void / --color-paper / --color-signal. */
export const VOID_RGB = [8, 9, 11] as const;
const PAPER_WARM = [236, 226, 210] as const; // paper, pulled a touch warm
const PAPER_COOL = [214, 224, 228] as const; // paper, pulled a touch cool
const SIGNAL = [255, 108, 58] as const; // the accent, used on a handful of cells

interface BuildOptions {
  /** Changing this reshuffles the whole field. Kept stable in production. */
  seed?: number;
  /** Bias for how large a root cell is relative to the frame. */
  density?: number;
}

/**
 * Decompose `width x height` into the tile field.
 *
 * Roots are a uniform grid — the irregularity comes from subdivision, not from
 * jittered edges, which keeps the mosaic reading as a sampling raster rather
 * than as a shattered pane.
 */
export function buildMosaic(
  width: number,
  height: number,
  { seed = 0x5f5, density = 1 }: BuildOptions = {},
): MosaicTile[] {
  const tiles: MosaicTile[] = [];
  if (width < 2 || height < 2) return tiles;

  // Root cell target: big enough that whole cells read as blocks, small enough
  // that a 390px phone still gets a field rather than four squares.
  const target = clamp((Math.min(width, height) / 5.2) * density, 66, 142);
  const cols = Math.max(2, Math.round(width / target));
  const rows = Math.max(2, Math.round(height / target));
  const cw = width / cols;
  const ch = height / rows;
  /** How much of the composition ramp runs left-to-right rather than bottom-up. */
  const lateral = height > width ? 0.24 : 0.5;

  /** Chance of splitting again, by depth. Depth 4 is the floor. */
  const SPLIT = [0.9, 0.72, 0.5, 0.26, 0];
  const MIN_SIDE = 15;

  const emit = (x: number, y: number, w: number, h: number, depth: number, rng: () => number) => {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const nx = cx / width;
    const ny = cy / height;
    const field = luminanceField(nx, ny);
    const jitter = rng();

    // The composition. The raster is dense and near-opaque where the copy
    // sits and opens away from it, so the picture arrives as light coming
    // through the grid rather than as a tinted photo. This ramp is also what
    // carries the headline: legibility is designed into the field, not bolted
    // on with a scrim.
    //
    // On a wide frame the copy sits bottom-left, so the ramp runs diagonally.
    // On a phone it sits across the bottom, so the ramp goes vertical.
    const openness = clamp(nx * lateral + (1 - ny) * (1 - lateral), 0, 1);

    // Deeper cells sit brighter: more subdivision reads as more resolved
    // detail, and resolved detail is where the picture is allowed through.
    const brightness = clamp(
      openness * 0.66 + field * 0.2 + jitter * 0.14 + depth * 0.05 - 0.05,
      0,
      1,
    );

    // The fallback veil, for the moment before the frame can be sampled: dark
    // where the composition is closed, near-clear where it is open. `lit` is
    // the same quantity read the other way round — how much light this cell is
    // allowed to give back.
    let veil = clamp(0.03 + 0.93 * Math.pow(1 - brightness, 1.45), 0.02, 0.95);
    const lit = brightness > 0.62 ? (brightness - 0.62) / 0.38 : 0;

    // A scatter of emitters, independent of where they fall: the handful of
    // warm cells burning inside the dark part of the field.
    const spark = rng() < 0.07;
    const isSignal = spark && depth >= 2 && rng() < 0.07;
    const hot = spark || (lit > 0.5 && rng() < 0.4);
    const light = isSignal
      ? 0.2 + 0.12 * rng()
      : spark
        ? 0.1 + 0.14 * rng()
        : hot
          ? 0.1 + lit * 0.24
          : lit * 0.12;
    // A cell that is emitting cannot also be a black cell.
    if (spark && veil > 0.4) veil = 0.4 - 0.15 * rng();

    // How completely the cell stands in for the picture. Cells over the copy
    // are all but opaque; cells in the open corner keep some of the frame's
    // own detail showing through their average.
    // Resting cover is deliberately low. Painting each cell's averaged colour
    // at high opacity turns the photograph into a JPEG-artifact grid — the
    // sample reads as damage rather than as instrumentation. Held at 6–46% the
    // frame stays legible through the lattice, the grid reads as a texture,
    // and an ignited cell has somewhere bright to travel to. Text legibility
    // is the scrims' job, not the tiles'.
    const cover = clamp(0.10 + 0.30 * (1 - openness) + (jitter - 0.5) * 0.08, 0.06, 0.46);
    const expo = clamp(0.86 + (rng() - 0.5) * 0.62 + depth * 0.03 + (spark ? 0.3 : 0), 0.55, 1.45);

    // Cool light on the sea side of the frame, warm light on the land side —
    // a small thing that stops the bright cells looking like one paint colour.
    const cool = nx < 0.34 ? 1 : 0;
    const target3 = isSignal ? SIGNAL : cool ? PAPER_COOL : PAPER_WARM;

    tiles.push({
      x: r3(x),
      y: r3(y),
      w: r3(w),
      h: r3(h),
      cx: r3(cx),
      cy: r3(cy),
      depth,
      // The gutter is the picture at full strength. It has to be wide enough
      // to read as a line of light between cells, and it scales down with the
      // cell so a 4x4 cluster does not dissolve into gaps.
      inset: depth >= 3 ? 0.8 : depth === 2 ? 1.2 : 1.8,
      radius: r3(clamp(Math.min(w, h) * 0.12, 2, 6)),
      openness: r3(openness),
      cover: r3(cover),
      expo: r3(expo),
      veil: r3(veil),
      light: r3(light),
      lr: target3[0],
      lg: target3[1],
      lb: target3[2],
      hot,
      phase: r3(rng() * Math.PI * 2),
      speed: r3(0.22 + rng() * 0.3),
    });
  };

  const split = (x: number, y: number, w: number, h: number, depth: number, rng: () => number) => {
    const canSplit = depth < SPLIT.length && w / 2 >= MIN_SIDE && h / 2 >= MIN_SIDE;
    if (!canSplit || rng() >= SPLIT[depth]) {
      emit(x, y, w, h, depth, rng);
      return;
    }

    const mode = rng();
    if (mode < 0.7) {
      // 2x2 — recursion here is what produces the 4x4 clusters.
      const hw = w / 2;
      const hh = h / 2;
      split(x, y, hw, hh, depth + 1, rng);
      split(x + hw, y, hw, hh, depth + 1, rng);
      split(x, y + hh, hw, hh, depth + 1, rng);
      split(x + hw, y + hh, hw, hh, depth + 1, rng);
    } else if (mode < 0.86) {
      // Vertical bisect — a tall pair. Irregular rectangles, not only squares.
      const hw = w / 2;
      split(x, y, hw, h, depth + 1, rng);
      split(x + hw, y, hw, h, depth + 1, rng);
    } else {
      const hh = h / 2;
      split(x, y, w, hh, depth + 1, rng);
      split(x, y + hh, w, hh, depth + 1, rng);
    }
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // One PRNG per root, keyed by address: a resize re-lays the grid but a
      // given cell keeps its character, and roots never share a sequence.
      const rng = mulberry32(seed ^ Math.imul(c + 1, 0x27d4eb2d) ^ Math.imul(r + 1, 0x165667b1));
      split(c * cw, r * ch, cw, ch, 0, rng);
    }
  }

  return tiles;
}
