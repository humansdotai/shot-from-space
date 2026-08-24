import type { OrbitData } from './types';

/**
 * Imagery catalogue.
 *
 * Every frame in /public/imagery is a public-domain NASA / USGS Landsat
 * product. Attribution and source links live in IMAGERY.md; nothing here is
 * licensed, watermarked or third-party. In production these are replaced by
 * real SkyFi captures — see lib/integrations/skyfi.ts.
 *
 * ------------------------------------------------------------------
 * THE DATES ARE THE ATTRIBUTION. DO NOT INVENT ONE.
 * ------------------------------------------------------------------
 * These frames used to carry a fabricated `capturedAt` in 2026, which
 * /legal/imagery then printed as the scene's capture date, directly beside a
 * credit line naming the real acquisition. Berlin was dated 04.03.2026 next
 * to a credit reading "Berlin 1986 07 31". An attribution page is the one
 * page that has to be literally true, so `acquired` now carries the date the
 * source record actually states, at the precision the record actually
 * carries, plus the sentence that justifies it.
 *
 * If you add a frame: read its Wikimedia Commons / NASA record, put the
 * acquisition date in `acquired.date`, set `precision` to what the record
 * supports, and quote your evidence in `basis`. If the record does not state
 * a date, `precision` is UNKNOWN and `date` is null — that is a legitimate
 * answer and the page renders it. Guessing is not.
 */

/** How precise the source record actually is. Never claim more than this. */
export type AcquisitionPrecision = 'DAY' | 'MONTH' | 'YEAR' | 'UNKNOWN';

export interface Acquisition {
  /**
   * ISO 8601, truncated to `precision`: `YYYY-MM-DD`, `YYYY-MM`, `YYYY`, or
   * null when the record states no date at all. Never a time of day — none
   * of these records carries one.
   */
  date: string | null;
  precision: AcquisitionPrecision;
  /** Why we believe the date. Quote the record; this is the audit trail. */
  basis: string;
}

/**
 * Display form of an acquisition date. Renders exactly as much as the record
 * supports and no more, so a year-precision scene never prints a day.
 */
export function acquisitionLabel(a: Acquisition): string {
  if (!a.date || a.precision === 'UNKNOWN') return 'DATE NOT STATED';
  const [y, m, d] = a.date.split('-');
  if (a.precision === 'YEAR' || !m) return y;
  if (a.precision === 'MONTH' || !d) return `${m}.${y}`;
  return `${d}.${m}.${y}`;
}

/**
 * Sort key. Mixed-precision ISO strings still order correctly as text; an
 * undated frame sorts last rather than pretending to a position.
 */
export function acquisitionSortKey(a: Acquisition): string {
  return a.date ?? '';
}

export interface CatalogueFrame {
  slug: string;
  src: string;
  width: number;
  height: number;
  /** City-level location. Public surfaces never show a street address. */
  city: string;
  admin: string;
  countryCode: string;
  country: string;
  lat: number;
  lon: number;
  /** When the frame was actually acquired, per its own source record. */
  acquired: Acquisition;
  orbit: OrbitData;
  credit: string;
  source: string;
}

