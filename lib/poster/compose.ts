import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';

import { frameBySlug } from '@/lib/imagery';
import { sanitizeDedication } from '@/lib/missions/dedication';
import type { FormatId } from '@/lib/types';
import { cacheGet, cacheSet } from './cache';
import { resolveFontStack } from './fonts';
import {
  FORMAT_RATIO,
  DEFAULT_DIVISION,
  MAX_RENDER_WIDTH,
  PREVIEW_WIDTH,
  POSTER_WIDTH,
  PRINT_INTENT,
  clampWidth,
  resolveGeometry,
  type Geometry,
} from './layout';
import { buildEmptyWellSvg, buildPlateSvg, buildSheetGroundSvg } from './plate';
import { getPosterStyle } from './styles';
import { INK } from './svg';
import type { PosterOptions, PosterRatio, PosterStyleId, ResolvedPoster } from './types';

/**
 * THE COMPOSER.
 *
 * One deterministic function of its inputs: same options in, byte-identical
 * PNG out. That is what makes the LRU and the ETag on the route honest.
 *
 * Pipeline:
 *   1. resolve geometry from format/ratio/width/style
 *   2. cover-crop the frame into the image well (centre — a tasked capture is
 *      centred on the target, so the centre is the subject)
 *   3. lay a very light grain over the frame only, never over the type
 *   4. composite the SVG plate on top
 *   5. encode PNG, stamping print density when this is a print-intent render
 */

const ARCHIVE_CREDIT = 'SOURCE / NASA · USGS / PUBLIC DOMAIN';
const CAPTURE_CREDIT = 'SOURCE / TASKED CAPTURE';

/** Frames wider than this skip the grain pass — it is not worth the seconds. */
const GRAIN_MAX_WIDTH = 2600;

/**
 * THE CHROME MARK.
 *
 * A photographed object, not a drawing, so it is composited as pixels rather
 * than emitted into the SVG. It sits in the bottom-right corner of the sheet
 * at FULL OPACITY — it is a solid thing printed on the paper, not a watermark
 * behind the type. `g.mark` is the rectangle it owns; the plate's right column
 * ends above it, so it never has a line of type over or under it.
 */
const MARK_PATH = ['public', 'brand', 'mark-3d.png'];

/**
 * Its drop shadow, expressed as fractions of the mark's RENDERED HEIGHT so it
 * scales with the plate instead of being pinned to one size.
 *
 * The spec was given for the mark at 440 × 298: X 0, Y 52, blur 14, spread 0.
 *   dy    52 / 298 = 0.1745  of the height
 *   blur  14 / 298 = 0.0470  of the height
 *
 * `blur` is a CSS-style blur radius. A Gaussian standard deviation is half of
 * it, which is the number `sharp.blur()` actually wants — the same conversion
 * a browser makes for `box-shadow`, so the raster shadow and the CSS shadow on
 * the dossier page are the same shadow.
 *
 * Neutral and never coloured: the sheet's own ink at low alpha.
 */
const MARK_SHADOW = { dy: 0.1745, blur: 0.0470, alpha: 0.32 } as const;
/** RGB of the shadow — `INK.void`, decomposed once. */
const MARK_SHADOW_RGB = [0x08, 0x09, 0x0b] as const;

/**
 * The artwork's canvas is NOT the mark. `mark-3d.png` is 900 × 702 and the
 * chrome object inside it measures 856 × 578 (aspect 1.481 — which is exactly
 * the 440 × 298 the shadow spec was written against); the remaining 124 px at
 * the foot is a very faint ambient shadow baked into the render.
 *
 * If the canvas were scaled and placed directly, the mark would read as
 * under-sized and mis-padded — 18% of its "height" would be empty pixels
 * hanging past the bottom edge — and the shadow offset, taken as a fraction of
 * the canvas, would be ~18% short of the spec.
 *
 * So the solid object's bounds are measured off the alpha channel once, at
 * module scope, and every number below is expressed against THOSE. Measured
 * rather than hard-coded, so redrawing the asset cannot silently break the
 * corner.
 */
const MARK_SOLID_ALPHA = 48;

interface LoadedMark {
  data: Buffer;
  width: number;
  height: number;
  /** Bounds of the chrome object itself, inside the canvas. */
  solid: { x: number; y: number; w: number; h: number };
}

