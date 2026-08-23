/**
 * POST /api/webhooks/skyfi
 *
 * Moves a mission forward when the constellation operator reports progress on
 * a collection.
 *
 * MOCK MODE
 *   Never called. The demo drives these transitions through
 *   POST /api/dev/advance. This route exists so the live wiring is visible and
 *   testable, and so a developer can see exactly which provider event maps to
 *   which mission stage.
 *
 * LIVE
 *   Register {SITE_URL}/api/webhooks/skyfi with SkyFi and set
 *   SKYFI_WEBHOOK_SECRET.
 *
 * EVENT → STAGE
 *   status ACCEPTED / SCHEDULED  → SATELLITE_TASKED, then CAPTURE_WINDOW
 *   status CAPTURED / DELIVERED  → IMAGE_ACQUIRED
 *   status FAILED                → NOTE only; a failed collection is re-tasked,
 *                                  it does not cancel the mission.
 */
import { verifyWebhook } from '@/lib/integrations/skyfi';
import { advanceMission, getMissionRowByCode } from '@/lib/missions';
import { stageIndex, type MissionStage } from '@/lib/types';
import { asState } from '@/lib/missions/dto';
import { fail, ok } from '@/lib/missions/http';

export const dynamic = 'force-dynamic';

/** Which stage a reported collection status implies. */
function targetStageFor(status: string | null): MissionStage | null {
  switch (status) {
    case 'ACCEPTED':
      return 'SATELLITE_TASKED';
    case 'SCHEDULED':
      return 'CAPTURE_WINDOW';
    case 'CAPTURED':
    case 'PROCESSING':
    case 'DELIVERED':
      return 'IMAGE_ACQUIRED';
    default:
      return null;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const result = await verifyWebhook(rawBody, req.headers.get('x-skyfi-signature'));

  if (!result.ok && result.reason === 'signature mismatch') {
    console.warn('[webhook:skyfi] rejected: signature mismatch');
    return fail(400, 'INVALID_SIGNATURE', 'Signature verification failed.');
  }
  if (!result.verified) {
    console.warn('[webhook:skyfi] accepted UNVERIFIED payload —', result.reason);
  }

  const event = result.event;
  if (!event?.missionCode) {
    console.log('[webhook:skyfi] no mission reference on payload — nothing to do');
    return ok({ received: true, handled: false });
  }

  try {
    const target = targetStageFor(event.status);
    const row = await getMissionRowByCode(event.missionCode);

    if (!row) {
      console.warn(`[webhook:skyfi] unknown mission ${event.missionCode}`);
      return ok({ received: true, handled: false });
    }
    if (!target) {
      console.log(
        `[webhook:skyfi] ${event.missionCode}: status ${event.status ?? 'none'} — logged, no transition`,
      );
      return ok({ received: true, handled: false });
    }

    const current = asState(row.state);
    if (current === 'CANCELLED' || stageIndex(current as MissionStage) >= stageIndex(target)) {
      // Providers retry. Already-applied progress is a no-op, not an error.
      console.log(`[webhook:skyfi] ${event.missionCode} already at or past ${target}`);
      return ok({ received: true, handled: false });
    }

    await advanceMission(event.missionCode, target);
    console.log(`[webhook:skyfi] ${event.missionCode} → ${target}`);
    return ok({ received: true, handled: true, missionCode: event.missionCode, stage: target });
  } catch (err) {
    console.error('[webhook:skyfi] handler failed:', (err as Error).message);
    return ok({ received: true, handled: false });
  }
}
