import { FORMATS, getFormat } from '@/lib/pricing';
import type { FormatId, FrameOption } from '@/lib/types';
import { RATIO_VALUE, isPosterRatio, resolveGeometry } from './layout';
import type { PosterRatio, PosterStyleId } from './types';

/**
 * ==================================================================
 * THE POSTER STYLES — how the sheet is divided, and what it carries.
 * ==================================================================
 *
 * This file is the single source of truth for the `Design` choice. It is a
 * catalogue of COMPOSITIONS, not of colours: every style here differs in how
 * much of the paper goes to the picture and how much goes to the record, and
 * one of them differs in whether the picture bleeds at all. There is no style
 * in this file that is another style with a different tint.
 *
 * Three things are declared per style and nothing else is:
 *
 *   1. the RECTANGLES — where the picture sits and where the record sits, as
 *      fractions of the sheet, for a given catalogue format;
 *   2. the MARKS set over the picture (lockup, edge word, print credit, code);
 *   3. the BLOCKS set on the record (heading, purpose, personnel, sequence,
 *      target, orbit, anomalies, footnote, dedication, link, chrome mark).
 *
 * <StyledPoster /> renders exactly that and invents nothing. Every string it
 * prints on the record comes from `sheetCopy()` in ./sheet.ts — the same
 * function `buildPlateSvg()` calls to make the file that goes to the press —
 * so a style cannot depict a value the print will not carry.
 *
 * ------------------------------------------------------------------
 * WHERE THE NUMBERS COME FROM (read this before changing one)
 * ------------------------------------------------------------------
 * Nothing here is a taste value picked to look right in a picker:
 *
 *   · the ASPECT of every style is `FORMATS[].ratio` from lib/pricing.ts,
 *     via `RATIO_VALUE` — the same table the composer lays out against;
 *   · NO STYLE'S DIVISION IS WRITTEN DOWN HERE. All four are READ OUT of
 *     `resolveGeometry(width, ratio, styleId)` — the function
 *     `composePoster()` calls to make the file that goes to the press — by
 *     `divisionRects()` below. A style therefore cannot drift from its print
 *     by a pixel, because there is no second copy of the numbers to drift
 *     from. The rectangles, the record's scale unit and the surplus depth it
 *     is centred by all come from that one call.
 *
 * The arguments for the numbers themselves live where the numbers do, in
 * lib/poster/layout.ts: `SHEET_W_FRACTION` and `SHEET_H_CAP` for the two-ground
 * divisions, `PLATE_MARGIN` for the mount, and `Geometry.sheetOrigin` for why
 * a deeper record buys paper rather than type.
 *
 * ------------------------------------------------------------------
 * HONESTY — WHAT THIS CATALOGUE MAY AND MAY NOT SAY
 * ------------------------------------------------------------------
 * 1. A STYLE THAT CANNOT BE PRINTED IS NOT OFFERED. Every style below prints
 *    on both manufacturable finishes at all three catalogue sizes, because a
 *    style is ARTWORK: it changes the file, never the product ordered.
 *    `lib/integrations/gelato.ts` sells exactly two things per size — a
 *    200 gsm uncoated sheet and a 200 gsm matt sheet in a black wood frame
 *    behind acrylic — and `posterStyleFinishes()` is derived from
 *    `FORMATS[].price`, which is priced and charged against those two. There
 *    is no third finish in this file because there is no third product.
 *
 * 2. NO INK VARIANTS ARE SHIPPED. A monochrome or duotone ink is a plausible
 *    fifth option and it is deliberately absent: the Gelato line is a 4/0
 *    colour process (`..._cl_4-0_...`) and, more to the point,
 *    `lib/poster/compose.ts` has one grade and no desaturation path, so
 *    nothing in this repository can currently PRODUCE a monochrome print
 *    file. Offering the swatch would be selling a capability the pipeline
 *    lacks. It is written up as a proposal in the build report instead.
 *
 * 3. NO STYLE INVENTS A VALUE. See `RecordBlock` — every block names copy
 *    that `sheetCopy()` already derives. There is no crew block, no
 *    resolution claim, no acquisition date that is not the capture's own,
 *    and no event log beyond the one the record itself produces.
 *
 * 4. WHAT THE COMPOSER CAN LAY OUT TODAY IS STATED, NOT IMPLIED. See
 *    `PosterStyle.composer` and `COMPOSABLE_STYLE_IDS` at the foot of this
 *    file. All four divisions are laid out by `resolveGeometry()` and drawn by
 *    `buildPlateSvg()`, and a PNG has been generated and looked at for each of
 *    them at F30, F50 and F70 — which is the only thing that entitles a style
 *    to be in that list. A surface that must not take money for a file the
 *    composer cannot produce still passes `COMPOSABLE_STYLE_IDS` to
 *    <PosterStylePicker available={…} />; the list is the safety rail, and it
 *    is widened by producing a print, never by declaring one.
 */

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

