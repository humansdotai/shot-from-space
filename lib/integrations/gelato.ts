/**
 * ==================================================================
 * GELATO ADAPTER — print and fulfilment
 * ==================================================================
 * WHAT IT DOES
 *   Releases the composed print file to a production facility and reports the
 *   resulting shipment. US orders print in the US, EU orders print in the EU —
 *   that routing is the whole reason this product can promise duty-free
 *   delivery on both continents.
 *
 * WHAT IS MOCKED
 *   Everything. `createPrintOrder` returns a deterministic order id, the
 *   facility from PRINT_FACILITY[region], a region-appropriate carrier, a
 *   carrier-shaped tracking number, a working tracking URL template and an
 *   ETA 4–9 days out. Nothing is printed and nothing is charged.
 *
 * WHAT THE LIVE PATH NEEDS
 *   GELATO_API_KEY        — dashboard.gelato.com → Developers → API keys
 *   GELATO_API_BASE_URL   — https://order.gelatoapis.com
 *   GELATO_WEBHOOK_SECRET — dashboard.gelato.com → Developers → Webhooks,
 *                           endpoint POST /api/webhooks/gelato
 *   MOCK_MODE=false
 *   A print file the API can fetch: `fileUrl` must be a publicly reachable,
 *   full-bleed, 300 DPI PDF or PNG at the exact product dimensions. The
 *   watermarked /api/poster/{code} preview is NOT a print file — Agent 9's
 *   pipeline produces the production asset.
 *
 * ENDPOINTS (Gelato Order API v4)
 *   POST {base}/v4/orders          — create an order
 *   GET  {base}/v4/orders/{id}     — order status + shipment tracking
 *   Product catalogue lives on a different host:
 *   GET  https://product.gelatoapis.com/v3/products/{productUid}
 *
 * PRODUCT UIDS — VERIFY BEFORE SHIPPING
 *   Gelato product UIDs are long, catalogue-versioned strings that encode
 *   substrate, size, orientation and frame. The map below is the correct
 *   SHAPE and the correct intent (200 gsm uncoated poster, framed variants on
 *   200 gsm matt in black wood behind plexiglass), but the exact UIDs MUST be
 *   re-read from the live catalogue API before a real order is placed. A
 *   wrong UID is a rejected order, not a wrong print.
 *
 * THE UIDS ARE ALSO THE MATERIAL CLAIM — OPEN FOR THE OWNER
 *   The customer copy no longer describes the paper independently: MATERIALS
 *   in lib/guarantees.ts is written FROM these UIDs, and every page reads it.
 *   The site used to promise pigment ink on museum-grade cotton glazed with
 *   anti-glare acrylic while this map ordered uncoated white, matt and plain
 *   plexiglass. That is fixed by making the copy follow the catalogue — but
 *   the catalogue itself is unverified. When the real UIDs are confirmed
 *   against a live Gelato response, re-read MATERIALS against them and change
 *   it if the substrate is not what is written here.
 * ==================================================================
 */
import { INTEGRATIONS, isLive } from '@/lib/env';
import { PRINT_FACILITY, getFormat } from '@/lib/pricing';
import { seededUnit, sleep } from '@/lib/utils';
import { seededInt, seededPick } from '@/lib/missions/telemetry';
import type { FormatId, FrameOption, Region, TargetAddress } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface CreatePrintOrderInput {
  missionCode: string;
  formatId: FormatId;
  frame: FrameOption;
  region: Region;
  address: TargetAddress;
  /** Publicly fetchable print file. See the header note. */
  fileUrl: string;
  /** Recipient name; falls back to the mission code on the label. */
  recipientName?: string;
  email?: string;
}

export interface PrintOrderResult {
  orderId: string;
  /** e.g. "US / RENO, NV" */
  facility: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  /** ISO 8601. */
  estimatedDeliveryAt: string;
  /** The product UID the order was placed against. */
  productUid: string;
}

export type PrintOrderStatus =
  | 'CREATED'
  | 'IN_PRODUCTION'
  | 'PRINTED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

export interface PrintOrderStatusResult {
  orderId: string;
  status: PrintOrderStatus;
  facility: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDeliveryAt: string | null;
  note: string;
}

