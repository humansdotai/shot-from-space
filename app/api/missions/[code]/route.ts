/**
 * GET /api/missions/[code] → { mission: MissionDTO }
 *
 * The public read of a mission file. Redacted: this route never returns the
 * street address, the customer email, the amount or the receipt number.
 * Owner views are server-rendered and call getMissionByCode(code,
 * { includePrivate: true }) directly; the account API belongs to Agent 7.
 */
import { getMissionByCode } from '@/lib/missions';
import { normalizeMissionCode } from '@/lib/codes';
import { fail, handleError, ok } from '@/lib/missions/http';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const normalized = normalizeMissionCode(code);
  if (!normalized) {
    return fail(400, 'INVALID_CODE', 'A mission code is two digits followed by two letters.');
  }

  try {
    const mission = await getMissionByCode(normalized);
    if (!mission) {
      return fail(404, 'MISSION_NOT_FOUND', `No mission file exists for ${normalized}.`);
    }
    return ok({ mission });
  } catch (err) {
    return handleError('missions/[code]', err);
  }
}