/**
 * Memoised: the asset is a fixed brand file, and holding its 900 × 702 RGBA
 * (~2.5 MB) beats re-reading and re-scanning it on every render. A failed read
 * clears the memo so a transient filesystem error can recover on the next
 * request rather than disabling the mark for the life of the process.
 */
let markPromise: Promise<LoadedMark> | null = null;

function loadMark(): Promise<LoadedMark> {
  markPromise ??= (async () => {
    const file = path.join(process.cwd(), ...MARK_PATH);
    const { data, info } = await sharp(await fs.readFile(file))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let x0 = info.width;
    let y0 = info.height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        if (data[(y * info.width + x) * 4 + 3] < MARK_SOLID_ALPHA) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    // A blank or unreadable asset falls back to the whole canvas.
    const solid =
      x1 < x0 || y1 < y0
        ? { x: 0, y: 0, w: info.width, h: info.height }
        : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };

    return { data, width: info.width, height: info.height, solid };
  })();
  return markPromise.catch((error) => {
    markPromise = null;
    throw error;
  });
}

/* ------------------------------------------------------------------ */
/* Option resolution                                                   */
/* ------------------------------------------------------------------ */

/**
 * The division to lay out. `dossier` unless the caller names another, which is
 * what the composer has always laid out — an existing caller's file does not
 * move by a pixel.
 */
function resolveStyle(opts: PosterOptions): PosterStyleId {
  return opts.styleId ?? DEFAULT_DIVISION;
}

function resolveRatio(opts: PosterOptions): PosterRatio {
  if (opts.ratio) return opts.ratio;
  if (opts.formatId) return FORMAT_RATIO[opts.formatId];
  return '3:4';
}

function resolveWidth(opts: PosterOptions, fallback: number): number {
  if (opts.print && opts.formatId) {
    // Print intent is the truth; MAX_RENDER_WIDTH is the guard rail.
    return clampWidth(Math.min(PRINT_INTENT[opts.formatId].widthPx, MAX_RENDER_WIDTH));
  }
  return clampWidth(opts.width ?? fallback);
}

function resolveData(opts: PosterOptions): ResolvedPoster {
  return {
    missionCode: (opts.missionCode || '0000').toUpperCase(),
    capturedAt: opts.capturedAt,
    lat: opts.lat,
    lon: opts.lon,
    locationLabel: opts.locationLabel,
    orbit: opts.orbit,
    formatId: opts.formatId ?? null,
    sourceLabel:
      opts.sourceLabel ?? (opts.imageBuffer ? CAPTURE_CREDIT : ARCHIVE_CREDIT),
    watermark: opts.watermark ?? false,
    degraded: false,
    personnel: opts.personnel,
    // Sanitised again at the door. The composer is a library: it is called by
    // the poster route, by the print pipeline and by anything a developer
    // writes next, and exactly one unescapable control character anywhere in
    // this string would take the whole SVG document down.
    dedication: sanitizeDedication(opts.dedication),
    // Four unless the caller says otherwise. The composer is the print
    // pipeline as well as the preview route, and the print carries the exact
    // fix — reducing it is a decision only a caller that knows WHO IS ASKING
    // can make. See `PosterOptions.coordDp`.
    coordDp: opts.coordDp === 2 ? 2 : 4,
  };
}

/** Stable key over everything that can change a pixel. */
export function posterCacheKey(
  opts: PosterOptions,
  width: number,
  ratio: PosterRatio,
  style: PosterStyleId = DEFAULT_DIVISION,
): string {
  const h = createHash('sha1');
  h.update(
    JSON.stringify({
      slug: opts.slug ?? null,
      buffer: opts.imageBuffer ? opts.imageBuffer.length : null,
      code: opts.missionCode,
      at: opts.capturedAt,
      lat: opts.lat,
      lon: opts.lon,
      loc: opts.locationLabel,
      orbit: opts.orbit,
      format: opts.formatId ?? null,
      source: opts.sourceLabel ?? null,
      wm: opts.watermark ?? false,
      personnel: opts.personnel ?? null,
      // Part of the pixels, so part of the key: without this the LRU and the
      // route's ETag would both serve a plate printed with a stale line.
      dedication: sanitizeDedication(opts.dedication),
      // Changes the target block, so it changes the pixels.
      coordDp: opts.coordDp === 2 ? 2 : 4,
      width,
      ratio,
      // The division is the composition itself, so nothing about the file
      // survives changing it. Part of the pixels, part of the key.
      style,
    }),
  );
  if (opts.imageBuffer) h.update(opts.imageBuffer.subarray(0, 4096));
  return h.digest('hex').slice(0, 24);
}

