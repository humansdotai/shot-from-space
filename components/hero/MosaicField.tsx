'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { buildMosaic, mulberry32, VOID_RGB, type MosaicTile } from './mosaic';

/**
 * MOSAIC FIELD — a field of lamps wired to each other.
 *
 * The layer reads the satellite frame underneath it and paints each cell as
 * that cell's average colour: a coarse readout of the picture, laid over the
 * picture. The gutters between cells are left bare, so the full-resolution
 * frame shows as a lattice of light between the samples.
 *
 * Touching a cell IGNITES it, and the light spreads by chain reaction:
 *
 *   IGNITE      The cell under the pointer goes to near-white. Its immediate
 *               neighbours become candidates.
 *   PROPAGATE   Every ignited cell waits 40–140ms of its own, then rolls a
 *               separate probability against each adjacent cell. The odds fall
 *               with graph distance from the origin and are biased along a
 *               random axis chosen per origin, so a cascade elongates and
 *               branches instead of drawing a circle. Each origin also gets its
 *               own hard reach of 3–6 rings, so some runs travel much further
 *               than others.
 *   DECAY       Every lit cell releases on a cubic over 600–1200ms of its own
 *               choosing, so the patch twinkles down rather than switching off.
 *
 * Cascades overlap additively — re-igniting a cell that is already lit adds to
 * its amplitude and clamps at 1, and the emissive pass soft-saturates on top of
 * that, so a pile-up gets hotter without flattening into a white blob.
 *
 * The whole thing is driven from the rAF clock over fixed-size typed arrays:
 * one scheduling queue, one active list, no per-cell timers, no per-cell
 * objects, and nothing allocated inside a frame.
 *
 * Constraints it obeys:
 *   - `pointer-events: none`, always. The layer listens on `window` and hit
 *     tests against a cached rect, so it can never intercept a headline or a
 *     CTA, and it declines to seed over anything that acts.
 *   - Deterministic geometry (see ./mosaic). No `Math.random` anywhere — the
 *     cascade's PRNG is seeded inside the effect, so it never runs on the
 *     server and cannot diverge on hydration.
 *   - `prefers-reduced-motion` renders one static frame and starts no loop.
 *   - Coarse pointers render static; a tap seeds one cascade and the loop runs
 *     only until that cascade has finished, then stops itself.
 *   - Paused when off-screen (IntersectionObserver) or the tab is hidden.
 *   - The frame is sampled from the <img> already on the page, so the effect
 *     costs no extra bytes. Until it decodes, cells fall back to a plain veil.
 */

/**
 * Envelope, in ms. A lamp: snaps on, sits at full for a beat, then falls away
 * over a lifetime rolled for that cell alone (≈665–1225ms end to end).
 */
const ATTACK = 55;
const HOLD = 90;
const LIFE_MIN = 520;
const LIFE_SPAN = 560;
/** Release shape. Above 1 it leaves late, below 1 it leaves early. */
const RELEASE = 1.7;

/** Each ignited cell waits this long before rolling for its neighbours. */
const DELAY_MIN = 40;
const DELAY_SPAN = 100;

/** Propagation odds at the origin, and the per-ring decay applied to them. */
const P0 = 0.86;
const FALLOFF = 0.86;
/** Amplitude handed to the next ring. Outer cells are warm, not white. */
const RING_DIM = 0.88;
/** Hard stop, rolled per origin: 3–6 rings. */
const REACH_MIN = 3;
const REACH_SPAN = 4;

/**
 * Direct hover response. The tile under the pointer lights the moment the
 * pointer enters it — ungated by the seed throttle below, which governs
 * cascades only. Without this, crossing a tile did nothing until 16px of
 * travel AND 90ms had elapsed, so the field felt dead under the cursor.
 * Reach 0 keeps it a lamp, not a cascade: it lights, it decays, it spreads
 * to nothing.
 */
const HOVER_AMOUNT = 0.62;

/** New origins while the pointer moves: one per 90–150ms, and only if it moved. */
const SEED_MIN = 90;
const SEED_SPAN = 60;
const SEED_DIST2 = 16 * 16;
/** Stop seeding once the field is this lit — overlap should not become a wash. */
const SEED_CEILING = 0.42;

/** Owner-grid resolution, px. Backs both hit-testing and adjacency probing. */
const PROBE = 8;
/** Ceiling on recorded neighbours per cell. A quadtree leaf never nears this. */
const MAX_NBR = 12;

