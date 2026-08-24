import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import { FramedPoster } from '@/components/artifact';
import { CreditBox } from '@/components/fui';
import { resolveGeometry } from '@/lib/poster/layout';
import { elapsed, monoColumns, sheetCopy, wrapMono, type SheetCopy } from '@/lib/poster/sheet';
import {
  getPosterStyle,
  posterRatioOf,
  posterStyleRects,
  recordOffsetOf,
  recordScaleOf,
  type FrameMark,
  type PosterStyleId,
  type Rect,
  type RecordBlock,
} from '@/lib/poster/styles';
import type { ResolvedPoster } from '@/lib/poster/types';
import { getFormat } from '@/lib/pricing';
import type { FormatId, FrameOption, OrbitData } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * ==================================================================
 * THE PRINT, IN THE CHOSEN STYLE — a depiction, not a mood board.
 * ==================================================================
 *
 * Renders one entry of `lib/poster/styles.ts` at the true proportion of one
 * entry of `FORMATS`. Everything about it is taken from the print pipeline
 * rather than reinvented for the screen:
 *
 *   DIVISION   `posterStyleRects(styleId, formatId)`, whose fractions are
 *              read straight out of `resolveGeometry(width, ratio, styleId)`
 *              — the function `composePoster()` uses. Every style, not just
 *              the standing one: the depiction and the print file are laid
 *              out from one set of rectangles.
 *   COLUMNS    the sheet's left measure, its right column and its rail come
 *              out of the same `resolveGeometry()` call, as fractions of the
 *              poster width.
 *   SCALE      every size and every baseline below is a constant lifted from
 *              `lib/poster/plate.ts` (`F` for the frame layer, `S` for the
 *              sheet) and expressed in `cqw` — container-query width units.
 *              The plate states each measurement as a fraction of the poster
 *              width, and 1cqw IS one percent of the poster width. So the two
 *              are one instruction written twice, and the depiction holds at
 *              76 px in a picker thumbnail and at 900 px in a preview pane
 *              for exactly the reason the print holds at 700 px and 3543 px.
 *   WORDS      every string on the record comes from `sheetCopy()`, the same
 *              pure function `buildPlateSvg()` calls. Nothing on this sheet
 *              is written here. That is what makes it honest: the component
 *              cannot print a value the record does not produce, because it
 *              has no way to make one up.
 *
 * ------------------------------------------------------------------
 * WHAT IS NOT TAKEN FROM THE PLATE, AND WHY
 * ------------------------------------------------------------------
 * <CreditBox /> sets its own size, in rem, and refuses to be scaled past
 * `md` — a rule enforced inside the component precisely so that no caller can
 * inflate the name (components/fui/CreditBox.tsx). It is therefore the one
 * element here not measured in `cqw`, and it is used at `xs` carrying the
 * capture stamp and nothing else, which is what `frameLayer()` draws and what
 * `components/landing/PosterPreview.tsx` shows. Its POSITION is the plate's.
 *
 * No coordinates are set on the picture, because the plate sets none there.
 * The fix appears once, in the record's TARGET block, at whatever precision
 * `sheetCopy` was told this reader may have (`coordDp`).
 *
 * The record sits on `surface-light` rather than on the plate's literal
 * `#ffffff`, because that class is what hands `--ink` / `--rule` down to
 * everything inside it — the same choice both reference previews make.
 *
 * ------------------------------------------------------------------
 * TWO DENSITIES
 * ------------------------------------------------------------------
 * `detail="print"` sets the type. `detail="thumb"` draws the bar of ink each
 * run of type makes, at the same place and the same cap height, because below
 * roughly 140 px the plate's body size is a third of a pixel and real glyphs
 * there are noise. Both densities run through the same rectangles and the
 * same constants, so a thumbnail cannot show a division the preview lacks.
 */

/* ------------------------------------------------------------------ */
/* The subject                                                         */
/* ------------------------------------------------------------------ */

/**
 * What the print is a record OF. Deliberately the fields `PosterOptions`
 * already carries and not one more: a field here the pipeline does not have
 * would be a field the print cannot carry.
 */
export interface PosterSubject {
  /** `32BF`. Printed as `MISSION / 32BF`. */
  missionCode: string;
  /**
   * ISO 8601. Null before the capture, and then the sheet prints its own
   * `--:--` / `--.--.----` — `sheetCopy`'s answer to no instant — rather than
   * a plausible time.
   */
  capturedAt?: string | null;
  lat: number;
  lon: number;
  /** City level only. `PARIS / ÎLE-DE-FRANCE / FRANCE`. */
  locationLabel: string;
  orbit: OrbitData;
  /** Already through `sanitizeDedication`, or absent. */
  dedication?: string | null;
  /** 4 for the owner's own plate, 2 for every other reader. Defaults to 2. */
  coordDp?: 2 | 4;
  /** `[role, holder]`. Roles against organisations — never a person's name. */
  personnel?: Array<[string, string]>;
  /** No frame on file. The sheet says so rather than printing zeroes. */
  degraded?: boolean;
}

