import sharp from 'sharp';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth';
import { normalizeMissionCode } from '@/lib/codes';
import { frameBySlug } from '@/lib/imagery';
import { getMissionByCode, getMissionImagerySlug, pickFrameSlugForCoords } from '@/lib/missions';
import {
  MIN_RENDER_WIDTH,
  PRINT_INTENT,
  composeFallback,
  composePreview,
  isPosterRatio,
  previewCacheKey,
} from '@/lib/poster';
import type { PosterOptions, PosterRatio, PosterStyleId } from '@/lib/poster';
import { isPosterStyleId } from '@/lib/poster/styles';
import { stageReached } from '@/lib/types';
import type { FormatId, MissionDTO } from '@/lib/types';

/**
 * GET /api/poster/{code} → image/png
 *
 * The watermarked dossier exhibit for a mission: the satellite frame, the
 * mission code, the capture timestamp, the `SHOT FROM SPACE` credit box, the
 * coordinates and the orbit telemetry, composed by lib/poster.
 *
 * Query:
 *   ?slug=hero-los-angeles   render any catalogue frame directly. Used by the
 *                            archive gallery and by the purchase preview,
 *                            where there is no mission yet.
 *   ?w=1200                  output width in px (clamped).
 *   ?ratio=3:4|5:7|7:10|1:1  override the ratio implied by the print format.
 *   ?style=dossier           which composition to lay out — one id from
 *                            lib/poster/styles.ts. Omitted, `dossier`, which
 *                            is what this route has always composed. An
 *                            unknown value is ignored rather than answered
 *                            with a composition nobody asked for.
 *   ?print=1                 render at the print-intent geometry for the
 *                            format (300 DPI trim size, clamped). Still
 *                            watermarked — this route never emits a print file.
 *                            See PIPELINE.md §3.
 *
 * A mission poster is released at IMAGE_ACQUIRED. Before that there is no
 * frame, and the route answers 404 with a JSON error rather than inventing one.
 *
 * ------------------------------------------------------------------------
 * WHAT THIS ROUTE RELEASES, AND TO WHOM
 * ------------------------------------------------------------------------
 * The URL is unauthenticated by design — the shared file at /s/{code} uses it
 * as its exhibit, and an <img> cannot negotiate. So the route decides what to
 * PRINT from who is asking, exactly the way `toMissionDTO` decides what to
 * serialise:
 *
 *   owner   the session belongs to the address the mission was filed to.
 *           Gets the plate as it will be printed: the exact fix at 4 dp
 *           (~11 m) and their own dedication line.
 *   anyone  no session, or a session that is not the owner's — including
 *   else    every reader of a shared link. Gets the same plate with the fix
 *           reduced to 2 dp (~1.1 km, the order of the capture footprint) and
 *           no dedication.
 *
 * That closes REVIEW.md §6.1.3: the plate used to print the street-level fix
 * as PIXELS on an unauthenticated URL, which no amount of DTO redaction could
 * reach. It changes nothing about the product — `composePoster` still composes
 * the print file at 4 dp, because the print IS the exact record and it goes to
 * one person.
 *
 * Two mechanical consequences, both easy to get wrong:
 *   · the response varies by cookie, so an owner's plate is sent `private`
 *     and never lands in a shared cache. Every response — 304s included —
 *     carries `Vary: Accept, Cookie`.
 *   · the ETag has to cover the release, or an owner and a stranger would
 *     collide on one cache entry. `previewCacheKey` hashes `coordDp` and
 *     `dedication`, so it does.
 *
 * This endpoint never returns 500. If sharp throws, the frame is missing or
 * the source is unreadable, it serves a designed fallback plate instead —
 * a broken image in the middle of Mission Control would be worse than an
 * honest "FRAME UNAVAILABLE".
 */

export const runtime = 'nodejs';

/** Route-level ceiling, well under the library's. Renders cost CPU. */
const ROUTE_MAX_WIDTH = 2048;
/** Print proofs are bigger, but nowhere near a real 300 DPI file. */
const PRINT_PROOF_MAX_WIDTH = 2400;

const PNG = 'image/png';

function jsonError(error: string, detail: string, status: number) {
  return NextResponse.json({ error, detail }, { status });
}

function readWidth(raw: string | null, max: number, fallback?: number): number | undefined {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(MIN_RENDER_WIDTH, Math.round(n)));
}

function readRatio(raw: string | null): PosterRatio | undefined {
  return raw && isPosterRatio(raw) ? raw : undefined;
}

/**
 * The composition to lay out. Undefined for anything that is not a catalogue
 * id, so a typo composes the standing division rather than 404ing an <img>.
 */
