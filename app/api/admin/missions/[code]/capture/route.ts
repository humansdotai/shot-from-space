/**
 * GET /api/admin/missions/[code]/capture
 *
 * Streams the ACTUAL delivered capture for a mission to a signed-in operator:
 * the SkyFi asset behind `captureAssetUrl`, or a fresh signed download
 * resolved from the SkyFi order when the stored link has gone stale. In mock
 * mode the adapter's asset is a local catalogue file, served by redirect.
 */
import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin';
import { normalizeMissionCode } from '@/lib/codes';
import { SITE_URL } from '@/lib/env';
import { fetchCapture } from '@/lib/integrations/skyfi';
import { getMissionRowByCode } from '@/lib/missions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'NOT_ADMIN' }, { status: 401 });
  const { code: raw } = await ctx.params;
  const code = normalizeMissionCode(raw);
  if (!code) return NextResponse.json({ error: 'INVALID_CODE' }, { status: 404 });
  const row = await getMissionRowByCode(code);
  if (!row) return NextResponse.json({ error: 'MISSION_NOT_FOUND' }, { status: 404 });

  let asset = row.captureAssetUrl ?? null;
  if (!asset && row.skyfiOrderId) {
    const capture = await fetchCapture(row.skyfiOrderId).catch(() => null);
    asset = capture?.assetUrl || null;
  }
  if (!asset) {
    return NextResponse.json(
      { error: 'NO_CAPTURE', detail: 'No delivered capture is on file for this mission yet.' },
      { status: 404 },
    );
  }
  if (asset.startsWith('/')) return NextResponse.redirect(`${SITE_URL}${asset}`);

  const upstream = await fetch(asset, { signal: AbortSignal.timeout(50_000), cache: 'no-store' }).catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'UPSTREAM', detail: 'The capture could not be fetched from the provider.' }, { status: 502 });
  }
  const type = upstream.headers.get('content-type') ?? 'application/octet-stream';
  const ext = type.includes('tiff') ? 'tif' : type.includes('png') ? 'png' : type.includes('jpeg') ? 'jpg' : 'bin';
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="mission-${code}-capture.${ext}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
