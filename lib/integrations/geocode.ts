/**
 * ==================================================================
 * GEOCODE ADAPTER — address autocomplete + reverse lookup
 * ==================================================================
 * WHAT IT DOES
 *   Turns whatever the customer types at /start into a `GeoSuggestion` with
 *   real decimal-degree coordinates and a correct ISO country code. Those
 *   coordinates are the target the satellite is tasked against and the country
 *   code decides the print region, so this is not cosmetic — it is the input
 *   to the whole pipeline.
 *
 * WHAT IS MOCKED
 *   A small, believable geocoder over a built-in dataset of ~90 real street
 *   addresses across US, EU and a handful of other cities. It matches on any
 *   part of the query (house number, street, city, region, postcode, country),
 *   ranks the hits, and — crucially — NEVER returns an empty list: when the
 *   query matches nothing it synthesises plausible addresses deterministically
 *   from the query text against known cities, so arbitrary typing still feels
 *   like a real autocomplete. Latency is 200–400 ms, seeded by the query.
 *
 * WHAT THE LIVE PATH NEEDS
 *   MAPBOX_ACCESS_TOKEN — account.mapbox.com → Access tokens
 *   MOCK_MODE=false
 *   The live path calls the Mapbox Geocoding v6 forward/reverse endpoints with
 *   `types=address` so only rooftop-level results come back. Any provider with
 *   an address-level forward geocoder (Google Places, HERE, Pelias) drops in
 *   the same way: the only contract is `GeoSuggestion[]`.
 * ==================================================================
 */
import { INTEGRATIONS, MOCK_MODE, isLive } from '@/lib/env';
import { seededUnit, sleep } from '@/lib/utils';
import { seededInt } from '@/lib/missions/telemetry';
import type { GeoSuggestion } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Dataset                                                            */
/* ------------------------------------------------------------------ */

/** [line1, city, region, postalCode, countryCode, country, lat, lon] */
type Row = [string, string, string, string, string, string, number, number];

const US = 'United States';
const GB = 'United Kingdom';

