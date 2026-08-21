import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { decodeMetadata } from "@/lib/orders";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured." }, { status: 500 });
  }

  try {
    const s = await stripe.checkout.sessions.retrieve(params.id);
    const order = decodeMetadata(
      s.id,
      s.metadata as Record<string, string>,
      s.payment_status === "paid",
      s.amount_total ?? 0,
      (s.currency ?? "usd").toUpperCase(),
      (s.created ?? 0) * 1000
    );
    if (!order) {
      return NextResponse.json({ error: "Not a valid order." }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch (e) {
    return NextResponse.json(
      { error: `Lookup failed: ${(e as Error).message}` },
      { status: 404 }
    );
  }
}
