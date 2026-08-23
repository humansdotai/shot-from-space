'use client';

import { clsx as cn } from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GpElement } from '@/lib/integrations/celestrak';
import { fleetMember } from '@/lib/satellites/fleet';
import { elementAgeHours, toSatrec } from '@/lib/satellites/propagate';
import type { SatRec } from 'satellite.js';
import {
  LAG_1,
  LAG_2,
  SAMPLES,
  VIEW,
  buildGeometry,
  fleetPoint,
  p3,
  type FleetPoint,
  type Geometry,
} from './skygeometry';

/**
 * THE SKY OVER THIS TARGET — the file's live orbit figure.
 *
 * ==================================================================
 * WHAT MOVES, AND WHAT EACH MOVING THING PLOTS
 * ==================================================================
 * Two layers, two different kinds of truth, and they are never confused
 * with each other on screen or in this file.
 *
 *  1 · THE TASKED PLANE (`plane`, off by default)
 *      The orbit plane this mission's pass is booked on, derived from the
 *      record: inclination, altitude, look azimuth, off-nadir. The marker on
 *      it walks the plane at a stated READING PACE — 24 s a revolution — and
 *      it is a picture of the geometry, not a position feed. <OrbitPlot />
 *      makes the same drawing as an instrument, so this layer is off
 *      wherever the plot is already on the page.
 *
 *  2 · THE TRACKED FLEET (always on, once elements arrive)
 *      Real spacecraft. Every marker is `subPointAt()` from
 *      `lib/satellites/propagate` run against the element set CelesTrak
 *      published — the identical call, and the identical numbers, that
 *      <LiveGlobe /> and <FleetTracker /> print elsewhere on the site.
 *      Nothing about a marker's angular position is drawn; it is solved.
 *
 * THE FIRST FRAME OF LAYER 2 IS THE PRESENT. Markers are placed at
 * `subPointAt(rec, anchor)` where `anchor` is the instant the elements
 * resolved — so the still picture, and the picture a reader with reduced
 * motion keeps, is where those satellites actually are.
 *
 * ==================================================================
 * THE ORBIT CLOCK, AND WHY IT IS PRINTED
 * ==================================================================
 * A satellite in low Earth orbit covers about a quarter of a pixel a second
 * at this scale. A drawing that ran at 1× would be indistinguishable from a
 * still, so the figure runs the elements FORWARD at a stated rate:
 *
 *      ORBIT_CLOCK = 240      one second of screen is four minutes of orbit
 *
 * Every position drawn is still a real `subPointAt()` solution — just at a
 * real future instant rather than the present one. The rate is printed by
 * whatever mounts this figure (see `ORBIT_CLOCK_NOTE`), because a compressed
 * clock that is not stated is a lie about how fast a satellite moves.
 *
 * The run-forward is capped at MAX_AHEAD_MS and then re-anchored to the true
 * present. SGP4 error grows with time since the element epoch, and a figure
 * left open all afternoon would otherwise be drawing next Tuesday.
 *
 * ==================================================================
 * THE FRAME BUDGET
 * ==================================================================
 * Propagation does NOT run per frame. Every SEGMENT_MS of wall clock the
 * whole fleet is propagated once into a `next` buffer and the old `next`
 * becomes `prev`; frames in between linearly interpolate. One segment is
 * SEGMENT_MS x ORBIT_CLOCK = 60 s of orbit time, and the sagitta of a
 * 60-second chord of a low Earth orbit is under a twentieth of a pixel at
 * the largest size this figure is drawn — far below what the interpolation
 * saves.
 *
 * A frame therefore does: one multiply-add per marker, one
 * `SVGTransform.setTranslate` per marker, and a boolean compare. Nothing
 * inside the loop allocates — no strings, no objects, no `style.transform =`.
 *
 * ==================================================================
 * MOTION SWITCH
 * ==================================================================
 * `data-motion` on the root is the single switch the loop and the CSS ring
 * both obey:
 *   off      no rAF is scheduled and the ring has no animation-name. This is
 *            the SERVER-RENDERED default, so the first paint is the static
 *            frame and reduced motion never leaves it.
 *   paused   loop stopped, ring play-state paused. Off-screen or tab hidden.
 *   run      promoted by the effect after mount.
 *
 * REDUCED MOTION IS NOT A SLOWER LOOP. `matchMedia` is read before anything
 * is scheduled and the effect returns; `requestAnimationFrame` is never
 * called and no listener of any kind is attached.
 *
 * THERE ARE NO POINTER LISTENERS, on any pointer type. The figure responds to
 * nothing but the mission record and the element set, so a coarse pointer
 * needs no separate path and binds nothing.
 */

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

