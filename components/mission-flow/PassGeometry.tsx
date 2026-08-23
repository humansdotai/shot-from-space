'use client';

import { useEffect, useMemo, useState } from 'react';
import { clsx as cn } from 'clsx';
import type { GpElement } from '@/lib/integrations/celestrak';
import { fleetMember } from '@/lib/satellites/fleet';
import {
  elementAgeHours,
  epochDate,
  lookAngleAt,
  nextPass,
  periodMinutes,
  subPointAt,
  toSatrec,
  type Observer,
  type SubPoint,
} from '@/lib/satellites/propagate';
import { PASS_MIN_ELEVATION_DEG } from '@/lib/mission-flow/config';
import { INK, INK_DIM, INK_FAINT } from '@/components/purchase/fields';

/**
 * ==================================================================
 * THE PASS — the geometry the first two sections are built on
 * ==================================================================
 * `/mission` opens on a photograph of somebody's street and asks them for
 * €279. Nothing on that screen used to say what they were buying: that a
 * spacecraft in a sun-synchronous orbit crosses these exact coordinates,
 * that the crossing is called a PASS, that the passes on one day are a
 * CAPTURE WINDOW, and that cloud can take one away.
 *
 * This module is the honest way to say it — not with adjectives, with the
 * actual numbers for the actual coordinates in the address bar.
 *
 * ------------------------------------------------------------------
 * WHAT IS COMPUTED HERE, AND FROM WHAT
 * ------------------------------------------------------------------
 * `/mission/fleet` serves the element sets CelesTrak published for the
 * eight real spacecraft in `lib/satellites/fleet.ts`. Everything below is
 * SGP4 run over those elements at the buyer's latitude and longitude, in
 * their browser, by `lib/satellites/propagate.ts`:
 *
 *   nextCrossing   the soonest moment a tracked satellite clears
 *                  PASS_MIN_ELEVATION_DEG over those coordinates
 *   track          that crossing sampled every 15 s from the horizon up
 *                  and back down — a real arc, not a drawn curve
 *   peakElevation  the highest that arc reaches
 *   crossings24h   how many times the whole tracked fleet clears the
 *                  threshold there in the next 24 hours
 *
 * Not one of those numbers is typed in this file, and none of them is the
 * same for two addresses.
 *
 * ------------------------------------------------------------------
 * THE CLAIM THAT IS NEVER MADE
 * ------------------------------------------------------------------
 * That any of these spacecraft is flying the buyer's mission. It is not.
 * Tasking is brokered at capture time and the file never names a
 * spacecraft — `lib/satellites/fleet.ts` says so in its own header and
 * `PASS_ATTRIBUTION` says so on screen, beside the name. What the readout
 * IS allowed to say is "this is what a pass over your coordinates looks
 * like, and here is one", which is true, checkable, and the thing the
 * buyer actually needed explained.
 *
 * ------------------------------------------------------------------
 * MOTION
 * ------------------------------------------------------------------
 * Nothing in here eases, slides or loops. The marker in <OrbitGlyph />
 * advances because the mean anomaly advances; the slant range falls
 * because the satellite is closing; the countdown counts down because
 * time passes. That is the same category as a clock and the opposite of
 * a marquee — the distinction `components/satellites/OrbitGlyph.tsx`
 * draws, and the reason this is allowed to move at all.
 */

/* ================================================================== */
/* 1 · The element sets                                                */
/* ================================================================== */

interface FleetPayload {
  source: 'live' | 'snapshot';
  obtainedAt: string;
  elements: GpElement[];
}

/**
 * One request for the whole surface. The Target section and the Framing
 * section both draw from these elements and they are two components; the
 * promise is shared so the split cannot double a network call, exactly as
 * `useScene` does for the archive record in S1Reveal.
 */
let FLEET_REQUEST: Promise<FleetPayload | null> | null = null;

