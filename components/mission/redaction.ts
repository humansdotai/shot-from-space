/**
 * MISSION CONTROL — the redaction layer.
 *
 * The mission file is written in the language of a released document, and a
 * released document has bars on it. This module owns the two halves of that
 * idea that are not visual: WHAT is allowed behind a bar, and WHERE the
 * values behind the bars come from.
 *
 * ── The honesty limit ──────────────────────────────────────────────────
 * A bar is atmosphere, never access control. Two rules, both hard:
 *
 * 1. Nothing the owner of the file needs may sit behind one. The address,
 *    the email, the receipt, the amount paid, the tracking number, the
 *    coordinates, the short link, the delivery date — all of it renders
 *    plainly. A customer must never have to play with a hover effect to
 *    read their own order.
 * 2. Only internal operational metadata is redacted, and it is invented
 *    here, deterministically, from the mission code. It is house routing
 *    detail: which desk raised the tasking, which ground station took the
 *    downlink, which operator held the pass. Concealing it costs the reader
 *    nothing, which is exactly why it is the only thing allowed to be
 *    concealed.
 *
 * This is a consumer product that photographs houses from orbit. The bar is
 * a design language borrowed from declassified paperwork; the site holds no
 * classified information and must never imply that it does. Keep the copy
 * around a bar operational, never secretive.
 *
 * Everything below is derived, not stored: the same mission code always
 * produces the same handling metadata, on the server and on the client, so
 * the file reads identically across hydration and across every poll.
 */

/** The kinds of value a bar may cover. Drives the tooltip and `data-reason`. */
export type RedactionReason = 'handling' | 'tasking' | 'downlink' | 'callsign';

/**
 * What the bar is over, in plain words. Rendered as the control's `title`
 * so the reason is available before the reveal — including on hover, on
 * focus and to assistive technology as a description.
 */
export const REDACTION_REASON: Record<RedactionReason, string> = {
  handling: 'Internal handling code',
  tasking: 'Tasking authority reference',
  downlink: 'Downlink station identifier',
  callsign: 'Operator callsign',
};

/* ------------------------------------------------------------------ */
/* Derivation                                                          */
/* ------------------------------------------------------------------ */

/** FNV-1a, 32-bit. Small, stable, and identical in every runtime. */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic pick from a fixed table. */
function pick<T>(table: readonly T[], seed: number): T {
  return table[seed % table.length];
}

/** Zero-padded slice of the hash, `digits` wide. */
function digits(seed: number, count: number): string {
  return String(seed % 10 ** count).padStart(count, '0');
}

const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXZ'; // no I/O/Q/Y — read aloud over a link

/**
 * Ground stations, invented. Deliberately generic — a number and an ocean or
 * a latitude band, never the name of a real facility or operator.
 */
const STATIONS = [
  'GS-02 NORTH',
  'GS-04 POLAR',
  'GS-05 ATLANTIC',
  'GS-07 PACIFIC',
  'GS-09 SOUTHERN',
  'GS-11 EQUATORIAL',
] as const;

/**
 * Operator callsigns, invented. Two neutral words joined — the register of a
 * shift handle on a rota, not of a codename.
 */
const CALLSIGNS = [
  'LONGSHOT',
  'HALFLIGHT',
  'NORTHWIND',
  'PAPERKITE',
  'SLOWGLASS',
  'TIDEMARK',
  'BLUEROOM',
  'DRYDOCK',
] as const;

/** The four house-internal values the file is allowed to put behind a bar. */
export interface OperationsMetadata {
  /** `SFS/H-4471-KM` — the internal handling code the file is filed under. */
  handling: string;
  /** `TA-4471 / DESK 3` — which tasking desk raised the collection request. */
  tasking: string;
  /** `GS-07 PACIFIC` — the ground station that took the downlink. */
  downlink: string;
  /** `LONGSHOT` — the operator who held the pass. */
  callsign: string;
}

/**
 * Derives a mission's operational metadata from its code.
 *
 * Pure and total: any string in, the same four values out, forever. Nothing
 * here is read from or written to the mission record — these values exist to
 * be redacted, and revealing every one of them tells the reader nothing they
 * needed and nothing about anybody else.
 */
export function operationsMetadata(code: string): OperationsMetadata {
  const key = code.toUpperCase();
  const h = hash32(key);
  const h2 = hash32(`${key}/2`);

  const serial = digits(h, 4);
  const suffix = `${LETTERS[h % LETTERS.length]}${LETTERS[(h >>> 5) % LETTERS.length]}`;

  return {
    handling: `SFS/H-${serial}-${suffix}`,
    tasking: `TA-${digits(h2, 4)} / DESK ${(h2 % 6) + 1}`,
    downlink: pick(STATIONS, h2 >>> 3),
    callsign: pick(CALLSIGNS, h >>> 7),
  };
}
