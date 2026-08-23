'use client';

import { useMemo } from 'react';
import type { GpElement } from '@/lib/integrations/celestrak';
import { FLEET, fleetMember, type FleetMember } from '@/lib/satellites/fleet';
import {
  elementAgeHours,
  epochDate,
  lookAngleAt,
  nextPass,
  periodMinutes,
  subPointAt,
  toSatrec,
  type Observer,
} from '@/lib/satellites/propagate';
import { OrbitGlyph } from './OrbitGlyph';
import { useLiveClock } from './useLiveClock';

/**
 * FLEET TRACKER — where the imaging satellites are, right now.
 *
 * Eight real spacecraft, propagated in the browser once a second from the
 * element sets the server fetched from CelesTrak. The elements are requested
 * at most once every three hours; the POSITIONS move every second, because
 * SGP4 runs locally against a fixed element set. The readout is live without
 * the network being touched again.
 *
 * ------------------------------------------------------------------------
 * THE CLAIM THIS COMPONENT IS ALLOWED TO MAKE
 * ------------------------------------------------------------------------
 * "These are Earth-observation satellites in orbit, and this is where they
 * are." That is all, and the copy around it must not drift.
 *
 * It is NOT a picture of the satellite assigned to a mission. Tasking goes
 * through SkyFi, which picks a provider and a spacecraft against the window,
 * the cloud forecast and the resolution ordered; the result is very often
 * none of these eight, and the file never names one. A tracker sitting on a
 * mission page implies a link, so the section copy states the absence of one
 * outright rather than letting adjacency do the arguing.
 *
 * It is also NOT telemetry. Nobody downlinks a position here. Every card
 * prints the age of the element set it is propagating from, because SGP4
 * error grows with that age, and a sub-point given to two decimals off
 * four-day-old elements is a false precision.
 *
 * ------------------------------------------------------------------------
 * HYDRATION
 * ------------------------------------------------------------------------
 * The clock is seeded with the server's instant, so the first client render
 * is byte-identical to the server markup; the tick only starts in an effect.
 * Every number is formatted with `toFixed`, never a locale formatter, for the
 * same reason — `toLocaleString` disagrees between a server in UTC and a
 * browser in Bucharest, and the disagreement surfaces as a hydration error.
 */