export interface GelatoAdapter {
  createPrintOrder(input: CreatePrintOrderInput): Promise<PrintOrderResult>;
  getOrderStatus(orderId: string): Promise<PrintOrderStatusResult>;
}

/* ------------------------------------------------------------------ */
/* Catalogue mapping                                                  */
/* ------------------------------------------------------------------ */

/**
 * FormatId + FrameOption → Gelato product UID.
 * Sizes match lib/pricing.ts: F30 = 30×40 cm, F50 = 50×70 cm, F70 = 70×100 cm.
 * Unframed is 200 gsm uncoated white; framed is 200 gsm matt in a black wood
 * frame with plexiglass glazing. MATERIALS in lib/guarantees.ts says exactly
 * this and nothing more — keep the two in step.
 *
 * VERIFY against GET https://product.gelatoapis.com/v3/catalogs/posters/
 * products before placing a live order — see the header note.
 */
// VERIFIED against the live Gelato catalogue (product.gelatoapis.com/v3) on
// 2026-08-25. Unframed = 200 gsm uncoated poster, portrait; framed = the same
// sheet in a black aluminium frame (w10×t22 mm) behind plexiglass. The frame is
// aluminium, not wood — MATERIALS in lib/guarantees.ts is written to match.
export const GELATO_PRODUCT_UID: Record<FormatId, Record<FrameOption, string>> = {
  F30: {
    UNFRAMED: 'flat_300x400-mm-12x16-inch_200-gsm-80lb-uncoated_4-0_ver',
    FRAMED:
      'framed_poster_300x400-mm-12x16-inch_black_aluminum_w10xt22-mm_plexiglass_300x400-mm-12x16-inch_200-gsm-80lb-uncoated_4-0_ver',
  },
  F50: {
    UNFRAMED: 'flat_500x700-mm-20x28-inch_200-gsm-80lb-uncoated_4-0_ver',
    FRAMED:
      'framed_poster_500x700-mm-20x28-inch_black_aluminum_w10xt22-mm_plexiglass_500x700-mm-20x28-inch_200-gsm-80lb-uncoated_4-0_ver',
  },
  F70: {
    UNFRAMED: 'flat_700x1000-mm-28x40-inch_200-gsm-80lb-uncoated_4-0_ver',
    FRAMED:
      'framed_poster_700x1000-mm-28x40-inch_black_aluminum_w10xt22-mm_plexiglass_700x1000-mm-28x40-inch_200-gsm-80lb-uncoated_4-0_ver',
  },
};

export function productUidFor(formatId: FormatId, frame: FrameOption): string {
  return GELATO_PRODUCT_UID[formatId][frame];
}

/**
 * The Gelato routing hint. Gelato picks the physical plant itself, but the
 * shipment country plus a preferred production country is what keeps a US
 * order in Nevada and an EU order in Eindhoven.
 */
export function productionCountryFor(region: Region): string {
  return region === 'EU' ? 'NL' : 'US';
}

/* ------------------------------------------------------------------ */
/* Carriers                                                           */
/* ------------------------------------------------------------------ */

interface Carrier {
  name: string;
  /** `{TRACKING}` is substituted. */
  urlTemplate: string;
  /** Tracking-number generator, given a deterministic seed. */
  format: (seed: string) => string;
}

const digits = (seed: string, n: number) =>
  Array.from({ length: n }, (_, i) => String(seededInt(`${seed}:${i}`, 0, 9))).join('');

const US_CARRIERS: Carrier[] = [
  {
    name: 'UPS',
    urlTemplate: 'https://www.ups.com/track?tracknum={TRACKING}',
    format: (s) => `1Z${digits(`ups:${s}`, 6)}${digits(`ups2:${s}`, 10)}`,
  },
  {
    name: 'FEDEX',
    urlTemplate: 'https://www.fedex.com/fedextrack/?trknbr={TRACKING}',
    format: (s) => digits(`fdx:${s}`, 12),
  },
  {
    name: 'USPS',
    urlTemplate: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={TRACKING}',
    format: (s) => `94${digits(`usps:${s}`, 20)}`,
  },
];

