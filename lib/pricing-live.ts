/**
 * ==================================================================
 * LIVE PRICING — the model in lib/pricing-model.ts with LIVE rates
 * ==================================================================
 *   · SkyFi (USD): POST /platform-api/pricing for the DAY tasking price
 *     book (VERY HIGH $/km² + 25 km² minimum) and POST /archives for the
 *     cheapest priced high-res scene over the target. Cached per target.
 *   · Gelato: the real catalogue print cost in the buyer's currency
 *     (lib/integrations/gelato-pricing.ts, cached 1 h).
 *   · FX: ECB USD→EUR via api.frankfurter.dev, cached 1 h.
 *
 * Every fetch degrades to the measured fallback so a quote is always
 * produced; nothing here throws. The order route charges `liveQuote()`.
 * ==================================================================
 */
import { INTEGRATIONS } from '@/lib/env';
import { gelatoPrice } from '@/lib/integrations/gelato-pricing';
import {
  DEFAULT_AREA_KM,
  FALLBACK_RATES,
  FALLBACK_USD_EUR,
  PRINT_FALLBACK,
  bestArchiveScene,
  imageryUsd,
  quoteFromParts,
  type ArchiveScene,
  type ImageryRates,
  type PriceTable,
  type PricingTier,
  type QuoteBreakdown,
} from '@/lib/pricing-model';
import type { Currency, FormatId, FrameOption } from '@/lib/types';

export { MARGIN } from '@/lib/pricing-model';

const TTL_MS = 60 * 60 * 1000;

/* ---------------- FX ---------------- */
let fxCache: { rate: number; at: number } | null = null;
let fxInflight: Promise<number> | null = null;

export async function usdToEur(): Promise<number> {
  if (fxCache && Date.now() - fxCache.at < TTL_MS) return fxCache.rate;
  // One fetch per cold cache, however many quotes ask at once.
  if (!fxInflight) {
    fxInflight = fetchUsdToEur().finally(() => {
      fxInflight = null;
    });
  }
  return fxInflight;
}

async function fetchUsdToEur(): Promise<number> {
  for (const url of [
    'https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR',
    'https://open.er-api.com/v6/latest/USD',
  ]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
      const j = (await res.json()) as { rates?: { EUR?: number } };
      const rate = j?.rates?.EUR;
      if (typeof rate === 'number' && rate > 0.5 && rate < 1.5) {
        fxCache = { rate, at: Date.now() };
        return rate;
      }
    } catch {
      /* next source */
    }
  }
  return fxCache?.rate ?? FALLBACK_USD_EUR;
}

/* ---------------- SkyFi ---------------- */
const skyfiCache = new Map<string, { v: ImageryRates; at: number }>();
const skyfiInflight = new Map<string, Promise<ImageryRates>>();

function wktSquare(lat: number, lon: number, areaKm: number): string {
  const dLat = areaKm / 2 / 111.32;
  const dLon = areaKm / 2 / (111.32 * Math.cos((lat * Math.PI) / 180));
  const p = (x: number, y: number) => `${x.toFixed(6)} ${y.toFixed(6)}`;
  return `POLYGON ((${p(lon - dLon, lat - dLat)}, ${p(lon + dLon, lat - dLat)}, ${p(lon + dLon, lat + dLat)}, ${p(lon - dLon, lat + dLat)}, ${p(lon - dLon, lat - dLat)}))`;
}

export async function skyfiRates(lat?: number, lon?: number, areaKm = DEFAULT_AREA_KM): Promise<ImageryRates> {
  const key = lat != null && lon != null ? `${lat.toFixed(2)},${lon.toFixed(2)}` : 'default';
  const hit = skyfiCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v;
  // A price table asks for the same target 18 times at once; SkyFi is asked once.
  let inflight = skyfiInflight.get(key);
  if (!inflight) {
    inflight = fetchSkyfiRates(key, lat, lon, areaKm).finally(() => {
      skyfiInflight.delete(key);
    });
    skyfiInflight.set(key, inflight);
  }
  return inflight;
}

