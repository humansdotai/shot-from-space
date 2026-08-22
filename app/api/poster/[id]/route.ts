import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
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

  let s;
  try {
    s = await stripe.checkout.sessions.retrieve(params.id);
  } catch (e) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  const md = (s.metadata ?? {}) as Record<string, string>;
  if (md.app !== "sfs-poster") {
    return NextResponse.json({ error: "Not a poster order." }, { status: 404 });
  }

  const size = (() => {
    try {
      return posterSize(md.sizeId);
    } catch {
      return null;
    }
  })();
  const location = { lat: parseFloat(md.lat), lng: parseFloat(md.lng) };
  const printUrl = esriImageUrl(location, 170, 2400);
  const previewUrl = esriImageUrl(location, 170, 900);
  const paid = s.payment_status === "paid";

  const base = {
    id: s.id,
    paid,
    size,
    label: md.label || "",
    target: md.target || "",
    location,
    previewUrl,
    amount: s.amount_total ?? 0,
    shipping: (s as any).shipping_details ?? null,
  };

  if (!paid) {
    return NextResponse.json({ ...base, gelato: null });
  }

  // idempotent fulfilment: only place the Gelato order once per session
  try {
    let order = await findOrderByRef(s.id);
    if (!order && size) {
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
        order = await placePosterOrder({
          ref: s.id,
          productUid: size.productUid,
          printUrl,
          recipient,
        });
      }
    }
    return NextResponse.json({
      ...base,
      gelato: order
        ? {
            id: order.id,
            status: order.fulfillmentStatus ?? order.orderType ?? "created",
          }
        : null,
    });
  } catch (e) {
    return NextResponse.json({ ...base, gelato: null, error: (e as Error).message });
  }
}
