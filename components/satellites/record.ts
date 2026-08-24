import type { GpElement } from '@/lib/integrations/celestrak';
import { fleetMember, FLEET, type FleetMember } from '@/lib/satellites/fleet';
import {
  elementAgeHours,
  epochDate,
  periodMinutes,
  subPointAt,
  toSatrec,
} from '@/lib/satellites/propagate';

/**
 * ONE SATELLITE'S RECORD — the shape the fleet band and its popup both read.
 *
 * Everything numeric here is DERIVED from the CelesTrak element set at the
 * instant it is asked for. Nothing is stored, nothing is cached per-value and
 * nothing is copied out of `fleet.ts` except the three facts that file is the
 * authority for: who flies it, what it is for, and its published ground
 * sample distance. That separation is the reason the card and the popup can
 * never disagree — they are two renderings of one computation.
 */

/** A satellite whose elements parsed. Anything else never reaches a card. */
export type TrackedSatellite = {
  element: GpElement;
  member: FleetMember;
  rec: NonNullable<ReturnType<typeof toSatrec>>;
};

/**
 * Elements -> the tracked fleet, in the order `fleet.ts` lists them.
 *
 * CelesTrak serves catalogue order; the author's order in `fleet.ts` runs
 * sharpest sensor first, which is the order a reader buying resolution wants
 * to read the fleet in. Objects with unusable elements (a decayed satellite,
 * an out-of-range eccentricity) are dropped rather than drawn as a hole.
 */
export function trackFleet(elements: GpElement[]): TrackedSatellite[] {
  return elements
    .map((element) => {
      const member = fleetMember(element.NORAD_CAT_ID);
      const rec = toSatrec(element);
      return member && rec ? { element, member, rec } : null;
    })
    .filter((v): v is TrackedSatellite => v !== null)
    .sort((a, b) => FLEET.indexOf(a.member) - FLEET.indexOf(b.member));
}

/** Everything the card and the popup print, at one instant. */
export type SatelliteReadout = {
  /** Null when SGP4 declines to propagate these elements to this instant. */
  latitude: number | null;
  longitude: number | null;
  altitudeKm: number | null;
  speedKmS: number | null;
  /** Minutes for one revolution, from the mean motion. */
  periodMinutes: number;
  /** Degrees. */
  inclination: number;
  /** Hours since the element set was fitted. Grows until CelesTrak refits. */
  elementAgeHours: number;
  /** The fit epoch itself. */
  epoch: Date;
  /** 0..1 around the orbit — the mean anomaly advanced to `now`. */
  phase: number;
};

export function readSatellite(sat: TrackedSatellite, now: Date): SatelliteReadout {
  const point = subPointAt(sat.rec, now);
  const period = periodMinutes(sat.element);
  const epoch = epochDate(sat.element);

  // Mean anomaly advanced to `now`, as a fraction of one revolution. A real
  // phase, not an animation loop: it is where the satellite is in its
  // revolution, and it is what places the marker on the orbit figure.
  const minutesSinceEpoch = (now.getTime() - epoch.getTime()) / 60_000;
  const phase =
    period > 0 ? (((sat.element.MEAN_ANOMALY / 360 + minutesSinceEpoch / period) % 1) + 1) % 1 : 0;

  return {
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    altitudeKm: point?.altitudeKm ?? null,
    speedKmS: point?.speedKmS ?? null,
    periodMinutes: period,
    inclination: sat.element.INCLINATION,
    elementAgeHours: elementAgeHours(sat.element, now),
    epoch,
    phase,
  };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/*
 * Every formatter below is LOCALE-FREE, and that is not a style preference.
 * `toLocaleString` reads the host's locale and time zone, so a server in UTC
 * and a browser in Bucharest produce different strings for the same value —
 * which React reports as a hydration mismatch on the first paint of any page
 * carrying these cards. `toFixed` and manual assembly cannot disagree.
 */

/** A number to fixed places, or an em dash when there is nothing to print. */
export function fixed(value: number | null, places: number): string {
  return value !== null && Number.isFinite(value) ? value.toFixed(places) : '—';
}

/** `48.86° N` — hemisphere as a letter, never a minus sign. */
function latitudeLabel(value: number | null, places = 2): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${Math.abs(value).toFixed(places)}° ${value >= 0 ? 'N' : 'S'}`;
}

/** `2.35° E` — the same, east positive. */
function longitudeLabel(value: number | null, places = 2): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${Math.abs(value).toFixed(places)}° ${value >= 0 ? 'E' : 'W'}`;
}

/** Both halves of a sub-point on one line. */
export function subPointLabel(
  latitude: number | null,
  longitude: number | null,
  places = 2,
): string {
  if (latitude === null || longitude === null) return 'Not propagatable';
  return `${latitudeLabel(latitude, places)} · ${longitudeLabel(longitude, places)}`;
}

/**
 * How old an element set is, in the coarsest unit that is still honest.
 *
 * Minutes under an hour, hours to two days, days after that. Element age is
 * printed everywhere a position is, because SGP4 error grows with it — about
 * a kilometre a day in low Earth orbit — and a sub-point given to two
 * decimals off four-day-old elements is a precision nobody has.
 */
export function ageLabel(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return 'an unknown time';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** `21 Aug 2026 · 15:26 UTC`. Assembled from UTC parts, never localised. */
export function utcLabel(date: Date): string {
  if (Number.isNaN(date.getTime())) return '—';
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = MONTHS[date.getUTCMonth()];
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  return `${dd} ${mm} ${date.getUTCFullYear()} · ${hh}:${mi} UTC`;
}
