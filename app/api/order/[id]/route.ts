import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { decodeMetadata } from "@/lib/orders";
import { esriImageUrl } from "@/lib/geo";
import {
  posterSize,
  findOrderByRef,
  placePosterOrder,
  splitName,
  type GelatoRecipient,
} from "@/lib/gelato";

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

    // fulfil a bundled poster once payment clears (idempotent)
    let poster: { sizeId: string; label: string; gelatoId: string | null } | null =
      null;
    if (order.posterSizeId) {
      let size = null;
      try {
        size = posterSize(order.posterSizeId);
      } catch {
        /* ignore */
      }
      poster = { sizeId: order.posterSizeId, label: size?.label ?? "", gelatoId: null };
      if (order.paid && size) {
        try {
          let g = await findOrderByRef(s.id);
          if (!g) {
            const ship = (s as any).shipping_details;
            const cust = (s as any).customer_details;
            if (ship?.address) {
              const name = splitName(ship.name);
              const recipient: GelatoRecipient = {
                firstName: name.firstName,
                lastName: name.lastName,
                addressLine1: ship.address.line1 ?? "",
                addressLine2: ship.address.line2 || undefined,
                city: ship.address.city ?? "",
                state: ship.address.state || undefined,
                postCode: ship.address.postal_code ?? "",
                country: ship.address.country ?? "US",
                email: cust?.email ?? "dev@humans.ai",
              };
              g = await placePosterOrder({
                ref: s.id,
                productUid: size.productUid,
                printUrl: esriImageUrl(order.location, 170, 2400),
                recipient,
              });
            }
          }
          if (g) poster.gelatoId = g.id ?? null;
        } catch {
          /* leave gelatoId null; UI shows "submitting" */
        }
      }
    }

    return NextResponse.json({ order, poster });
  } catch (e) {
    return NextResponse.json(
      { error: `Lookup failed: ${(e as Error).message}` },
      { status: 404 }
    );
  }
}
