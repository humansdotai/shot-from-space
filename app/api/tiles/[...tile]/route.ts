/**
 * GET /api/tiles/{z}/{x}/{y}      → image/jpeg
 * GET /api/tiles/{z}/{x}/{y}.jpg  → the same
 *
 * The one URL the basemap is addressed by. The browser never learns
 * which company is serving the pixels, and it never sees a key —
 * `lib/tiles.ts` picks the provider here, on the server, so adding
 * MAPTILER_KEY later upgrades every map in the product without a
 * single change to <FrameOnMap />.
 *
 * WHY PROXY AT ALL, rather than pointing <img src> straight at EOX:
 *   · a key can be introduced with no client change (the whole point);
 *   · the provider can be swapped or failed over centrally;
 *   · caching is ours to set — see below;
 *   · the CSP stays same-origin for imagery.
 *
 * CACHING
 *   `s2cloudless-2020` is a frozen annual mosaic: a tile at (z,x,y) is
 *   the same bytes forever. Successes are cached hard and immutably.
 *   Failures are cached NOT AT ALL, so a blip does not pin a hole in
 *   the map for a day.
 *
 * FAILURE
 *   Answers a JSON error with the real status, deliberately NOT a
 *   placeholder image. An <img> can only report a failure it is
 *   actually given: hand it a grey square and it reports success, and
 *   the map silently lies about having imagery. Failing properly is
 *   what lets the component count broken tiles, show its hatched
 *   ground through them, and say on screen that the basemap is down —
 *   while the frame, the coordinates and the footprint keep working,
 *   because none of them depend on the picture.
 */
import { fail } from '@/lib/missions/http';
import { activeProvider } from '@/lib/tiles';

export const runtime = 'nodejs';
/** The route reads env to choose a provider; it must not be prerendered. */
export const dynamic = 'force-dynamic';

/** A tile fetch that has not answered in this long is a tile fetch that failed. */
const UPSTREAM_TIMEOUT_MS = 8_000;

/** One year. The 2020 mosaic is not going to change under us. */
const CACHE_OK = 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400, immutable';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tile: string[] }> },
) {
  const { tile } = await ctx.params;

  if (!tile || tile.length !== 3) {
    return fail(400, 'INVALID_TILE', 'Expected /api/tiles/{z}/{x}/{y}.');
  }

  const z = Number(tile[0]);
  const x = Number(tile[1]);
  // The last segment may carry an extension: 5448.jpg
  const y = Number(tile[2].replace(/\.(jpe?g|png|webp)$/i, ''));

  const provider = activeProvider();

  if (!Number.isInteger(z) || z < provider.minZoom || z > provider.maxZoom) {
    return fail(
      400,
      'INVALID_TILE',
      `Zoom must be an integer in ${provider.minZoom}–${provider.maxZoom}.`,
    );
  }

  const span = 2 ** z;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= span || y >= span) {
    return fail(400, 'INVALID_TILE', `x and y must be integers in 0–${span - 1} at z${z}.`);
  }

  let upstream: Response;
  try {
    upstream = await fetch(provider.url(z, x, y), {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      // Attribution is rendered in the product; the referer is courtesy.
      headers: { Accept: 'image/jpeg,image/png,image/*' },
      cache: 'no-store',
    });
  } catch (err) {
    console.error(`[tiles] ${provider.id} ${z}/${x}/${y} unreachable:`, (err as Error).message);
    return fail(502, 'TILE_UNAVAILABLE', 'The basemap provider did not answer.');
  }

  if (!upstream.ok) {
    console.error(`[tiles] ${provider.id} ${z}/${x}/${y} → ${upstream.status}`);
    return fail(502, 'TILE_UNAVAILABLE', `Basemap provider answered ${upstream.status}.`);
  }

  const body = await upstream.arrayBuffer();
  const type = upstream.headers.get('content-type') ?? 'image/jpeg';

  // A provider that answers 200 with an HTML error page is a real failure
  // mode (expired key, quota wall). Reject anything that is not an image
  // rather than letting the browser render a broken picture.
  if (!type.startsWith('image/')) {
    console.error(`[tiles] ${provider.id} ${z}/${x}/${y} returned ${type}, not an image`);
    return fail(502, 'TILE_UNAVAILABLE', 'The basemap provider returned a non-image response.');
  }

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Length': String(body.byteLength),
      'Cache-Control': CACHE_OK,
      'X-Tile-Provider': provider.id,
    },
  });
}
