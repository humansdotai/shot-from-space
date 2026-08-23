/**
 * POST /api/geocode/reverse  { lat, lon }  → { suggestion: GeoSuggestion | null }
 *
 * Turns a browser geolocation fix into a street address for /start, so the
 * buyer can aim the satellite at where they are standing instead of typing.
 *
 * The adapter runs server-side (the live Mapbox path needs a key the browser
 * must never see), so the coordinates come to us and the address goes back.
 * In mock mode this resolves against the built-in geocoder — see
 * lib/integrations/geocode.ts.
 *
 * A null suggestion is a normal answer, not an error: a fix in open water or
 * a desert has no street address. The caller falls back to the text field.
 */
import { z } from 'zod';
import { reverse } from '@/lib/integrations/geocode';
import { fail, handleError, ok, readJson } from '@/lib/missions/http';

export const dynamic = 'force-dynamic';

const Body = z.object({
  // Finite and in range: a NaN or an out-of-range fix is a client bug, not a
  // place, and it must not reach the adapter.
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
});

export async function POST(req: Request) {
  const parsed = await readJson(req, Body);
  if (parsed.response) return parsed.response;

  const { lat, lon } = parsed.data;

  try {
    const suggestion = await reverse(lat, lon);
    return ok({ suggestion });
  } catch (err) {
    return handleError('geocode/reverse', err);
  }
}

export function GET() {
  return fail(405, 'METHOD_NOT_ALLOWED', 'Use POST with a JSON body: { lat, lon }.');
}
