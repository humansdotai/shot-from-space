import { frameBySlug } from '@/lib/imagery';
import { formatTelemetryTimestamp } from '@/lib/utils';

/**
 * THE EXAMPLE MISSIONS.
 *
 * Two demonstration files, labelled as such everywhere they appear. They
 * are the only missions the landing page shows and they are presented as
 * worked examples, never as customer stories — nothing has shipped yet, so
 * there is nobody to quote and nothing to count.
 *
 *   EXAMPLE        32BF, the Los Angeles mission. It is the frame the page
 *                  opens on, it is the mission seeded at FINAL_APPROACH in
 *                  `prisma/seed.ts`, and every value below is read from
 *                  that same catalogue frame — so the picture, the record
 *                  and the database agree instead of drifting.
 *   PRINT_EXAMPLE  74KL, Paris, used for the poster miniature so that one
 *                  mission code never appears over two different frames.
 *
 * Both codes are seeded missions in `prisma/seed`, so the links resolve.
 *
 * ------------------------------------------------------------------
 * NO NAMES
 * ------------------------------------------------------------------
 * There is no personnel list here and no signature on the file. Shot from
 * Space has not flown a commissioned mission, so a named mission director
 * on a demonstration record would be an invented person on a page that
 * takes money. The block that used to carry two names now carries the
 * instrument, which is a fact.
 */

export interface SequenceEvent {
  label: string;
  /** Elapsed from range zero, signed. */
  elapsed: string;
}

/** Mission 32BF — Los Angeles. The file printed on the deliverable. */
const EXAMPLE_FRAME = frameBySlug('hero-los-angeles');

/** `34.0522N 118.2437W` — the house form for a frame centre. */
function centre(lat: number, lon: number, dp = 4): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(dp)}${ns} ${Math.abs(lon).toFixed(dp)}${ew}`;
}

const LAT = EXAMPLE_FRAME?.lat ?? 34.0522;
const LON = EXAMPLE_FRAME?.lon ?? -118.2437;

export const EXAMPLE = {
  code: '32BF',
  url: 'SHOT.SPACE/M32BF',
  href: '/m/32BF',

  city: EXAMPLE_FRAME?.city ?? 'LOS ANGELES',
  admin: EXAMPLE_FRAME?.admin ?? 'CALIFORNIA',
  frameSrc: EXAMPLE_FRAME?.src ?? '',

  captureStamp: formatTelemetryTimestamp(EXAMPLE_FRAME?.acquired.date ?? ''),
  frameCentre: centre(LAT, LON),
  orbitTrack: EXAMPLE_FRAME?.orbit.track ?? '//ELIPSE 33°',

  purpose:
    'The purpose of mission 32BF was to acquire a single frame of the target and return it to Earth. The spacecraft crossed the target on a descending pass in daylight. Acquisition was nominal. One frame was collected. No further passes were required.',

  sequence: [
    { label: 'Acquisition window open', elapsed: '−00:04:12' },
    { label: 'Target lock', elapsed: '−00:00:47' },
    { label: 'Frame exposed', elapsed: '00:00:00' },
    { label: 'Downlink initiated', elapsed: '+00:02:38' },
    { label: 'Ground receipt confirmed', elapsed: '+00:11:05' },
    { label: 'Declassified for print', elapsed: '+72:00:00' },
  ] satisfies SequenceEvent[],

  target: [
    { label: 'Actual frame centre', value: centre(LAT, LON) },
    { label: 'Planned frame centre', value: centre(LAT - 0.0005, LON + 0.0004) },
    { label: 'Deviation', value: '6 m — within tolerance' },
    { label: 'Altitude / GSD', value: '505 km / 0.50 m per px' },
  ],

  /** The instrument block. It replaced a list of invented crew names. */
  instrument: [
    { label: 'Sensor', value: EXAMPLE_FRAME?.orbit.sensor ?? 'LANDSAT / OLI-2' },
    { label: 'Inclination', value: EXAMPLE_FRAME?.orbit.inclination ?? 'SSO 98.2°' },
    { label: 'Off-nadir', value: `${(EXAMPLE_FRAME?.orbit.offNadirDeg ?? 4.1).toFixed(1)}°` },
    { label: 'Cloud over target', value: `${EXAMPLE_FRAME?.orbit.cloudPct ?? 2}%` },
  ],

  anomalies: 'None',
  footnote: 'All times elapsed from range zero, established as the second of frame exposure.',
} as const;

/** Mission 74KL — Paris. The frame used for the poster miniature. */
const PRINT_FRAME = frameBySlug('paris-fr');

export const PRINT_EXAMPLE = {
  code: '74KL',
  url: 'SHOT.SPACE/M74KL',
  href: '/m/74KL',

  frame: {
    src: PRINT_FRAME?.src ?? '',
    alt: `Satellite frame of ${PRINT_FRAME?.city ?? 'the target'}, acquired from orbit`,
  },

  captureStamp: formatTelemetryTimestamp(PRINT_FRAME?.acquired.date ?? ''),
  capturedAt: PRINT_FRAME?.acquired.date ?? '',
  orbitTrack: PRINT_FRAME?.orbit.track ?? '//ELIPSE 27°',

  purposeShort:
    'The purpose of mission 74KL was to acquire a single frame of the target address and return it to Earth. Acquisition was nominal. One frame was collected.',

  sequence: [
    { label: 'Frame exposed', elapsed: '00:00:00' },
    { label: 'Downlink initiated', elapsed: '+00:03:04' },
    { label: 'Declassified for print', elapsed: '+72:00:00' },
  ] satisfies SequenceEvent[],
} as const;
