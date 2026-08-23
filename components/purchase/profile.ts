/**
 * PURCHASE — the mission brief.
 *
 * The brief is the artifact the briefing builds toward: the reader's own
 * mission, assembled from what they have already told us and handed over
 * before anything is asked for. Everything in it is either a value they
 * entered, a value derived from the catalogue, or a value computed from the
 * two — the schedule from the pipeline's published timings, the pass geometry
 * from the NOAA solar algorithm applied to their own latitude and longitude.
 *
 * NOTHING HERE IS INVENTED. Each field below carries the file it comes from.
 * If a number cannot be traced to one of those, it does not belong on this
 * screen — a $640 print is bought by people who check. That rule is also why
 * the brief carries no mission code: the code is minted by the server when
 * the order is opened, so the brief says where it comes from rather than
 * printing a number that will not match the one on the file.
 *
 * The one thing this file must never do is pretend to know a date the
 * constellation operator has not yet returned. The window is therefore stated
 * as the range the pipeline's own timings produce, labelled as nominal, and
 * backed by the sixty-day refund that is written into /legal/terms.
 */

import { PRINT_FACILITY, getFormat } from '@/lib/pricing';
import { MATERIALS, PACKAGING, REFUND_WINDOW_DAYS } from '@/lib/guarantees';
import { compassPoint, solarPosition } from '@/lib/missions/conditions';
import { formatCoords, formatTelemetryDate } from '@/lib/utils';
import type { Quote, StartDraft } from './state';

/* ------------------------------------------------------------------ */
/* Schedule                                                            */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

/**
 * The pipeline's published timings, in days from authorisation. Every value
 * is the same one the rest of the product already states — this file is a
 * reader of the schedule, never an author of it.
 *
 *   acceptMin/Max   lib/integrations/email.ts — "tasking takes one to three
 *                   days to accept"
 *   openMin/Max     lib/missions/telemetry.ts — the collection window opens
 *                   2–5 days after tasking is accepted
 *   lengthMin/Max   lib/missions/telemetry.ts — and stays open 7–14 days,
 *                   which is what a revisit schedule over a single point
 *                   looks like at these inclinations
 *   fulfilMin/Max   lib/integrations/gelato.ts — production 1–2 days,
 *                   transit 3–7 days, so 4–9 days from an approved frame
 */
export const SCHEDULE = {
  acceptMin: 1,
  acceptMax: 3,
  openMin: 2,
  openMax: 5,
  lengthMin: 7,
  lengthMax: 14,
  fulfilMin: 4,
  fulfilMax: 9,
} as const;

export interface MissionSchedule {
  /** Tasking is filed with the operator inside this many hours. */
  taskingHours: number;
  windowOpensFrom: Date;
  windowOpensTo: Date;
  windowClosesBy: Date;
  deliveryFrom: Date;
  deliveryTo: Date;
}

