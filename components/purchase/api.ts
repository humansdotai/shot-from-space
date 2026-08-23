/**
 * PURCHASE — network layer.
 *
 * Every request the purchase flow makes, in one file, with the exact shapes
 * from the build contract. Each helper resolves to a discriminated result so
 * the UI never has to catch: a failure is a value with a mission-voice
 * message, not an exception.
 *
 * Endpoints consumed (owned by Agent 8):
 *   POST /api/geocode/autocomplete  {q}                    → {suggestions}
 *   GET  /api/geocode/static?lat&lon&zoom&w&h              → image/jpeg
 *   POST /api/orders  {address, formatId, frame, email, areaKm, dedication}
 *                                                          → {missionCode, checkoutUrl}
 *   POST /api/checkout/complete     {missionCode}          → {ok, missionCode}
 */

import type { ApiError, FormatId, FrameOption, GeoSuggestion, TargetAddress } from '@/lib/types';
import type { AreaKm } from './state';

export type Result<T> = { ok: true; data: T } | { ok: false; message: string };

const OFFLINE = 'Uplink unavailable. Check the connection and retry.';

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiError;
    if (body?.detail) return String(body.detail);
    if (body?.error) return String(body.error);
  } catch {
    /* non-JSON body — fall through to the generic line */
  }
  return `${fallback} (STATUS ${res.status})`;
}

/* ------------------------------------------------------------------ */
/* 01. Target — address autocomplete                                   */
/* ------------------------------------------------------------------ */

export async function fetchSuggestions(
  q: string,
  signal?: AbortSignal,
): Promise<Result<GeoSuggestion[]>> {
  try {
    const res = await fetch('/api/geocode/autocomplete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q }),
      signal,
    });
    if (!res.ok) {
      return {
        ok: false,
        message: await readError(res, 'Address index did not respond.'),
      };
    }
    const body = (await res.json()) as { suggestions?: GeoSuggestion[] };
    return { ok: true, data: Array.isArray(body.suggestions) ? body.suggestions : [] };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    return { ok: false, message: OFFLINE };
  }
}

/* ------------------------------------------------------------------ */
/* 02. Capture area — deterministic preview frame                      */
/* ------------------------------------------------------------------ */

/** Preview frames are requested square: the footprint is N km × N km. */
export const PREVIEW_PX = 900;

export function staticPreviewUrl(lat: number, lon: number, zoom: number): string {
  const p = new URLSearchParams({
    lat: lat.toFixed(6),
    lon: lon.toFixed(6),
    zoom: String(zoom),
    w: String(PREVIEW_PX),
    h: String(PREVIEW_PX),
  });
  return `/api/geocode/static?${p.toString()}`;
}

/* ------------------------------------------------------------------ */
/* 04. Authorisation — order creation                                  */
/* ------------------------------------------------------------------ */

export interface CreateOrderInput {
  address: TargetAddress;
  /**
   * Purchase-flow tier, when the order came from /mission.
   *
   * The AMOUNT is deliberately absent from this contract and always will be:
   * the route prices the tier server-side. A browser that can name its own
   * price can name zero.
   */
  tier?: string;
  formatId: FormatId;
  frame: FrameOption;
  email: string;
  /** Capture footprint in km. Additive to the contract shape; recorded on the order. */
  areaKm: AreaKm;
  /**
   * The line printed at the foot of the mission sheet. Omitted rather than
   * sent empty — the route treats an absent dedication as "no line", and a
   * blank string would be sanitised to the same null one layer further in.
   */
  dedication?: string;
}

export interface CreateOrderResult {
  missionCode: string;
  checkoutUrl: string;
}

export async function createOrder(input: CreateOrderInput): Promise<Result<CreateOrderResult>> {
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      return { ok: false, message: await readError(res, 'Mission could not be opened.') };
    }
    const body = (await res.json()) as Partial<CreateOrderResult>;
    if (!body.missionCode) {
      return { ok: false, message: 'Mission opened without a code. Retry authorisation.' };
    }
    return {
      ok: true,
      data: {
        missionCode: body.missionCode,
        // The contract always returns a checkoutUrl; this keeps the flow moving
        // if a future provider omits it.
        checkoutUrl: body.checkoutUrl ?? `/checkout/mock/${body.missionCode}`,
      },
    };
  } catch {
    return { ok: false, message: OFFLINE };
  }
}

/* ------------------------------------------------------------------ */
/* Mock checkout — payment completion                                  */
/* ------------------------------------------------------------------ */

export async function completeMockCheckout(missionCode: string): Promise<Result<string>> {
  try {
    const res = await fetch('/api/checkout/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ missionCode }),
    });
    if (!res.ok) {
      return { ok: false, message: await readError(res, 'Authorisation was not accepted.') };
    }
    const body = (await res.json()) as { ok?: boolean; missionCode?: string };
    if (body.ok === false) {
      return { ok: false, message: 'Authorisation was declined by the processor.' };
    }
    return { ok: true, data: body.missionCode ?? missionCode };
  } catch {
    return { ok: false, message: OFFLINE };
  }
}
