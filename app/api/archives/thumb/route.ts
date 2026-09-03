/** GET /api/archives/thumb?u=&s= — signed proxy for a historical scene's thumbnail. */
import { NextRequest, NextResponse } from 'next/server';
import { thumbUpstream } from '@/lib/archive-thumb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const upstream = thumbUpstream(q.get('u'), q.get('s'));
  if (!upstream) return new NextResponse(null, { status: 404 });
  const res = await fetch(upstream, { signal: AbortSignal.timeout(12_000) }).catch(() => null);
  if (!res || !res.ok) return new NextResponse(null, { status: 502 });
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
    },
  });
}