export function FleetTracker({
  elements,
  source,
  serverNow,
  observer,
  observerLabel,
  className,
}: {
  elements: GpElement[];
  source: 'live' | 'snapshot';
  /** The server's instant, ISO. Seeds the clock so hydration matches. */
  serverNow: string;
  /** Supply to add sky position over a target — the mission-page variant. */
  observer?: Observer;
  /** What the observer is, e.g. `the target`. Printed in the readout. */
  observerLabel?: string;
  className?: string;
}) {
  const now = useLiveClock(serverNow);

  // Element sets change every few hours; parsing them is not free and must
  // not happen on every tick.
  const tracked = useMemo(() => {
    return elements
      .map((element) => {
        const member = fleetMember(element.NORAD_CAT_ID);
        const rec = toSatrec(element);
        return member && rec ? { element, member, rec } : null;
      })
      .filter((v): v is { element: GpElement; member: FleetMember; rec: NonNullable<ReturnType<typeof toSatrec>> } => v !== null)
      // Keep the author's order in fleet.ts, not CelesTrak's catalogue order.
      .sort((a, b) => FLEET.indexOf(a.member) - FLEET.indexOf(b.member));
  }, [elements]);

  /**
   * Pass prediction is a search — up to 1440 propagations per satellite — so
   * it is keyed to the minute, not the second. Recomputing it at 1 Hz would
   * burn a core to move a countdown that only ever changes once a minute.
   */
  const minuteKey = Math.floor(now.getTime() / 60_000);
  const passes = useMemo(() => {
    if (!observer) return null;
    const at = new Date(minuteKey * 60_000);
    const out = new Map<number, { rises: Date; peakElevation: number } | null>();
    for (const t of tracked) out.set(t.element.NORAD_CAT_ID, nextPass(t.rec, at, observer));
    return out;
    // `observer` is a plain object rebuilt by the parent each render, so it is
    // spread into primitives to key on identity of VALUE, not of reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracked, minuteKey, observer?.latitude, observer?.longitude]);

  return (
    <div className={className}>
      <ul className="grid grid-cols-1 gap-px border-t border-hairline bg-hairline min-[768px]:grid-cols-2 min-[1440px]:grid-cols-4">
        {tracked.map(({ element, member, rec }) => (
          <SatelliteCard
            key={element.NORAD_CAT_ID}
            element={element}
            member={member}
            rec={rec}
            now={now}
            observer={observer}
            observerLabel={observerLabel}
            pass={passes?.get(element.NORAD_CAT_ID) ?? null}
          />
        ))}
      </ul>

      <SourceLine elements={elements} source={source} now={now} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One satellite                                                       */
/* ------------------------------------------------------------------ */

function SatelliteCard({
  element,
  member,
  rec,
  now,
  observer,
  observerLabel,
  pass,
}: {
  element: GpElement;
  member: FleetMember;
  rec: NonNullable<ReturnType<typeof toSatrec>>;
  now: Date;
  observer?: Observer;
  observerLabel?: string;
  pass: { rises: Date; peakElevation: number } | null;
}) {
  const point = subPointAt(rec, now);
  const look = observer ? lookAngleAt(rec, now, observer) : null;
  const period = periodMinutes(element);
  const ageHours = elementAgeHours(element, now);

  // Mean anomaly advanced to now, as a fraction of one revolution. This is
  // the glyph's dot position: a real phase, not an animation.
  const minutesSinceEpoch = (now.getTime() - epochDate(element).getTime()) / 60_000;
  const phase =
    period > 0
      ? (((element.MEAN_ANOMALY / 360 + minutesSinceEpoch / period) % 1) + 1) % 1
      : 0;

  const overhead = look !== null && look.elevation >= 10;

  return (
    <li className="surface-dark relative flex flex-col gap-6 bg-void p-6 xl:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-action text-paper">{member.name}</h3>
          <p className="mt-1.5 font-mono text-tele-xs uppercase text-paper-faint">
            {member.operator} · NORAD {element.NORAD_CAT_ID}
          </p>
        </div>
        <OrbitGlyph
          inclination={element.INCLINATION}
          phase={phase}
          className={overhead ? 'text-accent' : 'text-paper-dim'}
        />
      </div>

      {/* The live block. `data-telemetry` is the house tabular-figure hook —
          without it every digit change reflows the row by a pixel or two and
          the whole card jitters once a second. */}
      <dl className="flex flex-col gap-2.5">
        <Row
          label="Sub-point"
          value={
            point
              ? `${fixed(Math.abs(point.latitude), 2)}° ${point.latitude >= 0 ? 'N' : 'S'}  ${fixed(Math.abs(point.longitude), 2)}° ${point.longitude >= 0 ? 'E' : 'W'}`
              : 'Not propagatable'
          }
        />
        <Row label="Altitude" value={point ? `${fixed(point.altitudeKm, 0)} km` : '—'} />
        <Row label="Speed" value={point ? `${fixed(point.speedKmS, 2)} km/s` : '—'} />
        <Row label="Inclination" value={`${fixed(element.INCLINATION, 2)}°`} />
        <Row label="Period" value={`${fixed(period, 1)} min`} />
        <Row label="Resolution" value={member.gsd} />
      </dl>

      {/* Mission-page only: where this satellite is in the target's sky. */}
      {observer ? (
        <div className="border-t border-hairline pt-4">
          {overhead && look ? (
            <p className="font-mono text-tele-xs uppercase text-accent">
              Above {observerLabel ?? 'the target'} — {fixed(look.elevation, 0)}° elevation
            </p>
          ) : (
            <p className="font-mono text-tele-xs uppercase text-paper-faint">
              {pass
                ? `Rises over ${observerLabel ?? 'the target'} in ${untilLabel(pass.rises, now)} · peak ${fixed(pass.peakElevation, 0)}°`
                : `No pass over ${observerLabel ?? 'the target'} in the next 24 hours`}
            </p>
          )}
        </div>
      ) : null}

      <p className="mt-auto text-note text-paper-faint">
        {member.role}
        <br />
        <span className="font-mono text-tele-xs uppercase">
          {member.access} · elements {ageLabel(ageHours)} old
        </span>
      </p>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="font-mono text-tele-xs uppercase text-paper-faint">{label}</dt>
      <dd data-telemetry className="font-mono text-tele-s text-paper">
        {value}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Provenance                                                          */
/* ------------------------------------------------------------------ */

/**
 * Who published these numbers, when, and how stale the worst of them is.
 *
 * Not a footnote to be trimmed. A page that draws eight moving satellites
 * has to say that the movement is a propagation of published elements rather
 * than a live downlink, and it has to name the oldest element set on screen —
 * that is the one setting the error bar on everything above.
 */
function SourceLine({
  elements,
  source,
  now,
}: {
  elements: GpElement[];
  source: 'live' | 'snapshot';
  now: Date;
}) {
  const oldest = elements.reduce((max, e) => Math.max(max, elementAgeHours(e, now)), 0);

  return (
    <p className="mt-6 max-w-[86ch] text-note text-paper-faint">
      Orbital elements published by{' '}
      <a
        href="https://celestrak.org"
        target="_blank"
        rel="noreferrer noopener"
        className="link-underline text-paper-dim hover:text-paper"
      >
        CelesTrak
      </a>
      {source === 'live'
        ? ', fetched directly and refreshed every three hours.'
        : ', from a set bundled with this build — the live request did not complete.'}{' '}
      Positions are SGP4 propagations of those elements, computed in your browser, not
      telemetry: no one is downlinking to this page. The oldest element set shown was fitted{' '}
      {ageLabel(oldest)} ago, and accuracy degrades as that age grows.
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Locale-free, so the server and the client always produce the same string. */
function fixed(value: number, places: number): string {
  return Number.isFinite(value) ? value.toFixed(places) : '—';
}

function ageLabel(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return 'an unknown time';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

function untilLabel(when: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((when.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/* The one-second clock lives in `./useLiveClock` — <FleetBand /> on the
   landing page runs off the same hook. */
