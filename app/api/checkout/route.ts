import { NextRequest, NextResponse } from "next/server";
import { getStripe, siteUrl } from "@/lib/stripe";
import { tier, computePrice } from "@/lib/catalog";
import { encodeMetadata, type OrderInput } from "@/lib/orders";
import { POSTER_SIZES, PACKAGE_MARKUP } from "@/lib/gelato";

export const runtime = "nodejs";

// Gelato ships to most of the world; broad allow-list for the poster case.
const SHIP_COUNTRIES = [
  "US", "CA", "GB", "IE", "FR", "DE", "ES", "IT", "NL", "BE", "AT", "CH",
  "SE", "NO", "DK", "FI", "PT", "PL", "CZ", "RO", "GR", "AU", "NZ", "JP",
  "SG", "AE", "BR", "MX",
] as const;

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured on the server." },
      { status: 500 }
    );
  }

  let body: OrderInput;
  try {
    body = (await req.json()) as OrderInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  let t;
  try {
    t = tier(body.tierId);
  } catch {
    return NextResponse.json({ error: "Unknown tier." }, { status: 400 });
  }

  const { lat, lng } = body.location ?? {};
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "Missing coordinates." }, { status: 400 });
  }

  const origin = siteUrl();

  // optional bundled poster
  const poster = body.posterSizeId
    ? POSTER_SIZES.find((p) => p.id === body.posterSizeId)
    : null;

  const satPrice = computePrice(
    t.id,
    body.sensor ?? t.sensor,
    body.resolution ?? t.resolution
  );

  const line_items: any[] = [
    {
      quantity: 1,
      price_data: {
        currency: t.currency,
        unit_amount: satPrice * 100,
        product_data: {
          name: `${t.name} — satellite tasking`,
          description: `${body.resolution ?? t.resolution} ${(
            body.sensor ?? t.sensor
          ).toUpperCase()} capture${body.sat ? ` · ${body.sat}` : ""} · ${body.label}`,
        },
      },
    },
  ];

  if (poster) {
    line_items.push({
      quantity: 1,
      price_data: {
        currency: t.currency,
        unit_amount: poster.price * 100,
        product_data: {
          name: `${poster.label} poster print`,
          description: `${poster.dim} matte poster of ${body.target || body.label} · shipped worldwide`,
        },
      },
    });
    // 10% package markup on the combined subtotal
    const markup = Math.round((satPrice + poster.price) * PACKAGE_MARKUP);
    if (markup > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: t.currency,
          unit_amount: markup * 100,
          product_data: { name: "Package handling (+10%)" },
        },
      });
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      metadata: encodeMetadata(body),
      line_items,
      ...(poster
        ? {
            shipping_address_collection: {
              allowed_countries: SHIP_COUNTRIES as unknown as any,
            },
            phone_number_collection: { enabled: true },
          }
        : {}),
      success_url: `${origin}/order/{CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=1`,
    });

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (e) {
    return NextResponse.json(
      { error: `Stripe error: ${(e as Error).message}` },
      { status: 502 }
    );
  }
}