async function fetchSkyfiRates(key: string, lat?: number, lon?: number, areaKm = DEFAULT_AREA_KM): Promise<ImageryRates> {
  const apiKey = INTEGRATIONS.skyfi.apiKey;
  if (!apiKey) return FALLBACK_RATES;
  const base = INTEGRATIONS.skyfi.baseUrl;
  const headers = { 'X-Skyfi-Api-Key': apiKey, 'Content-Type': 'application/json' };
  const aoi = wktSquare(lat ?? 48.8584, lon ?? 2.2945, Math.max(areaKm, 1));
  const rates: ImageryRates = { ...FALLBACK_RATES };

  try {
    const res = await fetch(`${base}/pricing`, {
      method: 'POST', headers, body: JSON.stringify({ aoi }), signal: AbortSignal.timeout(8000), cache: 'no-store',
    });
    const d = (await res.json()) as {
      productTypes?: { productType: string; resolutions: { resolution: string; isSupported: boolean; pricing?: { taskingPriceOneSqkm?: number; taskingMinSqkm?: number } }[] }[];
    };
    const day = d.productTypes?.find((p) => p.productType === 'DAY');
    const pick =
      day?.resolutions?.find((r) => r.resolution === 'VERY HIGH' && r.isSupported && r.pricing?.taskingPriceOneSqkm) ??
      day?.resolutions?.find((r) => r.resolution === 'HIGH' && r.isSupported && r.pricing?.taskingPriceOneSqkm);
    if (pick?.pricing?.taskingPriceOneSqkm) {
      rates.taskingPerKm2 = pick.pricing.taskingPriceOneSqkm;
      rates.taskingMinKm2 = pick.pricing.taskingMinSqkm ?? 25;
      rates.taskingResolution = pick.resolution;
      rates.source = 'skyfi';
    }
  } catch {
    /* keep fallback */
  }

  try {
    const to = new Date();
    const from = new Date(to.getTime() - 3 * 365 * 86_400_000);
    const res = await fetch(`${base}/archives`, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ aoi, fromDate: from.toISOString(), toDate: to.toISOString(), productTypes: ['DAY'], pageSize: 40 }),
      signal: AbortSignal.timeout(8000),
    });
    const d = (await res.json()) as { archives?: { provider?: string; resolution?: string; priceForOneSquareKm?: number; minSqKm?: number }[] };
    // Keep every priced scene (one per provider × resolution, cheapest); the
    // quote picks the lowest BILLED total for the actual footprint, ≈0.5 m
    // preferred over ≈1 m (lib/pricing-model.ts → bestArchiveScene).
    const seen = new Map<string, ArchiveScene>();
    for (const a of d.archives ?? []) {
      if (!(a.priceForOneSquareKm && a.priceForOneSquareKm > 0)) continue;
      const scene: ArchiveScene = {
        provider: a.provider ?? 'SKYFI',
        resolution: a.resolution ?? 'HIGH',
        perKm2: a.priceForOneSquareKm,
        minKm2: a.minSqKm ?? 1,
      };
      const k = `${scene.provider}/${scene.resolution}`;
      const prev = seen.get(k);
      if (!prev || scene.perKm2 * Math.max(1, scene.minKm2) < prev.perKm2 * Math.max(1, prev.minKm2)) seen.set(k, scene);
    }
    if (seen.size > 0) {
      rates.archiveScenes = [...seen.values()];
      const best = bestArchiveScene(rates.archiveScenes, Math.max(areaKm, 1) ** 2);
      if (best) {
        rates.archivePerKm2 = best.perKm2;
        rates.archiveMinKm2 = best.minKm2;
        rates.archiveProvider = `${best.provider} ${best.resolution}`;
      }
      rates.source = 'skyfi';
    }
  } catch {
    /* keep fallback */
  }

  skyfiCache.set(key, { v: rates, at: Date.now() });
  return rates;
}

/* ---------------- The quote ---------------- */
export interface LiveQuote extends QuoteBreakdown {
  tier: PricingTier;
  areaKm: number;
  imageryUsd: number;
  imageryNote: string;
  printLive: boolean;
  fxUsdEur: number;
  ratesSource: ImageryRates['source'];
}

export interface QuoteTarget { areaKm?: number; lat?: number; lon?: number }

export async function liveQuote(
  tier: PricingTier,
  formatId: FormatId,
  frame: FrameOption,
  currency: Currency,
  opts: QuoteTarget = {},
): Promise<LiveQuote> {
  const areaKm = opts.areaKm ?? DEFAULT_AREA_KM;
  const [rates, gelato, fx] = await Promise.all([
    skyfiRates(opts.lat, opts.lon, areaKm),
    gelatoPrice(formatId, frame, currency),
    usdToEur(),
  ]);
  const img = imageryUsd(tier, rates, areaKm);
  const print = gelato.printCost ?? PRINT_FALLBACK[formatId][frame][currency];
  const q = quoteFromParts({ imageryUsd: img.usd, print, currency, usdToEur: fx });
  return {
    ...q, tier, areaKm,
    imageryUsd: Math.round(img.usd * 100) / 100,
    imageryNote: img.note,
    printLive: gelato.printCost !== null,
    fxUsdEur: fx,
    ratesSource: rates.source,
  };
}

const TIERS: PricingTier[] = ['ARCHIVE', 'COMMISSION', 'COMMISSION_LARGE_FORMAT'];
const FORMAT_IDS: FormatId[] = ['F30', 'F50', 'F70'];
const FRAMES: FrameOption[] = ['UNFRAMED', 'FRAMED'];

/** Every tier × size × finish at live rates, for the browser's price table. */
export async function livePriceTable(currency: Currency, opts: QuoteTarget = {}): Promise<PriceTable> {
  const table = {} as PriceTable;
  await Promise.all(
    TIERS.map(async (tier) => {
      table[tier] = {} as PriceTable[PricingTier];
      await Promise.all(
        FORMAT_IDS.map(async (f) => {
          table[tier][f] = {} as Record<FrameOption, number>;
          await Promise.all(
            FRAMES.map(async (fr) => {
              table[tier][f][fr] = (await liveQuote(tier, f, fr, currency, opts)).totalMinor;
            }),
          );
        }),
      );
    }),
  );
  return table;
}
