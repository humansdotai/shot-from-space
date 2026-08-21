import { NextRequest, NextResponse } from "next/server";
import { getStripe, siteUrl } from "@/lib/stripe";
import { tier } from "@/lib/catalog";
import { encodeMetadata, type OrderInput } from "@/lib/orders";

export const runtime = "nodejs";

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

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      metadata: encodeMetadata(body),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: t.currency,
            unit_amount: t.price * 100,
            product_data: {
              name: `${t.name} — satellite tasking`,
              description: `${t.resolution} ${t.sensor.toUpperCase()} capture · ${body.label}`,
            },
          },
        },
      ],
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
