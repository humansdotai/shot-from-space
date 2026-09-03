/**
 * GET /api/pricing?currency=USD|EUR&lat=&lon=&area=&tier=&formatId=&frame=
 *   → { currency, detectedCountry, geoCurrency, margin, fx, rates,
 *       table, quote, formats }
 *
 * THE real-time price surface. Every number is cost + 10 %:
 *   · `rates`  — SkyFi's live price book for this target (tasking $/km²
 *                and minimum; cheapest priced archive scene).
 *   · `table`  — every tier × size × finish, minor units, in `currency`.
 *                The mission flow installs it and prices from it.
 *   · `quote`  — the breakdown for the selected configuration (imagery,
 *                print, margin, total).
 *   · `formats`— the live Gelato print cost per size/finish beside the
 *                retail the model derives from it.
 *   · `geoCurrency` — the best currency for the visitor, from the Vercel
 *                edge IP-country header.
 */
import { NextRequest, NextResponse } from 'next/server';
import { FORMATS, currencyForRegion, priceMinor, regionForCountry } from '@/lib/pricing';
import { gelatoPrice } from '@/lib/integrations/gelato-pricing';
import { MARGIN, livePriceTable, livePrintTable, liveQuote, skyfiRates, usdToEur } from '@/lib/pricing-live';
import type { PricingTier } from '@/lib/pricing-model';
import type { Currency, FormatId, FrameOption } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const FRAMES: FrameOption[] = ['UNFRAMED', 'FRAMED'];
const TIERS: PricingTier[] = ['ARCHIVE', 'COMMISSION', 'COMMISSION_LARGE_FORMAT'];

function currencyFromGeo(country: string | null): Currency {
  if (!country) return 'EUR';
  return currencyForRegion(regionForCountry(country));
}

function num(v: string | null): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const detectedCountry = req.headers.get('x-vercel-ip-country') || q.get('country') || null;
  const geoCurrency = currencyFromGeo(detectedCountry);

  const requested = q.get('currency');
  const currency: Currency = requested === 'USD' || requested === 'EUR' ? requested : geoCurrency;

  const lat = num(q.get('lat'));
  const lon = num(q.get('lon'));
  const areaRaw = num(q.get('area'));
  const areaKm = areaRaw ? Math.min(5, Math.max(0.4, areaRaw)) : undefined;
  const archiveId = q.get('archiveId')?.trim() || null;
  const target = { lat, lon, areaKm, archiveId };

  const tierRaw = q.get('tier');
  const tier: PricingTier = TIERS.includes(tierRaw as PricingTier) ? (tierRaw as PricingTier) : 'COMMISSION';
  const formatRaw = q.get('formatId');
  const formatId: FormatId = formatRaw === 'F30' || formatRaw === 'F70' ? formatRaw : 'F50';
  const frame: FrameOption = q.get('frame') === 'FRAMED' ? 'FRAMED' : 'UNFRAMED';

  const [rates, fx, table, printTable, quote, formats] = await Promise.all([
    skyfiRates(lat, lon, areaKm),
    usdToEur(),
    livePriceTable(currency, target),
    livePrintTable(currency),
    liveQuote(tier, formatId, frame, currency, target),
    Promise.all(
      FORMATS.map(async (f) => {
        const frames = await Promise.all(
          FRAMES.map(async (fr) => {
            const live = await gelatoPrice(f.id as FormatId, fr, currency);
            return {
              frame: fr,
              retailMinor: priceMinor(f.id as FormatId, fr, currency),
              gelatoPrintCost: live.printCost,
              productUid: live.productUid,
            };
          }),
        );
        return { id: f.id, designation: f.designation, metric: f.metric, imperial: f.imperial, ratio: f.ratio, frames };
      }),
    ),
  ]);

  return NextResponse.json(
    { currency, detectedCountry, geoCurrency, margin: MARGIN, fx: { usdToEur: fx }, rates, table, printTable, quote, formats },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}
