'use client';

import { useEffect, useState } from 'react';
import { currencyForRegion, formatPrice, priceMinor, regionForCountry } from '@/lib/pricing';
import type { Currency, PrintFormat } from '@/lib/types';

/**
 * ONE FORMAT'S MONEY.
 *
 * ------------------------------------------------------------------
 * ONE PRICE LEADS, THE OTHER THREE SUPPORT IT
 * ------------------------------------------------------------------
 * A format carries four numbers — two finishes × two currencies — and the
 * old band printed all four at one weight, which is why the section read as
 * a ledger. Here the unframed price in the reader's own currency is the
 * figure at display size, because it is the number that makes the three
 * formats comparable down the row. The framed price is the choice *inside*
 * that size and is set one step down. The other currency is a footnote on
 * each, in label type: present, checkable, never competing.
 *
 * ------------------------------------------------------------------
 * WHICH CURRENCY IS "THE READER'S"
 * ------------------------------------------------------------------
 * The charge follows the country of the TARGET address, which the landing
 * page does not know — only `quoteFor` in the purchase flow does, and it
 * resolves it through the same `regionForCountry` / `currencyForRegion` pair
 * used here. So this makes a guess from the browser's own locale and says so
 * in the band: both figures are on screen, and the second is not hidden.
 *
 * The guess is made after mount, never during render, so the server and the
 * first client pass agree. Before it lands, and whenever the locale carries
 * no region, the page quotes dollars — which is exactly what `quoteFor` does
 * before a target is locked.
 */

/** What the server renders, and what an unknown locale falls back to. */
const DEFAULT_CURRENCY: Currency = 'USD';

/** The currency the browser's own locale implies, or null if it implies none. */
function localeCurrency(): Currency | null {
  if (typeof navigator === 'undefined') return null;
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    if (!tag) continue;
    try {
      const locale = new Intl.Locale(tag);
      const region = locale.maximize().region ?? locale.region;
      if (region) return currencyForRegion(regionForCountry(region));
    } catch {
      // An unparseable language tag is not a reason to fail a price.
    }
  }
  return null;
}

export function useReaderCurrency(): Currency {
  const [currency, setCurrency] = useState<Currency>(DEFAULT_CURRENCY);

  useEffect(() => {
    const found = localeCurrency();
    if (found) setCurrency(found);
  }, []);

  return currency;
}

export function FormatPrice({ format }: { format: PrintFormat }) {
  const currency = useReaderCurrency();
  const alternate: Currency = currency === 'EUR' ? 'USD' : 'EUR';

  const at = (frame: 'UNFRAMED' | 'FRAMED', c: Currency) =>
    formatPrice(priceMinor(format.id, frame, c), c);

  return (
    <div className="border-t rule-ground pt-5">
      <p className="text-label uppercase ink-faint">Unframed</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span data-telemetry className="text-display ink">
          {at('UNFRAMED', currency)}
        </span>
        <span data-telemetry className="text-label ink-faint">
          {at('UNFRAMED', alternate)}
        </span>
      </p>

      {/* The finish, inside the size it belongs to, rather than as a
          seventh row of an unrelated list. */}
      <p className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t rule-ground pt-4">
        <span className="text-label uppercase ink-faint">Framed</span>
        <span className="flex items-baseline gap-2">
          <span data-telemetry className="text-action ink">
            {at('FRAMED', currency)}
          </span>
          <span data-telemetry className="text-label ink-faint">
            {at('FRAMED', alternate)}
          </span>
        </span>
      </p>
    </div>
  );
}
