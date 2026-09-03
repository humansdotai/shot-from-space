'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx as cn } from 'clsx';
import { ScanSweep } from '@/components/fui';
import { OrbitGlyph } from '@/components/satellites';
import { ErrorPlate, INK, INK_DIM, RULE } from '@/components/purchase/fields';
import {
  INDICATIVE_NOTICE,
  PASS_ATTRIBUTION,
  PASS_MIN_ELEVATION_DEG,
} from '@/lib/mission-flow/config';
import {
  fetchFleetReading,
  fetchOverhead,
  fetchWindows,
  type FleetReading,
} from '@/lib/mission-flow/api';
import type { PassWindow, PassWindowResult } from '@/lib/mission-flow/passes';
import type { OverheadResult, OverheadSatellite } from '@/lib/mission-flow/overhead';
import { telemetryCoords } from '@/lib/mission-flow/entry';
import type { ChosenWindow } from '@/lib/mission-flow/state';
import { PanelGroup, PanelHead, PanelNote, PanelStack, PreviewDisclosure } from './Panel';
import { CardGroup, type CardOption } from './CardGroup';

/**
 * SECTION 5 — WINDOW (was screen 7, pass windows).
 *
 * A computation moment where the computation is real and nothing is
 * accelerated to make it feel busy.
 *
 * Step one fires the pass search: `/mission/passes?op=windows` runs SGP4
 * over these coordinates against published orbital elements and returns
 * the days a tracked satellite is genuinely above this horizon. It is the
 * slow step because it is the one doing the work.
 *
 * Step two reports how many element sets were usable and how old the
 * freshest one is, so the dates can be attributed instead of asserted.
 *
 * Step three is the one this section was rebuilt around:
 * `/mission/passes?op=overhead` keeps the same propagation PER SPACECRAFT
 * instead of collapsing it onto calendar days. It is what turns "there is
 * a window on Tuesday" into the thing the buyer is actually paying for —
 * named, real satellites, crossing their sky, at instants, at elevations.
 *
 * Neither of the three has a timer behind it. If a search returns in
 * 200 ms the screen is done in 200 ms.
 *
 * ------------------------------------------------------------------
 * WHAT IS NEVER SAID HERE
 * ------------------------------------------------------------------
 * That a particular satellite is assigned — see `PASS_ATTRIBUTION`. The
 * list below is the fleet this site TRACKS; tasking is brokered at
 * capture time and the assigned spacecraft is very often none of them.
 * "These pass over you" is geometry and is true. "This one is yours"
 * would be a fabrication and there is nothing in this repository that
 * could produce it.
 *
 * And no PROBABILITY, anywhere. A capture-success percentage needs a
 * cloud forecast bound to a future pass and an operator commitment; this
 * system has neither, so it prints neither. What stands in its place is
 * the count of opportunities, how high each one climbs, and the re-task
 * guarantee — all three of which are real.
 *
 * If the elements could not be propagated at all, the dates come from
 * config, `indicative` is set, and `INDICATIVE_NOTICE` is printed above
 * them.
 *
 * ------------------------------------------------------------------
 * IT IS THE ONE SECTION WITH NO DEFAULT
 * ------------------------------------------------------------------
 * Every other decision on this surface arrives pre-answered and priced; a
 * capture date cannot, because inventing one would be inventing a pass.
 * So `sectionAnswered('window',…)` is false until a date is chosen, and
 * the panel foot says what is missing rather than moving on without it.
 *
 * IT IS ALSO WHY THE SECTION IS NOT UNMOUNTED when the buyer moves to
 * another tab: the pass search is the slow step, and re-running it every
 * time somebody looks back at the size would be a punishment for using
 * the tabs. See <MissionFlow />, which keeps a visited section mounted.
 */
type StepState = 'waiting' | 'running' | 'done' | 'failed';

