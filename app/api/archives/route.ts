/**
 * GET /api/archives?lat&lon&area&currency&formatId&frame
 *   → { scenes: [{ id, capturedAt, gsdCm, resolution, cloudPct, offNadirDeg, openData, totalMinor, thumb }] }
 *
 * The HISTORICAL captures on file over a target, newest first — what the
 * Window step lists under "Existing captures". Each carries the total the
 * buyer would pay for it at the chosen size and finish (imagery + print +
 * margin). Supplier names never leave the server; thumbnails are proxied.
 */
import { NextRequest, NextResponse } from 'next/server';
import { archiveScenes, liveQuote } from '@/lib/pricing-live';
import { resLabel } from '@/lib/pricing-model';
import type { Currency, FormatId, FrameOption } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function num(v: string | null): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const lat = num(q.get('lat'));
  const lon = num(q.get('lon'));
  if (lat === undefined || lon === undefined) {
    return NextResponse.json({ error: 'TARGET_REQUIRED', detail: 'lat and lon are required.' }, { status: 400 });
  }
  const areaRaw = num(q.get('area'));
  const areaKm = areaRaw ? Math.min(5, Math.max(0.4, areaRaw)) : 2;
  const currency: Currency = q.get('currency') === 'USD' ? 'USD' : 'EUR';
  const formatRaw = q.get('formatId');
  const formatId: FormatId = formatRaw === 'F30' || formatRaw === 'F70' ? formatRaw : 'F50';
  const frame: FrameOption = q.get('frame') === 'FRAMED' ? 'FRAMED' : 'UNFRAMED';

  const scenes = await archiveScenes(lat, lon, areaKm);
  const priced = await Promise.all(
    scenes.slice(0, 60).map(async (s) => {
      const quote = await liveQuote('ARCHIVE', formatId, frame, currency, { lat, lon, areaKm, archiveId: s.id });
      return {
        id: s.id as string,
        capturedAt: s.capturedAt ?? null,
        gsdCm: s.gsdCm ?? null,
        resolution: resLabel(s.resolution),
        cloudPct: s.cloudPct ?? null,
        offNadirDeg: s.offNadirDeg ?? null,
        openData: Boolean(s.openData),
        totalMinor: quote.totalMinor,
        currency,
        thumb: s.thumb ? `/api/archives/thumb/${encodeURIComponent(s.id as string)}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}` : null,
      };
    }),
  );

  return NextResponse.json(
    { lat, lon, areaKm, currency, formatId, frame, scenes: priced },
    { headers: { 'Cache-Control': 'private, max-age=120' } },
  );
}
