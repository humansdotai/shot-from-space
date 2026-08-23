import { test, expect } from '@playwright/test';
import {
  FORMATS,
  FULFILMENT_NOTE,
  PRINT_FACILITY,
  currencyForRegion,
  formatPrice,
  getFormat,
  priceMinor,
  regionForCountry,
} from '@/lib/pricing';
import { quoteFor, DEFAULT_DRAFT } from '@/components/purchase/state';
import type { Currency, FormatId, FrameOption, Region, TargetAddress } from '@/lib/types';

/**
 * PRICING — the catalogue, region resolution, and the promise that the
 * number on screen is the number charged.
 */

const FORMAT_IDS: FormatId[] = ['F30', 'F50', 'F70'];
const FRAMES: FrameOption[] = ['UNFRAMED', 'FRAMED'];
const CURRENCIES: Currency[] = ['USD', 'EUR'];

/** The catalogue, restated. A silent price change has to fail this table. */
const EXPECTED: Record<FormatId, Record<Currency, Record<FrameOption, number>>> = {
  F30: { USD: { UNFRAMED: 18000, FRAMED: 26000 }, EUR: { UNFRAMED: 17000, FRAMED: 24000 } },
  F50: { USD: { UNFRAMED: 28000, FRAMED: 42000 }, EUR: { UNFRAMED: 26000, FRAMED: 39000 } },
  F70: { USD: { UNFRAMED: 42000, FRAMED: 64000 }, EUR: { UNFRAMED: 39000, FRAMED: 59000 } },
};

/* ------------------------------------------------------------------ */
/* Every format × frame × currency                                     */
/* ------------------------------------------------------------------ */

for (const id of FORMAT_IDS) {
  for (const frame of FRAMES) {
    for (const currency of CURRENCIES) {
      test(`pricing: ${id} ${frame} in ${currency} is the catalogue price and a whole number of minor units`, () => {
        const minor = priceMinor(id, frame, currency);
        expect(minor).toBe(EXPECTED[id][currency][frame]);
        expect(Number.isInteger(minor)).toBe(true);
        expect(minor).toBeGreaterThan(0);
        // A price in cents that is not a whole currency unit would render as
        // "$180.00" and break the house display format.
        expect(minor % 100).toBe(0);
      });
    }
  }
}

test('pricing: the catalogue covers exactly the three declared formats, each with both frames in both currencies', () => {
  expect(FORMATS.map((f) => f.id)).toEqual(FORMAT_IDS);
  for (const f of FORMATS) {
    for (const currency of CURRENCIES) {
      for (const frame of FRAMES) {
        expect(typeof f.price[currency][frame]).toBe('number');
      }
    }
  }
});

test('pricing: framing always costs more than not framing, in both currencies', () => {
  for (const id of FORMAT_IDS) {
    for (const currency of CURRENCIES) {
      expect(priceMinor(id, 'FRAMED', currency)).toBeGreaterThan(
        priceMinor(id, 'UNFRAMED', currency),
      );
    }
  }
});

test('pricing: a larger print always costs more than a smaller one at the same finish', () => {
  for (const currency of CURRENCIES) {
    for (const frame of FRAMES) {
      const [a, b, c] = FORMAT_IDS.map((id) => priceMinor(id, frame, currency));
      expect(b).toBeGreaterThan(a);
      expect(c).toBeGreaterThan(b);
    }
  }
});

test('pricing: getFormat rejects an unknown format id rather than returning undefined', () => {
  expect(() => getFormat('F99' as FormatId)).toThrow(/Unknown format/);
});

test('pricing: formatPrice renders whole units without decimals and uses the right symbol', () => {
  expect(formatPrice(42000, 'USD')).toBe('$420');
  expect(formatPrice(39000, 'EUR')).toBe('€390');
  expect(formatPrice(17050, 'EUR')).toBe('€170.50');
  expect(formatPrice(0, 'USD')).toBe('$0');
});

/* ------------------------------------------------------------------ */
/* Region resolution                                                   */
/* ------------------------------------------------------------------ */

/** EU-27 + EEA (NO/IS/LI) + UK + CH. Every one of these prints in Eindhoven. */
const EU_EEA_UK_CH = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'NO', 'IS', 'LI',
  'GB', 'CH',
];

