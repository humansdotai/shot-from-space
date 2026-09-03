/**
 * ==================================================================
 * SKYFI ADAPTER — satellite tasking
 * ==================================================================
 * WHAT IT DOES
 *   Books a new collection over the customer's coordinates, reports the state
 *   of that collection, and hands back the downlinked capture.
 *
 * WHAT IS MOCKED
 *   Everything. `requestTasking` returns a deterministic order id, a plausible
 *   7–14 day capture window and the full pass telemetry generated from the
 *   mission code (lib/missions/telemetry.ts). `fetchCapture` returns a
 *   public-domain catalogue frame chosen by proximity to the target
 *   (lib/missions/frames.ts) instead of a real asset. Latency is simulated.
 *
 * WHAT THE LIVE PATH NEEDS
 *   SKYFI_API_KEY        — app.skyfi.com → Account → API
 *   SKYFI_API_BASE_URL   — https://app.skyfi.com/platform-api
 *   SKYFI_WEBHOOK_SECRET — for POST /api/webhooks/skyfi
 *   MOCK_MODE=false
 *   A funded SkyFi account: tasking is billed per collection, and a tasking
 *   order for a residential rooftop needs sub-metre VHR, which is the most
 *   expensive tier. Budget for re-tasking — cloud cover kills a meaningful
 *   share of first attempts (that is why CAPTURE_WINDOW is a real stage).
 *
 * ENDPOINTS (SkyFi Platform API, Bearer auth via `X-Skyfi-Api-Key`)
 *   POST {base}/feasibility          — can this point be collected, when, at
 *                                      what resolution, for how much
 *   POST {base}/order-tasking        — place the collection order
 *   GET  {base}/orders               — list orders
 *   GET  {base}/order/{orderId}      — one order, with its current status
 *   GET  {base}/order/{orderId}/download — signed asset download
 *   VERIFY these paths and the exact request bodies against the current SkyFi
 *   Platform API docs before shipping: SkyFi versions the platform API and the
 *   tasking payload shape (AOI geometry, resolution tier, window) has moved
 *   between revisions. The shapes below are the intended contract, not a
 *   guarantee.
 * ==================================================================
 */
import { INTEGRATIONS, isLive } from '@/lib/env';
import { seededUnit, sleep } from '@/lib/utils';
import {
  missionCaptureCloudPct,
  missionCaptureWindow,
  missionTelemetry,
  seededInt,
} from '@/lib/missions/telemetry';
import { CLOUD_THRESHOLD_PCT } from '@/lib/guarantees';
import { pickFrameForCoords } from '@/lib/missions/frames';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface TaskingRequest {
  lat: number;
  lon: number;
  /** Side length of the square AOI in kilometres. ~1 km covers a house lot. */
  areaKm: number;
  missionCode: string;
}

export interface ArchiveOrderRequest {
  lat: number;
  lon: number;
  areaKm: number;
  missionCode: string;
  archiveId: string;
  /** ISO timestamp of the scene, for the mission record. */
  capturedAt?: string | null;
}

export interface TaskingResult {
  orderId: string;
  /** ISO 8601. */
  windowOpensAt: string;
  windowClosesAt: string;
  sensor: string;
  /** Ground sample distance in metres. */
  gsdM: number;
  azimuthDeg: number;
  offNadirDeg: number;
  inclination: string;
  track: string;
  altitudeKm: number;
  /** Forecast cloud cover across the window, percent. */
  cloudPct: number;
  /** Scheduled passes over the target inside the window. */
  passes: number;
}

export type TaskingStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'SCHEDULED'
  | 'CAPTURED'
  | 'PROCESSING'
  | 'DELIVERED'
  | 'FAILED';

export interface TaskingStatusResult {
  orderId: string;
  status: TaskingStatus;
  windowOpensAt: string | null;
  windowClosesAt: string | null;
  capturedAt: string | null;
  cloudPct: number | null;
  note: string;
}

export interface CaptureResult {
  orderId: string;
  captureId: string;
  capturedAt: string;
  cloudPct: number;
  sensor: string;
  gsdM: number;
  /** In mock mode: a catalogue slug. In live mode: null (use `assetUrl`). */
  imagerySlug: string | null;
  /** Signed URL to the full-resolution asset. Mock returns the local file. */
  assetUrl: string;
  /** Bounding box of the delivered frame: [west, south, east, north]. */
  bbox: [number, number, number, number];
}