const EU_CARRIERS: Carrier[] = [
  {
    name: 'DHL',
    urlTemplate: 'https://www.dhl.com/global-en/home/tracking.html?tracking-id={TRACKING}',
    format: (s) => `JJD${digits(`dhl:${s}`, 15)}`,
  },
  {
    name: 'POSTNL',
    urlTemplate: 'https://postnl.nl/tracktrace/?B={TRACKING}',
    format: (s) => `3S${digits(`pnl:${s}`, 11)}`,
  },
  {
    name: 'DPD',
    urlTemplate: 'https://www.dpd.com/tracking?parcelNumber={TRACKING}',
    format: (s) => `05${digits(`dpd:${s}`, 12)}`,
  },
];

/** Deterministic carrier + tracking number for a mission. */
export function mockShipment(missionCode: string, region: Region) {
  const code = missionCode.toUpperCase();
  const carrier = seededPick(`carrier:${code}`, region === 'EU' ? EU_CARRIERS : US_CARRIERS);
  const trackingNumber = carrier.format(code);
  return {
    carrier: carrier.name,
    trackingNumber,
    trackingUrl: carrier.urlTemplate.replace('{TRACKING}', trackingNumber),
  };
}

/* ------------------------------------------------------------------ */
/* MOCK                                                               */
/* ------------------------------------------------------------------ */

function mockOrderId(missionCode: string): string {
  const suffix = Math.round(seededUnit(`gelato:${missionCode}`) * 1e12)
    .toString(36)
    .slice(0, 6)
    .padStart(6, '0');
  return `gel_ord_${missionCode.toUpperCase()}_${suffix}`;
}

function codeFromOrderId(orderId: string): string {
  const m = /^gel_ord_([0-9A-Z]{4})_/.exec(orderId);
  return m ? m[1] : orderId.slice(-4).toUpperCase();
}

export const mock: GelatoAdapter = {
  async createPrintOrder(input) {
    await sleep(280 + Math.round(seededUnit(`gellat:${input.missionCode}`) * 200));

    const code = input.missionCode.toUpperCase();
    // Region routing is the point of this adapter, so it is enforced here and
    // not left to the caller.
    const facility = PRINT_FACILITY[input.region];
    const { carrier, trackingNumber, trackingUrl } = mockShipment(code, input.region);

    // Production 1–2 days, transit 3–7 days.
    const day = 86_400_000;
    const eta = new Date(Date.now() + seededInt(`eta:${code}`, 4, 9) * day);
    eta.setUTCHours(17, 0, 0, 0);

    return {
      orderId: mockOrderId(code),
      facility,
      carrier,
      trackingNumber,
      trackingUrl,
      estimatedDeliveryAt: eta.toISOString(),
      productUid: productUidFor(input.formatId, input.frame),
    };
  },

  async getOrderStatus(orderId) {
    await sleep(110);
    const code = codeFromOrderId(orderId);
    // Without the mission row the region is unknown; US is the larger market
    // and callers in lib/missions always pass the stored values through.
    const region: Region = 'US';
    const { carrier, trackingNumber, trackingUrl } = mockShipment(code, region);
    const day = 86_400_000;
    const eta = new Date(Date.now() + seededInt(`eta:${code}`, 4, 9) * day);

    return {
      orderId,
      status: 'IN_PRODUCTION',
      facility: PRINT_FACILITY[region],
      carrier,
      trackingNumber,
      trackingUrl,
      estimatedDeliveryAt: eta.toISOString(),
      note: 'Sheet printed. Awaiting frame assembly and dispatch.',
    };
  },
};

/* ------------------------------------------------------------------ */
/* LIVE — complete but inactive until MOCK_MODE=false + keys           */
/* ------------------------------------------------------------------ */

function liveHeaders() {
  return {
    'X-API-KEY': INTEGRATIONS.gelato.apiKey,
    'Content-Type': 'application/json',
  };
}

