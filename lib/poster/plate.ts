import { formatTelemetryTimestamp } from '@/lib/utils';
import { detailChars, detailWidth, displaySafe, type FontStack } from './fonts';
import { type Geometry } from './layout';
import { logoLockup, orbitGlobe } from './marks';
import { elapsed, monoColumns, sheetCopy, wrapMono } from './sheet';
import { getPosterStyle, type FrameMark, type RecordBlock } from './styles';
import {
  INK,
  box,
  circle,
  fillRect,
  rule,
  scrim,
  text,
  textRotated,
  vrule,
  svgDocument,
} from './svg';
import type { ResolvedPoster } from './types';

/**
 * THE PLATE — everything printed on the poster, as one SVG string.
 *
 * The plate is a two-ground object, and that split is the whole design:
 *
 *   ── DARK, full bleed, ~70% ───────────────────────────────────────────
 *     the satellite frame, edge to edge, no border and no well
 *     · the logo lockup, top left
 *     · ORIGINAL, turned a quarter and set down the right edge
 *     · [ SHOT FROM SPACE ] beside the capture timestamp, bottom left
 *     · MISSION 32BF in wide display type, bottom right
 *
 *   ── PAPER, ~30% ───────────────────────────────────────────────────────
 *     left    MISSION / 32BF · the purpose of the mission, in sentences ·
 *             MISSION PERSONNEL · the orbit mark and ORBIT: //ELIPSE 33° ·
 *             ANOMALIES · the footnote that says what range zero is
 *     right   SHOT.SPACE/M32BF · SEQUENCE OF EVENTS as elapsed times from
 *             range zero · TARGET, actual against planned
 *     corner  the chrome mark, bottom right — a solid object at full opacity
 *             with its own drop shadow, composited by compose.ts because it
 *             is a photograph, not a drawing. `g.mark` is the rectangle it
 *             owns and no line of type is set inside it.
 *     edge    DECLASSIFIED, turned a quarter
 *
 * Two colours of ink and one accent, spent on exactly one element per plate:
 * `LOW RESOLUTION` on a preview, the slash in `SHOT.SPACE/M32BF` otherwise.
 *
 * ------------------------------------------------------------------------
 * TWO FACES, THE SAME TWO THE SCREEN USES
 * ------------------------------------------------------------------------
 * `fonts.display` (Ductile Display) takes the mission code and nothing else:
 * the `MISSION / 32BF` lockup on the sheet and the two-line lockup on the
 * frame. `fonts.detail` (Typestar OCR) takes everything that is a fact rather
 * than an identity — telemetry, the sequence-of-events table, the target rows,
 * every label, the prose and the two edge words.
 *
 * Three consequences run through this file:
 *
 *   1. NOTHING is set in the display face without going through
 *      `displayString()`. Ductile is caps-only with an 81-glyph cmap and
 *      pango's fallback is per-glyph and silent, so a lowercase letter or a
 *      `°` would change face mid-word without anything failing.
 *   2. Every width comes from `detailWidth`/`detailChars`, which use the
 *      advance the font probe MEASURED. Typestar is 0.664em against Plex's
 *      0.600em: hard-coding 0.6 would put the credit box, the slash inside
 *      `SHOT.SPACE/M32BF` and every wrap measure out by 11%.
 *   3. Tracking is a property of the face, not of the plate — `tracking()`.
 *      Typestar is 11% wider per character and needs materially less of it;
 *      carrying the mono values over would blow a nine-character coordinate
 *      to the width of a sentence. The numbers match app/globals.css.
 *
 * If a face does not resolve, `resolveFontStack` says so and the role falls
 * back to IBM Plex Mono with the mono tracking — visibly the old plate, never
 * a silent half-substitution.
 */

/* ------------------------------------------------------------------ */
/* Scale                                                               */
/* ------------------------------------------------------------------ */

/** Frame layer — fractions of the poster width. */
const F = {
  logoMark: 0.0512,
  edgeWord: 0.0181,
  credit: 0.01325,
  stamp: 0.0169,
  display: 0.0343,
  displayStep: 0.0313,
  displayFoot: 0.0614,
  creditFoot: 0.0524,
} as const;