/**
 * Held after the first response so a LIVE look angle — recomputed every
 * second — never needs the network again. SGP4 runs against a fixed element
 * set; re-fetching is what would make it stale, not what keeps it fresh.
 */
let FLEET_ELEMENTS: FleetPayload | null = null;

function fleetPayload(): Promise<FleetPayload | null> {
  FLEET_REQUEST ??= fetch('/mission/fleet')
    .then((r) => (r.ok ? (r.json() as Promise<FleetPayload>) : null))
    .then((payload) => {
      FLEET_ELEMENTS = payload;
      return payload;
    })
    .catch(() => null);
  return FLEET_REQUEST;
}

/* ================================================================== */
/* 2 · What a section gets back                                        */
/* ================================================================== */

/** One sample of a crossing: where it is in the observer's sky. */
export interface SkySample {
  /** Degrees clockwise from true north. */
  azimuth: number;
  /** Degrees above the horizon. */
  elevation: number;
}

export interface Crossing {
  noradId: number;
  name: string;
  operator: string;
  /** Orbital inclination, degrees. Feeds <OrbitGlyph />'s tilt. */
  inclination: number;
  /** Orbital period, minutes, from the mean motion. */
  periodMin: number;
  /** Mean anomaly at the element epoch, degrees. Feeds the glyph's phase. */
  meanAnomaly: number;
  /** The element epoch, ms. */
  epochMs: number;
  /** When it comes over the horizon. */
  risesAt: Date;
  /** When it goes back under it. */
  setsAt: Date;
  /** Minutes it is above the horizon. */
  durationMin: number;
  /** The highest it gets, degrees, and the bearing it is on there. */
  peakElevation: number;
  peakAzimuth: number;
  /** The arc, horizon to horizon. */
  track: SkySample[];
}

export interface SkyReading {
  /** Whether the elements came from CelesTrak or the bundled snapshot. */
  source: 'live' | 'snapshot';
  /** Age of the freshest element set at the moment of the search, hours. */
  freshestAgeHours: number;
  /** How many of the tracked fleet had element sets SGP4 could use. */
  usable: number;
  /** The soonest crossing of these coordinates, or null if none in 24 h. */
  next: Crossing | null;
  /** Crossings above the threshold by the whole fleet in the next 24 h. */
  crossings24h: number;
  /** The highest any of them reaches in that day, degrees. */
  best24hElevation: number;
}

export type SkyStatus = 'loading' | 'ready' | 'unavailable';

/** What `useSkyReading` hands back. Passed down so the search runs once. */
export interface SkyResult {
  status: SkyStatus;
  reading: SkyReading | null;
}

/* ================================================================== */
/* 3 · The search                                                      */
/* ================================================================== */

/** How far ahead the browser looks. A day: any longer belongs on the server. */
const SEARCH_HOURS = 24;
/** Coarse sweep for the rise search, seconds. `nextPass` refines it. */
const SWEEP_SECONDS = 60;
/** Sampling interval for the drawn arc, milliseconds. */
const TRACK_STEP_MS = 15_000;

/**
 * The arc, horizon to horizon, around a known rise.
 *
 * `nextPass` returns the moment the satellite clears the imaging threshold,
 * which is part-way up an arc that starts lower. Drawing from there would
 * show a pass that begins in mid-air. So the window is opened either side
 * and the contiguous run of samples above the true horizon — the run that
 * contains the threshold crossing — is what is kept.
 */
