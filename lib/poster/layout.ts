import { FORMATS, getFormat } from '@/lib/pricing';
import type { FormatId } from '@/lib/types';
import type { PosterRatio, PosterStyleId } from './types';

/* ------------------------------------------------------------------ */
/* Ratios                                                              */
/* ------------------------------------------------------------------ */

/** width / height. */
export const RATIO_VALUE: Record<PosterRatio, number> = {
  '3:4': 3 / 4,
  '5:7': 5 / 7,
  '7:10': 7 / 10,
  '1:1': 1,
};

export function isPosterRatio(value: string): value is PosterRatio {
  return value in RATIO_VALUE;
}

/** Derived from `FORMATS` so the poster can never drift from the catalogue. */
export const FORMAT_RATIO: Record<FormatId, PosterRatio> = FORMATS.reduce(
  (acc, f) => {
    acc[f.id] = isPosterRatio(f.ratio) ? f.ratio : '3:4';
    return acc;
  },
  {} as Record<FormatId, PosterRatio>,
);

/* ------------------------------------------------------------------ */
/* Print intent                                                        */
/* ------------------------------------------------------------------ */

export const PRINT_DPI = 300;
const MM_PER_INCH = 25.4;

export interface PrintIntent {
  formatId: FormatId;
  widthMm: number;
  heightMm: number;
  dpi: number;
  /** Pixel geometry a 300 DPI print file must have at trim size. */
  widthPx: number;
  heightPx: number;
}

/** Trim size in millimetres, read off the catalogue's metric label. */
function trimMm(id: FormatId): { w: number; h: number } {
  const [w, h] = getFormat(id)
    .metric.replace(/CM/i, '')
    .split('×')
    .map((n) => Number(n.trim()) * 10);
  return { w, h };
}

export function printIntent(id: FormatId): PrintIntent {
  const { w, h } = trimMm(id);
  return {
    formatId: id,
    widthMm: w,
    heightMm: h,
    dpi: PRINT_DPI,
    widthPx: Math.round((w / MM_PER_INCH) * PRINT_DPI),
    heightPx: Math.round((h / MM_PER_INCH) * PRINT_DPI),
  };
}

/** F30 3543×4724 · F50 5906×8268 · F70 8268×11811, all at 300 DPI. */
export const PRINT_INTENT: Record<FormatId, PrintIntent> = {
  F30: printIntent('F30'),
  F50: printIntent('F50'),
  F70: printIntent('F70'),
};

/**
 * Hard ceiling on render width. A true F70 print file is 8268 px wide and
 * ~100 MB of PNG; nothing in this product path should ever allocate that on a
 * request thread. The real print file is produced out of band — PIPELINE.md §3.
 */
export const MAX_RENDER_WIDTH = 4800;
export const MIN_RENDER_WIDTH = 240;

export const PREVIEW_WIDTH = 960;
export const POSTER_WIDTH = 2000;

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

