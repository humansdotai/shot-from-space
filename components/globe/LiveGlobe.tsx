'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Grid12 } from '@/components/fui';
import type { GpElement } from '@/lib/integrations/celestrak';
import { FLEET, fleetMember, type FleetMember } from '@/lib/satellites/fleet';
import {
  elementAgeHours,
  periodMinutes,
  subPointAt,
  toSatrec,
  type SubPoint,
} from '@/lib/satellites/propagate';
import { cn } from '@/lib/utils';
import { coastline } from './coastline';
import { EARTH_RADIUS_KM, graticule, latLonToUnit, viewMatrix } from './projection';
import { orbitTrack } from './track';
import { RecordPanel, ageLabel } from './RecordPanel';

/**
 * LIVE GLOBE — a wireframe Earth with the tracked fleet on it, to scale.
 *
 * ========================================================================
 * WHY THERE IS NO 3D LIBRARY IN THIS FILE
 * ========================================================================
 * The whole drawing is a sphere, a graticule, a coastline, eight points and
 * one path. Under an orthographic camera each of those is a 3×3 matrix
 * multiply and a sign test — see `./projection.ts`, which is the entire 3D
 * engine and is eighty lines of arithmetic. three.js would add roughly 150 kB
 * gzipped to a homepage that ships about 103 kB of shared JavaScript, in
 * exchange for a renderer whose lighting, materials and depth buffer this
 * section would then have to switch back off to get a hairline instrument.
 *
 * The house precedent is `components/hero/MosaicField.tsx`: Canvas 2D, typed
 * arrays, one rAF loop, nothing allocated inside a frame. This follows it.
 *
 * ========================================================================
 * WHAT IS REAL HERE
 * ========================================================================
 * · POSITIONS. Every marker is `subPointAt()` from `lib/satellites/propagate`
 *   run against the CelesTrak element set the server fetched — the same call,
 *   the same instant and the same numbers the card prints and the same ones
 *   `components/satellites/FleetTracker.tsx` shows elsewhere on the site.
 *
 * · ALTITUDE, TO SCALE. A satellite is drawn at 1 + altitude/6371 Earth
 *   radii from the centre of the disc. Terra at 705 km sits at 1.111 R;
 *   WorldView-3 at 617 km sits at 1.097 R. That is CLOSE to the limb, and it
 *   is supposed to be: low Earth orbit is a skin on this planet, roughly a
 *   tenth of its radius, and every picture that draws satellites in a
 *   comfortable ring a third of the way out is lying by a factor of three.
 *   The hairline tick under each marker is the altitude at globe scale, so
 *   the drawing can be measured against the readout beside it.
 *
 * · THE ORBIT TRACK. 240 SGP4 solutions across one revolution, Earth-fixed,
 *   lifted to the propagated altitude at every sample. See `./track.ts`.
 *
 * · THE COASTLINE. Natural Earth 110m, public domain, 5.7 kB. See
 *   `./coastline.ts`.
 *
 * What is NOT real, and is not presented as real: the auto-rotation. That is
 * a camera spin at about 1.5°/s. The Earth turns at 0.0042°/s and nothing in
 * the copy calls this rotation the Earth's.
 *
 * ========================================================================
 * THE FRAME BUDGET
 * ========================================================================
 * Propagation runs at 1 Hz, not per frame. A satellite moves 7 km/s, which at
 * this scale is a quarter of a pixel per second — propagating eight orbits
 * sixty times a second would buy four thousandths of a pixel per frame. The
 * paint loop therefore only ROTATES and PROJECTS: 3,386 points through nine
 * multiplies, into two reused Float32Arrays, then six strokes. Nothing inside
 * the loop allocates.
 *
 * ========================================================================
 * REDUCED MOTION
 * ========================================================================
 * `prefers-reduced-motion: reduce` paints ONE frame and schedules nothing:
 * no rAF is ever requested, the spin is not applied and the clock does not
 * tick. The readout then says the frame is fixed and stamps the instant, so
 * a still picture is never mistaken for a live one. Selecting a satellite
 * still repaints — that is an event, not motion — and dragging still works,
 * because direct manipulation is not animation.
 */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** One camera revolution every four minutes. Slow enough to read as drift. */
const SPIN_RAD_PER_S = TAU / 240;

