/**
 * THE DEDICATION LINE.
 *
 * `/start` asks "what is this place?" and the answer is printed on the mission
 * sheet — one line, in the customer's own words. It is the only free text in
 * this product that a customer authors, and it travels further than any other
 * field they type: into a rendered page, into an email, and into an SVG that
 * is composited by librsvg at print resolution.
 *
 * So it is sanitised once, here, and every writer and reader goes through this
 * module. Three things have to be true of whatever comes out:
 *
 *   1. It is XML-safe. A raw C0 control byte is not merely ugly — it is
 *      ILLEGAL in XML 1.0, and librsvg refuses the whole document rather than
 *      dropping the character. One stray 0x0B in a dedication would take the
 *      entire plate down to the fallback. `esc()` in lib/poster/svg.ts escapes
 *      markup; it does not remove control characters, and it cannot, because
 *      there is no escape for them.
 *   2. It is one line. Newlines and tabs collapse to single spaces, so the
 *      sheet's measured wrap (`wrapMono`) is the only thing deciding where the
 *      line breaks.
 *   3. It is bounded. A dedication cannot be allowed to grow until it runs
 *      into the block below it on the plate, so the length cap is enforced in
 *      code points, not UTF-16 units — slicing a surrogate pair in half would
 *      produce exactly the lone surrogate rule 1 exists to remove.
 *
 * Deliberately NOT done here: HTML/XML escaping. Escaping belongs at each
 * output boundary (React escapes by default, `esc()` handles the SVG and the
 * mail), and pre-escaping would double-encode an ampersand the moment it met
 * one of them.
 */

/**
 * Longest dedication accepted, in code points. Sized off the plate: the
 * sheet's left measure carries ~73 monospaced characters per line, and the
 * dedication is given two lines at the foot of it.
 */
export const DEDICATION_MAX_LENGTH = 120;

/**
 * Anything that is not a printable character:
 *   \p{Cc}  C0/C1 controls — illegal in XML, invisible everywhere else.
 *   \p{Cf}  format characters — zero-width joiners, and the bidi overrides
 *           (U+202E and friends) that can visually reverse a line of text.
 *   \p{Cs}  surrogates. With the `u` flag a well-formed pair is one code
 *           point, so this only ever matches a LONE surrogate — the kind that
 *           makes a string unserialisable to valid UTF-8.
 */
const NON_PRINTING = /[\p{Cc}\p{Cf}\p{Cs}]/gu;

/**
 * Normalises free text into a single safe line, or null when nothing is left.
 * Idempotent: sanitising an already-sanitised value returns it unchanged.
 */
export function sanitizeDedication(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  const cleaned = raw
    // Compose first: NFC folds decomposed accents into single code points, so
    // the length cap counts what the reader sees rather than combining marks.
    .normalize('NFC')
    // Every kind of whitespace — newline, tab, non-breaking, ideographic —
    // becomes one plain space. The dedication is one line by construction.
    .replace(/\s+/gu, ' ')
    // Then remove what is left that cannot be printed at all.
    .replace(NON_PRINTING, '')
    // Removing a zero-width character can leave a doubled space behind it.
    .replace(/ {2,}/g, ' ')
    .trim();

  if (!cleaned) return null;

  // Cap by code point, never by UTF-16 unit.
  const points = Array.from(cleaned);
  const capped =
    points.length <= DEDICATION_MAX_LENGTH
      ? cleaned
      : points.slice(0, DEDICATION_MAX_LENGTH).join('').trim();

  return capped || null;
}