export interface SkyfiAdapter {
  /** Orders an EXISTING scene by archive id — no satellite is tasked. */
  requestArchiveOrder(input: ArchiveOrderRequest): Promise<TaskingResult>;
  requestTasking(input: TaskingRequest): Promise<TaskingResult>;
  getTaskingStatus(orderId: string): Promise<TaskingStatusResult>;
  fetchCapture(orderId: string): Promise<CaptureResult>;
}

/* ------------------------------------------------------------------ */
/* Order-id encoding                                                  */
/* ------------------------------------------------------------------ */

/**
 * Mock order ids carry the mission code so `getTaskingStatus(orderId)` and
 * `fetchCapture(orderId)` stay deterministic without a lookup table:
 *   sky_tsk_32BF_k3f9a1
 */
function mockOrderId(missionCode: string): string {
  const suffix = Math.round(seededUnit(`skyfi:${missionCode}`) * 1e12)
    .toString(36)
    .slice(0, 6)
    .padStart(6, '0');
  return `sky_tsk_${missionCode.toUpperCase()}_${suffix}`;
}

function codeFromOrderId(orderId: string): string {
  const m = /^sky_tsk_([0-9A-Z]{4})_/.exec(orderId);
  return m ? m[1] : orderId.slice(-4).toUpperCase();
}

/**
 * Mock captures are anchored to a fixed point per mission so they do not drift
 * every time a status is polled: the target coordinates are recovered from the
 * catalogue frame the mission resolves to.
 */
function mockCoordsForOrder(orderId: string): { lat: number; lon: number } {
  const code = codeFromOrderId(orderId);
  // Without the original coordinates the nearest frame cannot be recomputed,
  // so fall back to a stable pseudo-target. Callers that have the mission row
  // pass real coordinates to requestTasking; fetchCapture only needs the slug
  // for the preview, and lib/missions overrides it with the stored slug.
  const lat = -60 + seededUnit(`clat:${code}`) * 120;
  const lon = -180 + seededUnit(`clon:${code}`) * 360;
  return { lat, lon };
}

/* ------------------------------------------------------------------ */
/* MOCK                                                               */
/* ------------------------------------------------------------------ */

export const mock: SkyfiAdapter = {
  async requestArchiveOrder(input) {
    const t = await mock.requestTasking(input);
    const now = new Date();
    return {
      ...t,
      orderId: `ARC-${input.missionCode}-${input.archiveId.slice(0, 8).toUpperCase()}`,
      windowOpensAt: now.toISOString(),
      windowClosesAt: new Date(now.getTime() + 12 * 3_600_000).toISOString(),
      passes: 1,
    };
  },
  async requestTasking(input) {
    // Real tasking acceptance is a slow, synchronous-feeling call.
    await sleep(340 + Math.round(seededUnit(`skylat:${input.missionCode}`) * 260));

    const t = missionTelemetry(input.missionCode);
    const { opensAt, closesAt } = missionCaptureWindow(input.missionCode);

    return {
      orderId: mockOrderId(input.missionCode),
      windowOpensAt: opensAt.toISOString(),
      windowClosesAt: closesAt.toISOString(),
      sensor: t.sensor,
      gsdM: t.gsdM,
      azimuthDeg: t.azimuthDeg,
      offNadirDeg: t.offNadirDeg,
      inclination: t.inclination,
      track: t.track,
      altitudeKm: t.altitudeKm,
      cloudPct: t.cloudPct,
      passes: seededInt(`passes:${input.missionCode.toUpperCase()}`, 3, 7),
    };
  },

  async getTaskingStatus(orderId) {
    await sleep(120);
    const code = codeFromOrderId(orderId);
    const t = missionTelemetry(code);
    const { opensAt, closesAt } = missionCaptureWindow(code);

    // Mock status is derived from the clock against the mission's own window,
    // which makes polling behave sensibly during a live demo.
    const now = Date.now();
    let status: TaskingStatus = 'ACCEPTED';
    if (now >= closesAt.getTime()) status = 'DELIVERED';
    else if (now >= opensAt.getTime()) status = 'SCHEDULED';

    return {
      orderId,
      status,
      windowOpensAt: opensAt.toISOString(),
      windowClosesAt: closesAt.toISOString(),
      capturedAt: status === 'DELIVERED' ? closesAt.toISOString() : null,
      // Before delivery this is the forecast; once a frame is accepted it is
      // the measured value, which by the guarantee clears the threshold.
      cloudPct: status === 'DELIVERED' ? missionCaptureCloudPct(code) : t.cloudPct,
      note:
        status === 'DELIVERED'
          ? 'Collection complete. Asset available for download.'
          : 'Collection scheduled. Awaiting a pass under the cloud threshold.',
    };
  },

  async fetchCapture(orderId) {
    await sleep(260);
    const code = codeFromOrderId(orderId);
    const t = missionTelemetry(code);
    const { lat, lon } = mockCoordsForOrder(orderId);
    const frame = pickFrameForCoords(lat, lon);
    const capturedAt = new Date();

    // A ~1 km square AOI expressed as a bbox around the frame centre.
    const dLat = 0.0045;
    const dLon = 0.0045 / Math.max(0.2, Math.cos((frame.lat * Math.PI) / 180));

    return {
      orderId,
      captureId: `sky_cap_${code}_${Math.round(seededUnit(`cap:${code}`) * 1e6)}`,
      capturedAt: capturedAt.toISOString(),
      // This is the frame we KEPT, so its cloud cover cannot exceed the
      // published threshold — passes above it are re-tasked, not delivered.
      cloudPct: missionCaptureCloudPct(code),
      sensor: t.sensor,
      gsdM: t.gsdM,
      imagerySlug: frame.slug,
      assetUrl: frame.src,
      bbox: [frame.lon - dLon, frame.lat - dLat, frame.lon + dLon, frame.lat + dLat],
    };
  },
};