export interface StyledPosterProps {
  styleId: PosterStyleId;
  formatId: FormatId;
  /** `FRAMED` hangs the sheet in the black wood moulding Gelato ships. */
  frame?: FrameOption;
  subject: PosterSubject;
  /** The photograph. `unoptimized` for an API route or a remote tile. */
  image: {
    src: string;
    /** Omit for a decorative depiction; the surface around it does the naming. */
    alt?: string;
    unoptimized?: boolean;
    sizes?: string;
    priority?: boolean;
  };
  detail?: 'print' | 'thumb';
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Constants lifted from lib/poster/plate.ts                           */
/* ------------------------------------------------------------------ */

/**
 * Frame layer — fractions of `u`, the poster width. Mirrors `F` in
 * lib/poster/plate.ts; if those numbers move, these move with them.
 */
const F = {
  /** Height of the lockup's mark. */
  logoMark: 0.0512,
  edgeWord: 0.0181,
  credit: 0.01325,
  display: 0.0343,
  displayStep: 0.0313,
  displayFoot: 0.0614,
  creditFoot: 0.0524,
  /** Outer margin. `resolveGeometry`: `round(0.063 * w)`. */
  margin: 0.063,
  /** The two legibility scrims: 0.28u at 0.46 alpha, 0.30u at 0.50. */
  scrimTop: 0.28,
  scrimBottom: 0.30,
} as const;

/**
 * `/brand/logo-wordmark.svg` is 596 × 124. `F.logoMark` is a HEIGHT, so the
 * width the lockup occupies follows from the asset's own aspect rather than
 * from a second hand-picked number.
 */
const LOGO_WIDTH = F.logoMark * (596 / 124);

/**
 * `F.display` is a CAP-HEIGHT instruction, not a font size — `displayString()`
 * divides it by the resolved face's cap ratio before setting it. IBM Plex
 * Mono's cap height is 0.698 em, and `font-mono` is Plex, so this is that
 * division done once here.
 */
const DISPLAY_SIZE = F.display / 0.698;

/**
 * The credit box's drawn width and height at the plate's credit size:
 * SHOT FROM SPACE is 15 characters at Plex Mono's 0.6 em advance plus the
 * 0.2 em <CreditBox /> tracks it at, with `1.5 · size` of padding either side
 * and one trailing letter-space — 15.2 em in all. Confirmed by measurement:
 * the rendered box is 0.203 of the sheet's width at every reproduction size.
 *
 * Only ever used for the thumbnail's stand-in rectangle; at print detail the
 * real <CreditBox /> measures itself.
 */
const CREDIT_BOX_W = F.credit * 15.2;
const CREDIT_BOX_H = F.credit * 2.6;

/** Sheet layer — fractions of `su`. Mirrors `S` in lib/poster/plate.ts. */
const S = {
  heading: 0.01566,
  code: 0.0232,
  body: 0.0100,
  edgeWord: 0.0108,
  step: 0.0134,
  paraStep: 0.01295,

  headingY: 0.0849,
  paraY: 0.1102,
  personnelY: 0.185,
  personnelRowY: 0.2108,
  personnelValueX: 0.164,
  orbitY: 0.2890,
  orbitR: 0.0313,
  orbitTextX: 0.0916,
  orbitLabelY: 0.2920,
  orbitTrackY: 0.3095,
  anomaliesY: 0.3420,
  footnoteY: 0.3660,
  dedicationGap: 0.0190,
  dedicationRuleGap: 0.0080,
  dedicationRuleW: 0.052,
  dedicationLift: 0.0105,
  dedicationFloor: 0.4010,
  dedicationMaxLines: 2,

  linkY: 0.0669,
  seqLabelY: 0.1075,
  seqRowY: 0.1340,
  targetLabelY: 0.2240,
  targetRowY: 0.2499,

  /** `textRotated('DECLASSIFIED', { x: width − margin·0.3, y: at(0.235) })`. */
  edgeWordY: 0.235,
  edgeWordX: 0.3,
  /** The chrome mark's own box. lib/poster/layout.ts § THE CHROME MARK. */
  markHeight: 0.082,
  markPad: 0.040,
} as const;

/**
 * Tracking in em, per role. The plate carries two columns of these — one for
 * Typestar OCR, one for IBM Plex Mono — and picks by which face resolved.
 * This sheet is set in `font-mono`, which is Plex, so these are the Plex
 * column verbatim.
 */
const TRACK = { label: '0.14em', edge: '0.20em', code: '0.02em', display: '0.18em' } as const;

/**
 * `/brand/mark-3d.png` is 900 × 702 and the chrome object inside it measures
 * 856 × 578; the remaining 124 px at the foot is a baked ambient shadow.
 * `S.markHeight` is the height of the OBJECT, so the canvas is scaled up by
 * the ratio between them and pushed down by that padding — the correction
 * `compose.ts` makes after measuring the asset's alpha channel.
 */
const MARK = { canvasW: 900, canvasH: 702, solidH: 578, footPad: 124 } as const;

/** Probe width for reading column fractions out of `resolveGeometry`. */
const PROBE = 10_000;

/** Where the glyphs sit relative to a baseline: cap height plus ascender. */
const BASELINE_LIFT = 0.78;

/**
 * THE ONE PLACE <CreditBox /> IS RESIZED, AND WHY IT IS ALLOWED HERE.
 *
 * The credit is the only part of this poster that arrives with its own scale:
 * `xs` is 9 px of type with padding in rem, fixed, whatever the sheet is being
 * reproduced at. On a 460 px depiction that lands close to the plate's own
 * 0.01325 · u; on a 300 px one — a framed miniature, a two-up panel — it is
 * half as big again as it should be, and the 15-character label runs straight
 * into MISSION / {code} in the opposite corner. That is not a near miss; it is
 * the depiction printing something the press will not print.
 *
 * So the box is set at the plate's credit size, in the plate's units, by
 * overriding the two sizes on <CreditBox />'s own spans. The rule that
 * component enforces is that no caller may scale the NAME UP past `md` —
 * it is a print credit, not a logo. Bringing it DOWN to the size the press
 * sets it at is that rule being kept, not broken.
 *
 * Written as literals rather than built from `F.credit`, because Tailwind
 * generates utilities by scanning the source: a class assembled at runtime
 * does not exist in the stylesheet. Each number is stated against its source.
 *
 *   font   F.credit                        0.01325  → 1.325cqw
 *   stamp  F.stamp, the capture time       0.0169   → 1.69cqw
 *   padX   1.5 · creditSize (frameLayer)   0.019875 → 1.9875cqw
 *   padY   0.8 · creditSize (frameLayer)   0.0106   → 1.06cqw
 *   gap    0.032 · u (the stamp's offset)           → 3.2cqw
 *
 * The stamp is reached as `span + span`, which exists only when there IS a
 * capture time — so a plate with none cannot accidentally set its own name at
 * the stamp's size.
 *
 * The inset variant is each of those times `markScale(false)`.
 */
const CREDIT_AT_PLATE_SCALE: Record<string, { size: string; gap: string }> = {
  /* window = sheet — every full-bleed style. */
  '1.00': {
    size: '[&_span]:text-[1.325cqw] [&_span]:leading-none [&_span+span]:text-[1.69cqw] [&_span:first-child]:px-[1.9875cqw] [&_span:first-child]:py-[1.06cqw]',
    gap: 'gap-x-[3.2cqw]',
  },
  /* window = 0.82 of the sheet — `plate`, whose picture is inset by
     `PLATE_MARGIN.side` on both edges. Each number above times 0.82. */
  '0.82': {
    size: '[&_span]:text-[1.0865cqw] [&_span]:leading-none [&_span+span]:text-[1.3858cqw] [&_span:first-child]:px-[1.6298cqw] [&_span:first-child]:py-[0.8692cqw]',
    gap: 'gap-x-[2.624cqw]',
  },
};

/**
 * The credit's classes for a window of a given width.
 *
 * A style whose window is not in the table falls back to the full-bleed set,
 * which draws the credit LARGER than it should be — visible at a glance, and
 * therefore fixed rather than shipped. The alternative, quietly picking the
 * nearest row, would put a wrong-sized credit on a print and say nothing.
 */
function creditClasses(windowW: number) {
  return CREDIT_AT_PLATE_SCALE[windowW.toFixed(2)] ?? CREDIT_AT_PLATE_SCALE['1.00'];
}

/* ------------------------------------------------------------------ */
/* Units                                                               */
/* ------------------------------------------------------------------ */

/**
 * A fraction of the poster WIDTH, as CSS. `cqw` is one percent of the
 * container's inline size and the sheet declares itself that container, so
 * `u(0.063)` is the plate's `0.063 * u`, exactly.
 */
const u = (fraction: number) => `${round(fraction * 100)}cqw`;

/** Four decimals is past a subpixel at any plausible size, and keeps the
 *  server and client strings byte-identical. */
function round(n: number): string {
  return String(Number(n.toFixed(4)));
}

/** A rect as absolute CSS. `x`/`w` are of the width, `y`/`h` of the height. */
function place(rect: Rect): CSSProperties {
  return {
    left: `${round(rect.x * 100)}%`,
    top: `${round(rect.y * 100)}%`,
    width: `${round(rect.w * 100)}%`,
    height: `${round(rect.h * 100)}%`,
  };
}

/* ------------------------------------------------------------------ */
/* The component                                                       */
/* ------------------------------------------------------------------ */

export function StyledPoster({
  styleId,
  formatId,
  frame = 'UNFRAMED',
  subject,
  image,
  detail = 'print',
  className,
}: StyledPosterProps) {
  const style = getPosterStyle(styleId);
  const format = getFormat(formatId);
  const rects = posterStyleRects(styleId, formatId);
  const thumb = detail === 'thumb';

  /* The sheet's own scale unit, as a multiple of the poster width. A deeper
     record sets larger type — the pipeline's law, not a decision taken here. */
  const su = recordScaleOf(styleId, formatId);
  /* Surplus depth beyond the sheet the plate's constants were drawn for,
     halved: a deeper record is centred in its paper rather than pinned to the
     top of it. Zero for `dossier`, whose depth IS the pipeline's. */
  const sheetOffset = recordOffsetOf(styleId, formatId);

  /* The columns, as fractions of the width, read off the print geometry. */
  const g = resolveGeometry(PROBE, posterRatioOf(formatId));
  const col: Columns = {
    left: g.left.x / g.width,
    measure: g.left.w / g.width,
    right: g.right.x / g.width,
    rail: g.right.rail / g.width,
    indent: g.right.indent / g.width,
  };

  /**
   * THE FRAME LAYER IS MEASURED AGAINST THE WINDOW, NOT THE SHEET.
   *
   * `F` states every mark, margin and scrim as a fraction of the poster
   * WIDTH, which is the same thing as the picture's width only while the
   * picture bleeds. On a mounted plate the window is 82% of the sheet, and a
   * margin held at 6.3% of the SHEET would start the lockup 7.7% into the
   * PICTURE — the corner would read as mis-cut, and the foot scrim would
   * darken a third of the image instead of a quarter.
   *
   * So one factor, the window's own width, multiplies the whole frame layer.
   * It is 1 for every bleeding style by construction, so nothing about the
   * standing composition is touched by it.
   */
  const windowW = rects.image.w;

  const copy = sheetCopy(toResolved(subject, formatId));

  const sheet = (
    <div
      /* The container every `cqw` on this poster is measured against. */
      style={{ containerType: 'inline-size' }}
      className="relative h-full w-full overflow-hidden bg-paper font-mono"
    >
      {/* ---------- the photograph ---------- */}
      <div className="absolute overflow-hidden bg-void on-dark" style={place(rects.image)}>
        <Image
          src={image.src}
          alt={image.alt ?? ''}
          aria-hidden={image.alt ? undefined : true}
          fill
          unoptimized={image.unoptimized}
          priority={image.priority}
          sizes={image.sizes ?? '(min-width: 1024px) 46vw, 92vw'}
          className="object-cover"
        />

        {/* The plate's two legibility scrims. The frame is a photograph and
            nobody chooses what the satellite saw, so the corners that carry
            type are held down — shallow, so the picture still reads through. */}
        {style.frameMarks.length > 0 ? (
          <>
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 bg-linear-to-b from-void/45 to-transparent"
              style={{ height: u(F.scrimTop * windowW) }}
            />
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 bg-linear-to-t from-void/50 to-transparent"
              style={{ height: u(F.scrimBottom * windowW) }}
            />
          </>
        ) : null}

        <FrameMarks
          marks={style.frameMarks}
          windowW={windowW}
          thumb={thumb}
          code={subject.missionCode}
          capturedAt={subject.capturedAt}
        />

        {/* A mounted plate's window is a cut in the paper and takes the
            sheet's own hairline. A full-bleed frame has no edge to draw. */}
        {style.bleed ? null : (
          <span aria-hidden className="absolute inset-0 border border-[color:rgba(8,9,11,0.32)]" />
        )}
      </div>

      {/* ---------- the record ---------- */}
      {rects.record.h > 0 ? (
        <div className="surface-light absolute ink" style={place(rects.record)}>
          {styleId === 'plate' ? (
            <PlateRail thumb={thumb} copy={copy} site={subject.locationLabel} />
          ) : (
            <RecordSheet
              thumb={thumb}
              su={su}
              offset={sheetOffset}
              col={col}
              copy={copy}
              blocks={style.recordBlocks}
            />
          )}
        </div>
      ) : null}
    </div>
  );

  if (frame === 'FRAMED') {
    /* `wood` is the moulding lib/integrations/gelato.ts actually orders. */
    return (
      <div className={className}>
        <FramedPoster moulding="wood" ratio={format.ratio}>
          {sheet}
        </FramedPoster>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        /*
           THE SHEET'S EDGE FOLLOWS THE GROUND, and it has to.

           This was `border-hairline` — white at 20%, a DARK-ground token. It
           was written when every surface showing a poster was void, where a
           white sheet separates itself and the hairline is just a tidy cut.
           The purchase flow's preview column is now paper, and there the
           token renders LIGHTER than the page: measured across the print
           preview at 1440, the sheet's paper and the stage ground were both
           rgb(238,237,232) — contrast 1.000, byte-identical for 600px — with
           an "edge" at 1.03:1. The print had no edge at all; it dissolved.

           `--rule-strong` follows the ground (white-ish on void, ink-ish on
           paper), so one declaration is correct on both. The cast is what
           makes it read as an OBJECT lying on the page rather than a panel
           drawn on it — the same contact-shadow language `Artifact3D` uses
           for the small artifacts, reduced to a sheet lying flat.
        */
        /* 45% of --ink over the paper ground resolves to rgb(135,134,133)
           = 3.10:1, clearing WCAG 1.4.11's 3:1 for a non-text boundary.
           --rule-strong alone measured 2.13:1 here, which is why this is a
           solved value and not a token: the token is tuned for dividing type,
           this edge separates two surfaces of nearly the same value. */
        'border border-[color-mix(in_oklab,var(--ink)_45%,transparent)]',
        'shadow-[0_1px_2px_rgb(8_9_11/0.10),0_10px_24px_-12px_rgb(8_9_11/0.28)]',
        className,
      )}
      style={{ aspectRatio: format.ratio.replace(':', ' / ') }}
    >
      {sheet}
    </div>
  );
}

