/**
 * GET /api/missions → { missions: MissionDTO[] }
 *
 * The public gallery feed: seeded demo missions plus any customer mission
 * opted into the gallery. Always redacted — no `private` block, ever.
 */
import { listPublicMissions } from '@/lib/missions';
import { handleError, ok } from '@/lib/missions/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const missions = await listPublicMissions();
    return ok({ missions });
  } catch (err) {
    return handleError('missions', err);
  }
}
