/**
 * GET /api/print/[code]?t=<token>
 *
 * THE PRINT FILE. Full print geometry for the ordered size, no watermark,
 * composed from the ACTUAL delivered capture when one is on file
 * (`Mission.captureAssetUrl`), else from the mission's reference frame.
 * Reachable with the signed token (what Gelato is sent — lib/print-file.ts)
 * or by a signed-in operator (/admin cookie). Never cached publicly.
 */
import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin';
import { normalizeMissionCode } from '@/lib/codes';
import { getMissionByCode, getMissionImagerySlug, getMissionRowByCode, pickFrameSlugForCoords } from '@/lib/missions';
import { composeFallback, composePoster } from '@/lib/poster/compose';
import { printTokenValid } from '@/lib/print-file';
import type { PosterStyleId } from '@/lib/poster/types';
import type { FormatId } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function contentType(buf: Buffer): string {
  if (buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  return 'application/octet-stream';
}

async function fetchAsset(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25_000), cache: 'no-store' });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return ab.byteLength > 1024 ? Buffer.from(ab) : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code: raw } = await ctx.params;
  const code = normalizeMissionCode(raw);
  if (!code) return NextResponse.json({ error: 'INVALID_CODE' }, { status: 404 });

  const url = new URL(request.url);
  const authorised = printTokenValid(code, url.searchParams.get('t')) || (await isAdminRequest());
  if (!authorised) return NextResponse.json({ error: 'NOT_AUTHORISED' }, { status: 403 });

  const [mission, row] = await Promise.all([
    getMissionByCode(code, { includePrivate: true }),
    getMissionRowByCode(code),
  ]);
  if (!mission || !row) return NextResponse.json({ error: 'MISSION_NOT_FOUND' }, { status: 404 });

  const formatId = mission.format.id as FormatId;
  const imageBuffer = row.captureAssetUrl ? await fetchAsset(row.captureAssetUrl) : null;
  const slug = imageBuffer ? undefined : ((await getMissionImagerySlug(code)) ?? pickFrameSlugForCoords(row.lat, row.lon));
  const styleId = (mission.posterStyle ?? undefined) as PosterStyleId | undefined;

  const download = url.searchParams.get('download') === '1';
  try {
    const buf = await composePoster({
      slug,
      imageBuffer: imageBuffer ?? undefined,
      missionCode: mission.code,
      capturedAt: mission.capturedAt ?? mission.createdAt,
      lat: row.lat,
      lon: row.lon,
      locationLabel: mission.locationLabel,
      orbit: mission.orbit,
      formatId,
      styleId,
      print: true,
      dedication: mission.private?.dedication ?? null,
      coordDp: 4,
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': contentType(buf),
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="mission-${code}-print.${contentType(buf) === 'image/jpeg' ? 'jpg' : 'png'}"`,
        'Cache-Control': 'private, no-store',
        'X-Print-Source': imageBuffer ? 'capture' : 'reference',
      },
    });
  } catch (error) {
    console.error('[print] compose failed', { code }, error);
    const buf = await composeFallback({ missionCode: code, formatId });
    return new NextResponse(new Uint8Array(buf), {
      status: 500,
      headers: { 'Content-Type': contentType(buf), 'Cache-Control': 'private, no-store', 'X-Print-Source': 'fallback' },
    });
  }
}
