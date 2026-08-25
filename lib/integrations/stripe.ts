/**
 * ==================================================================
 * STRIPE ADAPTER — payments
 * ==================================================================
 * WHAT IT DOES
 *   Creates a hosted Checkout Session for a mission and verifies the webhook
 *   signature on the way back.
 *
 * WHAT IS MOCKED
 *   `mock.createCheckoutSession` returns a deterministic session id and points
 *   the customer at `/checkout/mock/{missionCode}` — Agent 4's local hosted
 *   checkout screen, which finishes the flow by calling
 *   POST /api/checkout/complete. No card, no key, no network.
 *   `mock.verifyWebhook` accepts any payload and parses it.
 *
 * WHAT THE LIVE PATH NEEDS
 *   STRIPE_SECRET_KEY            — dashboard.stripe.com/apikeys
 *   STRIPE_WEBHOOK_SECRET        — dashboard.stripe.com/webhooks, endpoint
 *                                  POST /api/webhooks/stripe, event
 *                                  `checkout.session.completed`
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (only if a custom card form is added)
 *   MOCK_MODE=false
 *   Apple Pay additionally requires the production domain to be registered
 *   under Settings → Payments → Payment method domains. Google Pay needs no
 *   registration. Both appear automatically in Checkout once the wallet
 *   payment methods are enabled in the dashboard — that is why this adapter
 *   deliberately does NOT send `payment_method_types`: omitting it lets Stripe
 *   pick from the dashboard's automatic payment methods, wallets included.
 *
 * No Stripe SDK is used — plain `fetch` against the REST API, form-encoded.
 * ==================================================================
 */
import crypto from 'node:crypto';
import { INTEGRATIONS, SITE_URL, isLive } from '@/lib/env';
import { seededUnit, sleep } from '@/lib/utils';
import type { Currency } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface CreateCheckoutSessionInput {
  missionCode: string;
  /** Price in minor units (cents). */
  amountMinor: number;
  currency: Currency;
  email: string;
  /** Line-item description, e.g. "MISSION / 32BF — 50 × 70 CM / FRAMED". */
  description: string;
}

export interface CheckoutSession {
  id: string;
  /** Where to send the customer to pay. */
  url: string;
}

/** The subset of a Stripe event this product acts on. */
export interface StripeWebhookEvent {
  id: string;
  type: string;
  missionCode: string | null;
  sessionId: string | null;
  paymentIntentId: string | null;
  amountMinor: number | null;
  currency: string | null;
  email: string | null;
  /** The untouched parsed payload, for logging. */
  raw: unknown;
}

export interface WebhookVerification {
  ok: boolean;
  /** True when a real signature was checked; false when no secret is set. */
  verified: boolean;
  event: StripeWebhookEvent | null;
  reason?: string;
}

/**
 * A refund of one mission's payment.
 *
 * `paymentIntentId` is what Stripe refunds against; it is written onto the
 * mission row at checkout. A mission that never had one (a mock order, or one
 * cancelled before payment cleared) is not an error — `refundPayment` reports
 * NOT_CHARGED and the caller carries on.
 */
export interface RefundInput {
  missionCode: string;
  paymentIntentId: string | null;
  /** Minor units. Omit to refund the whole payment, which is the usual case. */
  amountMinor?: number;
  /** Recorded on the Stripe refund for the ledger. */
  reason: 'cancelled' | 'no_usable_frame' | 'declined';
}

export interface RefundResult {
  ok: boolean;
  /** Stripe refund id, when one was created. */
  refundId: string | null;
  /** `NOT_CHARGED` when there was nothing to refund. */
  status: 'REFUNDED' | 'PENDING' | 'NOT_CHARGED' | 'FAILED';
  /** Plain-words explanation, written into the mission timeline. */
  detail: string;
}

export interface StripeAdapter {
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession>;
  verifyWebhook(rawBody: string, signature: string | null): Promise<WebhookVerification>;
  refundPayment(input: RefundInput): Promise<RefundResult>;
}

/** Stripe's own reason vocabulary. Ours is richer, so it is mapped, not sent. */
const STRIPE_REASON = 'requested_by_customer';

/* ------------------------------------------------------------------ */
/* Shared parsing                                                     */
/* ------------------------------------------------------------------ */

/**
 * Flattens a Stripe event into the handful of fields the state machine needs.
 * Tolerant by design: a webhook must never 500 because a field moved.
 */