/** One revolution of the TASKED PLANE marker. A reading pace, not a period. */
const REV_MS = 24_000;

/** Seconds of orbit per second of screen. Printed; see ORBIT_CLOCK_NOTE. */
export const ORBIT_CLOCK = 240;

/** Wall clock between propagation passes. Frames between are interpolated. */
const SEGMENT_MS = 250;

/** Orbit time covered by one segment: 250 ms x 240 = 60 s. */
const SEGMENT_ORBIT_MS = SEGMENT_MS * ORBIT_CLOCK;

/** How far ahead of the true present the figure is allowed to run. */
const MAX_AHEAD_MS = 12 * 3_600_000;

/** Segments of ground track kept behind each spacecraft. 3 = three minutes. */
const TRAIL = 3;
const TRAIL_STEPS = Array.from({ length: TRAIL }, (_, k) => k);

/** What the mount prints beside the figure so the clock is never implied. */
export const ORBIT_CLOCK_NOTE = `Orbit clock ×${ORBIT_CLOCK}`;

/** The same statement in words, for the paragraph that explains the figure. */
export const ORBIT_CLOCK_SENTENCE =
  `run forward at ×${ORBIT_CLOCK} — one second of screen is four minutes of orbit`;

/* ------------------------------------------------------------------ */
/* The element sets                                                   */
/* ------------------------------------------------------------------ */

interface FleetPayload {
  source: 'live' | 'snapshot';
  obtainedAt: string;
  elements: GpElement[];
}

/**
 * One request for the whole page, shared between every figure on it. The
 * same promise <PassGeometry /> uses on the purchase flow, for the same
 * reason: two figures must not cost two round trips, and CelesTrak runs on
 * donated bandwidth. The route holds the document for three hours.
 */
let FLEET_REQUEST: Promise<FleetPayload | null> | null = null;

function fleetPayload(): Promise<FleetPayload | null> {
  FLEET_REQUEST ??= fetch('/mission/fleet')
    .then((r) => (r.ok ? (r.json() as Promise<FleetPayload>) : null))
    .catch(() => null);
  return FLEET_REQUEST;
}

/* ------------------------------------------------------------------ */
/* What the figure knows about the fleet                              */
/* ------------------------------------------------------------------ */

interface Craft {
  noradId: number;
  name: string;
  rec: SatRec;
}

interface FleetState {
  source: 'live' | 'snapshot';
  /** Age of the freshest element set when the figure anchored, hours. */
  freshestAgeHours: number;
  /** The instant the markers below are the true positions of. */
  anchorMs: number;
  craft: Craft[];
  /** Positions at the anchor: the first paint, and the reduced-motion frame. */
  parked: FleetPoint[];
}

/** Everything a mount may want to print about the elements it is drawing. */
export interface SkyReadout {
  tracked: number;
  source: 'live' | 'snapshot';
  freshestAgeHours: number;
}

/* ------------------------------------------------------------------ */
/* Motion — one <style> element, scoped by class                       */
/* ------------------------------------------------------------------ */

/**
 * WHY THE REDUCED-MOTION RULE SAYS `animation: none` AND NOT A DURATION.
 * globals.css collapses every animation under `prefers-reduced-motion` with
 * `animation-duration: 0.001ms !important`, inside `@layer base`. This sheet
 * is UNLAYERED, and the cascade reverses for important declarations — so an
 * important duration written here would LOSE and the ring would snap to its
 * end frame. `animation: none` wins regardless, because it sets
 * `animation-name`, which the global rule never touches. Do not "simplify"
 * this to a duration or a play-state: both are the version that breaks.
 */