/* ------------------------------------------------------------------ */
/* Frame loading                                                       */
/* ------------------------------------------------------------------ */

/**
 * Read the source frame. Catalogue frames live on disk under `public/imagery`;
 * a real mission passes the downlinked capture as a buffer.
 * Returns null when there is nothing to compose — the caller draws the
 * designed empty well instead of throwing.
 */
async function loadFrame(opts: PosterOptions): Promise<Buffer | null> {
  if (opts.imageBuffer?.length) return opts.imageBuffer;
  if (!opts.slug) return null;
  const frame = frameBySlug(opts.slug);
  if (!frame) return null;
  try {
    return await fs.readFile(path.join(process.cwd(), 'public', frame.src));
  } catch {
    return null;
  }
}

/**
 * Several archive frames are letterboxed: an oblique render pasted onto a black
 * canvas. Cover-cropping those reproduces the black bars inside the image well,
 * which reads as a broken composition rather than a photograph.
 *
 * So: trim uniform near-black borders, but only accept the result if it keeps
 * most of the frame. The guard is what makes this safe on frames whose real
 * edges are dark — deep ocean, night-side terrain — where an unguarded trim
 * would eat the subject.
 */
async function deletterbox(source: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(source).metadata();
    if (!meta.width || !meta.height) return source;
    const { data, info } = await sharp(source)
      .trim({ background: '#000000', threshold: 14 })
      .toBuffer({ resolveWithObject: true });
    const kept = (info.width * info.height) / (meta.width * meta.height);
    if (kept >= 0.55 && kept < 0.999 && info.width >= 320 && info.height >= 320) {
      return data;
    }
    return source;
  } catch {
    return source;
  }
}

/**
 * Fit the frame into the well.
 *
 * `cover` + `centre`: the poster is portrait, most archive frames are
 * landscape, so a real crop happens. That is correct for a tasked capture
 * (the target sits at frame centre) and a documented compromise for the
 * stand-in archive imagery, which was framed for a different purpose.
 */
async function fitFrame(source: Buffer, g: Geometry): Promise<Buffer> {
  const frame = await deletterbox(source);
  return sharp(frame)
    .rotate()
    .resize(g.image.w, g.image.h, { fit: 'cover', position: 'centre' })
    // A restrained grade: pull a little saturation out and open the blacks a
    // touch so the frame sits on the near-black margin instead of fighting it.
    .modulate({ saturation: 0.94, brightness: 1.01 })
    .linear(1.04, -6)
    .toColourspace('srgb')
    .png({ compressionLevel: 0 })
    .toBuffer();
}