/**
 * Declared in ./types.ts, which imports nothing from this directory, so that
 * layout.ts can take a division without importing the catalogue that names
 * them. Re-exported here because this is where a reader looks for it.
 */
export type { PosterStyleId };

/** Catalogue order — broadest picture first, deepest record last. */
export const POSTER_STYLE_IDS = ['full-frame', 'dossier', 'record', 'plate'] as const;

/**
 * A mark set OVER the photograph. Each one exists on the print today and is
 * drawn by `frameLayer()` in lib/poster/plate.ts.
 *
 *   lockup   the wordmark, top left
 *   original the rotated ORIGINAL down the right edge
 *   credit   the bordered [ SHOT FROM SPACE ] print credit + capture stamp
 *   code     MISSION / {code}, the one display element on the picture
 */
export type FrameMark = 'lockup' | 'original' | 'credit' | 'code';

/**
 * A block set on the RECORD. Every one of these is a field of `SheetCopy`
 * (lib/poster/sheet.ts) — the list is deliberately closed, because a block
 * that is not in `SheetCopy` is a block whose words nobody has derived from
 * the mission, i.e. an invention.
 *
 *   heading      MISSION / {code}
 *   purpose      the one paragraph of prose on the sheet
 *   personnel    roles against the organisations that hold them. NEVER names.
 *   orbit        the graticule glyph and ORBIT: //ELIPSE nn°
 *   anomalies    ANOMALIES: NONE.
 *   footnote     the statement of what range zero is
 *   dedication   the customer's own words, or nothing at all
 *   link         SHOT.SPACE/M{code}
 *   sequence     SEQUENCE OF EVENTS, elapsed from range zero
 *   target       TARGET — frame centre(s), deviation, altitude and GSD
 *   site         the target as printed on the record, city level only
 *   edge-word    the rotated DECLASSIFIED down the sheet's right edge
 *   chrome-mark  the chrome object printed in the sheet's bottom-right corner
 */
export type RecordBlock =
  | 'heading'
  | 'purpose'
  | 'personnel'
  | 'orbit'
  | 'anomalies'
  | 'footnote'
  | 'dedication'
  | 'link'
  | 'sequence'
  | 'target'
  | 'site'
  | 'edge-word'
  | 'chrome-mark';

/** A rectangle on the sheet. All four numbers are fractions of the sheet. */
export interface Rect {
  /** Fraction of sheet WIDTH. */
  x: number;
  /** Fraction of sheet HEIGHT. */
  y: number;
  /** Fraction of sheet WIDTH. */
  w: number;
  /** Fraction of sheet HEIGHT. */
  h: number;
}

export interface PosterStyleRects {
  /** The photograph. */
  image: Rect;
  /** The record. `h === 0` for a style that carries no record at all. */
  record: Rect;
}

export interface PosterStyle {
  id: PosterStyleId;
  /** Shown in the picker. Two words at most. */
  name: string;
  /** Telemetry designation, the way `FORMATS[].designation` reads. */
  designation: string;
  /** One line under the name in the picker. States the division, plainly. */
  summary: string;
  /** The argument for choosing it. Two sentences, no adjectives for hire. */
  note: string;
  /** Does the photograph run to the sheet's edges? */
  bleed: boolean;
  /** What is set over the photograph. */
  frameMarks: readonly FrameMark[];
  /** What is set on the record, in the order the sheet reads. */
  recordBlocks: readonly RecordBlock[];
  /**
   * `pipeline` — `composePoster({ styleId })` produces this style's print file
   * today, and a PNG of it has been generated and reviewed at every catalogue
   * size. `declared` — the composition is drawn here and on screen, and the
   * composer cannot yet make the file. Only `pipeline` may be offered for
   * sale. See the honesty note at the head of this file.
   */
  composer: 'pipeline' | 'declared';
  /**
   * The division, for one catalogue format. A function of the format because
   * the margins are fractions of WIDTH and the rectangles are fractions of
   * HEIGHT: 30 × 40 and 70 × 100 are not the same shape, so a style that kept
   * one set of numbers for both would print two different designs.
   */
  rects: (formatId: FormatId) => PosterStyleRects;
}

