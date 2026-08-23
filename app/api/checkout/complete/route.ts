/**
 * POST /api/checkout/complete  { missionCode }  → { ok, missionCode }
 *
 * MOCK MODE ONLY. This is what Agent 4's /checkout/mock/[id] screen calls when
 * the customer presses PAY. In live mode the equivalent signal arrives as a
 * Stripe `checkout.session.completed` webhook, so this route refuses to run.
 */
import { z } from 'zod';
import { MOCK_MODE } from '@/lib/env';
import { markMissionPaid } from '@/lib/missions';
import { fail, handleError, ok, readJson } from '@/lib/missions/http';

export const dynamic = 'force-dynamic';

const Body = z.object({
  missionCode: z.string().min(4).max(6),
});

export async function POST(req: Request) {
  if (!MOCK_MODE) {
    return fail(
      404,
      'NOT_AVAILABLE',
      'Mock checkout is disabled. Payment settles via POST /api/webhooks/stripe.',
    );
  }

  const parsed = await readJson(req, Body);
  if (parsed.response) return parsed.response;

  try {
    const mission = await markMissionPaid(parsed.data.missionCode, {
      stripeSessionId: `cs_mock_${parsed.data.missionCode.toUpperCase()}`,
    });
    return ok({ ok: true, missionCode: mission.code });
  } catch (err) {
    return handleError('checkout/complete', err);
  }
}
