/**
 * ==================================================================
 * THE PRICE MODEL — cost + 10 %, nothing hand-set
 * ==================================================================
 *   price = ( SkyFi imagery cost  +  Gelato print cost ) × (1 + MARGIN)
 *
 * This file is the SYNCHRONOUS, dependency-free form of the model, so the
 * browser, the landing page and the config self-check can all price a
 * configuration without a network call. It carries the last MEASURED rates
 * (SkyFi price book + Gelato catalogue + ECB, 2026-09-03) as fallbacks.
 *
 * `lib/pricing-live.ts` runs the same arithmetic with LIVE rates fetched
 * from SkyFi, Gelato and the ECB, and is what the order route charges.
 * The two must never diverge in shape — they share `quoteFromParts()`.
 * ==================================================================
 */
import type { Currency, FormatId, FrameOption } from '@/lib/types';

export type PricingTier = 'ARCHIVE' | 'COMMISSION' | 'COMMISSION_LARGE_FORMAT';

/** Ten percent over real cost. The one business number in the product. */
export const MARGIN = 0.1;

/** Footprint the mission flow captures (km per side). See mission-flow/capture.ts. */
export const DEFAULT_AREA_KM = 2;

export interface ArchiveScene {
  provider: string;
  resolution: string;
  perKm2: number;
  minKm2: number;
}

export interface ImageryRates {
  /** $/km² for a fresh VERY HIGH (≈0.5 m) DAY tasking, and SkyFi's minimum. */
  taskingPerKm2: number;
  taskingMinKm2: number;
  taskingResolution: string;
  /** Cheapest priced high-res archive scene over the target at the default footprint (display). */
  archivePerKm2: number;
  archiveMinKm2: number;
  archiveProvider: string;
  /**
   * Every priced archive scene over the target. The quote picks the one with
   * the lowest BILLED total for the actual footprint — a $8/km² scene with a
   * 25 km² minimum loses to a $15/km² scene sold by the km² for a 4 km² frame.
   */
  archiveScenes: ArchiveScene[];
  source: 'skyfi' | 'fallback';
}

/** SkyFi price book, measured live 2026-09-03 over Paris. */
export const FALLBACK_RATES: ImageryRates = {
  taskingPerKm2: 12,
  taskingMinKm2: 25,
  taskingResolution: 'VERY HIGH',
  archivePerKm2: 15,
  archiveMinKm2: 1,
  archiveProvider: 'VANTOR VERY HIGH',
  archiveScenes: [
    { provider: 'VANTOR', resolution: 'SUPER HIGH', perKm2: 24, minKm2: 1 },
    { provider: 'VANTOR', resolution: 'VERY HIGH', perKm2: 15, minKm2: 1 },
    { provider: 'PLANET', resolution: 'VERY HIGH', perKm2: 8, minKm2: 25 },
    { provider: 'SATELLOGIC', resolution: 'HIGH', perKm2: 5, minKm2: 5 },
  ],
  source: 'fallback',
};

const SHARP = new Set(['SUPER HIGH', 'VERY HIGH']);

/** The archive scene with the lowest billed total for a footprint; ≈0.5 m preferred over ≈1 m. */
export function bestArchiveScene(scenes: ArchiveScene[], footprintKm2: number): ArchiveScene | null {
  const billed = (x: ArchiveScene) => x.perKm2 * Math.max(footprintKm2, x.minKm2);
  const pick = (xs: ArchiveScene[]) => xs.slice().sort((a, b) => billed(a) - billed(b))[0] ?? null;
  return pick(scenes.filter((x) => SHARP.has(x.resolution))) ?? pick(scenes);
}

/** ECB USD→EUR, 2026-09-03. */
export const FALLBACK_USD_EUR = 0.8637;

/** Gelato catalogue print cost (major units), measured 2026-09-03. */
export const PRINT_FALLBACK: Record<FormatId, Record<FrameOption, Record<Currency, number>>> = {
  F30: { UNFRAMED: { USD: 7.08, EUR: 7.99 }, FRAMED: { USD: 25.9, EUR: 21.63 } },
  F50: { UNFRAMED: { USD: 12.49, EUR: 10.29 }, FRAMED: { USD: 58.66, EUR: 39.98 } },
  F70: { UNFRAMED: { USD: 16.11, EUR: 14.09 }, FRAMED: { USD: 95.0, EUR: 68.61 } },
};