export function WindowSection({
  lat,
  lon,
  earliest,
  chosen,
  onSelect,
}: {
  lat: number;
  lon: number;
  /**
   * The earliest capture date the buyer named at the door, ISO
   * `YYYY-MM-DD`, or null for first-available. A PREFERENCE ONLY — see
   * `MissionDraft.earliest`. It decides which of the windows below opens
   * selected and nothing else; it never produces a window, never moves
   * one, and never suppresses one.
   */
  earliest: string | null;
  chosen: ChosenWindow | null;
  onSelect: (w: ChosenWindow) => void;
}) {
  const [windowsState, setWindowsState] = useState<StepState>('waiting');
  const [fleetState, setFleetState] = useState<StepState>('waiting');
  const [overheadState, setOverheadState] = useState<StepState>('waiting');
  const [result, setResult] = useState<PassWindowResult | null>(null);
  const [fleet, setFleet] = useState<FleetReading | null>(null);
  const [overhead, setOverhead] = useState<OverheadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // No "have I already started?" ref here, deliberately. React runs an
  // effect, tears it down and runs it again in development; a ref guard
  // would let the teardown cancel the first run and then refuse the
  // second, and the screen would sit on RUNNING for ever. The abort
  // controller and the `live` flag are the correct guard: the superseded
  // run is cancelled, the current one always starts.
  useEffect(() => {
    const controller = new AbortController();
    let live = true;

    setWindowsState('running');
    setFleetState('waiting');
    setOverheadState('waiting');
    setResult(null);
    setFleet(null);
    setOverhead(null);
    setError(null);

    (async () => {
      const windows = await fetchWindows(lat, lon, controller.signal);
      if (!live) return;

      if (!windows.ok) {
        setWindowsState('failed');
        setError(windows.message);
        return;
      }
      setResult(windows.data);
      setWindowsState('done');

      // Only now: steps two and three are consequences of step one, not
      // parallel animations dressed as ones. They are independent of each
      // other, so they are asked for together rather than in a queue.
      setFleetState('running');
      setOverheadState('running');

      const [reading, sky] = await Promise.all([
        fetchFleetReading(controller.signal),
        // The overhead search is cached by <useOverhead /> as well, so the
        // Review section reads this same answer rather than re-propagating.
        primeOverhead(lat, lon, controller.signal),
      ]);
      if (!live) return;

      if (reading.ok) {
        setFleet(reading.data);
        setFleetState('done');
      } else {
        setFleetState('failed');
      }

      if (sky) {
        setOverhead(sky);
        setOverheadState('done');
      } else {
        setOverheadState('failed');
      }
    })().catch(() => {
      /* aborted */
    });

    return () => {
      live = false;
      controller.abort();
    };
  }, [lat, lon, attempt]);

  /* Memoised because the seeding effect below depends on it: `?? []`
     builds a new array on every render, which would re-run the effect
     every time and defeat the `seededRef` guard's purpose of running
     once. */
  const windows = useMemo(() => result?.windows ?? [], [result?.windows]);
  const settled = (s: StepState) => s === 'done' || s === 'failed';
  const ready = windowsState === 'done' && settled(fleetState) && settled(overheadState);

  /* ------------------------------------------------------------------
     THE EARLIEST-DATE PREFERENCE MEETS THE REAL WINDOWS.

     `windows` is the propagator's answer and it is the only source of a
     date on this screen. The preference does exactly one thing to it:
     it decides which entry opens selected. It cannot add a date, move a
     date, hide a date or reorder them — a buyer who names a date and
     then changes their mind can still pick any window in the list.

     `reached` is null when every computed window falls BEFORE the named
     date. That case gets a sentence rather than a silent fallback,
     because silently selecting the last window would be answering a
     question the buyer did not ask, and inventing a later one would be
     inventing a pass. String comparison is sound here: both sides are
     zero-padded ISO `YYYY-MM-DD`, where lexical order is chronological.
     ------------------------------------------------------------------ */
  const reached = earliest ? (windows.find((w) => w.date >= earliest) ?? null) : null;
  const noneReach = Boolean(earliest) && ready && windows.length > 0 && reached === null;

  /* Open on the preferred window, once, and only while nothing has been
     chosen. `chosen` is the buyer's own decision and this must never
     overwrite it — including after a Back into this section, where the
     draft already carries an answer. */
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || chosen || !ready) return;
    const w = earliest ? reached : windows[0];
    if (!w) return;
    seededRef.current = true;
    onSelect({ date: w.date, commitBy: w.commitBy, indicative: result?.indicative ?? false });
  }, [ready, chosen, earliest, reached, windows, result?.indicative, onSelect]);

  /* The day peaks come from the OVERHEAD propagation, not from the window
     payload. Both walk the same passes, but `nextPass()` reads its peak on
     a 30-second stride, and a satellite crossing near the zenith moves at
     about a degree a second — checked against a 5-second sweep it was
     under-reading an 83° day as 79°. `lib/mission-flow/overhead.ts` refines
     the apex to the second, so that is the figure printed. One elevation
     per day on the screen, from one computation. */
  const peakFor = (date: string) =>
    overhead?.days.find((d) => d.date === date)?.peakElevationDeg ?? null;

  /* TWO READINGS IN THE ASIDE, ONE SENTENCE IN THE NOTE.
     The card used to spend three lines of prose restating its own date.
     At 320 x 568 the panel's scroller is barely taller than one card, so
     every line of note is a line of the decision that cannot be reached —
     the figures belong in the telemetry column, where they are read
     faster anyway, and the note keeps only the deadline. */
  const options: readonly CardOption<string>[] = windows.map((w) => {
    const peak = peakFor(w.date);
    return {
      value: w.date,
      label: formatWindowDate(w.date),
      note: <>Commission by {formatWindowDate(w.commitBy)}.</>,
      aside: result?.indicative ? (
        'INDICATIVE'
      ) : (
        <span className="block text-right">
          <span className="block">
            {w.passes} {w.passes === 1 ? 'PASS' : 'PASSES'}
          </span>
          {peak !== null ? (
            <span className="block pt-1 font-mono text-tele-xs uppercase opacity-70">
              {peak}° PEAK
            </span>
          ) : null}
        </span>
      ),
    };
  });

  return (
    /* <PanelStack />, not a local `space-y-8`. The section's rhythm is a
       house token — `gap-6 sm:gap-7 xl:gap-8` — and this file was the one
       place holding a flat 32px at every width. It is also 8px per gap
       back into the scroller on a phone, which at 390 is what puts the
       first capture-window card inside the visible band rather than 4px
       under it. See `components/mission-flow/index.ts` on the vocabulary. */
    <PanelStack>
      {/* ONE LINE, NOT THREE. At 360 the longer standfirst wrapped to four
          lines and made this head 173px of a 192px scroller — the section's
          own decision could not be seen at all without scrolling. What was
          cut is not dropped: the provenance line at ❹ states the element
          source, its age and how many sets were usable, in more detail than
          a standfirst can. */}
      <PanelHead eyebrow="Capture" title="Next capture windows.">
        Pick the day. The operator flies the best pass on it.
      </PanelHead>

      {/* THE COMPUTATION IS SHOWN WHILE IT IS HAPPENING, AND THEN IT GETS
          OUT OF THE WAY. Three log rows above the decision are honest for
          the second they are running and dead weight for every second
          after — they pushed the capture windows and the fleet below the
          fold on a 1440 desktop. Once every step has settled they collapse
          into the one provenance line at the foot of this section. */}
      {ready ? null : (
        <ol>
          <ComputeStep
            state={windowsState}
            label={`Checking pass windows over ${telemetryCoords(lat, lon)}…`}
            value={
              result
                ? `${result.windows.length} ${result.windows.length === 1 ? 'WINDOW' : 'WINDOWS'}`
                : null
            }
          />
          <ComputeStep
            state={fleetState}
            label="Querying constellation availability…"
            value={
              fleet
                ? `${fleet.usable} / ${fleet.tracked} USABLE · ${fleet.source.toUpperCase()}`
                : fleetState === 'failed'
                  ? 'NOT READ'
                  : null
            }
          />
          <ComputeStep
            state={overheadState}
            label="Resolving which tracked spacecraft cross your sky…"
            value={
              overhead
                ? `${overhead.satellites.length} / ${overhead.tracked} CROSS THIS SKY`
                : overheadState === 'failed'
                  ? 'NOT COMPUTED'
                  : null
            }
          />
        </ol>
      )}

      {windowsState === 'failed' ? (
        <div>
          <ErrorPlate
            title="Pass search failed"
            action={
              <button
                type="button"
                onClick={() => setAttempt((a) => a + 1)}
                className={cn('inline-flex min-h-11 items-center text-action underline underline-offset-4', INK)}
              >
                Run the search again
              </button>
            }
          >
            {error ?? 'The orbital search did not return.'} No dates are shown, because none were
            computed.
          </ErrorPlate>
        </div>
      ) : null}

      {/* ❶ THE DECISION, FIRST.

          It used to be second, under the live countdown, and the countdown
          is 164px. Measured at 390 x 844 the panel's scroller is 291px and
          the first capture-window card began 462px down it: the whole of
          what a buyer sees on this section was an eyebrow, a title, a
          paragraph and a readout — with `Choose a capture window` in the
          panel foot, above a DISABLED button, pointing at radios that were
          entirely below the fold. A section that says what is missing and
          then hides it is worse than one that says nothing.

          Nothing is removed: the countdown is the next block down, and it
          is the third place this pass is shown — Target · 01 draws the same
          crossing as a sky chart with its rise, its peak and its live slant
          range, and Review counts down to it again beside the tier cards.
          What changed is which of the two a buyer meets first, and
          CONFIGURATOR.md §2 is explicit that the decision comes first.

          With the head shortened above, the first card now begins 205px
          down at 390 (visible) and 430 (visible). At 360 and 320 the
          scroller is 192px and 151px and a 56px card still cannot be
          reached without scrolling the panel — see the report. */}
      {ready && windows.length > 0 ? (
        <PanelGroup label="Capture window">
          {result?.indicative ? (
            <PanelNote className="pb-4">{INDICATIVE_NOTICE}</PanelNote>
          ) : null}

          {/* SAID PLAINLY, NOT PAPERED OVER. The buyer asked for a date;
              the propagation does not reach it inside the horizon it
              searched. The only honest move is to say that and leave the
              real windows selectable — the alternative, quietly choosing
              one and letting them discover the gap on the receipt, is the
              class of thing this file exists to prevent. */}
          {noneReach ? (
            <PanelNote className="pb-4">
              No computed pass reaches {formatWindowDate(earliest as string)} inside the search
              horizon. The windows below are the ones the orbits actually give, and none of them
              has been chosen for you.
            </PanelNote>
          ) : earliest && reached ? (
            <PanelNote className="pb-4">
              Opened on the first pass on or after {formatWindowDate(earliest)}. Any window below
              can be taken instead.
            </PanelNote>
          ) : null}

          <CardGroup
            label="Capture window"
            options={options}
            value={chosen?.date ?? null}
            onSelect={(date) => {
              const w = windows.find((x) => x.date === date);
              if (w) {
                onSelect({
                  date: w.date,
                  commitBy: w.commitBy,
                  indicative: result?.indicative ?? false,
                });
              }
            }}
          />
        </PanelGroup>
      ) : null}

      {/* ❷ THE ONE FIGURE THAT IS ABOUT THIS BUYER AND NOBODY ELSE. */}
      {ready && overhead && overhead.satellites.length > 0 ? (
        <NextPassReadout overhead={overhead} />
      ) : null}

      {/* ❸ THE EVIDENCE UNDER IT. */}
      {ready ? (
        <PanelNote className="border-t pt-4">
          {PASS_ATTRIBUTION}
          {!result?.indicative
            ? ` A pass counts above ${PASS_MIN_ELEVATION_DEG}°. Cloud is not known this far ahead.`
            : ''}
        </PanelNote>
      ) : null}

      <PreviewDisclosure />
    </PanelStack>
  );
}

