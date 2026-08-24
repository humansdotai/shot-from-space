/**
 * GET /api/geocode/static?lat&lon&zoom&w&h  → image/jpeg
 *
 * The capture-area preview shown during purchase: "this is the patch of ground
 * the satellite will be pointed at". It must return a plausible overhead image
 * for ANY address the customer types, instantly, with no key.
 *
 * MOCK BEHAVIOUR
 *   Deterministically selects the nearest CATALOGUE frame to the coordinates
 *   (lib/missions/frames.ts), then crops a window out of it whose size is
 *   driven by `zoom` and whose position is seeded by the coordinates, and
 *   scales that window to w × h with `sharp`. Same coordinates in, same pixels
 *   out — the preview does not flicker between renders, and it is cacheable
 *   forever.
 *
 * WHERE A REAL TILE PROVIDER PLUGS IN
 *   Replace the block marked `--- MOCK RENDER ---` with a single upstream
 *   fetch. For Mapbox Static Images:
 *
 *     GET https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static
 *         /{lon},{lat},{zoom},0/{w}x{h}@2x?access_token={MAPBOX_ACCESS_TOKEN}
 *
 *   …then stream the upstream body straight through with the same cache
 *   headers. Guard it with `isLive('geocoder')` exactly as the geocode adapter
 *   does, and keep the mock as the fallback so a rate-limited or unpaid
 *   Mapbox account degrades to a working preview instead of a broken image.
 *   (Note: Mapbox's satellite tiles are NOT a fresh capture — they are an
 *   archive mosaic. That is the correct thing to show at purchase time; the
 *   real capture is what the customer is buying.)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { pickFrameForCoords } from '@/lib/missions/frames';
import { fail } from '@/lib/missions/http';
import { seededUnit } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  zoom: z.coerce.number().min(1).max(22).default(16),
  w: z.coerce.number().int().min(64).max(2000).default(1200),
  h: z.coerce.number().int().min(64).max(2000).default(800),
});

/**
 * How much of the source frame a given zoom level shows.
 * z12 ≈ 90% of the frame (a city), z19 ≈ 9% (a rooftop).
 */
function cropFraction(zoom: number): number {
  return Math.min(0.95, Math.max(0.06, 0.9 * Math.pow(0.74, zoom - 12)));
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* ------------------------------------------------------------------ */
/* WHERE IN THE FRAME TO LOOK                                          */
/* ------------------------------------------------------------------ */
/**
 * The detail map: how much is going on in each cell of the source frame.
 *
 * The whole frame is decoded ONCE at 192 x 192 greyscale and the standard
 * deviation of each cell of an 8 x 8 grid is measured in plain JS. Open
 * water is flat, so it scores near zero; a coastline, a city or field
 * boundaries score high. Nothing here reads geography — these frames carry
 * no bounds (see lib/missions/frames.ts) — it only avoids showing a buyer
 * a rectangle of empty sea and calling it their ground.
 *
 * Returned in SOURCE pixel coordinates, best first.
 */
async function detailCentres(
  bytes: Buffer,
  srcW: number,
  srcH: number,
): Promise<{ x: number; y: number }[]> {
  const PROBE = 192;
  const GRID = 8;
  const { data } = await sharp(bytes, { failOn: 'none' })
    .greyscale()
    .resize(PROBE, PROBE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cell = PROBE / GRID;
  const cells: { x: number; y: number; score: number }[] = [];
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let y = Math.round(gy * cell); y < Math.round((gy + 1) * cell); y++) {
        for (let x = Math.round(gx * cell); x < Math.round((gx + 1) * cell); x++) {
          const v = data[y * PROBE + x];
          sum += v;
          sumSq += v * v;
          n++;
        }
      }
      const mean = sum / n;
      cells.push({
        x: Math.round(((gx + 0.5) / GRID) * srcW),
        y: Math.round(((gy + 0.5) / GRID) * srcH),
        score: Math.sqrt(Math.max(0, sumSq / n - mean * mean)),
      });
    }
  }

  // Deterministic order: score first, then position, so two cells that tie
  // never swap between processes.
  cells.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
  return cells.map(({ x, y }) => ({ x, y }));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return fail(
      400,
      'INVALID_QUERY',
      'Required: lat, lon. Optional: zoom (1-22), w, h (64-2000).',
    );
  }

  const { lat, lon, zoom, w, h } = parsed.data;

  try {
    /* --- MOCK RENDER --------------------------------------------- */
    const frame = pickFrameForCoords(lat, lon);
    const file = path.join(process.cwd(), 'public', frame.src.replace(/^\//, ''));
    const bytes = await fs.readFile(file);
    const source = sharp(bytes, { failOn: 'none' });
    const meta = await source.metadata();

    const srcW = meta.width ?? frame.width;
    const srcH = meta.height ?? frame.height;

    /* THE CROP IS TAKEN OFF THE SHORT SIDE.
       It used to be taken off the width and then corrected downwards when
       the result did not fit the height, and the correction was not
       monotonic: on a 2400 x 1600 frame at a square aspect, z11 produced a
       1520px window and z13 produced a 1598px one — the second step of the
       descent zoomed OUT. Sizing from the short side makes the window
       shrink at every step, at every source proportion. */
    const frac = cropFraction(zoom);
    const short = Math.min(srcW, srcH);
    let cropH = Math.round(short * frac);
    let cropW = Math.round(cropH * (w / h));
    if (cropW > srcW) {
      cropW = srcW;
      cropH = Math.round(cropW * (h / w));
    }
    cropW = Math.max(32, Math.min(cropW, srcW));
    cropH = Math.max(32, Math.min(cropH, srcH));

    /* ONE CENTRE FOR EVERY ZOOM LEVEL.
       `left`/`top` used to be `unit * (src - crop)`, which puts the crop's
       CENTRE at `unit * src + crop * (0.5 - unit)` — a centre that moves as
       the window shrinks. <RevealStage /> requests z11, z13 and z15 of the
       same coordinates and cross-fades them as a descent, and the three
       landed up to 60% of the frame apart: the "descent" panned across the
       picture instead of falling into it, and for a coastal source frame it
       finished on open water. Damrak 70, Amsterdam ended on a square of the
       North Sea, and the same z17 crop is what <PosterStage /> prints.

       So the centre is chosen ONCE per address and every zoom shares it.
       Candidates come from `detailCentres()` best-first; the coordinates
       pick among the top eight, so two addresses still get two different —
       and still perfectly stable — patches of ground, and none of them is a
       featureless rectangle. */
    const seed = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const candidates = await detailCentres(bytes, srcW, srcH);
    const pick = candidates[Math.floor(seededUnit(`c:${seed}`) * Math.min(8, candidates.length))];
    const left = clamp(Math.round(pick.x - cropW / 2), 0, srcW - cropW);
    const top = clamp(Math.round(pick.y - cropH / 2), 0, srcH - cropH);

    const buffer = await source
      .extract({ left, top, width: cropW, height: cropH })
      .resize(w, h, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    /* --- END MOCK RENDER ----------------------------------------- */

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(buffer.byteLength),
        // Deterministic output: safe to cache hard.
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        // Useful for debugging which frame backed a preview.
        'X-Capture-Frame': frame.slug,
      },
    });
  } catch (err) {
    console.error('[api:geocode/static]', err);
    return fail(503, 'PREVIEW_UNAVAILABLE', 'Capture-area preview could not be rendered.');
  }
}