/** SkyFi cost in USD for one tier over a square footprint of `areaKm` per side. */
export function imageryUsd(tier: PricingTier, rates: ImageryRates, areaKm: number) {
  const footprint = areaKm * areaKm;
  if (tier === 'ARCHIVE') {
    const scene = bestArchiveScene(rates.archiveScenes, footprint) ?? {
      provider: rates.archiveProvider,
      resolution: '',
      perKm2: rates.archivePerKm2,
      minKm2: rates.archiveMinKm2,
    };
    const billed = Math.max(footprint, scene.minKm2);
    return {
      usd: scene.perKm2 * billed,
      billedKm2: billed,
      note: `${scene.provider} ${scene.resolution} archive scene · $${scene.perKm2}/km² × ${trim(billed)} km²`.replace('  ', ' '),
    };
  }
  const billed = Math.max(footprint, rates.taskingMinKm2);
  return {
    usd: rates.taskingPerKm2 * billed,
    billedKm2: billed,
    note: `fresh ${rates.taskingResolution} tasking · $${rates.taskingPerKm2}/km² × ${trim(billed)} km² (SkyFi minimum ${rates.taskingMinKm2} km²)`,
  };
}

export interface QuoteParts {
  imageryUsd: number;
  /** Real print cost in the quote currency, major units. */
  print: number;
  currency: Currency;
  usdToEur: number;
}

export interface QuoteBreakdown {
  currency: Currency;
  imagery: number;
  print: number;
  subtotal: number;
  margin: number;
  total: number;
  totalMinor: number;
}

export function quoteFromParts(p: QuoteParts): QuoteBreakdown {
  const imagery = p.currency === 'EUR' ? p.imageryUsd * p.usdToEur : p.imageryUsd;
  const subtotal = imagery + p.print;
  const margin = subtotal * MARGIN;
  const total = subtotal + margin;
  return {
    currency: p.currency,
    imagery: round2(imagery),
    print: round2(p.print),
    subtotal: round2(subtotal),
    margin: round2(margin),
    total: round2(total),
    totalMinor: Math.round(total * 100),
  };
}

/** The model at the last measured rates. Minor units. */
export function fallbackTierPriceMinor(
  tier: PricingTier,
  formatId: FormatId,
  frame: FrameOption,
  currency: Currency,
  areaKm: number = DEFAULT_AREA_KM,
): number {
  return quoteFromParts({
    imageryUsd: imageryUsd(tier, FALLBACK_RATES, areaKm).usd,
    print: PRINT_FALLBACK[formatId][frame][currency],
    currency,
    usdToEur: FALLBACK_USD_EUR,
  }).totalMinor;
}

/** The breakdown /api/pricing returns for one configuration (client-safe). */
export interface QuoteView {
  tier: PricingTier;
  currency: Currency;
  imagery: number;
  print: number;
  margin: number;
  total: number;
  imageryNote: string;
}

/* ------------------------------------------------------------------ */
/* Live table — filled by the browser from /api/pricing                */
/* ------------------------------------------------------------------ */
export type PriceTable = Record<PricingTier, Record<FormatId, Record<FrameOption, number>>>;

let liveTable: { currency: Currency; table: PriceTable } | null = null;

/** Installed by the mission flow once /api/pricing answers for the target. */
export function setLivePriceTable(currency: Currency, table: PriceTable | null) {
  liveTable = table ? { currency, table } : null;
}

/** Live price if the browser has one for this currency, else the fallback model. */
export function tierPriceMinorLiveOrFallback(
  tier: PricingTier,
  formatId: FormatId,
  frame: FrameOption,
  currency: Currency,
): number {
  const live = liveTable?.currency === currency ? liveTable.table[tier]?.[formatId]?.[frame] : undefined;
  return typeof live === 'number' && live > 0 ? live : fallbackTierPriceMinor(tier, formatId, frame, currency);
}

export function hasLivePriceTable(currency: Currency): boolean {
  return liveTable?.currency === currency;
}

function round2(n: number) { return Math.round(n * 100) / 100; }
function trim(n: number) { return Number.isInteger(n) ? String(n) : n.toFixed(2); }
