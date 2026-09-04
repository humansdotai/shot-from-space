import { seededUnit } from '@/lib/utils';
import type { ResolvedPoster } from './types';

/**
 * THE SHEET'S WORDS AND NUMBERS.
 *
 * Everything printed on the paper half of the plate is derived here, in one
 * pure function of the mission, so the renderer only ever places strings.
 *
 * Two rules govern this file:
 *
 *  1. Nothing is invented that a customer could mistake for a fact about a
 *     person. The personnel block names *roles and organisations*, never made
 *     up individuals — a real mission passes its own `personnel`.
 *  2. Every derived number is deterministic in the mission code, so the same
 *     mission always prints the same sheet. A poster that changed its own
 *     telemetry between two renders would not be a record of anything.
 */

export interface SequenceEvent {
  label: string;
  /** Seconds relative to frame exposure. Negative is before. */
  offset: number;
}

export interface SheetCopy {
  /**
   * The sheet's lockup, in two parts because it is set in two faces: the word
   * is a label and takes the detail face, the code is the display element and
   * takes Ductile. Same split <MissionRef /> makes on screen.
   */
  heading: { label: string; code: string };
  /** Already wrapped is the renderer's job; this is one paragraph of prose. */
  purpose: string;
  personnel: Array<[string, string]>;
  sequence: SequenceEvent[];
  /** `[label, value]` pairs — label left, value right against the rail. */
  target: Array<[string, string]>;
  /** Full-measure statements under the pairs. */
  targetNotes: string[];
  anomalies: string;
  /**
   * The customer's dedication, set for the plate: their own words, uppercased
   * to the sheet's voice, or null when the question was skipped. The renderer
   * prints nothing at all in that case — an empty label would announce a
   * missing answer.
   */
  dedication: string | null;
  link: string;
  orbit: string[];
  footnote: string;
}

/** `+00:02:38`, `−00:04:12`, `00:00:00`. U+2212 minus, not a hyphen. */
export function elapsed(seconds: number): string {
  if (seconds === 0) return '00:00:00';
  const sign = seconds < 0 ? '−' : '+';
  const s = Math.abs(Math.round(seconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}:${ss}`;
}

/**
 * `45.5966N 25.5528E` — the frame-centre form used on the sheet.
 *
 * `dp` is the whole privacy question of this product in one argument: 4 is the
 * ~11 m fix the customer paid for and the number that goes on their print, 2
 * is the ~1.1 km fix any other reader gets. See `PosterOptions.coordDp`.
 */
export function frameCentre(lat: number, lon: number, dp: 2 | 4 = 4): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(dp)}${ns} ${Math.abs(lon).toFixed(dp)}${ew}`;
}

/** `21:34` / `02.10.2026`, both read off the same UTC instant. */
function clockAndDate(iso: string): { clock: string; date: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { clock: '--:--', date: '--.--.----' };
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    clock: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
    date: `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`,
  };
}