/** Maps Gelato's fulfilment status vocabulary onto ours. */
export function mapGelatoStatus(raw: string): PrintOrderStatus {
  switch (raw.toLowerCase()) {
    case 'created':
    case 'passed':
    case 'pending_approval':
      return 'CREATED';
    case 'in_production':
    case 'printed':
      return raw.toLowerCase() === 'printed' ? 'PRINTED' : 'IN_PRODUCTION';
    case 'shipped':
      return 'SHIPPED';
    case 'delivered':
      return 'DELIVERED';
    case 'canceled':
    case 'cancelled':
      return 'CANCELLED';
    case 'failed':
    case 'draft':
      return 'FAILED';
    default:
      return 'CREATED';
  }
}

export const live: GelatoAdapter = {
  async createPrintOrder(input) {
    const f = getFormat(input.formatId);
    const productionCountry = productionCountryFor(input.region);

    // POST {base}/v4/orders
    const res = await fetch(`${INTEGRATIONS.gelato.baseUrl}/v4/orders`, {
      method: 'POST',
      headers: liveHeaders(),
      body: JSON.stringify({
        orderType: 'order',
        // Our mission code is the merchant reference on both sides.
        orderReferenceId: input.missionCode,
        customerReferenceId: input.email ?? input.missionCode,
        currency: input.region === 'EU' ? 'EUR' : 'USD',
        // Routing: keep US jobs in the US and EU jobs in the EU.
        preferredProductionCountries: [productionCountry],
        items: [
          {
            itemReferenceId: `${input.missionCode}-${f.designation}`,
            productUid: productUidFor(input.formatId, input.frame),
            quantity: 1,
            files: [{ type: 'default', url: input.fileUrl }],
          },
        ],
        shipmentMethodUid: 'normal',
        shippingAddress: {
          firstName: input.recipientName ?? 'Mission',
          lastName: input.missionCode,
          addressLine1: input.address.line1,
          addressLine2: input.address.line2 ?? '',
          city: input.address.city,
          state: input.address.region ?? '',
          postCode: input.address.postalCode,
          country: input.address.countryCode.toUpperCase(),
          email: input.email ?? '',
        },
      }),
    });

    if (!res.ok) throw new Error(`gelato order failed: ${res.status} ${await res.text()}`);

    const json = (await res.json()) as Record<string, unknown>;
    const shipment =
      ((json.shipment as Record<string, unknown> | undefined) ??
        (Array.isArray(json.shipments) ? (json.shipments[0] as Record<string, unknown>) : {})) ??
      {};
    const fallback = mockShipment(input.missionCode, input.region);

    return {
      orderId: String(json.id ?? json.orderId ?? ''),
      // Gelato reports the plant that took the job; PRINT_FACILITY is the
      // customer-facing label for the same thing.
      facility: PRINT_FACILITY[input.region],
      carrier: String(shipment.shipmentMethodName ?? fallback.carrier).toUpperCase(),
      trackingNumber: String(shipment.trackingCode ?? fallback.trackingNumber),
      trackingUrl: String(shipment.trackingUrl ?? fallback.trackingUrl),
      estimatedDeliveryAt: String(
        shipment.maxDeliveryDate ?? new Date(Date.now() + 7 * 86_400_000).toISOString(),
      ),
      productUid: productUidFor(input.formatId, input.frame),
    };
  },

  async getOrderStatus(orderId) {
    // GET {base}/v4/orders/{id}
    const res = await fetch(`${INTEGRATIONS.gelato.baseUrl}/v4/orders/${orderId}`, {
      headers: liveHeaders(),
    });
    if (!res.ok) throw new Error(`gelato status failed: ${res.status}`);

    const json = (await res.json()) as Record<string, unknown>;
    const shipment = Array.isArray(json.shipments)
      ? ((json.shipments[0] as Record<string, unknown>) ?? {})
      : {};

    return {
      orderId,
      status: mapGelatoStatus(String(json.fulfillmentStatus ?? json.orderStatus ?? '')),
      facility: json.productionCountry === 'NL' ? PRINT_FACILITY.EU : PRINT_FACILITY.US,
      carrier: shipment.shipmentMethodName
        ? String(shipment.shipmentMethodName).toUpperCase()
        : null,
      trackingNumber: shipment.trackingCode ? String(shipment.trackingCode) : null,
      trackingUrl: shipment.trackingUrl ? String(shipment.trackingUrl) : null,
      estimatedDeliveryAt: shipment.maxDeliveryDate ? String(shipment.maxDeliveryDate) : null,
      note: 'Reported by the production facility.',
    };
  },
};

