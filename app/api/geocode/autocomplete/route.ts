/**
 * POST /api/geocode/autocomplete  { q }  → { suggestions: GeoSuggestion[] }
 *
 * Address autocomplete for /start. In mock mode this is a built-in geocoder
 * over ~90 real addresses that synthesises plausible results for anything it
 * does not know, so the field never dead-ends. See lib/integrations/geocode.ts
 * for the live Mapbox path.
 */
import { z } from 'zod';
import { autocomplete } from '@/lib/integrations/geocode';
import { fail, handleError, ok, readJson } from '@/lib/missions/http';

export const dynamic = 'force-dynamic';

const Body = z.object({
  q: z.string().min(1, 'Type an address to search.').max(160),
  limit: z.number().int().min(1).max(10).optional(),
});

export async function POST(req: Request) {
  const parsed = await readJson(req, Body);
  if (parsed.response) return parsed.response;

  try {
    const suggestions = await autocomplete(parsed.data.q, parsed.data.limit ?? 6);
    return ok({ suggestions });
  } catch (err) {
    return handleError('geocode/autocomplete', err);
  }
}

export function GET() {
  return fail(405, 'METHOD_NOT_ALLOWED', 'Use POST with a JSON body: { q }.');
}
