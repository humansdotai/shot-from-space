// The order model + (de)serialisation to Stripe Checkout Session metadata.
// Stripe is our source of truth so the app stays stateless on Vercel — there
// is no database. Everything needed to render an order round-trips through the
// session's metadata and payment_status.

import type { LatLng } from "./geo";

export interface OrderInput {
  tierId: string;
  location: LatLng;
  label: string; // address or "pinned coordinates"
  target?: string; // optional free-text ("my house")
  sensor?: "optical" | "sar"; // capture modality
  resolution?: string; // requested GSD label, e.g. "0.30 m"
  attemptAt?: string; // ISO earliest-attempt timestamp for the tasking window
  sat?: string; // satellite tasked for the selected pass window
  posterSizeId?: string; // optional bundled poster (Gelato) size id
}

export interface Order extends OrderInput {
  id: string; // Stripe checkout session id
  paid: boolean;
  amount: number; // in USD cents
  currency: string;
  createdAt: number; // epoch ms (session created)
}

export function encodeMetadata(o: OrderInput): Record<string, string> {
  return {
    app: "shot-from-space",
    tierId: o.tierId,
    lat: o.location.lat.toFixed(6),
    lng: o.location.lng.toFixed(6),
    label: o.label.slice(0, 480),
    target: (o.target ?? "").slice(0, 300),
    sensor: o.sensor ?? "",
    resolution: o.resolution ?? "",
    attemptAt: o.attemptAt ?? "",
    sat: (o.sat ?? "").slice(0, 60),
    posterSizeId: o.posterSizeId ?? "",
  };
}

export function decodeMetadata(
  id: string,
  md: Record<string, string> | null,
  paid: boolean,
  amount: number,
  currency: string,
  createdAt: number
): Order | null {
  if (!md || md.app !== "shot-from-space") return null;
  return {
    id,
    tierId: md.tierId,
    location: { lat: parseFloat(md.lat), lng: parseFloat(md.lng) },
    label: md.label ?? "",
    target: md.target || undefined,
    sensor: md.sensor === "sar" || md.sensor === "optical" ? md.sensor : undefined,
    resolution: md.resolution || undefined,
    attemptAt: md.attemptAt || undefined,
    sat: md.sat || undefined,
    posterSizeId: md.posterSizeId || undefined,
    paid,
    amount,
    currency,
    createdAt,
  };
}