/** The sheet's columns, as fractions of the poster width. */
interface Columns {
  left: number;
  measure: number;
  right: number;
  rail: number;
  indent: number;
}

/**
 * `PosterSubject` → `ResolvedPoster`, so `sheetCopy()` is handed the exact
 * structure `composePoster()` hands it. One conversion, and no second
 * vocabulary for the same facts.
 */
function toResolved(subject: PosterSubject, formatId: FormatId): ResolvedPoster {
  return {
    missionCode: subject.missionCode,
    capturedAt: subject.capturedAt ?? '',
    lat: subject.lat,
    lon: subject.lon,
    locationLabel: subject.locationLabel,
    orbit: subject.orbit,
    formatId,
    /* The provenance line the composer defaults to. No style below prints it,
       but `ResolvedPoster` requires it and a wrong value here would be a lie
       waiting for the first style that does. */
    sourceLabel: 'SOURCE / NASA · USGS / PUBLIC DOMAIN',
    /* A depiction inside the product, not a released preview PNG, so it
       carries no PREVIEW wash — the surface around it says what it is. */
    watermark: false,
    degraded: subject.degraded ?? false,
    personnel: subject.personnel,
    dedication: subject.dedication ?? null,
    coordDp: subject.coordDp ?? 2,
  };
}