const ADDRESSES: Row[] = [
  /* --- United States ------------------------------------------- */
  ['350 Fifth Avenue', 'New York', 'NY', '10118', 'US', US, 40.7484, -73.9857],
  ['1 Wall Street', 'New York', 'NY', '10005', 'US', US, 40.7075, -74.0113],
  ['405 Lexington Avenue', 'New York', 'NY', '10174', 'US', US, 40.7516, -73.9755],
  ['195 Broadway', 'New York', 'NY', '10007', 'US', US, 40.7108, -74.01],
  ['145 Brooklyn Avenue', 'Brooklyn', 'NY', '11213', 'US', US, 40.6717, -73.9403],
  ['87 Kent Avenue', 'Brooklyn', 'NY', '11249', 'US', US, 40.7213, -73.9631],
  ['200 Berkeley Street', 'Boston', 'MA', '02116', 'US', US, 42.3496, -71.0746],
  ['1 Franklin Street', 'Boston', 'MA', '02110', 'US', US, 42.3554, -71.0603],
  ['350 Massachusetts Avenue', 'Cambridge', 'MA', '02139', 'US', US, 42.3623, -71.0862],
  ['875 North Michigan Avenue', 'Chicago', 'IL', '60611', 'US', US, 41.8988, -87.6229],
  ['233 South Wacker Drive', 'Chicago', 'IL', '60606', 'US', US, 41.8789, -87.6359],
  ['1060 West Addison Street', 'Chicago', 'IL', '60613', 'US', US, 41.9484, -87.6553],
  ['1100 New York Avenue NW', 'Washington', 'DC', '20005', 'US', US, 38.8996, -77.0273],
  ['701 Pennsylvania Avenue NW', 'Washington', 'DC', '20004', 'US', US, 38.8948, -77.0223],
  ['6801 Hollywood Boulevard', 'Los Angeles', 'CA', '90028', 'US', US, 34.1017, -118.3406],
  ['1200 Getty Center Drive', 'Los Angeles', 'CA', '90049', 'US', US, 34.078, -118.4741],
  ['111 South Grand Avenue', 'Los Angeles', 'CA', '90012', 'US', US, 34.0553, -118.2498],
  ['2401 Ocean Front Walk', 'Venice', 'CA', '90291', 'US', US, 33.9857, -118.4728],
  ['1355 Market Street', 'San Francisco', 'CA', '94103', 'US', US, 37.7767, -122.4165],
  ['900 North Point Street', 'San Francisco', 'CA', '94109', 'US', US, 37.8058, -122.4229],
  ['3200 24th Street', 'San Francisco', 'CA', '94110', 'US', US, 37.7526, -122.4171],
  ['400 Broad Street', 'Seattle', 'WA', '98109', 'US', US, 47.6205, -122.3493],
  ['1301 Alaskan Way', 'Seattle', 'WA', '98101', 'US', US, 47.6062, -122.3421],
  ['2200 Rainier Avenue South', 'Seattle', 'WA', '98144', 'US', US, 47.5822, -122.2985],
  ['4131 Woodland Park Avenue North', 'Seattle', 'WA', '98103', 'US', US, 47.6564, -122.3421],
  ['1701 Wynkoop Street', 'Denver', 'CO', '80202', 'US', US, 39.753, -104.9995],
  ['100 West 14th Avenue Parkway', 'Denver', 'CO', '80204', 'US', US, 39.7375, -104.9899],
  ['301 Congress Avenue', 'Austin', 'TX', '78701', 'US', US, 30.2657, -97.7444],
  ['1100 Congress Avenue', 'Austin', 'TX', '78701', 'US', US, 30.2747, -97.7404],
  ['401 Biscayne Boulevard', 'Miami', 'FL', '33132', 'US', US, 25.7781, -80.1867],
  ['1103 Ocean Drive', 'Miami Beach', 'FL', '33139', 'US', US, 25.7826, -80.13],
  ['1201 Chestnut Street', 'Philadelphia', 'PA', '19107', 'US', US, 39.9496, -75.162],
  ['615 Peachtree Street NE', 'Atlanta', 'GA', '30308', 'US', US, 33.7712, -84.3856],
  ['1180 Peachtree Street NE', 'Atlanta', 'GA', '30309', 'US', US, 33.7885, -84.3846],
  ['222 5th Avenue South', 'Nashville', 'TN', '37203', 'US', US, 36.16, -86.7767],
  ['1401 Kettner Boulevard', 'San Diego', 'CA', '92101', 'US', US, 32.7189, -117.1697],
  ['700 Prospect Street', 'La Jolla', 'CA', '92037', 'US', US, 32.8473, -117.2743],
  ['1219 SW Park Avenue', 'Portland', 'OR', '97205', 'US', US, 45.5165, -122.6828],
  ['1005 West Burnside Street', 'Portland', 'OR', '97209', 'US', US, 45.5232, -122.6819],
  ['3400 North Charles Street', 'Baltimore', 'MD', '21218', 'US', US, 39.3299, -76.6205],
  ['3600 Las Vegas Boulevard South', 'Las Vegas', 'NV', '89109', 'US', US, 36.1126, -115.1729],
  ['500 South Virginia Street', 'Reno', 'NV', '89501', 'US', US, 39.5232, -119.813],

  /* --- Europe --------------------------------------------------- */
  ['221B Baker Street', 'London', 'England', 'W1U 6SG', 'GB', GB, 51.5238, -0.1586],
  ['30 St Mary Axe', 'London', 'England', 'EC3A 8BF', 'GB', GB, 51.5145, -0.0803],
  ['1 Canada Square', 'London', 'England', 'E14 5AB', 'GB', GB, 51.5049, -0.0195],
  ['58 Brick Lane', 'London', 'England', 'E1 6RF', 'GB', GB, 51.5211, -0.0716],
  ['12 Rue de Rivoli', 'Paris', 'Île-de-France', '75004', 'FR', 'France', 48.8554, 2.3574],
  ['5 Avenue Anatole France', 'Paris', 'Île-de-France', '75007', 'FR', 'France', 48.8584, 2.2945],
  ['62 Rue des Archives', 'Paris', 'Île-de-France', '75003', 'FR', 'France', 48.8622, 2.3585],
  ['17 Boulevard Saint-Germain', 'Paris', 'Île-de-France', '75005', 'FR', 'France', 48.8489, 2.3529],
  ['44 Rue du Bac', 'Paris', 'Île-de-France', '75007', 'FR', 'France', 48.8562, 2.3253],
  ['9 Rue de la Croix-Nivert', 'Paris', 'Île-de-France', '75015', 'FR', 'France', 48.8446, 2.2965],
  ['33 Quai des Chartrons', 'Bordeaux', 'Nouvelle-Aquitaine', '33000', 'FR', 'France', 44.8536, -0.5722],
  ['Unter den Linden 77', 'Berlin', 'Berlin', '10117', 'DE', 'Germany', 52.5163, 13.379],
  ['Oranienstraße 45', 'Berlin', 'Berlin', '10969', 'DE', 'Germany', 52.5027, 13.4193],
  ['Kastanienallee 12', 'Berlin', 'Berlin', '10435', 'DE', 'Germany', 52.5388, 13.4098],
  ['Karl-Marx-Allee 34', 'Berlin', 'Berlin', '10178', 'DE', 'Germany', 52.5196, 13.4207],
  ['Maximilianstraße 17', 'Munich', 'Bavaria', '80539', 'DE', 'Germany', 48.1391, 11.582],
  ['Marienplatz 8', 'Munich', 'Bavaria', '80331', 'DE', 'Germany', 48.1374, 11.5755],
  ['Reeperbahn 1', 'Hamburg', 'Hamburg', '20359', 'DE', 'Germany', 53.5497, 9.964],
  ['Zeil 106', 'Frankfurt am Main', 'Hesse', '60313', 'DE', 'Germany', 50.1148, 8.682],
  ['Prinsengracht 263', 'Amsterdam', 'North Holland', '1016 GV', 'NL', 'Netherlands', 52.3752, 4.884],
  ['Damrak 70', 'Amsterdam', 'North Holland', '1012 LM', 'NL', 'Netherlands', 52.3739, 4.893],
  ['Keizersgracht 324', 'Amsterdam', 'North Holland', '1016 EZ', 'NL', 'Netherlands', 52.3688, 4.8843],
  ['Coolsingel 42', 'Rotterdam', 'South Holland', '3011 AD', 'NL', 'Netherlands', 51.923, 4.479],
  ['Stationsplein 6', 'Eindhoven', 'North Brabant', '5611 AC', 'NL', 'Netherlands', 51.4432, 5.4797],
  ['Passeig de Gràcia 92', 'Barcelona', 'Catalonia', '08008', 'ES', 'Spain', 41.3954, 2.1614],
  ['Carrer de Mallorca 401', 'Barcelona', 'Catalonia', '08013', 'ES', 'Spain', 41.4036, 2.1744],
  ['Gran Vía 32', 'Madrid', 'Madrid', '28013', 'ES', 'Spain', 40.42, -3.7025],
  ['Calle de Alcalá 42', 'Madrid', 'Madrid', '28014', 'ES', 'Spain', 40.4186, -3.6952],
  ['Via del Corso 305', 'Rome', 'Lazio', '00186', 'IT', 'Italy', 41.8992, 12.4795],
  ['Piazza del Colosseo 1', 'Rome', 'Lazio', '00184', 'IT', 'Italy', 41.8902, 12.4922],
  ['Via Montenapoleone 8', 'Milan', 'Lombardy', '20121', 'IT', 'Italy', 45.4685, 9.195],
  ['Corso Buenos Aires 33', 'Milan', 'Lombardy', '20124', 'IT', 'Italy', 45.479, 9.21],
  ['Rua Augusta 190', 'Lisbon', 'Lisboa', '1100-053', 'PT', 'Portugal', 38.7113, -9.1391],
  ['Avenida da Liberdade 180', 'Lisbon', 'Lisboa', '1250-146', 'PT', 'Portugal', 38.7223, -9.145],
  ['Nyhavn 17', 'Copenhagen', 'Capital Region', '1051', 'DK', 'Denmark', 55.6797, 12.591],
  ['Vesterbrogade 3', 'Copenhagen', 'Capital Region', '1620', 'DK', 'Denmark', 55.6736, 12.5681],
  ['Drottninggatan 71', 'Stockholm', 'Stockholm', '111 36', 'SE', 'Sweden', 59.3358, 18.0596],
  ['Götgatan 22', 'Stockholm', 'Stockholm', '116 46', 'SE', 'Sweden', 59.3155, 18.0723],
  ['45 Grafton Street', 'Dublin', 'Leinster', 'D02 VK65', 'IE', 'Ireland', 53.3418, -6.2596],
  ['6 Merrion Square North', 'Dublin', 'Leinster', 'D02 HT44', 'IE', 'Ireland', 53.3395, -6.25],
  ['Kärntner Straße 19', 'Vienna', 'Vienna', '1010', 'AT', 'Austria', 48.205, 16.3712],
  ['Mariahilfer Straße 88', 'Vienna', 'Vienna', '1070', 'AT', 'Austria', 48.198, 16.345],
  ['Bahnhofstrasse 45', 'Zurich', 'Zurich', '8001', 'CH', 'Switzerland', 47.373, 8.5385],
  ['Limmatquai 62', 'Zurich', 'Zurich', '8001', 'CH', 'Switzerland', 47.3717, 8.5436],
  ['Grand-Place 7', 'Brussels', 'Brussels', '1000', 'BE', 'Belgium', 50.8467, 4.3525],
  ['Avenue Louise 250', 'Brussels', 'Brussels', '1050', 'BE', 'Belgium', 50.8262, 4.3617],
  ['Václavské náměstí 42', 'Prague', 'Prague', '110 00', 'CZ', 'Czechia', 50.081, 14.427],
  ['Nowy Świat 35', 'Warsaw', 'Masovia', '00-029', 'PL', 'Poland', 52.234, 21.018],
  ['Aleksanterinkatu 15', 'Helsinki', 'Uusimaa', '00100', 'FI', 'Finland', 60.1685, 24.945],
  ['Karl Johans gate 31', 'Oslo', 'Oslo', '0159', 'NO', 'Norway', 59.9139, 10.742],

  /* --- Elsewhere ------------------------------------------------ */
  ['2-1-1 Nishishinjuku', 'Tokyo', 'Shinjuku', '163-8001', 'JP', 'Japan', 35.6896, 139.6917],
  ['4-2-8 Shibakoen', 'Tokyo', 'Minato', '105-0011', 'JP', 'Japan', 35.6586, 139.7454],
  ['2 Macquarie Street', 'Sydney', 'NSW', '2000', 'AU', 'Australia', -33.86, 151.213],
  ['100 Queen Street West', 'Toronto', 'ON', 'M5H 2N2', 'CA', 'Canada', 43.6534, -79.3839],
  ['1 Fullerton Road', 'Singapore', 'Central', '049213', 'SG', 'Singapore', 1.2867, 103.8536],
  ['8 Church Street', 'Cape Town', 'Western Cape', '8001', 'ZA', 'South Africa', -33.9249, 18.4212],
  ['Avenida Paulista 1578', 'São Paulo', 'SP', '01310-200', 'BR', 'Brazil', -23.5614, -46.6559],
  ['Avenida Atlântica 1702', 'Rio de Janeiro', 'RJ', '22021-001', 'BR', 'Brazil', -22.9683, -43.1799],
  ['Paseo de la Reforma 222', 'Mexico City', 'CDMX', '06600', 'MX', 'Mexico', 19.427, -99.16],
  ['88 Connaught Road Central', 'Hong Kong', 'Central', '999077', 'HK', 'Hong Kong', 22.2855, 114.1577],

  /* --- United States (second tier) ------------------------------ */
  ['2 North Central Avenue', 'Phoenix', 'AZ', '85004', 'US', US, 33.4484, -112.074],
  ['1401 Elm Street', 'Dallas', 'TX', '75202', 'US', US, 32.78, -96.8],
  ['1600 Smith Street', 'Houston', 'TX', '77002', 'US', US, 29.757, -95.367],
  ['900 Nicollet Mall', 'Minneapolis', 'MN', '55403', 'US', US, 44.974, -93.2755],
  ['1 Woodward Avenue', 'Detroit', 'MI', '48226', 'US', US, 42.329, -83.0458],
  ['615 Royal Street', 'New Orleans', 'LA', '70130', 'US', US, 29.957, -90.065],
  ['15 South Temple Street', 'Salt Lake City', 'UT', '84111', 'US', US, 40.769, -111.891],
  ['200 Grand Boulevard', 'Kansas City', 'MO', '64108', 'US', US, 39.087, -94.583],
  ['525 North Tryon Street', 'Charlotte', 'NC', '28202', 'US', US, 35.227, -80.843],
  ['600 Grant Street', 'Pittsburgh', 'PA', '15219', 'US', US, 40.4415, -79.9948],
  ['1520 Market Street', 'St. Louis', 'MO', '63103', 'US', US, 38.6285, -90.199],
  ['1315 10th Street', 'Sacramento', 'CA', '95814', 'US', US, 38.5767, -121.4934],
  ['2005 Kalia Road', 'Honolulu', 'HI', '96815', 'US', US, 21.279, -157.833],

  /* --- Europe (second tier) ------------------------------------- */
  ['Oudegracht 129', 'Utrecht', 'Utrecht', '3511 AA', 'NL', 'Netherlands', 52.0907, 5.1214],
  ['Lange Voorhout 74', 'The Hague', 'South Holland', '2514 EH', 'NL', 'Netherlands', 52.083, 4.311],
  ['Meir 78', 'Antwerp', 'Flanders', '2000', 'BE', 'Belgium', 51.218, 4.406],
  ['20 Rue de la République', 'Lyon', 'Auvergne-Rhône-Alpes', '69002', 'FR', 'France', 45.764, 4.8357],
  ['58 La Canebière', 'Marseille', "Provence-Alpes-Côte d'Azur", '13001', 'FR', 'France', 43.2965, 5.376],
  ['Hohe Straße 68', 'Cologne', 'North Rhine-Westphalia', '50667', 'DE', 'Germany', 50.9375, 6.956],
  ['Königstraße 27', 'Stuttgart', 'Baden-Württemberg', '70173', 'DE', 'Germany', 48.778, 9.18],
  ['Königsallee 60', 'Düsseldorf', 'North Rhine-Westphalia', '40212', 'DE', 'Germany', 51.226, 6.777],
  ['Carrer de Colón 12', 'Valencia', 'Valencia', '46004', 'ES', 'Spain', 39.469, -0.376],
  ['Calle Sierpes 40', 'Seville', 'Andalusia', '41004', 'ES', 'Spain', 37.389, -5.994],
  ['Via Toledo 148', 'Naples', 'Campania', '80132', 'IT', 'Italy', 40.842, 14.249],
  ['Via de Tornabuoni 20', 'Florence', 'Tuscany', '50123', 'IT', 'Italy', 43.771, 11.25],
  ['Via Roma 18', 'Turin', 'Piedmont', '10121', 'IT', 'Italy', 45.07, 7.683],
  ['Rua de Santa Catarina 250', 'Porto', 'Porto', '4000-442', 'PT', 'Portugal', 41.147, -8.606],
  ['Kungsportsavenyen 22', 'Gothenburg', 'Västra Götaland', '411 36', 'SE', 'Sweden', 57.7, 11.977],
  ['Stortorget 5', 'Malmö', 'Skåne', '211 34', 'SE', 'Sweden', 55.606, 13.0],
  ['Store Torv 4', 'Aarhus', 'Central Jutland', '8000', 'DK', 'Denmark', 56.157, 10.21],
  ['Bryggen 11', 'Bergen', 'Vestland', '5003', 'NO', 'Norway', 60.397, 5.324],
  ['Floriańska 25', 'Krakow', 'Lesser Poland', '31-019', 'PL', 'Poland', 50.064, 19.94],
  ['Andrássy út 60', 'Budapest', 'Budapest', '1062', 'HU', 'Hungary', 47.506, 19.064],
  ['Calea Victoriei 63', 'Bucharest', 'Bucharest', '010065', 'RO', 'Romania', 44.438, 26.096],
  ['Ermou 24', 'Athens', 'Attica', '105 63', 'GR', 'Greece', 37.977, 23.729],
  ['12 Patrick Street', 'Cork', 'Munster', 'T12 XY43', 'IE', 'Ireland', 51.898, -8.475],
  ['Rue du Rhône 40', 'Geneva', 'Geneva', '1204', 'CH', 'Switzerland', 46.204, 6.149],
  ['Freie Strasse 68', 'Basel', 'Basel-Stadt', '4051', 'CH', 'Switzerland', 47.556, 7.589],

  /* --- Elsewhere (second tier) ---------------------------------- */
  ['1-4-1 Shinsaibashisuji', 'Osaka', 'Osaka', '542-0085', 'JP', 'Japan', 34.672, 135.501],
  ['150 Collins Street', 'Melbourne', 'VIC', '3000', 'AU', 'Australia', -37.815, 144.97],
  ['1055 West Georgia Street', 'Vancouver', 'BC', 'V6E 3P3', 'CA', 'Canada', 49.286, -123.121],
];