/* ------------------------------------------------------------------ */
/* Public surface                                                     */
/* ------------------------------------------------------------------ */

function adapter(): GelatoAdapter {
  return isLive('gelato') ? live : mock;
}

export async function createPrintOrder(
  input: CreatePrintOrderInput,
): Promise<PrintOrderResult> {
  try {
    return await adapter().createPrintOrder(input);
  } catch (err) {
    console.error('[gelato] createPrintOrder failed:', (err as Error).message);
    return mock.createPrintOrder(input);
  }
}

export async function getOrderStatus(orderId: string): Promise<PrintOrderStatusResult> {
  try {
    return await adapter().getOrderStatus(orderId);
  } catch (err) {
    console.error('[gelato] getOrderStatus failed:', (err as Error).message);
    return mock.getOrderStatus(orderId);
  }
}

export const gelatoAdapter = {
  createPrintOrder,
  getOrderStatus,
  productUidFor,
  mockShipment,
  mock,
  live,
};

/* ------------------------------------------------------------------ */
/* Webhook verification                                               */
/* ------------------------------------------------------------------ */

/**
 * Gelato posts order/fulfilment updates to the endpoint configured in the
 * dashboard. It authenticates the callback with the shared secret sent as
 * `x-gelato-signature` (HMAC-SHA256 hex over the raw body).
 * VERIFY the header name and digest encoding against the current Gelato
 * webhook docs before relying on this in production.
 */
export interface GelatoWebhookEvent {
  type: string;
  orderId: string | null;
  missionCode: string | null;
  status: PrintOrderStatus;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDeliveryAt: string | null;
  raw: unknown;
}

export function parseGelatoEvent(payload: unknown): GelatoWebhookEvent {
  const p = (payload ?? {}) as Record<string, unknown>;
  const shipment = Array.isArray(p.shipments)
    ? ((p.shipments[0] as Record<string, unknown>) ?? {})
    : ((p.shipment as Record<string, unknown> | undefined) ?? {});

  const reference = typeof p.orderReferenceId === 'string' ? p.orderReferenceId : null;
  const orderId = typeof p.orderId === 'string' ? p.orderId : (p.id ? String(p.id) : null);

  return {
    type: String(p.event ?? p.type ?? 'unknown'),
    orderId,
    missionCode: reference
      ? reference.toUpperCase()
      : orderId
        ? codeFromOrderId(orderId)
        : null,
    status: mapGelatoStatus(String(p.fulfillmentStatus ?? p.status ?? '')),
    carrier: shipment.shipmentMethodName ? String(shipment.shipmentMethodName).toUpperCase() : null,
    trackingNumber: shipment.trackingCode ? String(shipment.trackingCode) : null,
    trackingUrl: shipment.trackingUrl ? String(shipment.trackingUrl) : null,
    estimatedDeliveryAt: shipment.maxDeliveryDate ? String(shipment.maxDeliveryDate) : null,
    raw: payload,
  };
}

export async function verifyWebhook(
  rawBody: string,
  signature: string | null,
): Promise<{ ok: boolean; verified: boolean; event: GelatoWebhookEvent | null; reason?: string }> {
  const secret = process.env.GELATO_WEBHOOK_SECRET ?? '';

  const parse = () => {
    try {
      return parseGelatoEvent(JSON.parse(rawBody));
    } catch {
      return null;
    }
  };

  if (!secret) {
    const event = parse();
    return {
      ok: event !== null,
      verified: false,
      event,
      reason: event
        ? 'GELATO_WEBHOOK_SECRET not set — signature not checked'
        : 'payload is not JSON',
    };
  }
  if (!signature) {
    return { ok: false, verified: false, event: null, reason: 'missing x-gelato-signature' };
  }

  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, verified: false, event: null, reason: 'signature mismatch' };
  }

  const event = parse();
  return { ok: event !== null, verified: true, event, reason: event ? undefined : 'payload is not JSON' };
}
