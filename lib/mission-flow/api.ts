/**
 * /mission — the network layer.
 *
 * Every request the flow makes, in one file. Each helper resolves to a
 * value rather than throwing, so no screen has to catch: a failure is a
 * message the screen can print in mission voice.
 *
 * ORDER AND PAYMENT ARE NOT REIMPLEMENTED HERE. `createOrder` and
 * `completeMockCheckout` are imported from the existing purchase flow
 * (`components/purchase/api.ts`), which already speaks to `/api/orders`,
 * `lib/integrations/stripe.ts` and `/api/checkout/complete`. This flow
 * has a different set of screens, not a different payment path.
 */

import type { GeoSuggestion, TargetAddress } from '@/lib/types';
import {
  completeMockCheckout,
  createOrder,
  staticPreviewUrl,
} from '@/components/purchase/api';
import type { PassWindowResult } from './passes';
import type { OverheadResult } from './overhead';
import type { SceneInfo } from './scene';
import { REVEAL_PX } from './config';

export { completeMockCheckout, createOrder };

export type Result<T> = { ok: true; data: T } | { ok: false; message: string };

const OFFLINE = 'Uplink unavailable. Check the connection and retry.';

/** The reveal frame at one zoom level. Square: the footprint is square. */
export function revealFrameUrl(lat: number, lon: number, zoom: number): string {
  return staticPreviewUrl(lat, lon, zoom).replace(
    /w=\d+&h=\d+/,
    `w=${REVEAL_PX}&h=${REVEAL_PX}`,
  );
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<Result<T>> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      let detail = `Request failed (STATUS ${res.status}).`;
      try {
        const body = (await res.json()) as { detail?: string; error?: string };
        detail = body.detail ?? body.error ?? detail;
      } catch {
        /* non-JSON body — the status line is the message */
      }
      return { ok: false, message: detail };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    return { ok: false, message: OFFLINE };
  }
}

/** Screen 1 — what the archive frame actually is. */
export function fetchScene(lat: number, lon: number, signal?: AbortSignal) {
  return getJson<SceneInfo>(
    `/mission/scene?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`,
    signal,
  );
}

export interface FleetReading {
  tracked: number;
  source: 'live' | 'snapshot' | 'none';
  obtainedAt: string | null;
  usable: number;
  freshestAgeHours: number | null;
}

/** Screen 7, second step — the state of the published elements. */
export function fetchFleetReading(signal?: AbortSignal) {
  return getJson<FleetReading>('/mission/passes?op=fleet', signal);
}

/**
 * Screen 7, third step — WHICH tracked spacecraft cross the target's sky,
 * when, and how high.
 *
 * The same propagation `fetchWindows` runs, kept per satellite instead of
 * collapsed onto calendar days. It is what lets the Window and Review
 * sections show that a commission is a tasking rather than assert it.
 */
export function fetchOverhead(lat: number, lon: number, signal?: AbortSignal) {
  return getJson<OverheadResult>(
    `/mission/passes?op=overhead&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`,
    signal,
  );
}

/** Screen 7, first step — genuine SGP4 pass windows over the target. */
export function fetchWindows(lat: number, lon: number, signal?: AbortSignal) {
  return getJson<PassWindowResult>(
    `/mission/passes?op=windows&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`,
    signal,
  );
}

/* ------------------------------------------------------------------ */
/* Address                                                             */
/* ------------------------------------------------------------------ */

/**
 * Coordinates to postal detail, via the existing geocode adapter.
 *
 * `/api/orders` needs a street, a city, a postcode and a country and the
 * flow never asks for them — it is given coordinates. Resolving them is
 * therefore the flow's job, and it happens once, at checkout.
 *
 * A null suggestion is a legitimate answer (open water, a desert), which
 * is why the caller has a fallback rather than an error.
 */
export async function resolveAddress(lat: number, lon: number): Promise<GeoSuggestion | null> {
  try {
    const res = await fetch('/api/geocode/reverse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lat, lon }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { suggestion?: GeoSuggestion | null };
    return body.suggestion ?? null;
  } catch {
    return null;
  }
}

/** Screen 1 with no query parameters — the reader names the place instead. */
export async function suggestAddresses(q: string, signal?: AbortSignal): Promise<GeoSuggestion[]> {
  try {
    const res = await fetch('/api/geocode/autocomplete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q }),
      signal,
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { suggestions?: GeoSuggestion[] };
    return Array.isArray(body.suggestions) ? body.suggestions : [];
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    return [];
  }
}

/** A `GeoSuggestion` narrowed to the shape `/api/orders` validates. */
export function toTargetAddress(s: GeoSuggestion): TargetAddress {
  return {
    line1: s.line1,
    city: s.city,
    region: s.region,
    postalCode: s.postalCode,
    countryCode: s.countryCode,
    country: s.country,
    lat: s.lat,
    lon: s.lon,
  };
}