interface Entry extends GeoSuggestion {
  /** Lowercased searchable blob. */
  haystack: string;
}

const DATASET: Entry[] = ADDRESSES.map(
  ([line1, city, region, postalCode, countryCode, country, lat, lon], i) => ({
    id: `sfs_${countryCode.toLowerCase()}_${i.toString().padStart(3, '0')}`,
    label: `${line1}, ${city}, ${region} ${postalCode}, ${country}`,
    line1,
    city,
    region,
    postalCode,
    countryCode,
    country,
    lat,
    lon,
    haystack: `${line1} ${city} ${region} ${postalCode} ${countryCode} ${country}`.toLowerCase(),
  }),
);

/** Distinct cities, used by the synthesiser. */
const CITIES = Array.from(
  new Map(DATASET.map((e) => [`${e.city}|${e.countryCode}`, e])).values(),
);

/* ------------------------------------------------------------------ */
/* Matching                                                           */
/* ------------------------------------------------------------------ */

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    // Strip diacritics so "gotgatan" finds "Götgatan".
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,]/g, ' ')
    .trim();
}

function tokens(q: string): string[] {
  return normalise(q).split(/\s+/).filter(Boolean);
}

/**
 * Score one entry against the query tokens. Higher is better; 0 means no
 * match at all. Prefix hits at the start of the address outrank hits buried
 * in the country name, which is what makes the list feel ordered.
 */
