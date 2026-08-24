'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { buildMosaic, type MosaicTile } from './mosaic';

/**
 * AMBIENT MOSAIC — the sampling raster as texture, not as an event.
 *
 * <MosaicField> is the signature: it samples the frame underneath it, lights
 * under the pointer and passes that light to its neighbours. That behaviour
 * belongs to a picture the reader is looking AT. Behind a band of running
 * text there is no picture to sample and nothing should be reacting to the
 * pointer, so this is the same geometry — `buildMosaic`, unchanged, the same
 * deterministic quadtree the hero is cut from — with everything that makes it
 * an event taken out:
 *
 *   no frame sampling      there is nothing behind a dark band to read
 *   no adjacency           nothing propagates, so no neighbour graph is built
 *   no cascade             no queue, no envelopes, no per-cell state arrays
 *   no bloom               a halo is a light source; this is a texture
 *   NO POINTER LISTENERS   ambient means ambient. The layer never learns
 *                          where the pointer is, on any input, ever.
 *
 * What is left is one very quiet lattice: the cells painted in the ground's
 * own ink at up to 1.6% opacity, breathing on a slow cycle. At that level it
 * is felt at the edge of vision and cannot be read as a pattern, which is the
 * whole point — it gives a flat dark band the tooth of a sensor readout
 * without ever competing with what is written on it.
 *
 * ------------------------------------------------------------------
 * WHY IT IS CHEAPER THAN THE HERO, AND BY A LOT
 * ------------------------------------------------------------------
 * The hero's frame walks every tile individually because every tile carries
 * its own sampled colour and its own emissive level. Nothing here varies per
 * tile per frame: a cell's opacity is fixed at layout and only its GROUP
 * breathes. So the tiles are quantised into BUCKETS by opacity at layout
 * time and each bucket is welded into ONE Path2D. A frame is then a fixed
 * `BUCKETS` fills — sixteen — no matter whether the band was cut into two
 * hundred cells or two thousand, and no matter how wide the display is.
 *
 * Two more economies on top of that: the canvas is backed at 1x rather than
 * the hero's 1.5x, because a 1.6%-opacity edge has no detail to lose, and it
 * repaints at 12fps rather than 60, because the drift's fastest cycle is
 * eleven seconds long.
 *
 * ------------------------------------------------------------------
 * WHEN IT DOES NOT RUN
 * ------------------------------------------------------------------
 * Exactly as the hero degrades, and for the same two reasons:
 *
 *   prefers-reduced-motion   one static frame. `requestAnimationFrame` is
 *   coarse pointer           never called — not once, not for the first
 *                            paint, which is issued synchronously.
 *
 * And it stops when it cannot be seen: off-screen (IntersectionObserver) and
 * while the tab is hidden.
 */

/** Opacity buckets. Sixteen steps across the 1.2% range below is a fifth of an
 *  8-bit level per step — the quantisation is not resolvable on any display. */
const BUCKETS = 16;

/**
 * The band the lattice lives in, as ink opacity.
 *
 * The ceiling is the number that decides whether this is texture or pattern.
 * Paper ink (236,232,225) over void (8,9,11) at 0.016 moves the ground by
 * under four 8-bit levels — at the threshold of what a good display can even
 * show, and well under what the eye resolves as a grid at reading distance.
 * At 0.03, where this started, it was seven levels and it read as a quilt
 * behind the heading. The floor is deliberately not zero: a cell in the
 * closed part of the composition still carries a whisper, so the field has
 * tooth everywhere rather than a visible edge where it stops.
 */
const ALPHA_MIN = 0.004;
const ALPHA_MAX = 0.016;
/** Below this a fill is not resolvable on an 8-bit display, so it is skipped. */
const ALPHA_FLOOR = 0.0012;

/** Breathing. Amplitude is a share of the bucket's own opacity. */
const DRIFT = 0.34;
const CYCLE_MIN = 11; // seconds for the slowest bucket's fastest cycle
const CYCLE_SPAN = 9;

/** 12fps. The fastest thing on screen has an eleven-second period. */
const IDLE_MS = 83;

