'use client';

import { useCallback, useMemo, useState } from 'react';
import type { GpElement } from '@/lib/integrations/celestrak';
import { cn } from '@/lib/utils';
import { OrbitFigure } from './OrbitFigure';
import { SatelliteRecord } from './SatelliteRecord';
import {
  ageLabel,
  fixed,
  readSatellite,
  subPointLabel,
  trackFleet,
  type SatelliteReadout,
  type TrackedSatellite,
} from './record';
import { useLiveClock } from './useLiveClock';

/**
 * FLEET CARDS — one card per satellite, and a record behind each one.
 *
 * ------------------------------------------------------------------------
 * WHY THE MIDDLE OF THE CARD IS A DRAWING
 * ------------------------------------------------------------------------
 * The card anatomy is the reference's: name top-left, an expand glyph
 * top-right, one large object filling the middle, a ruled label/value table
 * at the foot. Their object is a render of their own spacecraft. Ours cannot
 * be — the eight satellites this site tracks belong to Maxar, Airbus, ISRO,
 * Planet, NASA and ESA, and a photograph of one of their spacecraft on our
 * card presents another company's hardware as ours. That is the one claim on
 * this site nobody could defend.
 *
 * What replaces it is better, and it is already ours: a plot of the live
 * element set. <OrbitFigure /> draws the orbit at its real inclination, to
 * scale against the globe at the satellite's real altitude, with the marker
 * where SGP4 puts the satellite this second. A card carrying a live
 * sub-point beats a static render of somebody else's hardware.
 *
 * ------------------------------------------------------------------------
 * ONE REQUEST, EIGHT MOVING CARDS
 * ------------------------------------------------------------------------
 * The elements arrive once, from the server, cached three hours by the
 * Orbital elements adapter and shared by every card on the page. Nothing here
 * fetches. What moves is the propagation: SGP4 runs locally, once a second,
 * against the same fixed element set, so the readouts are live without the
 * network being touched again.
 *
 * ------------------------------------------------------------------------
 * WHAT THE CARDS ARE NOT
 * ------------------------------------------------------------------------
 * Not the satellites assigned to anybody's mission — tasking is brokered at
 * capture time and the spacecraft that flies an order is very often none of
 * these — and not telemetry. Both statements are made in the copy around
 * this component and again inside each record, because a grid of named
 * spacecraft inside a shop implies a link that does not exist.
 */
