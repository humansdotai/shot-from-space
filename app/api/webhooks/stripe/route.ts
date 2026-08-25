/**
 * POST /api/webhooks/stripe
 *
 * Settles a mission when the customer's payment clears.
 *
 * MOCK MODE
 *   Nothing calls this. Payment is settled by POST /api/checkout/complete from
 *   the local mock checkout screen. The route still works end to end if you
 *   post a Stripe-shaped payload at it, which is how it was tested.
 *
 * LIVE
 *   dashboard.stripe.com → Developers → Webhooks → add endpoint
 *     URL:    {SITE_URL}/api/webhooks/stripe
 *     Events: checkout.session.completed  (plus checkout.session.expired and
 *             charge.refunded once refunds are handled)
 *   Copy the signing secret into STRIPE_WEBHOOK_SECRET.
 *
 * The handler is deliberately forgiving: it verifies the signature, does the
 * one thing it can do, and returns 200. A webhook endpoint that 500s gets
 * retried and eventually disabled — the only failure worth a non-2xx is a
 * signature that does not check out.
 */
import { verifyWebhook } from '@/lib/integrations/stripe';
import { eyepupConversion } from '@/lib/integrations/eyepup';
import { markMissionPaid } from '@/lib/missions';
import { fail, ok } from '@/lib/missions/http';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // The raw body is required: the signature covers the exact bytes sent.
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  const result = await verifyWebhook(rawBody, signature);

  if (!result.ok) {
    console.warn('[webhook:stripe] rejected:', result.reason);
    return fail(400, 'INVALID_SIGNATURE', result.reason ?? 'Signature verification failed.');
  }
  if (!result.verified) {
    console.warn('[webhook:stripe] accepted UNVERIFIED payload —', result.reason);
  }

  const event = result.event;
  if (!event) return ok({ received: true, handled: false });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        if (!event.missionCode) {
          console.warn('[webhook:stripe] no metadata.missionCode on session', event.sessionId);
          break;
        }
        await markMissionPaid(event.missionCode, {
          stripeSessionId: event.sessionId,
          stripePaymentIntentId: event.paymentIntentId,
          amountMinor: event.amountMinor,
          currency: event.currency === 'EUR' ? 'EUR' : 'USD',
        });
        console.log(`[webhook:stripe] mission ${event.missionCode} settled`);

        // Analytics: record the purchase conversion (revenue + currency).
        // Attributed by the buyer's email; fire-and-forget, never blocks 200.
        void eyepupConversion({
          distinctId: event.email ?? event.missionCode,
          name: 'mission_purchased',
          amount: typeof event.amountMinor === 'number' ? event.amountMinor / 100 : undefined,
          currency: event.currency ?? undefined,
          properties: {
            missionCode: event.missionCode,
            stripeSessionId: event.sessionId,
            email: event.email ?? undefined,
          },
        });

        return ok({ received: true, handled: true, missionCode: event.missionCode });
      }

      // Documented, not yet acted on. A real payload for either of these
      // drives a mission to CANCELLED via cancelMission(code).
      case 'checkout.session.expired':
      case 'charge.refunded':
        console.log(`[webhook:stripe] ${event.type} for ${event.missionCode ?? 'unknown'} — noted, no transition`);
        break;

      default:
        console.log(`[webhook:stripe] ignoring ${event.type}`);
    }
  } catch (err) {
    // Log and still return 200: Stripe must not retry a mission that already
    // moved, and a mission that failed to move is recoverable from the ledger.
    console.error('[webhook:stripe] handler failed:', (err as Error).message);
  }

  return ok({ received: true, handled: false });
}