/* ------------------------------------------------------------------ */
/* The next pass — the one figure that is specific to this buyer        */
/* ------------------------------------------------------------------ */

/**
 * TIME TO THE NEXT PASS OVER THESE COORDINATES.
 *
 * An ETA is derivable and a probability is not, so this is an ETA: the
 * countdown runs to a propagated rise instant, and the elevation beside it
 * is how high that particular pass climbs.
 *
 * When the countdown reaches zero the readout moves to the next rise in
 * the same answer rather than sitting on 00:00:00 or silently restarting —
 * eight satellites over seven days is a long list of instants and the one
 * that matters is simply the next one that has not happened yet.
 */
function NextPassReadout({ overhead }: { overhead: OverheadResult }) {
  const now = useNow(1000);
  const at = now ?? new Date(overhead.computedAt).getTime();

  const next = overhead.satellites
    .map((s) => ({ s, t: Date.parse(s.risesAt) }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t)
    .find((x) => x.t > at);

  // Every rise in the answer is behind us. The propagation is stale rather
  // than wrong, and saying so is better than counting to a past instant.
  if (!next) {
    return (
      <div className={cn('border-t pt-5', RULE)}>
        <p className={cn('text-label uppercase', INK_DIM)}>Next pass over your coordinates</p>
        <p className={cn('pt-3 text-body', INK_DIM)}>
          Every pass in this search has now flown. Reopen this tab to propagate the next seven
          days.
        </p>
      </div>
    );
  }

  const remaining = next.t - at;

  return (
    <div className={cn('border-t pt-5', RULE)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className={cn('text-label uppercase', INK_DIM)}>Next pass over your coordinates</p>
        <p data-telemetry className={cn('font-mono text-tele-s uppercase tabular-nums', INK_DIM)}>
          {next.s.peakElevationDeg}° PEAK
        </p>
      </div>

      <p
        data-telemetry
        className={cn('pt-3 font-mono text-heading uppercase tabular-nums', INK)}
        aria-live="off"
      >
        {now === null ? '—' : formatRemaining(remaining)}
      </p>

      <p className={cn('pt-3 text-note', INK_DIM)}>
        {formatInstant(next.s.risesAt)}, when {next.s.name} clears {overhead.minElevationDeg}°
        above your horizon and climbs to {next.s.peakElevationDeg}°. That is geometry, not a
        booking — the spacecraft that flies a mission is chosen by the operator at tasking.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The fleet, against one set of coordinates                           */
/* ------------------------------------------------------------------ */

/**
 * Every tracked spacecraft that crosses this sky, soonest first.
 *
 * The glyph is <OrbitGlyph />, which is not decoration: its ring is
 * rotated by the satellite's real inclination and its marker sits at the
 * real orbital phase, advanced on the browser's clock from the mean
 * anomaly at epoch. It moves because the satellite moves.
 */
export function SatelliteList({
  satellites,
  limit,
}: {
  satellites: readonly OverheadSatellite[];
  /** Show only the soonest N. The caller says what it left out. */
  limit?: number;
}) {
  const now = useNow(1000);
  const shown = limit ? satellites.slice(0, limit) : satellites;

  return (
    <ul>
      {shown.map((s) => {
        const overheadNow = s.elevationNowDeg >= 0;
        return (
          <li
            key={s.noradId}
            className={cn('flex items-start gap-4 border-t py-4', RULE)}
          >
            <OrbitGlyph
              inclination={s.inclinationDeg}
              phase={orbitPhase(s, now)}
              size={40}
              className={cn('mt-0.5 shrink-0', overheadNow ? 'text-[color:var(--accent)]' : INK_DIM)}
            />

            <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className={cn('text-action', INK)}>{s.name}</p>
                <p
                  data-telemetry
                  className={cn('pt-1 font-mono text-tele-xs uppercase', INK_DIM)}
                >
                  {s.operator} · {s.gsd}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p data-telemetry className={cn('font-mono text-tele uppercase tabular-nums', INK)}>
                  {formatInstant(s.risesAt)}
                </p>
                <p
                  data-telemetry
                  className={cn('pt-1 font-mono text-tele-xs uppercase tabular-nums', INK_DIM)}
                >
                  {s.peakElevationDeg}° PEAK · {s.passes}{' '}
                  {s.passes === 1 ? 'PASS' : 'PASSES'}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Where the satellite is in its revolution, 0..1.
 *
 * The same derivation <FleetTracker /> does: the mean anomaly at the
 * element set's epoch, advanced by the elapsed time over the orbital
 * period. Not an animation loop — nothing here moves on a timer of its
 * own, it is a plot of a value that is changing.
 */
function orbitPhase(s: OverheadSatellite, now: number | null): number {
  if (s.periodMinutes <= 0) return 0;
  const minutes = ((now ?? s.epochMs) - s.epochMs) / 60_000;
  return ((((s.meanAnomalyDeg / 360 + minutes / s.periodMinutes) % 1) + 1) % 1);
}

/* ------------------------------------------------------------------ */
/* Fetching, once, for both sections that need it                      */
/* ------------------------------------------------------------------ */

/**
 * The overhead answer, cached per coordinate for the life of the page.
 *
 * The Window section and the Review section both show it, and
 * <MissionFlow /> keeps a visited section mounted, so without this the
 * seven-day propagation would run twice for one buyer. The cache holds
 * the PROMISE rather than the value, so two mounts in the same tick share
 * one request rather than racing two.
 *
 * A failure is not cached: it is dropped so the next mount can retry.
 */
const OVERHEAD_CACHE = new Map<string, Promise<OverheadResult | null>>();

function primeOverhead(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<OverheadResult | null> {
  const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  const cached = OVERHEAD_CACHE.get(key);
  if (cached) return cached;

  const pending = fetchOverhead(lat, lon, signal)
    .then((r) => (r.ok ? r.data : null))
    .then((value) => {
      if (value === null) OVERHEAD_CACHE.delete(key);
      return value;
    })
    .catch(() => {
      OVERHEAD_CACHE.delete(key);
      return null;
    });

  OVERHEAD_CACHE.set(key, pending);
  return pending;
}

/**
 * The overhead answer for a target, or null while it is being computed.
 *
 * Null coordinates mean there is no target yet, and no request is made:
 * defaulting them to 0, 0 would propagate the fleet over the Gulf of
 * Guinea and cache the answer against a place nobody asked about.
 */
export function useOverhead(lat: number | null, lon: number | null): OverheadResult | null {
  const [value, setValue] = useState<OverheadResult | null>(null);

  useEffect(() => {
    if (lat === null || lon === null) return;
    let live = true;
    void primeOverhead(lat, lon).then((v) => {
      if (live && v) setValue(v);
    });
    return () => {
      live = false;
    };
  }, [lat, lon]);

  return value;
}

/* ------------------------------------------------------------------ */
/* Small parts                                                         */
/* ------------------------------------------------------------------ */

/** One line of the computation. Pending, running, or answered. */
function ComputeStep({
  state,
  label,
  value,
}: {
  state: StepState;
  label: string;
  value: string | null;
}) {
  return (
    <li
      className={cn('relative overflow-hidden border-t py-4', RULE)}
      aria-busy={state === 'running'}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span
          className={cn(
            'text-body',
            state === 'waiting' ? 'text-[color:var(--ink-faint)]' : INK,
          )}
        >
          {label}
        </span>
        <span
          data-telemetry
          className={cn('shrink-0 font-mono text-tele uppercase tabular-nums', INK_DIM)}
        >
          {state === 'running' ? 'RUNNING' : state === 'failed' ? 'FAILED' : (value ?? '')}
        </span>
      </div>
      {state === 'running' ? <ScanSweep repeat /> : null}
    </li>
  );
}

/**
 * A clock, in milliseconds, or null until the first client tick.
 *
 * Null on the server and on the first client render so the two agree: a
 * clock that differs by a second between them is a hydration mismatch,
 * not a clock. Honours `prefers-reduced-motion` by ticking anyway — a
 * countdown is information, not motion — but it is the caller's job not
 * to animate anything off it.
 */
export function useNow(intervalMs: number): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** `2026-08-25` → `TUE 25 AUG 2026`. UTC: a window is a day, not a local one. */
export function formatWindowDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(d)
    .toUpperCase()
    .replace(/,/g, '');
}

/**
 * `2026-08-25T04:12:33Z` → `TUE 25 AUG 04:12 UTC`.
 *
 * UTC and said so. A pass instant converted into the reader's own zone
 * would be friendlier and would also be the only figure on this screen
 * that could not be checked against a public pass predictor.
 */
export function formatInstant(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  })
    .format(d)
    .toUpperCase()
    .replace(/,/g, '');
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(d);
  return `${date} ${time} UTC`;
}

/** `7_450_000` → `2H 04M 10S`. Days appear only once there are any. */
export function formatRemaining(ms: number): string {
  const clamped = Math.max(0, ms);
  const days = Math.floor(clamped / 86_400_000);
  const hours = Math.floor(clamped / 3_600_000) % 24;
  const minutes = Math.floor(clamped / 60_000) % 60;
  const seconds = Math.floor(clamped / 1000) % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return days > 0
    ? `${days}D ${pad(hours)}H ${pad(minutes)}M ${pad(seconds)}S`
    : `${pad(hours)}H ${pad(minutes)}M ${pad(seconds)}S`;
}

export type { PassWindow };