function trackFor(
  rec: NonNullable<ReturnType<typeof toSatrec>>,
  threshold: Date,
  observer: Observer,
): { track: SkySample[]; risesAt: Date; setsAt: Date; peak: SkySample } | null {
  const centre = threshold.getTime();
  const from = centre - 20 * 60_000;
  const to = centre + 25 * 60_000;

  const samples: { t: number; azimuth: number; elevation: number }[] = [];
  for (let t = from; t <= to; t += TRACK_STEP_MS) {
    const look = lookAngleAt(rec, new Date(t), observer);
    if (look) samples.push({ t, azimuth: look.azimuth, elevation: look.elevation });
  }

  const at = samples.findIndex((s) => s.t >= centre);
  if (at < 0 || samples[at].elevation < 0) return null;

  let lo = at;
  while (lo > 0 && samples[lo - 1].elevation >= 0) lo -= 1;
  let hi = at;
  while (hi < samples.length - 1 && samples[hi + 1].elevation >= 0) hi += 1;

  const run = samples.slice(lo, hi + 1);
  if (run.length < 3) return null;

  /*
     THE APEX IS REFINED, AND THAT IS NOT A DETAIL.

     A satellite crossing near the zenith climbs about a degree a second, so
     a fifteen-second sample can land either side of the top and under-read
     it by several degrees. This screen prints that number, and
     `lib/mission-flow/overhead.ts` prints the same figure on the Window
     section from a one-second sweep — two readouts disagreeing about how
     high the same pass gets is exactly the kind of drift the honesty rule
     is about. So the apex is walked at one second across the minute either
     side of the best sample, for about a hundred extra propagations.
  */
  const coarse = run.reduce((best, s) => (s.elevation > best.elevation ? s : best), run[0]);
  let peak = coarse;
  for (let t = coarse.t - TRACK_STEP_MS; t <= coarse.t + TRACK_STEP_MS; t += 1000) {
    const look = lookAngleAt(rec, new Date(t), observer);
    if (look && look.elevation > peak.elevation) {
      peak = { t, azimuth: look.azimuth, elevation: look.elevation };
    }
  }

  return {
    track: run.map(({ azimuth, elevation }) => ({ azimuth, elevation })),
    risesAt: new Date(run[0].t),
    setsAt: new Date(run[run.length - 1].t),
    peak: { azimuth: peak.azimuth, elevation: peak.elevation },
  };
}

/**
 * Every crossing of these coordinates in the next day, and the first of them
 * drawn in full.
 *
 * The cursor jumps twenty minutes past each rise so the next sweep cannot
 * re-find the same pass — the same guard `lib/mission-flow/passes.ts` uses on
 * the server, and for the same reason.
 */
function search(payload: FleetPayload, lat: number, lon: number, now: Date): SkyReading | null {
  const observer: Observer = { latitude: lat, longitude: lon, heightM: 0 };
  const end = now.getTime() + SEARCH_HOURS * 3_600_000;

  let usable = 0;
  let freshest = Number.POSITIVE_INFINITY;
  let crossings = 0;
  let best = 0;
  let winner: Crossing | null = null;

  for (const element of payload.elements) {
    const member = fleetMember(element.NORAD_CAT_ID);
    const rec = member ? toSatrec(element) : null;
    if (!member || !rec) continue;

    usable += 1;
    freshest = Math.min(freshest, elementAgeHours(element, now));

    let cursor = now;
    for (let guard = 0; guard < 32; guard += 1) {
      const remainingHours = (end - cursor.getTime()) / 3_600_000;
      if (remainingHours <= 0) break;

      const pass = nextPass(rec, cursor, observer, {
        minElevation: PASS_MIN_ELEVATION_DEG,
        withinHours: remainingHours,
        stepSeconds: SWEEP_SECONDS,
      });
      if (!pass) break;

      crossings += 1;
      best = Math.max(best, pass.peakElevation);

      if (!winner || pass.rises.getTime() < winner.risesAt.getTime()) {
        const arc = trackFor(rec, pass.rises, observer);
        if (arc) {
          winner = {
            noradId: element.NORAD_CAT_ID,
            name: member.name,
            operator: member.operator,
            inclination: element.INCLINATION,
            periodMin: periodMinutes(element),
            meanAnomaly: element.MEAN_ANOMALY,
            epochMs: epochDate(element).getTime(),
            risesAt: arc.risesAt,
            setsAt: arc.setsAt,
            durationMin: (arc.setsAt.getTime() - arc.risesAt.getTime()) / 60_000,
            peakElevation: arc.peak.elevation,
            peakAzimuth: arc.peak.azimuth,
            track: arc.track,
          };
        }
      }

      cursor = new Date(pass.rises.getTime() + 20 * 60_000);
    }
  }

  if (usable === 0) return null;

  return {
    source: payload.source,
    freshestAgeHours: Number.isFinite(freshest) ? freshest : 0,
    usable,
    next: winner,
    crossings24h: crossings,
    best24hElevation: best,
  };
}

