'use client';

import { clsx as cn } from 'clsx';
import { useCallback, useState } from 'react';
import { Container } from '@/components/fui';
import { stageIndex, type MissionDTO } from '@/lib/types';
import { formatTelemetryDate, formatTelemetryTimestamp } from '@/lib/utils';
import { BELOW_BAR_TIGHT } from './layout';
import { ORBIT_CLOCK_NOTE, ORBIT_CLOCK_SENTENCE, SkyFigure, type SkyReadout } from './SkyFigure';
import { nextPassAt } from './telemetry';
import { ACCENT, Chip, INK_DIM, INK_FAINT, RULE } from './ui';

/**
 * HAPPENING NOW — the file's one waiting moment, made visible.
 *
 * ==================================================================
 * WHAT THIS IS
 * ==================================================================
 * Before the frame exists there is nothing to look at, and a mission can
 * legitimately sit at CAPTURE_WINDOW for days. This is the band that carries
 * that wait at the top of `/m/[code]`: the sky over the target, drawn large
 * on the void, with one line saying what the system is doing on the
 * customer's behalf and when the next opportunity is.
 *
 * The reference is a ride-hailing app looking for a driver — calm, confident,
 * obviously alive, several vehicles moving on one map. Explicitly NOT a
 * spinner: a spinner says "something is loading", and nothing here is
 * loading. Real spacecraft are somewhere else in their orbits and will be
 * over the target at times this file already knows.
 *
 * It was a 96px card in the corner of the masthead. It is a band now, because
 * the owner's note was exact: this moment is the whole product before the
 * downlink, and it was being carried by a thumbnail.
 *
 * ==================================================================
 * WHAT MOVES, AND WHAT EACH MOVING THING PLOTS
 * ==================================================================
 * The drawing is <SkyFigure />, and its own header is the full account. In
 * short, two layers:
 *
 *   THE TRACKED FLEET   real spacecraft at `subPointAt()` positions solved
 *                       from Orbital elements's published elements — the same call
 *                       and the same numbers <LiveGlobe /> prints. The
 *                       markers move because the satellites move; the figure
 *                       runs the elements forward at a rate it states
 *                       (ORBIT_CLOCK_NOTE, printed under the figure).
 *   THE TASKED PLANE    the plane THIS mission's pass is booked on, from the
 *                       record's own inclination, altitude, azimuth and
 *                       off-nadir. Its marker walks at a stated reading pace
 *                       and is a picture of geometry, not a position.
 *
 * The target's search ring is CSS — `transform` and `opacity`, the two
 * properties that never cost layout — on the house curve, 3.2s, which is the
 * "rare and slow" a live value is allowed under READOUT D2.
 *
 * NO SPACECRAFT IS EVER NAMED AS THIS MISSION'S. Tasking is brokered at
 * capture time and the file never names one; `lib/satellites/fleet.ts` says
 * so in its own header, and the line under the figure says so on screen.
 *
 * ==================================================================
 * NOTHING HERE IS INVENTED
 * ==================================================================
 *   inclination      `mission.orbit.inclination` ("SSO 97.4°" → 97.4)
 *   altitude         `mission.orbit.altitudeKm`, exaggerated radially the
 *                    way the plot exaggerates it, or a 537 km orbit is a
 *                    hairline outside the limb
 *   node (RAAN)      SOLVED so the plane misses the target by exactly the
 *                    cross-track angle `mission.orbit.offNadirDeg` implies
 *   roll             `mission.orbit.track` ("//ELIPSE 55°" → 55°)
 *   target           `mission.lat` / `mission.lon`
 *   next pass        `nextPassAt(mission, now)` — the same function the
 *                    stage readout uses
 *   window           `windowOpensAt` / `windowClosesAt`, verbatim
 *   fleet            Orbital elements elements via `/mission/fleet`, propagated in
 *                    the browser, with the element source and age printed
 *
 * THERE IS NO COUNTDOWN. A pass time is printed as the timestamp the record
 * holds; a ticking clock on a $640 purchase is a promise the file cannot
 * keep, and it is the first thing a customer catches out. When the record
 * holds no window — a mission at MISSION_CONFIRMED has not been booked with
 * the constellation yet — the band says that instead of counting down to
 * something nobody has scheduled.
 *
 * ==================================================================
 * HYDRATION
 * ==================================================================
 * The clock is not read here. `now` arrives as a prop — the server's clock on
 * first paint, the live one after mount — so the pass this band predicts is
 * the pass the rest of the file predicts. Every coordinate that reaches an
 * SVG attribute goes through `p3()` in ./skygeometry for the reason OrbitPlot
 * documents.
 *
 * ==================================================================
 * THE MOUNT
 * ==================================================================
 * The band is the first child of <main>, above the masthead, and cancels the
 * masthead's own bar clearance with a negative bottom margin so the page
 * still opens on ONE gap rather than two. See LIFT below. If BELOW_BAR in
 * ./layout ever changes, LIFT changes with it.
 *
 * It carries its OWN bottom padding on top of that, which the 96px card it
 * replaced did not need. The masthead below opens on a full-bleed aerial that
 * starts at the section's top edge, so the clearance LIFT leaves standing is
 * inside the photograph and not between the two: without `--band-snug` here
 * the closing line of this band sits nine pixels off a hard image edge.
 */

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