/* ------------------------------------------------------------------ */
/* Geometry read out of the print pipeline                             */
/* ------------------------------------------------------------------ */

/** The ratio a catalogue format prints at, as `width / height`. */
export function ratioValueOf(formatId: FormatId): number {
  return RATIO_VALUE[posterRatioOf(formatId)];
}

/** `FORMATS[].ratio` as a `PosterRatio`, falling back the way layout.ts does. */
export function posterRatioOf(formatId: FormatId): PosterRatio {
  const raw = getFormat(formatId).ratio;
  return isPosterRatio(raw) ? raw : '3:4';
}

/**
 * A width to resolve geometry against. Any value gives the same FRACTIONS —
 * `resolveGeometry` rounds to whole pixels, so a large probe keeps the
 * rounding error below a ten-thousandth and the fractions stable.
 */
const PROBE_WIDTH = 10_000;

/**
 * The share of the sheet's HEIGHT that lib/poster/layout.ts gives the record
 * at a given ratio: `min(SHEET_W_FRACTION · w, SHEET_H_CAP · h) / h`.
 *
 * Read out rather than restated. Both constants are private to layout.ts and
 * copying them here is exactly how a preview starts lying about a print.
 */
export function pipelineRecordShare(ratio: PosterRatio): number {
  const g = resolveGeometry(PROBE_WIDTH, ratio);
  return g.sheet.h / g.height;
}

/**
 * The pipeline's ceiling on the record — `SHEET_H_CAP`, 0.42.
 *
 * Derived, not copied: at 1:1 the width term (0.427 · w) is larger than the
 * cap (0.42 · h) for the only time in the table, so the cap is what
 * `resolveGeometry` returns and reading a square plate back gives it exactly.
 */
export const PIPELINE_SHEET_SHARE_CAP = pipelineRecordShare('1:1');

/**
 * The print pipeline's own geometry for one division at one catalogue format.
 *
 * THIS IS THE WHOLE OF THE CATALOGUE'S GEOMETRY. Not one rectangle below is
 * written down here: `resolveGeometry(width, ratio, styleId)` is the function
 * `composePoster()` calls to make the file that goes to the press, and every
 * number this file reports — the division, the record's scale unit, the
 * surplus it is centred by — is read back out of it. A style therefore cannot
 * drift from its print by a pixel, because there is nothing to drift from.
 */
function divisionGeometry(styleId: PosterStyleId, formatId: FormatId) {
  return resolveGeometry(PROBE_WIDTH, posterRatioOf(formatId), styleId);
}

/** The division, as fractions of the sheet. */
function divisionRects(styleId: PosterStyleId, formatId: FormatId): PosterStyleRects {
  const g = divisionGeometry(styleId, formatId);
  return {
    image: {
      x: g.frame.x / g.width,
      y: g.frame.y / g.height,
      w: g.frame.w / g.width,
      h: g.frame.h / g.height,
    },
    record: {
      x: g.sheet.x / g.width,
      y: g.sheet.y / g.height,
      w: g.sheet.w / g.width,
      h: g.sheet.h / g.height,
    },
  };
}

/**
 * The sheet's own scale unit, as a multiple of the poster width.
 *
 * layout.ts sets `su = sheetH / SHEET_W_FRACTION`, i.e. the sheet's type
 * scales with its DEPTH, not with the paper. Every size and baseline on the
 * record is a fraction of `su`, so this one number is what makes a deeper
 * record set larger type rather than the same type with more air under it.
 * <StyledPoster /> multiplies the plate's constants by it.
 */
export function recordScaleOf(styleId: PosterStyleId, formatId: FormatId): number {
  const g = divisionGeometry(styleId, formatId);
  return g.su / g.width;
}

