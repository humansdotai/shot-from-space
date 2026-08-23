import type { ReactNode } from 'react';
import type { IconProps } from './Icon';
import {
  IconAltitude,
  IconArea,
  IconCalendar,
  IconCapture,
  IconClock,
  IconCloud,
  IconComposition,
  IconCrosshair,
  IconElevation,
  IconFacility,
  IconFrame,
  IconMail,
  IconOrbit,
  IconParcel,
  IconPassWindow,
  IconRange,
  IconReceipt,
  IconResolution,
  IconSatellite,
  IconSheet,
} from './glyphs';

/**
 * THE DICTIONARY — which mark belongs to which written label.
 *
 * ==================================================================
 * WHY A DICTIONARY AND NOT A PROP EVERYWHERE
 * ==================================================================
 * A readout row already carries the one string that says what kind of
 * fact it holds: its label. `Coordinates` is a coordinate, `Rises in`
 * is an instant, `Highest point` is an angle above the horizon. Asking
 * every caller to ALSO hand over the matching glyph is asking them to
 * restate a fact they have already stated, and the two then drift —
 * which is how a calendar ends up beside a clock reading.
 *
 * So the mapping is written once, here, and the panel primitives look a
 * label up in it. A caller that wants something else passes an explicit
 * mark and this file is not consulted.
 *
 * ==================================================================
 * THE RULE THAT KEEPS IT HONEST
 * ==================================================================
 * `markFor()` returns `null` far more often than it returns a glyph,
 * and that is the point. The set's own header says a row with no type
 * gets no icon: a handling code, a callsign, a person's answer to "why
 * this place" and a free-text mission name are strings, not types, and
 * marking them anyway would put uniformity back on the page in a new
 * costume. Nothing is added here to fill a gap — only because the value
 * genuinely has that type.
 *
 * Matching is on the lower-cased label with its punctuation dropped, so
 * `Capture window`, `CAPTURE WINDOW` and `Capture window?` are one key.
 * Nothing is guessed by substring: a near miss returns null rather than
 * a mark that is nearly right, because a nearly-right mark is a lie.
 */

/** A glyph the panel can render. `live` is honoured by the two that move. */
export type Mark = (props: IconProps & { live?: boolean }) => ReactNode;

const KEYS: Record<string, Mark> = {
  /* --- Ground ---------------------------------------------------- */
  coordinates: IconCrosshair,
  over: IconCrosshair,
  'over your coordinates': IconCrosshair,
  'the existing frame': IconArea,
  footprint: IconArea,
  'capture footprint': IconArea,
  /* The one distinction the whole offer turns on: `Archive` is a frame
     that already exists over this ground, `Commission` is a frame that
     will be taken. Two marks say that before the paragraphs do. */
  archive: IconArea,

  /* --- Time ------------------------------------------------------- */
  'rises in': IconClock,
  'capture window': IconPassWindow,
  'above the horizon': IconPassWindow,
  'requested tasking day': IconCalendar,
  'commit by': IconCalendar,
  acquisition: IconCapture,
  'the tasking': IconCapture,
  'about the picture beside you': IconCapture,
  commission: IconCapture,
  'commission large format': IconCapture,

  /* --- The pass --------------------------------------------------- */
  spacecraft: IconSatellite,
  'the next crossing of your sky': IconOrbit,
  'the pass those numbers came from': IconOrbit,
  inclination: IconOrbit,
  'one orbit': IconOrbit,
  altitude: IconAltitude,
  'highest point': IconElevation,
  'distance now': IconRange,
  'ground sample ordered': IconResolution,
  resolution: IconResolution,

  /* --- Sky -------------------------------------------------------- */
  cloud: IconCloud,
  'cloud cover': IconCloud,

  /* --- The object ------------------------------------------------- */
  composition: IconComposition,
  size: IconSheet,
  'print size': IconSheet,
  format: IconSheet,
  finish: IconFrame,
  frame: IconFrame,
  'printed at': IconFacility,
  'ship to': IconParcel,
  delivery: IconParcel,
  express: IconParcel,

  /* --- The record ------------------------------------------------- */
  'what is included': IconReceipt,
  'what you are buying': IconReceipt,
  receipt: IconReceipt,
  email: IconMail,
};

/** Normalises a written label to a dictionary key. */
function keyOf(label: string): string {
  return label
    .toLowerCase()
    .replace(/[?.:·—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The mark for a written label, or `null` when the label names no type.
 *
 * Accepts anything, because a label slot takes a `ReactNode`: a label
 * that is not a plain string has no key and gets no mark.
 */
export function markFor(label: unknown): Mark | null {
  if (typeof label !== 'string') return null;
  return KEYS[keyOf(label)] ?? null;
}
