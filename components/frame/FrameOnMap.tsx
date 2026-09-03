'use client';

/**
 * ==================================================================
 * <FrameOnMap /> — the capture-framing tool
 * ==================================================================
 * A real satellite basemap the buyer moves under a capture frame that
 * does not move. The frame is the fixed reference; the ground pans and
 * scales beneath it.
 *
 * ------------------------------------------------------------------
 * WHAT CHANGED, AND WHY IT IS THE WHOLE POINT
 * ------------------------------------------------------------------
 * The frame used to be redrawn at a new pixel size on every zoom — it
 * grew until it filled the stage and shrank until it was a speck, and
 * during a pinch it did that once per animation frame. The buyer was
 * trying to aim with a box that was moving under their fingers.
 *
 * It is now FIXED. One pixel size, dead centre, for as long as the stage
 * keeps its size. Zoom changes what is inside it.
 *
 * ------------------------------------------------------------------
 * THE ONE THING THAT MUST BE RIGHT
 * ------------------------------------------------------------------
 * A fixed box of pixels covers a different number of metres at every
 * zoom, because Web Mercator says
 *
 *     metres per pixel = 156543.03392804097 · cos(latitude) / 2^zoom
 *
 * So "the frame is fixed" and "the frame is always 2 km" cannot both be
 * true, and a frame labelled 2 km that is not 2 km is the worst bug this
 * tool could have. `viewport.ts` resolves it and the resolution is worth
 * stating here too:
 *
 *   · Zoom is QUANTISED to whole Mercator levels, so the frame's
 *     footprint is always the ordered footprint times an exact power of
 *     two — 2.00, 4.00, 8.00 km, never 3.41 km. Tiles also render at
 *     their native 256 px at every settled view, so the basemap is
 *     pin-sharp rather than resampled.
 *   · The frame's pixel size is SOLVED so that at the HOME level it is
 *     exactly the ordered footprint. The tool opens there, RESET returns
 *     there, and home is the closest level on the ladder.
 *   · Wider levels exist for context. On them the frame states the real
 *     figure it now covers, and the ORDERED capture is drawn inside it
 *     at its true scale, so what is being bought is never in doubt.
 *
 * Nothing here fudges any of that with a constant.
 *
 * ------------------------------------------------------------------
 * THE FRAME'S DESIGN
 * ------------------------------------------------------------------
 * Taken from `section-middle.pdf`: a photograph inside a paper mount,
 * with a hairline keyline set in from the picture edge, corner
 * registration marks, and small mono labels at the margin. Here the
 * mount is the wash over everything the capture will NOT include, the
 * keyline is drawn over the imagery the capture WILL include, and the
 * labels carry the figures instead of the mission code.
 *
 * ------------------------------------------------------------------
 * WHY THERE IS NO MAP LIBRARY
 * ------------------------------------------------------------------
 * The repo has no map dependency and this does not add one. What a
 * library would provide here is a tile grid, a transform and a pointer
 * handler — which is `viewport.ts` plus this file, with no vector style
 * spec, no WebGL context, no worker bundle and no second attribution
 * system to reconcile with the house one. Leaflet would also bring its
 * own DOM, its own CSS reset and its own controls that would have to be
 * restyled back into this design system, and MapLibre is ~800 kB for a
 * raster basemap. The cost of the library is larger than the cost of the
 * feature.
 *
 * ------------------------------------------------------------------
 * WHAT THE BASEMAP IS, HONESTLY
 * ------------------------------------------------------------------
 * Sentinel-2 cloudless at 10 m, keyless and CC BY 4.0, proxied through
 * `/api/tiles`. It is reference imagery for POSITIONING. It is not the
 * capture, it is not dated today, and the readout says so. Supplying
 * MAPTILER_KEY or MAPBOX_ACCESS_TOKEN swaps the basemap for sub-metre
 * imagery with no change to this file — the component only ever knows
 * `/api/tiles/{z}/{x}/{y}` and whatever `/api/tiles/meta` tells it to
 * credit. See `lib/tiles.ts`.
 * ==================================================================
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { INK, INK_FAINT, RULE } from '@/components/purchase/fields';
import {
  DEFAULT_DESCRIPTOR,
  clampLat,
  framePixels,
  groundResolution,
  wrapLon,
  type TileDescriptor,
} from '@/lib/tiles';
import {
  anchorView,
  clamp,
  fitFrame,
  frameKm,
  panView,
  tileGrid,
  zoomAtCentre,
  type MapView,
  type Point,
  type Size,
} from './viewport';

/* ------------------------------------------------------------------ */
/* Tuning                                                             */
/* ------------------------------------------------------------------ */