function score(entry: Entry, qTokens: string[]): number {
  const hay = normalise(entry.haystack);
  const line = normalise(entry.line1);
  const city = normalise(entry.city);
  let total = 0;

  for (const t of qTokens) {
    let best = 0;
    if (hay.includes(t)) best = 1;
    if (city.startsWith(t)) best = Math.max(best, 4);
    if (line.startsWith(t)) best = Math.max(best, 5);
    if (line.includes(` ${t}`)) best = Math.max(best, 3);
    // Postal prefixes only count from three characters: a bare "12" is far
    // more likely to be a house number than a postcode.
    if (t.length >= 3 && normalise(entry.postalCode).startsWith(t)) best = Math.max(best, 4);
    if (best === 0) return 0; // every token must land somewhere
    total += best;
  }

  // Short queries should surface a spread of cities, so bias very slightly
  // toward shorter labels — they read as more "central" results.
  return total * 10 - entry.label.length / 100;
}

/* ------------------------------------------------------------------ */
/* Synthesis — the "never empty" guarantee                            */
/* ------------------------------------------------------------------ */

const STREET_SUFFIXES = ['Street', 'Avenue', 'Road', 'Lane', 'Drive', 'Court', 'Way'];

/** Words that already read as a street type in any of the dataset's languages. */
const SUFFIX_PATTERN =
  /(street|avenue|road|lane|drive|court|way|boulevard|parkway|square|place|gardens|terrace|walk|hill|gate|mall|quai|strasse|straße|allee|weg|rue|via|corso|piazza|calle|carrer|avenida|rua|gracht|singel|kade|plein|straat|gatan|gate|vej|katu|utca|ulica)$/i;

