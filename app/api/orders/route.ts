/**
 * POST /api/orders
 *   { address, formatId, frame, email, areaKm?, dedication? }
 *   → { missionCode, checkoutUrl }
 *
 * The purchase flow's single write. Creates an unpaid mission, opens a Stripe
 * Checkout Session against it, and returns where to send the customer.
 *
 * In mock mode `checkoutUrl` is `/checkout/mock/{missionCode}` — Agent 4's
 * local hosted checkout, which finishes with POST /api/checkout/complete.
 */
import { z } from 'zod';
import { TIER_IDS } from '@/lib/mission-flow/config';
import {
  DEDICATION_MAX_LENGTH,
  attachCheckoutSession,
  createMission,
} from '@/lib/missions';
import { createCheckoutSession } from '@/lib/integrations/stripe';
import { getFormat, currencyForRegion, regionForCountry } from '@/lib/pricing';
import { fail, handleError, ok, readJson } from '@/lib/missions/http';
import type { Currency } from '@/lib/types';

export const dynamic = 'force-dynamic';

const Address = z.object({
  line1: z.string().min(1, 'A street address is required.').max(160),
  line2: z.string().max(160).optional(),
  city: z.string().min(1, 'A city is required.').max(120),
  region: z.string().max(120).optional(),
  postalCode: z.string().min(1, 'A postal code is required.').max(32),
  countryCode: z.string().length(2, 'countryCode must be a 2-letter ISO code.'),
  country: z.string().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const Body = z.object({
  address: Address,
  formatId: z.enum(['F30', 'F50', 'F70']),
  frame: z.enum(['FRAMED', 'UNFRAMED']),
  /* The tier is validated against the catalogue of tiers, never trusted as a
     free string, and the AMOUNT is deliberately not part of this schema:
     createMission recomputes it. See CreateMissionInput.tier. */
  tier: z.enum(TIER_IDS).optional(),
  email: z.string().email('A valid email address is required.').max(200),
  /** Capture footprint in km per side. */
  areaKm: z.number().min(0.4).max(5).optional(),
  /**
   * "What is this place?" — the line printed on the mission sheet.
   *
   * Optional, because the question can be skipped; trimmed before the length
   * check so trailing whitespace cannot spend the budget; capped at the
   * measure the plate can actually set. The value is sanitised again inside
   * `createMission` — this schema decides whether the REQUEST is acceptable,
   * `sanitizeDedication` decides what is safe to store and to render.
   */
  dedication: z
    .string()
    .trim()
    .max(
      DEDICATION_MAX_LENGTH,
      `A dedication is at most ${DEDICATION_MAX_LENGTH} characters.`,
    )
    .optional(),
});

export async function POST(req: Request) {
  const parsed = await readJson(req, Body);
  if (parsed.response) return parsed.response;

  const { address, tier, formatId, frame, email, areaKm, dedication } = parsed.data;

  try {
    const mission = await createMission({
      email,
      address,
      tier,
      formatId,
      frame,
      areaKm,
      dedication,
    });

    const region = regionForCountry(address.countryCode);
    const currency: Currency = currencyForRegion(region);
    const format = getFormat(formatId);

    const session = await createCheckoutSession({
      missionCode: mission.code,
      amountMinor: mission.private?.amountMinor ?? 0,
      currency,
      email,
      description: `MISSION / ${mission.code} — ${format.metric} / ${frame}`,
    });

    await attachCheckoutSession(mission.code, session.id);

    return ok({ missionCode: mission.code, checkoutUrl: session.url }, { status: 201 });
  } catch (err) {
    return handleError('orders', err);
  }
}

export function GET() {
  return fail(405, 'METHOD_NOT_ALLOWED', 'Use POST to open a mission.');
}