/**
 * Cancels the bar clearance inside BELOW_BAR on the masthead below, so the
 * band and the masthead share one gap instead of stacking two. The values are
 * BELOW_BAR's own bar heights (4.25rem / 6rem) and nothing else — the
 * `--band-open` half of that padding is deliberately left standing, and is
 * what separates this band from the classification strip.
 */
const LIFT = '-mb-[4.25rem] lg:-mb-[6rem]';

/**
 * The figure's rendered size. It is the subject of the band, so it is sized
 * against the viewport rather than against the text beside it — but capped,
 * because everything under it is the mission's identity and the headline
 * must not be pushed off a 900px-tall desktop viewport to make room.
 */
const FIGURE =
  'h-[208px] w-[208px] sm:h-[252px] sm:w-[252px] xl:h-[288px] xl:w-[288px] xl2:h-[328px] xl2:w-[328px]';
/* ------------------------------------------------------------------ */
/* What the card says                                                 */
/* ------------------------------------------------------------------ */

interface Reading {
  /** What the number is. Dim, so the number is what the eye lands on. */
  label: string;
  /** The number itself, verbatim from the record. Omitted for a bare note. */
  value?: string;
  /** The accent is a state colour: it marks the next opportunity, only. */
  accent?: boolean;
}

interface PassStatus {
  /** The status token. Never a sentence. */
  token: string;
  /** One line, announced politely. Stage-derived, so it does not churn. */
  status: string;
  /** The numbers, verbatim from the record. Empty when the record holds none. */
  readings: Reading[];
  /** True while the system is actively working the target. */
  working: boolean;
}

/**
 * The honest reading of the stage the mission is in.
 *
 * MISSION_CONFIRMED is NOT tasked: no collection order exists, no window has
 * been booked, and the orbit block on the record is still the constellation's
 * nominal plane rather than a booked pass. It says so.
 *
 * CAPTURE_WINDOW is tasked and waiting on weather and geometry — which is the
 * whole reason a mission sits here for days — and it is the only stage that
 * can carry a next-pass time, because it is the only stage where the window
 * is open.
 */
function passStatus(mission: MissionDTO, now: Date): PassStatus {
  const place = mission.locationLabel;
  const opensAt = mission.windowOpensAt;
  const closesAt = mission.windowClosesAt;
  const next = nextPassAt(mission, now);

  if (mission.stage === 'MISSION_CONFIRMED') {
    return {
      token: 'Queued',
      status: `Target locked over ${place}, queued for tasking. No capture window until the constellation accepts the collection.`,
      readings: [],
      working: false,
    };
  }

  if (mission.stage === 'SATELLITE_TASKED') {
    const readings: Reading[] = [];
    if (next) {
      /* "First" only while the window is genuinely still ahead. A window that
         has already opened has had passes worked, and calling the next one the
         first would be the file contradicting its own timeline. */
      const ahead = opensAt ? new Date(opensAt).getTime() > now.getTime() : false;
      readings.push({
        label: ahead ? 'First pass' : 'Next pass',
        value: formatTelemetryTimestamp(next),
        accent: true,
      });
    } else if (opensAt) {
      readings.push({ label: 'Window opens', value: formatTelemetryDate(opensAt) });
    }
    if (closesAt) readings.push({ label: 'Window to', value: formatTelemetryDate(closesAt) });

    return {
      token: 'Tasked',
      status: opensAt
        ? `The constellation accepted the collection and booked passes over ${place}.`
        : `The constellation accepted the collection over ${place}. The window is still with the operator.`,
      readings,
      working: true,
    };
  }

  /* CAPTURE_WINDOW. Tasked, window open, waiting on the sky. */
  const readings: Reading[] = [];
  if (next) {
    readings.push({ label: 'Next pass', value: formatTelemetryTimestamp(next), accent: true });
  } else if (closesAt) {
    readings.push({ label: 'No further pass in this window' });
  }
  if (closesAt) readings.push({ label: 'Window to', value: formatTelemetryDate(closesAt) });
  readings.push({ label: 'Cloud forecast', value: `${mission.orbit.cloudPct}%` });

  return {
    token: 'Searching',
    status: next
      ? `Searching for a pass over ${place}. Waiting on clear sky and the right geometry.`
      : `Searching for a pass over ${place}. Every pass in this window has been worked; the collection is being re-tasked.`,
    readings,
    working: true,
  };
}