/** Sheet layer — fractions of `su`, the sheet's own scale unit. */
const S = {
  heading: 0.01566,
  /**
   * The mission code in the sheet's lockup, stated in DETAIL-FACE terms: the
   * display size is multiplied by `fonts.displayScale`, so this number is a
   * cap-height instruction rather than a font size and it means the same thing
   * whichever face ends up setting it. The word `MISSION /` beside it stays at
   * `body`, which is the split <MissionRef> makes on screen — the word is a
   * label, the code is the display element.
   */
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

  /* The foot of the sheet, both statements set at the left measure. They read
     as the page's closing lines, and moving them off the right column is what
     clears the bottom-right corner for the chrome mark. */
  anomaliesY: 0.3420,
  footnoteY: 0.3660,
  /* THE DEDICATION sits at the foot of the left measure, under a short rule.

     It FLOWS from the footnote rather than being pinned, because the footnote
     is wrapped to a measure that depends on the face and the render width — a
     fixed Y would collide with it the first time it took a third line.

     And when the dedication needs TWO lines the two statements above it lift
     by `dedicationLift`, into the air under the orbit mark. One line fits
     under the footnote as the sheet already stands, so the common case moves
     nothing at all. Without that the
     dedication would be squeezed into the ~46 px between the footnote and the
     paper's edge and read as an afterthought pushed off the page. The lift is
     bounded by the mark, not by taste: the globe's lowest point is
     orbitY + orbitR = 0.3203, and 0.0105 is what puts the cap-line of
     ANOMALIES just clear of it.

     `dedicationFloor` is the last baseline the sheet will accept. Lines that
     do not fit above it are dropped and the last one printed takes an ellipsis
     — type running off the paper is worse than a dedication that stops. The
     left measure only: the bottom-right corner belongs to the chrome mark. */
  dedicationLift: 0.0105,
  dedicationRuleGap: 0.0080,
  dedicationGap: 0.0190,
  dedicationRuleW: 0.052,
  dedicationFloor: 0.4010,
  dedicationMaxLines: 2,

  linkY: 0.0669,
  seqLabelY: 0.1075,
  seqRowY: 0.1340,
  targetLabelY: 0.2240,
  targetRowY: 0.2499,
} as const;

/**
 * Tracking, in em, per role — and it depends on which face resolved.
 *
 * The mono column is the plate's original setting, tuned against IBM Plex Mono
 * at 0.600em. Typestar OCR is 11% wider per character with a 6% larger
 * x-height, so it needs materially less air to stay open: the same argument
 * app/globals.css makes when it sets the detail ramp at 0.06–0.08em against
 * the mono ramp's 0.14–0.20em. Ductile is wider still (≈1.0em advance) and the
 * mission file sets its lockup at 0.02em, which is what the plate uses too.
 *
 *                      Plex   Typestar/Ductile
 *   label / rows       0.14   0.07
 *   edge words         0.20   0.10
 *   code (link, sheet) 0.02   0.02
 *   display lockup     0.18   0.02
 */
interface Tracking {
  label: number;
  display: number;
  edge: number;
  code: number;
}

function tracking(fonts: FontStack): Tracking {
  const detail = fonts.source.detail === 'typestar';
  return {
    label: detail ? 0.07 : 0.14,
    edge: detail ? 0.10 : 0.20,
    code: 0.02,
    display: fonts.source.display === 'ductile' ? 0.02 : 0.18,
  };
}

/**
 * `line`, ending in an ellipsis, still inside `maxChars`. Used when a
 * dedication has more to say than the foot of the sheet has room for.
 */
function clip(line: string, maxChars: number): string {
  const room = Math.max(1, maxChars - 1);
  return `${line.length > room ? line.slice(0, room).trimEnd() : line}…`;
}

/**
 * A string on its way into the display face.
 *
 * Uppercased at source — Ductile ships no lowercase at all — and checked
 * against the face's real cmap. Anything it cannot set (a `°`, an accented
 * city name, a stray symbol) comes back with the detail face instead, because
 * the alternative is pango silently swapping face for that one glyph and
 * nobody finding out until the print arrives.
 */
function displayString(
  fonts: FontStack,
  value: string,
): { value: string; family: string; scale: number } {
  const upper = value.toUpperCase();
  return displaySafe(fonts, upper)
    ? { value: upper, family: fonts.display, scale: fonts.displayScale }
    : { value: upper, family: fonts.detail, scale: 1 };
}

/**
 * Halo width for white type on the photograph, as a fraction of the size.
 * The sheet needs none — it is ink on paper.
 */
const HALO = 0.14;

/* ------------------------------------------------------------------ */
/* Preview treatment                                                   */
/* ------------------------------------------------------------------ */

