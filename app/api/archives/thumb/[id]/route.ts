/**
 * GET /api/archives/thumb/[id]?lat&lon — proxied thumbnail of a historical scene.
 */
import { NextRequest, NextResponse } from 'next/server';
import { archiveScenes } from '@/lib/pricing-live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lon = Number(req.nextUrl.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return new NextResponse(null, { status: 400 });
  const scene = (await archiveScenes(lat, lon)).find((s) => s.id === id);
  if (!scene?.thumb) return new NextResponse(null, { status: 404 });
  const upstream = await fetch(scene.thumb, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!upstream || !upstream.ok) return new NextResponse(null, { status: 502 });
  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
