/**
 * GET /api/pricing?currency=USD|EUR
 *   → { currency, detectedCountry, geoCurrency, formats: [...] }
 *
 * Real-time pricing surface:
 *   · `geoCurrency` is the best currency for the visitor, from the Vercel
 *     edge IP-country header — the "geolocate to find the best" default.
 *   · each format carries the LIVE Gelato print cost (both frames) from the
 *     catalogue API, next to the site's retail, so the numbers shown are
 *     grounded in the API and not a guess.
 */
import { NextRequest, NextResponse } from 'next/server';
import { FORMATS, currencyForRegion, priceMinor, regionForCountry } from '@/lib/pricing';
import { gelatoPrice } from '@/lib/integrations/gelato-pricing';
import type { Currency, FormatId, FrameOption } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FRAMES: FrameOption[] = ['UNFRAMED', 'FRAMED'];

function currencyFromGeo(country: string | null): Currency {
  if (!country) return 'EUR';
  return currencyForRegion(regionForCountry(country));
}

export async function GET(req: NextRequest) {
  const detectedCountry =
    req.headers.get('x-vercel-ip-country') ||
    req.nextUrl.searchParams.get('country') ||
    null;
  const geoCurrency = currencyFromGeo(detectedCountry);

  const requested = req.nextUrl.searchParams.get('currency');
  const currency: Currency = requested === 'USD' || requested === 'EUR' ? requested : geoCurrency;

  const formats = await Promise.all(
    FORMATS.map(async (f) => {
      const frames = await Promise.all(
        FRAMES.map(async (fr) => {
          const live = await gelatoPrice(f.id as FormatId, fr, currency);
          return {
            frame: fr,
            retailMinor: priceMinor(f.id as FormatId, fr, currency),
            gelatoPrintCost: live.printCost, // real, live, major units — null if unavailable
            productUid: live.productUid,
          };
        }),
      );
      return {
        id: f.id,
        designation: f.designation,
        metric: f.metric,
        imperial: f.imperial,
        ratio: f.ratio,
        frames,
      };
    }),
  );

  return NextResponse.json(
    { currency, detectedCountry, geoCurrency, formats },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}