/**
 * WHY `su` IS CLAMPED AT THE POSTER WIDTH, AND WHAT IT COSTS.
 *
 * `resolveGeometry` never lets `su` exceed `u`. Every size and baseline on the
 * record is a fraction of `su`, but the COLUMNS the record is set in — the
 * left measure, the right column, the rail — are fractions of `u` and do not
 * move. So `su` running past `u` would set bigger type into columns that
 * stayed the same width, and the plate's own numbers would stop agreeing with
 * each other: the purpose paragraph would take more lines than the gap before
 * MISSION PERSONNEL allows, and a 23-character sequence label would run into
 * its elapsed time.
 *
 * That is not a rendering bug to paper over. It is the reason a record-forward
 * style buys PAPER rather than TYPE: `record` takes the deepest sheet the
 * geometry accepts, and the surplus becomes margin — see `recordOffsetOf`.
 */

/**
 * The depth a style's record has BEYOND the block of type the plate's
 * constants were drawn for, halved: the type is centred in the paper it was
 * given rather than sitting at the top of it with a band of nothing under it.
 *
 * Read out of `resolveGeometry`'s own `sheetOrigin`, so it is the offset the
 * COMPOSER applies and not a second calculation of it. Zero for every style
 * whose record is the pipeline's own depth, so `dossier` is placed exactly
 * where `sheetLayer()` places it — to the pixel.
 */
export function recordOffsetOf(styleId: PosterStyleId, formatId: FormatId): number {
  const g = divisionGeometry(styleId, formatId);
  return (g.sheetOrigin - g.sheet.y) / g.width;
}

/**
 * `SHEET_W_FRACTION` (0.427), recovered from `resolveGeometry`.
 *
 * At 5:7 the width term binds — 0.427 · w against a cap of 0.42 · 1.4w =
 * 0.588w — so `share = 0.427 · w / h`, and dividing by `w / h` returns the
 * constant itself.
 */
export const PIPELINE_SHEET_W_FRACTION = pipelineRecordShare('5:7') / RATIO_VALUE['5:7'];

/** The share of the sheet's AREA the photograph occupies, 0…1. */
export function imageShareOf(styleId: PosterStyleId, formatId: FormatId): number {
  const { image } = getPosterStyle(styleId).rects(formatId);
  return image.w * image.h;
}

/* ------------------------------------------------------------------ */
/* The catalogue                                                       */
/* ------------------------------------------------------------------ */

export const POSTER_STYLES: readonly PosterStyle[] = [
  {
    id: 'full-frame',
    name: 'Full frame',
    designation: 'STY-01',
    summary: 'The photograph, edge to edge. No record.',
    note:
      'The whole sheet is the frame. Only the print credit, the capture stamp and the mission code are set on it, in the corners, the way a credit sits on a film frame. The record still exists — it is the mission file, and the code on the print is how you reach it.',
    bleed: true,
    frameMarks: ['lockup', 'original', 'credit', 'code'],
    recordBlocks: [],
    composer: 'pipeline',
    rects: (formatId) => divisionRects('full-frame', formatId),
  },

  {
    id: 'dossier',
    name: 'Dossier',
    designation: 'STY-02',
    summary: 'Frame above, record sheet below. The standing composition.',
    note:
      'Two grounds: the photograph full-bleed across the top, the record on paper beneath it. It is the composition the product was designed around, and the one every other style is a trade against — the most record for the least picture that still reads as a photograph.',
    bleed: true,
    frameMarks: ['lockup', 'original', 'credit', 'code'],
    recordBlocks: [
      'heading',
      'purpose',
      'personnel',
      'orbit',
      'anomalies',
      'footnote',
      'dedication',
      'link',
      'sequence',
      'target',
      'edge-word',
      'chrome-mark',
    ],
    composer: 'pipeline',
    rects: (formatId) => divisionRects('dossier', formatId),
  },

  {
    id: 'record',
    name: 'Record',
    designation: 'STY-03',
    summary: 'A deeper sheet. The record given the paper.',
    note:
      'The same two grounds with the record taken to the deepest sheet the plate geometry accepts — 42% of the paper against the standing 30%. It carries the identical blocks at the identical size; what it buys is margin, so the record reads as a document with air around it rather than a strip under a picture.',
    bleed: true,
    frameMarks: ['lockup', 'original', 'credit', 'code'],
    recordBlocks: [
      'heading',
      'purpose',
      'personnel',
      'orbit',
      'anomalies',
      'footnote',
      'dedication',
      'link',
      'sequence',
      'target',
      'edge-word',
      'chrome-mark',
    ],
    composer: 'pipeline',
    rects: (formatId) => divisionRects('record', formatId),
  },

  {
    id: 'plate',
    name: 'Mounted plate',
    designation: 'STY-04',
    summary: 'The frame inset in paper, the record in the foot margin.',
    note:
      'The one composition here that does not bleed. The photograph is a window inset in the sheet with a deep foot, the way a plate is mounted, and the record is a ruled caption under it: the mission code, the site, the frame centre and the link to the file. The capture stamp stays on the picture, beside the print credit.',
    bleed: false,
    // The credit stays ON the picture. <CreditBox /> is paper-on-void by
    // construction (see components/fui/CreditBox.tsx) and a paper margin is
    // the one ground it cannot be set on.
    frameMarks: ['lockup', 'credit'],
    recordBlocks: ['heading', 'site', 'target', 'link'],
    composer: 'pipeline',
    rects: (formatId) => divisionRects('plate', formatId),
  },
];

