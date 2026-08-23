/**
 * POST /api/missions/[code]/cancel → { mission: MissionDTO }
 *
 * THE CANCELLATION THE SITE PROMISES.
 *
 * /legal/terms and the five guarantees both say the same thing: cancel for a
 * full refund at any point before the satellite is tasked. This is the route
 * that makes that true. It writes the CANCELLED transition and its event
 * through the state machine, and the state machine sends the notice — see
 * `cancelEffect` in lib/missions/state.ts.
 *
 * GATING — the mission code is NOT a credential.
 *
 * A code is four characters, printed on the sheet, in the URL of every shared
 * link and in the confirmation email. Anything destructive behind it has to
 * be gated on the session, and on the session BELONGING to this mission:
 *
 *   1. no session at all            → 401
 *   2. a session that is not the owner's, or a code with no mission behind it
 *                                   → 404, identically. A signed-in stranger
 *                                     must not be able to use this endpoint to
 *                                     discover which codes exist.
 *   3. the owner, after the window  → 409 with the reason in plain words.
 *
 * Ownership is `userId` OR the mission's email matching the session's. Both,
 * because missions are created before any user row exists and are relinked to
 * the account on first sign-in (lib/auth.ts) — an order placed and cancelled
 * in the same hour may never have been through that relink.
 */
import { getSessionUser } from '@/lib/auth';
import { normalizeMissionCode } from '@/lib/codes';
import { cancelMission, getMissionRowByCode } from '@/lib/missions';
import { fail, handleError, ok } from '@/lib/missions/http';

export const dynamic = 'force-dynamic';

/** The one refusal used for "no such mission" and "not your mission" alike. */
function notOnFile(code: string) {
  return fail(404, 'MISSION_NOT_FOUND', `No mission file exists for ${code}.`);
}

export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const normalized = normalizeMissionCode(code);
  if (!normalized) {
    return fail(400, 'INVALID_CODE', 'A mission code is two digits followed by two letters.');
  }

  try {
    const user = await getSessionUser();
    if (!user) {
      return fail(
        401,
        'NOT_SIGNED_IN',
        'Sign in with the address the mission was filed to before cancelling it.',
      );
    }

    const row = await getMissionRowByCode(normalized);
    if (!row) return notOnFile(normalized);

    const isOwner =
      (row.userId !== null && row.userId === user.id) ||
      row.email.trim().toLowerCase() === user.email.trim().toLowerCase();
    if (!isOwner) return notOnFile(normalized);

    // The window check lives in the mission layer, not here: the rule and the
    // words that explain it are one thing, and a MissionTransitionError maps
    // to 409 through `handleError`.
    const mission = await cancelMission(normalized, { enforceCancellationWindow: true });

    // The caller has just proved ownership, so the owner projection is theirs.
    return ok({ mission });
  } catch (err) {
    return handleError('missions/[code]/cancel', err);
  }
}

export function GET() {
  return fail(
    405,
    'METHOD_NOT_ALLOWED',
    'Use POST to cancel a mission you own.',
  );
}
