// Tasking adapters. Two are REAL:
//   • SkyFi Platform API — books a fresh tasking order (needs SKYFI_API_KEY;
//     the key value is the "email:apikey" string, sent as X-Skyfi-Api-Key).
//   • Copernicus Sentinel-2 via the keyless Element84 Earth Search STAC — a
//     genuine archive lookup of the target, no account required.
//
// dispatchTasking() always returns a real result when possible: paid tiers go
// to SkyFi; anything without a SkyFi key still gets a real Copernicus archive
// hit. Pure simulation is only a last resort if both are unreachable.

import type { Order } from "./orders";
import { tier, partner, resolutionToSkyfi } from "./catalog";
import { bboxAround } from "./geo";

export interface TaskingResult {
  mode: "live" | "archive" | "simulated";
  partner: string;
  externalId: string;
  status: string;
  message: string;
  captureTime?: string;
  cloudCover?: number;
}

function pseudoId(seed: string, prefix: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `${prefix}-${h.toString(36).toUpperCase().padStart(7, "0").slice(0, 7)}`;
}

/** Small convex WKT polygon (lon lat order) around a point — SkyFi AOI format. */
function wktBox(order: Order, meters = 250): string {
  const b = bboxAround(order.location, meters);
  const ring = [
    [b.minLng, b.minLat],
    [b.maxLng, b.minLat],
    [b.maxLng, b.maxLat],
    [b.minLng, b.maxLat],
    [b.minLng, b.minLat],
  ]
    .map(([x, y]) => `${x.toFixed(6)} ${y.toFixed(6)}`)
    .join(", ");
  return `POLYGON ((${ring}))`;
}

async function taskSkyFi(order: Order): Promise<TaskingResult | null> {
  const key = process.env.SKYFI_API_KEY;
  if (!key) return null;
  const t = tier(order.tierId);
  const sensor = order.sensor ?? t.sensor;
  // honour the customer's chosen attempt time (or now), 72h collection window
  const startMs = order.attemptAt ? Date.parse(order.attemptAt) : NaN;
  const start = Number.isFinite(startMs) ? new Date(startMs) : new Date();
  const windowStart = start.toISOString();
  const windowEnd = new Date(start.getTime() + 72 * 3600_000).toISOString();
  const resolution = resolutionToSkyfi(order.resolution, sensor);
  const productType = sensor === "sar" ? "SAR" : "DAY";

  const res = await fetch("https://app.skyfi.com/platform-api/order-tasking", {
    method: "POST",
    headers: { "X-Skyfi-Api-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      aoi: wktBox(order),
      windowStart,
      windowEnd,
      productType,
      resolution,
      priorityItem: order.tierId === "priority",
      maxCloudCoveragePercent: 20,
      webhookUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/webhook`,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`SkyFi ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return {
    mode: "live",
    partner: "skyfi",
    externalId: data.orderId ?? data.id ?? pseudoId(order.id, "SKYFI"),
    status: data.status ?? "CREATED",
    message: "Tasking order accepted by the SkyFi marketplace.",
  };
}

/** Real, keyless Sentinel-2 archive lookup over the target (Element84 STAC). */
async function taskCopernicus(order: Order): Promise<TaskingResult | null> {
  const res = await fetch("https://earth-search.aws.element84.com/v1/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collections: ["sentinel-2-l2a"],
      intersects: {
        type: "Point",
        coordinates: [order.location.lng, order.location.lat],
      },
      limit: 1,
      sortby: [{ field: "properties.datetime", direction: "desc" }],
    }),
    // archive doesn't change fast; let the CDN/edge cache it
    next: { revalidate: 3600 },
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`EarthSearch ${res.status}`);
  const feat = data.features?.[0];
  if (!feat) return null;
  const p = feat.properties ?? {};
  return {
    mode: "archive",
    partner: "copernicus",
    externalId: feat.id ?? pseudoId(order.id, "S2"),
    status: "DELIVERED",
    message: "Latest Sentinel-2 archive scene located over the target.",
    captureTime: p.datetime,
    cloudCover: typeof p["eo:cloud_cover"] === "number" ? p["eo:cloud_cover"] : undefined,
  };
}

function simulate(order: Order): TaskingResult {
  const t = tier(order.tierId);
  const p = partner(t.partnerId);
  return {
    mode: "simulated",
    partner: p.id,
    externalId: pseudoId(order.id, p.id.toUpperCase().slice(0, 3)),
    status: "SCHEDULED",
    message: `Simulated pass on ${p.name}. Providers are reachable via SkyFi; add SKYFI_API_KEY to place a live order.`,
  };
}

/** Dispatch a paid order. Prefers a real SkyFi tasking order; if no SkyFi key,
 *  still returns a REAL Copernicus archive hit; simulation only if both fail. */
export async function dispatchTasking(order: Order): Promise<TaskingResult> {
  // 1) Real tasking via SkyFi (brokers Planet, Umbra, ICEYE, Vantor, Sentinel…).
  try {
    const r = await taskSkyFi(order);
    if (r) return r;
  } catch (e) {
    // fall through — try the keyless real archive next
    try {
      const c = await taskCopernicus(order);
      if (c)
        return {
          ...c,
          message: `SkyFi tasking failed (${(e as Error).message}); returned latest Sentinel-2 archive instead.`,
        };
    } catch {
      /* fall through to simulate */
    }
    return simulate(order);
  }

  // 2) No SkyFi key — real keyless Copernicus archive lookup.
  try {
    const c = await taskCopernicus(order);
    if (c) return c;
  } catch {
    /* ignore */
  }

  // 3) Last resort.
  return simulate(order);
}
