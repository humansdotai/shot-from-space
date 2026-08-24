/**
 * ==================================================================
 * FRAME-ON-MAP — the view maths
 * ==================================================================
 * Everything <FrameOnMap /> knows about where it is looking, with no
 * DOM, no React and no side effects. It lives apart from the component
 * for one reason: this is the part that can be WRONG IN A WAY NOBODY
 * SEES. A pan handler that drifts is obvious; a footprint square drawn
 * at the wrong scale looks perfect and sells the customer a lie about
 * how much ground they bought.
 *
 * All of it is built on `groundResolution()` in `lib/tiles.ts`:
 *
 *     metres per pixel = 156543.03392 · cos(latitude) / 2^zoom
 *
 * `zoom` is a WHOLE NUMBER throughout — see the block on the fixed
 * frame below. The tool used to zoom continuously, which meant the
 * footprint square was redrawn at a new size on every animation frame
 * of a pinch: the box the buyer was aiming with moved under their
 * fingers. It is now the fixed reference, and the ladder it sits on is
 * quantised so that every level the buyer can reach states its
 * footprint as an exact figure.
 * ==================================================================
 */
import {
  TILE_SIZE,
  clampLat,
  framePixels,
  groundResolution,
  latToWorldY,
  lonToWorldX,
  worldXToLon,
  worldYToLat,
  wrapLon,
  zoomForFramePixels,
  type TileDescriptor,
} from '@/lib/tiles';

