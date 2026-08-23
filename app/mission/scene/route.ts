/**
 * GET /mission/scene?lat&lon → what the reveal on screen 1 is showing.
 *
 * The imagery catalogue is ~13 frames of metadata with sourced
 * acquisition dates and it is only ever needed to caption one picture, so
 * it is answered from the server rather than shipped to the browser.
 *
 * The answer is deliberately blunt: which archive scene was chosen, how
 * far it is from the target, and whether that is close enough to quote
 * its acquisition date as the archive date over these coordinates. See
 * `lib/mission-flow/scene.ts`.
 */
import { z } from 'zod';
import { sceneFor } from '@/lib/mission-flow/scene';

export const dynamic = 'force-dynamic';

const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

export async function GET(req: Request) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_QUERY', detail: 'Required: lat, lon.' }, { status: 400 });
  }
  const { lat, lon } = parsed.data;
  return Response.json(sceneFor(lat, lon));
}
