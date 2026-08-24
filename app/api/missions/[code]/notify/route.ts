/**
 * POST /api/missions/[code]/notify → { ok: true, stored: boolean }
 *
 * THE ONE FIELD THIS ROUTE MAY WRITE IS `notifyPhone`.
 *
 * The buyer has just paid and, on the confirmation screen, may optionally
 * leave a mobile number so they can be told when a satellite has been
 * found for their mission. That is the whole feature.
 *
 * ------------------------------------------------------------------
 * NOTHING IS SENT, AND THE ROUTE DOES NOT PRETEND OTHERWISE
 * ------------------------------------------------------------------
 * MOCK_MODE is on and no SMS provider is wired. This records a number and
 * the moment consent was given. It does not dispatch anything, does not
 * queue anything, and the response says `stored`, never `sent`. The
 * screen that calls it says the same thing in words — see
 * `components/mission-flow/S10Confirmation.tsx`. A route that returned
 * `{ sent: true }` here would be the exact class of claim this codebase
 * refuses to make.
 *
 * ------------------------------------------------------------------
 * GATING — and what it does NOT protect against
 * ------------------------------------------------------------------
 * A mission code is not a credential: four characters, printed on the
 * sheet and in the URL of every shared link. On its own it must never be
 * enough to write to a mission.
 *
 * But a session is not available either. Accounts are created on first
 * sign-in, and this is called seconds after payment by someone who has
 * almost certainly not signed in yet — so requiring one would block the
 * only case the feature exists for.
 *
 * So the proof is CODE + THE EMAIL THE ORDER WAS PLACED WITH, compared
 * case-insensitively, or an owning session if there happens to be one.
 * A stranger holding a shared link has the code but not the email.
 *
 * What that does NOT stop, stated plainly rather than left implied:
 *   · someone who knows both the code AND the buyer's email can set the
 *     number. That is a narrow window — it needs two facts, one of which
 *     is never published — and the worst it achieves is redirecting a
 *     notification that currently does not exist.
 *   · there is NO rate limiting here. The route is not enumerable (a
 *     wrong email is indistinguishable from a wrong code — both 404) but
 *     a determined caller could grind email guesses against a known code.
 *     A shared limiter belongs in middleware rather than in one route,
 *     and this file should be revisited when one exists.
 *
 * Idempotent: posting the same number twice is a no-op write. Posting an
 * empty string CLEARS the number, which is how consent is withdrawn.
 */
import { getSessionUser } from '@/lib/auth';
import { normalizeMissionCode } from '@/lib/codes';
import { getMissionRowByCode } from '@/lib/missions';
import { prisma } from '@/lib/db';
import { fail, handleError, ok } from '@/lib/missions/http';

export const dynamic = 'force-dynamic';

/** Longest an E.164 number can be, plus room for the spacing people type. */
const MAX_PHONE = 32;
/** Shortest real international subscriber number, minus its country code. */
const MIN_DIGITS = 7;
const MAX_DIGITS = 15;

/**
 * Loose on purpose. The buyer may be anywhere — this site prices in EUR
 * and USD and ships from Nevada and the Netherlands — and no dependency
 * is added to parse numbers. So: an optional leading `+`, then digits and
 * the separators people actually type, with a sane digit count.
 *
 * A number that passes this is not thereby VALID, and nothing in the
 * system claims it is. It is stored as typed.
 */
function looksLikePhone(value: string): boolean {
  if (value.length > MAX_PHONE) return false;
  if (!/^\+?[\d\s().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= MIN_DIGITS && digits <= MAX_DIGITS;
}

/** One refusal for "no such mission" and "not your mission" alike. */
function notOnFile(code: string) {
  return fail(404, 'MISSION_NOT_FOUND', `No mission file exists for ${code}.`);
}

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const normalized = normalizeMissionCode(code);
  if (!normalized) {
    return fail(400, 'INVALID_CODE', 'A mission code is two digits followed by two letters.');
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(400, 'INVALID_BODY', 'Expected a JSON body.');
    }

    const { phone, email } = (body ?? {}) as { phone?: unknown; email?: unknown };

    if (typeof phone !== 'string') {
      return fail(400, 'INVALID_PHONE', 'A phone number is expected as a string.');
    }
    const trimmed = phone.trim();
    const clearing = trimmed === '';

    if (!clearing && !looksLikePhone(trimmed)) {
      return fail(
        400,
        'INVALID_PHONE',
        'That does not look like a phone number. Include the country code, e.g. +31 6 1234 5678.',
      );
    }

    // THE MISSION IS RE-READ SERVER-SIDE. Nothing the caller sent decides
    // which row is written, and nothing they sent can decide what is
    // written into it — the update below names one field.
    const mission = await getMissionRowByCode(normalized);
    if (!mission) return notOnFile(normalized);

    const user = await getSessionUser();
    const owns =
      (user && (mission.userId === user.id || mission.email.toLowerCase() === user.email.toLowerCase())) ||
      (typeof email === 'string' && email.trim().toLowerCase() === mission.email.toLowerCase());

    if (!owns) return notOnFile(normalized);

    await prisma.mission.update({
      where: { id: mission.id },
      data: {
        notifyPhone: clearing ? null : trimmed,
        notifyPhoneAt: clearing ? null : new Date(),
      },
    });

    return ok({ ok: true, stored: !clearing });
  } catch (err) {
    return handleError('mission-notify', err);
  }
}
