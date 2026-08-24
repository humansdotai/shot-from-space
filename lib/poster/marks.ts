import { detailWidth, type FontStack } from './fonts';
import { INK, circle, circleOutline, ellipseOutline, round, text } from './svg';

/**
 * THE TWO DRAWN MARKS ON THE PLATE.
 *
 * ------------------------------------------------------------------------
 * Why the logo is redrawn rather than embedded
 * ------------------------------------------------------------------------
 * `public/brand/logo-wordmark.svg` sets SHOT / FROM / SPACE as live `<text>`
 * in Typestar OCR. Embedding the file verbatim would still be wrong: librsvg
 * has no access to the browser's font loading, the artwork names the face by a
 * platform name fontconfig may not index (`Typestar-OCR, Typestar`), and a
 * silent substitution there breaks the lockup's width rather than failing. The
 * *mark* is pure geometry and is reproduced here exactly: the two `<path>`
 * outlines and the square, lifted from the artwork unchanged. The wordmark is
 * reset in the plate's own RESOLVED detail family — which is now Typestar
 * itself when the probe in fonts.ts says so, and IBM Plex Mono at compensating
 * tracking when it does not. Verified by rendering, not assumed.
 */

/** Path data, verbatim from public/brand/logo-wordmark.svg. */
const MARK_PATHS = [
  {
    d: 'M125,34 C136.045695,34 145,42.954305 145,54 L145,73 L140,73 L140,49 L131,39 L66,39 L66,34 L125,34 Z',
    transform: 'translate(105.5, 53.5) scale(-1, 1) translate(-105.5, -53.5)',
  },
  {
    d: 'M59,0 C70.045695,0 79,8.954305 79,20 L79,39 L74,39 L74,15 L65,5 L0,5 L0,0 L59,0 Z',
    transform: 'translate(39.5, 19.5) scale(1, -1) translate(-39.5, -19.5)',
  },
] as const;

/** The square, also verbatim: `<rect x="39" y="13" width="7" height="7"/>`. */
const MARK_DOT = { x: 39, y: 13, size: 7 } as const;

/** The artwork's own bounding box for the mark alone. */
const MARK_W = 145;
const MARK_H = 73;

/**
 * Wordmark metrics, all as fractions of the mark's height, measured off the
 * artwork's own numbers (font-size 37, line-spacing 34.7, first baseline 56,
 * text x 161 against a 145-wide, 73-tall mark).
 *
 * TRACKING IS THE ARTWORK'S when the artwork's face is available and a
 * compensation when it is not. `logo-wordmark.svg` sets the three lines in
 * Typestar OCR at `letter-spacing="1.3"` on `font-size="37"` — 0.035em — so
 * once the real face resolves the plate simply reproduces that. On the IBM
 * Plex Mono fallback the letterforms are 11% narrower per character, and 0.10em
 * is what puts the three lines back on the artwork's set width.
 */
const WORD = {
  size: 37 / MARK_H,
  step: 34.7 / MARK_H,
  gap: 16 / MARK_H,
  firstBaseline: 56 / MARK_H,
  trackingTypestar: 1.3 / 37,
  trackingFallback: 0.10,
} as const;

export interface LogoMetrics {
  width: number;
  height: number;
}

/**
 * The full lockup: mark left, three stacked wordmark lines right.
 * `height` is the height of the *mark*; the wordmark is set from it.
 */
export function logoLockup(
  x: number,
  y: number,
  height: number,
  fonts: FontStack,
  fill: string = INK.paper,
): { svg: string; metrics: LogoMetrics } {
  const scale = height / MARK_H;
  const markW = MARK_W * scale;

  const size = height * WORD.size;
  const step = height * WORD.step;
  const wordX = x + markW + height * WORD.gap;
  const tracking =
    fonts.source.detail === 'typestar' ? WORD.trackingTypestar : WORD.trackingFallback;

  const lines = ['SHOT', 'FROM', 'SPACE'];
  const words = lines
    .map((line, i) =>
      text(line, {
        x: wordX,
        y: y + height * WORD.firstBaseline + i * step,
        size,
        family: fonts.detail,
        fill,
        tracking,
        weight: 500,
      }),
    )
    .join('');

  const marks =
    MARK_PATHS.map(
      (p) => `<path d="${p.d}" transform="${p.transform}" fill="${fill}"/>`,
    ).join('') +
    `<rect x="${MARK_DOT.x}" y="${MARK_DOT.y}" width="${MARK_DOT.size}"` +
    ` height="${MARK_DOT.size}" fill="${fill}"/>`;

  const svg =
    `<g transform="translate(${round(x)} ${round(y)}) scale(${round(scale)})">${marks}</g>` +
    words;

  return {
    svg,
    metrics: {
      width: markW + height * WORD.gap + detailWidth(fonts, 'SPACE', size, tracking),
      height: Math.max(height, height * WORD.firstBaseline + 2 * step),
    },
  };
}

/**
 * The orbit mark: a globe crossed by five orbital ellipses, one node on each.
 * Drawn rather than imported so it inherits the sheet's ink and hairline
 * weight at any render width.
 */
export function orbitGlobe(
  cx: number,
  cy: number,
  r: number,
  stroke: string,
  weight: number,
): string {
  const parts: string[] = [circleOutline(cx, cy, r, stroke, weight)];

  // Five rings, fanned about the centre. The outer pair sit high and low and
  // lean the opposite way, which is what gives the mark its woven look.
  const rings = [
    { dy: -0.44, rx: 1.0, ry: 0.30, rot: -7 },
    { dy: -0.22, rx: 1.06, ry: 0.30, rot: -4 },
    { dy: 0, rx: 1.1, ry: 0.30, rot: 0 },
    { dy: 0.22, rx: 1.06, ry: 0.30, rot: 4 },
    { dy: 0.44, rx: 1.0, ry: 0.30, rot: 7 },
  ];
  for (const ring of rings) {
    parts.push(
      ellipseOutline(cx, cy + ring.dy * r, r * ring.rx, r * ring.ry, stroke, weight, ring.rot),
    );
  }

  // Nodes on the polar axis, the centre one heavier — the target.
  const nodes = [-0.94, -0.5, 0, 0.5, 0.94];
  nodes.forEach((n, i) => {
    parts.push(circle(cx, cy + n * r, i === 2 ? r * 0.115 : r * 0.072, stroke));
  });

  return parts.join('');
}