/**
 * THE PLATE IS DIVIDED — and there is more than one way to divide it.
 *
 * The standing composition, `dossier`, is two grounds:
 *
 *   ┌───────────────────────────────────────────┐  ┐
 *   │ [logo]                                  O │  │
 *   │                                         R │  │  frame — full bleed,
 *   │            the satellite frame          I │  │  no margin, ~70%
 *   │                                         G │  │
 *   │ [ SHOT FROM SPACE ] 21:34PM   MISSION 32BF│  ┘
 *   ├───────────────────────────────────────────┤  ┐
 *   │ MISSION / 32BF        SHOT.SPACE/M32BF  D │  │
 *   │ purpose paragraph     SEQUENCE OF EVENTS E │  │  sheet — paper white,
 *   │ MISSION PERSONNEL     TARGET            C │  │  dark ink, ~30%
 *   │ (o) ORBIT: //ELIPSE                     L │  │
 *   │ ANOMALIES: NONE            [chrome mark]  │  │
 *   └───────────────────────────────────────────┘  ┘
 *
 * The frame bleeds to all four edges. The sheet is sized off the poster
 * *width*, not its height, because everything in it is type at a fixed
 * measure: a 3:4 plate and a 7:10 plate carry the same sheet at the same
 * physical size, and the picture takes whatever is left. `SHEET_H_CAP` stops
 * a square plate from handing more than 42% of itself to the text.
 *
 * ------------------------------------------------------------------------
 * THE OTHER DIVISIONS
 * ------------------------------------------------------------------------
 * `divide()` below is the whole of the difference between the compositions in
 * lib/poster/styles.ts. Everything downstream — the columns, the chrome
 * mark's corner, the frame layer's own margin — is derived from the four
 * rectangles it returns, so a new division is a case in one function rather
 * than a second layout engine.
 *
 *   full-frame  the picture IS the sheet. `sheet.h === 0`, and the plate
 *               renderer draws no record at all; only the marks that belong
 *               on the photograph are set.
 *   dossier     the standing two grounds, above. The default, and the only
 *               value that existed before divisions were a parameter.
 *   record      the same two grounds with the record taken to `SHEET_H_CAP`
 *               of the HEIGHT rather than `SHEET_W_FRACTION` of the width.
 *               See `sheetOrigin` for why that buys paper and not type.
 *   plate       no bleed at all: the picture is a window cut in the paper,
 *               with a deep foot and a single ruled caption band under it.
 *
 * `resolveGeometry(width, ratio)` — two arguments, no division — is `dossier`
 * and always will be. Every pixel of it is unchanged.
 */

/** Sheet depth as a fraction of poster width — measured off the design. */
const SHEET_W_FRACTION = 0.427;
/** …but never more than this fraction of the poster height. */
const SHEET_H_CAP = 0.42;

/**
 * THE MOUNTED PLATE'S MARGINS, as fractions of the poster WIDTH.
 *
 * A margin is a physical band of paper and does not get deeper because the
 * sheet got taller, so all five are stated against the width and the ratio
 * converts them — which is what lets one set of numbers cut a correct mount
 * at 30 × 40 and at 70 × 100 alike.
 *
 * They live here rather than in styles.ts because the composer has to lay the
 * mount out, and a second copy of these numbers next to the catalogue is
 * exactly how a preview starts lying about a print. styles.ts reads them back
 * out of `resolveGeometry(…, 'plate')`, the way it already reads `dossier`.
 */
const PLATE_MARGIN = {
  /** Left and right. */
  side: 0.09,
  /** Head. Equal to the sides, the way a mount is cut. */
  head: 0.09,
  /** Between the picture's foot and the rule over the caption band. */
  gap: 0.042,
  /** The caption band itself: a rule and two lines. */
  band: 0.065,
  /** Below the band. Head 0.09 against a foot of 0.212 is 1 : 2.4 — a
   *  mounted plate's foot is the deep one, and that is the proportion. */
  foot: 0.105,
} as const;

/**
 * THE CHROME MARK'S CORNER.
 *
 * The mark is a solid object printed on the sheet, not a watermark behind the
 * type: full opacity, bottom-right, with real padding off both edges. Its box
 * lives here rather than in the composer because the *plate* has to know about
 * it too — the sheet's right column ends above `mark.top` so nothing ever
 * runs into it. One rectangle, two readers.
 *
 * Both numbers are fractions of `su`, so the corner keeps its proportions at
 * every render width and on every ratio, capped sheet included.
 */
const MARK_HEIGHT = 0.082;
/* NB: this is the height of the chrome OBJECT, not of the PNG canvas that
   carries it — the asset has a faint baked ambient shadow padding its foot.
   compose.ts measures the object's bounds off the alpha and scales to this. */
/** Padding off the sheet's bottom edge. The right edge uses `right.rail`,
 *  so the mark hangs off the same line every value in the column does. */
const MARK_PAD = 0.040;

/** The division `resolveGeometry` lays out when a caller does not name one. */
export const DEFAULT_DIVISION: PosterStyleId = 'dossier';

