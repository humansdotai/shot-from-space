'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clsx as cn } from 'clsx';
import { CreditBox, CropMarks } from '@/components/fui';
import { OrbitFigure } from '@/components/satellites/OrbitFigure';
import { CURVE, INK, INK_DIM, INPUT_CLASS, FieldLabel, RULE } from '@/components/purchase/fields';
import { formatPrice, getFormat } from '@/lib/pricing';
import type { Currency, FormatId, FrameOption, GeoSuggestion } from '@/lib/types';
import { CLOUD_THRESHOLD_PCT, guaranteeTerm } from '@/lib/guarantees';
import {
  DEFAULT_TIER,
  PASS_ATTRIBUTION,
  PASS_MIN_ELEVATION_DEG,
  REVEAL_SOURCE_NOTICE,
  REVEAL_STEP_MS,
  REVEAL_ZOOM_STEPS,
  TIER_COPY,
  TIER_IDS,
  effectiveFrame,
  tierPriceMinor,
} from '@/lib/mission-flow/config';
import { fetchScene, revealFrameUrl, suggestAddresses } from '@/lib/mission-flow/api';
import type { SceneInfo } from '@/lib/mission-flow/scene';
import { landmarkFor, telemetryCoords } from '@/lib/mission-flow/entry';
import type { MissionTarget } from '@/lib/mission-flow/state';
import { FieldRow, FieldTable, PanelGroup, PanelHead, PanelNote, PanelStack } from './Panel';
import {
  SkyChart,
  type SkyResult,
  ageLabel,
  fixed,
  groupDigits,
  phaseOf,
  untilLabel,
  useLiveClock,
  useLiveLook,
  useSkyReading,
  utcStamp,
} from './PassGeometry';

/**
 * SECTION 1 — THE TARGET (was screen 1, the reveal).
 *
 * Two halves of one thing, in the two halves of the configurator:
 * <RevealStage /> is the descent, in the preview column, and
 * <TargetSection /> is the address and what the picture actually is, in
 * the panel. The button that used to sit under the picture — below the
 * fold on every desktop viewport — is now the panel foot.
 *
 * ------------------------------------------------------------------
 * WHAT THIS IS NOT
 * ------------------------------------------------------------------
 * It is not a map. No keyed tile provider is configured (MOCK_MODE), so
 * there is no Google, Mapbox or Maps basemap to fly a camera through,
 * and pretending otherwise would mean drawing a fake globe and calling
 * it a satellite view.
 *
 * WHAT IT IS instead is real: three genuine requests to
 * `/api/geocode/static` at increasing zoom, layered, each one scaling
 * down into place as it arrives. The pictures are public-domain archive
 * scenes from `lib/imagery.ts`, cropped deterministically per
 * coordinate. So the descent is a real descent through real imagery —
 * it is simply not imagery of the reader's roof, and the section says so
 * in `REVEAL_SOURCE_NOTICE` rather than letting them assume otherwise.
 *
 * The acquisition date is quoted ONLY when the chosen scene is close
 * enough to plausibly contain the target (`ARCHIVE_MATCH_RADIUS_KM`).
 * Further away it is a stand-in for somewhere else and the copy says
 * the imagery is undated, because for those coordinates it is.
 *
 * NO PARAMETERS. Arriving at `/mission` bare is a normal way to arrive,
 * not an error: the section asks for a place, using the same geocode
 * adapter the rest of the site uses, and reveals it once one is named.
 */

/* ------------------------------------------------------------------ */
/* The scene record, read once and shared                              */
/* ------------------------------------------------------------------ */

/**
 * The preview column and the panel both need the same scene record — the
 * picture is captioned by it and the panel's disclosure is written from
 * it — and they are now two components rather than one screen. So the
 * request is cached by coordinate and the two share the one in-flight
 * promise. Without this the split would have doubled a network call that
 * used to happen once.
 */
const SCENE_CACHE = new Map<string, Promise<SceneInfo | null>>();

function useScene(lat: number, lon: number): { scene: SceneInfo | null; failed: boolean } {
  const [scene, setScene] = useState<SceneInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const key = `${lat},${lon}`;
    let live = true;
    setScene(null);
    setFailed(false);

    let pending = SCENE_CACHE.get(key);
    if (!pending) {
      pending = fetchScene(lat, lon).then((r) => (r.ok ? r.data : null));
      SCENE_CACHE.set(key, pending);
    }

    void pending
      .then((value) => {
        if (!live) return;
        if (value) setScene(value);
        else setFailed(true);
      })
      .catch(() => {
        if (live) setFailed(true);
      });

    return () => {
      live = false;
    };
  }, [lat, lon]);

  return { scene, failed };
}