/* ================================================================== */
/* 4 · The hook                                                        */
/* ================================================================== */

/**
 * The search is the expensive step — roughly twelve thousand SGP4
 * evaluations — so its answer is shared between the sections that want it
 * and held until the crossing it found has actually happened.
 */
const READINGS = new Map<string, SkyReading>();

/**
 * The next crossing of these coordinates, propagated in this browser.
 *
 * Runs in an effect, never during render: the search takes on the order of
 * a tenth of a second and a section that blocked its own paint on it would
 * be trading the thing being explained for the explanation.
 */
export function useSkyReading(lat: number, lon: number): SkyResult {
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  const cached = READINGS.get(key) ?? null;

  const [reading, setReading] = useState<SkyReading | null>(cached);
  const [status, setStatus] = useState<SkyStatus>(cached ? 'ready' : 'loading');
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let live = true;

    // A reading whose crossing is still ahead is still the answer.
    const held = READINGS.get(key);
    if (held && (!held.next || held.next.setsAt.getTime() > Date.now())) {
      setReading(held);
      setStatus('ready');
      return;
    }

    setStatus(held ? 'ready' : 'loading');

    void fleetPayload().then((payload) => {
      if (!live) return;
      if (!payload) {
        setStatus('unavailable');
        return;
      }
      const next = search(payload, lat, lon, new Date());
      if (!live) return;
      if (!next) {
        setStatus('unavailable');
        return;
      }
      READINGS.set(key, next);
      setReading(next);
      setStatus('ready');
    });

    return () => {
      live = false;
    };
  }, [key, lat, lon, generation]);

  /* The crossing found is a real event with an end. Once it has flown, the
     readout would be counting down to a moment in the past, so the search
     is run again — checked once a minute, which is the resolution anything
     built on it prints. */
  useEffect(() => {
    const sets = reading?.next?.setsAt.getTime();
    if (!sets) return;
    const timer = window.setInterval(() => {
      if (Date.now() > sets) setGeneration((g) => g + 1);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [reading]);

  return { status, reading };
}

/* ================================================================== */
/* 4b · The fleet, with no observer                                    */
/* ================================================================== */

/** One tracked spacecraft, without reference to anybody's coordinates. */
export interface StandbySatellite {
  noradId: number;
  name: string;
  operator: string;
  /** Real orbital inclination, degrees. <OrbitGlyph />'s tilt. */
  inclination: number;
  /** Minutes per revolution, from the published mean motion. */
  periodMin: number;
  /** Mean anomaly at the element epoch, degrees. */
  meanAnomaly: number;
  /** The element epoch, ms. */
  epochMs: number;
}

export interface StandbyReading {
  satellites: StandbySatellite[];
  source: 'live' | 'snapshot';
  /** Age of the freshest usable element set at the moment of the read. */
  freshestAgeHours: number;
}

/**
 * THE TRACKED FLEET, BEFORE THERE ARE ANY COORDINATES.
 *
 * `useSkyReading` answers "what crosses THIS sky", and it cannot run until
 * a place has been named. This answers the only question that is available
 * before that — "what is up there, and where is it in its orbit" — from the
 * same element sets, through the same one cached request.
 *
 * IT IS FOR THE WAITING STATE AND NOTHING ELSE. The first thing anyone
 * arriving at a bare `/mission` sees is the preview column with no target
 * in it, and until now the largest object on that column was a stock clip
 * with `NOT THE SPACECRAFT ASSIGNED TO THIS MISSION` burned across the foot
 * of it — a disclaimer that was only needed because the footage was there.
 * Eight real spacecraft, at their real inclinations, at the real point in
 * their revolution, need no disclaimer: nothing is claimed about them
 * beyond that they are in orbit and that this site tracks them.
 *
 * NO SUB-POINT AND NO ELEVATION. Both are honest here and neither is
 * useful: a latitude and longitude over the Pacific means nothing to a
 * reader who has not yet named a place, and an elevation needs an observer.
 * What the glyph shows is the one thing that is legible without either —
 * the shape of the orbit and where the spacecraft is around it.
 */
export function useFleetStandby(): StandbyReading | null {
  const [reading, setReading] = useState<StandbyReading | null>(null);

  useEffect(() => {
    let live = true;
    void fleetPayload().then((payload) => {
      if (!live || !payload) return;
      const now = new Date();

      const satellites: StandbySatellite[] = [];
      let freshest = Number.POSITIVE_INFINITY;

      for (const element of payload.elements) {
        const member = fleetMember(element.NORAD_CAT_ID);
        // `toSatrec` is what decides an element set is usable at all; an
        // entry SGP4 will not accept is not counted and not drawn.
        if (!member || !toSatrec(element)) continue;
        satellites.push({
          noradId: element.NORAD_CAT_ID,
          name: member.name,
          operator: member.operator,
          inclination: element.INCLINATION,
          periodMin: periodMinutes(element),
          meanAnomaly: element.MEAN_ANOMALY,
          epochMs: epochDate(element).getTime(),
        });
        freshest = Math.min(freshest, elementAgeHours(element, now));
      }

      if (satellites.length === 0) return;
      setReading({
        satellites,
        source: payload.source,
        freshestAgeHours: Number.isFinite(freshest) ? freshest : 0,
      });
    });
    return () => {
      live = false;
    };
  }, []);

  return reading;
}

/** Where a standby satellite is in its revolution at `now`, 0..1. */
export function standbyPhase(s: StandbySatellite, now: Date): number {
  if (s.periodMin <= 0) return 0;
  const minutes = (now.getTime() - s.epochMs) / 60_000;
  return (((s.meanAnomaly / 360 + minutes / s.periodMin) % 1) + 1) % 1;
}

/**
 * THE CLOCK IS THE SHARED ONE.
 *
 * `components/satellites/useLiveClock.ts` was extracted so that two
 * components propagating the same orbits could not drift onto two subtly
 * different clocks. This surface propagates the same orbits, so it uses it
 * rather than starting a third interval, and its documented position on
 * `prefers-reduced-motion` applies here unchanged: the preference is about
 * animation and this is a clock. Nothing on these sections eases, slides,
 * transitions or loops, so there is nothing for the preference to reduce —
 * the only figure that does loop, <OrbitFigure />'s direction tick, stops
 * itself under it.
 */
export { useLiveClock } from '@/components/satellites/useLiveClock';

/**
 * Where that spacecraft is in the target's sky RIGHT NOW.
 *
 * Every second, from the same element set the crossing was found in. Its
 * elevation is negative almost all of the time and that is the point being
 * made: the satellite is not hovering over the house, it is somewhere else
 * on the planet and closing.
 */
export function useLiveLook(
  crossing: Crossing | null,
  lat: number,
  lon: number,
  now: Date,
): {
  look: { elevation: number; azimuth: number; rangeKm: number } | null;
  subPoint: SubPoint | null;
} {
  const rec = useMemo(() => {
    if (!crossing) return null;
    const element = FLEET_ELEMENTS?.elements.find((e) => e.NORAD_CAT_ID === crossing.noradId);
    return element ? toSatrec(element) : null;
  }, [crossing]);

  if (!rec) return { look: null, subPoint: null };
  return {
    look: lookAngleAt(rec, now, { latitude: lat, longitude: lon, heightM: 0 }),
    subPoint: subPointAt(rec, now),
  };
}

/**
 * The orbital phase of a crossing's spacecraft, 0..1, at `now`.
 *
 * The mean anomaly at the element epoch advanced by however many periods
 * have elapsed since. This is what <OrbitGlyph /> plots: the marker moves
 * because the satellite moves, which is the only kind of motion this system
 * allows in an icon.
 */
export function phaseOf(crossing: Crossing, now: Date): number {
  if (crossing.periodMin <= 0) return 0;
  const minutes = (now.getTime() - crossing.epochMs) / 60_000;
  return (((crossing.meanAnomaly / 360 + minutes / crossing.periodMin) % 1) + 1) % 1;
}

/* ================================================================== */
/* 5 · The sky chart                                                   */
/* ================================================================== */

const R = 82;
const CX = 100;
const CY = 100;

/** Polar: the centre is straight overhead, the outer ring is the horizon. */
function project(azimuth: number, elevation: number): [number, number] {
  const r = R * (1 - Math.max(0, Math.min(90, elevation)) / 90);
  const a = (azimuth * Math.PI) / 180;
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
}

function ring(elevation: number): number {
  return R * (1 - elevation / 90);
}

function point(n: number): string {
  return n.toFixed(2);
}

/**
 * THE SKY CHART — one crossing, drawn where it will actually be.
 *
 * A compass rose seen as a dome flattened onto the page: north at the top,
 * the outer ring is the horizon all around the buyer, and the centre is the
 * point straight above their roof. A satellite rising in the north-east and
 * setting in the south enters at the top right and leaves at the bottom.
 *
 * The line is not an illustration of an orbit. It is `track` — the crossing
 * sampled every fifteen seconds by SGP4 over these coordinates — so its
 * shape, its entry bearing and how close it comes to the centre are all
 * facts about this pass over this address, and a different address draws a
 * different line.
 *
 * The dashed ring is the ten-degree imaging floor: below it the slant range
 * is long and the atmosphere is thick, and nobody images through it. It is
 * drawn because it is the reason a pass is an event rather than a constant.
 */
export function SkyChart({
  crossing,
  className,
}: {
  crossing: Crossing | null;
  className?: string;
}) {
  const path = crossing
    ? crossing.track
        .map((s, i) => {
          const [x, y] = project(s.azimuth, s.elevation);
          return `${i === 0 ? 'M' : 'L'}${point(x)} ${point(y)}`;
        })
        .join(' ')
    : '';

  const rise = crossing ? project(crossing.track[0].azimuth, crossing.track[0].elevation) : null;
  const set = crossing
    ? project(
        crossing.track[crossing.track.length - 1].azimuth,
        crossing.track[crossing.track.length - 1].elevation,
      )
    : null;
  const peak = crossing ? project(crossing.peakAzimuth, crossing.peakElevation) : null;

  const label = crossing
    ? `Sky chart over your coordinates. ${crossing.name} rises on bearing ${Math.round(crossing.track[0].azimuth)} degrees, reaches ${Math.round(crossing.peakElevation)} degrees above the horizon, and sets on bearing ${Math.round(crossing.track[crossing.track.length - 1].azimuth)} degrees.`
    : 'Sky chart over your coordinates. No tracked spacecraft crosses in the next 24 hours.';

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={label}
      className={cn('block h-auto w-full max-w-[216px]', className)}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        className={INK_FAINT}
      >
        {/* The horizon, all the way round. */}
        <circle cx={CX} cy={CY} r={R} opacity="0.9" />
        {/* Halfway up. */}
        <circle cx={CX} cy={CY} r={ring(45)} opacity="0.35" />
        {/* The imaging floor. */}
        <circle cx={CX} cy={CY} r={ring(PASS_MIN_ELEVATION_DEG)} opacity="0.6" strokeDasharray="2 3" />
        {/* Cardinals. */}
        <line x1={CX} y1={CY - R} x2={CX} y2={CY - R + 6} opacity="0.9" />
        <line x1={CX} y1={CY + R} x2={CX} y2={CY + R - 6} opacity="0.9" />
        <line x1={CX - R} y1={CY} x2={CX - R + 6} y2={CY} opacity="0.9" />
        <line x1={CX + R} y1={CY} x2={CX + R - 6} y2={CY} opacity="0.9" />
        {/* Straight overhead. */}
        <line x1={CX - 4} y1={CY} x2={CX + 4} y2={CY} opacity="0.9" />
        <line x1={CX} y1={CY - 4} x2={CX} y2={CY + 4} opacity="0.9" />
      </g>

      {/* Four letters and nothing else. `ZENITH` and a `10°` tick were
          drawn here first and both collided — one with the arc, the other
          with `E`, on a chart whose whole job is to be unambiguous. The
          caption under the figure carries them instead, in words, where
          there is room for the sentence they need. */}
      <g
        className={INK_FAINT}
        fill="currentColor"
        fontSize="8"
        fontFamily="var(--font-mono, monospace)"
        letterSpacing="0.08em"
      >
        <text x={CX} y={CY - R - 5} textAnchor="middle">N</text>
        <text x={CX + R + 5} y={CY + 3}>E</text>
        <text x={CX} y={CY + R + 12} textAnchor="middle">S</text>
        <text x={CX - R - 5} y={CY + 3} textAnchor="end">W</text>
      </g>

      {crossing && rise && set && peak ? (
        <>
          {/* The crossing itself. */}
          <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            className={INK}
          />
          <circle
            cx={point(rise[0])}
            cy={point(rise[1])}
            r="2.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            className={INK_DIM}
          />
          <circle
            cx={point(set[0])}
            cy={point(set[1])}
            r="2.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            className={INK_DIM}
          />
          {/* The top of the arc: the one moment worth quoting. */}
          <circle
            cx={point(peak[0])}
            cy={point(peak[1])}
            r="3.2"
            fill="currentColor"
            className="text-[color:var(--accent)]"
          />
        </>
      ) : null}
    </svg>
  );
}

/* ================================================================== */
/* 6 · Formatting                                                      */
/* ================================================================== */

/** Locale-free everywhere, so nothing here can disagree across a boundary. */
export function fixed(value: number, places: number): string {
  return Number.isFinite(value) ? value.toFixed(places) : '—';
}

/** `7 214` — a thin space, not a comma: the separator is not a decimal point. */
export function groupDigits(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** `1 H 12 MIN`, `44 MIN`, `UNDER 1 MIN`. Never a negative countdown. */
export function untilLabel(when: Date, now: Date): string {
  const minutes = Math.round((when.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return 'under 1 min';
  if (minutes < 60) return `${minutes} MIN`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} H` : `${h} H ${m} MIN`;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** `22 AUG 09:47 UTC`. UTC because a pass is not in anyone's timezone. */
export function utcStamp(when: Date): string {
  const d = when.getUTCDate().toString().padStart(2, '0');
  const hh = when.getUTCHours().toString().padStart(2, '0');
  const mm = when.getUTCMinutes().toString().padStart(2, '0');
  return `${d} ${MONTHS[when.getUTCMonth()]} ${hh}:${mm} UTC`;
}

/** `4.2 H`, `36 MIN`, `2.1 DAYS` — the age of an element set. */
export function ageLabel(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return 'AN UNKNOWN TIME';
  if (hours < 1) return `${Math.round(hours * 60)} MIN`;
  if (hours < 48) return `${hours.toFixed(1)} H`;
  return `${(hours / 24).toFixed(1)} DAYS`;
}