function addDays(from: Date, days: number): Date {
  const d = new Date(from.getTime() + days * DAY_MS);
  // Dates are stated to the day, so the clock is normalised out of them.
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

/**
 * The nominal schedule for a mission authorised at `from`.
 *
 * Both ends of every range are carried: the earliest is what the pipeline
 * produces when every stage runs at its fastest, the latest when every stage
 * runs at its slowest. Neither is a promise on its own — the promise is the
 * sixty-day refund, which is stated beside them.
 */
export function missionSchedule(from: Date): MissionSchedule {
  const openFrom = SCHEDULE.acceptMin + SCHEDULE.openMin;
  const openTo = SCHEDULE.acceptMax + SCHEDULE.openMax;
  const closeBy = openTo + SCHEDULE.lengthMax;
  return {
    taskingHours: 24,
    windowOpensFrom: addDays(from, openFrom),
    windowOpensTo: addDays(from, openTo),
    windowClosesBy: addDays(from, closeBy),
    deliveryFrom: addDays(from, openFrom + SCHEDULE.fulfilMin),
    deliveryTo: addDays(from, closeBy + SCHEDULE.fulfilMax),
  };
}

/* ------------------------------------------------------------------ */
/* Pass geometry — computed, not seeded                                */
/* ------------------------------------------------------------------ */

/**
 * Sun-synchronous imaging constellations cross the descending node in the
 * mid-morning; lib/missions/telemetry.ts opens every capture window on that
 * node. 10:30 local apparent solar time is the nominal crossing this product
 * plans against, and it is the only assumed number in this file.
 */
export const NODE_SOLAR_MIN = 630;

export interface PassGeometry {
  /** `10:30` — local apparent solar time at the target's longitude. */
  solarTime: string;
  /** Sun elevation above the horizon at that instant, degrees. */
  sunElevationDeg: number;
  /** True bearing of the sun, degrees clockwise from north. */
  sunAzimuthDeg: number;
  /** 16-point compass abbreviation for the sun's bearing. */
  sunCompass: string;
  /** Where the shadows fall — the reciprocal of the sun's bearing. */
  shadowCompass: string;
  /** True when the sun sits too low for a usable optical frame. */
  lowSun: boolean;
  /** False when the sun has not risen at all at the node crossing. */
  sunUp: boolean;
}

/**
 * Where the sun stands over this target when the satellite crosses it.
 *
 * `solarPosition` takes UTC, so the instant whose local apparent solar time
 * is the descending node has to be solved for. Two corrections converge well
 * inside a minute: the residual is the equation of time's own drift across
 * the correction, which is under a second of arc at this scale.
 *
 * This is the field that makes the profile the buyer's rather than anyone
 * else's — a February window at 60° N returns a sun 10° up and long shadows;
 * the same window at 10° S returns a sun near the zenith.
 */
export function passGeometry(lat: number, lon: number, on: Date): PassGeometry {
  let at = new Date(Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate(), 12, 0, 0));
  let sun = solarPosition(at, lat, lon);
  for (let i = 0; i < 2; i++) {
    const driftMin = NODE_SOLAR_MIN - sun.solarTimeMin;
    at = new Date(at.getTime() + driftMin * 60_000);
    sun = solarPosition(at, lat, lon);
  }

  const hh = Math.floor(NODE_SOLAR_MIN / 60);
  const mm = NODE_SOLAR_MIN % 60;
  return {
    solarTime: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
    sunElevationDeg: Math.round(sun.elevationDeg * 10) / 10,
    sunAzimuthDeg: Math.round(sun.azimuthDeg),
    sunCompass: compassPoint(sun.azimuthDeg),
    shadowCompass: compassPoint(sun.azimuthDeg + 180),
    // Below about 15° the sun stops lighting the ground plane usefully and
    // the pipeline waits for a better pass rather than downlinking a frame.
    lowSun: sun.elevationDeg < 15,
    // A high-latitude target in winter can have no sun at all at the node
    // crossing. Saying "a low sun" there would be wrong, so it is separated.
    sunUp: sun.elevationDeg > 0,
  };
}

/* ------------------------------------------------------------------ */
/* The brief                                                           */
/* ------------------------------------------------------------------ */

export interface ProfileField {
  label: string;
  value: string;
  /** Coordinates and clock values only. */
  mono?: boolean;
  /** A second, quieter line under the value. */
  note?: string;
}

export interface ProfileSection {
  title: string;
  fields: ProfileField[];
}

export interface MissionBriefData {
  /** `MISSION / LOS ANGELES` — the brief's name, taken from the target. */
  designation: string;
  /** `221B BAKER STREET` — the street line, uppercased for the readout. */
  street: string;
  /** `LONDON / ENGLAND / W1U 6SG / UNITED KINGDOM` */
  place: string;
  coords: string;
  schedule: MissionSchedule;
  geometry: PassGeometry;
  sections: ProfileSection[];
}

/**
 * Assemble the brief from the target and the moment it is read.
 *
 * There is no price and no format in here on purpose. The brief is the
 * mission — a target, a window, a pass and a facility — and it is read before
 * the object is specified and before any money is named, which is the whole
 * reason it can be handed over rather than sold.
 *
 * Every field maps to something the reader did or something the catalogue
 * fixed. Nothing is padded out to make the sheet look fuller: four sections
 * is the whole mission.
 */