/**
 * `PREVIEW / NOT FOR PRINT`, repeated on a −32° diagonal. Legible from across
 * a room, destroys nothing: the frame reads through it, which is the point.
 *
 * The wash crosses both grounds, so each repetition picks its own ink from
 * where it actually lands after the rotation — white over the photograph,
 * near-black over the paper. Computed per repetition rather than clipped:
 * librsvg's clipping is the least reliable thing in the renderer.
 */
function watermarkWash(g: Geometry, fonts: FontStack): string {
  const TRACK = tracking(fonts);
  const size = 0.023 * g.u;
  const label = 'PREVIEW / NOT FOR PRINT';
  const w = detailWidth(fonts, label, size, TRACK.edge);
  const stepX = w + 0.12 * g.u;
  const stepY = 0.135 * g.u;
  const span = Math.max(g.width, g.height) * 1.7;
  const cx = g.width / 2;
  const cy = g.height / 2;
  const a = (-32 * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);

  const rows: string[] = [];
  let row = 0;
  for (let y = cy - span / 2; y <= cy + span / 2; y += stepY) {
    const offset = (row % 2) * (stepX / 2);
    for (let x = cx - span / 2 + offset; x <= cx + span / 2; x += stepX) {
      // Where this repetition ends up once the group is rotated.
      const landedY = cy + (x - cx) * sin + (y - cy) * cos;
      // Which ground it landed on decides its ink. On the two-ground
      // divisions that is simply "below the record's top edge"; on a mounted
      // plate the paper is everywhere the picture is not.
      const onSheet = g.bleed
        ? landedY > g.sheet.y
        : landedY <= g.frame.y || landedY >= g.frame.y + g.frame.h;
      rows.push(
        text(label, {
          x,
          y,
          size,
          family: fonts.detail,
          fill: onSheet ? INK.sheetInk : INK.paper,
          tracking: TRACK.edge,
          opacity: onSheet ? 0.07 : 0.085,
        }),
      );
    }
    row += 1;
  }
  return `<g transform="rotate(-32 ${cx} ${cy})">${rows.join('')}</g>`;
}

/** The one accent element on a preview: a signal-orange tag on the frame. */
function lowResTag(g: Geometry, fonts: FontStack): string {
  const TRACK = tracking(fonts);
  // On the picture, under the lockup — so it is measured in the picture's own
  // unit, exactly as `frameLayer()` measures everything it sets there.
  const u = g.frame.w;
  const size = F.credit * u;
  const label = 'LOW RESOLUTION';
  const padX = 0.9 * size;
  const padY = 0.62 * size;
  const bw = detailWidth(fonts, label, size, TRACK.edge) + padX * 2;
  const bh = size + padY * 2;
  const x = g.frame.x + g.frameMargin;
  const y = g.frame.y + g.frameMargin + F.logoMark * u * 2.1;
  return (
    fillRect(x, y, bw, bh, INK.void, 0.8) +
    box(x, y, bw, bh, INK.signal, Math.max(1, g.u * 0.0009), size * 0.28) +
    text(label, {
      x: x + padX,
      y: y + padY + size * 0.82,
      size,
      family: fonts.detail,
      fill: INK.signal,
      tracking: TRACK.edge,
      weight: 500,
    })
  );
}

/* ------------------------------------------------------------------ */
/* The frame half                                                      */
/* ------------------------------------------------------------------ */

/**
 * What is set OVER the photograph.
 *
 * Every number here is a fraction of the PICTURE'S width, not the sheet's.
 * On the three bleeding divisions those are the same number and this layer is
 * exactly what it always was, to the pixel. On a mounted plate the window is
 * 82% of the paper, and a margin held at the sheet's value would start the
 * lockup 7.7% into the picture and darken a third of it with the foot scrim —
 * so one factor, the window's own width, runs through the whole layer.
 *
 * `marks` decides what appears, and it is the style's own list from
 * lib/poster/styles.ts rather than a second one kept here.
 */