/** Very light gaussian grain, applied to the frame only. */
async function grain(frame: Buffer, g: Geometry): Promise<Buffer> {
  if (g.width > GRAIN_MAX_WIDTH) return frame;
  try {
    const noise = await sharp({
      create: {
        width: g.image.w,
        height: g.image.h,
        channels: 3,
        background: '#808080',
        noise: { type: 'gaussian', mean: 128, sigma: 7 },
      },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();
    return await sharp(frame)
      .composite([{ input: noise, blend: 'soft-light' }])
      .png({ compressionLevel: 0 })
      .toBuffer();
  } catch {
    return frame;
  }
}

/**
 * Load the chrome mark, scale it to `g.mark.height`, and return the two layers
 * it is made of: its shadow, then the mark itself at full opacity.
 *
 * The shadow is the mark's own alpha channel, flooded with neutral ink,
 * knocked back, padded, blurred and offset downwards — the silhouette of the
 * object rather than a rectangle under it, which is the difference between a
 * shadow and a smudge. sharp has no shadow primitive and no composite opacity,
 * so both are done by hand on the raw buffer: exact, and no new dependency.
 *
 * Returns `[]` on any failure at all. A missing flourish is a missing
 * flourish, never a failed poster.
 */
async function sheetMark(g: Geometry): Promise<OverlayOptions[]> {
  try {
    const art = await loadMark();

    // `g.mark.height` is the height of the OBJECT. Scale the canvas so the
    // object lands on it, then hang the object's own right and bottom edges
    // off `g.mark.right` / `g.mark.bottom`.
    const scale = g.mark.height / art.solid.h;
    const canvasW = Math.max(1, Math.round(art.width * scale));
    const canvasH = Math.max(1, Math.round(art.height * scale));
    const left = Math.round(g.mark.right - (art.solid.x + art.solid.w) * scale);
    const top = Math.round(g.mark.bottom - (art.solid.y + art.solid.h) * scale);

    // Off the plate is not a design, it is a bug. Draw nothing instead.
    if (left < 0 || top < 0 || left + canvasW > g.width || top + canvasH > g.height) {
      return [];
    }

    const resized = await sharp(art.data, {
      raw: { width: art.width, height: art.height, channels: 4 },
    })
      .resize(canvasW, canvasH, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const raw = { width: canvasW, height: canvasH, channels: 4 as const };

    const mark = await sharp(Buffer.from(resized.data), { raw })
      .png({ compressionLevel: 0 })
      .toBuffer();

    const layers: OverlayOptions[] = [];

    /* --- the shadow, cast from the object's own silhouette --------- */
    const sigma = Math.max(0.3, (MARK_SHADOW.blur * g.mark.height) / 2);
    const pad = Math.ceil(sigma * 3) + 1;
    const silhouette = Buffer.allocUnsafe(resized.data.length);
    for (let i = 0; i < resized.data.length; i += 4) {
      silhouette[i] = MARK_SHADOW_RGB[0];
      silhouette[i + 1] = MARK_SHADOW_RGB[1];
      silhouette[i + 2] = MARK_SHADOW_RGB[2];
      silhouette[i + 3] = Math.round(resized.data[i + 3] * MARK_SHADOW.alpha);
    }
    const shadowLeft = left - pad;
    const shadowTop = Math.round(top + MARK_SHADOW.dy * g.mark.height) - pad;
    if (
      shadowLeft >= 0 &&
      shadowTop >= 0 &&
      shadowLeft + canvasW + pad * 2 <= g.width &&
      shadowTop + canvasH + pad * 2 <= g.height
    ) {
      const shadow = await sharp(silhouette, { raw })
        .extend({
          top: pad,
          bottom: pad,
          left: pad,
          right: pad,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .blur(sigma)
        .png({ compressionLevel: 0 })
        .toBuffer();
      layers.push({ input: shadow, left: shadowLeft, top: shadowTop });
    }

    /* --- the object, full opacity --------------------------------- */
    layers.push({ input: mark, left, top });
    return layers;
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

async function render(opts: PosterOptions, defaultWidth: number): Promise<Buffer> {
  const ratio = resolveRatio(opts);
  const style = resolveStyle(opts);
  const width = resolveWidth(opts, defaultWidth);
  const key = posterCacheKey(opts, width, ratio, style);
  const hit = cacheGet(key);
  if (hit) return hit;

  const g = resolveGeometry(width, ratio, style);
  const fonts = await resolveFontStack();
  const data = resolveData(opts);

  // Order is the design: paper ground, photograph over its top two thirds,
  // the chrome mark solid in the sheet's bottom-right corner, then every line
  // of type above all of it. Nothing is set over the mark, so "above" costs it
  // nothing — but a preview's diagonal wash does cross it, which is right: the
  // mark is printed on the paper, not floating in front of the plate.
  const layers: OverlayOptions[] = [
    { input: Buffer.from(buildSheetGroundSvg(g)), left: 0, top: 0 },
  ];
  const source = await loadFrame(opts);

  if (source) {
    let framed = await fitFrame(source, g);
    framed = await grain(framed, g);
    layers.push({ input: framed, left: g.image.x, top: g.image.y });
  } else {
    layers.push({
      input: Buffer.from(buildEmptyWellSvg(g, fonts, 'NO FRAME ON FILE')),
      left: 0,
      top: 0,
    });
  }

  // The chrome mark is a block of the RECORD, so it is drawn only where the
  // catalogue says the record carries it — `full-frame` has no record at all
  // and a mounted plate's caption band is far too shallow for it.
  if (getPosterStyle(style).recordBlocks.includes('chrome-mark')) {
    layers.push(...(await sheetMark(g)));
  }

  layers.push({ input: Buffer.from(buildPlateSvg(data, g, fonts)), left: 0, top: 0 });

  const density =
    opts.print && opts.formatId ? PRINT_INTENT[opts.formatId].dpi : 72;

  const png = await sharp({
    create: {
      width: g.width,
      height: g.height,
      channels: 3,
      background: INK.void,
    },
  })
    .composite(layers)
    .withMetadata({ density })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  return cacheSet(key, png);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Print-intent composition. High resolution, no watermark unless asked.
 * With `print: true` and a `formatId` this renders at the 300 DPI pixel
 * geometry for that trim size, clamped to MAX_RENDER_WIDTH.
 *
 * `styleId` names the division — one entry of lib/poster/styles.ts. Omitted,
 * it composes `dossier`, which is what it has always composed.
 */
export function composePoster(opts: PosterOptions): Promise<Buffer> {
  return render({ watermark: false, ...opts }, POSTER_WIDTH);
}

/** Low-resolution, watermarked. This is what any public surface may show. */
export function composePreview(opts: PosterOptions): Promise<Buffer> {
  return render({ ...opts, watermark: true }, PREVIEW_WIDTH);
}

/**
 * The designed failure. If the frame is missing, the source is corrupt or
 * sharp throws for any reason at all, the route serves this instead of a 500 —
 * a plate with an empty well and a status line, in the same visual language.
 */
export async function composeFallback(
  opts: Partial<PosterOptions> & { missionCode?: string } = {},
  line = 'FRAME UNAVAILABLE / RETRY',
): Promise<Buffer> {
  const ratio = opts.ratio ?? (opts.formatId ? FORMAT_RATIO[opts.formatId] : '3:4');
  const width = clampWidth(opts.width ?? PREVIEW_WIDTH);
  // The designed failure is always the standing division: a plate that could
  // not be composed is not the moment to also change the composition.
  const g = resolveGeometry(width, ratio, DEFAULT_DIVISION);
  const fonts = await resolveFontStack();
  const data: ResolvedPoster = {
    missionCode: (opts.missionCode ?? '0000').toUpperCase(),
    capturedAt: opts.capturedAt ?? new Date(0).toISOString(),
    lat: opts.lat ?? 0,
    lon: opts.lon ?? 0,
    locationLabel: opts.locationLabel ?? 'TARGET WITHHELD',
    orbit: opts.orbit ?? {
      inclination: 'SSO 98.2°',
      track: '//ELIPSE 00°',
      altitudeKm: 0,
      gsdM: 0,
      sensor: 'NO SENSOR',
      azimuthDeg: 0,
      offNadirDeg: 0,
      cloudPct: 0,
    },
    formatId: opts.formatId ?? null,
    sourceLabel: 'SOURCE / UNAVAILABLE',
    watermark: false,
    degraded: true,
    // A plate with no record on file makes no personal statement either.
    dedication: null,
    // Nothing to reduce: the fallback prints dashes where the fix goes.
    coordDp: 4,
  };

  return sharp({
    create: { width: g.width, height: g.height, channels: 3, background: INK.void },
  })
    .composite([
      { input: Buffer.from(buildSheetGroundSvg(g)), left: 0, top: 0 },
      { input: Buffer.from(buildEmptyWellSvg(g, fonts, line)), left: 0, top: 0 },
      { input: Buffer.from(buildPlateSvg(data, g, fonts)), left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * The exact cache key `composePreview` will use for these options — the same
 * string the route serves as an `ETag`. Exported so a caller can answer a
 * conditional request without composing anything.
 */
export function previewCacheKey(opts: PosterOptions): string {
  const ratio = resolveRatio(opts);
  const width = resolveWidth({ ...opts, watermark: true }, PREVIEW_WIDTH);
  return posterCacheKey({ ...opts, watermark: true }, width, ratio, resolveStyle(opts));
}

/** Print-intent geometry for a format, for anything that needs to report it. */
export function printGeometry(formatId: FormatId) {
  return PRINT_INTENT[formatId];
}