/** Everything else prints in Reno and is quoted in dollars. */
const REST_OF_WORLD = [
  'US', 'CA', 'MX', 'BR', 'AR', 'AU', 'NZ', 'JP', 'KR', 'CN', 'IN', 'SG', 'ZA',
  'AE', 'IL', 'TR', 'UA', 'RS', 'RU', 'EG', 'NG', 'TH', 'VN', 'CL',
];

for (const cc of EU_EEA_UK_CH) {
  test(`region: ${cc} resolves to the EU region, EUR, and the Netherlands facility`, () => {
    const region: Region = regionForCountry(cc);
    expect(region).toBe('EU');
    expect(currencyForRegion(region)).toBe('EUR');
    expect(PRINT_FACILITY[region]).toBe('EU / EINDHOVEN, NL');
  });
}

for (const cc of REST_OF_WORLD) {
  test(`region: ${cc} resolves to the US region, USD, and the Nevada facility`, () => {
    const region: Region = regionForCountry(cc);
    expect(region).toBe('US');
    expect(currencyForRegion(region)).toBe('USD');
    expect(PRINT_FACILITY[region]).toBe('US / RENO, NV');
  });
}

test('region: the EU set is exactly EU-27 + EEA + UK + CH — 32 countries, no more', () => {
  const eu = [...EU_EEA_UK_CH, ...REST_OF_WORLD].filter((cc) => regionForCountry(cc) === 'EU');
  expect(eu.sort()).toEqual([...EU_EEA_UK_CH].sort());
  expect(EU_EEA_UK_CH.length).toBe(32);
});

test('region: a lowercase or mixed-case country code resolves identically', () => {
  expect(regionForCountry('gb')).toBe('EU');
  expect(regionForCountry('Gb')).toBe('EU');
  expect(regionForCountry('us')).toBe('US');
});

test('region: an unknown or empty country code falls back to the US region rather than throwing', () => {
  expect(regionForCountry('')).toBe('US');
  expect(regionForCountry('ZZ')).toBe('US');
});

/* ------------------------------------------------------------------ */
/* Shipping and duties are inside the figure on screen                 */
/* ------------------------------------------------------------------ */

test('pricing: the fulfilment note for both regions states that shipping and duties are included', () => {
  for (const region of ['US', 'EU'] as Region[]) {
    expect(FULFILMENT_NOTE[region]).toContain('Shipping and duties included');
  }
  expect(FULFILMENT_NOTE.US).toContain('Nevada');
  expect(FULFILMENT_NOTE.EU).toContain('Netherlands');
});

function addressIn(countryCode: string): TargetAddress {
  return {
    line1: '1 Test Street',
    city: 'Testville',
    postalCode: '00000',
    countryCode,
    country: countryCode,
    lat: 0,
    lon: 0,
  };
}

test('quote: the total equals the item price — no shipping or duty line is added on top', () => {
  for (const id of FORMAT_IDS) {
    for (const frame of FRAMES) {
      for (const cc of ['US', 'GB', 'DE', 'JP']) {
        const quote = quoteFor({ ...DEFAULT_DRAFT, address: addressIn(cc), formatId: id, frame });
        expect(quote.totalMinor).toBe(quote.itemMinor);
        expect(quote.itemMinor).toBe(priceMinor(id, frame, quote.currency));
      }
    }
  }
});

test('quote: a UK target is quoted in EUR and a US target in USD', () => {
  expect(quoteFor({ ...DEFAULT_DRAFT, address: addressIn('GB') }).currency).toBe('EUR');
  expect(quoteFor({ ...DEFAULT_DRAFT, address: addressIn('CH') }).currency).toBe('EUR');
  expect(quoteFor({ ...DEFAULT_DRAFT, address: addressIn('US') }).currency).toBe('USD');
});

test('quote: before a target is locked the flow quotes in USD rather than leaving the price blank', () => {
  const quote = quoteFor(DEFAULT_DRAFT);
  expect(quote.region).toBe('US');
  expect(quote.currency).toBe('USD');
  expect(quote.totalMinor).toBeGreaterThan(0);
});