function frameLayer(
  data: ResolvedPoster,
  g: Geometry,
  fonts: FontStack,
  marks: readonly FrameMark[],
): string {
  const TRACK = tracking(fonts);
  /* The picture's own scale unit and its four edges. */
  const u = g.frame.w;
  const m = g.frameMargin;
  const left = g.frame.x;
  const top = g.frame.y;
  const right = g.frame.x + g.frame.w;
  const bottom = g.frame.y + g.frame.h;
  const has = (mark: FrameMark) => marks.includes(mark);
  const parts: string[] = [];

  // Legibility scrims. The frame is a photograph and we do not get to choose
  // what the satellite saw, so the four corners that carry type are held down
  // a little. Deliberately shallow — the picture still reads through. A
  // division that sets nothing on the picture needs none of it.
  if (marks.length > 0) {
    parts.push(
      scrim('scrim-t', left, top, g.frame.w, 0.28 * u, 0.46, 0),
      scrim('scrim-b', left, bottom - 0.30 * u, g.frame.w, 0.30 * u, 0, 0.50),
    );
  }

  /* --- logo lockup, top left ----------------------------------- */
  if (has('lockup')) {
    parts.push(logoLockup(left + m, Math.round(top + m * 1.05), F.logoMark * u, fonts, INK.paper).svg);
  }

  /* --- ORIGINAL, down the right edge --------------------------- */
  if (has('original')) {
    parts.push(
      textRotated('ORIGINAL', {
        x: right - m * 0.9,
        y: top + m * 1.1,
        size: F.edgeWord * u,
        family: fonts.detail,
        fill: INK.paper,
        tracking: TRACK.edge,
        weight: 500,
        halo: HALO,
      }),
    );
  }

  /* --- credit box + capture stamp, bottom left ----------------- */
  if (has('credit')) {
    const creditSize = F.credit * u;
    const label = 'SHOT FROM SPACE';
    const padX = 1.5 * creditSize;
    const padY = 0.8 * creditSize;
    const bw = detailWidth(fonts, label, creditSize, TRACK.edge) + padX * 2;
    const bh = creditSize + padY * 2;
    const by = bottom - F.creditFoot * u - bh;
    const baseline = by + padY + creditSize * 0.74;
    parts.push(
      box(left + m, by, bw, bh, INK.paper, Math.max(1, u * 0.0011), creditSize * 0.42),
      text(label, {
        x: left + m + padX,
        y: baseline,
        size: creditSize,
        family: fonts.detail,
        fill: INK.paper,
        tracking: TRACK.edge,
        weight: 500,
        halo: HALO,
      }),
      text(formatTelemetryTimestamp(data.capturedAt), {
        x: left + m + bw + 0.032 * u,
        y: baseline,
        size: F.stamp * u,
        family: fonts.detail,
        fill: INK.paper,
        tracking: 0.02,
        weight: 500,
        halo: HALO,
      }),
    );
  }

  /* --- MISSION 32BF, bottom right ------------------------------ */
  // The one display element on the photograph, and the largest type on the
  // plate. `F.display` is a cap-height instruction: `displayString` scales it
  // by the face's own cap ratio, so Ductile lands at the height the plate was
  // drawn at rather than a quarter taller.
  if (has('code')) {
    const word = displayString(fonts, 'MISSION');
    const codeMark = displayString(fonts, data.missionCode);
    const displayY = bottom - F.displayFoot * u;
    parts.push(
      text(word.value, {
        x: right - m,
        y: displayY - F.displayStep * u,
        size: F.display * u * word.scale,
        family: word.family,
        fill: INK.paper,
        tracking: TRACK.display,
        weight: 500,
        anchor: 'end',
        halo: HALO,
      }),
      text(codeMark.value, {
        x: right - m,
        y: displayY,
        size: F.display * u * codeMark.scale,
        family: codeMark.family,
        fill: INK.paper,
        tracking: TRACK.display,
        weight: 500,
        anchor: 'end',
        halo: HALO,
      }),
    );
  }

  /* --- the window's edge --------------------------------------- */
  // A mounted plate's picture is a cut in the paper, and the cut is drawn as
  // the picture's own edge rather than as a rule on the mount: the sheet's ink
  // at 32%, which is the same hairline <StyledPoster /> puts round the window.
  // A full-bleed frame has no edge to draw.
  if (!g.bleed) {
    parts.push(
      box(left, top, g.frame.w, g.frame.h, INK.sheetInk, Math.max(1, u * 0.0013), 0, 0.32),
    );
  }

  return parts.join('');
}

/* ------------------------------------------------------------------ */
/* The sheet half                                                      */
/* ------------------------------------------------------------------ */

