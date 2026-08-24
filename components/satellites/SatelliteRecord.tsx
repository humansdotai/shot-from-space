'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { OrbitFigure } from './OrbitFigure';
import {
  ageLabel,
  fixed,
  subPointLabel,
  utcLabel,
  type SatelliteReadout,
  type TrackedSatellite,
} from './record';

/**
 * THE SATELLITE RECORD — the popup behind a fleet card.
 *
 * One spacecraft, everything this site can honestly say about it, and its
 * orbit drawn at four times the size the card draws it. The structure is the
 * reference's detail view: a record column and a figure column side by side,
 * the figure sticky, the whole thing a modal over a dimmed page. The colours,
 * the type roles and the rules are ours.
 *
 * ------------------------------------------------------------------------
 * WHAT IT IS ALLOWED TO SAY
 * ------------------------------------------------------------------------
 * Two claims, and no third:
 *
 *   · "This is a real Earth-observation satellite, and this is where an
 *     SGP4 propagation of its published elements puts it right now."
 *   · "This is the ground sample distance its operator publishes."
 *
 * It does NOT say this satellite will fly anybody's mission. Tasking is
 * brokered at capture time against the window, the weather and the
 * resolution ordered, and the spacecraft that flies a given order is very
 * often none of these eight. The footnote in this panel says so in words,
 * because a detailed record of one named satellite inside a shop is exactly
 * the surface where a reader would otherwise assume the link.
 *
 * Every position readout is accompanied by the age of the element set it was
 * computed from, and by whether that set came from CelesTrak this session or
 * from the copy bundled with the build. A page that quietly draws month-old
 * elements as though they were live is the failure this panel exists to
 * refuse.
 *
 * ------------------------------------------------------------------------
 * DIALOG BEHAVIOUR
 * ------------------------------------------------------------------------
 * `role="dialog"` + `aria-modal`, labelled by the satellite's name. Focus
 * moves to the close control on open, Tab is trapped inside the panel,
 * Escape closes, the page behind is locked from scrolling, and focus is
 * restored to the card that opened it on close — the card, not the top of
 * the document, so a keyboard reader carries on from where they were.
 *
 * The close control is 44 x 44 and the panel reserves
 * `env(safe-area-inset-bottom)`, because on a phone this is a full-height
 * sheet and the last row of the record would otherwise sit under the home
 * indicator.
 */
