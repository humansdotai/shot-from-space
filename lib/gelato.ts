// Gelato print-on-demand — turns a delivered satellite capture into a physical
// poster. The capture is square, so we offer square poster formats (no crop).
// Retail prices comfortably cover Gelato's print cost + shipping + margin
// (validated live: 16" print ≈ $8.22 + ground ship ≈ $5.90).

const BASE = "https://order.gelatoapis.com/v4";

// Markup applied when a poster is bundled with the satellite tasking (the
// "package"): covers combined handling/packaging.
export const PACKAGE_MARKUP = 0.1;

// Flat worldwide shipping charged to the customer. Set to always cover Gelato's
// own shipping fee, which (quoted live) runs ~$4.90 US ground to ~$10.75 for a
// large poster shipped internationally.
export const POSTER_SHIPPING = 12;

/** Total for a satellite capture optionally bundled with a poster.
 *  When a poster is included the combined subtotal carries a 10% package markup. */
export function packageTotal(satPrice: number, posterPrice: number | null): number {
  if (!posterPrice) return satPrice;
  return Math.round((satPrice + posterPrice) * (1 + PACKAGE_MARKUP));
}

export interface PosterSize {
  id: string;
  label: string; // imperial
  dim: string; // metric
  productUid: string;
  price: number; // retail USD
}

export const POSTER_SIZES: PosterSize[] = [
  {
    id: "12",
    label: '12 × 12"',
    dim: "30 × 30 cm",
    productUid: "flat_300x300-mm-12x12-inch_200-gsm-80lb-coated-silk_4-0_ver",
    price: 29,
  },
  {
    id: "16",
    label: '16 × 16"',
    dim: "40 × 40 cm",
    productUid: "flat_400x400-mm-16x16-inch_200-gsm-80lb-coated-silk_4-0_ver",
    price: 39,
  },
  {
    id: "20",
    label: '20 × 20"',
    dim: "50 × 50 cm",
    productUid: "flat_500x500-mm-20x20-inch_200-gsm-80lb-coated-silk_4-0_ver",
    price: 49,
  },
  {
    id: "28",
    label: '28 × 28"',
    dim: "70 × 70 cm",
    productUid: "flat_700x700-mm-28x28-inch_200-gsm-80lb-coated-silk_4-0_ver",
    price: 69,
  },
];

export function posterSize(id: string): PosterSize {
  const s = POSTER_SIZES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown poster size: ${id}`);
  return s;
}

function apiKey(): string | null {
  return process.env.GELATO_API_KEY || null;
}

export interface GelatoRecipient {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postCode: string;
  country: string; // ISO-2
  email: string;
}

/** Look up an existing order by our reference id (the Stripe session id) so
 *  refreshing the confirmation page never double-orders. */
export async function findOrderByRef(ref: string): Promise<any | null> {
  const k = apiKey();
  if (!k) return null;
  const res = await fetch(`${BASE}/orders:search`, {
    method: "POST",
    headers: { "X-API-KEY": k, "Content-Type": "application/json" },
    body: JSON.stringify({ orderReferenceIds: [ref], limit: 1 }),
  });
  const d = (await res.json().catch(() => ({}))) as any;
  return d.orders?.[0] ?? null;
}

export async function placePosterOrder(opts: {
  ref: string;
  productUid: string;
  printUrl: string;
  recipient: GelatoRecipient;
  quantity?: number;
}): Promise<any> {
  const k = apiKey();
  if (!k) throw new Error("Gelato not configured (GELATO_API_KEY missing)");
  const res = await fetch(`${BASE}/orders`, {
    method: "POST",
    headers: { "X-API-KEY": k, "Content-Type": "application/json" },
    body: JSON.stringify({
      orderType: "order",
      orderReferenceId: opts.ref,
      customerReferenceId: "shot-from-space",
      currency: "USD",
      items: [
        {
          itemReferenceId: `${opts.ref}-poster`,
          productUid: opts.productUid,
          files: [{ type: "default", url: opts.printUrl }],
          quantity: opts.quantity ?? 1,
        },
      ],
      shippingAddress: opts.recipient,
    }),
  });
  const d = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`Gelato ${res.status}: ${JSON.stringify(d).slice(0, 240)}`);
  return d;
}

/** Split a Stripe full name into first/last for Gelato. */
export function splitName(full?: string | null): { firstName: string; lastName: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Shot", lastName: "Customer" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
