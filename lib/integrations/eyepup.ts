/**
 * ==================================================================
 * EYEPUP ADAPTER — product analytics (Layer 2, server-side)
 * ==================================================================
 * Eyepup is a PostHog-compatible analytics proxy. The browser snippet
 * (`https://eyepup.com/t/{token}.js`, mounted in app/layout.tsx) captures
 * client events; this module is the SERVER half — it identifies a user the
 * moment they sign in and records the purchase conversion from the Stripe
 * webhook, where the browser cannot.
 *
 * WHAT IS SENT, AND WHERE
 *   POST https://eyepup.com/i/identify    { distinct_id, user_id, email, properties }
 *   POST https://eyepup.com/i/conversion  { distinct_id, name, amount, currency, properties }
 *   POST https://eyepup.com/i/event       { distinct_id, event, properties }
 *   Authenticated with `Authorization: Bearer ${EYEPUP_PROJECT_TOKEN}` — the
 *   PUBLIC project token (the same value the snippet URL carries; it is not a
 *   secret). No Stripe/DB/webhook secret is ever sent here.
 *
 * INVARIANT (from the integration recipe)
 *   Analytics MUST NEVER break the user's flow: every network call is fully
 *   swallowed. A missing token, a down proxy or a bad response is a no-op, not
 *   an error the caller has to catch.
 * ==================================================================
 */

const BASE = 'https://eyepup.com';

function token(): string {
  return process.env.EYEPUP_PROJECT_TOKEN ?? '';
}

/**
 * The anonymous id the browser snippet assigned this visitor, read from its
 * cookie so a server event joins the same person as their client events.
 * PostHog stores `ph_<token>_posthog` as URL-encoded JSON carrying
 * `distinct_id`; the eyepup proxy may also set a plainer `eyepup*` cookie.
 * Returns `fallback` (a stable user id or email) when no cookie is present.
 */
export function eyepupDistinctId(
  cookieHeader: string | null | undefined,
  fallback: string,
): string {
  if (cookieHeader) {
    for (const part of cookieHeader.split(/;\s*/)) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const name = part.slice(0, eq);
      if (!/(^ph_.*_posthog$)|eyepup/i.test(name)) continue;
      const value = part.slice(eq + 1);
      try {
        const parsed = JSON.parse(decodeURIComponent(value));
        if (parsed && typeof parsed.distinct_id === 'string' && parsed.distinct_id) {
          return parsed.distinct_id;
        }
      } catch {
        // A plain (non-JSON) id cookie — take it as-is if it looks like one.
        const raw = decodeURIComponent(value);
        if (raw && !raw.includes('{')) return raw;
      }
    }
  }
  return fallback;
}

async function send(path: string, body: Record<string, unknown>): Promise<void> {
  const t = token();
  if (!t) return; // not configured — silent no-op
  try {
    await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${t}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      // Do not let a slow proxy hold a request/webhook open.
      signal: AbortSignal.timeout(4000),
    }).catch(() => {});
  } catch {
    // Analytics must never break the flow.
  }
}

/** Link a signed-in user to their anonymous browsing session. */
export async function eyepupIdentify(opts: {
  distinctId: string;
  userId?: string;
  email?: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  if (!opts.distinctId) return;
  await send('/i/identify', {
    distinct_id: opts.distinctId,
    user_id: opts.userId,
    email: opts.email,
    properties: opts.properties ?? {},
  });
}

/** Record a purchase conversion (revenue + currency). */
export async function eyepupConversion(opts: {
  distinctId: string;
  name: string;
  amount?: number; // major units, e.g. 279 (not cents)
  currency?: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  if (!opts.distinctId) return;
  await send('/i/conversion', {
    distinct_id: opts.distinctId,
    name: opts.name,
    amount: opts.amount,
    currency: opts.currency,
    properties: opts.properties ?? {},
  });
}

/** A custom server event. */
export async function eyepupEvent(opts: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  if (!opts.distinctId) return;
  await send('/i/event', {
    distinct_id: opts.distinctId,
    event: opts.event,
    properties: opts.properties ?? {},
  });
}