/** Longitude at the centre of the disc on first paint. `yaw = 90° − centre`. */
const INITIAL_CENTRE_LON = 20;
const INITIAL_YAW = (90 - INITIAL_CENTRE_LON) * DEG;
const INITIAL_PITCH = 16 * DEG;
const MAX_PITCH = 75 * DEG;

/**
 * Earth radius as a fraction of the half-box. The remainder is the orbit
 * shell: the highest satellite tracked is Sentinel-2C at about 804 km, which
 * draws at 1.126 R, so 0.85 keeps its marker 4% inside the box at every size.
 */
const GLOBE_FILL = 0.85;

/** Drag sensitivity: a full box width of travel turns the globe half a turn. */
const DRAG_RAD_PER_PX = 0.006;

/** Past this, a pointer gesture is a rotation and not a click on a marker. */
const DRAG_SLOP_PX = 6;

/**
 * Catch diameter around a marker, matching the 44px minimum target in
 * CONFIGURATOR.md §3.7. It is a RADIUS SEARCH and not a stack of 44px boxes:
 * two satellites five degrees apart are 27px apart on a 280px globe, their
 * boxes overlap almost completely, and the one that wins a tap is then
 * whichever happens to be later in the DOM. Nearest-marker-wins is the only
 * rule that selects the thing under the finger.
 */
const HIT_PX = 44;

type Tracked = {
  element: GpElement;
  member: FleetMember;
  rec: NonNullable<ReturnType<typeof toSatrec>>;
};

