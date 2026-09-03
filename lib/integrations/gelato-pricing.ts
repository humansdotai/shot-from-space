/**
 * ==================================================================
 * GELATO LIVE PRICING — the real print cost, from the catalogue API
 * ==================================================================
 * The retail numbers on the site (lib/pricing.ts FORMATS, config.ts
 * TIER_PRICE) are a hand-set price list — they are NOT the Gelato price.
 * This module fetches the ACTUAL print cost from Gelato's product-price API,
 * per format, frame and currency, so the site can show and reason about real
 * numbers instead of guessed ones.
 *
 *   GET https://product.gelatoapis.com/v3/products/{uid}/prices
 *       ?country={US|DE}&currency={USD|EUR}
 *
 * Cached in-process for an hour (prices move slowly and this endpoint is rate-
 * limited). Every failure degrades to `null`, never throws — pricing display
 * must not take a page down.
 * ==================================================================
 */
import { INTEGRATIONS } from '@/lib/env';
import { GELATO_PRODUCT_UID } from '@/lib/integrations/gelato';
import type { Currency, FormatId, FrameOption } from '@/lib/types';

const CATALOG_BASE = 'https://product.gelatoapis.com/v3';
const TTL_MS = 60 * 60 * 1000;

/** country + currency Gelato prices in for each of our two markets. */
const MARKET: Record<Currency, { country: string }> = {
  USD: { country: 'US' },
  EUR: { country: 'DE' },
};

export interface GelatoPrice {
  formatId: FormatId;
  frame: FrameOption;
  currency: Currency;
  /** Real Gelato print cost in MAJOR units (e.g. 12.49). null if unavailable. */
  printCost: number | null;
  productUid: string;
  fetchedAt: number;
}

const cache = new Map<string, GelatoPrice>();

function key(f: FormatId, fr: FrameOption, c: Currency) {
  return `${f}:${fr}:${c}`;
}

async function fetchOne(
  formatId: FormatId,
  frame: FrameOption,
  currency: Currency,
): Promise<GelatoPrice> {
  const productUid = GELATO_PRODUCT_UID[formatId][frame];
  const apiKey = INTEGRATIONS.gelato.apiKey;
  const base: GelatoPrice = {
    formatId,
    frame,
    currency,
    printCost: null,
    productUid,
    fetchedAt: Date.now(),
  };
  if (!apiKey) return base;

  const { country } = MARKET[currency];
  const url = `${CATALOG_BASE}/products/${encodeURIComponent(
    productUid,
  )}/prices?country=${country}&currency=${currency}&pageCount=1`;
  try {
    const res = await fetch(url, {
      headers: { 'X-API-KEY': apiKey },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return base;
    const data = (await res.json().catch(() => null)) as unknown;
    const arr = Array.isArray(data)
      ? data
      : ((data as { data?: unknown[] })?.data ?? []);
    const first = arr[0] as { price?: number } | undefined;
    if (first && typeof first.price === 'number') {
      return { ...base, printCost: Math.round(first.price * 100) / 100 };
    }
    return base;
  } catch {
    return base;
  }
}

/** Live Gelato print cost for one spec, cached for an hour. */
export async function gelatoPrice(
  formatId: FormatId,
  frame: FrameOption,
  currency: Currency,
): Promise<GelatoPrice> {
  const k = key(formatId, frame, currency);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit;
  const fresh = await fetchOne(formatId, frame, currency);
  cache.set(k, fresh);
  return fresh;
}

/** Every price in one currency (used by /api/pricing). */
export async function gelatoPriceTable(
  currency: Currency,
  formats: FormatId[],
  frames: FrameOption[] = ['UNFRAMED', 'FRAMED'],
): Promise<GelatoPrice[]> {
  const jobs: Promise<GelatoPrice>[] = [];
  for (const f of formats) for (const fr of frames) jobs.push(gelatoPrice(f, fr, currency));
  return Promise.all(jobs);
}