function sheetLayer(
  data: ResolvedPoster,
  g: Geometry,
  fonts: FontStack,
  blocks: readonly RecordBlock[],
): string {
  const TRACK = tracking(fonts);
  const su = g.su;
  /* The datum, not the paper's top edge — a record given more paper than its
     block of type needs is CENTRED in it. Identical to `g.sheet.y` on the
     standing division, where there is no surplus. See `Geometry.sheetOrigin`. */
  const y0 = g.sheetOrigin;
  const at = (f: number) => y0 + f * su;
  const has = (block: RecordBlock) => blocks.includes(block);
  const ink = INK.sheetInk;
  const body = S.body * su;
  const step = S.step * su;
  const parts: string[] = [];

  const copy = sheetCopy(data);
  const railRight = g.right.rail;
  const colX = g.right.x;
  const rowX = colX + g.right.indent;

  /* --- left column: the lockup --------------------------------- */
  // `MISSION /` is a label and stays at the detail size; the code is the
  // display element and is set in Ductile beside it, on the same baseline.
  const headCode = displayString(fonts, copy.heading.code);
  if (has('heading')) parts.push(
    text(copy.heading.label, {
      x: g.left.x,
      y: at(S.headingY),
      size: body,
      family: fonts.detail,
      fill: ink,
      tracking: TRACK.label,
      weight: 500,
    }),
    text(headCode.value, {
      x: g.left.x + detailWidth(fonts, `${copy.heading.label} `, body, TRACK.label),
      y: at(S.headingY),
      size: S.code * su * headCode.scale,
      family: headCode.family,
      fill: ink,
      tracking: TRACK.code,
      weight: 500,
    }),
  );

  const paraChars = detailChars(fonts, g.left.w, body);
  if (has('purpose')) wrapMono(copy.purpose, paraChars).forEach((line, i) => {
    parts.push(
      text(line, {
        x: g.left.x,
        y: at(S.paraY) + i * S.paraStep * su,
        size: body,
        family: fonts.detail,
        fill: ink,
      }),
    );
  });

  if (has('personnel')) parts.push(
    text('MISSION PERSONNEL', {
      x: g.left.x,
      y: at(S.personnelY),
      size: body,
      family: fonts.detail,
      fill: ink,
    }),
  );
  if (has('personnel')) copy.personnel.slice(0, 4).forEach(([role, holder], i) => {
    const y = at(S.personnelRowY) + i * step;
    parts.push(
      text(role, {
        x: g.left.x + g.right.indent,
        y,
        size: body,
        family: fonts.detail,
        fill: ink,
      }),
      text(holder, {
        x: g.left.x + S.personnelValueX * su,
        y,
        size: body,
        family: fonts.detail,
        fill: ink,
      }),
    );
  });

  /* --- orbit mark + track -------------------------------------- */
  const r = S.orbitR * su;
  if (has('orbit')) parts.push(
    orbitGlobe(g.left.x + r, at(S.orbitY), r, ink, Math.max(1, su * 0.0013)),
    text(copy.orbit[0], {
      x: g.left.x + S.orbitTextX * su,
      y: at(S.orbitLabelY),
      size: S.heading * su,
      family: fonts.detail,
      fill: ink,
      tracking: TRACK.code,
    }),
    text(copy.orbit[1], {
      x: g.left.x + S.orbitTextX * su,
      y: at(S.orbitTrackY),
      size: S.heading * su,
      family: fonts.detail,
      fill: ink,
      tracking: TRACK.code,
    }),
  );

  /* --- the foot: the anomalies statement, then the footnote ----- */
  // Wrapped before anything is placed, because the block's POSITION depends on
  // how many lines the dedication turns out to need: one line fits under the
  // footnote as the sheet already stands, two do not, and only the second case
  // pays for the lift.
  const footChars = detailChars(fonts, g.left.w, body);
  const footLines = wrapMono(copy.footnote, footChars);
  // The dedication is the one string here a customer typed, so it is wrapped
  // on its own terms: `hard`, because a single 120-character "word" has to
  // break rather than run off the measure, and against a measure discounted
  // for any wide code points in it (`monoColumns`).
  const dedMeasure = copy.dedication
    ? Math.max(8, Math.floor((footChars * copy.dedication.length) / monoColumns(copy.dedication)))
    : footChars;
  const dedLines =
    copy.dedication && has('dedication') ? wrapMono(copy.dedication, dedMeasure, true) : [];
  const lift = dedLines.length >= 2 ? S.dedicationLift : 0;
  if (has('anomalies')) parts.push(
    text(copy.anomalies, {
      x: g.left.x,
      y: at(S.anomaliesY - lift),
      size: body,
      family: fonts.detail,
      fill: ink,
    }),
  );
  if (has('footnote')) footLines.forEach((line, i) => {
    parts.push(
      text(line, {
        x: g.left.x,
        y: at(S.footnoteY - lift) + i * S.paraStep * su,
        size: body,
        family: fonts.detail,
        fill: INK.sheetInkDim,
      }),
    );
  });

  /* --- the dedication: the customer's own line ------------------ */
  // The only line on this sheet a person wrote, and the reason the object
  // exists. It is set as a DEDICATION, not as a captioned field: a short rule
  // and a little air separate it from the footnote, and then the words stand
  // on their own in full ink. No `DEDICATION:` label — a dedication on a
  // printed page has never needed one, and a label would make the customer's
  // sentence read as one more row of telemetry.
  //
  // Everything about it is bounded. It arrives sanitised (one line, no control
  // characters, ≤120 code points — lib/missions/dedication.ts), it is escaped
  // by `text()` on the way into the SVG, it is wrapped and hard-broken to
  // `dedMeasure`, it is clipped to the lines that actually fit above
  // `dedicationFloor`, and a clip is SHOWN with an ellipsis rather than
  // silently swallowing the rest of somebody's sentence.
  if (dedLines.length > 0) {
    const footEnd = S.footnoteY - lift + (footLines.length - 1) * S.paraStep;
    const firstY = footEnd + S.dedicationGap;
    const room = Math.floor((S.dedicationFloor - firstY) / S.paraStep) + 1;
    const maxLines = Math.min(S.dedicationMaxLines, room);
    const lines = dedLines.slice(0, Math.max(0, maxLines));

    if (lines.length > 0) {
      if (dedLines.length > lines.length) {
        lines[lines.length - 1] = clip(lines[lines.length - 1], dedMeasure);
      }
      parts.push(
        rule(
          g.left.x,
          at(footEnd + S.dedicationRuleGap),
          S.dedicationRuleW * su,
          INK.sheetHairline,
          Math.max(1, su * 0.0011),
        ),
      );
      lines.forEach((line, i) => {
        parts.push(
          text(line, {
            x: g.left.x,
            y: at(firstY) + i * S.paraStep * su,
            size: body,
            family: fonts.detail,
            fill: ink,
          }),
        );
      });
    }
  }

  /* --- right column: the short link, with the one accent -------- */
  const linkSize = S.heading * su;
  const [host, path] = [`SHOT.SPACE`, `M${data.missionCode}`];
  const linkW = detailWidth(fonts, `${host}/${path}`, linkSize, TRACK.code);
  const linkX = railRight - linkW;
  const slashX = linkX + detailWidth(fonts, host, linkSize, TRACK.code);
  if (has('link')) parts.push(
    text(host, {
      x: linkX,
      y: at(S.linkY),
      size: linkSize,
      family: fonts.detail,
      fill: ink,
      tracking: TRACK.code,
      weight: 500,
    }),
    text('/', {
      x: slashX,
      y: at(S.linkY),
      size: linkSize,
      family: fonts.detail,
      // The accent, spent once — unless a preview already spent it.
      fill: data.watermark || data.degraded ? ink : INK.signal,
      tracking: TRACK.code,
      weight: 500,
    }),
    text(path, {
      x: slashX + detailWidth(fonts, '/', linkSize, TRACK.code),
      y: at(S.linkY),
      size: linkSize,
      family: fonts.detail,
      fill: ink,
      tracking: TRACK.code,
      weight: 500,
    }),
  );

  /* --- sequence of events -------------------------------------- */
  if (has('sequence')) parts.push(
    text('SEQUENCE OF EVENTS', {
      x: colX,
      y: at(S.seqLabelY),
      size: body,
      family: fonts.detail,
      fill: ink,
    }),
  );
  if (has('sequence') && copy.sequence.length === 0) {
    parts.push(
      text('SEQUENCE NOT ON FILE.', {
        x: rowX,
        y: at(S.seqRowY),
        size: body,
        family: fonts.detail,
        fill: INK.sheetInkDim,
      }),
    );
  }
  if (has('sequence')) copy.sequence.forEach((event, i) => {
    const y = at(S.seqRowY) + i * step;
    parts.push(
      text(event.label, { x: rowX, y, size: body, family: fonts.detail, fill: ink }),
      text(elapsed(event.offset), {
        x: railRight,
        y,
        size: body,
        family: fonts.detail,
        fill: ink,
        anchor: 'end',
      }),
    );
  });

  /* --- target -------------------------------------------------- */
  if (has('target')) parts.push(
    text('TARGET', {
      x: colX,
      y: at(S.targetLabelY),
      size: body,
      family: fonts.detail,
      fill: ink,
    }),
  );
  // A row is a label hung left and a value hung off the rail. If the two
  // cannot both fit — a narrow plate, a long coordinate — the label sheds its
  // middle word rather than running into the number.
  const rowChars = detailChars(fonts, railRight - rowX, body);
  const fitLabel = (label: string, value: string) =>
    label.length + value.length + 2 <= rowChars ? label : label.replace(' FRAME', '');

  if (has('target')) copy.target.forEach(([label, value], i) => {
    const y = at(S.targetRowY) + i * step;
    parts.push(
      text(fitLabel(label, value), { x: rowX, y, size: body, family: fonts.detail, fill: ink }),
      text(value, {
        x: railRight,
        y,
        size: body,
        family: fonts.detail,
        fill: ink,
        anchor: 'end',
      }),
    );
  });
  if (has('target')) copy.targetNotes.forEach((line, i) => {
    parts.push(
      text(line, {
        x: rowX,
        y: at(S.targetRowY) + (copy.target.length + i) * step,
        size: body,
        family: fonts.detail,
        fill: ink,
      }),
    );
  });

  /* The right column stops here. Everything below `g.mark.top` in this
     column belongs to the chrome mark, which compose.ts composites as
     pixels — see lib/poster/layout.ts § THE CHROME MARK'S CORNER. */

  /* --- DECLASSIFIED, down the right edge ------------------------ */
  if (has('edge-word')) parts.push(
    textRotated('DECLASSIFIED', {
      x: g.width - g.margin * 0.3,
      y: at(0.235),
      size: S.edgeWord * su,
      family: fonts.detail,
      fill: ink,
      tracking: TRACK.edge,
      weight: 500,
    }),
  );

  return parts.join('');
}