export interface Geometry {
  width: number;
  height: number;
  ratio: PosterRatio;
  /** Which division these rectangles are. */
  division: PosterStyleId;
  /** Does the photograph run to all four edges? False only for `plate`. */
  bleed: boolean;
  /** Outer margin for type on both grounds. */
  margin: number;
  /** The satellite frame. Full bleed on every division but `plate`. */
  frame: { x: number; y: number; w: number; h: number };
  /**
   * The frame layer's own margin — `round(0.063 · frame.w)`.
   *
   * `margin` is a fraction of the SHEET, which is the same thing as a fraction
   * of the picture only while the picture bleeds. On a mounted plate the
   * window is 82% of the paper, and a margin held at the sheet's value would
   * start the lockup 7.7% into the PICTURE and darken a third of it with the
   * foot scrim. Equal to `margin` on every bleeding division, by construction.
   */
  frameMargin: number;
  /** The record. `h === 0` on a division that carries none. */
  sheet: { x: number; y: number; w: number; h: number };
  /**
   * The paper ground, drawn under everything. The record's own rectangle on
   * the two-ground divisions; the WHOLE POSTER on `plate`, whose picture is a
   * window cut in the paper; nothing at all on `full-frame`.
   */
  paper: { x: number; y: number; w: number; h: number };
  /** Scale unit for the frame layer — the poster width. */
  u: number;
  /**
   * Scale unit for the sheet layer. Equal to `u` unless the sheet was capped,
   * in which case the whole sheet — type, leading, the orbit mark — scales
   * down together rather than colliding. NEVER greater than `u`: see
   * `sheetOrigin`.
   */
  su: number;
  /**
   * The datum every baseline on the record is measured from — the sheet
   * renderer's `at(f) = sheetOrigin + f · su`.
   *
   * WHY IT IS NOT SIMPLY `sheet.y`. In `dossier` it is: `su = sheet.h / 0.427`
   * exactly, so the block of type is precisely as deep as the paper under it
   * and there is nothing to place. `record` takes a DEEPER sheet — 42% of the
   * height — and there `su` would want to run past the poster width. It is
   * clamped instead, and this is what the clamp costs and buys.
   *
   * Every size and leading on the record is a fraction of `su`, but the
   * COLUMNS it is set in — the left measure, the right column, the rail — are
   * fractions of `u` and do not move. So an unclamped `su` would set bigger
   * type into columns that stayed the same width, and the plate's own numbers
   * would stop agreeing with each other: the purpose paragraph would take more
   * lines than the gap before MISSION PERSONNEL allows, and a 23-character
   * sequence label would run into its elapsed time.
   *
   * So the record-forward division buys PAPER rather than TYPE. The surplus
   * depth is split above and below the block, and `sheetOrigin` is `sheet.y`
   * plus that half — the record centred in the paper it was given rather than
   * pinned to the top of it with a band of nothing underneath.
   */
  sheetOrigin: number;
  /** Left text column of the sheet: heading, paragraph, personnel, orbit. */
  left: { x: number; w: number };
  /**
   * Right data column: link, sequence of events, target, anomalies.
   * `rail` is the right-hand alignment edge every value in it hangs off.
   */
  right: { x: number; rail: number; indent: number };
  /**
   * The chrome mark's box on the sheet, in absolute px. `right` and `bottom`
   * are the edges it is hung off; `height` is what the artwork is scaled to,
   * its width following from the asset's own aspect. `top` is the line the
   * sheet's right column must stay above.
   */
  mark: { right: number; bottom: number; height: number; top: number };
  /**
   * Kept for the composer: the region a source frame is fitted into. Same
   * rectangle as `frame`, under the name the pipeline has always used.
   */
  image: { x: number; y: number; w: number; h: number };
}

/** What a division decides, and the only thing it decides. */
interface Division {
  bleed: boolean;
  frame: { x: number; y: number; w: number; h: number };
  sheet: { x: number; y: number; w: number; h: number };
  paper: { x: number; y: number; w: number; h: number };
  su: number;
  sheetOrigin: number;
}

/**
 * The four cuts, in whole pixels. Everything else in `resolveGeometry` is
 * common to all of them.
 */