/* ------------------------------------------------------------------ */
/* The preview artefact — the descent                                  */
/* ------------------------------------------------------------------ */

export function RevealStage({ target }: { target: MissionTarget }) {
  const { scene } = useScene(target.lat, target.lon);
  const stage = useDescent(REVEAL_ZOOM_STEPS.length, REVEAL_STEP_MS);

  const frames = useMemo(
    () =>
      REVEAL_ZOOM_STEPS.map((zoom) => ({
        zoom,
        src: revealFrameUrl(target.lat, target.lon, zoom),
      })),
    [target.lat, target.lon],
  );

  /* The single telemetry line: where, how high, and when the picture was
     taken. `UNDATED` is a value, not a blank — see the note above. */
  const telemetry = [
    telemetryCoords(target.lat, target.lon),
    'REFERENCE IMAGERY',
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <div className="relative h-full w-full overflow-hidden bg-deck-2">
      {frames.map((frame, i) => (
        <Image
          key={frame.zoom}
          src={frame.src}
          alt={
            i === frames.length - 1
              ? 'Reference imagery at the target coordinates. Not your capture.'
              : ''
          }
          aria-hidden={i !== frames.length - 1}
          fill
          unoptimized
          priority={i === 0}
          sizes="(min-width: 1024px) 64vw, 100vw"
          className="object-cover ease-house motion-reduce:transition-none"
          style={{
            transitionProperty: 'opacity, transform',
            transitionDuration: `${REVEAL_STEP_MS}ms`,
            opacity: stage >= i ? 1 : 0,
            transform: stage >= i ? 'scale(1)' : 'scale(1.28)',
          }}
        />
      ))}

      <CropMarks length={20} inset={16} />

      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-linear-to-t from-void/85 via-void/35 to-transparent"
      />

      {/* The credit carries no coordinates here: the telemetry line
          beside it already sets them, and on a phone the two wrap onto
          each other and print the same pair twice. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 p-4 lg:p-6">
        <CreditBox size="xs" />
        <p data-telemetry className="font-mono text-tele uppercase tabular-nums text-paper">
          {telemetry}
        </p>
      </div>
    </div>
  );
}

/**
 * The zoom. One stage per zoom level, on a timer, with the last stage held.
 *
 * Under `prefers-reduced-motion` there is no descent: the final frame is
 * the first thing rendered. The preference is read once and re-read if it
 * changes, because a reader can turn it on mid-flow.
 */
function useDescent(stages: number, stepMs: number): number {
  const [stage, setStage] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');

    const run = () => {
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
      if (query.matches) {
        setStage(stages - 1);
        return;
      }
      setStage(0);
      for (let i = 1; i < stages; i += 1) {
        timers.current.push(window.setTimeout(() => setStage(i), i * stepMs));
      }
    };

    run();
    query.addEventListener('change', run);
    return () => {
      query.removeEventListener('change', run);
      timers.current.forEach(window.clearTimeout);
    };
  }, [stages, stepMs]);

  return stage;
}

/* ------------------------------------------------------------------ */
/* The panel section                                                   */
/* ------------------------------------------------------------------ */

export function TargetSection({
  target,
  onTarget,
  formatId,
  frame,
  currency,
}: {
  target: MissionTarget | null;
  onTarget: (t: MissionTarget) => void;
  /** The configuration the foot is quoting. Only used by <PriceRange />. */
  formatId: FormatId;
  frame: FrameOption;
  currency: Currency;
}) {
  void formatId;
  void frame;
  void currency;
  if (!target) return <NameThePlace onTarget={onTarget} range={null} />;
  return <TargetRecord target={target} />;
}

/**
 * WHAT THE FIGURE IN THE PANEL FOOT IS ONE OF.
 *
 * From the moment a place is named, the foot carries a price — and until
 * the Review tab, six sections later, nothing on the surface says that it
 * is the middle of three. A buyer who wanted the archive frame meets it
 * for the first time at the payment step, after the commission price has
 * been the only number on screen through the whole flow, and is then
 * asked to downgrade at the moment of paying. That is an anchor set by
 * omission, and one sentence closes it.
 *
 * IT IS NOT A SECOND PRICE LIST. It quotes no tier name and repeats no
 * card; it states the range the same configuration can be bought at and
 * says where the choice is made. Every figure is `tierPriceMinor()` at
 * the size and finish currently selected, in the currency the card will
 * be debited in — the same call the foot and the order route make — so it
 * cannot drift from either, and it re-prices when the size does.
 *
 * The decision itself stays in Review. See the report: moving the tier
 * cards here inverts `TIER_FORCED_FRAME` (LARGE FORMAT is defined as
 * framed and its copy reads `Framed regardless of the finish chosen
 * earlier`, which is only true while the finish is chosen first) and puts
 * a seven-day propagation on the first paint of the funnel.
 */
function TargetRecord({ target }: { target: MissionTarget }) {
  const { scene, failed } = useScene(target.lat, target.lon);
  const landmark = landmarkFor(target.lat, target.lon);

  /* ONE search for the whole section. The pass search is roughly twelve
     thousand SGP4 evaluations; the two blocks below both read it, and
     calling the hook in each of them would run it twice before either
     answer landed in the shared cache. */
  const sky = useSkyReading(target.lat, target.lon);

  return (
    <PanelStack>
      <PanelHead eyebrow="Target · 01" title="Your target." rule={false}>
        {target.label}
      </PanelHead>

      {/* The coordinates are a READING, not a subtitle. Set as one, they
          sit in the same instrument column every other value in the panel
          uses, and the landmark line — when there is one — is a second
          reading rather than a floating sentence. */}
      <FieldTable>
        <FieldRow label="Coordinates" value={telemetryCoords(target.lat, target.lon)} />
        {landmark ? <FieldRow label="Note" value={landmark.note} prose /> : null}
      </FieldTable>

      {/* ORDER. The mission comes before the disclosure about the preview.
          A buyer who has not yet been told that a spacecraft crosses these
          coordinates cannot evaluate a paragraph about which archive scene
          is standing in for it — and with that paragraph above them, the
          pass began below the fold of the panel's scroller on a 1440 x 820
          desktop, which is the same defect CONFIGURATOR.md §1 was written
          about. Nothing is dropped or shortened; the two statements about
          the PICTURE are grouped together, under their own label, after
          the two about the MISSION. */}
      <NextCrossing lat={target.lat} lon={target.lon} sky={sky} />

      <PanelNote>
        {REVEAL_SOURCE_NOTICE}
      </PanelNote>
    </PanelStack>
  );
}

/* ------------------------------------------------------------------ */
/* The pass — what is actually about to happen                         */
/* ------------------------------------------------------------------ */

/**
 * THE ONE THING THIS SECTION USED NOT TO SAY.
 *
 * A buyer arriving here saw a satellite photograph of their street, an
 * address, and a €279 button. Nothing told them that what they were
 * commissioning is a spacecraft in a sun-synchronous orbit crossing these
 * coordinates, on a schedule set by orbital mechanics rather than by us.
 *
 * So the section shows one, over their own address:
 *
 *   the CHART is the crossing plotted where it will really be, sampled
 *     every fifteen seconds by SGP4 — a different address draws a
 *     different arc;
 *   the ROWS are that crossing's numbers, and the slant range among them
 *     is recomputed every second, so the figure visibly falls as the
 *     spacecraft closes;
 *   the GLYPH is `components/satellites/OrbitGlyph.tsx` — its ring is the
 *     real inclination and its marker is the real mean anomaly advanced
 *     to now. It moves because the satellite moves.
 *
 * WHAT IS NOT CLAIMED. That this spacecraft is flying the mission.
 * `PASS_ATTRIBUTION` sits directly under the name, in the note role, and
 * says the assignment is made by the operator at tasking and is not named
 * anywhere. The fleet is real; the link to this order is not asserted.
 */
function NextCrossing({
  lat,
  lon,
  sky,
}: {
  lat: number;
  lon: number;
  sky: SkyResult;
}) {
  const { status, reading } = sky;
  /* The clock is seeded once. Everything it drives renders only after the
     search has answered, so there is no server markup for it to disagree
     with — but a seed that changed on every render would restart the
     interval, and that is the bug this ref prevents. */
  const seed = useMemo(() => new Date().toISOString(), []);
  const now = useLiveClock(seed);
  const crossing = reading?.next ?? null;

  return (
    <PanelGroup
      label="The next crossing of your sky"
      hint={status === 'ready' ? 'Live' : undefined}
    >
      {status === 'loading' ? (
        <p role="status" className={cn('py-6 text-note', INK_DIM)}>
          Propagating the tracked fleet over {telemetryCoords(lat, lon, 2)}.
        </p>
      ) : status === 'unavailable' || !reading ? (
        <PanelNote>
          Orbital elements could not be read in this browser, so no crossing is drawn. Nothing is
          shown in their place: a pass that has not been propagated is not a pass.
        </PanelNote>
      ) : (
        <>
          <div className="flex justify-center pb-1">
            <SkyChart crossing={crossing} />
          </div>
          {/* Two lines, and they are the legend. Kept short on purpose: at
              1440 x 820 the chart and this caption together are what a
              reader sees before scrolling, and a four-line legend cut in
              half by the fold explains nothing. */}

          {crossing ? (
            <>
              <FieldTable>
                <FieldRow label="Spacecraft" value={crossing.name} note={crossing.operator} />
                {/* `risesAt` is the HORIZON crossing, not the ten-degree
                    one, and the note says so — the Window section quotes
                    the threshold instant for the same pass and the two are
                    a couple of minutes apart. A reader who cannot tell
                    which is which will read that gap as an error. */}
                <FieldRow
                  label="Rises in"
                  value={untilLabel(crossing.risesAt, now)}
                  note={utcStamp(crossing.risesAt)}
                />
                <FieldRow label="Highest point" value={`${fixed(crossing.peakElevation, 0)}°`} />
                <FieldRow label="Above the horizon" value={fixed(crossing.durationMin, 0)} unit="min" />
              </FieldTable>

            </>
          ) : (
            <p className={cn('max-w-[var(--measure)] text-body', INK)}>
              No tracked spacecraft clears {PASS_MIN_ELEVATION_DEG}° over these coordinates in the
              next 24 hours. That is the normal answer, not a fault: a sun-synchronous orbit does
              not pass over every point every day, which is exactly why a mission buys a window
              rather than a moment.
            </p>
          )}

        </>
      )}
    </PanelGroup>
  );
}

/**
 * THE THREE WORDS THE REST OF THE FLOW USES WITHOUT DEFINING THEM.
 *
 * `Window` is a tab in the rail, `pass` is in the capture copy and cloud is
 * in the guarantees — and until here none of the three was ever explained.
 * Each term is defined against a number this browser just computed for
 * these coordinates, so the definition is not a general fact about space,
 * it is a fact about this address.
 *
 * The cloud line is `guaranteeTerm('retask').detail` verbatim. Guarantee
 * wording has exactly one source (`lib/guarantees.ts`) and re-typing it
 * here — even accurately — is how the fourteen contradictions that file
 * exists to prevent got written in the first place.
 */

/**
 * `/mission` with no `address`, `lat` or `lon`.
 *
 * The flow needs coordinates before it can do anything, so it asks —
 * through the site's existing geocode adapter, which in mock mode is a
 * real search over a built-in dataset of street addresses and says so.
 */
function NameThePlace({
  onTarget,
  range,
}: {
  onTarget: (t: MissionTarget) => void;
  range: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoSuggestion[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const t = window.setTimeout(() => {
      suggestAddresses(q, controller.signal)
        .then((list) => {
          setResults(list);
          setSearching(false);
        })
        .catch(() => {
          /* superseded by a newer keystroke */
        });
    }, 250);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  return (
    <PanelStack>
      <PanelHead eyebrow="Target · 01" title="Name the place." rule={false}>
        A mission is a spacecraft crossing one set of coordinates. Nothing below can be measured
        until this page has them.
      </PanelHead>

      <div>
        <FieldLabel htmlFor="mission-place">Address</FieldLabel>
        <input
          id="mission-place"
          type="text"
          inputMode="text"
          autoComplete="street-address"
          className={INPUT_CLASS}
          placeholder="Street and city"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-describedby="mission-place-note"
        />
        <p id="mission-place-note" className={cn('pt-3 text-note', INK_DIM)}>
          Mock mode: this searches a built-in dataset of real street addresses rather than a
          live geocoder. No account and no key is involved.
        </p>

        {searching ? (
          <p className={cn('pt-5 text-label uppercase', INK_DIM)}>Searching</p>
        ) : null}

        {results.length > 0 ? (
          <ul className="grid gap-2 pt-5">
            {results.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() =>
                    onTarget({ label: s.label, lat: s.lat, lon: s.lon, address: null })
                  }
                  className={cn(
                    'flex min-h-14 w-full items-center justify-between gap-4 border px-4 py-3 text-left transition-house',
                    CURVE,
                    RULE,
                    'hover:border-[color:var(--rule-strong)] hover:bg-[color:color-mix(in_srgb,var(--ink)_5%,transparent)]',
                  )}
                >
                  <span className={cn('min-w-0 text-action', INK)}>{s.label}</span>
                  <span
                    data-telemetry
                    className={cn('shrink-0 font-mono text-tele-s uppercase tabular-nums', INK_DIM)}
                  >
                    {s.countryCode}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* The panel was otherwise EMPTY on a bare arrival — a headline, a
          field, and four hundred pixels of nothing under a €279 button.
          The three terms cost the flow uses are defined here without any
          numbers in them, because there are no coordinates yet to measure
          over; the moment a place is named the same block re-renders with
          this address's own figures in it. */}
      {range}
    </PanelStack>
  );
}
