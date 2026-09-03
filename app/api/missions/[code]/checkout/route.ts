/**
 * POST /api/missions/[code]/checkout   { k?: string }
 *   → { url }
 *
 * RETRY PAYMENT. Opens a fresh Stripe Checkout Session for a mission that
 * is still unpaid, for its owner — proven either by a signed-in session on
 * the mission's email or by the mission's share key (`k`), which is what
 * the `shot.space/M{code}?k=…` link carries.
 */
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { normalizeMissionCode } from '@/lib/codes';
import { createCheckoutSession } from '@/lib/integrations/stripe';
import { attachCheckoutSession, getMissionRowByCode } from '@/lib/missions';
import { fail, handleError, ok, readJson } from '@/lib/missions/http';
import { getFormat } from '@/lib/pricing';
import type { Currency, FormatId } from '@/lib/types';

export const dynamic = 'force-dynamic';

const Body = z.object({ k: z.string().max(200).optional() });

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const normalized = normalizeMissionCode(code);
  if (!normalized) return fail(400, 'INVALID_CODE', 'A mission code is two digits followed by two letters.');

  const parsed = await readJson(req, Body);
  if (parsed.response) return parsed.response;

  try {
    const row = await getMissionRowByCode(normalized);
    if (!row) return fail(404, 'MISSION_NOT_FOUND', `No mission file exists for ${normalized}.`);

    const user = await getSessionUser().catch(() => null);
    const byKey = Boolean(parsed.data.k && parsed.data.k === row.shareToken);
    const bySession = Boolean(
      user && (row.userId === user.id || row.email.toLowerCase() === user.email.toLowerCase()),
    );
    if (!byKey && !bySession) {
      return fail(403, 'NOT_OWNER', 'Open this mission with its keyed link or sign in with the address it was filed to.');
    }
    if (row.state === 'CANCELLED') return fail(409, 'CANCELLED', 'This mission is cancelled.');
    if (row.paidAt) return fail(409, 'ALREADY_PAID', 'This mission is already paid.');

    const format = getFormat(row.formatId as FormatId);
    const session = await createCheckoutSession({
      missionCode: row.code,
      amountMinor: row.amountMinor,
      currency: row.currency as Currency,
      email: row.email,
      description: `MISSION / ${row.code} — ${format.metric} / ${row.frame}`,
      returnKey: row.shareToken,
    });
    await attachCheckoutSession(row.code, session.id);
    return ok({ url: session.url });
  } catch (err) {
    return handleError('missions/[code]/checkout', err);
  }
}

export function GET() {
  return fail(405, 'METHOD_NOT_ALLOWED', 'Use POST to reopen payment for a mission.');
}