/* ------------------------------------------------------------------ */
/* The plate                                                           */
/* ------------------------------------------------------------------ */

/**
 * A MOUNTED PLATE'S CAPTION BAND.
 *
 * `plate` does not carry the sheet, and it cannot: `sheetLayer()`'s baselines
 * describe a document 0.427 of the poster deep and this band is 0.065. So it
 * carries what a mounted plate carries — what this is, where it was taken,
 * where the fix is and where the rest of the record lives. Four values, all of
 * them `SheetCopy`'s, on two ruled lines.
 *
 * The numbers are the band's own, stated as fractions of the poster WIDTH, and
 * they are the same numbers <PlateRail /> sets in `cqw` in
 * components/poster/StyledPoster.tsx:
 *
 *   rule      the band's top edge
 *   size      0.0125     a caption on paper, not a data sheet
 *   line 1    0.02625    rule + 0.014 lead-in + 0.01225 to the baseline
 *   line 2    0.05375    line 1 + 0.0175 (the line box) + 0.01 of air
 *
 * The band is 0.065 deep, so the second line's descenders clear the foot.
 */
function railLayer(
  data: ResolvedPoster,
  g: Geometry,
  fonts: FontStack,
  blocks: readonly RecordBlock[],
): string {
  const TRACK = tracking(fonts);
  const u = g.u;
  const size = 0.0125 * u;
  const ink = INK.sheetInk;
  const dim = INK.sheetInkDim;
  const has = (block: RecordBlock) => blocks.includes(block);
  const copy = sheetCopy(data);
  const left = g.sheet.x;
  const right = g.sheet.x + g.sheet.w;
  const row1 = g.sheet.y + 0.02625 * u;
  const row2 = g.sheet.y + 0.05375 * u;
  const parts: string[] = [
    rule(left, g.sheet.y, g.sheet.w, INK.sheetHairline, Math.max(1, u * 0.0011)),
  ];

  /* --- MISSION / {code}, left ---------------------------------- */
  if (has('heading')) {
    const code = displayString(fonts, copy.heading.code);
    parts.push(
      text(copy.heading.label, {
        x: left,
        y: row1,
        size,
        family: fonts.detail,
        fill: ink,
        tracking: TRACK.label,
        weight: 500,
      }),
      text(code.value, {
        x: left + detailWidth(fonts, `${copy.heading.label} `, size, TRACK.label),
        y: row1,
        size: size * code.scale,
        family: code.family,
        fill: ink,
        tracking: TRACK.code,
        weight: 500,
      }),
    );
  }

  /* --- SHOT.SPACE/M{code}, right ------------------------------- */
  // The one accent on the plate, spent on the slash — the same place the
  // sheet spends it, and for the same reason.
  if (has('link')) {
    const [host, path] = ['SHOT.SPACE', `M${data.missionCode}`];
    const linkW = detailWidth(fonts, `${host}/${path}`, size, TRACK.code);
    const linkX = right - linkW;
    const slashX = linkX + detailWidth(fonts, host, size, TRACK.code);
    parts.push(
      text(host, { x: linkX, y: row1, size, family: fonts.detail, fill: dim, tracking: TRACK.code, weight: 500 }),
      text('/', {
        x: slashX,
        y: row1,
        size,
        family: fonts.detail,
        fill: data.watermark || data.degraded ? dim : INK.signal,
        tracking: TRACK.code,
        weight: 500,
      }),
      text(path, {
        x: slashX + detailWidth(fonts, '/', size, TRACK.code),
        y: row1,
        size,
        family: fonts.detail,
        fill: dim,
        tracking: TRACK.code,
        weight: 500,
      }),
    );
  }

  /* --- the site, left; the frame centre, right ------------------ */
  // Both are `SheetCopy`'s own — the site as the record prints it (city
  // level), the fix at whatever precision this reader was granted.
  if (has('site')) {
    parts.push(
      text(data.locationLabel.toUpperCase(), {
        x: left,
        y: row2,
        size,
        family: fonts.detail,
        fill: dim,
        tracking: TRACK.label,
      }),
    );
  }
  const centre = copy.target[0];
  if (has('target') && centre) {
    parts.push(
      text(centre[1], {
        x: right,
        y: row2,
        size,
        family: fonts.detail,
        fill: dim,
        tracking: TRACK.code,
        anchor: 'end',
      }),
    );
  }

  return parts.join('');
}