const FIGURE_CSS = `
.skyf-ping {
  transform-box: fill-box;
  transform-origin: center;
  animation: skyf-ping 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
@keyframes skyf-ping {
  0% { transform: scale(0.4); opacity: 0.5; }
  70%, 100% { transform: scale(2.7); opacity: 0; }
}
[data-motion='paused'] .skyf-ping { animation-play-state: paused; }
[data-motion='off'] .skyf-ping { animation: none; opacity: 0; }
.skyf-body { transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1); }
.skyf-body[data-behind='true'] { opacity: 0.24; }
@media (prefers-reduced-motion: reduce) {
  .skyf-ping { animation: none !important; opacity: 0; }
}
`;

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export interface SkyFigureProps {
  lat: number;
  lon: number;
  /** `mission.orbit` fields, passed as primitives so a poll cannot rebuild. */
  inclination: string;
  track: string;
  altitudeKm: number;
  azimuthDeg: number;
  offNadirDeg: number;
  /**
   * Draw the mission's tasked orbit plane as well as the live fleet. Off
   * wherever <OrbitPlot /> is already on the page — that instrument owns the
   * pass-geometry claim and two drawings of it are two claims.
   */
  plane?: boolean;
  /**
   * `full` draws each spacecraft as a body with solar wings; `compact`
   * draws it as a dot, because wings under about 160px are two grey pixels.
   */
  detail?: 'full' | 'compact';
  /** Reported back once the elements resolve, so a mount can print them. */
  onReadout?: (readout: SkyReadout) => void;
  className?: string;
}

