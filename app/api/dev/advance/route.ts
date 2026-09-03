/**
 * POST /api/dev/advance  { code, to? }  → { code, state, stage, stageLabel }
 *
 * THE DEMO CONTROL. This is how the product is walked through its lifecycle in
 * a review: with no `to` it takes one step; with a `to` it walks every stage in
 * between, firing every side effect (tasking, capture, print, shipment, email)
 * so the timeline is complete and honest.
 *
 * Available ONLY while MOCK_MODE is true. In live mode a mission moves because
 * a provider webhook said so, and this route is a 404.
 *
 * IT RETURNS A RECEIPT, NOT A MISSION.
 *
 * This route has no ownership check — it cannot have one, because its whole
 * purpose is to step any mission from a demo without signing in. It used to
 * answer with the OWNER projection (`includePrivate: true`), which handed the
 * street address, the customer email, the amount paid and the receipt number
 * to any unauthenticated caller who knew a four-character code. Every other
 * unauthenticated surface in the product goes through `toMissionDTO` without
 * that flag; this one bypassed it.
 *
 * So it answers with the four fields the control actually consumes — where
 * the mission now is — and nothing else. `AdvanceControl` reads `res.ok` and
 * calls `router.refresh()`; the refreshed page is server-rendered by
 * /m/[code], which does its own ownership check and is the only surface
 * entitled to release private fields.
 */
import { z } from 'zod';
import { MOCK_MODE } from '@/lib/env';
import { advanceMission, cancelMission } from '@/lib/missions';
import { MISSION_STAGES, STAGE_LABEL } from '@/lib/types';
import type { MissionDTO } from '@/lib/types';
import { fail, handleError, ok, readJson } from '@/lib/missions/http';

/**
 * Everything the demo control needs to render its "current / next" pair, and
 * nothing a public caller is not already entitled to: the code it just sent,
 * and where the mission now sits on the timeline.
 */
interface AdvanceReceipt {
  code: string;
  state: MissionDTO['state'];
  stage: MissionDTO['stage'];
  stageLabel: string;
}

function receipt(mission: MissionDTO): AdvanceReceipt {
  return {
    code: mission.code,
    state: mission.state,
    stage: mission.stage,
    stageLabel: STAGE_LABEL[mission.stage],
  };
}

export const dynamic = 'force-dynamic';

const Body = z.object({
  code: z.string().min(4).max(6),
  to: z.enum([...MISSION_STAGES, 'CANCELLED'] as [string, ...string[]]).optional(),
});

export async function POST(req: Request) {
  if (!MOCK_MODE) {
    return fail(404, 'NOT_AVAILABLE', 'Demo controls are disabled outside mock mode.');
  }

  const parsed = await readJson(req, Body);
  if (parsed.response) return parsed.response;

  const { code, to } = parsed.data;

  try {
    const mission =
      to === 'CANCELLED'
        ? // No window enforcement: the demo control exists to walk a mission
          // into every state, cancellation from mid-flight included.
          await cancelMission(code)
        : await advanceMission(code, to as Parameters<typeof advanceMission>[1], { approvePrint: true });
    return ok(receipt(mission));
  } catch (err) {
    return handleError('dev/advance', err);
  }
}

export function GET() {
  return fail(
    405,
    'METHOD_NOT_ALLOWED',
    'Use POST with { code, to? } to advance a mission.',
  );
}
