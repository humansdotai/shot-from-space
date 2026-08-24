import type { GpElement } from '@/lib/integrations/celestrak';
import type { FleetMember } from '@/lib/satellites/fleet';
import type { SubPoint } from '@/lib/satellites/propagate';
import { EARTH_RADIUS_KM } from './projection';

/**
 * THE CARD — the live record of one spacecraft, opened by hovering its marker.
 *
 * Named RecordPanel rather than SatelliteRecord because `components/satellites`
 * carries a component of that name for the card grid; this one is the globe's
 * side panel and the two must not be confused at an import site.
 *
 * Six values and no more (CONTRACT.md §2, the density rule), every one of
 * them computed from the element set by SGP4 at the instant printed above the
 * globe. Nothing here is stored, guessed or rounded up from a brochure — with
 * the single exception of `gsd`, which is the operator's published figure and
 * is the one number `lib/satellites/fleet.ts` flags as taken on trust.
 *
 * The card also prints the age of the element set it was propagated from,
 * because SGP4 error grows with that age and a sub-point given to two
 * decimals off four-day-old elements is a false precision.
 */
export function RecordPanel({
  member,
  element,
  point,
  periodMin,
  ageHours,
}: {
  member: FleetMember;
  element: GpElement;
  point: SubPoint | null;
  periodMin: number;
  ageHours: number;
}) {
  return (
    <div>
      <p className="font-mono text-tele-xs uppercase ink-faint">
        {member.operator} · NORAD {element.NORAD_CAT_ID}
      </p>
      <h3 className="mt-1.5 text-action ink">{member.name}</h3>

      <dl className="mt-5 flex flex-col gap-2.5">
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
        <Row label="Period" value={`${fixed(periodMin, 1)} min`} />
        <Row label="Resolution" value={member.gsd} />
      </dl>

      {/*
        The scale statement, and it is a claim the drawing can be checked
        against: the marker sits at 1 + altitude/6371 Earth radii from the
        centre of the disc, so the tick under it is the altitude at the same
        scale as the globe. Printing the ratio is what stops the picture
        drifting from the number beside it.
      */}
      <p className="mt-5 border-t rule-ground pt-4 text-note ink-faint">
        {member.role}
        <br />
        <span className="font-mono text-tele-xs uppercase">
          {member.access} · elements {ageLabel(ageHours)} old
          {/* Its own line, because it is its own claim — and because letting
              it wrap mid-phrase leaves `EARTH RADII` orphaned. */}
          {point ? (
            <>
              <br />
              Drawn at {(1 + point.altitudeKm / EARTH_RADIUS_KM).toFixed(3)} Earth radii
            </>
          ) : null}
        </span>
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="font-mono text-tele-xs uppercase ink-faint">{label}</dt>
      <dd data-telemetry className="font-mono text-tele-s ink">
        {value}
      </dd>
    </div>
  );
}

/** Locale-free, so the server and the client always produce the same string. */
export function fixed(value: number, places: number): string {
  return Number.isFinite(value) ? value.toFixed(places) : '—';
}

export function ageLabel(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return 'an unknown time';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}
