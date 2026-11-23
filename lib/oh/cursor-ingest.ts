/**
 * Real-time cursor channel, server half (the /api/oh/cursor route).
 *
 * The browser half (createCursorChannel in lib/oh/live-cursor.ts) POSTs small batches of pointer
 * samples to the site itself. This module validates a batch strictly (exact keys, integer bounds,
 * route-character path, at most 64 samples), adds what only the server knows (the daily visitor
 * hash, the hashed Eyepup key, device and country, exactly as the edge observer computes them),
 * signs the body with OH_OBSERVER_SECRET and POSTs it to the console's /cursor-ingest endpoint.
 *
 * Humans only. Never throws; the returned promise never rejects. No IP, raw cookie, raw user agent,
 * element, text or form data ever leaves this module: a sample is a kind, a time and coordinates.
 */
import {
  classify,
  countryOf,
  cursorIngestUrl,
  dailyVisitor,
  eyepupDistinctId,
  eyepupKey,
  postSigned,
  ROUTE_PATH,
  safePath,
  shouldObserve,
  type Device,
  type RequestLike,
} from "@/lib/oh/edge-observer";
import { cursorPathDenied } from "@/lib/oh/live-cursor";

type Env = Readonly<Record<string, string | undefined>>;

/** Inbound limit, checked on the declared content-length before the body is read. */
export const CURSOR_MAX_BODY_BYTES = 8192;
/** Outbound limit. A maximal valid batch forwards at 4,576 B, so this never trims a real one. */
export const CURSOR_FORWARD_MAX_BYTES = 8192;
export const CURSOR_MAX_SAMPLES = 64;
export const SAMPLE_KINDS = ["move", "scroll", "touch", "touchend", "tap", "click", "hide", "show"] as const;
/**
 * Tab visibility kinds. Forwarded only with OH_CURSOR_VISIBILITY=on: a console that predates them
 * answers 422 to any batch holding one, so by default they are removed before the forward.
 */
export const VISIBILITY_KINDS = ["hide", "show"] as const;
export const BATCH_KEYS = ["v", "path", "vw", "vh", "dpr", "pointer", "epoch", "samples"] as const;
export const SAMPLE_KEYS = ["t", "k", "x", "y", "page_y"] as const;
/** Forward key order. `eyepup_key` is present only when the visitor has an Eyepup id. */
export const FORWARD_KEYS = ["v", "ts", "visitor", "eyepup_key", "device", "country", "path", "vw", "vh", "dpr", "pointer", "epoch", "samples"] as const;

export type CursorMode = "on" | "slow" | "off";

/** The back-off lever: OH_CURSOR_MODE, answered to the sender as `x-oh-cursor`. Anything else is `on`. */
export function cursorMode(env: Env): CursorMode {
  const raw = (env.OH_CURSOR_MODE ?? "").trim().toLowerCase();
  return raw === "slow" || raw === "off" ? raw : "on";
}

/**
 * The tab visibility switch: OH_CURSOR_VISIBILITY=on, set only once the console accepts the `hide`
 * and `show` sample kinds. Read by the layout at build time (the browser records them only then)
 * and by the route at runtime (otherwise it removes them before the forward). Anything else is off.
 */
export function cursorVisibilityEnabled(env: Env): boolean {
  return (env.OH_CURSOR_VISIBILITY ?? "").trim().toLowerCase() === "on";
}

const VISIBILITY: ReadonlySet<string> = new Set(VISIBILITY_KINDS);

/** The batch without its `hide` and `show` samples, or null when nothing else is left. */
function withoutVisibility(batch: CursorBatch): CursorBatch | null {
  const samples = batch.samples.filter((s) => !VISIBILITY.has(s.k));
  return samples.length === 0 ? null : { ...batch, samples };
}

/** Strict numeric bounds, shared in spirit with the clamps in the sender. */
export const BOUNDS = {
  t: [0, 60_000], // ms since the batch epoch
  xy: [0, 16_384], // viewport CSS px
  page_y: [0, 1_000_000], // scroll offset, CSS px
  viewport: [1, 16_384],
  dpr: [0.1, 10],
  epoch: [1_577_836_800_000, 4_102_444_800_000], // 2020-01-01 to 2100-01-01 (client clocks drift; ts is the server's)
} as const;

export type SampleKind = (typeof SAMPLE_KINDS)[number];
export type CursorSample = { t: number; k: SampleKind; x: number; y: number; page_y: number };
export type CursorBatch = {
  v: 1;
  path: string;
  vw: number;
  vh: number;
  dpr: number;
  pointer: "fine" | "coarse";
  epoch: number;
  samples: CursorSample[];
};
export type CursorForward = {
  v: 1;
  ts: string;
  visitor: string;
  eyepup_key?: string;
  device: Device;
  country: string | null;
  path: string;
  vw: number;
  vh: number;
  dpr: number;
  pointer: "fine" | "coarse";
  epoch: number;
  samples: CursorSample[];
};