/** Idle repaint interval when nothing is cascading. 20fps is plenty for drift. */
const IDLE_MS = 50;

/** Bloom halo radius, px. Clamped so a big root cell does not get a big smear. */
const BLOOM_MIN = 26;
const BLOOM_MAX = 96;
/** Cells whose resting `light` clears this get a permanent, breathing halo. */
const SPARK_MIN = 0.11;

/** Downscale used when reading the frame. A cell needs an average, not detail. */
const SAMPLE_DIV = 4;

const smooth = (u: number) => u * u * (3 - 2 * u);

/**
 * Emissive ramp, precomputed. A lamp warming up: deep amber where a cascade is
 * only just reaching, near-white at its core. Baked into fill strings so the
 * frame loop assigns a colour instead of building one.
 */
const GLOW: string[] = [];
for (let k = 0; k < 32; k++) {
  const u = k / 31;
  GLOW.push(`rgb(255,${Math.round(186 + 66 * u)},${Math.round(118 + 128 * Math.pow(u, 1.3))})`);
}

export function MosaicField({
  className,
  seed,
  density,
  /** CSS selector for the frame to sample, searched in the parent element. */
  source = 'img[data-mosaic-source]',
  /** Set false to render the static frame only — no ignition, no cascade. */
  interactive = true,
  /**
   * Global intensity of the LIGHT, 0..1. Default 1 is the homepage.
   *
   * It scales the three things that make the effect loud — the lamp body, the
   * resting sparks' halos and the cascade's halos — and softens how far a lit
   * cell pulls its own photographic sample out from under itself. It does NOT
   * touch the resting raster: the sampling lattice is the structure of the
   * thing and dimming it would just look like a lower-contrast picture. So a
   * low value keeps the sensor grid exactly as legible and turns the light
   * show down, which is what "the same effect, more subtle" has to mean.
   *
   * BEWARE THE CURVE. This multiplies THREE separate stages of the paint —
   * the lamp body, the halo blits, and the ground pull-out — so the perceived
   * light falls off far faster than the number does. Measured on the dossier
   * plate at 1440, peak lit area (luminance > 120) under a pointer sweep:
   * 0.3 → 0.03%, 0.45 → 1.9%, 0.55 → 7.6%, 0.7 → 7.2-8.7%, 1.0 → 9.3%. Below
   * about 0.45 the lamp never reaches white and the effect reads as absent
   * rather than as subtle. Pick a value by measuring, not by taste: 0.7 is
   * roughly "the homepage, with the blown-white cores held back", and the
   * useful range is 0.55-1. There is no useful setting under 0.45.
   *
   * The archive hero (`ArchiveHero`) and the homepage both run the default 1;
   * the dossier plate (`MissionPlate`) runs 0.7, because it carries an h1, a
   * mission code and a coordinate rail over the same picture.
   */
  strength = 1,
}: {
  className?: string;
  seed?: number;
  density?: number;
  source?: string;
  interactive?: boolean;
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
    /** live: idle drift + cascades. transient: asleep until a tap. static: one frame. */
    const mode: 'live' | 'transient' | 'static' = reduced
      ? 'static'
      : fine && interactive
        ? 'live'
        : 'transient';

    /**
     * The cascade's randomness. Seeded once, here, on the client only — the
     * server never runs this effect, so there is nothing to diverge.
     */
    const rnd = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);

    /** Clamped once here so the paint loop never branches on it. */
    const gain = strength < 0 ? 0 : strength > 1 ? 1 : strength;

    let width = 0;
    let height = 0;
    let tiles: MosaicTile[] = [];
    let n = 0;

    /** Per-cell sampled colour as a ready fill string. Empty until decoded. */
    let inkStyle: string[] = [];
    /**
     * One cached path per cell. Nothing deforms a cell any more — ignition is
     * carried entirely by colour and bloom — so these are built once per
     * layout and every fill in the frame loop reuses them.
     */
    let paths: Path2D[] = [];
    /**
     * The cells that burn at rest, listed once at layout. They get a gentle
     * permanent halo in the additive pass — the scattered lights already in
     * the field, before anything is touched.
     */
    let sparks = new Int32Array(0);
    /** Halo radius per cell, px. Precomputed; the loop only scales it. */
    let halo = new Float32Array(0);
    let sampled = false;
    /** Cached so pointermove never forces a layout read. */
    let rect = wrap.getBoundingClientRect();

    // --- adjacency ------------------------------------------------------
    // Cells are irregular quadtree leaves, so "next to" has to be measured.
    // `owner` is a coarse point-lookup grid over the field; adjacency is found
    // by walking each cell's border and reading who lives just outside it.
    // Both are rebuilt only on layout.
    let gw = 0;
    let gh = 0;
    let owner = new Int32Array(0);
    /** CSR adjacency: neighbours of i are nbrList[nbrStart[i] .. nbrStart[i+1]). */
    let nbrStart = new Int32Array(1);
    let nbrList = new Int32Array(0);

    // --- cascade state ---------------------------------------------------
    // Fixed-size pools, indexed by tile. Allocated on layout, never in a frame.
    let lvl = new Float32Array(0); // current emissive level, 0..1
    let amp = new Float32Array(0); // envelope amplitude at last ignition
    // Times are f64: the rAF clock is absolute ms and f32 loses sub-ms
    // resolution on a long-lived tab.
    let t0 = new Float64Array(0); // ignition time, ms on the rAF clock
    let life = new Float32Array(0); // release duration, ms
    let fireAt = new Float64Array(0); // when this cell rolls for its neighbours
    let bx = new Float32Array(0); // cascade bias vector, inherited down the chain
    let by = new Float32Array(0);
    let ring = new Uint8Array(0); // graph distance from the origin that lit it
    let reach = new Uint8Array(0); // that origin's hard ring limit
    let onActive = new Uint8Array(0);
    let onPend = new Uint8Array(0);
    let active = new Int32Array(0); // indices with lvl > 0
    let pend = new Int32Array(0); // indices waiting to propagate
    let firing = new Int32Array(0); // scratch: this frame's propagations
    let activeCount = 0;
    let pendCount = 0;

    const [vr, vg, vb] = VOID_RGB;
    const VOID_STYLE = `rgb(${vr},${vg},${vb})`;

    /**
     * The bloom sprite: one small radial gradient, drawn once, then stamped
     * under every lit cell with `lighter`. This is what makes a lit cell read
     * as a lamp behind the grid rather than as a pale rectangle — and it costs
     * a scaled blit, where `shadowBlur` would cost a real convolution.
     */
    const bloom = document.createElement('canvas');
    bloom.width = 64;
    bloom.height = 64;
    {
      const bc = bloom.getContext('2d');
      if (bc) {
        const grad = bc.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,244,224,1)');
        grad.addColorStop(0.26, 'rgba(255,208,156,0.42)');
        grad.addColorStop(0.62, 'rgba(255,176,116,0.12)');
        grad.addColorStop(1, 'rgba(255,164,104,0)');
        bc.fillStyle = grad;
        bc.fillRect(0, 0, 64, 64);
      }
    }

    /**
     * Read the frame once and reduce it to one colour per cell.
     *
     * The frame is drawn to a quarter-scale scratch canvas using the same
     * cover crop the <img> uses, then each cell averages a 3x3 tap of that.
     * The result is graded before it is stored: pulled cool and slightly
     * violet, sunk toward the void by the composition ramp, and lifted toward
     * its light target where the cell is meant to burn. A muted slate ground
     * is what lets the warm cascade read as light rather than as paint.
     */
    function sample() {
      const img = wrap!.parentElement?.querySelector(source) as HTMLImageElement | null;
      if (!img || !img.complete || !img.naturalWidth || !n) return;

      const sw = Math.max(1, Math.round(width / SAMPLE_DIV));
      const sh = Math.max(1, Math.round(height / SAMPLE_DIV));
      const scratch = document.createElement('canvas');
      scratch.width = sw;
      scratch.height = sh;
      const sctx = scratch.getContext('2d', { willReadFrequently: true });
      if (!sctx) return;

      // object-fit: cover, object-position: center — mirrored exactly.
      const scale = Math.max(sw / img.naturalWidth, sh / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      let data: Uint8ClampedArray;
      try {
        sctx.drawImage(img, (sw - dw) / 2, (sh - dh) / 2, dw, dh);
        data = sctx.getImageData(0, 0, sw, sh).data;
      } catch {
        // A frame that cannot be read (still decoding, or cross-origin) is not
        // fatal: the cells keep their plain veil, which is a valid look.
        return;
      }

      const next: string[] = new Array(n);
      for (let i = 0; i < n; i++) {
        const tile = tiles[i];
        let r = 0;
        let g = 0;
        let b = 0;
        for (let ax = 1; ax <= 3; ax++) {
          for (let ay = 1; ay <= 3; ay++) {
            const sx = Math.min(
              sw - 1,
              Math.max(0, Math.round((tile.x + (tile.w * ax) / 4) / SAMPLE_DIV)),
            );
            const sy = Math.min(
              sh - 1,
              Math.max(0, Math.round((tile.y + (tile.h * ay) / 4) / SAMPLE_DIV)),
            );
            const o = (sy * sw + sx) * 4;
            r += data[o];
            g += data[o + 1];
            b += data[o + 2];
          }
        }
        r /= 9;
        g /= 9;
        b /= 9;

        // Grade. A sensor readout is quieter than the scene it read, and a
        // touch more contrasty — cells have to separate from one another.
        r = (r - 118) * 1.14 + 118;
        g = (g - 118) * 1.14 + 118;
        b = (b - 118) * 1.14 + 118;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const sat = 0.5;
        r = lum + (r - lum) * sat;
        g = lum + (g - lum) * sat;
        b = lum + (b - lum) * sat;
        // Mixed toward muted slate/violet and held down. The resting field has
        // to be quiet ground: everything the cascade does is measured against
        // it, and a bright ground turns a lit cell into a beige patch instead
        // of a lamp. Mixing rather than adding keeps the blacks black.
        r = (r * 0.8 + 54 * 0.2) * 0.86;
        g = (g * 0.8 + 50 * 0.2) * 0.84;
        b = (b * 0.8 + 78 * 0.2) * 0.9;

        const k = (0.34 + 0.5 * tile.openness) * tile.expo;
        r = vr + (r - vr) * k;
        g = vg + (g - vg) * k;
        b = vb + (b - vb) * k;

        if (tile.light > 0) {
          // Capped hard: a resting hot cell is warmed, never repainted. Its
          // brightness comes from the bloom stamped over it, not from paint —
          // paint at this size only ever reads as a flat swatch.
          const m = Math.min(0.26, tile.light * 1.1);
          r += (tile.lr - r) * m;
          g += (tile.lg - g) * m;
          b += (tile.lb - b) * m;
        }

        // Baked into a string now so the frame loop only ever assigns one.
        next[i] = `rgb(${clamp255(r)},${clamp255(g)},${clamp255(b)})`;
      }
      inkStyle = next;
      sampled = true;
    }

    function clamp255(v: number) {
      return v < 0 ? 0 : v > 255 ? 255 : v | 0;
    }

    /**
     * The point-lookup grid. One tile index per PROBE-sized square, written
     * tile by tile — later writers win on the seam, which is exactly what we
     * want for both hit-testing and border probing.
     */
    function buildOwner() {
      gw = Math.max(1, Math.ceil(width / PROBE));
      gh = Math.max(1, Math.ceil(height / PROBE));
      owner = new Int32Array(gw * gh).fill(-1);
      for (let i = 0; i < n; i++) {
        const t = tiles[i];
        const x0 = Math.max(0, (t.x / PROBE) | 0);
        const x1 = Math.min(gw - 1, ((t.x + t.w - 0.01) / PROBE) | 0);
        const y0 = Math.max(0, (t.y / PROBE) | 0);
        const y1 = Math.min(gh - 1, ((t.y + t.h - 0.01) / PROBE) | 0);
        for (let gy = y0; gy <= y1; gy++) {
          const row = gy * gw;
          for (let gx = x0; gx <= x1; gx++) owner[row + gx] = i;
        }
      }
    }

    function ownerAt(x: number, y: number) {
      if (x < 0 || y < 0 || x >= width || y >= height) return -1;
      return owner[((y / PROBE) | 0) * gw + ((x / PROBE) | 0)];
    }

    /**
     * Walk each cell's border, read who lives 3px outside it, and record the
     * distinct answers. Built once per layout into flat CSR arrays so the
     * cascade can walk a cell's neighbours without touching an object.
     */
    function buildNeighbours() {
      const counts = new Int32Array(n);
      const flat = new Int32Array(n * MAX_NBR);
      const stamp = new Int32Array(n).fill(-1);
      const OUT = 3;

      for (let i = 0; i < n; i++) {
        const t = tiles[i];
        const base = i * MAX_NBR;
        const add = (px: number, py: number) => {
          const j = ownerAt(px, py);
          if (j < 0 || j === i || stamp[j] === i) return;
          stamp[j] = i;
          if (counts[i] < MAX_NBR) flat[base + counts[i]++] = j;
        };
        const stepX = Math.max(PROBE, t.w / 8);
        const stepY = Math.max(PROBE, t.h / 8);
        for (let x = t.x + 1; x < t.x + t.w; x += stepX) {
          add(x, t.y - OUT);
          add(x, t.y + t.h + OUT);
        }
        for (let y = t.y + 1; y < t.y + t.h; y += stepY) {
          add(t.x - OUT, y);
          add(t.x + t.w + OUT, y);
        }
        // The far corners of long edges, which a coarse step can miss.
        add(t.x + t.w - 1, t.y - OUT);
        add(t.x + t.w - 1, t.y + t.h + OUT);
        add(t.x - OUT, t.y + t.h - 1);
        add(t.x + t.w + OUT, t.y + t.h - 1);
      }

      nbrStart = new Int32Array(n + 1);
      let total = 0;
      for (let i = 0; i < n; i++) {
        nbrStart[i] = total;
        total += counts[i];
      }
      nbrStart[n] = total;
      nbrList = new Int32Array(total);
      for (let i = 0; i < n; i++) {
        const base = i * MAX_NBR;
        const out = nbrStart[i];
        for (let k = 0; k < counts[i]; k++) nbrList[out + k] = flat[base + k];
      }
    }

    function allocState() {
      lvl = new Float32Array(n);
      amp = new Float32Array(n);
      t0 = new Float64Array(n);
      life = new Float32Array(n);
      fireAt = new Float64Array(n);
      bx = new Float32Array(n);
      by = new Float32Array(n);
      ring = new Uint8Array(n);
      reach = new Uint8Array(n);
      onActive = new Uint8Array(n);
      onPend = new Uint8Array(n);
      active = new Int32Array(n);
      pend = new Int32Array(n);
      firing = new Int32Array(n);
      activeCount = 0;
      pendCount = 0;
    }

    // --- cascade ---------------------------------------------------------

    /**
     * Light one cell.
     *
     * Amplitude is added to whatever the cell is already giving off and
     * clamped at 1, which is how two cascades crossing get brighter without
     * either one restarting from nothing. The envelope restarts from now, with
     * a release length rolled for this cell alone, so neighbours never fade in
     * step. If the cell is still inside its origin's reach it also books a
     * slot in the propagation queue.
     */
    function ignite(i: number, amount: number, r: number, rch: number, now: number, dx: number, dy: number) {
      const carried = lvl[i] + amount;
      amp[i] = carried > 1 ? 1 : carried;
      t0[i] = now;
      life[i] = LIFE_MIN + rnd() * LIFE_SPAN;
      ring[i] = r;
      reach[i] = rch;
      bx[i] = dx;
      by[i] = dy;
      if (!onActive[i]) {
        onActive[i] = 1;
        active[activeCount++] = i;
      }
      if (r < rch && !onPend[i]) {
        onPend[i] = 1;
        fireAt[i] = now + DELAY_MIN + rnd() * DELAY_SPAN;
        pend[pendCount++] = i;
      }
    }

    /**
     * One cell's turn to try its neighbours.
     *
     * Each adjacent cell gets its own coin flip. The odds fall geometrically
     * with the ring already travelled and are stretched along the origin's
     * bias axis, so the front is lumpy and directional; a cell that is still
     * visibly lit is skipped, which both stops the chain folding back on
     * itself and guarantees the cascade terminates.
     */
    function propagate(i: number, now: number) {
      const r = ring[i];
      const rch = reach[i];
      if (r >= rch) return;
      const nr = r + 1;
      const p = P0 * Math.pow(FALLOFF, r);
      const amount = Math.pow(RING_DIM, nr);
      const ti = tiles[i];
      const dirx = bx[i];
      const diry = by[i];
      const end = nbrStart[i + 1];
      for (let k = nbrStart[i]; k < end; k++) {
        const j = nbrList[k];
        if (lvl[j] > 0.02) continue;
        const tj = tiles[j];
        const vx = tj.cx - ti.cx;
        const vy = tj.cy - ti.cy;
        const len = Math.sqrt(vx * vx + vy * vy) || 1;
        // -1 behind the cascade's axis, +1 ahead of it.
        const align = (vx / len) * dirx + (vy / len) * diry;
        if (rnd() > p * (0.52 + 0.72 * (0.5 + 0.5 * align))) continue;
        ignite(j, amount, nr, rch, now, dirx, diry);
      }
    }

    /** Start a cascade at a point, if a cell lives there. */
    function seedAt(x: number, y: number, now: number) {
      if (activeCount > n * SEED_CEILING) return false;
      const i = ownerAt(x, y);
      if (i < 0) return false;
      const rch = REACH_MIN + ((rnd() * REACH_SPAN) | 0);
      const ang = rnd() * Math.PI * 2;
      ignite(i, 1, 0, rch, now, Math.cos(ang), Math.sin(ang));
      return true;
    }

    /** Advance the queue and the envelopes. Returns nothing; mutates `lvl`. */
    function step(now: number) {
      // Queue: split into "still waiting" and "fires now" before running any
      // propagation, because propagating appends to the same queue.
      let keep = 0;
      let fireCount = 0;
      for (let k = 0; k < pendCount; k++) {
        const i = pend[k];
        if (now < fireAt[i]) {
          pend[keep++] = i;
        } else {
          onPend[i] = 0;
          firing[fireCount++] = i;
        }
      }
      pendCount = keep;
      for (let k = 0; k < fireCount; k++) propagate(firing[k], now);

      // Envelopes: attack, then a cubic release over the cell's own lifetime.
      // Dead cells drop out of the active list by compaction.
      let live = 0;
      for (let k = 0; k < activeCount; k++) {
        const i = active[k];
        const e = now - t0[i];
        let v: number;
        if (e < ATTACK) {
          v = amp[i] * smooth(e <= 0 ? 0 : e / ATTACK);
        } else if (e < ATTACK + HOLD) {
          v = amp[i];
        } else {
          const u = (e - ATTACK - HOLD) / life[i];
          if (u >= 1) {
            lvl[i] = 0;
            onActive[i] = 0;
            continue;
          }
          v = amp[i] * Math.pow(1 - u, RELEASE);
        }
        lvl[i] = v;
        active[live++] = i;
      }
      activeCount = live;
    }

    // --- layout ----------------------------------------------------------

    function measure() {
      const box = wrap!.getBoundingClientRect();
      rect = box;
      width = Math.max(1, Math.round(box.width));
      height = Math.max(1, Math.round(box.height));
      // 1.5 is the ceiling on purpose. These are soft-edged shapes over a
      // photograph, not type: the extra quarter of resolution costs a third of
      // the fill rate and cannot be seen.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      tiles = buildMosaic(width, height, { seed, density });
      n = tiles.length;
      inkStyle = [];
      paths = tiles.map((tile) => {
        const p2 = new Path2D();
        addRoundRect(
          p2,
          tile.x + tile.inset,
          tile.y + tile.inset,
          tile.w - tile.inset * 2,
          tile.h - tile.inset * 2,
          tile.radius,
        );
        return p2;
      });
      halo = new Float32Array(n);
      let sparkCount = 0;
      for (let i = 0; i < n; i++) {
        const t = tiles[i];
        const rr = (t.w > t.h ? t.w : t.h) * 0.62;
        halo[i] = rr < BLOOM_MIN ? BLOOM_MIN : rr > BLOOM_MAX ? BLOOM_MAX : rr;
        if (t.light >= SPARK_MIN) sparkCount++;
      }
      sparks = new Int32Array(sparkCount);
      sparkCount = 0;
      for (let i = 0; i < n; i++) if (tiles[i].light >= SPARK_MIN) sparks[sparkCount++] = i;
      buildOwner();
      buildNeighbours();
      allocState();
      sampled = false;
      sample();
    }

    /** Rounded rect, onto a Path2D or straight onto the context. */
    function addRoundRect(
      sink: Path2D | CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
    ) {
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

    // --- paint -----------------------------------------------------------

    /**
     * Three passes, and none of them allocates.
     *
     * 1. GROUND — every cell, `source-over`, using the fill string baked at
     *    sample time with `globalAlpha` carrying the varying part. That is what
     *    keeps a thousand-cell repaint free of string building. A lit cell has
     *    its sample pulled almost all the way out as it brightens, so the light
     *    lands on dark ground rather than fighting a grey photograph.
     *
     * 2. LAMP — `source-over`, the lit cells themselves, painted from the
     *    emissive ramp. The body REPLACES the ground instead of adding to it;
     *    additive bodies over a photograph go beige, which is the one thing a
     *    lamp must not do. Overlap still compounds, one level up: amplitudes
     *    sum on ignition and clamp at 1, and the ramp tops out at a warm white,
     *    never at pure white.
     *
     * 3. HALO — `lighter`, scaled blits of the bloom sprite over the top: one
     *    per resting spark, and one wider than the cell per lit cell. Drawn
     *    last, so it whitens the lamp it belongs to and bleeds into the
     *    gutters and onto its neighbours. Halos from adjacent cells add, which
     *    is where overlapping cascades genuinely compound; the sprite's own
     *    ceiling keeps a pile-up warm rather than blown.
     */
    function frame(now: number) {
      const g = ctx!;
      const t = mode === 'live' ? now / 1000 : 0;

      g.clearRect(0, 0, width, height);
      g.globalAlpha = 1;

      // --- 1. ground -------------------------------------------------
      let lastStyle = '';
      for (let i = 0; i < n; i++) {
        const tile = tiles[i];
        // Idle drift: a handful of cells breathe, the rest barely move.
        const pulse =
          t === 0
            ? 0
            : tile.hot
              ? Math.sin(t * tile.speed * 2.1 + tile.phase) * 0.06
              : Math.sin(t * tile.speed + tile.phase) * 0.014;
        const e = lvl[i];
        let a = (sampled ? tile.cover : tile.veil) - pulse;
        if (e > 0) a *= 1 - 0.88 * e * gain;
        if (a < 0.004) continue;
        const style = sampled ? inkStyle[i] : VOID_STYLE;
        if (style !== lastStyle) {
          g.fillStyle = style;
          lastStyle = style;
        }
        g.globalAlpha = a > 1 ? 1 : a;
        g.fill(paths[i]);
      }

      // --- 2. lamp ---------------------------------------------------
      for (let k = 0; k < activeCount; k++) {
        const i = active[k];
        const e = lvl[i];
        if (e < 0.01) continue;
        g.globalAlpha = Math.pow(e, 0.9) * 0.88 * gain;
        g.fillStyle = GLOW[(e * 31) | 0];
        g.fill(paths[i]);
      }

      // --- 3. halo ---------------------------------------------------
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < sparks.length; k++) {
        const i = sparks[k];
        if (lvl[i] > 0.05) continue; // a lit cell gets the brighter halo below
        const tile = tiles[i];
        const breathe = t === 0 ? 0.5 : 0.5 + 0.5 * Math.sin(t * tile.speed * 1.7 + tile.phase);
        const br = halo[i] * (0.7 + 0.18 * breathe);
        g.globalAlpha = tile.light * (0.5 + 0.5 * breathe) * 0.9 * gain;
        g.drawImage(bloom, tile.cx - br, tile.cy - br, br * 2, br * 2);
      }
      for (let k = 0; k < activeCount; k++) {
        const i = active[k];
        const e = lvl[i];
        if (e < 0.01) continue;
        const tile = tiles[i];
        // One wide stamp, always larger than the cell it belongs to, so it
        // whitens the whole lamp and spills into the gutters and onto its
        // neighbours. A tighter stamp would read as a lens flare sitting
        // inside the cell rather than as the cell itself emitting.
        const br = halo[i] * (0.95 + 1.05 * e);
        g.globalAlpha = Math.pow(e, 1.4) * 0.8 * gain;
        g.drawImage(bloom, tile.cx - br, tile.cy - br, br * 2, br * 2);
      }
      g.globalCompositeOperation = 'source-over';

      g.globalAlpha = 1;
    }

    // --- loop ------------------------------------------------------------
    let raf = 0;
    let running = false;
    let visible = true;
    let lastPaint = -1e9;

    /**
     * Full rate while anything is lit or queued; 20fps for the idle drift.
     * In transient mode there is no idle at all — the loop exists only for the
     * life of a cascade and shuts itself off when the last cell goes out.
     */
    const loop = (now: number) => {
      const busy = activeCount > 0 || pendCount > 0;
      if (busy) step(now);
      if (busy || now - lastPaint >= IDLE_MS) {
        lastPaint = now;
        frame(now);
      }
      if (mode === 'live' || busy) {
        raf = requestAnimationFrame(loop);
      } else {
        running = false;
        frame(now); // settle on the static composition
      }
    };
    const start = () => {
      if (running || mode === 'static' || !visible || document.hidden) return;
      if (mode === 'transient' && activeCount === 0 && pendCount === 0) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    };

    measure();
    frame(0);

    // The frame may still be decoding at first paint. Sample again when it
    // lands so the cells fill in without a flash.
    const sourceImg = wrap.parentElement?.querySelector(source) as HTMLImageElement | null;
    const onFrameReady = () => {
      sample();
      frame(performance.now());
    };
    if (sourceImg && !sourceImg.complete) {
      sourceImg.addEventListener('load', onFrameReady);
    } else if (sourceImg?.decode) {
      void sourceImg
        .decode()
        .then(onFrameReady)
        .catch(() => undefined);
    }

    // --- input -----------------------------------------------------------

    /** The layer never acts over something that acts. */
    function blocked(target: EventTarget | null) {
      const el = target as HTMLElement | null;
      return !!el?.closest?.(
        'a,button,input,select,textarea,label,[role="button"],[data-no-mosaic]',
      );
    }

    let lastSeed = -1e9;
    let seedGap = SEED_MIN;
    let lastX = -1e9;
    let lastY = -1e9;
    /** Tile the pointer is currently inside, so each is lit once on entry. */
    let hoverTile = -1;

    const onMove = (e: PointerEvent) => {
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        return;
      }
      const now = performance.now();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (blocked(e.target)) return;

      // Immediate feedback: entering a tile lights that tile, every time, with
      // no time or distance gate. This is what makes the field feel alive
      // under the cursor. Re-entering the same tile does nothing, so resting
      // the pointer does not strobe.
      const hit = ownerAt(x, y);
      if (hit >= 0 && hit !== hoverTile) {
        hoverTile = hit;
        const a = rnd() * Math.PI * 2;
        ignite(hit, HOVER_AMOUNT, 0, 0, now, Math.cos(a), Math.sin(a));
        start();
      }

      // Cascades stay throttled in time AND distance: a resting pointer stops
      // seeding, and a fast sweep leaves separate ignitions rather than a smear.
      if (now - lastSeed < seedGap) return;
      const dx = x - lastX;
      const dy = y - lastY;
      if (dx * dx + dy * dy < SEED_DIST2) return;
      lastX = x;
      lastY = y;
      lastSeed = now;
      seedGap = SEED_MIN + rnd() * SEED_SPAN;
      if (seedAt(x, y, now)) start();
    };

    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        return;
      }
      if (blocked(e.target)) return;
      const now = performance.now();
      lastSeed = now;
      lastX = e.clientX - rect.left;
      lastY = e.clientY - rect.top;
      if (seedAt(lastX, lastY, now)) start();
    };

    const onScroll = () => {
      rect = wrap.getBoundingClientRect();
    };

    // Relayout is coalesced to one frame, and a small height-only change is
    // ignored outright: that is the mobile URL bar collapsing, and re-cutting
    // the whole field while someone scrolls would be both costly and visible.
    let relayout = 0;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      if (Math.round(box.width) === width && Math.abs(Math.round(box.height) - height) < 90) {
        rect = wrap.getBoundingClientRect();
        return;
      }
      if (relayout) return;
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
        rect = entry.boundingClientRect;
        if (visible) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(wrap);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    if (interactive && !reduced) {
      window.addEventListener('pointerdown', onDown, { passive: true });
      if (mode === 'live') window.addEventListener('pointermove', onMove, { passive: true });
    }

    /**
     * Development-only handle for the perf harness: it lets a measurement run
     * drive the cascade and time `step`/`frame` in isolation. Stripped from
     * production builds, and never referenced by the page itself.
     */
    type Probe = {
      seed: (x: number, y: number) => void;
      stats: () => { tiles: number; active: number; pending: number; edges: number };
      frame: (now: number) => void;
      step: (now: number) => void;
    };
    const dev = process.env.NODE_ENV !== 'production';
    if (dev) {
      (wrap as HTMLDivElement & { __mosaic?: Probe }).__mosaic = {
        seed: (x, y) => {
          seedAt(x, y, performance.now());
          start();
        },
        stats: () => ({
          tiles: n,
          active: activeCount,
          pending: pendCount,
          edges: nbrList.length,
        }),
        frame: (now) => frame(now),
        step: (now) => step(now),
      };
    }

    return () => {
      stop();
      if (relayout) cancelAnimationFrame(relayout);
      ro.disconnect();
      io.disconnect();
      sourceImg?.removeEventListener('load', onFrameReady);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      if (dev) delete (wrap as HTMLDivElement & { __mosaic?: Probe }).__mosaic;
    };
  }, [seed, density, interactive, source, strength]);

  return (
    <div ref={wrapRef} aria-hidden className={cn('pointer-events-none absolute inset-0', className)}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
