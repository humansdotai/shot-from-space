import { NextRequest, NextResponse } from "next/server";
import { getStripe, siteUrl } from "@/lib/stripe";
import { posterSize, POSTER_SHIPPING } from "@/lib/gelato";

export const runtime = "nodejs";

// Gelato ships to most of the world; this is a broad allow-list for Checkout.
const COUNTRIES = [
  "US", "CA", "GB", "IE", "FR", "DE", "ES", "IT", "NL", "BE", "AT", "CH",
  "SE", "NO", "DK", "FI", "PT", "PL", "CZ", "RO", "GR", "AU", "NZ", "JP",
  "SG", "AE", "BR", "MX",
] as const;

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured." }, { status: 500 });
  }

  let body: {
    sizeId: string;
    lat: number;
    lng: number;
    label?: string;
    target?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  let size;
  try {
    size = posterSize(body.sizeId);
  } catch {
    return NextResponse.json({ error: "Unknown poster size." }, { status: 400 });
  }
  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json({ error: "Missing coordinates." }, { status: 400 });
  }

  const origin = siteUrl();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      shipping_address_collection: {
        allowed_countries: COUNTRIES as unknown as any,
      },
      phone_number_collection: { enabled: true },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: POSTER_SHIPPING * 100, currency: "usd" },
            display_name: "Worldwide tracked shipping",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 5 },
              maximum: { unit: "business_day", value: 12 },
            },
          },
        },
      ],
      metadata: {
        app: "sfs-poster",
        sizeId: size.id,
        posterUid: size.productUid,
        lat: body.lat.toFixed(6),
        lng: body.lng.toFixed(6),
        label: (body.label ?? "").slice(0, 400),
        target: (body.target ?? "").slice(0, 200),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: size.price * 100,
            product_data: {
              name: `Shot From Space — ${size.label} poster`,
              description: `${size.dim} matte poster of ${body.target || body.label || "your capture"}`,
            },
          },
        },
      ],
      success_url: `${origin}/poster/{CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/order/${req.nextUrl.searchParams.get("from") ?? ""}`,
    });
    return NextResponse.json({ url: session.url, id: session.id });
  } catch (e) {
    return NextResponse.json(
      { error: `Stripe error: ${(e as Error).message}` },
      { status: 502 }
    );
  }
}