export function SatelliteRecord({
  satellite,
  readout,
  source,
  onClose,
}: {
  satellite: TrackedSatellite;
  readout: SatelliteReadout;
  /** Where the element set came from. Printed, never assumed. */
  source: 'live' | 'snapshot';
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // `onClose` is a fresh closure on every parent render, and this panel
  // re-renders once a second with the clock. Holding it in a ref lets the
  // focus-trap effect run exactly once — otherwise its cleanup would restore
  // focus to the card on every tick.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const close = useCallback(() => closeRef.current(), []);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('[data-autofocus]')?.focus();

    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && (active === first || !panel?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  const { element, member } = satellite;
  const titleId = `satellite-record-${element.NORAD_CAT_ID}`;

  return (
    <div
      className="fixed inset-0 z-[70] flex justify-center bg-void/92 min-[768px]:p-8 min-[1280px]:p-10"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'surface-dark relative flex w-full max-w-[1180px] flex-col overflow-y-auto',
          'border-hairline bg-void min-[768px]:rounded-card min-[768px]:border',
        )}
      >
        {/* ---- Header. Sticky, so the name and the way out stay put on a
                long scroll — which on a phone this record always is. ---- */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-hairline bg-void px-4 py-3 min-[768px]:px-6 min-[768px]:py-4 min-[1280px]:px-8">
          <div className="min-w-0">
            <h2 id={titleId} className="text-heading ink">
              {member.name}
            </h2>
            <p className="mt-2 font-mono text-tele-xs uppercase ink-faint">
              {member.operator} · NORAD {element.NORAD_CAT_ID} · {member.access}
            </p>
          </div>

          <button
            type="button"
            data-autofocus
            onClick={close}
            aria-label={`Close the record for ${member.name}`}
            className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center ink-faint transition-house hover:ink"
          >
            <CloseGlyph />
          </button>
        </div>

        {/* ---- Body: record left, figure right. -------------------------- */}
        <div className="flex flex-col gap-10 px-4 pt-6 pb-8 min-[768px]:px-6 min-[1024px]:flex-row min-[1024px]:gap-10 min-[1280px]:px-8 min-[1280px]:pt-8 min-[1280px]:pb-10">
          {/* The record. */}
          <div className="min-w-0 flex-1">
            {/* What it images — the one sentence `fleet.ts` is the authority
                for, marked the way the reference marks a tagline. */}
            <div className="flex items-center gap-4">
              <span aria-hidden className="size-[5px] shrink-0 bg-[color:var(--accent)]" />
              <h3 className="font-mono text-tele-s uppercase ink-dim">What it images</h3>
            </div>
            <p className="mt-5 max-w-[52ch] text-body ink">{member.role}</p>
            <p className="mt-3 max-w-[52ch] text-note ink-dim">
              Its operator publishes a ground sample distance of {member.gsd} at nadir — the
              width of one pixel on the ground when the sensor is looking straight down. That
              figure is the operator&rsquo;s, not a measurement made here.
            </p>

            {/* The live pair, given the most room. */}
            <dl className="mt-10 grid grid-cols-1 gap-8 min-[560px]:grid-cols-2">
              {/* Three decimals here against the card's two: the popup is
                  where somebody has come to read the number, and 0.001 deg
                  is about 110 m — still coarser than the propagation's own
                  error, so it is precision the model can carry. */}
              <Stat
                label="Sub-satellite point"
                value={subPointLabel(readout.latitude, readout.longitude, 3)}
                telemetry
              />
              <Stat
                label="Altitude"
                value={`${fixed(readout.altitudeKm, 1)} km`}
                telemetry
              />
            </dl>

            <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-8 min-[1024px]:grid-cols-4">
              <Stat label="Speed" value={`${fixed(readout.speedKmS, 3)} km/s`} telemetry />
              <Stat
                label="Period"
                value={`${fixed(readout.periodMinutes, 1)} min`}
                telemetry
              />
              <Stat
                label="Inclination"
                value={`${fixed(readout.inclination, 3)}°`}
                telemetry
              />
              <Stat label="Ground sample" value={member.gsd} telemetry />
            </dl>

            <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-8 min-[1024px]:grid-cols-4">
              <Stat label="Operator" value={member.operator} telemetry />
              <Stat label="NORAD id" value={String(element.NORAD_CAT_ID)} telemetry />
              <Stat label="Access" value={member.access} telemetry />
              <Stat label="Element age" value={ageLabel(readout.elementAgeHours)} telemetry />
            </dl>

            <dl className="mt-8 grid grid-cols-1 gap-8 min-[560px]:grid-cols-2">
              <Stat label="Element epoch" value={utcLabel(readout.epoch)} telemetry />
              <Stat
                label="Element source"
                value={
                  source === 'live'
                    ? 'CelesTrak, fetched for this page'
                    : 'Bundled with this build — the live request did not complete'
                }
              />
            </dl>

            {/* ---- The footnote. Not trimmable. ---- */}
            <div className="mt-10 border-t border-hairline pt-6">
              <p className="max-w-[68ch] text-note ink-faint">
                These numbers are an SGP4 propagation of published orbital elements, computed
                in your browser. Nobody is downlinking a position to this page, and the error
                of a propagation grows with the age of the elements it runs from — which is
                why that age is printed above rather than hidden.{' '}
                {source === 'live'
                  ? 'This set came from CelesTrak during this page load.'
                  : 'This set is the copy bundled with the build, because the live request did not complete.'}
              </p>
              <p className="mt-4 max-w-[68ch] text-note ink-faint">
                {member.name} is not assigned to any mission ordered here. Tasking is brokered
                at capture time against the window, the cloud forecast and the resolution
                ordered, and the spacecraft that flies a given order is very often none of the
                eight this site tracks. What this record shows is simply what is overhead.
              </p>
              <p className="mt-4 max-w-[68ch] text-note ink-faint">
                Orbital elements published by{' '}
                <a
                  href="https://celestrak.org"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="link-underline ink-dim transition-house hover:ink"
                >
                  CelesTrak
                </a>
                , data by Dr T.S. Kelso.
              </p>
            </div>
          </div>

          {/* The figure. Sticky on a wide viewport, exactly as the reference
              pins its detail imagery; a plain block on a phone, where there
              is nothing to stick to. */}
          <div className="shrink-0 min-[1024px]:basis-[420px] min-[1440px]:basis-[480px]">
            <div className="min-[1024px]:sticky min-[1024px]:top-6">
              <div className="flex justify-center border-t border-hairline pt-8 min-[1024px]:border-t-0 min-[1024px]:pt-0">
                <OrbitFigure
                  inclination={readout.inclination}
                  phase={readout.phase}
                  periodMinutes={readout.periodMinutes}
                  altitudeKm={readout.altitudeKm}
                  subLatitude={readout.latitude}
                  subLongitude={readout.longitude}
                  size={380}
                  className="h-auto w-full max-w-[280px] min-[768px]:max-w-[380px]"
                />
              </div>

              <dl className="mt-6 flex flex-col gap-2.5">
                <Legend
                  term="Ring"
                  detail={`Drawn to scale: ${fixed(readout.altitudeKm, 0)} km above a 6,378 km Earth radius, tilted by the orbit's ${fixed(readout.inclination, 2)}° inclination.`}
                />
                <Legend
                  term="Marker"
                  detail="The propagated position now — filled while the satellite is on the near side of the planet, hollow while it is round the back. The trail behind it is the last half hour of travel, sampled every three minutes."
                />
                <Legend
                  term="Globe"
                  detail="Turned to the sub-satellite longitude, so the tick on the centre meridian is the point on Earth directly underneath."
                />
                <Legend
                  term="Sweeping tick"
                  detail="A direction indicator on a fixed twenty-second loop. It is not a position, and it is removed under reduced motion."
                />
              </dl>
            </div>
          </div>
        </div>

        {/* The sheet runs to the bottom edge on a phone; the home indicator
            must not sit on top of the last line of the record. */}
        <div aria-hidden className="h-[env(safe-area-inset-bottom)] min-[768px]:hidden" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/**
 * One field. The reference's stat cell: a rule over the top, a small mono
 * label, a 14px gap, then the value. `data-telemetry` gives numeric values
 * tabular figures, without which every digit change nudges the row sideways
 * and the whole panel jitters once a second.
 */
function Stat({
  label,
  value,
  telemetry = false,
}: {
  label: string;
  value: ReactNode;
  telemetry?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-3.5 border-t rule-ground pt-2.5">
      <dt className="font-mono text-tele-xs uppercase ink-faint">{label}</dt>
      <dd
        data-telemetry={telemetry ? '' : undefined}
        className={cn(
          'min-w-0',
          telemetry ? 'font-mono text-tele-s uppercase ink' : 'text-note ink',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** A line of the figure's key. Reads as a definition list, because it is one. */
function Legend({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex gap-3">
      {/* `pt-1` optically seats the 9px mono term on the first line of
          the 13px note beside it; without it the term rides high. */}
      <dt className="w-[7.5rem] shrink-0 pt-1 font-mono text-tele-xs uppercase ink-faint">
        {term}
      </dt>
      <dd className="min-w-0 text-note ink-dim">{detail}</dd>
    </div>
  );
}

/** Four corner brackets folding inward — the collapse of the card's expand. */
function CloseGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className="block">
      <g stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <path d="M2 6.5H6.5V2" />
        <path d="M16 6.5H11.5V2" />
        <path d="M16 11.5H11.5V16" />
        <path d="M2 11.5H6.5V16" />
      </g>
    </svg>
  );
}
