// Tasking adapters. Each partner either places a REAL order (when its API key
// is configured) or returns a high-fidelity SIMULATED order. The rest of the
// app treats both identically.
//
// Endpoints/verbs below follow the live SkyFi Platform API (OpenAPI 2.0.0) and
// SkyWatch EarthCache API (OpenAPI 1.7). Without a key the adapter short-
// circuits to simulation so the full product works out of the box.

import type { Order } from "./orders";
import { tier, partner } from "./catalog";
import { bboxAround } from "./geo";

export interface TaskingResult {
  mode: "live" | "simulated";
  partner: string;
  externalId: string;
  status: string;
  message: string;
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

/** GeoJSON polygon ring (lon lat) for SkyWatch AOI. */
function geoJsonRing(order: Order, meters = 250): number[][] {
  const b = bboxAround(order.location, meters);
  return [
    [b.minLng, b.minLat],
    [b.maxLng, b.minLat],
    [b.maxLng, b.maxLat],
    [b.minLng, b.maxLat],
    [b.minLng, b.minLat],
  ];
}

async function taskSkyFi(order: Order): Promise<TaskingResult | null> {
  const key = process.env.SKYFI_API_KEY;
  if (!key) return null;
  const t = tier(order.tierId);
  const now = new Date();
  const windowStart = now.toISOString();
  const windowEnd = new Date(now.getTime() + 72 * 3600_000).toISOString();
  const resolution = t.sensor === "sar" ? "HIGH" : "VERY HIGH";
  const productType = t.sensor === "sar" ? "SAR" : "DAY";

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

async function taskSkyWatch(order: Order): Promise<TaskingResult | null> {
  const key = process.env.SKYWATCH_API_KEY;
  if (!key) return null;
  const t = tier(order.tierId);
  const start = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 16 * 86400_000).toISOString().slice(0, 10);

  const res = await fetch("https://api.skywatch.co/earthcache/pipelines", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `shot-from-space-${order.id.slice(-8)}`,
      start_date: start,
      end_date: end,
      interval: "7d",
      max_cost: t.price,
      cloud_cover_percentage: 20,
      resolution_low: t.sensor === "sar" ? 0.5 : 0.3,
      resolution_high: t.sensor === "sar" ? 0.5 : 0.3,
      aoi: { type: "Polygon", coordinates: [geoJsonRing(order)] },
      output: { id: "visual", format: "geotiff", mosaic: "unstitched" },
      result_delivery: { max_latency: "0d", priorities: ["highest_resolution"] },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`SkyWatch ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return {
    mode: "live",
    partner: "skywatch",
    externalId: data.data?.id ?? data.id ?? pseudoId(order.id, "SW"),
    status: "active",
    message: "EarthCache pipeline created; searching supplier catalogues.",
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
    message: `Simulated tasking on ${p.name}. Set ${p.id.toUpperCase()}_API_KEY to place a live order.`,
  };
}

/** Dispatch a paid order to the right partner. Never throws for the caller —
 *  a live-API failure degrades to simulation so the customer is never stuck. */
export async function dispatchTasking(order: Order): Promise<TaskingResult> {
  const t = tier(order.tierId);
  try {
    if (t.partnerId === "skyfi") {
      const r = await taskSkyFi(order);
      if (r) return r;
    }
    if (t.partnerId === "skywatch") {
      const r = await taskSkyWatch(order);
      if (r) return r;
    }
    // Any optical/SAR tier can also be brokered through SkyFi if that key exists.
    if (process.env.SKYFI_API_KEY) {
      const r = await taskSkyFi(order);
      if (r) return r;
    }
  } catch (e) {
    return {
      ...simulate(order),
      message: `Live tasking failed (${(e as Error).message}); running simulated pass.`,
    };
  }
  return simulate(order);
}