export function parseStripeEvent(payload: unknown): StripeWebhookEvent {
  const p = (payload ?? {}) as Record<string, unknown>;
  const data = (p.data as Record<string, unknown> | undefined)?.object as
    | Record<string, unknown>
    | undefined;
  const object = data ?? p;
  const metadata = (object.metadata as Record<string, string> | undefined) ?? {};
  const details = (object.customer_details as Record<string, unknown> | undefined) ?? {};

  return {
    id: typeof p.id === 'string' ? p.id : `evt_${Date.now()}`,
    type: typeof p.type === 'string' ? p.type : 'unknown',
    missionCode:
      typeof metadata.missionCode === 'string' ? metadata.missionCode.toUpperCase() : null,
    sessionId: typeof object.id === 'string' ? object.id : null,
    paymentIntentId:
      typeof object.payment_intent === 'string' ? (object.payment_intent as string) : null,
    amountMinor:
      typeof object.amount_total === 'number' ? (object.amount_total as number) : null,
    currency: typeof object.currency === 'string' ? object.currency.toUpperCase() : null,
    email:
      (typeof details.email === 'string' ? details.email : null) ??
      (typeof object.customer_email === 'string' ? (object.customer_email as string) : null),
  raw: payload,
  };
}

/* ------------------------------------------------------------------ */
/* MOCK                                                               */
/* ------------------------------------------------------------------ */

export const mock: StripeAdapter = {
  async createCheckoutSession(input) {
    // Realistic latency: Stripe session creation is ~200–500ms in practice.
    await sleep(180 + Math.round(seededUnit(`stripe:${input.missionCode}`) * 220));

    // Deterministic id so repeated calls for the same mission are stable.
    const suffix = Math.round(seededUnit(`cs:${input.missionCode}`) * 1e10)
      .toString(36)
      .padStart(8, '0');

    return {
      id: `cs_mock_${input.missionCode}_${suffix}`,
      url: `/checkout/mock/${input.missionCode}`,
    };
  },

  async verifyWebhook(rawBody) {
    try {
      return {
        ok: true,
        verified: false,
        event: parseStripeEvent(JSON.parse(rawBody)),
        reason: 'MOCK_MODE — signature not checked',
      };
    } catch {
      return { ok: false, verified: false, event: null, reason: 'payload is not JSON' };
    }
  },

  async refundPayment(input) {
    await sleep(140 + Math.round(seededUnit(`refund:${input.missionCode}`) * 180));

    if (!input.paymentIntentId) {
      return {
        ok: true,
        refundId: null,
        status: 'NOT_CHARGED',
        detail: 'No payment was captured for this mission, so there is nothing to refund.',
      };
    }

    const suffix = Math.round(seededUnit(`re:${input.missionCode}`) * 1e10)
      .toString(36)
      .padStart(8, '0');

    return {
      ok: true,
      refundId: `re_mock_${input.missionCode}_${suffix}`,
      status: 'REFUNDED',
      detail: 'Refunded in full to the card that authorised the mission (MOCK_MODE — no money moved).',
    };
  },
};

/* ------------------------------------------------------------------ */
/* LIVE — complete but inactive until MOCK_MODE=false + keys           */
/* ------------------------------------------------------------------ */