export function buildMissionBrief(
  draft: StartDraft,
  quote: Quote,
  now: Date,
): MissionBriefData | null {
  const a = draft.address;
  if (!a) return null;

  const schedule = missionSchedule(now);
  const geometry = passGeometry(a.lat, a.lon, schedule.windowOpensFrom);

  const place = [a.city, a.region, a.postalCode, a.country]
    .filter(Boolean)
    .join(' / ')
    .toUpperCase();

  const sections: ProfileSection[] = [
    {
      title: 'Target',
      // The coordinates are the document's identity line and sit in the
      // header; restating them here would be the same value twice on one
      // screen.
      fields: [
        {
          label: 'Footprint',
          value: `${draft.areaKm} × ${draft.areaKm} km`,
          note: `${(draft.areaKm * draft.areaKm).toFixed(0)} square kilometres of ground, centred on the target`,
        },
        {
          label: 'Ground sample',
          value: 'Approx. 50 cm',
          note: 'Sub-metre optical, near-nadir. Cars resolve as cars; people do not resolve.',
        },
        {
          label: 'Dedication',
          value: draft.dedication ? draft.dedication : 'None',
          note: draft.dedication
            ? 'Set at the foot of the mission sheet, under the target block.'
            : 'The sheet carries the target and the telemetry, and no dedication line.',
        },
      ],
    },
    {
      title: 'Capture window',
      fields: [
        {
          label: 'Tasking filed',
          value: `Within ${schedule.taskingHours} h`,
          note: 'The collection request goes to the operator as soon as the payment settles.',
        },
        {
          label: 'Window opens',
          value: `${formatTelemetryDate(schedule.windowOpensFrom)} → ${formatTelemetryDate(schedule.windowOpensTo)}`,
          mono: true,
        },
        {
          label: 'Window closes by',
          value: formatTelemetryDate(schedule.windowClosesBy),
          mono: true,
          note: 'Nominal. The operator returns the exact window once tasking is accepted, and every pass is logged to your file.',
        },
      ],
    },
    {
      title: 'Pass geometry',
      fields: [
        {
          label: 'Node crossing',
          value: `${geometry.solarTime} local solar`,
          mono: true,
          note: 'Sun-synchronous, descending node. Every pass over this target comes at the same hour of the day.',
        },
        {
          label: 'Sun elevation',
          value: `${geometry.sunElevationDeg.toFixed(1)}°`,
          mono: true,
          note: !geometry.sunUp
            ? 'The sun has not risen over this latitude at the node crossing on that date. Optical capture waits for the light to come back, and the sixty-day refund stands if it does not come in time.'
            : geometry.lowSun
              ? 'A low sun at this latitude and season. Shadows run long across the frame, and the pipeline holds for the best-lit pass in the window.'
              : 'High enough to light the ground plane without flattening it.',
        },
        {
          label: geometry.sunUp ? 'Shadows fall' : 'Sun bearing',
          value: geometry.sunUp
            ? `${geometry.shadowCompass} — sun bearing ${geometry.sunAzimuthDeg}°`
            : `${geometry.sunCompass} / ${geometry.sunAzimuthDeg}°, below the horizon`,
        },
      ],
    },
    {
      title: 'Delivery',
      fields: [
        {
          label: 'Printed at',
          value: PRINT_FACILITY[quote.region],
          note: 'The facility in your own region, so the print crosses no customs desk.',
        },
        {
          label: 'Estimated delivery',
          value: `${formatTelemetryDate(schedule.deliveryFrom)} → ${formatTelemetryDate(schedule.deliveryTo)}`,
          mono: true,
          note: `Earliest and latest the pipeline produces. If no usable frame is acquired in ${REFUND_WINDOW_DAYS} days the mission is refunded in full.`,
        },
        {
          label: 'Mission code',
          value: 'Issued on authorisation',
          note: 'Four characters, assigned when the file opens. Every pass, frame and shipment is logged against it.',
        },
      ],
    },
  ];

  return {
    designation: `MISSION / ${(a.city || a.country).toUpperCase()}`,
    street: [a.line1, a.line2].filter(Boolean).join(', ').toUpperCase(),
    place,
    coords: formatCoords(a.lat, a.lon),
    schedule,
    geometry,
    sections,
  };
}

/* ------------------------------------------------------------------ */
/* The order line                                                      */
/* ------------------------------------------------------------------ */

export interface OrderLine {
  label: string;
  value: string;
  mono?: boolean;
  /** The step this line was decided on. Absent when the line is not a choice. */
  step?: 'target' | 'aim' | 'why' | 'format' | 'finish';
}

/**
 * What the authorise screen restates before the charge.
 *
 * Four lines, one for each decision the reader made, each of them able to
 * send them back to the screen that made it. It is not a receipt — the
 * receipt comes after the money — it is the last chance to see the four
 * answers together.
 */
export function buildOrderLines(draft: StartDraft, quote: Quote): OrderLine[] {
  const a = draft.address;
  if (!a) return [];
  const format = getFormat(draft.formatId);
  return [
    {
      label: 'Target',
      value: [a.line1, a.city, a.countryCode].filter(Boolean).join(', ').toUpperCase(),
      step: 'target',
    },
    {
      label: 'Footprint',
      value: `${draft.areaKm} × ${draft.areaKm} km`,
      step: 'aim',
    },
    {
      label: 'Dedication',
      value: draft.dedication || 'None',
      step: 'why',
    },
    {
      label: 'Print',
      value: `${format.designation} / ${format.metric}`,
      step: 'format',
    },
    {
      label: 'Finish',
      value:
        draft.frame === 'FRAMED'
          ? `Framed, ${MATERIALS.frameLower}`
          : `Unframed, ${PACKAGING.unframedShort.toLowerCase()}`,
      step: 'finish',
    },
    {
      // Not a choice — the facility follows the target's country.
      label: 'Printed at',
      value: PRINT_FACILITY[quote.region],
    },
  ];
}