/* ------------------------------------------------------------------ */
/* Type, and the bar of ink it makes                                   */
/* ------------------------------------------------------------------ */

/**
 * One run of type on the plate.
 *
 * `y` is the BASELINE, the way plate.ts states it. The DOM positions a box by
 * its top, so the run is lifted by `BASELINE_LIFT` of its own size, which
 * puts the glyphs where the SVG puts them.
 *
 * At thumbnail size the run becomes the bar of ink it would make: same place,
 * same cap height, width given by the caller in poster-width fractions. It is
 * a thumbnail and does not pretend to be legible.
 */
function Run({
  y,
  x,
  size,
  bar,
  width,
  lines,
  step,
  align = 'left',
  tracking = TRACK.label,
  thumb,
  className,
  style,
  children,
}: {
  /** Baseline, as a fraction of the poster width. */
  y: number;
  /** Left edge as a fraction of the poster width — or the right edge when
   *  `align="right"`. */
  x: number;
  /** Type size, as a fraction of the poster width. */
  size: number;
  /** Bar width as a fraction of the poster width, for `thumb`. */
  bar?: number;
  /** Measure, as a fraction of the poster width. Set it to let a run wrap. */
  width?: number;
  /** Bars to draw for a wrapped run, in `thumb`. */
  lines?: number;
  /** Leading between those bars, as a fraction of the poster width. */
  step?: number;
  align?: 'left' | 'right';
  tracking?: string;
  thumb?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const side = align === 'right' ? { right: u(1 - x) } : { left: u(x) };

  if (thumb) {
    if (!bar) return null;
    const rows = Math.max(1, lines ?? 1);
    return (
      <>
        {Array.from({ length: rows }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn('absolute block bg-current opacity-55', className)}
            style={{
              ...side,
              top: u(y + i * (step ?? 0) - size * 0.7),
              // The last line of a wrapped run is short, the way a paragraph's
              // last line is short. Nothing more is claimed by it.
              width: u(i === rows - 1 && rows > 1 ? bar * 0.62 : bar),
              height: u(Math.max(size * 0.66, 0.002)),
            }}
          />
        ))}
      </>
    );
  }

  return (
    <span
      className={cn('absolute block uppercase', width ? undefined : 'whitespace-nowrap', className)}
      style={{
        ...side,
        top: u(y - size * BASELINE_LIFT),
        width: width ? u(width) : undefined,
        fontSize: u(size),
        lineHeight: 1,
        letterSpacing: tracking,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* The frame layer                                                     */
/* ------------------------------------------------------------------ */

/**
 * What is set over the photograph: the lockup top-left, the rotated ORIGINAL
 * down the right edge, the print credit with its capture stamp bottom-left,
 * and MISSION / {code} bottom-right — the one display element on the picture.
 *
 * Positions are `F` verbatim. On a style whose picture is inset rather than
 * full-bleed the margin comes down to 60% of the plate's, because the plate's
 * margin is a fraction of the SHEET while the window is 84% of it; held at
 * full width, the lockup would start a third of the way across the picture.
 */
function FrameMarks({
  marks,
  windowW,
  thumb,
  code,
  capturedAt,
}: {
  marks: readonly FrameMark[];
  /** The picture's width as a fraction of the sheet. 1 when it bleeds. */
  windowW: number;
  thumb: boolean;
  code: string;
  capturedAt?: string | null;
}) {
  const k = windowW;
  const m = F.margin * k;
  const credit = creditClasses(windowW);
  const has = (mark: FrameMark) => marks.includes(mark);

  return (
    <>
      {has('lockup') ? (
        thumb ? (
          <span
            aria-hidden
            className="absolute block bg-paper/55"
            style={{
              left: u(m),
              top: u(m * 1.05),
              width: u(LOGO_WIDTH * k),
              height: u(F.logoMark * k),
            }}
          />
        ) : (
          <span
            className="absolute block"
            style={{ left: u(m), top: u(m * 1.05), width: u(LOGO_WIDTH * k) }}
          >
            <Image
              src="/brand/logo-wordmark.svg"
              alt="Shot from Space"
              width={596}
              height={124}
              className="h-auto w-full"
            />
          </span>
        )
      ) : null}

      {has('original') && !thumb ? (
        <span
          aria-hidden
          className="absolute block whitespace-nowrap uppercase text-paper/85 [writing-mode:vertical-rl]"
          style={{
            right: u(m * 0.9),
            top: u(m * 1.1),
            fontSize: u(F.edgeWord * k),
            lineHeight: 1,
            letterSpacing: TRACK.edge,
          }}
        >
          Original
        </span>
      ) : null}

      {has('credit') ? (
        thumb ? (
          <span
            aria-hidden
            className="absolute block border border-paper/45"
            style={{
              left: u(m),
              bottom: u(F.creditFoot * k),
              width: u(CREDIT_BOX_W * k),
              height: u(CREDIT_BOX_H * k),
            }}
          />
        ) : (
          <span
            className={cn(
              'absolute block [&_*]:text-paper', credit.size,
            )}
            style={{ left: u(m), bottom: u(F.creditFoot * k) }}
          >
            {/* Box plus capture stamp, side by side — what `frameLayer()`
                draws. No coordinates: the plate sets none on the picture. */}
            <CreditBox
              size="xs"
              timestamp={capturedAt ?? undefined}
              className={credit.gap}
            />
          </span>
        )
      ) : null}

      {has('code') ? (
        thumb ? (
          <>
            <span
              aria-hidden
              className="absolute block bg-paper/70"
              style={{
                right: u(m),
                bottom: u((F.displayFoot + F.displayStep - F.display * 0.25) * k),
                width: u(DISPLAY_SIZE * 3.6 * k),
                height: u(F.display * k),
              }}
            />
            <span
              aria-hidden
              className="absolute block bg-paper/70"
              style={{
                right: u(m),
                bottom: u((F.displayFoot - F.display * 0.25) * k),
                width: u(DISPLAY_SIZE * 2.2 * k),
                height: u(F.display * k),
              }}
            />
          </>
        ) : (
          <span
            className="absolute block text-right uppercase text-paper"
            style={{
              right: u(m),
              bottom: u((F.displayFoot - F.display * 0.25) * k),
              fontSize: u(DISPLAY_SIZE * k),
              lineHeight: round(F.displayStep / DISPLAY_SIZE),
              letterSpacing: TRACK.display,
            }}
          >
            <span className="block">Mission</span>
            <span data-telemetry className="block">
              {code}
            </span>
          </span>
        )
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The record — the sheet, in the plate's own two columns               */
/* ------------------------------------------------------------------ */

/**
 * The paper half, laid out exactly as `sheetLayer()` lays it out: the left
 * measure carries the lockup, the purpose, the personnel roles, the orbit
 * mark and the two closing statements; the right column carries the link, the
 * sequence of events and the target block, every value hung off one rail. The
 * rotated DECLASSIFIED runs down the right edge and the chrome mark stands in
 * the bottom-right corner, which is why the right column stops above it.
 *
 * `blocks` decides what appears. A style that does not list a block does not
 * print it — and there is no block available that `SheetCopy` does not derive.
 */
function RecordSheet({
  thumb,
  su,
  offset,
  col,
  copy,
  blocks,
}: {
  thumb: boolean;
  /** The sheet's scale unit, as a multiple of the poster width. */
  su: number;
  /** Surplus depth, halved — see `recordOffsetOf` in lib/poster/styles.ts. */
  offset: number;
  col: Columns;
  copy: SheetCopy;
  blocks: readonly RecordBlock[];
}) {
  const has = (block: RecordBlock) => blocks.includes(block);

  /* `at()` and `sz()` are `sheetLayer()`'s own two helpers: a baseline on the
     sheet, and a size on the sheet. Everything below is stated in the plate's
     numbers and converted by exactly these. */
  const at = (f: number) => f * su + offset;
  const sz = (f: number) => f * su;

  const body = sz(S.body);
  const step = sz(S.step);
  const paraStep = sz(S.paraStep);
  const rowX = col.right + col.indent;

  /**
   * A target row is a label hung left and a value hung off the rail. If the
   * two cannot both fit, the label sheds its middle word rather than running
   * into the number — `fitLabel()` in plate.ts, and the same measure: the
   * column's width in characters at Plex Mono's 0.6 em advance plus the
   * 0.14 em of tracking this sheet is set with.
   */
  const rowChars = (col.rail - rowX) / (body * 0.74);
  const fitLabel = (label: string, value: string) =>
    label.length + value.length + 2 <= rowChars ? label : label.replace(' FRAME', '');

  /**
   * THE MEASURE, AND WHY THE LINES BREAK WHERE THE PRINT'S DO.
   *
   * The sheet is set in one monospaced face, so a character count IS a
   * measure — the argument `wrapMono` is built on. Plex Mono advances 0.6 em
   * and this sheet is tracked 0.14 em, so a line of N characters is exactly
   * N · 0.74 em wide, and the left column takes `floor(measure / 0.74 em)` of
   * them. Wrapping here with the pipeline's own function against the
   * pipeline's own measure means the depiction breaks its paragraph where the
   * print breaks it, rather than wherever the browser happens to.
   */
  const measureChars = Math.floor(col.measure / (body * 0.74));
  const paraLines = wrapMono(copy.purpose, measureChars);
  const footLines = wrapMono(copy.footnote, measureChars);

  /* The dedication is the one string a customer typed, so it is wrapped on
     its own terms: hard, because a 120-character "word" has to break, and
     against a measure discounted for any wide code points in it. */
  const dedMeasure = copy.dedication
    ? Math.max(
        8,
        Math.floor((measureChars * copy.dedication.length) / monoColumns(copy.dedication)),
      )
    : measureChars;
  const dedAll = copy.dedication ? wrapMono(copy.dedication, dedMeasure, true) : [];

  /* Two lines of dedication lift the two closing statements into the air
     under the orbit mark; one line fits as the sheet already stands and moves
     nothing. `S.dedicationLift` is bounded by the mark, not by taste. */
  const lift = dedAll.length >= 2 ? S.dedicationLift : 0;
  const footEnd = S.footnoteY - lift + (footLines.length - 1) * S.paraStep;
  const dedFirstY = footEnd + S.dedicationGap;
  const dedRoom = Math.floor((S.dedicationFloor - dedFirstY) / S.paraStep) + 1;
  const dedLines = dedAll.slice(0, Math.max(0, Math.min(S.dedicationMaxLines, dedRoom)));
  /* A clip is SHOWN rather than silently swallowing the rest of a sentence. */
  if (dedLines.length > 0 && dedAll.length > dedLines.length) {
    const last = dedLines[dedLines.length - 1];
    const room = Math.max(1, dedMeasure - 1);
    dedLines[dedLines.length - 1] = `${last.length > room ? last.slice(0, room).trimEnd() : last}…`;
  }

  return (
    <>
      {/* --- left column: the lockup ------------------------------ */}
      {has('heading') ? (
        <Run y={at(S.headingY)} x={col.left} size={body} thumb={thumb} bar={0.14} className="ink">
          <span className="inline-flex items-baseline" style={{ gap: u(body * 0.6) }}>
            <span>{copy.heading.label}</span>
            <span data-telemetry style={{ fontSize: u(sz(S.code)), letterSpacing: TRACK.code }}>
              {copy.heading.code}
            </span>
          </span>
        </Run>
      ) : null}

      {/* --- the purpose, wrapped as the print wraps it ----------- */}
      {has('purpose') ? (
        thumb ? (
          <Run
            y={at(S.paraY)}
            x={col.left}
            size={body}
            bar={col.measure}
            lines={paraLines.length}
            step={paraStep}
            thumb
            className="ink"
          />
        ) : (
          paraLines.map((line, i) => (
            <Run key={line + i} y={at(S.paraY) + i * paraStep} x={col.left} size={body} className="ink">
              {line}
            </Run>
          ))
        )
      ) : null}

      {/* --- mission personnel: roles, and who holds them --------- */}
      {has('personnel') ? (
        <>
          <Run
            y={at(S.personnelY)}
            x={col.left}
            size={body}
            thumb={thumb}
            bar={0.13}
            className="ink"
          >
            Mission personnel
          </Run>
          {copy.personnel.slice(0, 4).map(([role, holder], i) => (
            <span key={role}>
              <Run
                y={at(S.personnelRowY) + i * step}
                x={col.left + col.indent}
                size={body}
                thumb={thumb}
                bar={0.1}
                className="ink"
              >
                {role}
              </Run>
              <Run
                y={at(S.personnelRowY) + i * step}
                x={col.left + sz(S.personnelValueX)}
                size={body}
                thumb={thumb}
                bar={0.12}
                className="ink"
              >
                {holder}
              </Run>
            </span>
          ))}
        </>
      ) : null}

      {/* --- the orbit mark and its track ------------------------- */}
      {has('orbit') ? (
        <>
          <span
            aria-hidden
            className="absolute block ink"
            style={{
              left: u(col.left),
              top: u(at(S.orbitY) - sz(S.orbitR)),
              width: u(2 * sz(S.orbitR)),
              height: u(2 * sz(S.orbitR)),
              opacity: 0.7,
            }}
          >
            <OrbitGlyph />
          </span>
          <Run
            y={at(S.orbitLabelY)}
            x={col.left + sz(S.orbitTextX)}
            size={sz(S.heading)}
            tracking={TRACK.code}
            thumb={thumb}
            bar={0.05}
            className="ink"
          >
            {copy.orbit[0]}
          </Run>
          <Run
            y={at(S.orbitTrackY)}
            x={col.left + sz(S.orbitTextX)}
            size={sz(S.heading)}
            tracking={TRACK.code}
            thumb={thumb}
            bar={0.09}
            className="ink"
          >
            <span data-telemetry>{copy.orbit[1]}</span>
          </Run>
        </>
      ) : null}

      {/* --- the foot: anomalies, footnote, dedication ------------ */}
      {has('anomalies') ? (
        <Run
          y={at(S.anomaliesY - lift)}
          x={col.left}
          size={body}
          thumb={thumb}
          bar={0.11}
          className="ink"
        >
          {copy.anomalies}
        </Run>
      ) : null}

      {has('footnote') ? (
        thumb ? (
          <Run
            y={at(S.footnoteY - lift)}
            x={col.left}
            size={body}
            bar={col.measure}
            lines={footLines.length}
            step={paraStep}
            thumb
            className="ink-dim"
          />
        ) : (
          footLines.map((line, i) => (
            <Run
              key={line + i}
              y={at(S.footnoteY - lift) + i * paraStep}
              x={col.left}
              size={body}
              className="ink-dim"
            >
              {line}
            </Run>
          ))
        )
      ) : null}

      {/* THE DEDICATION. The only line on this sheet a person wrote, and the
          reason the object exists. It FLOWS from the footnote — a short rule,
          a little air, then the words in full ink. No `DEDICATION:` label: a
          dedication on a printed page has never needed one, and a label would
          turn the customer's sentence into one more row of telemetry. */}
      {has('dedication') && dedLines.length > 0 && !thumb ? (
        <>
          <span
            aria-hidden
            className="absolute block border-t rule-ground"
            style={{
              left: u(col.left),
              top: u(at(footEnd + S.dedicationRuleGap)),
              width: u(sz(S.dedicationRuleW)),
            }}
          />
          {dedLines.map((line, i) => (
            <Run
              key={line + i}
              y={at(dedFirstY) + i * paraStep}
              x={col.left}
              size={body}
              className="ink"
            >
              {line}
            </Run>
          ))}
        </>
      ) : null}

      {/* --- right column: the link, with the one accent ---------- */}
      {has('link') ? (
        <Run
          y={at(S.linkY)}
          x={col.rail}
          size={sz(S.heading)}
          align="right"
          tracking={TRACK.code}
          thumb={thumb}
          bar={0.11}
          className="ink"
        >
          <span data-telemetry>
            SHOT.SPACE<span className="text-[color:var(--accent)]">/</span>M{copy.heading.code}
          </span>
        </Run>
      ) : null}

      {/* --- sequence of events ---------------------------------- */}
      {has('sequence') ? (
        <>
          <Run y={at(S.seqLabelY)} x={col.right} size={body} thumb={thumb} bar={0.14} className="ink">
            Sequence of events
          </Run>
          {copy.sequence.length === 0 ? (
            <Run y={at(S.seqRowY)} x={rowX} size={body} thumb={thumb} bar={0.12} className="ink-dim">
              Sequence not on file.
            </Run>
          ) : null}
          {copy.sequence.map((event, i) => (
            <span key={event.label}>
              <Run
                y={at(S.seqRowY) + i * step}
                x={rowX}
                size={body}
                thumb={thumb}
                bar={0.14}
                className="ink"
              >
                {event.label}
              </Run>
              <Run
                y={at(S.seqRowY) + i * step}
                x={col.rail}
                size={body}
                align="right"
                thumb={thumb}
                bar={0.055}
                className="ink"
              >
                <span data-telemetry>{elapsed(event.offset)}</span>
              </Run>
            </span>
          ))}
        </>
      ) : null}

      {/* --- target ---------------------------------------------- */}
      {has('target') ? (
        <>
          <Run y={at(S.targetLabelY)} x={col.right} size={body} thumb={thumb} bar={0.06} className="ink">
            Target
          </Run>
          {copy.target.map(([label, value], i) => (
            <span key={label}>
              <Run
                y={at(S.targetRowY) + i * step}
                x={rowX}
                size={body}
                thumb={thumb}
                bar={0.13}
                className="ink"
              >
                {fitLabel(label, value)}
              </Run>
              <Run
                y={at(S.targetRowY) + i * step}
                x={col.rail}
                size={body}
                align="right"
                thumb={thumb}
                bar={0.085}
                className="ink"
              >
                <span data-telemetry>{value}</span>
              </Run>
            </span>
          ))}
          {copy.targetNotes.map((line, i) => (
            <Run
              key={line}
              y={at(S.targetRowY) + (copy.target.length + i) * step}
              x={rowX}
              size={body}
              thumb={thumb}
              bar={0.15}
              className="ink"
            >
              {line}
            </Run>
          ))}
        </>
      ) : null}

      {/* --- DECLASSIFIED, down the right edge -------------------- */}
      {has('edge-word') && !thumb ? (
        <span
          aria-hidden
          className="absolute block whitespace-nowrap uppercase ink [writing-mode:vertical-rl]"
          style={{
            right: u(F.margin * S.edgeWordX),
            top: u(at(S.edgeWordY)),
            fontSize: u(sz(S.edgeWord)),
            lineHeight: 1,
            letterSpacing: TRACK.edge,
          }}
        >
          Declassified
        </span>
      ) : null}

      {/* --- the chrome mark ------------------------------------- */}
      {has('chrome-mark') && !thumb ? <ChromeMark su={su} rail={col.rail} /> : null}
    </>
  );
}

/**
 * The chrome object printed in the sheet's bottom-right corner — a
 * photographed thing at full opacity, not a watermark behind the type. The
 * canvas correction is documented on `MARK` above.
 */
function ChromeMark({ su, rail }: { su: number; rail: number }) {
  const objectH = S.markHeight * su;
  const canvasH = objectH * (MARK.canvasH / MARK.solidH);
  const canvasW = canvasH * (MARK.canvasW / MARK.canvasH);
  const footPad = canvasH * (MARK.footPad / MARK.canvasH);

  return (
    <span
      aria-hidden
      className="absolute block"
      style={{
        right: u(1 - rail),
        bottom: u(S.markPad * su - footPad),
        width: u(canvasW),
        height: u(canvasH),
      }}
    >
      <Image
        src="/brand/mark-3d.png"
        alt=""
        width={MARK.canvasW}
        height={MARK.canvasH}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

/** The graticule the poster prints beside its orbit readout. */
function OrbitGlyph() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden className="h-full w-full">
      <g stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <circle cx="20" cy="20" r="13" />
        <ellipse cx="20" cy="20" rx="13" ry="5" />
        <ellipse cx="20" cy="20" rx="6.5" ry="13" />
        <line x1="7" y1="14" x2="33" y2="14" />
        <line x1="7" y1="26" x2="33" y2="26" />
      </g>
      <circle cx="20" cy="20" r="2" fill="currentColor" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* The record — a mounted plate's single ruled line                     */
/* ------------------------------------------------------------------ */

/**
 * `plate` does not carry the sheet. It carries the caption a mounted plate
 * carries: what this is, where it was taken and where the rest of the record
 * lives. Four values, all of them `SheetCopy`'s.
 *
 * Laid out in flow rather than at the plate's baselines, because those
 * baselines describe a sheet this style does not have. It is the one
 * composition in the catalogue whose measurements are its own — see
 * `PLATE_MARGIN` in lib/poster/styles.ts.
 */
function PlateRail({
  thumb,
  copy,
  site,
}: {
  thumb: boolean;
  copy: SheetCopy;
  site: string;
}) {
  /* The band's own type scale. It is a caption on paper, not a data sheet, so
     it is set at the plate's heading size rather than its body size. */
  const size = 0.0125;
  const centre = copy.target[0];

  if (thumb) {
    return (
      <span aria-hidden className="absolute inset-x-0 top-0 block">
        <span className="block border-t rule-ground opacity-70" />
        <span
          className="mt-[1.6cqw] block bg-current opacity-55"
          style={{ height: u(size * 0.7), width: u(0.26) }}
        />
        <span
          className="mt-[1.2cqw] block bg-current opacity-40"
          style={{ height: u(size * 0.7), width: u(0.4) }}
        />
      </span>
    );
  }

  return (
    <span className="absolute inset-x-0 top-0 block">
      <span aria-hidden className="block border-t rule-ground" />
      <span
        className="mt-[1.4cqw] flex items-baseline justify-between gap-[4cqw] uppercase"
        style={{ fontSize: u(size), lineHeight: 1.4, letterSpacing: TRACK.label }}
      >
        <span className="min-w-0 truncate ink">
          {copy.heading.label}{' '}
          <span data-telemetry style={{ letterSpacing: TRACK.code }}>
            {copy.heading.code}
          </span>
        </span>
        <span data-telemetry className="shrink-0 ink-dim" style={{ letterSpacing: TRACK.code }}>
          SHOT.SPACE<span className="text-[color:var(--accent)]">/</span>M{copy.heading.code}
        </span>
      </span>
      <span
        className="mt-[1cqw] flex items-baseline justify-between gap-[4cqw] uppercase ink-dim"
        style={{ fontSize: u(size), lineHeight: 1.4, letterSpacing: TRACK.label }}
      >
        <span className="min-w-0 truncate">{site}</span>
        {centre ? (
          <span data-telemetry className="shrink-0" style={{ letterSpacing: TRACK.code }}>
            {centre[1]}
          </span>
        ) : null}
      </span>
    </span>
  );
}