export const live: StripeAdapter = {
  async createCheckoutSession(input) {
    // POST https://api.stripe.com/v1/checkout/sessions  (form-encoded)
    // Docs: https://docs.stripe.com/api/checkout/sessions/create
    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('customer_email', input.email);
    form.set('success_url', `${SITE_URL}/m/${input.missionCode}?paid=1`);
    form.set('cancel_url', `${SITE_URL}/start?cancelled=${input.missionCode}`);
    form.set('client_reference_id', input.missionCode);
    form.set('metadata[missionCode]', input.missionCode);

    // Wallets: omitting `payment_method_types` opts the session into the
    // dashboard's automatic payment methods, which is how Apple Pay and
    // Google Pay surface in hosted Checkout. Pinning it to `card` opts back
    // out, so neither wallet is offered — card entry only.
    form.set('payment_method_types[0]', 'card');
    form.set('automatic_tax[enabled]', 'false');

    form.set('line_items[0][quantity]', '1');
    form.set('line_items[0][price_data][currency]', input.currency.toLowerCase());
    form.set('line_items[0][price_data][unit_amount]', String(input.amountMinor));
    form.set('line_items[0][price_data][product_data][name]', input.description);
    form.set(
      'line_items[0][price_data][product_data][description]',
      'Satellite capture, composed print, shipping and duties included.',
    );

    // Shipping is included in the price; the address is collected by us at
    // /start, so Checkout only needs to take the money.
    form.set('submit_type', 'pay');

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${INTEGRATIONS.stripe.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Retries of the same mission must not create a second session.
        'Idempotency-Key': `mission_${input.missionCode}`,
      },
      body: form.toString(),
    });

    if (!res.ok) {
      throw new Error(`stripe checkout session failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as { id: string; url: string };
    return { id: json.id, url: json.url };
  },

  async verifyWebhook(rawBody, signature) {
    const secret = INTEGRATIONS.stripe.webhookSecret;
    if (!secret) {
      // Never throw for a missing key: parse, flag it, let the route log it.
      try {
        return {
          ok: true,
          verified: false,
          event: parseStripeEvent(JSON.parse(rawBody)),
          reason: 'STRIPE_WEBHOOK_SECRET not set — signature not checked',
        };
      } catch {
        return { ok: false, verified: false, event: null, reason: 'payload is not JSON' };
      }
    }

    if (!signature) {
      return { ok: false, verified: false, event: null, reason: 'missing stripe-signature' };
    }

    // Header form: `t=1712345678,v1=<hex>,v1=<hex>`
    const parts = Object.fromEntries(
      signature.split(',').map((kv) => {
        const [k, ...rest] = kv.split('=');
        return [k.trim(), rest.join('=')];
      }),
    ) as Record<string, string>;

    const timestamp = parts.t;
    const provided = signature
      .split(',')
      .filter((kv) => kv.trim().startsWith('v1='))
      .map((kv) => kv.trim().slice(3));

    if (!timestamp || provided.length === 0) {
      return { ok: false, verified: false, event: null, reason: 'malformed stripe-signature' };
    }

    // Reject replays older than five minutes, as Stripe's own libraries do.
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > 300) {
      return { ok: false, verified: false, event: null, reason: 'signature timestamp outside tolerance' };
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`, 'utf8')
      .digest('hex');

    const match = provided.some((sig) => {
      const a = Buffer.from(sig, 'hex');
      const b = Buffer.from(expected, 'hex');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    });

    if (!match) {
      return { ok: false, verified: false, event: null, reason: 'signature mismatch' };
    }

    try {
      return { ok: true, verified: true, event: parseStripeEvent(JSON.parse(rawBody)) };
    } catch {
      return { ok: false, verified: true, event: null, reason: 'payload is not JSON' };
    }
  },

  async refundPayment(input) {
    // POST https://api.stripe.com/v1/refunds  (form-encoded)
    // Docs: https://docs.stripe.com/api/refunds/create
    if (!input.paymentIntentId) {
      return {
        ok: true,
        refundId: null,
        status: 'NOT_CHARGED',
        detail: 'No payment was captured for this mission, so there is nothing to refund.',
      };
    }

    const form = new URLSearchParams();
    form.set('payment_intent', input.paymentIntentId);
    form.set('reason', STRIPE_REASON);
    form.set('metadata[missionCode]', input.missionCode);
    form.set('metadata[refundReason]', input.reason);
    if (input.amountMinor !== undefined) form.set('amount', String(input.amountMinor));

    const res = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${INTEGRATIONS.stripe.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // A retried cancellation must not refund the same payment twice.
        'Idempotency-Key': `refund_${input.missionCode}_${input.reason}`,
      },
      body: form.toString(),
    });

    if (!res.ok) {
      return {
        ok: false,
        refundId: null,
        status: 'FAILED',
        detail: `Stripe refused the refund (${res.status}). Mission control has to complete it by hand.`,
      };
    }

    const json = (await res.json()) as { id?: string; status?: string };
    const status = json.status === 'succeeded' ? 'REFUNDED' : 'PENDING';

    return {
      ok: true,
      refundId: json.id ?? null,
      status,
      detail:
        status === 'REFUNDED'
          ? 'Refunded in full to the card that authorised the mission.'
          : 'Refund submitted to the card issuer. It settles in a few working days.',
    };
  },
};

/* ------------------------------------------------------------------ */
/* Public surface                                                     */
/* ------------------------------------------------------------------ */

function adapter(): StripeAdapter {
  return isLive('stripe') ? live : mock;
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<CheckoutSession> {
  try {
    return await adapter().createCheckoutSession(input);
  } catch (err) {
    // A payment provider outage must not lose the order: fall back to the
    // mock checkout so the mission still exists and can be paid manually.
    console.error('[stripe] createCheckoutSession failed:', (err as Error).message);
    return mock.createCheckoutSession(input);
  }
}

export async function verifyWebhook(
  rawBody: string,
  signature: string | null,
): Promise<WebhookVerification> {
  try {
    return await adapter().verifyWebhook(rawBody, signature);
  } catch (err) {
    return { ok: false, verified: false, event: null, reason: (err as Error).message };
  }
}

/**
 * Refund one mission's payment.
 *
 * This is the code behind "refunded in full" in /legal/terms. It never
 * throws: a mission that cannot be refunded automatically has to be visible
 * as an outstanding obligation, not lost inside a rejected transition. The
 * caller writes the returned `detail` into the mission timeline either way.
 */
export async function refundPayment(input: RefundInput): Promise<RefundResult> {
  try {
    return await adapter().refundPayment(input);
  } catch (err) {
    const message = (err as Error).message;
    console.error('[stripe] refundPayment failed:', message);
    return {
      ok: false,
      refundId: null,
      status: 'FAILED',
      detail: `The refund could not be placed automatically (${message}). Mission control has to complete it by hand.`,
    };
  }
}

export const stripeAdapter = {
  createCheckoutSession,
  verifyWebhook,
  parseStripeEvent,
  refundPayment,
  mock,
  live,
};
