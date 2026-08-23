/**
 * Destination countries for manual target entry.
 *
 * Deliberately short: every EU/EEA print destination (they route to
 * Eindhoven) plus the major US-facility destinations. The autocomplete path
 * supplies its own country code, so this list only backs the manual form.
 * `regionForCountry` in @/lib/pricing decides the facility for each code.
 */
export interface Country {
  code: string;
  name: string;
}

export const COUNTRIES: readonly Country[] = [
  { code: 'US', name: 'UNITED STATES' },
  { code: 'GB', name: 'UNITED KINGDOM' },
  { code: 'DE', name: 'GERMANY' },
  { code: 'FR', name: 'FRANCE' },
  { code: 'NL', name: 'NETHERLANDS' },
  { code: 'BE', name: 'BELGIUM' },
  { code: 'ES', name: 'SPAIN' },
  { code: 'IT', name: 'ITALY' },
  { code: 'PT', name: 'PORTUGAL' },
  { code: 'IE', name: 'IRELAND' },
  { code: 'AT', name: 'AUSTRIA' },
  { code: 'CH', name: 'SWITZERLAND' },
  { code: 'DK', name: 'DENMARK' },
  { code: 'SE', name: 'SWEDEN' },
  { code: 'NO', name: 'NORWAY' },
  { code: 'FI', name: 'FINLAND' },
  { code: 'IS', name: 'ICELAND' },
  { code: 'PL', name: 'POLAND' },
  { code: 'CZ', name: 'CZECHIA' },
  { code: 'SK', name: 'SLOVAKIA' },
  { code: 'SI', name: 'SLOVENIA' },
  { code: 'HU', name: 'HUNGARY' },
  { code: 'RO', name: 'ROMANIA' },
  { code: 'BG', name: 'BULGARIA' },
  { code: 'HR', name: 'CROATIA' },
  { code: 'GR', name: 'GREECE' },
  { code: 'EE', name: 'ESTONIA' },
  { code: 'LV', name: 'LATVIA' },
  { code: 'LT', name: 'LITHUANIA' },
  { code: 'LU', name: 'LUXEMBOURG' },
  { code: 'MT', name: 'MALTA' },
  { code: 'CY', name: 'CYPRUS' },
  { code: 'CA', name: 'CANADA' },
  { code: 'MX', name: 'MEXICO' },
  { code: 'AU', name: 'AUSTRALIA' },
  { code: 'NZ', name: 'NEW ZEALAND' },
  { code: 'JP', name: 'JAPAN' },
  { code: 'SG', name: 'SINGAPORE' },
  { code: 'AE', name: 'UNITED ARAB EMIRATES' },
  { code: 'ZA', name: 'SOUTH AFRICA' },
  { code: 'BR', name: 'BRAZIL' },
] as const;

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code.toUpperCase())?.name ?? code.toUpperCase();
}
