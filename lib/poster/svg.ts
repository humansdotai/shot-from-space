/**
 * Tiny SVG emitters. Deliberately not a library: the plate uses a dozen shapes
 * and one text primitive, and every one of them has to survive librsvg, which
 * supports rather less of SVG 1.1 than a browser does.
 *
 * Rules learned the hard way and encoded here:
 *  - no `<tspan>` mixing, no `dominant-baseline`, no CSS classes: all
 *    positioning is explicit baselines and `text-anchor`.
 *  - `letter-spacing` is honoured, but it is added *after* the final glyph, so
 *    right-aligned tracked text needs the trailing space compensated.
 *  - percentages and `em` units are unreliable; everything here is px.
 *  - `transform` on a `<g>` is fine; `clip-path` is not worth the risk, so the
 *    plate never clips — it only ever draws inside a rectangle it computed.
 */

/** Palette. The plate is a two-ground object: dark frame, paper sheet. */
export const INK = {
  /* --- dark ground (the satellite frame) --- */
  void: '#08090b',
  deck: '#0d0f13',
  hairline: '#23262c',
  hairlineSoft: '#171a1f',
  paper: '#eeede8',
  paperDim: '#9aa0a6',
  paperFaint: '#5f656c',
  signal: '#ff4d1c',

  /* --- paper ground (the lower sheet) ---
   * The sheet is the printed page: a true white stock with near-black ink.
   * `sheetInk` is `void` — imperceptibly off pure black, and the same value
   * the site uses, so screen and print stay one family. */
  sheet: '#ffffff',
  sheetInk: '#08090b',
  sheetInkDim: '#4d5259',
  sheetHairline: '#c9c7c1',
} as const;

export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface TextOptions {
  x: number;
  /** Baseline, not a box top. */
  y: number;
  size: number;
  family: string;
  fill?: string;
  /** Tracking in em. Labels are 0.14–0.20; the display lockup is 0.18. */
  tracking?: number;
  weight?: 400 | 500 | 600;
  anchor?: 'start' | 'middle' | 'end';
  opacity?: number;
  /**
   * Stroke width, as a fraction of the size, for a dark halo drawn behind the
   * glyphs. The frame is a photograph we do not control — a pale sky under a
   * white line is a real failure — and a halo buys contrast without dimming
   * the picture the way a deeper scrim would. Emitted as a separate stroked
   * copy underneath rather than `paint-order`, which librsvg honours only
   * intermittently.
   */
  halo?: number;
}

export function text(value: string, o: TextOptions): string {
  if (o.halo) {
    const { halo, ...rest } = o;
    return glyphs(value, rest, halo) + glyphs(value, rest);
  }
  return glyphs(value, o);
}

function glyphs(value: string, o: TextOptions, halo = 0): string {
  const tracking = o.tracking ?? 0;
  const anchor = o.anchor ?? 'start';
  // librsvg adds tracking after the last glyph; pull end/middle anchors back
  // by that amount so tracked labels sit flush to their rule.
  const trail = tracking * o.size;
  const x =
    anchor === 'end' ? o.x + trail : anchor === 'middle' ? o.x + trail / 2 : o.x;
  return (
    `<text x="${round(x)}" y="${round(o.y)}"` +
    ` font-family="${o.family}" font-size="${round(o.size)}"` +
    ` font-weight="${o.weight ?? 400}"` +
    ` letter-spacing="${round(trail)}"` +
    ` text-anchor="${anchor}"` +
    ` fill="${o.fill ?? INK.paper}"` +
    (halo
      ? ` stroke="${INK.void}" stroke-width="${round(halo * o.size)}"` +
        ` stroke-linejoin="round" stroke-opacity="0.5"`
      : '') +
    (o.opacity !== undefined ? ` opacity="${o.opacity}"` : '') +
    `>${esc(value)}</text>`
  );
}

/**
 * The same text, turned a quarter turn about its own anchor point. Used for
 * the two edge words — `ORIGINAL` on the frame, `DECLASSIFIED` on the sheet —
 * which read top to bottom down the right edge of the plate.
 */
export function textRotated(value: string, o: TextOptions & { angle?: number }): string {
  const a = o.angle ?? 90;
  return `<g transform="rotate(${a} ${round(o.x)} ${round(o.y)})">${text(value, o)}</g>`;
}

export function rule(
  x: number,
  y: number,
  w: number,
  stroke: string = INK.hairline,
  weight = 1,
): string {
  return `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(weight)}" fill="${stroke}"/>`;
}

export function vrule(
  x: number,
  y: number,
  h: number,
  stroke: string = INK.hairline,
  weight = 1,
): string {
  return `<rect x="${round(x)}" y="${round(y)}" width="${round(weight)}" height="${round(h)}" fill="${stroke}"/>`;
}

/**
 * A stroked rectangle. `opacity` is emitted as `stroke-opacity` and only when
 * it is given: `rgba()` is a CSS Color 3 value and librsvg's support for it in
 * a presentation attribute is not something to bet a print file on, while
 * `stroke-opacity` is SVG 1.1 and universal.
 */
export function box(
  x: number,
  y: number,
  w: number,
  h: number,
  stroke: string,
  weight = 1,
  radius = 0,
  opacity?: number,
): string {
  return (
    `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}"` +
    (radius ? ` rx="${round(radius)}" ry="${round(radius)}"` : '') +
    ` fill="none" stroke="${stroke}" stroke-width="${round(weight)}"` +
    (opacity !== undefined ? ` stroke-opacity="${opacity}"` : '') +
    `/>`
  );
}

export function fillRect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  opacity = 1,
): string {
  return (
    `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}"` +
    ` fill="${fill}"${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`
  );
}

export function circle(cx: number, cy: number, r: number, fill: string, opacity = 1): string {
  return (
    `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}" fill="${fill}"` +
    `${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`
  );
}

export function circleOutline(
  cx: number,
  cy: number,
  r: number,
  stroke: string,
  weight = 1,
): string {
  return (
    `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}"` +
    ` fill="none" stroke="${stroke}" stroke-width="${round(weight)}"/>`
  );
}

export function ellipseOutline(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  stroke: string,
  weight = 1,
  rotate = 0,
): string {
  const el =
    `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(rx)}" ry="${round(ry)}"` +
    ` fill="none" stroke="${stroke}" stroke-width="${round(weight)}"/>`;
  return rotate ? `<g transform="rotate(${round(rotate)} ${round(cx)} ${round(cy)})">${el}</g>` : el;
}

/**
 * A linear scrim, top-anchored or bottom-anchored. Purely functional: the
 * frame is a photograph and the type printed on it has to stay legible over
 * whatever the satellite happened to see. Never used as decoration.
 */
export function scrim(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  from: number,
  to: number,
): string {
  return (
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${INK.void}" stop-opacity="${from}"/>` +
    `<stop offset="1" stop-color="${INK.void}" stop-opacity="${to}"/>` +
    `</linearGradient></defs>` +
    `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="url(#${id})"/>`
  );
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function svgDocument(width: number, height: number, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
    ` viewBox="0 0 ${width} ${height}">${body}</svg>`
  );
}
