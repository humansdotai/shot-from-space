/**
 * GET /api/geocode/static?lat&lon&zoom&w&h  → image/jpeg
 *
 * A static satellite image centred on the given coordinates: the real ground,
 * composited server-side from the active tile provider (`lib/tiles.ts`, EOX
 * Sentinel-2 by default, keyless — or MapTiler/Mapbox when a key is set). Every
 * surface that shows "the ground over these coordinates" — the reveal, the
 * mission dossier archive, the poster preview — reads it, so a single real
 * render here makes all of them correct.
 *
 * It stitches `/api/tiles`-equivalent tiles with `sharp` and centres the crop
 * on the exact world-pixel position of the coordinate, so the point requested
 * is the point at the centre of the frame — not a detail-seeking crop of some
 * other place, which is what this route used to return.
 *
 * If the provider cannot be reached at all, it falls back to the deterministic
 * catalogue-frame crop so the flow degrades to a working (if generic) preview
 * rather than a broken image.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { pickFrameForCoords } from '@/lib/missions/frames';
import { fail } from '@/lib/missions/http';
import { seededUnit } from '@/lib/utils';
import {
  TILE_SIZE,
  activeProvider,
  clampLat,
  latToWorldY,
  lonToWorldX,
} from '@/lib/tiles';

export const dynamic = 'force-dynamic';

const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  zoom: z.coerce.number().min(1).max(22).default(16),
  w: z.coerce.number().int().min(64).max(2000).default(1200),
  h: z.coerce.number().int().min(64).max(2000).default(800),
});

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const TILE_TIMEOUT_MS = 7000;

/** Composite real provider tiles centred on the coordinate. */
async function renderReal(
  lat: number,
  lon: number,
  reqZoom: number,
  w: number,
  h: number,
): Promise<Buffer | null> {
  const provider = activeProvider();
  const zf = clamp(Math.round(reqZoom), provider.minZoom, provider.maxZoom);

  const centreX = lonToWorldX(lon, zf);
  const centreY = latToWorldY(clampLat(lat), zf);
  const originX = centreX - w / 2;
  const originY = centreY - h / 2;
  const span = 2 ** zf;

  const tx0 = Math.floor(originX / TILE_SIZE);
  const tx1 = Math.floor((originX + w) / TILE_SIZE);
  const ty0 = Math.floor(originY / TILE_SIZE);
  const ty1 = Math.floor((originY + h) / TILE_SIZE);

  const jobs: Promise<{ input: Buffer; left: number; top: number } | null>[] = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    if (ty < 0 || ty >= span) continue;
    for (let tx = tx0; tx <= tx1; tx++) {
      const wx = ((tx % span) + span) % span;
      const left = Math.round(tx * TILE_SIZE - originX);
      const top = Math.round(ty * TILE_SIZE - originY);
      jobs.push(
        fetch(provider.url(zf, wx, ty), {
          signal: AbortSignal.timeout(TILE_TIMEOUT_MS),
          headers: { Accept: 'image/jpeg,image/png,image/*' },
        })
          .then(async (r) => {
            if (!r.ok) return null;
            const type = r.headers.get('content-type') ?? '';
            if (!type.startsWith('image/')) return null;
            return { input: Buffer.from(await r.arrayBuffer()), left, top };
          })
          .catch(() => null),
      );
    }
  }

  const parts = (await Promise.all(jobs)).filter(
    (p): p is { input: Buffer; left: number; top: number } => p !== null,
  );
  if (parts.length === 0) return null;

  return sharp({
    create: { width: w, height: h, channels: 3, background: { r: 10, g: 14, b: 20 } },
  })
    .composite(parts)
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
}

/** Last-resort: the old catalogue-frame crop, so the flow never shows a break. */
async function renderFallback(
  lat: number,
  lon: number,
  zoom: number,
  w: number,
  h: number,
): Promise<Buffer> {
  const frame = pickFrameForCoords(lat, lon);
  const file = path.join(process.cwd(), 'public', frame.src.replace(/^\//, ''));
  const bytes = await fs.readFile(file);
  const source = sharp(bytes, { failOn: 'none' });
  const meta = await source.metadata();
  const srcW = meta.width ?? frame.width;
  const srcH = meta.height ?? frame.height;
  const frac = Math.min(0.95, Math.max(0.06, 0.9 * Math.pow(0.74, zoom - 12)));
  const short = Math.min(srcW, srcH);
  let cropH = Math.round(short * frac);
  let cropW = Math.round(cropH * (w / h));
  if (cropW > srcW) {
    cropW = srcW;
    cropH = Math.round(cropW * (h / w));
  }
  cropW = clamp(cropW, 32, srcW);
  cropH = clamp(cropH, 32, srcH);
  const seed = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const left = clamp(Math.round(srcW / 2 - cropW / 2 + (seededUnit(`x:${seed}`) - 0.5) * cropW * 0.4), 0, srcW - cropW);
  const top = clamp(Math.round(srcH / 2 - cropH / 2 + (seededUnit(`y:${seed}`) - 0.5) * cropH * 0.4), 0, srcH - cropH);
  return source
    .extract({ left, top, width: cropW, height: cropH })
    .resize(w, h, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return fail(400, 'INVALID_QUERY', 'Required: lat, lon. Optional: zoom (1-22), w, h (64-2000).');
  }
  const { lat, lon, zoom, w, h } = parsed.data;

  try {
    let buffer = await renderReal(lat, lon, zoom, w, h).catch(() => null);
    const real = buffer !== null;
    if (!buffer) buffer = await renderFallback(lat, lon, zoom, w, h);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400',
        'X-Capture-Source': real ? 'tiles' : 'catalogue-fallback',
      },
    });
  } catch (err) {
    console.error('[api:geocode/static]', err);
    return fail(503, 'PREVIEW_UNAVAILABLE', 'Capture-area preview could not be rendered.');
  }
}