export function SkyFigure({
  lat,
  lon,
  inclination,
  track,
  altitudeKm,
  azimuthDeg,
  offNadirDeg,
  plane = false,
  detail = 'full',
  onReadout,
  className,
}: SkyFigureProps) {
  const rootRef = useRef<SVGSVGElement | null>(null);
  const craftRef = useRef<SVGGElement | null>(null);
  const planeNodes = useRef<(SVGGElement | null)[]>([null, null, null]);
  const fleetNodes = useRef<(SVGGElement | null)[]>([]);
  const trailNodes = useRef<(SVGGElement | null)[]>([]);

  const geometry: Geometry = useMemo(
    () => buildGeometry(lat, lon, inclination, track, altitudeKm, azimuthDeg, offNadirDeg),
    [lat, lon, inclination, track, altitudeKm, azimuthDeg, offNadirDeg],
  );

  const [fleet, setFleet] = useState<FleetState | null>(null);

  /* The elements. Fetched once per page, then propagated locally forever —
     re-fetching is what would make this stale, not what keeps it fresh. */
  useEffect(() => {
    let live = true;
    void fleetPayload().then((payload) => {
      if (!live || !payload) return;
      const anchor = new Date();

      const craft: Craft[] = [];
      for (const element of payload.elements) {
        const rec = toSatrec(element);
        if (!rec) continue;
        craft.push({
          noradId: element.NORAD_CAT_ID,
          name: fleetMember(element.NORAD_CAT_ID)?.name ?? element.OBJECT_NAME,
          rec,
        });
      }
      if (craft.length === 0) return;

      const parked: FleetPoint[] = [];
      const kept: Craft[] = [];
      for (const c of craft) {
        const point = fleetPoint(c.rec, anchor, geometry.project);
        if (!point) continue;
        parked.push(point);
        kept.push(c);
      }
      if (kept.length === 0) return;

      const ages = payload.elements.map((e) => elementAgeHours(e, anchor));

      setFleet({
        source: payload.source,
        freshestAgeHours: Math.min(...ages),
        anchorMs: anchor.getTime(),
        craft: kept,
        parked,
      });
    });
    return () => {
      live = false;
    };
  }, [geometry, lat, lon]);

  /* Reported upward, not rendered here: the figure is `aria-hidden` and every
     fact beside it is set as text by whatever mounted it. */
  useEffect(() => {
    if (!fleet || !onReadout) return;
    onReadout({
      tracked: fleet.craft.length,
      source: fleet.source,
      freshestAgeHours: fleet.freshestAgeHours,
    });
  }, [fleet, onReadout]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    /* Reduced motion: read BEFORE anything is scheduled, and return. No rAF
       is ever requested, so there is no loop to slow down or to cancel, and
       nothing is bound that a pointer could reach. */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.dataset.motion = 'off';
      return;
    }

    /* One SVGTransform per node, mutated in place for the life of the loop.
       This is the whole reason a frame allocates nothing: `setTranslate`
       writes two numbers into an existing matrix, where `style.transform =`
       would build a string every frame for every node. */
    const handle = (node: SVGGElement) => {
      const list = node.transform.baseVal;
      const first = list.numberOfItems > 0 ? list.getItem(0) : null;
      if (first && first.type === SVGTransform.SVG_TRANSFORM_TRANSLATE) return first;
      const created = root.createSVGTransform();
      list.initialize(created);
      return created;
    };

    /* --- the tasked plane marker, if this figure draws one --------- */
    const craftGroup = craftRef.current;
    const planeHandles =
      plane && craftGroup
        ? planeNodes.current
            .filter((n): n is SVGGElement => n !== null)
            .map(handle)
        : [];
    const planeReady = planeHandles.length === 3;
    const { pts, behind } = geometry;
    const lags = [0, LAG_1, LAG_2];
    let wasBehind = behind[0];

    /* --- the live fleet ------------------------------------------- */
    const craft = fleet?.craft ?? [];
    const bodies = fleetNodes.current.filter((n): n is SVGGElement => n !== null);
    const trails = trailNodes.current.filter((n): n is SVGGElement => n !== null);
    const fleetReady =
      fleet !== null && bodies.length === craft.length && trails.length === craft.length * TRAIL;
    const bodyHandles = fleetReady ? bodies.map(handle) : [];
    const trailHandles = fleetReady ? trails.map(handle) : [];

    const n = craft.length;
    /* prev/next segment endpoints, and TRAIL segments of history, all in one
       flat buffer each. Allocated once, written in place, never grown. */
    const prev = new Float32Array(n * 2);
    const next = new Float32Array(n * 2);
    const history = new Float32Array(n * TRAIL * 2);
    const occ = new Uint8Array(n);
    /** Last occlusion state written to the DOM. Kept here so a frame never
        READS an attribute back to decide whether to write one. */
    const shown = new Uint8Array(n);

    /** Orbit-time instant `next` was solved at, reused so no Date is made. */
    const when = new Date();

    let anchorMs = fleet?.anchorMs ?? Date.now();
    let segment = 0;
    /** When the current run-forward was anchored. Separate from `mark`. */
    let fleetMark = 0;

    function solveInto(buffer: Float32Array, orbitMs: number) {
      when.setTime(orbitMs);
      for (let i = 0; i < n; i += 1) {
        const point = fleetPoint(craft[i].rec, when, geometry.project);
        if (point) {
          buffer[i * 2] = point.x;
          buffer[i * 2 + 1] = point.y;
          occ[i] = point.occluded ? 1 : 0;
        }
      }
    }

    /**
     * The tail. It only changes when the segment does — one write per
     * spacecraft per 250 ms rather than per frame, which is the difference
     * between 11 transforms a frame and 35.
     */
    function paintTrail() {
      for (let i = 0; i < n; i += 1) {
        for (let k = 0; k < TRAIL; k += 1) {
          const slot = (((segment - 1 - k) % TRAIL) + TRAIL) % TRAIL;
          const h = slot * n * 2 + i * 2;
          trailHandles[i * TRAIL + k].setTranslate(history[h], history[h + 1]);
        }
      }
    }

    function reset(nowMs: number) {
      anchorMs = nowMs;
      segment = 0;
      solveInto(prev, anchorMs);
      solveInto(next, anchorMs + SEGMENT_ORBIT_MS);
      for (let t = 0; t < TRAIL; t += 1) {
        for (let i = 0; i < n * 2; i += 1) history[t * n * 2 + i] = prev[i];
      }
      for (let i = 0; i < n; i += 1) shown[i] = occ[i];
      paintTrail();
    }

    let raf = 0;
    let running = false;
    let onScreen = true;
    /** Motion already accumulated, ms — so a resume never jumps. */
    let elapsed = 0;
    let mark = 0;

    const frame = (t: number) => {
      /* Two clocks, deliberately. `run` is total motion time and survives a
         pause, so the tasked-plane marker never jumps on resume. The fleet
         has its own, restarted at every re-anchor, because its zero is a
         real instant rather than a phase. */
      const run = elapsed + (t - mark);
      const fleetRun = t - fleetMark;

      if (planeReady) {
        const head = ((run % REV_MS) / REV_MS) * SAMPLES;
        for (let k = 0; k < 3; k += 1) {
          const at = head - lags[k];
          const floor = Math.floor(at);
          const i = (((floor % SAMPLES) + SAMPLES) % SAMPLES) * 2;
          const j = ((((floor + 1) % SAMPLES) + SAMPLES) % SAMPLES) * 2;
          const f = at - floor;
          planeHandles[k].setTranslate(
            pts[i] + (pts[j] - pts[i]) * f,
            pts[i + 1] + (pts[j + 1] - pts[i + 1]) * f,
          );
        }
        const hidden = behind[(((Math.floor(head) % SAMPLES) + SAMPLES) % SAMPLES)];
        if (hidden !== wasBehind && craftGroup) {
          wasBehind = hidden;
          craftGroup.dataset.behind = hidden ? 'true' : 'false';
        }
      }

      if (fleetReady) {
        const wanted = Math.floor(fleetRun / SEGMENT_MS);

        /* Past the cap the figure is drawing too far into the future for the
           element set it holds, so it goes back to the present instead. */
        if (wanted * SEGMENT_ORBIT_MS >= MAX_AHEAD_MS) {
          fleetMark = t;
          reset(Date.now());
        } else {
          /* Normally one step; more only after a long frame, and the loop is
             stopped off-screen and while the tab is hidden so that is rare. */
          if (segment < wanted) {
            while (segment < wanted) {
              segment += 1;
              for (let i = 0; i < n * 2; i += 1) {
                history[((segment - 1) % TRAIL) * n * 2 + i] = prev[i];
                prev[i] = next[i];
              }
              solveInto(next, anchorMs + (segment + 1) * SEGMENT_ORBIT_MS);
            }
            paintTrail();
          }

          const f = (fleetRun - segment * SEGMENT_MS) / SEGMENT_MS;
          for (let i = 0; i < n; i += 1) {
            const a = i * 2;
            bodyHandles[i].setTranslate(
              prev[a] + (next[a] - prev[a]) * f,
              prev[a + 1] + (next[a + 1] - prev[a + 1]) * f,
            );
            if (shown[i] !== occ[i]) {
              shown[i] = occ[i];
              bodies[i].dataset.behind = occ[i] === 1 ? 'true' : 'false';
            }
          }
        }
      }

      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || !onScreen || document.hidden) return;
      running = true;
      mark = performance.now();
      /* Coming back from off-screen or a hidden tab, the world has moved on;
         the fleet re-anchors to the present rather than resuming a stale
         run-forward. The plane marker keeps its phase — it is a reading
         pace, so there is nothing for it to be stale about. */
      if (fleetReady) {
        fleetMark = mark;
        reset(Date.now());
      }
      root.dataset.motion = 'run';
      raf = requestAnimationFrame(frame);
    };

    const stop = () => {
      if (!running) return;
      running = false;
      elapsed += performance.now() - mark;
      cancelAnimationFrame(raf);
      root.dataset.motion = 'paused';
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(root);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [geometry, fleet, plane]);

  const g = geometry;
  const wings = detail === 'full';

  return (
    <svg
      ref={rootRef}
      data-motion="off"
      data-sky-figure
      viewBox={`0 0 ${VIEW.size} ${VIEW.size}`}
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      <style>{FIGURE_CSS}</style>

      <circle
        cx={VIEW.c}
        cy={VIEW.c}
        r={g.globeR}
        fill="color-mix(in srgb, var(--ink) 13%, transparent)"
      />

      <g fill="none" stroke="var(--rule)" strokeWidth="1" opacity="0.75">
        {g.parallels.map((d, i) => (
          <path key={`par-${i}`} d={d} vectorEffect="non-scaling-stroke" />
        ))}
        {g.meridians.map((d, i) => (
          <path key={`mer-${i}`} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </g>

      <circle
        cx={VIEW.c}
        cy={VIEW.c}
        r={g.globeR}
        fill="none"
        stroke="var(--ink-faint)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />

      {plane ? (
        <>
          {/* Behind the body — dashed, so the ring reads as closed without
              pretending the Earth is transparent. */}
          <g fill="none" stroke="var(--ink-faint)" strokeWidth="1" opacity="0.42">
            {g.orbitBack.map((d, i) => (
              <path key={`back-${i}`} d={d} strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
            ))}
          </g>

          {/* In front of the body — solid, so the two are told apart. */}
          <g fill="none" stroke="var(--ink-faint)" strokeWidth="1">
            {g.orbitFront.map((d, i) => (
              <path key={`front-${i}`} d={d} vectorEffect="non-scaling-stroke" />
            ))}
          </g>

          {/* The arc arriving at the closest approach. Accent, because that
              arc is the state the figure is reporting: the run-in to a pass. */}
          <g fill="none" stroke="var(--accent)" strokeWidth="1.25">
            {g.leadIn.map((d, i) => (
              <path key={`lead-${i}`} d={d} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        </>
      ) : null}

      {/* The target on the surface, and the search ring over it. */}
      <circle
        className="skyf-ping"
        cx={g.target.x}
        cy={g.target.y}
        r="6"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={g.target.x}
        cy={g.target.y}
        r="5"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={g.target.x} cy={g.target.y} r="1.6" fill="var(--accent)" />

      {/* THE TRACKED FLEET. Present only after the elements resolve — before
          that there is nothing true to draw, so nothing is drawn. */}
      {fleet
        ? fleet.craft.map((c, i) => {
            const at = fleet.parked[i];
            return (
              <g key={c.noradId}>
                {TRAIL_STEPS.map((k) => (
                  <g
                    key={k}
                    ref={(node) => {
                      trailNodes.current[i * TRAIL + k] = node;
                    }}
                    transform={`translate(${p3(at.x)} ${p3(at.y)})`}
                  >
                    <circle r={1.1 - k * 0.22} fill="var(--ink)" opacity={0.3 - k * 0.08} />
                  </g>
                ))}
                <g
                  className="skyf-body"
                  data-behind={at.occluded ? 'true' : 'false'}
                  ref={(node) => {
                    fleetNodes.current[i] = node;
                  }}
                  transform={`translate(${p3(at.x)} ${p3(at.y)})`}
                >
                  {wings ? (
                    <>
                      <rect x="-1.7" y="-1" width="3.4" height="2" fill="var(--ink)" />
                      <g stroke="var(--ink)" strokeWidth="1" opacity="0.8">
                        <line x1="-4.2" y1="0" x2="-2.1" y2="0" vectorEffect="non-scaling-stroke" />
                        <line x1="2.1" y1="0" x2="4.2" y2="0" vectorEffect="non-scaling-stroke" />
                      </g>
                    </>
                  ) : (
                    <circle r="1.7" fill="var(--ink)" />
                  )}
                </g>
              </g>
            );
          })
        : null}

      {/* The tasked plane's marker and its two trail dots. Parked at the
          capture point until the loop promotes them; that is also the frame
          reduced motion keeps. */}
      {plane ? (
        <g ref={craftRef} className="skyf-body" data-behind={g.behind[0] ? 'true' : 'false'}>
          <g
            ref={(node) => {
              planeNodes.current[2] = node;
            }}
            transform={`translate(${g.parked[2].x} ${g.parked[2].y})`}
          >
            <circle r="1.1" fill="var(--ink)" opacity="0.22" />
          </g>
          <g
            ref={(node) => {
              planeNodes.current[1] = node;
            }}
            transform={`translate(${g.parked[1].x} ${g.parked[1].y})`}
          >
            <circle r="1.5" fill="var(--ink)" opacity="0.45" />
          </g>
          <g
            ref={(node) => {
              planeNodes.current[0] = node;
            }}
            transform={`translate(${g.parked[0].x} ${g.parked[0].y})`}
          >
            <rect
              x="-3"
              y="-1.7"
              width="6"
              height="3.4"
              fill="var(--ink)"
              stroke="var(--ground-raised)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <g stroke="var(--ink)" strokeWidth="1" vectorEffect="non-scaling-stroke">
              <line x1="-6.5" y1="0" x2="-3.5" y2="0" vectorEffect="non-scaling-stroke" />
              <line x1="3.5" y1="0" x2="6.5" y2="0" vectorEffect="non-scaling-stroke" />
            </g>
          </g>
        </g>
      ) : null}
    </svg>
  );
}
