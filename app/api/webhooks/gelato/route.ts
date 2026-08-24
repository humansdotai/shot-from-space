/**
 * POST /api/webhooks/gelato
 *
 * Moves a mission forward when the print facility reports production or
 * shipment progress.
 *
 * MOCK MODE
 *   Never called. The demo drives these transitions through
 *   POST /api/dev/advance.
 *
 * LIVE
 *   dashboard.gelato.com → Developers → Webhooks → {SITE_URL}/api/webhooks/gelato
 *   Set GELATO_WEBHOOK_SECRET to the shared secret.
 *
 * EVENT → STAGE
 *   CREATED / IN_PRODUCTION / PRINTED → PRINT
 *   SHIPPED                           → SHIPPED
 *   DELIVERED                         → DELIVERED
 *   CANCELLED / FAILED                → logged only; a failed print is
 *                                       reprinted, it does not cancel the
 *                                       mission.
 *
 * FINAL_APPROACH has no provider event — it is derived from carrier "out for
 * delivery" scans, which arrive from the carrier's own tracking feed rather
 * than from Gelato. Until that feed is wired, /api/dev/advance sets it.
 */
import { verifyWebhook } from '@/lib/integrations/gelato';
import { advanceMission, getMissionRowByCode } from '@/lib/missions';
import { stageIndex, type MissionStage } from '@/lib/types';
import { asState } from '@/lib/missions/dto';
import { fail, ok } from '@/lib/missions/http';

export const dynamic = 'force-dynamic';

function targetStageFor(status: string): MissionStage | null {
  switch (status) {
    case 'CREATED':
    case 'IN_PRODUCTION':
    case 'PRINTED':
      return 'PRINT';
    case 'SHIPPED':
      return 'SHIPPED';
    case 'DELIVERED':
      return 'DELIVERED';
    default:
      return null;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const result = await verifyWebhook(rawBody, req.headers.get('x-gelato-signature'));

  if (!result.ok && result.reason === 'signature mismatch') {
    console.warn('[webhook:gelato] rejected: signature mismatch');
    return fail(400, 'INVALID_SIGNATURE', 'Signature verification failed.');
  }
  if (!result.verified) {
    console.warn('[webhook:gelato] accepted UNVERIFIED payload —', result.reason);
  }

  const event = result.event;
  if (!event?.missionCode) {
    console.log('[webhook:gelato] no orderReferenceId on payload — nothing to do');
    return ok({ received: true, handled: false });
  }

  try {
    const target = targetStageFor(event.status);
    const row = await getMissionRowByCode(event.missionCode);

    if (!row) {
      console.warn(`[webhook:gelato] unknown mission ${event.missionCode}`);
      return ok({ received: true, handled: false });
    }
    if (!target) {
      console.log(
        `[webhook:gelato] ${event.missionCode}: status ${event.status} — logged, no transition`,
      );
      return ok({ received: true, handled: false });
    }

    const current = asState(row.state);
    if (current === 'CANCELLED' || stageIndex(current as MissionStage) >= stageIndex(target)) {
      console.log(`[webhook:gelato] ${event.missionCode} already at or past ${target}`);
      return ok({ received: true, handled: false });
    }

    await advanceMission(event.missionCode, target);
    console.log(`[webhook:gelato] ${event.missionCode} → ${target}`);
    return ok({ received: true, handled: true, missionCode: event.missionCode, stage: target });
  } catch (err) {
    console.error('[webhook:gelato] handler failed:', (err as Error).message);
    return ok({ received: true, handled: false });
  }
}