/** `LOS ANGELES / CALIFORNIA / UNITED STATES` → `LOS ANGELES, CALIFORNIA`. */
function siteOf(label: string): string {
  const parts = label
    .toUpperCase()
    .split(/\s*[/,]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.slice(0, 2).join(', ') || 'THE TARGET';
}

/** Metres per degree of latitude. Good to a fraction of a percent anywhere. */
const M_PER_DEG = 111_320;

/**
 * The planned frame centre. A tasked capture is commanded to a point and the
 * spacecraft arrives a few metres off it; the sheet prints both and the
 * distance between them. Derived, deterministic, and internally consistent —
 * the deviation printed is the deviation between the two lines above it.
 */
function planned(data: ResolvedPoster): { lat: number; lon: number; metres: number } {
  const metres = 3 + Math.round(seededUnit(`${data.missionCode}-dev`) * 9);
  const bearing = seededUnit(`${data.missionCode}-brg`) * Math.PI * 2;
  const north = Math.cos(bearing) * metres;
  const east = Math.sin(bearing) * metres;
  const cos = Math.max(0.2, Math.cos((data.lat * Math.PI) / 180));
  return {
    lat: data.lat + north / M_PER_DEG,
    lon: data.lon + east / (M_PER_DEG * cos),
    metres,
  };
}

/**
 * The sequence of events, as elapsed times from range zero. Range zero is the
 * second of frame exposure — the footnote on the sheet says so, because an
 * elapsed time with no stated origin is decoration.
 */
function sequence(code: string): SequenceEvent[] {
  const j = (salt: string, base: number, span: number) =>
    -Math.round(base + seededUnit(`${code}-${salt}`) * span);
  return [
    { label: 'ACQUISITION WINDOW OPEN', offset: j('win', 210, 140) },
    { label: 'TARGET LOCK', offset: j('lock', 30, 50) },
    { label: 'FRAME EXPOSED', offset: 0 },
    { label: 'DOWNLINK INITIATED', offset: -j('dl', 105, 180) },
    { label: 'GROUND RECEIPT CONFIRMED', offset: -j('rx', 480, 420) },
    { label: 'DECLASSIFIED FOR PRINT', offset: 72 * 3600 },
  ];
}

const DASH = '—';

export function sheetCopy(data: ResolvedPoster): SheetCopy {
  const code = data.missionCode;
  // `ResolvedPoster.dedication` arrives sanitised, and a string of spaces is
  // still nothing to print: trimming here means whitespace can never buy a
  // rule and a blank line at the foot of the sheet, whatever the caller sent.
  const dedication = data.dedication?.trim();
  const { clock, date } = clockAndDate(data.capturedAt);
  const site = siteOf(data.locationLabel);
  const plan = planned(data);

  // The tasking authority is the constellation the frame was bought from —
  // an organisation on the record, not a name we made up.
  /* The tasking authority is named as a role, never as a supplier: the
     sensor label is an instrument description ("HR / OPTICAL"), not a name. */
  const operator = 'TASKING PARTNER';

  const purpose = data.degraded
    ? `MISSION ${code} HAS NO FRAME ON FILE. THE ACQUISITION RECORD IS UNAVAILABLE AT THE TIME OF PRINTING. NO FURTHER STATEMENT IS MADE.`
    : `THE PURPOSE OF MISSION ${code} WAS TO ACQUIRE A SINGLE FRAME OF THE SITE OF ` +
      `${site}, AND RETURN IT TO EARTH. THE SPACECRAFT PASSED OVER THE TARGET AT ` +
      `${clock} UTC, ${date}. ACQUISITION WAS NOMINAL. ONE FRAME WAS COLLECTED. ` +
      `NO FURTHER PASSES WERE REQUIRED.`;

  /**
   * ACTUAL against PLANNED is the owner's block, and it only makes sense at
   * the full fix: the two points are 3–12 m apart, so at the 2 dp a public or
   * shared view gets (~1.1 km) they round to the SAME STRING and the sheet
   * would print one number twice with a deviation stated under it. A reduced
   * view therefore prints one row — where the frame was centred, to the
   * precision that view is allowed — and keeps the deviation, which is a real
   * quantity in metres and does not depend on how the fix is printed.
   */
  const target: Array<[string, string]> = data.degraded
    ? [
        ['ACTUAL FRAME CENTRE', DASH],
        ['PLANNED FRAME CENTRE', DASH],
      ]
    : data.coordDp === 4
      ? [
          ['ACTUAL FRAME CENTRE', frameCentre(data.lat, data.lon, 4)],
          ['PLANNED FRAME CENTRE', frameCentre(plan.lat, plan.lon, 4)],
        ]
      : [['FRAME CENTRE', frameCentre(data.lat, data.lon, 2)]];

  const targetNotes = data.degraded
    ? ['DEVIATION NOT ESTABLISHED.', `ALT ${DASH} / GSD ${DASH}`]
    : [
        `DEVIATION ${plan.metres} M. WITHIN TOLERANCE.`,
        `ALT ${data.orbit.altitudeKm} KM / GSD ${data.orbit.gsdM.toFixed(2)} M/PX`,
      ];

  return {
    heading: { label: 'MISSION /', code },
    purpose,
    personnel: data.personnel?.length
      ? data.personnel
      : [
          ['MISSION DIRECTOR', 'SHOT FROM SPACE'],
          ['TASKING AUTHORITY', operator],
        ],
    sequence: data.degraded ? [] : sequence(code),
    target,
    targetNotes,
    anomalies: data.degraded ? 'ANOMALIES: RECORD UNAVAILABLE.' : 'ANOMALIES: NONE.',
    /* The one line on this sheet that is not derived from telemetry.
       Uppercased, because the sheet has one voice and this line speaks in it —
       and nothing else is done to it. No `DEDICATION:` prefix: the plate sets
       it under a rule at the foot of the measure, where a dedication goes, and
       a label there would turn the customer's sentence into another field.
       Suppressed on a degraded plate, which states that the record is
       unavailable and must not then print half of it. */
    dedication: dedication && !data.degraded ? dedication.toUpperCase() : null,
    link: `SHOT.SPACE/M${code}`,
    orbit: ['ORBIT:', data.orbit.track || '//ELIPSE 00°'],
    footnote:
      'ALL TIMES ELAPSED FROM RANGE ZERO, ESTABLISHED AS THE SECOND OF FRAME EXPOSURE.',
  };
}

/**
 * The width of a string in MEASURE COLUMNS rather than in characters.
 *
 * The sheet's measure is a character count, which is exact for a monospaced
 * face — and the detail face only covers Latin. A Chinese or Korean dedication,
 * or a wall of emoji, is set by whatever face the renderer falls back to at up
 * to 1.0em against Typestar's 0.664, so counting those code points as one
 * column each would let a line run half as far again as the column it is in.
 * Everything from U+1100 up (CJK, Hangul, and every astral plane, which is
 * where emoji live) is charged two columns; that over-estimates a little and
 * never under-estimates, which is the direction a measure has to err.
 */
export function monoColumns(value: string): number {
  let columns = 0;
  for (const ch of value) columns += (ch.codePointAt(0) ?? 0) >= 0x1100 ? 2 : 1;
  return columns;
}

/**
 * Greedy word wrap by character count. Legitimate here and nowhere else: the
 * sheet is set entirely in a monospaced face, so a character count *is* a
 * measure, exact to the pixel.
 *
 * `hard` additionally breaks a WORD that is longer than the measure. Off by
 * default, because every other string on this sheet is copy we wrote and a
 * broken word would be a bug in the copy. On for the dedication, which is
 * typed by a customer: `AAAAAA…` 120 characters long is not a sentence the
 * wrap can help with, and left alone it would run straight out of the left
 * column and across the right one.
 */
export function wrapMono(value: string, maxChars: number, hard = false): string[] {
  if (maxChars < 8) return [value];
  const out: string[] = [];
  let line = '';

  const push = () => {
    if (line) out.push(line);
    line = '';
  };

  for (let word of value.split(/\s+/)) {
    if (hard) {
      // Anything that cannot fit on a line of its own is cut to the measure,
      // as many times as it takes, before the greedy pass sees it.
      while (word.length > maxChars) {
        push();
        out.push(word.slice(0, maxChars));
        word = word.slice(maxChars);
      }
    }
    if (!word) continue;
    if (!line) line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
    else {
      push();
      line = word;
    }
  }
  push();
  return out;
}
