import type { Currency, FormatId, FrameOption, PrintFormat, Region } from './types';

/**
 * Catalogue. Three sizes, framed or unframed, one price that already
 * includes shipping and duties — no surprises at checkout.
 * Prices are in minor units (cents).
 */
export const FORMATS: PrintFormat[] = [
  {
    id: 'F30',
    metric: '30 × 40 CM',
    imperial: '12 × 16 IN',
    designation: 'FMT-30',
    ratio: '3:4',
    price: {
      USD: { UNFRAMED: 18000, FRAMED: 26000 },
      EUR: { UNFRAMED: 17000, FRAMED: 24000 },
    },
    note: 'Desk scale. Reads as a document.',
  },
  {
    id: 'F50',
    metric: '50 × 70 CM',
    imperial: '20 × 28 IN',
    designation: 'FMT-50',
    ratio: '5:7',
    price: {
      USD: { UNFRAMED: 28000, FRAMED: 42000 },
      EUR: { UNFRAMED: 26000, FRAMED: 39000 },
    },
    note: 'Standard issue. Street grid stays legible.',
  },
  {
    id: 'F70',
    metric: '70 × 100 CM',
    imperial: '28 × 40 IN',
    designation: 'FMT-70',
    ratio: '7:10',
    price: {
      USD: { UNFRAMED: 42000, FRAMED: 64000 },
      EUR: { UNFRAMED: 39000, FRAMED: 59000 },
    },
    note: 'Wall scale. Individual rooftops resolve.',
  },
];

export function getFormat(id: FormatId): PrintFormat {
  const f = FORMATS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown format: ${id}`);
  return f;
}

export function priceMinor(id: FormatId, frame: FrameOption, currency: Currency): number {
  return getFormat(id).price[currency][frame];
}

/** Formats minor units for display: 42000 → "$420" / "€390". */
export function formatPrice(minor: number, currency: Currency): string {
  const symbol = currency === 'USD' ? '$' : '€';
  const major = minor / 100;
  const body = Number.isInteger(major) ? String(major) : major.toFixed(2);
  return `${symbol}${body}`;
}

/** EU/EEA + UK + CH print in Europe; everything else prints in the US. */
const EU_PRINT: ReadonlySet<string> = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU',
  'MT','NL','PL','PT','RO','SK','SI','ES','SE','GB','CH','NO','IS','LI',
]);

export function regionForCountry(countryCode: string): Region {
  return EU_PRINT.has(countryCode.toUpperCase()) ? 'EU' : 'US';
}

export function currencyForRegion(region: Region): Currency {
  return region === 'EU' ? 'EUR' : 'USD';
}

/** Human label for the print facility that runs a region's jobs. */
export const PRINT_FACILITY: Record<Region, string> = {
  US: 'US / RENO, NV',
  EU: 'EU / EINDHOVEN, NL',
};

/** Shipping is included; this is the promise shown next to the price. */
export const FULFILMENT_NOTE: Record<Region, string> = {
  US: 'Printed in Nevada. Shipping and duties included.',
  EU: 'Printed in the Netherlands. Shipping and duties included.',
};