/**
 * The plate, in the division the geometry was resolved for.
 *
 * `g.division` names one entry of lib/poster/styles.ts, and the marks and
 * blocks drawn are that entry's own lists rather than a second set kept here.
 * That is what makes the print file and <StyledPoster /> the same object: both
 * read the catalogue, neither restates it.
 */
export function buildPlateSvg(
  data: ResolvedPoster,
  g: Geometry,
  fonts: FontStack,
): string {
  const style = getPosterStyle(g.division);
  const parts = [frameLayer(data, g, fonts, style.frameMarks)];
  if (g.sheet.h > 0) {
    parts.push(
      g.division === 'plate'
        ? railLayer(data, g, fonts, style.recordBlocks)
        : sheetLayer(data, g, fonts, style.recordBlocks),
    );
  }
  if (data.watermark) parts.push(watermarkWash(g, fonts), lowResTag(g, fonts));
  return svgDocument(g.width, g.height, parts.join(''));
}

/**
 * The frame half when there is no frame: a hairline grid on the deck and a
 * status line. Used by the designed fallback so a failed render still looks
 * like the product rather than a broken image icon.
 */
export function buildEmptyWellSvg(g: Geometry, fonts: FontStack, line: string): string {
  const u = g.u;
  const { x, y, w, h } = g.frame;
  const parts: string[] = [fillRect(x, y, w, h, INK.deck)];
  const stepPx = 0.055 * u;
  for (let gx = x + stepPx; gx < x + w; gx += stepPx) {
    parts.push(vrule(gx, y, h, INK.hairlineSoft, 1));
  }
  for (let gy = y + stepPx; gy < y + h; gy += stepPx) {
    parts.push(rule(x, gy, w, INK.hairlineSoft, 1));
  }
  const size = F.credit * u;
  parts.push(
    circle(x + w / 2, y + h / 2 - size * 2.4, size * 0.34, INK.paperFaint),
    text(line, {
      x: x + w / 2,
      y: y + h / 2,
      size,
      family: fonts.detail,
      fill: INK.paperFaint,
      tracking: 0.24,
      anchor: 'middle',
    }),
  );
  return svgDocument(g.width, g.height, parts.join(''));
}

/**
 * The paper ground, drawn under everything the record prints.
 *
 * `g.paper` rather than `g.sheet`, because they are the same rectangle only on
 * the two-ground divisions: a mounted plate is paper edge to edge with the
 * picture as a window cut in it, and `full-frame` has no paper at all.
 */
export function buildSheetGroundSvg(g: Geometry): string {
  if (g.paper.w <= 0 || g.paper.h <= 0) return svgDocument(g.width, g.height, '');
  return svgDocument(
    g.width,
    g.height,
    fillRect(g.paper.x, g.paper.y, g.paper.w, g.paper.h, INK.sheet),
  );
}
