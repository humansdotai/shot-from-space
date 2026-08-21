import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { decodeMetadata } from "@/lib/orders";
import { dispatchTasking } from "@/lib/tasking";

export const runtime = "nodejs";

// Optional: wire this URL into a Stripe webhook (checkout.session.completed)
// and set STRIPE_WEBHOOK_SECRET to dispatch the real tasking order the moment
// payment settles. The app also works without it (the order page verifies
// payment directly), so this is a progressive enhancement.
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ received: true, dispatched: false });
  }

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? "", secret);
  } catch (e) {
    return NextResponse.json(
      { error: `Signature check failed: ${(e as Error).message}` },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as any;
    const order = decodeMetadata(
      s.id,
      s.metadata,
      s.payment_status === "paid",
      s.amount_total ?? 0,
      (s.currency ?? "usd").toUpperCase(),
      (s.created ?? 0) * 1000
    );
    if (order?.paid) {
      const result = await dispatchTasking(order);
      return NextResponse.json({ received: true, dispatched: true, result });
    }
  }

  return NextResponse.json({ received: true, dispatched: false });
}