/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export interface SearchingForPassProps {
  mission: MissionDTO;
  /** Current clock — the server's on first paint, live after mount. */
  now: Date;
  className?: string;
}

export function SearchingForPass({ mission, now, className }: SearchingForPassProps) {
  /* What the figure found out about the elements it is drawing. Reported
     upward rather than printed inside the drawing, because the drawing is
     `aria-hidden` and every fact on this band has to exist as text. */
  const [readout, setReadout] = useState<SkyReadout | null>(null);
  const onReadout = useCallback((next: SkyReadout) => setReadout(next), []);

  /* The exhibit takes over from IMAGE_ACQUIRED — there is a frame to look at,
     so there is nothing left to wait for. A cancelled mission is not
     searching for anything either. Both checks sit AFTER the hooks. */
  if (mission.state === 'CANCELLED') return null;
  if (stageIndex(mission.stage) >= stageIndex('IMAGE_ACQUIRED')) return null;

  const { token, status, readings, working } = passStatus(mission, now);
  const o = mission.orbit;

  return (
    <section
      aria-label="Pass status"
      className={cn(
        'surface-dark relative z-10 pb-[var(--band-snug)]',
        BELOW_BAR_TIGHT,
        LIFT,
        className,
      )}
    >
      <Container>
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-12 xl:gap-16">
          {/* THE DRAWING. Decorative in the accessibility sense — every fact
              it carries is written as text beside it, so it is hidden rather
              than labelled. A screen reader that read this out would be
              reading the status line twice. */}
          <div className="flex shrink-0 flex-col items-center gap-3">
            <SkyFigure
              lat={mission.lat}
              lon={mission.lon}
              inclination={o.inclination}
              track={o.track}
              altitudeKm={o.altitudeKm}
              azimuthDeg={o.azimuthDeg}
              offNadirDeg={o.offNadirDeg}
              plane
              onReadout={onReadout}
              className={FIGURE}
            />
            {/* The compression, stated. A figure that runs a satellite round
                the Earth in twenty-four seconds and does not say so is
                lying about how fast a satellite moves. */}
            <span
              data-telemetry
              className={cn('font-mono text-tele-s uppercase', INK_FAINT)}
            >
              {ORBIT_CLOCK_NOTE}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <h2 className={cn('text-label uppercase', INK_DIM)}>Happening now</h2>
              <Chip label={token} state={working ? 'active' : 'pending'} />
            </div>

            {/* The status. `aria-live` is polite and the string is derived
                from the STAGE, not from the clock — so it is announced when
                the mission actually moves and never on a tick. The readings
                below carry the numbers and sit outside the live region, so a
                pass time rolling over is read on demand rather than shouted. */}
            <p aria-live="polite" className="mt-5 max-w-[var(--measure)] text-body text-balance">
              {status}
            </p>

            {readings.length ? (
              <p
                data-telemetry
                className={cn(
                  'mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-2 file uppercase',
                  INK_DIM,
                )}
              >
                {readings.map((reading) => (
                  <span key={reading.label}>
                    <span className="file-label">{reading.label}</span>
                    {reading.value ? (
                      <>
                        {' '}
                        <span className={cn('whitespace-nowrap', reading.accent && ACCENT)}>
                          {reading.value}
                        </span>
                      </>
                    ) : null}
                  </span>
                ))}
              </p>
            ) : null}

            {/* WHAT THE MOVING MARKERS ARE, AND WHAT THEY ARE NOT. Rendered
                only once the elements have actually resolved: before that
                there is no count to state and no source to attribute, and a
                sentence about a fleet that has not loaded is a claim about
                nothing. */}
            {readout ? (
              <p className={cn('mt-6 max-w-[var(--measure)] border-t pt-5 text-note', RULE, INK_DIM)}>
                {readout.tracked} tracked spacecraft, at positions solved from{' '}
                {readout.source === 'live' ? 'published' : 'the bundled snapshot of'}{' '}
                orbital elements {readout.freshestAgeHours.toFixed(1)} hours old,{' '}
                {ORBIT_CLOCK_SENTENCE}. None is assigned to this mission: tasking is brokered at
                capture time, and the plane drawn through the target is this record&rsquo;s own
                geometry, not a spacecraft.
              </p>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