const KINDS: ReadonlySet<string> = new Set(SAMPLE_KINDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Exactly these own keys, no more and no fewer. */
function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function intIn(value: unknown, [lo, hi]: readonly [number, number]): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= lo && value <= hi;
}

function sample(value: unknown): CursorSample | null {
  if (!isRecord(value) || !hasExactKeys(value, SAMPLE_KEYS)) return null;
  const { t, k, x, y, page_y } = value;
  if (typeof k !== "string" || !KINDS.has(k)) return null;
  if (!intIn(t, BOUNDS.t) || !intIn(x, BOUNDS.xy) || !intIn(y, BOUNDS.xy) || !intIn(page_y, BOUNDS.page_y)) return null;
  return { t, k: k as SampleKind, x, y, page_y };
}

/**
 * A batch, rebuilt key by key from validated values, or null when anything is off. The sender's
 * redaction marker "/(redacted)" is accepted as a path; any other path must be made of route
 * characters, and paths carrying a long number are redacted the same way the edge observer does.
 * A batch for an excluded page (cursorPathDenied) is dropped.
 */
export function parseCursorBatch(value: unknown): CursorBatch | null {
  if (!isRecord(value) || !hasExactKeys(value, BATCH_KEYS)) return null;
  const { v, path, vw, vh, dpr, pointer, epoch, samples } = value;
  if (v !== 1) return null;
  if (typeof path !== "string") return null;
  if (path !== "/(redacted)" && (!ROUTE_PATH.test(path) || path.startsWith("//") || !shouldObserve(path, "human"))) return null;
  if (cursorPathDenied(path)) return null; // excluded pages: the sender sends nothing there, so this is forged
  if (!intIn(vw, BOUNDS.viewport) || !intIn(vh, BOUNDS.viewport)) return null;
  if (typeof dpr !== "number" || !Number.isFinite(dpr) || dpr < BOUNDS.dpr[0] || dpr > BOUNDS.dpr[1]) return null;
  if (Math.abs(Math.round(dpr * 10) - dpr * 10) > 1e-6) return null; // one decimal
  if (pointer !== "fine" && pointer !== "coarse") return null;
  if (!intIn(epoch, BOUNDS.epoch)) return null;
  if (!Array.isArray(samples) || samples.length < 1 || samples.length > CURSOR_MAX_SAMPLES) return null;
  const clean: CursorSample[] = [];
  for (const raw of samples) {
    const s = sample(raw);
    if (!s) return null;
    clean.push(s);
  }
  return { v: 1, path: safePath(path), vw, vh, dpr: Math.round(dpr * 10) / 10, pointer, epoch, samples: clean };
}

/**
 * Validates one batch from a browser and returns the pending signed POST to the console, or null
 * when there is nothing to send (channel off, OH_CURSOR_MODE=off, not a human, malformed or denied batch,
 * or only `hide`/`show` samples while OH_CURSOR_VISIBILITY is off). Never rejects. Hand it to after().
 */
export function observeCursor(headers: RequestLike["headers"], env: Env, body: unknown, now: Date = new Date()): Promise<void> | null {
  try {
    const url = cursorIngestUrl(env);
    const secret = env.OH_OBSERVER_SECRET;
    if (!url || !secret || cursorMode(env) === "off") return null;
    const who = classify(headers);
    if (who.actor_class !== "human") return null;
    const parsed = parseCursorBatch(body);
    const batch = parsed && (cursorVisibilityEnabled(env) ? parsed : withoutVisibility(parsed));
    if (!batch) return null;
    return forward(url, secret, headers, who.device, batch, now);
  } catch {
    return null;
  }
}

async function forward(url: string, secret: string, headers: RequestLike["headers"], device: Device, batch: CursorBatch, now: Date): Promise<void> {
  try {
    const ts = now.toISOString();
    const country = countryOf(headers);
    const visitor = await dailyVisitor(headers, country, ts);
    const analyticsId = eyepupDistinctId(headers.get("cookie"));
    const key = analyticsId ? await eyepupKey(secret, analyticsId) : null;
    const payload: CursorForward = {
      v: 1,
      ts,
      visitor,
      ...(key ? { eyepup_key: key } : {}),
      device,
      country,
      path: batch.path,
      vw: batch.vw,
      vh: batch.vh,
      dpr: batch.dpr,
      pointer: batch.pointer,
      epoch: batch.epoch,
      samples: batch.samples,
    };
    await postSigned(url, secret, JSON.stringify(payload), CURSOR_FORWARD_MAX_BYTES);
  } catch {
    // Fire-and-forget: a slow, failing or unreachable console is never the visitor's problem.
  }
}