function divide(division: PosterStyleId, w: number, h: number): Division {
  if (division === 'full-frame') {
    /* No record. `sheet.h === 0` is how every reader downstream knows: the
       plate draws no sheet layer, the composer composites no chrome mark, and
       `su` is 0 because there is no sheet to scale. */
    const frame = { x: 0, y: 0, w, h };
    const none = { x: 0, y: h, w, h: 0 };
    return { bleed: true, frame, sheet: none, paper: { x: 0, y: 0, w: 0, h: 0 }, su: 0, sheetOrigin: h };
  }

  if (division === 'plate') {
    /* A window cut in paper. Each margin is rounded on its own so the four
       edges land on whole pixels and the picture keeps the leftovers. */
    const side = Math.round(PLATE_MARGIN.side * w);
    const head = Math.round(PLATE_MARGIN.head * w);
    const gap = Math.round(PLATE_MARGIN.gap * w);
    const band = Math.round(PLATE_MARGIN.band * w);
    const foot = Math.round(PLATE_MARGIN.foot * w);
    const frame = { x: side, y: head, w: w - side * 2, h: h - head - gap - band - foot };
    const sheet = { x: side, y: frame.y + frame.h + gap, w: frame.w, h: band };
    return {
      bleed: false,
      frame,
      sheet,
      // The mount is paper edge to edge; the picture is a hole in it.
      paper: { x: 0, y: 0, w, h },
      su: sheet.h / SHEET_W_FRACTION,
      sheetOrigin: sheet.y,
    };
  }

  /* Two grounds. `dossier` sizes the record off the WIDTH and caps it against
     the height; `record` takes the cap itself, at every ratio. */
  const deep = division === 'record';
  const sheetH = deep
    ? Math.round(SHEET_H_CAP * h)
    : Math.round(Math.min(SHEET_W_FRACTION * w, SHEET_H_CAP * h));

  const frame = { x: 0, y: 0, w, h: h - sheetH };
  const sheet = { x: 0, y: h - sheetH, w, h: sheetH };

  /* `dossier`'s sheet is 0.427 · w deep BY DEFINITION, so its scale unit is
     the poster width and its block of type fills the paper exactly: nothing
     to clamp, nothing to centre, and — the point — not one pixel of it moved
     when divisions became a parameter. The arithmetic below is stated only
     for the deep sheet because only the deep sheet has a surplus to place.

     `su` may never exceed `u`. See `Geometry.sheetOrigin` for what the clamp
     costs and what it buys. */
  if (!deep) {
    return {
      bleed: true,
      frame,
      sheet,
      paper: sheet,
      su: sheetH / SHEET_W_FRACTION,
      sheetOrigin: sheet.y,
    };
  }

  const su = Math.min(w, sheetH / SHEET_W_FRACTION);
  return {
    bleed: true,
    frame,
    sheet,
    paper: sheet,
    su,
    sheetOrigin: sheet.y + (sheetH - SHEET_W_FRACTION * su) / 2,
  };
}

export function resolveGeometry(
  width: number,
  ratio: PosterRatio,
  division: PosterStyleId = DEFAULT_DIVISION,
): Geometry {
  const w = Math.round(width);
  const h = Math.round(w / RATIO_VALUE[ratio]);

  const cut = divide(division, w, h);
  const { frame, sheet, paper, su } = cut;

  const m = Math.round(0.063 * w);

  // Two columns with a wide gutter — the sheet reads as two independent
  // documents side by side, which is what a real mission sheet looks like.
  const rightX = Math.round(0.690 * w);
  const leftW = Math.round(0.44 * w);

  const railX = Math.round(w - m * 0.62);
  const markH = Math.round(MARK_HEIGHT * su);
  const markBottom = Math.round(sheet.y + sheet.h - MARK_PAD * su);

  return {
    width: w,
    height: h,
    ratio,
    division,
    bleed: cut.bleed,
    margin: m,
    u: w,
    su,
    frame,
    frameMargin: Math.round(0.063 * frame.w),
    sheet,
    paper,
    sheetOrigin: cut.sheetOrigin,
    image: frame,
    left: { x: m, w: leftW },
    right: { x: rightX, rail: railX, indent: Math.round(0.017 * su) },
    mark: { right: railX, bottom: markBottom, height: markH, top: markBottom - markH },
  };
}

export function clampWidth(width: number): number {
  if (!Number.isFinite(width)) return PREVIEW_WIDTH;
  return Math.min(MAX_RENDER_WIDTH, Math.max(MIN_RENDER_WIDTH, Math.round(width)));
}
