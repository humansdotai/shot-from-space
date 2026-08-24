/**
 * GET /api/tiles/meta → TileDescriptor
 *
 * Which provider `/api/tiles/{z}/{x}/{y}` is actually serving, and the
 * attribution that provider's licence requires.
 *
 * The component cannot work this out for itself: MAPTILER_KEY and
 * MAPBOX_ACCESS_TOKEN are server-only by design, so `activeProvider()`
 * evaluated in the browser would always report the keyless default and
 * a keyed deployment would print the wrong credit — a licence breach,
 * not a cosmetic bug. One small fetch buys a credit line that is always
 * true.
 *
 * The response carries no URL and no key: see `TileDescriptor`.
 */
import { NextResponse } from 'next/server';
import { activeProvider, describeProvider } from '@/lib/tiles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(describeProvider(activeProvider()), {
    headers: {
      // Long enough that a map mount is one request, short enough that
      // adding a key and restarting is visible without a hard reload.
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  });
}
