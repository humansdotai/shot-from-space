/**
 * GET /api/missions/[code]/share?k=token → { mission: MissionDTO }
 *
 * The read-only shared view behind /s/[code]. The token is the mission's
 * unguessable shareToken; without an exact match this route is a 404, not a
 * 403 — an invalid link should not confirm that a mission exists.
 */
import { getMissionByShareToken } from '@/lib/missions';
import { normalizeMissionCode } from '@/lib/codes';
import { fail, handleError, ok } from '@/lib/missions/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const token = new URL(req.url).searchParams.get('k') ?? '';

  const normalized = normalizeMissionCode(code);
  if (!normalized) {
    return fail(400, 'INVALID_CODE', 'A mission code is two digits followed by two letters.');
  }
  if (!token) {
    return fail(400, 'MISSING_KEY', 'A share link requires its access key: ?k=');
  }

  try {
    const mission = await getMissionByShareToken(normalized, token);
    if (!mission) {
      return fail(404, 'MISSION_NOT_FOUND', 'That share link is not valid.');
    }
    return ok({ mission });
  } catch (err) {
    return handleError('missions/[code]/share', err);
  }
}