/** Fallback ink if the ground has not resolved a `--color-paper` yet. */
const FALLBACK_INK = '236,232,225';

export function AmbientMosaic({
  className,
  seed = 0x2b7,
  /** Larger cells than the hero: this is tooth, not a readout. */
  density = 1.35,
  /** Global multiplier on the whole lattice. 1 is already barely there. */
  strength = 1,
}: {
  className?: string;
  seed?: number;
  density?: number;
  strength?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;
    /** `live` drifts; `static` paints once and is never scheduled again. */
    const mode: 'live' | 'static' = reduced || !fine ? 'static' : 'live';

    let width = 0;
    let height = 0;
    /** One welded path per opacity bucket, and that bucket's resting alpha. */
    let paths: Path2D[] = [];
    let alphas = new Float32Array(0);
    let phase = new Float32Array(0);
    let rate = new Float32Array(0);
    let ink = FALLBACK_INK;

    /**
     * The lattice's ink is the ground's own `--ink`, read from the DOM rather
     * than written here, so the layer follows `.surface-dark` / `.surface-light`
     * like everything else and no colour is hard-coded outside the token file.
     */
    function readInk() {
      const value = getComputedStyle(wrap!).getPropertyValue('--ink').trim();
      const rgb = parseColour(value);
      if (rgb) ink = rgb;
    }

    function measure() {
      const box = wrap!.getBoundingClientRect();
      width = Math.max(1, Math.round(box.width));
      height = Math.max(1, Math.round(box.height));
      // 1x on purpose. See the note above: there is no edge detail to keep at
      // 2% opacity, and the fill rate is a quarter of the hero's.
      canvas!.width = width;
      canvas!.height = height;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(1, 0, 0, 1, 0, 0);

      const tiles = buildMosaic(width, height, { seed, density });
      readInk();
      weld(tiles);
    }

    /**
     * Sort every cell into an opacity bucket and weld each bucket into one
     * path. This is the whole performance argument: after this runs, the
     * per-frame cost is a constant, and it is sixteen fills.
     */
    function weld(tiles: MosaicTile[]) {
      const built: Path2D[] = [];
      alphas = new Float32Array(BUCKETS);
      phase = new Float32Array(BUCKETS);
      rate = new Float32Array(BUCKETS);
      for (let b = 0; b < BUCKETS; b++) {
        built.push(new Path2D());
        // The bucket's resting opacity, and its own slow cycle. Neighbouring
        // buckets are deliberately close in value and far apart in phase, so
        // the drift never reads as the field switching between two states.
        const u = b / (BUCKETS - 1);
        alphas[b] = (ALPHA_MIN + (ALPHA_MAX - ALPHA_MIN) * u) * strength;
        phase[b] = ((b * 2.39996) % (Math.PI * 2)) + u;
        rate[b] = (Math.PI * 2) / (CYCLE_MIN + CYCLE_SPAN * ((b * 7) % 5) * 0.25);
      }

      for (const tile of tiles) {
        // `veil` is the composition ramp read as darkness: high where the
        // field is closed, low where it opens. Inverted it is exactly the
        // quantity wanted here — how much light this cell is allowed to give
        // back — and `expo`, the per-cell sensor gain, keeps neighbours from
        // landing in the same bucket and turning the lattice into stripes.
        const lit = (1 - tile.veil) * (0.62 + 0.38 * tile.expo);
        const b = Math.max(0, Math.min(BUCKETS - 1, Math.round(lit * (BUCKETS - 1))));
        addRoundRect(
          built[b],
          tile.x + tile.inset,
          tile.y + tile.inset,
          tile.w - tile.inset * 2,
          tile.h - tile.inset * 2,
          tile.radius,
        );
      }
      paths = built;
    }

    function frame(now: number) {
      const g = ctx!;
      const t = mode === 'live' ? now / 1000 : 0;
      g.clearRect(0, 0, width, height);
      for (let b = 0; b < BUCKETS; b++) {
        const breathe = t === 0 ? 1 : 1 + DRIFT * Math.sin(t * rate[b] + phase[b]);
        const a = alphas[b] * breathe;
        if (a <= ALPHA_FLOOR) continue;
        g.fillStyle = `rgba(${ink},${a.toFixed(4)})`;
        g.fill(paths[b]);
      }
    }

    /** Rounded rect, onto a Path2D. Mirrors the hero's, minus the context case. */
    function addRoundRect(sink: Path2D, x: number, y: number, w: number, h: number, r: number) {
      if (w <= 0 || h <= 0) return;
      const rr = Math.min(r, w / 2, h / 2);
      if (typeof sink.roundRect === 'function') {
        sink.roundRect(x, y, w, h, rr);
        return;
      }
      sink.moveTo(x + rr, y);
      sink.arcTo(x + w, y, x + w, y + h, rr);
      sink.arcTo(x + w, y + h, x, y + h, rr);
      sink.arcTo(x, y + h, x, y, rr);
      sink.arcTo(x, y, x + w, y, rr);
      sink.closePath();
    }

    // --- loop ------------------------------------------------------------
    let raf = 0;
    let running = false;
    let visible = true;
    let lastPaint = -1e9;

    const loop = (now: number) => {
      if (now - lastPaint >= IDLE_MS) {
        lastPaint = now;
        frame(now);
      }
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      // The single gate. In `static` mode this returns before rAF is ever
      // reached, which is why a reduced-motion or touch reader schedules
      // exactly zero animation frames for the life of the page.
      if (running || mode === 'static' || !visible || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };

    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    };

    measure();
    frame(0); // The static composition, painted synchronously. Never via rAF.

    // Relayout is coalesced, and a small height-only change is ignored: that
    // is a mobile URL bar collapsing, and re-cutting the field mid-scroll
    // would be both costly and visible.
    let relayout = 0;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      if (Math.round(box.width) === width && Math.abs(Math.round(box.height) - height) < 90) return;
      if (relayout) return;
      // A static field has no loop to repaint it, so it re-lays out on a
      // microtask instead. This is the one place rAF would otherwise sneak
      // back in under reduced motion.
      if (mode === 'static') {
        relayout = 1;
        queueMicrotask(() => {
          relayout = 0;
          measure();
          frame(0);
        });
        return;
      }
      relayout = requestAnimationFrame(() => {
        relayout = 0;
        measure();
        frame(performance.now());
      });
    });
    ro.observe(wrap);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(wrap);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);

    /**
     * Development-only handle for the perf harness, matching <MosaicField>'s,
     * so both variants can be timed by the same script. Stripped from
     * production builds and never referenced by the page.
     */
    type Probe = { frame: (now: number) => void; stats: () => { buckets: number; mode: string } };
    const dev = process.env.NODE_ENV !== 'production';
    if (dev) {
      (wrap as HTMLDivElement & { __ambient?: Probe }).__ambient = {
        frame: (now) => frame(now),
        stats: () => ({ buckets: paths.length, mode }),
      };
    }

    return () => {
      stop();
      if (relayout && mode !== 'static') cancelAnimationFrame(relayout);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      if (dev) delete (wrap as HTMLDivElement & { __ambient?: Probe }).__ambient;
    };
  }, [seed, density, strength]);

  return (
    <div ref={wrapRef} aria-hidden className={cn('pointer-events-none absolute inset-0', className)}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

/**
 * `#rrggbb` / `#rgb` / `rgb(...)` to the `r,g,b` triple a canvas fill string
 * wants. Returns null for anything unrecognised, and the caller keeps its
 * fallback — a texture is never worth a thrown error.
 */
function parseColour(value: string): string | null {
  if (!value) return null;
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex;
    if (full.length < 6) return null;
    const n = Number.parseInt(full.slice(0, 6), 16);
    if (Number.isNaN(n)) return null;
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }
  const m = value.match(/(-?[\d.]+)[,\s]+(-?[\d.]+)[,\s]+(-?[\d.]+)/);
  if (!m) return null;
  return `${Math.round(+m[1])},${Math.round(+m[2])},${Math.round(+m[3])}`;
}