function readStyle(raw: string | null): PosterStyleId | undefined {
  return isPosterStyleId(raw) ? raw : undefined;
}

/**
 * Which catalogue frame backs a mission. `imagerySlug` is stored on the row in
 * mock mode and read back through `getMissionImagerySlug`; if that is missing
 * or names a frame that is no longer in the catalogue, fall back to the same
 * deterministic nearest-frame rule the backend uses when assigning it. Live
 * captures replace both — see PIPELINE.md §1.
 */
async function slugForMission(mission: MissionDTO): Promise<string> {
  const stored = await getMissionImagerySlug(mission.code);
  if (stored && frameBySlug(stored)) return stored;
  return pickFrameSlugForCoords(mission.lat, mission.lon);
}

function png(body: Buffer, headers: Record<string, string>) {
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: { 'Content-Type': PNG, 'Content-Length': String(body.length), ...headers },
  });
}

/**
 * The composed plate is a photograph, and PNG is lossless: a 960px preview
 * lands around 2.3 MB, which is unacceptable on a phone that re-polls this
 * image while a mission advances. Every browser that can render this page
 * sends `image/webp` in Accept, so serve WebP to those and keep PNG as the
 * literal fallback for anything else (curl, older tooling, the print proof).
 *
 * Quality 82 holds the hairlines and the monospace telemetry without visible
 * artefacts and cuts the payload by roughly an order of magnitude.
 */
const WEBP_QUALITY = 82;

async function plateResponse(
  body: Buffer,
  accept: string | null,
  headers: Record<string, string>,
) {
  if (!accept?.includes('image/webp')) return png(body, headers);
  try {
    const webp = await sharp(body).webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer();
    return new NextResponse(new Uint8Array(webp), {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(webp.length),
        Vary: 'Accept',
        ...headers,
      },
    });
  } catch {
    // Re-encoding is an optimisation, never a failure mode.
    return png(body, headers);
  }
}

/**
 * Is this request the owner's?
 *
 * The same two-step /m/[code] makes: a session alone is not an entitlement, so
 * the mission is read WITH private fields and the session's address is then
 * checked against the one the mission was filed to. Never throws — a failure
 * to resolve a session is a public request, not an error.
 */