export interface MapView {
  lat: number;
  lon: number;
  /**
   * WHOLE Web Mercator zoom. `NaN` before the stage has been measured —
   * the level depends on how big the box is, so there is nothing
   * sensible to guess. Never fractional: see `fitFrame` below.
   */
  zoom: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/* ------------------------------------------------------------------ */
/* THE FIXED FRAME, AND THE QUANTISED LADDER IT SITS ON               */
/* ------------------------------------------------------------------ */

/**
 * ------------------------------------------------------------------
 * THE DECISION THIS BLOCK ENCODES — read it before changing a number
 * ------------------------------------------------------------------
 * The capture frame is FIXED ON SCREEN. It is drawn at one pixel size
 * for as long as the stage keeps its size, it never rescales under a
 * zoom, and the ground moves and scales beneath it.
 *
 * That is not free. Web Mercator says
 *
 *     metres per pixel = 156543.03392804097 · cos(latitude) / 2^zoom
 *
 * so a box of FIXED pixels covers a DIFFERENT number of metres at every
 * zoom. A fixed frame and a fixed footprint cannot both be true at once
 * — one of the two has to give, and pretending otherwise is the one bug
 * this tool must never have. A frame labelled 2 km that is not 2 km is
 * worse than no tool at all.
 *
 * So: the frame is fixed, and the footprint it covers is COMPUTED and
 * PRINTED, live, at every level. Nothing is rounded into looking right.
 *
 * Two further constraints make that readable rather than merely honest:
 *
 *   1. THE LADDER IS QUANTISED TO WHOLE MERCATOR LEVELS. Zoom takes
 *      integer values only. Halving the resolution per step means the
 *      frame's footprint is always the ordered footprint multiplied by
 *      an exact power of two — 2.00, 4.00, 8.00 km, never 3.41 km. It
 *      also means every settled view draws its tiles at their native
 *      256 px, so the basemap is pin-sharp at all times instead of
 *      resampled at every fractional level.
 *
 *   2. THE HOME LEVEL IS THE ORDERED FOOTPRINT, EXACTLY. The frame's
 *      pixel size is not picked — it is SOLVED from the footprint that
 *      was ordered:
 *
 *          framePx = areaKm · 1000 / groundResolution(lat, zHome)
 *
 *      so at `zHome` the fixed frame is the capture, to the pixel. The
 *      tool opens there and RESET returns there.
 *
 *   3. THE LADDER ONLY GOES WIDER. `zHome` is the ceiling. Zooming in
 *      past it would put a frame on screen that holds LESS ground than
 *      the mission captures, which is the one misreading that could
 *      cost a buyer their subject; zooming out holds more, which is
 *      context, and the ordered square is then drawn inside the frame
 *      at its true scale so what is bought is never in doubt.
 */

/**
 * How much of the shorter stage edge the fixed frame aims to fill, the
 * most it may fill before a wider level is preferred, and the smallest
 * it may be drawn.
 *
 * The ceiling is the one that had to come down. A frame at 86% of a
 * phone's map strip leaves 13 px of surroundings on two sides and sits
 * under the zoom controls — the buyer cannot see what they are moving
 * the ground towards, which is the entire job. 72% keeps the frame
 * dominant and still leaves a margin the eye can read context in.
 *
 * The floor is 72 px rather than 96 for a reason that only holds now the
 * frame is fixed: nobody drags the frame any more, so it does not have
 * to be a touch target. It only has to be big enough to judge, and 72 px
 * of 10 m imagery is 7 px per pixel of source.
 */
const FRAME_TARGET_FRACTION = 0.58;
const FRAME_MAX_FRACTION = 0.72;
const FRAME_MIN_PX = 72;
/**
 * Whole levels of context available below the home level. Two, so the
 * widest view is the ordered footprint × 4 — enough surroundings to find
 * a street, and not so much that the capture square inside the frame
 * becomes a speck nobody can judge.
 */
export const CONTEXT_LEVELS = 2;

export interface FrameFit {
  /**
   * The frame's edge in CSS pixels. CONSTANT for a given stage size and
   * latitude — this is the number that must not change when the zoom
   * changes, and the reason it is solved here rather than in the
   * component's render.
   */
  px: number;
  /** The whole level at which `px` is exactly `areaKm` on a side. */
  home: number;
  /** The widest whole level offered. `home` is the closest. */
  min: number;
}

/**
 * Solve the fixed frame for a footprint, a latitude and a stage.
 *
 * The search is over WHOLE levels only, and the frame's pixel size is
 * whatever the chosen level makes it — never the other way round. That
 * ordering is what keeps `px · groundResolution(lat, home) = areaKm · 1000`
 * an identity rather than an approximation.
 */
export function fitFrame(
  areaKm: number,
  lat: number,
  size: Size,
  desc: TileDescriptor,
): FrameFit {
  const edge = Math.max(1, Math.min(size.w, size.h));

  // The level whose frame would land exactly on the target fraction —
  // fractional, and only ever used to pick the whole level next to it.
  const ideal = zoomForFramePixels(areaKm, lat, edge * FRAME_TARGET_FRACTION);
  let home = clamp(Math.round(ideal), desc.minZoom, desc.maxZoom);

  // A level too far in overflows the stage; a level too far out leaves
  // a frame nobody can place. Step, never clamp: clamping the PIXELS
  // would break the identity above and quietly mis-state the footprint.
  while (framePixels(areaKm, lat, home) > edge * FRAME_MAX_FRACTION && home > desc.minZoom) {
    home -= 1;
  }
  while (framePixels(areaKm, lat, home) < FRAME_MIN_PX && home < desc.maxZoom) {
    home += 1;
  }

  return {
    px: framePixels(areaKm, lat, home),
    home,
    // The pyramid's floor is the hard limit; s2cloudless starts at z1.
    min: Math.max(desc.minZoom, home - CONTEXT_LEVELS),
  };
}

/**
 * What a FIXED box of `px` pixels actually covers, in kilometres, at a
 * latitude and a level. This is the number the readout prints. It is the
 * plain inverse of `framePixels` and it is never rounded before display.
 */
export function frameKm(px: number, lat: number, zoom: number): number {
  return (px * groundResolution(lat, zoom)) / 1000;
}

/* ------------------------------------------------------------------ */
/* Moving the view                                                    */
/* ------------------------------------------------------------------ */

/** Screen-pixel delta → new centre. `dx` right, `dy` down move the IMAGE. */
export function panView(view: MapView, dx: number, dy: number): MapView {
  const wx = lonToWorldX(view.lon, view.zoom) - dx;
  const wy = latToWorldY(view.lat, view.zoom) - dy;
  return {
    lon: wrapLon(worldXToLon(wx, view.zoom)),
    lat: clampLat(worldYToLat(wy, view.zoom)),
    zoom: view.zoom,
  };
}

/**
 * The one gesture primitive. Given the view as it was when a gesture
 * began, re-centre so that the ground point which was under `from` is
 * under `to`, at `zoom`.
 *
 * Every interaction is a special case of this:
 *   drag        from = grab point, to = current point, zoom unchanged
 *   pinch       from = start midpoint, to = current midpoint, zoom scaled
 *   wheel       from = to = cursor, zoom stepped
 *   button/key  from = to = viewport centre, zoom stepped
 *
 * Computing from the gesture's START every time, rather than
 * accumulating per move event, is what stops a long drag from drifting
 * a few metres off the point the finger is holding.
 */
export function anchorView(
  start: MapView,
  from: Point,
  to: Point,
  zoom: number,
  size: Size,
): MapView {
  const cx = lonToWorldX(start.lon, start.zoom);
  const cy = latToWorldY(start.lat, start.zoom);

  // The anchor's offset from the viewport centre, in screen pixels.
  const fx = from.x - size.w / 2;
  const fy = from.y - size.h / 2;

  // …and its absolute world position at the starting zoom.
  const ax = cx + fx;
  const ay = cy + fy;

  // World pixels double per level, so the same ground point sits at
  // `a * 2^(zoom - start.zoom)` on the new level.
  const s = Math.pow(2, zoom - start.zoom);
  const tx = to.x - size.w / 2;
  const ty = to.y - size.h / 2;

  return {
    lon: wrapLon(worldXToLon(ax * s - tx, zoom)),
    lat: clampLat(worldYToLat(ay * s - ty, zoom)),
    zoom,
  };
}

/** Zoom about the middle of the viewport — buttons and the keyboard. */
export function zoomAtCentre(view: MapView, zoom: number, size: Size): MapView {
  const centre = { x: size.w / 2, y: size.h / 2 };
  return anchorView(view, centre, centre, zoom, size);
}

/* ------------------------------------------------------------------ */
/* The tile grid                                                      */
/* ------------------------------------------------------------------ */

export interface PlacedTile {
  /** Stable across a pan so the <img> is never remounted mid-drag. */
  key: string;
  z: number;
  x: number;
  y: number;
  left: number;
  top: number;
  size: number;
}

/** A runaway grid would be a hang, not a bug. 300 tiles is 4K-generous. */
const MAX_TILES = 300;

export interface TileGrid {
  /** The integer pyramid level actually fetched. */
  z: number;
  /** Screen size of one tile: 256 only when the zoom is a whole number. */
  tilePx: number;
  tiles: PlacedTile[];
}

export function tileGrid(view: MapView, size: Size, desc: TileDescriptor): TileGrid {
  const z = clamp(Math.round(view.zoom), desc.minZoom, desc.maxZoom);
  const tilePx = TILE_SIZE * Math.pow(2, view.zoom - z);
  const n = 2 ** z;

  // Centre of the viewport, expressed in fractional tiles at level z.
  const cx = lonToWorldX(view.lon, z) / TILE_SIZE;
  const cy = latToWorldY(view.lat, z) / TILE_SIZE;

  const halfCols = size.w / 2 / tilePx;
  const halfRows = size.h / 2 / tilePx;

  const i0 = Math.floor(cx - halfCols);
  const i1 = Math.floor(cx + halfCols);
  // Rows do not wrap: above the north edge and below the south edge
  // there is no map, and the hatched ground shows through.
  const j0 = Math.max(0, Math.floor(cy - halfRows));
  const j1 = Math.min(n - 1, Math.floor(cy + halfRows));

  const tiles: PlacedTile[] = [];
  for (let j = j0; j <= j1 && tiles.length < MAX_TILES; j++) {
    for (let i = i0; i <= i1 && tiles.length < MAX_TILES; i++) {
      tiles.push({
        // `i` may be negative or ≥ n after panning across the
        // antimeridian; the URL gets the wrapped column, the React key
        // gets the unwrapped one so two copies of the same tile can be
        // on screen at once without colliding.
        key: `${z}:${i}:${j}`,
        z,
        x: ((i % n) + n) % n,
        y: j,
        left: size.w / 2 + (i - cx) * tilePx,
        top: size.h / 2 + (j - cy) * tilePx,
        // A hair of overlap. Fractional positions plus device pixel
        // rounding otherwise leave 1px seams between tiles that read
        // as a grid drawn over the imagery.
        size: tilePx + 1,
      });
    }
  }

  return { z, tilePx, tiles };
}