/** Keyboard pan, as a fraction of the shorter viewport edge. */
const KEY_PAN_FRACTION = 0.12;
/** …with a floor, so a short map still moves a useful distance. */
const KEY_PAN_MIN_PX = 32;
/** Shift multiplies it. */
const KEY_PAN_COARSE = 3;
/**
 * Wheel travel, in pixels, that adds up to one whole level. A notch is
 * ~100 px, so one notch is one level and a trackpad flick is two or
 * three — the same feel as before, landing only on levels that can
 * state an exact footprint.
 */
const WHEEL_PER_LEVEL = 90;
/** Finger spread ratio that commits one whole level. */
const PINCH_PER_LEVEL = 1.5;
/** Per-frame decay of a flick. */
const INERTIA_DECAY = 0.94;
/** Below this speed (px/ms) the glide has stopped. */
const INERTIA_FLOOR = 0.02;

function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Two decimals, always — `2.00 KM` reads as measured, `2 KM` as rounded. */
function km2(n: number): string {
  return n.toFixed(2);
}

/* The fix, one axis at a time. Four decimal places is ~11 m at the
   equator, which is finer than the basemap's own ground sample and finer
   than anything the buyer can position by hand. */
function latLabel(lat: number): string {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
}

function lonLabel(lon: number): string {
  return `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
}

/* ------------------------------------------------------------------ */
/* Gesture bookkeeping                                                 */
/* ------------------------------------------------------------------ */

type Gesture =
  | { kind: 'none' }
  | {
      kind: 'pan';
      id: number;
      /** The view as it was when the finger went down. */
      start: MapView;
      from: Point;
      last: Point;
      lastT: number;
      vx: number;
      vy: number;
    }
  | {
      kind: 'pinch';
      ids: [number, number];
      /** Rebased every time the pinch commits a level. */
      start: MapView;
      from: Point;
      spread: number;
    };

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function spreadOf(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export interface FrameOnMapProps {
  /** Centre of the capture, decimal degrees. */
  lat: number;
  lon: number;
  /** The ORDERED footprint edge in kilometres. The capture is square. */
  areaKm: number;
  /**
   * Fired on every committed centre — which during a drag or a glide
   * means ONCE PER ANIMATION FRAME, not once per gesture. That is
   * deliberate: a configurator's preview updates as the buyer moves, not
   * after they let go. A ~1 s flick produces on the order of a hundred
   * calls, so if the consumer does real work per call (a price
   * recalculation, a server render) it should debounce on its own side;
   * storing the coordinates in state is cheap and needs no debounce.
   *
   * `areaKm` is passed straight back untouched. It is the ORDER's
   * footprint, and zooming for context does not change what was ordered
   * — only what is on screen around it.
   */
  onChange: (next: { lat: number; lon: number; areaKm: number }) => void;
  className?: string;
}

export function FrameOnMap({ lat, lon, areaKm, onChange, className }: FrameOnMapProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const instructionsId = useId();

  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [desc, setDesc] = useState<TileDescriptor>(DEFAULT_DESCRIPTOR);
  const [view, setView] = useState<MapView>(() => ({
    lat: clampLat(lat),
    lon: wrapLon(lon),
    // Set once the box has been measured — the level depends on how big
    // the box is, so there is nothing sensible to guess here.
    zoom: Number.NaN,
  }));
  const [basemapDown, setBasemapDown] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  /* --- refs that handlers read (no stale closures) ---------------- */
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const areaKmRef = useRef(areaKm);
  areaKmRef.current = areaKm;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const ready = size.w > 0 && size.h > 0 && Number.isFinite(view.zoom);

  /* ---------------------------------------------------------------- */
  /* THE FIXED FRAME                                                   */
  /* ---------------------------------------------------------------- */

  /**
   * Solved from the TARGET latitude — the prop — and not from the live
   * view. Panning must not resize the frame, and `lat` only changes when
   * the product hands the tool a different place, which is a new fit and
   * not a zoom.
   */
  const fit = useMemo(
    () => fitFrame(areaKm, clampLat(lat), size, desc),
    [areaKm, lat, size, desc],
  );
  const fitRef = useRef(fit);
  fitRef.current = fit;

  /** The committed view, readable synchronously by a pointer handler. */
  const viewRef = useRef(view);
  viewRef.current = view;

  /** Whole levels only, and never closer than the ordered footprint. */
  const clampZoom = useCallback((z: number) => {
    const f = fitRef.current;
    return clamp(Math.round(z), f.min, f.home);
  }, []);

  const metresPerPixel = ready ? groundResolution(view.lat, view.zoom) : 0;
  /** What the FIXED frame actually covers here. Computed, never assumed. */
  const shownKm = ready ? frameKm(fit.px, view.lat, view.zoom) : 0;
  /**
   * IS THE FRAME THE ORDERED CAPTURE RIGHT NOW?
   *
   * Not `zoom === fit.home`, and the difference matters. The frame's
   * pixel size is solved once, at the TARGET's latitude, so that panning
   * cannot resize it — but ground resolution carries a `cos(latitude)`,
   * so a buyer who pans far enough north is looking at a fixed box that
   * covers slightly more ground than it did at the target. At 51.5° that
   * is 0.5% after about 25 km of panning: real, small, and exactly the
   * kind of thing a readout is allowed to round away only if it is also
   * allowed to stop calling the frame the capture.
   *
   * So the test is the one the reader can check: do the two printed
   * figures agree to the precision they are printed at? Below half of the
   * last digit, the frame IS the capture and one figure is shown. Above
   * it — from a wider level or from a very long pan — the second figure
   * appears and the true-scale capture square is drawn inside the frame.
   */
  const atHome = ready && Math.abs(shownKm - areaKm) < 0.005;
  /** The ordered capture, at its true scale on this level. */
  const capturePx = ready ? framePixels(areaKm, view.lat, view.zoom) : 0;

  const grid = useMemo(
    () => (ready ? tileGrid(view, size, desc) : null),
    [ready, view, size, desc],
  );

  /* ---------------------------------------------------------------- */
  /* Measurement                                                      */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize((s) =>
        Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5
          ? s
          : { w: r.width, h: r.height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * Open at home — the level where the fixed frame is exactly the
   * ordered footprint — and keep the level on the ladder when the fit
   * changes under a resize or a new target.
   */
  /**
   * Has the buyer chosen a level? Until they have, the tool follows the
   * fit — and it has to, because the stage is measured more than once:
   * the ResizeObserver reports the box, then the tiles load, the note
   * reflows and it reports a different one. A zoom set from the FIRST
   * measurement is already inside the second one's bounds, so a plain
   * clamp leaves it there — which is how the tool kept opening one whole
   * level wide of the ordered footprint. Re-homing while untouched fixes
   * that without ever overriding a level somebody picked.
   */
  const chosenZoom = useRef(false);
  const measured = size.w > 0 && size.h > 0;
  useEffect(() => {
    if (!measured) return;
    setView((v) => {
      if (!chosenZoom.current) return v.zoom === fit.home ? v : { ...v, zoom: fit.home };
      if (!Number.isFinite(v.zoom)) return { ...v, zoom: fit.home };
      const z = clamp(Math.round(v.zoom), fit.min, fit.home);
      return z === v.zoom ? v : { ...v, zoom: z };
    });
  }, [measured, fit.min, fit.home]);

  /* ---------------------------------------------------------------- */
  /* Provider descriptor — attribution must name who actually served  */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    let live = true;
    fetch('/api/tiles/meta')
      .then((r) => (r.ok ? (r.json() as Promise<TileDescriptor>) : null))
      .then((d) => {
        if (live && d && typeof d.attribution === 'string') setDesc(d);
      })
      .catch(() => {
        // The keyless descriptor is already in state and is correct for
        // a keyless deployment, which is the default. Nothing to do.
      });
    return () => {
      live = false;
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /* Controlled ↔ internal                                             */
  /* ---------------------------------------------------------------- */

  /**
   * The last centre handed to `onChange`, so our own echo is ignored.
   * Seeded with the props we mounted on: the component must not report
   * a change on mount, or a parent tracking "has the buyer touched
   * this?" would mark every draft dirty the moment the map appears.
   */
  const emitted = useRef<{ lat: number; lon: number } | null>({
    lat: clampLat(lat),
    lon: wrapLon(lon),
  });

  /** Where the map opened, or was last moved to from outside. */
  const origin = useRef({ lat: clampLat(lat), lon: wrapLon(lon) });

  useEffect(() => {
    const e = emitted.current;
    if (e && Math.abs(e.lat - lat) < 1e-9 && Math.abs(e.lon - lon) < 1e-9) return;
    // A centre that did not come from this component came from the
    // product — a new address, most likely. That is the new home.
    const next = { lat: clampLat(lat), lon: wrapLon(lon) };
    origin.current = next;
    emitted.current = next;
    setView((v) => ({ ...v, ...next }));
  }, [lat, lon]);

  useEffect(() => {
    if (!Number.isFinite(view.zoom)) return;
    const e = emitted.current;
    if (e && Math.abs(e.lat - view.lat) < 1e-9 && Math.abs(e.lon - view.lon) < 1e-9) return;
    emitted.current = { lat: view.lat, lon: view.lon };
    onChangeRef.current({ lat: view.lat, lon: view.lon, areaKm: areaKmRef.current });
  }, [view.lat, view.lon, view.zoom]);

  const movedFromOrigin =
    Math.abs(view.lat - origin.current.lat) > 1e-7 ||
    Math.abs(view.lon - origin.current.lon) > 1e-7;
  const canReset = movedFromOrigin || (ready && view.zoom !== fit.home);

  /* ---------------------------------------------------------------- */
  /* Pointer: drag to pan, pinch to step levels                       */
  /* ---------------------------------------------------------------- */

  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture>({ kind: 'none' });
  const inertia = useRef<number | null>(null);

  const stopInertia = useCallback(() => {
    if (inertia.current !== null) {
      cancelAnimationFrame(inertia.current);
      inertia.current = null;
    }
  }, []);

  useEffect(() => stopInertia, [stopInertia]);

  const local = useCallback((e: { clientX: number; clientY: number }): Point => {
    const r = surfaceRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }, []);

  const beginPan = useCallback((id: number, at: Point) => {
    gesture.current = {
      kind: 'pan',
      id,
      start: viewRef.current,
      from: at,
      last: at,
      lastT: performance.now(),
      vx: 0,
      vy: 0,
    };
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Mouse: left button only. Right-click must stay a context menu.
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      stopInertia();
      const at = local(e);
      pointers.current.set(e.pointerId, at);
      e.currentTarget.setPointerCapture(e.pointerId);
      surfaceRef.current?.focus({ preventScroll: true });

      const ids = [...pointers.current.keys()];
      if (ids.length === 1) {
        beginPan(e.pointerId, at);
      } else if (ids.length >= 2) {
        const [a, b] = [pointers.current.get(ids[0])!, pointers.current.get(ids[1])!];
        gesture.current = {
          kind: 'pinch',
          ids: [ids[0], ids[1]],
          start: viewRef.current,
          from: midpoint(a, b),
          spread: Math.max(1, spreadOf(a, b)),
        };
      }
    },
    [beginPan, local, stopInertia],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      const at = local(e);
      pointers.current.set(e.pointerId, at);
      const g = gesture.current;
      const s = sizeRef.current;

      if (g.kind === 'pinch') {
        const a = pointers.current.get(g.ids[0]);
        const b = pointers.current.get(g.ids[1]);
        if (!a || !b) return;
        const spread = Math.max(1, spreadOf(a, b));
        const mid = midpoint(a, b);
        const ratio = spread / g.spread;

        // A pinch does not slide the level continuously — it COMMITS one
        // whole level once the fingers have travelled far enough, then
        // rebases so the next level costs the same travel again.
        const step = ratio >= PINCH_PER_LEVEL ? 1 : ratio <= 1 / PINCH_PER_LEVEL ? -1 : 0;
        if (step !== 0) {
          chosenZoom.current = true;
          const zoom = clampZoom(g.start.zoom + step);
          const next =
            zoom === g.start.zoom
              ? anchorView(g.start, g.from, mid, g.start.zoom, s)
              : anchorView(g.start, g.from, mid, zoom, s);
          setView(next);
          gesture.current = { ...g, start: next, from: mid, spread };
          return;
        }

        // Between commits the two fingers still drag the ground.
        setView(anchorView(g.start, g.from, mid, g.start.zoom, s));
        return;
      }

      if (g.kind === 'pan' && g.id === e.pointerId) {
        const now = performance.now();
        const dt = now - g.lastT;
        if (dt > 0) {
          // Exponentially smoothed, so one jittery sample cannot throw
          // the whole flick.
          g.vx = g.vx * 0.7 + ((at.x - g.last.x) / dt) * 0.3;
          g.vy = g.vy * 0.7 + ((at.y - g.last.y) / dt) * 0.3;
          g.last = at;
          g.lastT = now;
        }
        setView(anchorView(g.start, g.from, at, g.start.zoom, s));
      }
    },
    [clampZoom, local],
  );

  const endPointer = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.delete(e.pointerId);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      const g = gesture.current;
      const remaining = [...pointers.current.keys()];

      // Lifting one finger out of a pinch continues as a pan from the
      // other, instead of jumping.
      if (remaining.length === 1) {
        beginPan(remaining[0], pointers.current.get(remaining[0])!);
        return;
      }
      if (remaining.length > 1) return;

      gesture.current = { kind: 'none' };
      if (g.kind !== 'pan') return;

      const speed = Math.hypot(g.vx, g.vy);
      if (speed < INERTIA_FLOOR || isReducedMotion()) return;

      // The glide. Reduced motion gets none of it — the map simply
      // stops where the finger left it, which is a complete answer.
      let vx = g.vx;
      let vy = g.vy;
      let prev = performance.now();
      const step = () => {
        const now = performance.now();
        const dt = Math.min(32, now - prev);
        prev = now;
        setView((v) => panView(v, vx * dt, vy * dt));
        const decay = Math.pow(INERTIA_DECAY, dt / 16);
        vx *= decay;
        vy *= decay;
        if (Math.hypot(vx, vy) < INERTIA_FLOOR) {
          inertia.current = null;
          return;
        }
        inertia.current = requestAnimationFrame(step);
      };
      inertia.current = requestAnimationFrame(step);
    },
    [beginPan],
  );

  /* ---------------------------------------------------------------- */
  /* Wheel — accumulated, committed a whole level at a time           */
  /* ---------------------------------------------------------------- */

  const wheelAcc = useRef(0);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // The map is a fixed-height panel, not the page, so the wheel
      // belongs to it. Non-passive because the page must not scroll
      // underneath the gesture.
      e.preventDefault();
      stopInertia();
      // deltaMode 1 is lines, 2 is pages. Normalise to pixels.
      const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      wheelAcc.current += px;
      if (Math.abs(wheelAcc.current) < WHEEL_PER_LEVEL) return;
      const steps = Math.trunc(wheelAcc.current / WHEEL_PER_LEVEL);
      wheelAcc.current -= steps * WHEEL_PER_LEVEL;
      chosenZoom.current = true;

      const r = el.getBoundingClientRect();
      const at = { x: e.clientX - r.left, y: e.clientY - r.top };
      setView((v) => {
        if (!Number.isFinite(v.zoom)) return v;
        // Scrolling down (positive delta) pulls back to a wider level.
        const zoom = clampZoom(v.zoom - steps);
        return zoom === v.zoom ? v : anchorView(v, at, at, zoom, sizeRef.current);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampZoom, stopInertia]);

  /* ---------------------------------------------------------------- */
  /* Keyboard and the visible controls                                */
  /* ---------------------------------------------------------------- */

  const stepZoom = useCallback(
    (delta: number) => {
      stopInertia();
      chosenZoom.current = true;
      setView((v) => {
        if (!Number.isFinite(v.zoom)) return v;
        const zoom = clampZoom(v.zoom + delta);
        return zoom === v.zoom ? v : zoomAtCentre(v, zoom, sizeRef.current);
      });
    },
    [clampZoom, stopInertia],
  );

  /** Back to the target, and back to the ordered footprint. */
  const reset = useCallback(() => {
    stopInertia();
    chosenZoom.current = false;
    setView((v) => ({
      lat: origin.current.lat,
      lon: origin.current.lon,
      zoom: Number.isFinite(v.zoom) ? fitRef.current.home : v.zoom,
    }));
  }, [stopInertia]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const s = sizeRef.current;
      const base = Math.max(KEY_PAN_MIN_PX, Math.min(s.w, s.h) * KEY_PAN_FRACTION);
      const step = e.shiftKey ? base * KEY_PAN_COARSE : base;

      // Arrow keys move the VIEW, so the ground slides the other way:
      // pressing Right looks further east, exactly like a scrollbar.
      const pan = (dx: number, dy: number) => {
        e.preventDefault();
        stopInertia();
        setView((v) => (Number.isFinite(v.zoom) ? panView(v, dx, dy) : v));
      };

      switch (e.key) {
        case 'ArrowLeft':
          return pan(step, 0);
        case 'ArrowRight':
          return pan(-step, 0);
        case 'ArrowUp':
          return pan(0, step);
        case 'ArrowDown':
          return pan(0, -step);
        case '+':
        case '=':
          e.preventDefault();
          return stepZoom(1);
        case '-':
        case '_':
          e.preventDefault();
          return stepZoom(-1);
        case 'Home':
        case '0':
          e.preventDefault();
          return reset();
        default:
      }
    },
    [reset, stepZoom, stopInertia],
  );

  /* ---------------------------------------------------------------- */
  /* Announcement — settled, never per frame                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => {
      setAnnouncement(
        `Centre ${Math.abs(view.lat).toFixed(4)} degrees ${view.lat >= 0 ? 'north' : 'south'}, ` +
          `${Math.abs(view.lon).toFixed(4)} degrees ${view.lon >= 0 ? 'east' : 'west'}. ` +
          `The capture is ${areaKm} kilometres square. ` +
          (atHome
            ? 'The frame is on the ordered footprint.'
            : `The frame is showing ${km2(shownKm)} kilometres of context around it.`),
      );
    }, 600);
    return () => window.clearTimeout(id);
  }, [ready, view.lat, view.lon, view.zoom, areaKm, atHome, shownKm]);

  /* ---------------------------------------------------------------- */
  /* Basemap health                                                   */
  /* ---------------------------------------------------------------- */

  const tileStats = useRef({ ok: 0, err: 0 });
  useEffect(() => {
    tileStats.current = { ok: 0, err: 0 };
    setBasemapDown(false);
  }, [desc.id]);

  const onTileError = useCallback(() => {
    tileStats.current.err += 1;
    if (tileStats.current.ok === 0 && tileStats.current.err >= 3) setBasemapDown(true);
  }, []);

  const onTileLoad = useCallback(() => {
    tileStats.current.ok += 1;
    setBasemapDown(false);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Readout copy                                                     */
  /* ---------------------------------------------------------------- */

  const magnification = metresPerPixel > 0 ? desc.nativeMetres / metresPerPixel : 0;
  const scaleLine = ready
    ? `${metresPerPixel < 10 ? metresPerPixel.toFixed(1) : Math.round(metresPerPixel)} M/PX · Z${view.zoom}`
    : '—';

  return (
    <div className={['flex min-h-0 flex-col', className ?? ''].join(' ')}>
      {/* ---------------------------------------------------------- */}
      {/* The map                                                    */}
      {/* ---------------------------------------------------------- */}
      <div
        ref={surfaceRef}
        role="application"
        aria-roledescription="Capture framing map"
        aria-label="Position the capture footprint"
        aria-describedby={instructionsId}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onKeyDown={onKeyDown}
        /* `touch-none` hands every touch gesture to this element. It is
           what makes one-finger drag pan instead of scrolling the page,
           and it is why this component must live in a fixed-height
           panel rather than in the middle of a scrolling column. */
        className={[
          'fui-hatch relative min-h-[13rem] flex-1 cursor-grab touch-none select-none overflow-hidden',
          'border bg-void active:cursor-grabbing',
          RULE,
        ].join(' ')}
      >
        <p id={instructionsId} className="sr-only">
          An interactive satellite map. The square at the centre is the capture
          frame: it does not move. Drag, or press the arrow keys, to move the
          ground under it. Press plus and minus to step between whole zoom
          levels — the closest level is the ordered footprint, and wider levels
          show more ground around it. Press Home to return to the starting
          position and the ordered footprint. The exact centre and footprint are
          printed below the map.
        </p>

        {grid
          ? grid.tiles.map((t) => (
              /* eslint-disable-next-line @next/next/no-img-element --
                 next/image is for known, optimisable assets. These are
                 same-origin proxied map tiles at 256px whose URLs are
                 computed per frame; the optimiser would re-encode each
                 one and defeat the immutable cache on /api/tiles. */
              <img
                key={t.key}
                src={`/api/tiles/${t.z}/${t.x}/${t.y}`}
                alt=""
                aria-hidden
                draggable={false}
                onError={onTileError}
                onLoad={onTileLoad}
                style={{
                  position: 'absolute',
                  left: `${t.left}px`,
                  top: `${t.top}px`,
                  width: `${t.size}px`,
                  height: `${t.size}px`,
                }}
              />
            ))
          : null}

        {/* --- the fixed frame ----------------------------------- */}
        {ready ? (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: `${fit.px}px`, height: `${fit.px}px` }}
            data-capture-frame
            data-frame-px={fit.px.toFixed(2)}
            data-frame-km={km2(shownKm)}
            data-at-ordered={atHome ? 'true' : 'false'}
          >
            {/* THE MOUNT. A 9999px outline washes everything outside the
                frame to paper, exactly as the printed composition mounts
                the photograph. The parent's overflow clips it. No
                gradient, no shadow, no extra elements. */}
            <div
              className="absolute inset-0"
              style={{ outline: '9999px solid rgba(238,237,232,0.82)' }}
            />
            {/* THE EDGE, twice. One hairline in ink on the mount side and
                one in paper over the picture, 5px in — the inline rule the
                printed sheet carries. Two tones because a single one is
                invisible against imagery of its own value: paper at 60%
                measures 6.4 : 1 on a dark scene and 1.2 : 1 on a pale one,
                which is a keyline that disappears exactly where a coastal
                or desert target needs it most. */}
            <div className="absolute inset-0 border border-[rgba(8,9,11,0.55)]" />
            <div className="absolute inset-[5px] border border-[rgba(238,237,232,0.90)]" />
            <MountTicks />

            {/* Centre cross — the fix itself, not the box. A pale bar
                under a dark one, for the same reason the edge is drawn
                twice. */}
            <span className="absolute left-1/2 top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 bg-paper/85" />
            <span className="absolute left-1/2 top-1/2 h-[3px] w-4 -translate-x-1/2 -translate-y-1/2 bg-paper/85" />
            <span className="absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-void/85" />
            <span className="absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2 bg-void/85" />

            {/* THE ORDERED CAPTURE, at its true scale. Drawn only when
                the view is wider than the order — at home the frame IS
                the capture and a second box would imply a difference
                that does not exist. */}
            {!atHome ? (
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-dashed border-paper/90"
                style={{ width: `${capturePx}px`, height: `${capturePx}px` }}
              >
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap bg-void/70 px-1 py-0.5 font-mono text-[0.5625rem] uppercase leading-none tracking-[0.18em] text-paper">
                  {km2(areaKm)} km capture
                </span>
              </div>
            ) : null}

            {/* The margin labels, set on the MOUNT rather than over the
                picture — which is both where the printed composition puts
                them and the only place their contrast is knowable: over
                the wash, `--ink` measures 10.7 : 1 on the worst imagery
                the basemap can serve. */}
            <span
              className={[
                'absolute -top-[1.4rem] left-0 whitespace-nowrap border border-[rgba(8,9,11,0.42)] px-1.5 py-0.5',
                'font-mono text-[0.5625rem] uppercase leading-none tracking-[0.18em]',
                INK,
              ].join(' ')}
            >
              {km2(shownKm)} × {km2(shownKm)} km
            </span>
            {/* Rotated inside a fixed-width column on the margin rather
                than positioned and rotated in one step: a `rotate-90`
                about an element's own centre swings its long axis across
                the box it was anchored to, which put this label back over
                the picture — the one ground its contrast is not known on. */}
            <div className="absolute -right-5 bottom-0 top-0 hidden w-5 items-center justify-center sm:flex">
              <span
                className={[
                  'rotate-90 whitespace-nowrap',
                  'font-mono text-[0.5625rem] uppercase leading-none tracking-[0.2em]',
                  INK,
                ].join(' ')}
              >
                {atHome ? 'Capture frame' : 'Context view'}
              </span>
            </div>
          </div>
        ) : null}

        {/* --- controls + attribution ---------------------------- */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end">
          {/* A COLUMN ON A PHONE, A ROW EVERYWHERE ELSE. Three 44 px
              controls in a row are 134 px wide, which on a phone-sized
              map is wider than the margin beside the fixed frame — they
              landed on the corner of the picture the buyer is judging.
              Stacked, they occupy 44 px of width and clear it entirely. */}
          <div className="pointer-events-auto flex flex-col items-end gap-px px-2 pb-2 sm:flex-row sm:justify-end">
            {/* Always rendered, never conditionally mounted: a control
                that appears mid-drag shifts the two beside it out from
                under the thumb already reaching for them. */}
            <MapControl
              label="Return to the target and the ordered footprint"
              onClick={reset}
              disabled={!canReset}
            >
              <span aria-hidden>RESET</span>
            </MapControl>
            <MapControl
              label="Show more ground around the frame"
              onClick={() => stepZoom(-1)}
              disabled={ready ? view.zoom <= fit.min : true}
            >
              <span aria-hidden>&minus;</span>
            </MapControl>
            <MapControl
              label="Close in on the ordered footprint"
              onClick={() => stepZoom(1)}
              disabled={ready ? view.zoom >= fit.home : true}
            >
              <span aria-hidden>+</span>
            </MapControl>
          </div>

          {/* Licence condition, not decoration: always on the map, and
              it names whichever provider actually served the pixels. */}
          <div className="on-dark pointer-events-auto border-t border-hairline-soft bg-void/85 px-2.5 py-1.5">
            {/* A credit line, set as a sentence with the source name
                linked inside it. That is what it is — and it is why the
                44px target rule does not apply to it (WCAG 2.5.8 exempts
                a link available inline in a block of text; the house
                check in tests/support/a11y.ts encodes the same rule). */}
            <p className="font-mono text-[0.625rem] leading-[1.4] tracking-[0.06em] text-paper-dim">
              <a
                href={desc.attributionHref}
                target="_blank"
                rel="noreferrer"
                data-tile-attribution
                className="link-underline text-paper-dim"
              >
                {desc.attribution}
              </a>
            </p>
          </div>
        </div>

        <span aria-live="polite" className="sr-only">
          {announcement}
        </span>
      </div>

      {/* ---------------------------------------------------------- */}
      {/* Readout — on the paper the stage is set on                 */}
      {/* ---------------------------------------------------------- */}
      {basemapDown ? (
        <p className="fui-error mt-2 px-3 py-2 text-note" data-basemap-down>
          Basemap unavailable — the reference imagery did not load. Framing still
          works: the centre and footprint below are live and are what the mission
          will be tasked against.
        </p>
      ) : null}

      {/* THE STRIP. Four figures at most, and the two that describe the
          ORDER come first. The fix is split into a latitude cell and a
          longitude cell rather than set as one string: at 390 the joined
          form is 178 px of 11 px mono in a 169 px cell, and it truncated
          to `51.5074° N / 0.1278…` — which is not a shortened coordinate,
          it is a different place, because the hemisphere that decides
          which side of the meridian this is has gone. Split, neither half
          can overrun at any width. */}
      <div className="grid shrink-0 grid-cols-3 gap-x-5 gap-y-2.5 pt-3 xl:grid-cols-4">
        <Readout label="Frame lat" value={latLabel(view.lat)} />
        <Readout label="Frame lon" value={lonLabel(view.lon)} />
        {/* The ordered footprint is a constant, not a measurement, so it
            is printed as the whole number it is. Every figure beside it
            that WAS measured carries two decimals. */}
        <Readout label="Capture" value={`${areaKm} × ${areaKm} KM`} />
        {/* AT HOME THE FRAME IS THE CAPTURE, so there is one figure and
            one cell. A second cell repeating it would invite the reader
            to look for a difference between two identical numbers. The
            cell appears the moment a wider level makes the two differ,
            which is also the moment the difference has to be stated. */}
        {atHome ? null : (
          <Readout
            label="Frame shows"
            value={ready ? `${km2(shownKm)} × ${km2(shownKm)} KM` : '—'}
          />
        )}
      </div>

      {/* The licence and the honesty, in one short paragraph. The line
          that used to open it — "the frame is the capture" — is now the
          stage's title and two of the cells above it, and on a phone
          repeating it cost the map forty pixels of height. */}
      <p className={['pt-2 text-note', INK_FAINT].join(' ')}>
        {atHome
          ? ''
          : `The frame is holding ${km2(shownKm)} km of context; the dashed square inside it is the ${km2(areaKm)} km the mission photographs. `}
        Reference imagery for positioning, {desc.nativeMetres} m ground
        sample, drawn at {scaleLine.toLowerCase()}
        {magnification > 1.2 ? ` (magnified ×${magnification.toFixed(1)})` : ''}. Your
        mission captures a new frame of this ground at the tier you order.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Parts                                                              */
/* ------------------------------------------------------------------ */

/**
 * The registration marks from the printed composition, set in the MARGIN
 * rather than over the picture. Two reasons, and the second is the one
 * that decided it: the printed sheet puts its marks on the mount, and the
 * mount is the only ground whose value this component controls — a mark
 * drawn over the basemap is legible or not depending on what the
 * satellite saw, which is not a contrast figure anyone can quote.
 */
function MountTicks() {
  const arm = 14;
  const off = -arm - 3;
  const corners = [
    { top: off, left: off, rotate: 0 },
    { top: off, right: off, rotate: 90 },
    { bottom: off, right: off, rotate: 180 },
    { bottom: off, left: off, rotate: 270 },
  ] as const;
  return (
    <>
      {corners.map((c, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: 'top' in c ? c.top : undefined,
            left: 'left' in c ? c.left : undefined,
            right: 'right' in c ? c.right : undefined,
            bottom: 'bottom' in c ? c.bottom : undefined,
            width: arm,
            height: arm,
            transform: `rotate(${c.rotate}deg)`,
            transformOrigin: 'center',
            borderTop: '1px solid var(--ink)',
            borderLeft: '1px solid var(--ink)',
            opacity: 0.7,
          }}
        />
      ))}
    </>
  );
}

/**
 * A square map control. 44 × 44 exactly — the minimum target, and the
 * largest a control can be before it starts covering the ground the
 * buyer is trying to look at. It sits ON the imagery, so it carries
 * `.on-dark` and stays a dark control whatever ground the stage is.
 */
function MapControl({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      /* The gesture handler lives on the surface below; a press on a
         control must not also drag the map. */
      onPointerDown={(e) => e.stopPropagation()}
      className={[
        'on-dark flex h-11 w-11 items-center justify-center border border-hairline bg-void/85',
        'font-mono text-[0.6875rem] uppercase leading-none tracking-[0.1em]',
        'transition-house hover:border-hairline-strong hover:bg-deck-2',
        // `.fui-disabled` sets its own colour, but a Tailwind utility
        // beats a component-layer rule, so the tone is stated here.
        disabled ? 'fui-disabled text-paper-faint' : 'text-paper',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/**
 * One telemetry cell. Label above, value below — the label in the
 * faintest ink at the smallest size, the value in full ink one step up,
 * so a scan reads the values and only stops on a label when it needs to.
 */
function Readout({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={['min-w-0', className ?? ''].join(' ')}>
      <span className={['block tele-xs uppercase', INK_FAINT].join(' ')}>{label}</span>
      <span
        data-telemetry
        className={['mt-1 block truncate font-mono tele uppercase tabular-nums', INK].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