export const CATALOGUE: CatalogueFrame[] = [
  {
    slug: "hero-los-angeles",
    src: "/imagery/hero-los-angeles.jpg",
    width: 2400,
    height: 1017,
    city: "LOS ANGELES",
    admin: "CALIFORNIA",
    countryCode: "US",
    country: "UNITED STATES",
    lat: 34.0522,
    lon: -118.2437,
    acquired: {
      date: "2001-05-04",
      precision: "DAY",
      basis:
        "Landsat frame acquired 04.05.2001, draped over SRTM elevation collected in February 2000. Both dates are stated on the source record for PIA03376.",
    },
    orbit: {
      sensor: "LANDSAT + SRTM",
      inclination: "SSO 98.2°",
      track: "//ELIPSE 33°",
      altitudeKm: 705,
      gsdM: 30,
      azimuthDeg: 104,
      offNadirDeg: 4.1,
      cloudPct: 2,
    },
    credit: "http://photojournal.jpl.nasa.gov/catalog/PIA03376",
    source: "https://commons.wikimedia.org/wiki/File%3ALos_Angeles_JPLLandsat.jpg",
  },
  {
    slug: "paris-fr",
    src: "/imagery/paris-fr.jpg",
    width: 2400,
    height: 2530,
    city: "PARIS",
    admin: "ÎLE-DE-FRANCE",
    countryCode: "FR",
    country: "FRANCE",
    lat: 48.8566,
    lon: 2.3522,
    acquired: {
      date: "2006-07-16",
      precision: "DAY",
      basis:
        "Acquisition date on the source record, and encoded in scene ID LT51990262006197KIS00 — 2006, day 197.",
    },
    orbit: {
      sensor: "LANDSAT-5 / TM",
      inclination: "SSO 98.2°",
      track: "//ELIPSE 27°",
      altitudeKm: 705,
      gsdM: 30,
      azimuthDeg: 98,
      offNadirDeg: 2.7,
      cloudPct: 11,
    },
    credit: "http://glovis.usgs.gov/ image ID LT51990262006197KIS00",
    source: "https://commons.wikimedia.org/wiki/File%3AParis_and_vicinities%2C_LandSat-5_false_color_satellite_image%2C_2006-07-16.jpg",
  },
  {
    slug: "berlin-de",
    src: "/imagery/berlin-de.jpg",
    width: 2400,
    height: 1388,
    city: "BERLIN",
    admin: "BRANDENBURG",
    countryCode: "DE",
    country: "GERMANY",
    lat: 52.52,
    lon: 13.405,
    acquired: {
      date: "1986-07-31",
      precision: "DAY",
      basis:
        "Source record: “Berlin, Germany 31 July 1986. Image by Landsat 5 satellite.”",
    },
    orbit: {
      sensor: "LANDSAT-5 / TM",
      inclination: "SSO 98.2°",
      track: "//ELIPSE 41°",
      altitudeKm: 705,
      gsdM: 30,
      azimuthDeg: 112,
      offNadirDeg: 6.4,
      cloudPct: 4,
    },
    credit: "Berlin 1986 07 31",
    source: "https://commons.wikimedia.org/wiki/File%3ABerlin_1986_07_31_(32824581725).jpg",
  },
  {
    slug: "las-vegas-us",
    src: "/imagery/las-vegas-us.jpg",
    width: 2400,
    height: 1350,
    city: "LAS VEGAS",
    admin: "NEVADA",
    countryCode: "US",
    country: "UNITED STATES",
    lat: 36.1699,
    lon: -115.1398,
    acquired: {
      date: "2023",
      precision: "YEAR",
      basis:
        "The source is a Landsat time series running 1972–2023; the frame used here is its 2023 end state. No exact acquisition date is stated.",
    },
    orbit: {
      sensor: "LANDSAT",
      inclination: "SSO 98.2°",
      track: "//ELIPSE 35°",
      altitudeKm: 705,
      gsdM: 30,
      azimuthDeg: 101,
      offNadirDeg: 1.9,
      cloudPct: 0,
    },
    credit: "50+ years of Landsat: Las Vegas",
    source: "https://commons.wikimedia.org/wiki/File%3A50%2B_years_of_Landsat-_Las_Vegas_(SVS31195_-_landsat_las_vegas_2023).tiff",
  },
  {
    slug: "london-uk",
    src: "/imagery/london-uk.jpg",
    width: 2400,
    height: 1920,
    city: "THAMES ESTUARY",
    admin: "ESSEX",
    countryCode: "GB",
    country: "UNITED KINGDOM",
    lat: 51.5,
    lon: 0.74,
    acquired: {
      date: "2013-04-28",
      precision: "DAY",
      basis:
        "Acquisition date on the source record — NASA Earth Observatory image 82844.",
    },
    orbit: {
      sensor: "LANDSAT-8 / OLI",
      inclination: "SSO 98.2°",
      track: "//ELIPSE 29°",
      altitudeKm: 705,
      gsdM: 30,
      azimuthDeg: 96,
      offNadirDeg: 3.3,
      cloudPct: 17,
    },
    credit: "http://earthobservatory.nasa.gov/IOTD/view.php?id=82844",
    source: "https://commons.wikimedia.org/wiki/File%3AThames_Estuary_and_Wind_Farms_from_Space_NASA.jpg",
  },
  {
    slug: "sao-paulo-br",
    src: "/imagery/sao-paulo-br.jpg",
    width: 2400,
    height: 2091,
    city: "SÃO PAULO",
    admin: "SÃO PAULO",
    countryCode: "BR",
    country: "BRAZIL",
    lat: -23.5505,
    lon: -46.6333,
    acquired: {
      date: "2010-04-18",
      precision: "DAY",
      basis:
        "Acquisition date on the source record, and encoded in scene IDs LT52190772010108CUB00 / LT52190762010108CUB00 — 2010, day 108.",
    },
    orbit: {
      sensor: "LANDSAT-5 / TM",
      inclination: "SSO 98.2°",
      track: "//ELIPSE 22°",
      altitudeKm: 705,
      gsdM: 30,
      azimuthDeg: 88,
      offNadirDeg: 5.2,
      cloudPct: 9,
    },
    credit: "Wikimedia Commons/NASA",
    source: "https://commons.wikimedia.org/wiki/File%3AS%C3%A3o_Paulo_satellite_image%2C_Landsat-5_2010-04-18_(cropped).jpg",
  },
  {
    slug: "rio-de-janeiro-br",
    src: "/imagery/rio-de-janeiro-br.jpg",
    width: 2400,
    height: 1807,
    city: "RIO DE JANEIRO",
    admin: "RIO DE JANEIRO",
    countryCode: "BR",
    country: "BRAZIL",
    lat: -22.9068,
    lon: -43.1729,
    acquired: {
      date: "2011-05-09",
      precision: "DAY",
      basis:
        "Acquisition date on the source record.",
    },
    orbit: {
      sensor: "LANDSAT-5 / TM",
      inclination: "SSO 98.2°",
      track: "//ELIPSE 24°",
      altitudeKm: 705,
      gsdM: 30,
      azimuthDeg: 91,
      offNadirDeg: 2.2,
      cloudPct: 6,
    },
    credit: "Wikimedia Commons/NASA",
    source: "https://commons.wikimedia.org/wiki/File%3ARio_de_Janeiro%2C_satellite_image%2C_LandSat-5%2C_2011-05-09_(cropped).jpg",
  },
  {
    slug: "buenos-aires-ar",
    src: "/imagery/buenos-aires-ar.jpg",
    width: 2400,
    height: 2431,
    city: "BUENOS AIRES",
    admin: "BUENOS AIRES",
    countryCode: "AR",
    country: "ARGENTINA",
    lat: -34.6037,
    lon: -58.3816,
    acquired: {
      date: "2011-08-21",
      precision: "DAY",
      basis:
        "Acquisition date on the source record, and encoded in scene ID LT52250842011233COA01 — 2011, day 233.",
    },
    orbit: {
      sensor: "LANDSAT-5 / TM",
      inclination: "SSO 98.2°",
      track: "//ELIPSE 31°",
      altitudeKm: 705,
      gsdM: 30,
      azimuthDeg: 94,
      offNadirDeg: 4.8,
      cloudPct: 13,
    },
    credit: "http://edcsns17.cr.usgs.gov/NewEarthExplorer/ image ID LT52250842011233COA01",
    source: "https://commons.wikimedia.org/wiki/File%3ABuenos_Aires%2C_city_and_vicinities%2C_satellite_image_LandSat-5%2C_2011-08-21%2C_near_natural_colors%2C_30_m_resolution.jpg",
  },
  {
    slug: "lisse-nl",
    src: "/imagery/lisse-nl.jpg",
    width: 2400,
    height: 1600,
    city: "LISSE",
    admin: "SOUTH HOLLAND",
    countryCode: "NL",
    country: "NETHERLANDS",
    lat: 52.2583,
    lon: 4.5575,
    acquired: {
      date: "2018-04-21",
      precision: "DAY",
      basis:
        "Acquisition date on the source record — NASA Earth Observatory image 92148.",
    },
    orbit: {
      sensor: "LANDSAT-8 / OLI",
      inclination: "SSO 98.2°",
      track: "//ELIPSE 38°",
      altitudeKm: 705,
      gsdM: 30,
      azimuthDeg: 107,
      offNadirDeg: 1.4,
      cloudPct: 3,
    },
    credit: "https://earthobservatory.nasa.gov/images/92148/flower-power-in-the-netherlands",
    source: "https://commons.wikimedia.org/wiki/File%3AFlower_Power_in_the_Netherlands.jpeg",
  },
  {
    slug: "seattle-us",
    src: "/imagery/seattle-us.jpg",
    width: 1280,
    height: 1280,
    city: "SEATTLE",
    admin: "WASHINGTON",
    countryCode: "US",
    country: "UNITED STATES",
    lat: 47.6062,
    lon: -122.3321,
    acquired: {
      date: "2014-08-23",
      precision: "DAY",
      basis:
        "Source record: “Landsat 7 image of Seattle, Washington acquired August 23, 2014.”",
    },
    orbit: {
      sensor: "LANDSAT-7 / ETM+",
      inclination: "SSO 98.2°",
      track: "//ELIPSE 44°",
      altitudeKm: 705,
      gsdM: 30,
      azimuthDeg: 118,
      offNadirDeg: 7.1,
      cloudPct: 22,
    },
    credit: "NASA Satellite Captures Super Bowl Cities – Seattle",
    source: "https://commons.wikimedia.org/wiki/File%3ALandsat_7_Captures_Super_Bowl_Cities_%E2%80%93_Seattle.jpg",
  },
  {
    slug: "cape-town-za",
    src: "/imagery/cape-town-za.jpg",
    width: 2184,
    height: 1377,
    city: "CAPE TOWN",
    admin: "WESTERN CAPE",
    countryCode: "ZA",
    country: "SOUTH AFRICA",
    lat: -33.9249,
    lon: 18.4241,
    acquired: {
      date: null,
      precision: "UNKNOWN",
      basis:
        "A Landsat frame draped over SRTM elevation (PIA04961). The source record dates the composite to February 2007 but does not say when the Landsat frame itself was acquired.",
    },
    orbit: {
      sensor: "LANDSAT + SRTM",
      inclination: "SSO 98.2°",
      track: "//ELIPSE 26°",
      altitudeKm: 705,
      gsdM: 30,
      azimuthDeg: 85,
      offNadirDeg: 3.9,
      cloudPct: 8,
    },
    credit: "8.727 MB TIFF ALSO AVAILABLE: http://photojournal.jpl.nasa.gov/catalog/PIA04961 http://www.nasa.gov/multimedia/imagegallery/image_feature_186.html",
    source: "https://commons.wikimedia.org/wiki/File%3ASatellite_image_of_Cape_peninsula.jpg",
  },
  {
    slug: "lena-delta-ru",
    src: "/imagery/lena-delta-ru.jpg",
    width: 2400,
    height: 2400,
    city: "LENA DELTA",
    admin: "SAKHA",
    countryCode: "RU",
    country: "RUSSIAN FEDERATION",
    lat: 72.5,
    lon: 126.5,
    acquired: {
      date: "2000-02-27",
      precision: "DAY",
      basis:
        "Source record: acquired by Landsat 7’s ETM+ sensor on 2000-02-27; the visualisation is dated 2002-08-19.",
    },
    orbit: {
      sensor: "LANDSAT-7 / ETM+",
      inclination: "SSO 98.2°",
      track: "//ELIPSE 61°",
      altitudeKm: 705,
      gsdM: 30,
      azimuthDeg: 141,
      offNadirDeg: 8.6,
      cloudPct: 1,
    },
    credit: "http://visibleearth.nasa.gov/view_detail.php?id=3451 Visible Earth v1 ID: 18024 Credit: Image provided by the USGS EROS Data Center Satellite Systems Branch. This image is part of the ongoing Landsat Earth as Art series. This image was acquired by Landsat 7’s Enhanced Thematic Mapper plus (ETM+) sensor on 2000-02-27 (Visualization Date: 2002-08-19). (The Lena Delta can be found on Landsat 7 WRS Path 131 Row 8/9, center: 72.21, 126.15.)",
    source: "https://commons.wikimedia.org/wiki/File%3ALena_River_Delta_-_Landsat_2000.jpg",
  },
  {
    slug: "samarkand-uz",
    src: "/imagery/samarkand-uz.jpg",
    width: 2400,
    height: 2042,
    city: "SAMARKAND",
    admin: "SAMARQAND",
    countryCode: "UZ",
    country: "UZBEKISTAN",
    lat: 39.627,
    lon: 66.975,
    acquired: {
      date: "2015-10-25",
      precision: "DAY",
      basis:
        "Acquisition date on the source record, and encoded in scene IDs LC81550322015298LGN00 / LC81550332015298LGN00 — 2015, day 298.",
    },
    orbit: {
      sensor: "LANDSAT-8 / OLI",
      inclination: "SSO 98.2°",
      track: "//ELIPSE 34°",
      altitudeKm: 705,
      gsdM: 30,
      azimuthDeg: 99,
      offNadirDeg: 2.9,
      cloudPct: 5,
    },
    credit: "http://earthexplorer.usgs.gov/ image ID LC81550322015298LGN00 and LC81550332015298LGN00",
    source: "https://commons.wikimedia.org/wiki/File%3ASamarkand_city_and_vicinities%2C_Uzbekistan%2C_LandSat-8_near_natural_colors_satellite_image%2C_25-OCT-2015.jpg",
  },
];

/** The landing-page hero frame. */
export const HERO_FRAME = CATALOGUE[0];

export function frameBySlug(slug: string): CatalogueFrame | undefined {
  return CATALOGUE.find((f) => f.slug === slug);
}