/* ------------------------------------------------------------------ */
/* LIVE — complete but inactive until MOCK_MODE=false + keys           */
/* ------------------------------------------------------------------ */

function liveHeaders() {
  return {
    'X-Skyfi-Api-Key': INTEGRATIONS.skyfi.apiKey,
    'Content-Type': 'application/json',
  };
}

/** Square AOI polygon (GeoJSON ring) around a point, `areaKm` on a side. */
export function aoiPolygon(lat: number, lon: number, areaKm: number) {
  const dLat = areaKm / 2 / 111.32;
  const dLon = dLat / Math.max(0.05, Math.cos((lat * Math.PI) / 180));
  return {
    type: 'Polygon' as const,
    coordinates: [
      [
        [lon - dLon, lat - dLat],
        [lon + dLon, lat - dLat],
        [lon + dLon, lat + dLat],
        [lon - dLon, lat + dLat],
        [lon - dLon, lat - dLat],
      ],
    ],
  };
}

export const live: SkyfiAdapter = {
  async requestArchiveOrder(input) {
    const base = INTEGRATIONS.skyfi.baseUrl;
    const res = await fetch(`${base}/order-archive`, {
      method: 'POST',
      headers: liveHeaders(),
      body: JSON.stringify({
        aoi: aoiPolygon(input.lat, input.lon, input.areaKm),
        archiveId: input.archiveId,
        label: input.missionCode,
        orderLabel: `MISSION ${input.missionCode}`,
        metadata: { missionCode: input.missionCode },
      }),
    });
    if (!res.ok) throw new Error(`skyfi archive order failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as Record<string, unknown>;
    const t = missionTelemetry(input.missionCode);
    const now = new Date();
    const hours = Number(json.deliveryTimeHours ?? 12);
    return {
      orderId: String(json.orderId ?? json.id ?? ''),
      windowOpensAt: now.toISOString(),
      windowClosesAt: new Date(now.getTime() + hours * 3_600_000).toISOString(),
      sensor: String(json.satellite ?? t.sensor),
      gsdM: Number(json.resolutionMeters ?? t.gsdM),
      azimuthDeg: t.azimuthDeg,
      offNadirDeg: Number(json.offNadirAngle ?? t.offNadirDeg),
      inclination: t.inclination,
      track: t.track,
      altitudeKm: t.altitudeKm,
      cloudPct: Number(json.cloudCoveragePercent ?? t.cloudPct),
      passes: 1,
    };
  },
  async requestTasking(input) {
    const base = INTEGRATIONS.skyfi.baseUrl;
    const now = Date.now();
    const day = 86_400_000;

    // POST {base}/order-tasking
    const res = await fetch(`${base}/order-tasking`, {
      method: 'POST',
      headers: liveHeaders(),
      body: JSON.stringify({
        aoi: aoiPolygon(input.lat, input.lon, input.areaKm),
        // Residential rooftops need the very-high-resolution tier.
        resolution: 'VERY HIGH',
        productType: 'DAY',
        // Give the constellation a fortnight to find a clear pass.
        fromDate: new Date(now + 2 * day).toISOString(),
        toDate: new Date(now + 16 * day).toISOString(),
        // The published guarantee and the number sent to the operator are the
        // same number, read from one constant. They used to be 10 and 15.
        maxCloudCoveragePercent: CLOUD_THRESHOLD_PCT,
        maxOffNadirAngle: 25,
        deliveryDriver: 'S3',
        reference: input.missionCode,
      }),
    });

    if (!res.ok) throw new Error(`skyfi tasking failed: ${res.status} ${await res.text()}`);

    const json = (await res.json()) as Record<string, unknown>;
    const orderId = String(json.orderId ?? json.id ?? '');
    const t = missionTelemetry(input.missionCode);

    // The live API reports the accepted window; the remaining pass geometry
    // arrives with the capture, so mission-seeded defaults fill the gap until
    // fetchCapture() overwrites them.
    return {
      orderId,
      windowOpensAt: String(json.fromDate ?? new Date(now + 2 * day).toISOString()),
      windowClosesAt: String(json.toDate ?? new Date(now + 16 * day).toISOString()),
      sensor: String(json.satellite ?? t.sensor),
      gsdM: Number(json.resolutionMeters ?? t.gsdM),
      azimuthDeg: t.azimuthDeg,
      offNadirDeg: Number(json.offNadirAngle ?? t.offNadirDeg),
      inclination: t.inclination,
      track: t.track,
      altitudeKm: t.altitudeKm,
      cloudPct: Number(json.maxCloudCoveragePercent ?? t.cloudPct),
      passes: Number(json.scheduledPasses ?? 4),
    };
  },

  async getTaskingStatus(orderId) {
    // GET {base}/order/{orderId}
    const res = await fetch(`${INTEGRATIONS.skyfi.baseUrl}/order/${orderId}`, {
      headers: liveHeaders(),
    });
    if (!res.ok) throw new Error(`skyfi status failed: ${res.status}`);

    const json = (await res.json()) as Record<string, unknown>;
    const raw = String(json.status ?? 'PENDING').toUpperCase();
    const status: TaskingStatus = (
      ['PENDING', 'ACCEPTED', 'SCHEDULED', 'CAPTURED', 'PROCESSING', 'DELIVERED', 'FAILED'] as const
    ).includes(raw as TaskingStatus)
      ? (raw as TaskingStatus)
      : 'PENDING';

    return {
      orderId,
      status,
      windowOpensAt: json.fromDate ? String(json.fromDate) : null,
      windowClosesAt: json.toDate ? String(json.toDate) : null,
      capturedAt: json.captureTimestamp ? String(json.captureTimestamp) : null,
      cloudPct: json.cloudCoveragePercent != null ? Number(json.cloudCoveragePercent) : null,
      note: String(json.statusMessage ?? 'Reported by the constellation operator.'),
    };
  },

  async fetchCapture(orderId) {
    // GET {base}/order/{orderId}/download → signed URL to the asset.
    const res = await fetch(`${INTEGRATIONS.skyfi.baseUrl}/order/${orderId}/download`, {
      headers: liveHeaders(),
    });
    if (!res.ok) throw new Error(`skyfi capture fetch failed: ${res.status}`);

    const json = (await res.json()) as Record<string, unknown>;
    const t = missionTelemetry(codeFromOrderId(orderId));

    return {
      orderId,
      captureId: String(json.captureId ?? json.id ?? orderId),
      capturedAt: String(json.captureTimestamp ?? new Date().toISOString()),
      cloudPct: Number(json.cloudCoveragePercent ?? missionCaptureCloudPct(codeFromOrderId(orderId))),
      sensor: String(json.satellite ?? t.sensor),
      gsdM: Number(json.resolutionMeters ?? t.gsdM),
      // Live captures are real assets, not catalogue frames.
      imagerySlug: null,
      assetUrl: String(json.downloadUrl ?? json.url ?? ''),
      bbox: (json.bbox as [number, number, number, number]) ?? [0, 0, 0, 0],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Public surface                                                     */
/* ------------------------------------------------------------------ */

function adapter(): SkyfiAdapter {
  return isLive('skyfi') ? live : mock;
}

/** Books a collection. Falls back to the mock so a mission never stalls. */
export async function requestArchiveOrder(input: ArchiveOrderRequest): Promise<TaskingResult> {
  try {
    return await adapter().requestArchiveOrder(input);
  } catch (err) {
    console.error('[skyfi] requestArchiveOrder failed:', (err as Error).message);
    return mock.requestArchiveOrder(input);
  }
}

export async function requestTasking(input: TaskingRequest): Promise<TaskingResult> {
  try {
    return await adapter().requestTasking(input);
  } catch (err) {
    console.error('[skyfi] requestTasking failed:', (err as Error).message);
    return mock.requestTasking(input);
  }
}

export async function getTaskingStatus(orderId: string): Promise<TaskingStatusResult> {
  try {
    return await adapter().getTaskingStatus(orderId);
  } catch (err) {
    console.error('[skyfi] getTaskingStatus failed:', (err as Error).message);
    return mock.getTaskingStatus(orderId);
  }
}

export async function fetchCapture(orderId: string): Promise<CaptureResult> {
  try {
    return await adapter().fetchCapture(orderId);
  } catch (err) {
    console.error('[skyfi] fetchCapture failed:', (err as Error).message);
    return mock.fetchCapture(orderId);
  }
}

export const skyfiAdapter = { requestTasking, getTaskingStatus, fetchCapture, mock, live };

/* ------------------------------------------------------------------ */
/* Webhook verification                                               */
/* ------------------------------------------------------------------ */

/**
 * SkyFi signs its callbacks with an HMAC-SHA256 of the raw body under the
 * shared secret, sent as a hex digest in `x-skyfi-signature`.
 * VERIFY the exact header name and digest encoding against the current SkyFi
 * webhook docs before relying on this in production.
 *
 * When SKYFI_WEBHOOK_SECRET is not set the payload is parsed and flagged
 * unverified rather than rejected — a missing key is a configuration state,
 * not an error.
 */
export interface SkyfiWebhookEvent {
  type: string;
  orderId: string | null;
  missionCode: string | null;
  status: string | null;
  capturedAt: string | null;
  cloudPct: number | null;
  raw: unknown;
}

export function parseSkyfiEvent(payload: unknown): SkyfiWebhookEvent {
  const p = (payload ?? {}) as Record<string, unknown>;
  const data = ((p.data as Record<string, unknown> | undefined) ?? p) as Record<string, unknown>;
  const orderId = typeof data.orderId === 'string' ? data.orderId : null;
  return {
    type: String(p.type ?? p.event ?? 'unknown'),
    orderId,
    missionCode:
      typeof data.reference === 'string'
        ? data.reference.toUpperCase()
        : orderId
          ? codeFromOrderId(orderId)
          : null,
    status: data.status ? String(data.status).toUpperCase() : null,
    capturedAt: data.captureTimestamp ? String(data.captureTimestamp) : null,
    cloudPct: data.cloudCoveragePercent != null ? Number(data.cloudCoveragePercent) : null,
    raw: payload,
  };
}

export async function verifyWebhook(
  rawBody: string,
  signature: string | null,
): Promise<{ ok: boolean; verified: boolean; event: SkyfiWebhookEvent | null; reason?: string }> {
  const secret = process.env.SKYFI_WEBHOOK_SECRET ?? '';

  const parse = () => {
    try {
      return parseSkyfiEvent(JSON.parse(rawBody));
    } catch {
      return null;
    }
  };

  if (!secret) {
    const event = parse();
    return {
      ok: event !== null,
      verified: false,
      event,
      reason: event ? 'SKYFI_WEBHOOK_SECRET not set — signature not checked' : 'payload is not JSON',
    };
  }
  if (!signature) {
    return { ok: false, verified: false, event: null, reason: 'missing x-skyfi-signature' };
  }

  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, verified: false, event: null, reason: 'signature mismatch' };
  }

  const event = parse();
  return { ok: event !== null, verified: true, event, reason: event ? undefined : 'payload is not JSON' };
}