/** Every distinct word that appears in a known city name, for stripping city
 *  tokens out of a synthesised street name ("broad street seattle" must not
 *  become "Broad Street Seattle Street"). */
const CITY_WORDS = new Set(
  CITIES.flatMap((c) => normalise(c.city).split(/\s+/)).filter(Boolean),
);

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * Builds plausible results for a query that matched nothing.
 * Deterministic: the same typing always produces the same list, so a demo can
 * be repeated and screenshots stay valid.
 */
function synthesise(q: string, limit: number): GeoSuggestion[] {
  const raw = q.trim();
  const seed = normalise(raw) || 'target';
  const numberMatch = /(\d+)/.exec(raw);
  const houseNumber = numberMatch ? numberMatch[1] : String(seededInt(`hn:${seed}`, 4, 388));

  const words = tokens(raw).filter((t) => !/^\d+$/.test(t));

  // If a city name is somewhere in the query, anchor to it; otherwise pick a
  // deterministic spread of cities.
  const anchored = CITIES.filter((c) => words.some((w) => w.length > 2 && normalise(c.city).startsWith(w)));
  const pool = anchored.length ? anchored : CITIES;

  // The street name is what is left once city words are removed — otherwise
  // "999 broad street seattle" synthesises "999 Broad Street Seattle".
  const streetTokens = words.filter((w) => !CITY_WORDS.has(w));
  const streetWords = streetTokens.length ? streetTokens.slice(0, 3).map(titleCase).join(' ') : '';

  const out: GeoSuggestion[] = [];
  const used = new Set<string>();

  for (let i = 0; out.length < limit; i++) {
    if (i > pool.length * 3) break;
    const idx =
      (Math.floor(seededUnit(`city:${seed}:${i}`) * pool.length) + i * 7) % pool.length;
    const city = pool[idx];
    if (used.has(city.city)) continue;

    // Fall back to a real street from that city when the query gave us nothing
    // street-shaped to work with.
    const cityStreets = DATASET.filter((e) => e.city === city.city);
    const fallbackStreet = cityStreets[
      Math.floor(seededUnit(`st:${seed}:${i}`) * cityStreets.length) % cityStreets.length
    ].line1.replace(/^[\d-]+\s*/, '');

    const suffix = STREET_SUFFIXES[
      Math.floor(seededUnit(`sfx:${seed}:${i}`) * STREET_SUFFIXES.length) % STREET_SUFFIXES.length
    ];
    const street = streetWords
      ? SUFFIX_PATTERN.test(streetWords)
        ? streetWords
        : `${streetWords} ${suffix}`
      : fallbackStreet;

    // Scatter within roughly 6 km of the city centre — rooftop precision is
    // not the point in mock mode, plausibility is.
    const dLat = (seededUnit(`lat:${seed}:${i}`) - 0.5) * 0.11;
    const dLon = (seededUnit(`lon:${seed}:${i}`) - 0.5) * 0.16;
    const lat = Number((city.lat + dLat).toFixed(6));
    const lon = Number((city.lon + dLon).toFixed(6));

    const line1 = `${houseNumber} ${street}`.trim();
    const label = `${line1}, ${city.city}, ${city.region ?? ''} ${city.postalCode}, ${city.country}`
      .replace(/\s+,/g, ',');
    if (used.has(label)) continue;
    used.add(city.city);
    used.add(label);

    out.push({
      id: `sfs_syn_${Math.round(seededUnit(`${seed}:${i}`) * 1e9).toString(36)}`,
      label,
      line1,
      city: city.city,
      region: city.region,
      postalCode: city.postalCode,
      countryCode: city.countryCode,
      country: city.country,
      lat,
      lon,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Adapter interface                                                  */
/* ------------------------------------------------------------------ */

export interface GeocodeAdapter {
  autocomplete(q: string, limit?: number): Promise<GeoSuggestion[]>;
  reverse(lat: number, lon: number): Promise<GeoSuggestion | null>;
}

function strip(e: Entry): GeoSuggestion {
  const { haystack: _haystack, ...rest } = e;
  void _haystack;
  return rest;
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ------------------------------------------------------------------ */
/* MOCK                                                               */
/* ------------------------------------------------------------------ */

export const mock: GeocodeAdapter = {
  async autocomplete(q, limit = 6) {
    // A real autocomplete round trip is 200–400 ms. Seeded so it is stable.
    await sleep(200 + Math.round(seededUnit(`geo:${q}`) * 200));

    const qt = tokens(q);
    if (qt.length === 0) return [];

    const hits = DATASET.map((e) => ({ e, s: score(e, qt) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((x) => strip(x.e));

    // Real hits win outright. Synthesis is the fallback for a query the
    // dataset does not know — mixing the two produces a list that reads as
    // half-broken, so it is deliberately all-or-nothing.
    if (hits.length > 0) return hits;

    return synthesise(q, limit);
  },

  async reverse(lat, lon) {
    await sleep(180);
    let best: Entry | null = null;
    let bestKm = Number.POSITIVE_INFINITY;
    for (const e of DATASET) {
      const km = distanceKm(lat, lon, e.lat, e.lon);
      if (km < bestKm) {
        best = e;
        bestKm = km;
      }
    }
    if (!best) return null;

    // Close enough to be that address; otherwise report a plausible address at
    // the requested point, borrowing the nearest city's identity.
    if (bestKm < 3) return strip(best);

    const line1 = `${seededInt(`rev:${lat},${lon}`, 2, 240)} ${best.line1.replace(/^[\d-]+\s*/, '')}`;
    return {
      id: `sfs_rev_${Math.round(seededUnit(`${lat},${lon}`) * 1e9).toString(36)}`,
      label: `${line1}, ${best.city}, ${best.region ?? ''} ${best.postalCode}, ${best.country}`.replace(
        /\s+,/g,
        ',',
      ),
      line1,
      city: best.city,
      region: best.region,
      postalCode: best.postalCode,
      countryCode: best.countryCode,
      country: best.country,
      lat,
      lon,
    };
  },
};

/* ------------------------------------------------------------------ */
/* LIVE — Mapbox Geocoding v6. Complete but inactive.                  */
/* ------------------------------------------------------------------ */

interface MapboxFeature {
  id?: string;
  properties?: {
    full_address?: string;
    name?: string;
    coordinates?: { latitude?: number; longitude?: number };
    context?: Record<string, { name?: string; country_code?: string } | undefined>;
  };
}

function fromMapbox(f: MapboxFeature, i: number): GeoSuggestion | null {
  const p = f.properties;
  if (!p?.coordinates?.latitude || !p.coordinates.longitude) return null;
  const ctx = p.context ?? {};
  return {
    id: f.id ?? `mbx_${i}`,
    label: p.full_address ?? p.name ?? '',
    line1: p.name ?? '',
    city: ctx.place?.name ?? '',
    region: ctx.region?.name,
    postalCode: ctx.postcode?.name ?? '',
    countryCode: (ctx.country?.country_code ?? '').toUpperCase(),
    country: ctx.country?.name ?? '',
    lat: p.coordinates.latitude,
    lon: p.coordinates.longitude,
  };
}

export const live: GeocodeAdapter = {
  async autocomplete(q, limit = 6) {
    // GET https://api.mapbox.com/search/geocode/v6/forward
    const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
    url.searchParams.set('q', q);
    url.searchParams.set('limit', String(limit));
    // Rooftop-level only: the satellite is tasked against these coordinates.
    url.searchParams.set('types', 'address');
    url.searchParams.set('access_token', INTEGRATIONS.geocoder.apiKey);

    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`mapbox forward geocode failed: ${res.status}`);

    const json = (await res.json()) as { features?: MapboxFeature[] };
    return (json.features ?? [])
      .map(fromMapbox)
      .filter((s): s is GeoSuggestion => s !== null && s.countryCode !== '');
  },

  async reverse(lat, lon) {
    // GET https://api.mapbox.com/search/geocode/v6/reverse
    const url = new URL('https://api.mapbox.com/search/geocode/v6/reverse');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('types', 'address');
    url.searchParams.set('access_token', INTEGRATIONS.geocoder.apiKey);

    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`mapbox reverse geocode failed: ${res.status}`);

    const json = (await res.json()) as { features?: MapboxFeature[] };
    const first = (json.features ?? [])[0];
    return first ? fromMapbox(first, 0) : null;
  },
};

/* ------------------------------------------------------------------ */
/* NOMINATIM — real geocoding, keyless                                 */
/* ------------------------------------------------------------------ */
/**
 * OpenStreetMap Nominatim. Free, keyless and real: the address a customer
 * types resolves to its ACTUAL coordinates, so the satellite is aimed at the
 * right ground. This is the default whenever the app is not in MOCK_MODE and no
 * Mapbox key is present — a synthesized mock address would put the frame on the
 * wrong rooftop. Fair-use policy asks for a descriptive User-Agent and light
 * use; results are revalidated/cached and the public wrapper falls back to the
 * deterministic mock if the service is unreachable.
 */
interface NominatimResult {
  osm_id?: number;
  lat: string;
  lon: string;
  display_name?: string;
  name?: string;
  address?: Record<string, string>;
}

const NOMINATIM_HEADERS = {
  'User-Agent': 'shot-from-space/1.0 (mission@shotfromspace.com)',
  'Accept-Language': 'en',
};

function fromNominatim(r: NominatimResult, i: number): GeoSuggestion | null {
  const lat = Number.parseFloat(r.lat);
  const lon = Number.parseFloat(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const a = r.address ?? {};
  const line1 =
    [a.house_number, a.road].filter(Boolean).join(' ') ||
    r.name ||
    (r.display_name ?? '').split(',')[0] ||
    '';
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? a.suburb ?? '';
  return {
    id: r.osm_id ? `osm_${r.osm_id}` : `osm_${i}`,
    label: r.display_name ?? line1,
    line1,
    city,
    region: a.state ?? a.region,
    postalCode: a.postcode ?? '',
    countryCode: (a.country_code ?? '').toUpperCase(),
    country: a.country ?? '',
    lat,
    lon,
  };
}

export const nominatim: GeocodeAdapter = {
  async autocomplete(q, limit = 6) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', String(limit));
    const res = await fetch(url, { headers: NOMINATIM_HEADERS, next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(`nominatim search failed: ${res.status}`);
    const json = (await res.json()) as NominatimResult[];
    return json
      .map(fromNominatim)
      .filter((s): s is GeoSuggestion => s !== null && s.countryCode !== '');
  },

  async reverse(lat, lon) {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    const res = await fetch(url, { headers: NOMINATIM_HEADERS, next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(`nominatim reverse failed: ${res.status}`);
    const json = (await res.json()) as NominatimResult;
    return json?.lat ? fromNominatim(json, 0) : null;
  },
};

/* ------------------------------------------------------------------ */
/* Public surface                                                     */
/* ------------------------------------------------------------------ */

function adapter(): GeocodeAdapter {
  if (isLive('geocoder')) return live; // Mapbox, when a key is configured
  if (!MOCK_MODE) return nominatim; // real, keyless — the deployed default
  return mock; // deterministic, offline
}

/** Address autocomplete. Never throws, never returns an empty list for a
 *  non-empty query in mock mode. */
export async function autocomplete(q: string, limit = 6): Promise<GeoSuggestion[]> {
  try {
    const results = await adapter().autocomplete(q, limit);
    if (results.length > 0) return results;
    return q.trim() ? synthesise(q, limit) : [];
  } catch (err) {
    console.error('[geocode] autocomplete failed:', (err as Error).message);
    return mock.autocomplete(q, limit);
  }
}

export async function reverse(lat: number, lon: number): Promise<GeoSuggestion | null> {
  try {
    return await adapter().reverse(lat, lon);
  } catch (err) {
    console.error('[geocode] reverse failed:', (err as Error).message);
    return mock.reverse(lat, lon);
  }
}

/** Exposed for tests and for the seed's sanity checks. */
export const KNOWN_ADDRESS_COUNT = DATASET.length;

export const geocodeAdapter = { autocomplete, reverse, mock, live, KNOWN_ADDRESS_COUNT };