export function FleetCards({
  elements,
  source,
  serverNow,
  className,
}: {
  elements: GpElement[];
  /** `live` came from Orbital elements this revalidation window; `snapshot` did not. */
  source: 'live' | 'snapshot';
  /** The server's instant, ISO. Seeds the clock so hydration matches. */
  serverNow: string;
  className?: string;
}) {
  const now = useLiveClock(serverNow);
  const [openId, setOpenId] = useState<number | null>(null);

  // Element sets change every few hours; parsing them into propagators is not
  // free and must not happen on every tick.
  const tracked = useMemo(() => trackFleet(elements), [elements]);

  const close = useCallback(() => setOpenId(null), []);

  /*
    Propagate every satellite ONCE per tick and hand the results down. The
    card, the provenance line and the open record all read the same numbers,
    so computing them per consumer would triple the SGP4 work and — worse —
    let a card and its own popup disagree by one clock tick.

    Deliberately not memoised: `now` changes on every tick, so a memo keyed
    on it would recompute every time and only add a comparison.
  */
  const readouts = tracked.map((satellite) => ({
    satellite,
    readout: readSatellite(satellite, now),
  }));

  const open = readouts.find((r) => r.satellite.element.NORAD_CAT_ID === openId) ?? null;

  return (
    <div className={className}>
      {/*
        The reference's card rhythm, measured: a 14px gutter when the cards
        stack or go two-up, tightening to 6px once four sit in a row — a row
        of four reads as one instrument panel, a column of one reads as
        separate plates. The card's own padding is theirs too: 14px across,
        12px down.
      */}
      {/* An empty grid under "Open one and read its whole record." is a
          headline pointing at nothing. Render the list only when there is a
          list; <SourceLine /> below says why there isn't. */}
      <ul
        className={cn(
          'grid grid-cols-1 gap-[14px] min-[560px]:grid-cols-2 min-[1280px]:grid-cols-4 min-[1280px]:gap-[6px]',
          readouts.length === 0 ? 'hidden' : undefined,
        )}
      >
        {readouts.map(({ satellite, readout }) => (
          <FleetCard
            key={satellite.element.NORAD_CAT_ID}
            satellite={satellite}
            readout={readout}
            onOpen={() => setOpenId(satellite.element.NORAD_CAT_ID)}
          />
        ))}
      </ul>

      <SourceLine readouts={readouts} source={source} />

      {open ? (
        <SatelliteRecord
          satellite={open.satellite}
          readout={open.readout}
          source={source}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One card                                                            */
/* ------------------------------------------------------------------ */

function FleetCard({
  satellite,
  readout,
  onOpen,
}: {
  satellite: TrackedSatellite;
  readout: SatelliteReadout;
  onOpen: () => void;
}) {
  const { element, member } = satellite;

  return (
    /*
      The whole card opens the record, and the control that does it is a
      button stretched over the card rather than a button wrapping it. That
      is not a detail: a <button> may only contain phrasing content, so
      wrapping the foot table would either force the table out of a <dl> —
      losing the label/value semantics a screen reader reads it by — or
      produce markup no parser is required to honour. The overlay keeps both
      the real table and one 100%-sized target, and the house
      `:focus-visible` outline lands on the card edge because the button is
      the card edge.
    */
    <li className="group relative flex flex-col border border-hairline-soft bg-deck px-3.5 py-3 transition-house hover:border-hairline min-[1920px]:px-4 min-[1920px]:py-3.5">
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={`Open the full record for ${member.name}`}
        className="absolute inset-0 z-10 cursor-pointer"
      />

      {/* Head — name left, expand glyph right. */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-heading ink">{member.name}</h3>
        <ExpandGlyph className="mt-0.5 ink-faint transition-house group-hover:ink" />
      </div>

      {/* The object. Centred, and given every pixel between the name and the
          table, which is where the reference puts its render. */}
      <div className="flex flex-1 items-start justify-center pt-4 pb-6 min-[1280px]:pt-5">
        <OrbitFigure
          inclination={readout.inclination}
          phase={readout.phase}
          periodMinutes={readout.periodMinutes}
          altitudeKm={readout.altitudeKm}
          subLatitude={readout.latitude}
          subLongitude={readout.longitude}
          size={240}
          /* The figure grows with the card at the two widest steps. A 240px
             drawing centred in a 475px card at 2400 reads as a stamp on a
             sheet; the object is supposed to be the card. */
          className="h-auto w-full max-w-[240px] min-[1920px]:max-w-[300px] min-[2400px]:max-w-[340px]"
        />
      </div>

      {/* Foot — the ruled label/value table. Their anatomy, our fields: not
          a launch class and a payload, but who flies it, what its orbit is
          doing this second and how finely it sees. */}
      <dl className="mt-auto grid grid-cols-[0.85fr_1fr]">
        <TableRow label="Operator" value={member.operator} />
        <TableRow label="NORAD" value={String(element.NORAD_CAT_ID)} telemetry />
        <TableRow label="Inclination" value={`${fixed(readout.inclination, 2)}°`} telemetry />
        <TableRow label="Period" value={`${fixed(readout.periodMinutes, 1)} min`} telemetry />
        <TableRow
          label="Altitude"
          value={readout.altitudeKm === null ? '—' : `${fixed(readout.altitudeKm, 0)} km`}
          telemetry
        />
        <TableRow label="Ground sample" value={member.gsd} />
        <TableRow label="Access" value={member.access} last />
      </dl>

      {/* The one live line on the face of the card. It changes every second,
          which is the whole argument for the card existing — so it sits
          below the ruled table rather than inside it, and takes the accent,
          which on this site marks exactly one thing: what is live.

          `data-subpoint` is a test hook. It is the handle a browser test
          grabs to sample this value, wait, and sample it again — the only
          way to prove from outside that these cards are propagating rather
          than printing a constant. */}
      <p className="mt-3 flex items-baseline justify-between gap-3">
        <span className="font-mono text-tele-xs uppercase ink-faint">Sub-point</span>
        <span
          data-telemetry
          data-subpoint={element.NORAD_CAT_ID}
          className="font-mono text-tele-s uppercase text-[color:var(--accent)]"
        >
          {subPointLabel(readout.latitude, readout.longitude)}
        </span>
      </p>
    </li>
  );
}

/**
 * One ruled row of the foot table.
 *
 * The reference's construction exactly: two cells on a `0.85fr 1fr` split,
 * each carrying its own bottom rule so the rules run edge to edge across the
 * card rather than stopping at a gutter, monospace at telemetry size on both
 * sides. Only the last row drops its rule, so the table ends on the card's
 * own padding instead of on a line.
 */
function TableRow({
  label,
  value,
  telemetry = false,
  last = false,
}: {
  label: string;
  value: string;
  telemetry?: boolean;
  last?: boolean;
}) {
  const cell = cn('py-1.5', last ? undefined : 'border-b rule-ground');
  return (
    <>
      <dt className={cn(cell, 'font-mono text-tele-xs uppercase ink-faint')}>{label}</dt>
      <dd
        data-telemetry={telemetry ? '' : undefined}
        className={cn(cell, 'font-mono text-tele-xs uppercase ink')}
      >
        {value}
      </dd>
    </>
  );
}

/** Four corner brackets opening outward. The card's "there is more here". */
function ExpandGlyph({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden
      className={cn('block shrink-0', className)}
    >
      <g stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <path d="M7 2.5H2.5V7" />
        <path d="M11 2.5H15.5V7" />
        <path d="M11 15.5H15.5V11" />
        <path d="M7 15.5H2.5V11" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Provenance                                                          */
/* ------------------------------------------------------------------ */

/**
 * Who published these numbers, when, and how stale the worst of them is.
 *
 * Not a footnote to be trimmed. A band that draws eight moving satellites
 * has to say that the movement is a propagation of published elements rather
 * than a live downlink, and it has to name the oldest element set on screen —
 * that is the one setting the error bar on everything above it.
 */
function SourceLine({
  readouts,
  source,
}: {
  readouts: { readout: SatelliteReadout }[];
  source: 'live' | 'snapshot';
}) {
  const oldest = readouts.reduce((max, r) => Math.max(max, r.readout.elementAgeHours), 0);

  /*
    `reduce(..., 0)` has a seed, and with an empty fleet the seed is what gets
    printed: measured, with the Orbital elements adapter forced to return no
    elements, this line read "The oldest element set shown was fitted 0 min
    ago" — a freshness claim about a set that was not there — above a grid
    with no cards in it. WAVE.md §2. State the outage instead.
  */
  if (readouts.length === 0) {
    return (
      <p className="mt-6 max-w-[86ch] text-note ink-faint">
        Orbital elements are published by{' '}
        <a
          href="https://celestrak.org"
          target="_blank"
          rel="noreferrer noopener"
          className="link-underline ink-dim transition-house hover:ink"
        >
          Orbital elements
        </a>
        , and none reached this page — the live request did not complete and no bundled set was
        available. Nothing is shown rather than estimated: every figure on these cards is an SGP4
        propagation of a real published element set, and without one there is no figure to give.
      </p>
    );
  }

  return (
    <p className="mt-6 max-w-[86ch] text-note ink-faint">
      Orbital elements published by{' '}
      <a
        href="https://celestrak.org"
        target="_blank"
        rel="noreferrer noopener"
        className="link-underline ink-dim transition-house hover:ink"
      >
        Orbital elements
      </a>
      {source === 'live'
        ? ', fetched directly and refreshed every three hours.'
        : ', from a set bundled with this build — the live request did not complete.'}{' '}
      Positions are SGP4 propagations of those elements, computed in your browser, not
      telemetry: no one is downlinking to this page. The oldest element set shown was fitted{' '}
      <span data-telemetry>{ageLabel(oldest)}</span> ago, and accuracy degrades as that age
      grows.
    </p>
  );
}