export function LiveGlobe({
  elements,
  source,
  serverNow,
  className,
}: {
  elements: GpElement[];
  source: 'live' | 'snapshot';
  /** The server's instant, ISO. Seeds the clock so hydration matches. */
  serverNow: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const now = useLiveClock(serverNow, reduced);

  /** Parsing element sets is not free and they change every few hours. */
  const tracked = useMemo<Tracked[]>(() => {
    return elements
      .map((element) => {
        const member = fleetMember(element.NORAD_CAT_ID);
        const rec = toSatrec(element);
        return member && rec ? { element, member, rec } : null;
      })
      .filter((v): v is Tracked => v !== null)
      .sort((a, b) => FLEET.indexOf(a.member) - FLEET.indexOf(b.member));
  }, [elements]);

  /** Propagated once a second, never inside the paint loop. */
  const fixes = useMemo(
    () => tracked.map((t) => subPointAt(t.rec, now)),
    [tracked, now],
  );

  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const selectedId = pinned ?? hovered;
  const selectedIndex = tracked.findIndex((t) => t.element.NORAD_CAT_ID === selectedId);
  const selected = selectedIndex >= 0 ? tracked[selectedIndex] : null;

  /**
   * The track is a search over one orbit, so it is keyed to the minute rather
   * than the second: recomputing 240 propagations once a second to move a
   * path by a fifth of a pixel is pure heat.
   */
  const minuteKey = Math.floor(now.getTime() / 60_000);
  const track = useMemo(() => {
    if (!selected) return null;
    return orbitTrack(selected.rec, new Date(minuteKey * 60_000), periodMinutes(selected.element));
  }, [selected, minuteKey]);

  /* --- everything the paint loop reads, without re-running the loop ---- */
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  /** Screen position of every marker: x, y, and 1 when it is on this side. */
  const screenRef = useRef<Float32Array>(new Float32Array(FLEET.length * 3));
  const fixesRef = useRef<(SubPoint | null)[]>(fixes);
  const trackedRef = useRef<Tracked[]>(tracked);
  const nowRef = useRef<Date>(now);
  const trackRef = useRef<Float32Array | null>(track);
  const selectedRef = useRef<number>(selectedIndex);
  const paintRef = useRef<(() => void) | null>(null);

  fixesRef.current = fixes;
  trackedRef.current = tracked;
  nowRef.current = now;
  trackRef.current = track;
  selectedRef.current = selectedIndex;

  /**
   * A repaint on every input that is not motion. Under reduced motion this is
   * the ONLY thing that ever draws after the first frame; with motion allowed
   * the rAF loop would have picked the change up anyway, and one extra paint
   * costs a fraction of a millisecond.
   */
  useEffect(() => {
    paintRef.current?.();
  }, [fixes, track, selectedIndex]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const probe = probeRef.current;
    if (!wrap || !canvas || !probe) return;
    const g = canvas.getContext('2d', { alpha: true });
    if (!g) return;

    /* --- colours ------------------------------------------------------
       Read off probe spans rather than written as hex, so this file adds
       no colour to the system: `app/globals.css` owns every value and the
       band's ground decides which set they resolve to. */
    const swatch = (token: string): string => {
      const el = probe.querySelector<HTMLElement>(`[data-token="${token}"]`);
      return el ? getComputedStyle(el).color : 'rgb(255,255,255)';
    };
    const palette = {
      body: swatch('body'),
      rule: swatch('rule'),
      coast: swatch('coast'),
      marker: swatch('marker'),
      accent: swatch('accent'),
    };

    const coast = coastline();
    const grat = graticule();
    const maxPoints = Math.max(coast.xyz.length, grat.xyz.length) / 3;

    /* Scratch, allocated once per mount and reused every frame. */
    const sx = new Float32Array(maxPoints);
    const sy = new Float32Array(maxPoints);
    const vis = new Uint8Array(maxPoints);
    const mat = new Float64Array(9);
    const satXyz = new Float32Array(FLEET.length * 3);
    const subXyz = new Float32Array(FLEET.length * 3);
    const one = new Float64Array(3);

    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;
    let R = 0;
    let yaw = INITIAL_YAW;
    let pitch = INITIAL_PITCH;

    const measure = () => {
      const box = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(box.width));
      height = Math.max(1, Math.round(box.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = width / 2;
      cy = height / 2;
      R = (Math.min(width, height) / 2) * GLOBE_FILL;
    };

    /** One point: screen x, screen y, and 0 hidden / 1 front / 2 past limb. */
    const project = (x: number, y: number, z: number, out: Float64Array) => {
      const X = mat[0] * x + mat[1] * y;
      const D = mat[3] * x + mat[4] * y + mat[5] * z;
      const U = mat[6] * x + mat[7] * y + mat[8] * z;
      out[0] = cx + X * R;
      out[1] = cy - U * R;
      out[2] = D >= 0 ? 1 : X * X + U * U >= 1 ? 2 : 0;
    };

    /** A whole set into the scratch arrays. Nine multiplies a point. */
    const projectSet = (xyz: Float32Array, count: number) => {
      for (let i = 0; i < count; i += 1) {
        const j = i * 3;
        const x = xyz[j];
        const y = xyz[j + 1];
        const z = xyz[j + 2];
        const X = mat[0] * x + mat[1] * y;
        const D = mat[3] * x + mat[4] * y + mat[5] * z;
        const U = mat[6] * x + mat[7] * y + mat[8] * z;
        sx[i] = cx + X * R;
        sy[i] = cy - U * R;
        vis[i] = D >= 0 ? 1 : X * X + U * U >= 1 ? 2 : 0;
      }
    };

    /**
     * Every run of consecutive points with the wanted visibility, as ONE
     * path and ONE stroke. Splitting front from back per-point is what makes
     * a wireframe read as a solid sphere rather than as a cage.
     */
    const strokeRuns = (bounds: Uint32Array, want: number) => {
      g.beginPath();
      for (let l = 0; l + 1 < bounds.length; l += 1) {
        const end = bounds[l + 1];
        let pen = false;
        for (let i = bounds[l]; i < end; i += 1) {
          if (vis[i] === want) {
            if (pen) g.lineTo(sx[i], sy[i]);
            else {
              g.moveTo(sx[i], sy[i]);
              pen = true;
            }
          } else {
            pen = false;
          }
        }
      }
      g.stroke();
    };

    const paint = () => {
      viewMatrix(yaw, pitch, mat);
      g.clearRect(0, 0, width, height);
      g.lineWidth = 1;
      g.lineCap = 'round';

      // The body. A disc of the raised ground, so the wireframe on top of it
      // reads as being ON something and the limb has an edge to be.
      g.globalAlpha = 1;
      g.fillStyle = palette.body;
      g.beginPath();
      g.arc(cx, cy, R, 0, TAU);
      g.fill();

      // Graticule: far side first, at a third of the weight.
      projectSet(grat.xyz, grat.xyz.length / 3);
      g.strokeStyle = palette.rule;
      g.globalAlpha = 0.3;
      strokeRuns(grat.bounds, 0);
      g.globalAlpha = 1;
      strokeRuns(grat.bounds, 1);

      // Coastline, the same way.
      projectSet(coast.xyz, coast.xyz.length / 3);
      g.strokeStyle = palette.coast;
      g.globalAlpha = 0.22;
      strokeRuns(coast.bounds, 0);
      g.globalAlpha = 0.9;
      strokeRuns(coast.bounds, 1);

      // The limb.
      g.globalAlpha = 1;
      g.strokeStyle = palette.rule;
      g.beginPath();
      g.arc(cx, cy, R, 0, TAU);
      g.stroke();

      // The selected satellite's orbit, drawn under the markers.
      const t = trackRef.current;
      if (t) {
        projectSet(t, t.length / 3);
        const bounds = new Uint32Array([0, t.length / 3]);
        g.strokeStyle = palette.accent;
        g.globalAlpha = 0.28;
        strokeRuns(bounds, 2);
        g.globalAlpha = 0.85;
        strokeRuns(bounds, 1);
      }

      // The fleet.
      const points = fixesRef.current;
      const chosen = selectedRef.current;
      const screen = screenRef.current;
      for (let i = 0; i < points.length; i += 1) {
        const p = points[i];
        if (!p) {
          screen[i * 3 + 2] = 0;
          continue;
        }

        const j = i * 3;
        latLonToUnit(p.latitude, p.longitude, subXyz, j);
        const r = 1 + p.altitudeKm / EARTH_RADIUS_KM;
        satXyz[j] = subXyz[j] * r;
        satXyz[j + 1] = subXyz[j + 1] * r;
        satXyz[j + 2] = subXyz[j + 2] * r;

        project(satXyz[j], satXyz[j + 1], satXyz[j + 2], one);
        const px = one[0];
        const py = one[1];
        const shown = one[2] !== 0;
        const active = i === chosen;

        if (shown) {
          project(subXyz[j], subXyz[j + 1], subXyz[j + 2], one);
          // The tick from the sub-point to the satellite IS the altitude at
          // globe scale. Drawn only when the ground under it is on this side.
          if (one[2] === 1) {
            g.strokeStyle = active ? palette.accent : palette.marker;
            g.globalAlpha = active ? 0.75 : 0.5;
            g.beginPath();
            g.moveTo(one[0], one[1]);
            g.lineTo(px, py);
            g.stroke();
          }

          // A dot inside a hairline ring. The ring is what makes eight
          // two-pixel marks findable on a wireframe without turning them
          // into the loudest thing in the band.
          g.fillStyle = active ? palette.accent : palette.marker;
          g.globalAlpha = 1;
          g.beginPath();
          g.arc(px, py, active ? 3.5 : 2.5, 0, TAU);
          g.fill();

          g.strokeStyle = active ? palette.accent : palette.marker;
          g.globalAlpha = active ? 0.7 : 0.32;
          g.beginPath();
          g.arc(px, py, active ? 9 : 6, 0, TAU);
          g.stroke();
        }

        // Where the pointer will look for it. No DOM is touched in a frame.
        screen[i * 3] = px;
        screen[i * 3 + 1] = py;
        screen[i * 3 + 2] = shown ? 1 : 0;
      }

      g.globalAlpha = 1;
    };

    paintRef.current = paint;

    /* --- the loop ------------------------------------------------------ */
    let raf = 0;
    let running = false;
    let onScreen = true;
    let last = 0;

    const loop = (t: number) => {
      const dt = last ? Math.min((t - last) / 1000, 0.1) : 0;
      last = t;
      if (!dragging) yaw += SPIN_RAD_PER_S * dt;
      paint();
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || reduced || !onScreen || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    };

    /* --- drag ----------------------------------------------------------- */
    let dragging = false;
    let pointer = -1;
    let originX = 0;
    let originY = 0;
    let travelled = 0;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pointer = e.pointerId;
      dragging = true;
      travelled = 0;
      originX = e.clientX;
      originY = e.clientY;
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointer) return;
      const dx = e.clientX - originX;
      const dy = e.clientY - originY;
      travelled += Math.abs(dx) + Math.abs(dy);
      originX = e.clientX;
      originY = e.clientY;
      // Pulling right turns the globe right: the centre longitude rises,
      // which is a FALLING yaw. See ./projection.ts.
      yaw -= dx * DRAG_RAD_PER_PX;
      pitch += dy * DRAG_RAD_PER_PX;
      pitch = pitch > MAX_PITCH ? MAX_PITCH : pitch < -MAX_PITCH ? -MAX_PITCH : pitch;
      if (travelled > DRAG_SLOP_PX) wrap.setAttribute('data-dragging', 'true');
      if (reduced) paint();
    };

    const onUp = () => {
      dragging = false;
      pointer = -1;
      // Cleared on the next task so the click that follows the release can
      // still see that this gesture was a rotation and refuse to select.
      setTimeout(() => wrap.removeAttribute('data-dragging'), 0);
    };

    wrap.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    /* --- lifecycle ------------------------------------------------------ */
    let relayout = 0;
    const ro = new ResizeObserver(() => {
      if (relayout) return;
      relayout = requestAnimationFrame(() => {
        relayout = 0;
        measure();
        paint();
      });
    });
    ro.observe(wrap);

    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(wrap);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);

    measure();
    paint();
    start();

    /**
     * Development-only handle for the perf harness. It times `paint` in
     * isolation and reports what the frame is actually made of. Stripped from
     * production builds and never referenced by the page itself.
     */
    if (process.env.NODE_ENV !== 'production') {
      (wrap as HTMLDivElement & { __globe?: unknown }).__globe = {
        paint,
        stats: () => ({
          coastPoints: coast.xyz.length / 3,
          graticulePoints: grat.xyz.length / 3,
          trackPoints: trackRef.current ? trackRef.current.length / 3 : 0,
          satellites: fixesRef.current.length,
          radiusPx: R,
          reduced,
        }),
        /**
         * The exact elements and the exact instant the drawing used, so a
         * harness can re-run `subPointAt` against them out of process and
         * prove the markers are not decorative.
         */
        /** Marker screen positions, for a harness that must avoid them. */
        markers: () =>
          trackedRef.current.map((t, i) => ({
            noradId: t.element.NORAD_CAT_ID,
            name: t.member.name,
            x: screenRef.current[i * 3],
            y: screenRef.current[i * 3 + 1],
            shown: screenRef.current[i * 3 + 2] === 1,
          })),
        fleet: () => ({
          at: nowRef.current.toISOString(),
          radiusPx: R,
          satellites: trackedRef.current.map((t, i) => ({
            noradId: t.element.NORAD_CAT_ID,
            name: t.member.name,
            element: t.element,
            point: fixesRef.current[i] ?? null,
          })),
        }),
      };
    }

    return () => {
      stop();
      if (relayout) cancelAnimationFrame(relayout);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      wrap.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      paintRef.current = null;
    };
  }, [reduced]);

  /* --- selection ------------------------------------------------------- */
  const wasDrag = () => wrapRef.current?.hasAttribute('data-dragging') ?? false;

  /**
   * The satellite nearest a pointer, within the catch radius, or null.
   *
   * The paint loop leaves every marker's screen position in `screenRef`, so
   * this is a distance test over eight entries and never touches the DOM
   * beyond one bounding rect.
   */
  const markerAt = (clientX: number, clientY: number): number | null => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const screen = screenRef.current;

    let best = -1;
    let bestDistance = HIT_PX / 2;
    for (let i = 0; i < tracked.length; i += 1) {
      if (screen[i * 3 + 2] !== 1) continue;
      const dx = screen[i * 3] - x;
      const dy = screen[i * 3 + 1] - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best >= 0 ? tracked[best].element.NORAD_CAT_ID : null;
  };

  const oldest = elements.reduce((max, e) => Math.max(max, elementAgeHours(e, now)), 0);

  /*
    NO ELEMENTS AT ALL — the case a `reduce(..., 0)` quietly lies about.

    `fetchFleetElements()` degrades to the bundled snapshot, so this is rare;
    it is not impossible. If the snapshot is ever emptied, filtered to nothing
    by a FLEET_IDS change, or the fleet is re-keyed against a CelesTrak group
    that no longer carries these objects, `tracked` is empty — and measured,
    with the fetch forced to that state, this band drew an unpopulated globe
    under the headline "Eight spacecraft, where they actually are", an empty
    index, and the sentence "The oldest element set drawn was fitted 0 min
    ago". Nothing errored. It simply stated, in the most confident voice on
    the page, a freshness figure for a set that did not exist.

    WAVE.md §2: never state a fact the system cannot produce. So when there is
    nothing to propagate the provenance line says that instead of quoting an
    age, and the index says it instead of being blank.
  */
  const hasElements = tracked.length > 0;

  return (
    <div className={className}>
      <Grid12 className="gap-y-8">
        {/* --- the instrument ------------------------------------------- */}
        <div className="col-span-12 min-[1024px]:col-span-7">
          <div
            ref={wrapRef}
            data-globe
            className={cn(
              'relative isolate aspect-square w-full select-none',
              // Nearly square at width, because the subject is a circle: a
              // wider box only adds margin either side of the same disc.
              'min-[1024px]:aspect-[7/6]',
              // Vertical page scroll is never captured: a finger dragged up
              // scrolls the page, a finger dragged across turns the globe.
              '[touch-action:pan-y]',
              hovered !== null ? 'cursor-pointer' : 'cursor-grab',
            )}
            onPointerMove={(e) => {
              // Hover is a mouse idea. A finger selects by tapping, below.
              if (e.pointerType !== 'mouse' || wasDrag()) return;
              setHovered(markerAt(e.clientX, e.clientY));
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') setHovered(null);
            }}
            onClick={(e) => {
              if (wasDrag()) return;
              const id = markerAt(e.clientX, e.clientY);
              setPinned((current) => (id !== null && current !== id ? id : null));
            }}
          >
            {/* Absolutely positioned, and that is load-bearing. `measure()` writes an
                explicit pixel height onto the canvas; in normal flow that height
                then DRIVES the wrapper's, so `aspect-square` is overridden and a
                resize can never shrink the box back. Out of flow, the aspect
                ratio owns the geometry and the canvas only ever follows it. */}
            <canvas ref={canvasRef} className="absolute inset-0 block" aria-hidden="true" />

            {/* Colour probes. `getComputedStyle().color` on these is how the
                canvas learns the ground's palette without this file naming a
                single value. Zero-size, aria-hidden, never painted. */}
            <div ref={probeRef} aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
              <span data-token="body" style={{ color: 'var(--ground-raised)' }} />
              <span data-token="rule" style={{ color: 'var(--rule)' }} />
              <span data-token="coast" style={{ color: 'var(--ink-dim)' }} />
              <span data-token="marker" style={{ color: 'var(--ink)' }} />
              <span data-token="accent" style={{ color: 'var(--accent)' }} />
            </div>
          </div>

          {/* The stamp is a claim about work done this second. With no
              elements no propagation ran, so it states the clock as a clock
              rather than as a result. */}
          <p className="mt-3 font-mono text-tele-xs uppercase ink-faint">
            {!hasElements ? (
              <span data-telemetry>No elements · nothing propagated</span>
            ) : reduced ? (
              <span data-telemetry>
                Static frame · {now.toISOString().slice(11, 19)} UTC · motion reduced
              </span>
            ) : (
              <span data-telemetry>Propagated {now.toISOString().slice(11, 19)} UTC</span>
            )}
          </p>
        </div>

        {/* --- the index and the card ------------------------------------ */}
        <div className="col-span-12 min-[1024px]:col-span-4 min-[1024px]:col-start-9">
          <p className="font-mono text-tele-s uppercase ink-faint">Fleet index</p>

          {/* An empty index is a blank rule and nothing else, which reads as a
              layout fault rather than as an outage. It says which it is. */}
          {hasElements ? null : (
            <p className="mt-3 max-w-[38ch] border-t rule-ground pt-5 text-body ink-dim">
              No element sets are available, so no spacecraft can be placed. Nothing here is
              estimated in their absence — reload in a few minutes and the index returns.
            </p>
          )}

          <ul className={cn('mt-3 border-t rule-ground', hasElements ? undefined : 'hidden')}>
            {tracked.map((t) => {
              const id = t.element.NORAD_CAT_ID;
              const active = id === selectedId;
              return (
                <li key={id} className="border-b rule-ground">
                  <button
                    type="button"
                    aria-pressed={pinned === id}
                    onPointerEnter={(e) => {
                      if (e.pointerType === 'mouse') setHovered(id);
                    }}
                    onPointerLeave={(e) => {
                      if (e.pointerType === 'mouse') setHovered(null);
                    }}
                    onFocus={() => setHovered(id)}
                    onBlur={() => setHovered(null)}
                    onClick={() => setPinned((c) => (c === id ? null : id))}
                    className={cn(
                      'flex min-h-11 w-full items-baseline justify-between gap-4 py-2.5 text-left transition-house',
                      active ? 'ink' : 'ink-dim hover:ink',
                    )}
                  >
                    <span className="text-[0.9375rem] leading-[1.3] tracking-[-0.01em]">
                      {t.member.name}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 font-mono text-tele-xs uppercase',
                        active ? 'text-[color:var(--accent)]' : 'ink-faint',
                      )}
                    >
                      {active ? 'Orbit drawn' : t.member.operator}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Fixed floor so selecting a satellite never moves the page. */}
          <div className="mt-8 min-h-[19rem]">
            {selected ? (
              <RecordPanel
                member={selected.member}
                element={selected.element}
                point={fixes[selectedIndex] ?? null}
                periodMin={periodMinutes(selected.element)}
                ageHours={elementAgeHours(selected.element, now)}
              />
            ) : (
              <div>
                <p className="font-mono text-tele-xs uppercase ink-faint">
                  {hasElements ? 'No spacecraft selected' : 'No spacecraft to select'}
                </p>
                <p className="mt-3 max-w-[38ch] text-body ink-dim">
                  {hasElements
                    ? 'Hover a marker on the globe, or a name in the index, to draw one revolution of that satellite\u2019s ground track at its true altitude and open its live record. Click to keep it open.'
                    : 'There are no markers to hover: the element sets this band propagates did not reach the page, and a position is never guessed at from nothing.'}
                </p>
                {hasElements ? (
                  <p className="mt-5 max-w-[38ch] text-note ink-faint">
                    Markers sit at 1 + altitude/{EARTH_RADIUS_KM} Earth radii. Low orbit really is
                    this close to the ground: the tick under each marker is the whole altitude, at
                    the same scale as the globe beside it.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </Grid12>

      {/* --- provenance ---------------------------------------------------
          Not a footnote to be trimmed. A section that draws eight moving
          spacecraft has to say the movement is a propagation of published
          elements and name the oldest set on screen — that is the one setting
          the error bar on everything above it. */}
      <p className="mt-8 max-w-[86ch] text-note ink-faint">
        Orbital elements published by{' '}
        <a
          href="https://celestrak.org"
          target="_blank"
          rel="noreferrer noopener"
          className="link-underline ink-dim hover:ink"
        >
          CelesTrak
        </a>
        {hasElements ? (
          <>
            {source === 'live'
              ? ', fetched once and held for three hours.'
              : ', from a set bundled with this build — the live request did not complete.'}{' '}
            Positions are SGP4 propagations of those elements computed in your browser, not
            telemetry. The oldest element set drawn was fitted {ageLabel(oldest)} ago, and
            accuracy degrades as that age grows.
          </>
        ) : (
          <>
            {' '}
            — and none reached this page. The request did not complete and no bundled set was
            available, so there is nothing to propagate and no position is drawn. The Earth below
            is a graticule, not a readout.
          </>
        )}{' '}
        Coastline: Natural Earth, public domain.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/**
 * `false` on the server and on the first client render, so hydration matches;
 * the real answer arrives in an effect and re-runs the paint loop once.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return reduced;
}

/**
 * A one-second clock, seeded from the server so the first paint matches.
 *
 * Paused while the tab is hidden — a background tab propagating eight orbits
 * a second is pure heat — and STOPPED ENTIRELY under reduced motion, where it
 * takes exactly one reading on mount and the readout is labelled as a fixed
 * frame rather than pretending to be live.
 */
function useLiveClock(serverNow: string, reduced: boolean): Date {
  const [now, setNow] = useState(() => new Date(serverNow));

  useEffect(() => {
    if (reduced) {
      setNow(new Date());
      return;
    }

    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      setNow(new Date());
      timer = setInterval(() => setNow(new Date()), 1000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      stop();
      if (!document.hidden) start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced]);

  return now;
}