export const DEFAULT_POSTER_STYLE_ID: PosterStyleId = 'dossier';

export function isPosterStyleId(value: unknown): value is PosterStyleId {
  return typeof value === 'string' && POSTER_STYLE_IDS.includes(value as PosterStyleId);
}

/** Throws on an unknown id, the way `getFormat` does — a silent fallback here
 *  would print a composition nobody chose. */
export function getPosterStyle(id: PosterStyleId): PosterStyle {
  const style = POSTER_STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`Unknown poster style: ${id}`);
  return style;
}

/** The division, for one style at one format. The single geometry entry point. */
export function posterStyleRects(id: PosterStyleId, formatId: FormatId): PosterStyleRects {
  return getPosterStyle(id).rects(formatId);
}

/* ------------------------------------------------------------------ */
/* What can actually be manufactured                                   */
/* ------------------------------------------------------------------ */

/**
 * The finishes a style can be printed on.
 *
 * Derived from `FORMATS[].price`, which is the map of what is priced and
 * charged — and which is written against the two Gelato product UIDs in
 * lib/integrations/gelato.ts (200 gsm uncoated white unframed; 200 gsm matt
 * in black wood behind plexiglass, framed). Reading it from pricing rather
 * than from the adapter keeps this file out of the server-only import graph
 * while still answering the only question that matters: is there a product to
 * charge for.
 *
 * It is a function of the style because a style COULD one day be restricted —
 * e.g. a composition that needs a bleed the framed variant's rabbet would
 * eat. None is today, and the honest answer is the same list for all four.
 */
export function posterStyleFinishes(id: PosterStyleId): readonly FrameOption[] {
  // Throws on an id that is not in the catalogue, rather than answering for a
  // style that does not exist.
  getPosterStyle(id);
  return Object.keys(FORMATS[0].price.USD) as FrameOption[];
}

/** Every catalogue size. A style is artwork; it does not restrict the sheet. */
export function posterStyleFormats(id: PosterStyleId): readonly FormatId[] {
  getPosterStyle(id);
  return FORMATS.map((f) => f.id);
}

/**
 * The styles whose print file `composePoster({ styleId })` can produce TODAY.
 *
 * All four. `lib/poster/layout.ts` lays out every division in this catalogue
 * and `buildPlateSvg()` draws the marks and blocks each one declares, so the
 * file the press gets and the object <StyledPoster /> depicts are composed
 * from the same rectangles.
 *
 * THE BAR FOR BEING IN THIS LIST IS A PRINT THAT SOMEBODY LOOKED AT, not a
 * `composer` field somebody typed. A style added to the catalogue starts at
 * `declared` and moves to `pipeline` when its PNG has been generated at F30,
 * F50 and F70 and reviewed. Widening the list any other way is selling a file
 * that may not exist.
 *
 * A purchase surface that must not sell an uncomposable file passes this to
 * <PosterStylePicker available={COMPOSABLE_STYLE_IDS} />.
 */
export const COMPOSABLE_STYLE_IDS: readonly PosterStyleId[] = POSTER_STYLES.filter(
  (s) => s.composer === 'pipeline',
).map((s) => s.id);