async function isOwnerOf(mission: MissionDTO): Promise<boolean> {
  const user = await getSessionUser().catch(() => null);
  if (!user || !mission.private) return false;
  return mission.private.email.toLowerCase() === user.email.toLowerCase();
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await ctx.params;
  const url = new URL(request.url);
  const slugParam = url.searchParams.get('slug');

  // `variant` is the vocabulary the mission state machine writes into
  // `deliverableUrl` and into the Gelato print-file URL (lib/missions/state.ts).
  // `print=1` is the equivalent shorthand used by hand and in PIPELINE.md.
  //   variant=print → print-intent geometry (a proof, still watermarked)
  //   variant=full  → the largest preview this route will compose
  // Neither emits an unwatermarked file: the deliverable is the printed object,
  // and the real print file comes from composePoster() in the production
  // pipeline, not from this endpoint.
  const variant = url.searchParams.get('variant');
  const wantsPrint = url.searchParams.get('print') === '1' || variant === 'print';
  const wantsFull = variant === 'full';
  // Part of the pixels, so it is part of `previewCacheKey` and therefore part
  // of the ETag — two compositions of one mission cannot collide on a cache
  // entry. `composePreview` handles the default.
  const styleId = readStyle(url.searchParams.get('style'));

  const code = normalizeMissionCode(rawCode ?? '');

  let opts: PosterOptions;
  let cacheControl: string;
  /** Whether this request is the mission owner's. Archive frames have none. */
  let owner = false;

  try {
    if (slugParam) {
      /* --- archive frame: no mission required --------------------- */
      const frame = frameBySlug(slugParam);
      if (!frame) {
        return jsonError(
          'FRAME NOT IN CATALOGUE',
          `No archive frame is filed under "${slugParam}".`,
          404,
        );
      }
      const ratio = readRatio(url.searchParams.get('ratio')) ?? '3:4';
      opts = {
        slug: frame.slug,
        missionCode: code ?? '00AA',
        capturedAt: frame.acquired.date ?? '',
        lat: frame.lat,
        lon: frame.lon,
        locationLabel: `${frame.city} / ${frame.admin} / ${frame.country}`,
        orbit: frame.orbit,
        ratio,
        styleId,
        width: wantsFull
          ? ROUTE_MAX_WIDTH
          : readWidth(url.searchParams.get('w'), ROUTE_MAX_WIDTH),
      };
      // No `coordDp` and no dedication here on purpose. A catalogue frame is
      // published NASA/USGS imagery of a city, not a customer's address: there
      // is no owner to gate on and nothing to withhold, so the plate prints the
      // frame's own published centre at full precision — which is also what
      // makes the purchase preview an honest picture of the product.
      //
      // Archive frames are immutable: the same slug always composes the same
      // plate, so this can sit in a CDN for a long time.
      cacheControl = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
    } else {
      /* --- a real mission ----------------------------------------- */
      if (!code) {
        return jsonError(
          'INVALID MISSION CODE',
          'A mission code is two digits followed by two letters, e.g. 32BF.',
          404,
        );
      }
      // Read WITH private fields — the owner's plate needs the exact fix and
      // the dedication — and then decide, below, how much of that this
      // particular request is allowed to see. Nothing private is serialised
      // out of this route either way: it returns an image.
      const mission = await getMissionByCode(code, { includePrivate: true });
      if (!mission) {
        return jsonError('MISSION NOT ON FILE', `No mission is filed under ${code}.`, 404);
      }
      if (!stageReached(mission.stage, 'IMAGE_ACQUIRED')) {
        return jsonError(
          'PREVIEW NOT RELEASED',
          `Mission ${code} has not been captured yet. The preview is released at IMAGE ACQUIRED.`,
          404,
        );
      }

      owner = await isOwnerOf(mission);

      const formatId: FormatId = mission.format.id;
      const ratio = readRatio(url.searchParams.get('ratio'));
      const width = wantsPrint
        ? Math.min(PRINT_INTENT[formatId].widthPx, PRINT_PROOF_MAX_WIDTH)
        : wantsFull
          ? ROUTE_MAX_WIDTH
          : readWidth(url.searchParams.get('w'), ROUTE_MAX_WIDTH);

      opts = {
        slug: await slugForMission(mission),
        missionCode: mission.code,
        capturedAt: mission.capturedAt ?? mission.createdAt,
        lat: mission.lat,
        lon: mission.lon,
        locationLabel: mission.locationLabel,
        orbit: mission.orbit,
        formatId,
        ratio,
        // The composition the buyer chose at order time unless a style is asked for.
        styleId: styleId ?? readStyle(mission.posterStyle),
        width,
        // The dedication is printed ON the object, so the plate is exactly
        // where it belongs — it is the answer to "what is this place?" and
        // the reason this print is not a stock photograph. It arrives here
        // already sanitised by `toMissionDTO`; the composer sanitises again.
        //
        // Owner only. It is owner-gated in the JSON (`MissionDTO.private`)
        // and it is the customer's own sentence about their own life, so an
        // unauthenticated URL keyed on a four-character code does not print
        // it. The owner's browser sends its session cookie with the <img>
        // request, so the person who wrote the line sees it on their own
        // mission file — which is where they need to check it before it goes
        // to the press.
        dedication: owner ? (mission.private?.dedication ?? null) : null,
        // The public rule, applied to pixels. See the header.
        coordDp: owner ? 4 : 2,
      };
      // The plate changes when the mission advances, so keep the window short
      // and let the ETag carry the polling traffic. An owner's plate carries
      // their fix and their words: `private`, so no shared cache holds it.
      cacheControl = owner
        ? 'private, max-age=60, must-revalidate'
        : 'public, max-age=60, stale-while-revalidate=600';
    }

    /* --- conditional request ------------------------------------- */
    const acceptsWebp = request.headers.get('accept')?.includes('image/webp') ?? false;
    const etag = `"${previewCacheKey(opts)}${acceptsWebp ? '-webp' : '-png'}"`;
    // The body depends on the encoding the client accepts AND on the session
    // it presents (`coordDp`, the dedication). Both go in `Vary` on every
    // response, 304s included, or a cache in front of this route would hand
    // one visitor's release to another.
    const release = {
      ETag: etag,
      'Cache-Control': cacheControl,
      Vary: 'Accept, Cookie',
    };
    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers: release });
    }

    const buffer = await composePreview(opts);
    return plateResponse(buffer, request.headers.get('accept'), {
      ...release,
      'X-Poster-Intent': wantsPrint ? 'print-proof' : 'preview',
    });
  } catch (error) {
    // Never 500 on an <img> src.
    console.error('[poster] compose failed', { code: rawCode, slug: slugParam }, error);
    try {
      const fallback = await composeFallback({ missionCode: code ?? '00AA' });
      return png(fallback, {
        'Cache-Control': 'no-store',
        'X-Poster-Fallback': '1',
      });
    } catch {
      return jsonError(
        'PLATE UNAVAILABLE',
        'The composer could not produce this plate. Mission Control has been notified.',
        503,
      );
    }
  }
}
