// ─────────────────────────────────────────────────────────────────────────
// Imagery partners + the tasking tiers a customer can buy.
// The "partner" is the constellation that flies the capture; a "tier" is the
// product a user actually purchases (bundles one or more partners + a spec).
// ─────────────────────────────────────────────────────────────────────────

export type Sensor = "optical" | "sar" | "hyperspectral";

export interface Partner {
  id: string;
  name: string;
  sensor: Sensor;
  resolution: string; // ground sample distance, human readable
  blurb: string;
  /** Celestrak GP group its constellation is tracked under (for the globe). */
  noradGroup?: string;
  /** Does this partner expose a REST tasking API we can integrate? */
  api: "live" | "partner-account" | "none";
  site: string;
}

export const PARTNERS: Partner[] = [
  {
    id: "skyfi",
    name: "SkyFi",
    sensor: "optical",
    resolution: "0.5 m",
    blurb: "Marketplace aggregator — books the next open pass across a dozen constellations.",
    noradGroup: "active",
    api: "live",
    site: "https://skyfi.com",
  },
  {
    id: "planet",
    name: "Planet · SkySat",
    sensor: "optical",
    resolution: "0.5 m",
    blurb: "Agile SkySats retask on demand; PlanetScope images the whole landmass daily.",
    noradGroup: "planet",
    api: "partner-account",
    site: "https://planet.com",
  },
  {
    id: "capella",
    name: "Capella Space",
    sensor: "sar",
    resolution: "0.5 m",
    blurb: "Synthetic-aperture radar — sees through cloud, smoke and darkness.",
    noradGroup: "active",
    api: "partner-account",
    site: "https://capellaspace.com",
  },
  {
    id: "umbra",
    name: "Umbra",
    sensor: "sar",
    resolution: "0.25 m",
    blurb: "Highest-resolution commercial SAR; open-data archive for past captures.",
    noradGroup: "active",
    api: "partner-account",
    site: "https://umbra.space",
  },
  {
    id: "satellogic",
    name: "Satellogic",
    sensor: "optical",
    resolution: "1 m",
    blurb: "Vertically-integrated fleet built for high-frequency, low-cost tasking.",
    noradGroup: "active",
    api: "partner-account",
    site: "https://satellogic.com",
  },
  {
    id: "airbus",
    name: "Airbus · Pléiades Neo",
    sensor: "optical",
    resolution: "0.3 m",
    blurb: "Native 30 cm optical with same-day priority tasking over most of Earth.",
    noradGroup: "active",
    api: "partner-account",
    site: "https://intelligence.airbus.com",
  },
  {
    id: "copernicus",
    name: "Copernicus Sentinel-2",
    sensor: "optical",
    resolution: "10 m",
    blurb: "ESA open data via a keyless STAC — a real archive lookup runs live, no account needed.",
    noradGroup: "resource",
    api: "live",
    site: "https://dataspace.copernicus.eu",
  },
];

export function partner(id: string): Partner {
  const p = PARTNERS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown partner: ${id}`);
  return p;
}

export interface Tier {
  id: string;
  name: string;
  tagline: string;
  /** price in whole USD */
  price: number;
  currency: "usd";
  partnerId: string;
  sensor: Sensor;
  resolution: string;
  /** simulated time-to-acquisition window, minutes [min,max] */
  eta: [number, number];
  features: string[];
  highlight?: boolean;
}

export const TIERS: Tier[] = [
  {
    id: "recon",
    name: "Recon Pass",
    tagline: "One optical frame of your rooftop from low Earth orbit.",
    price: 19,
    currency: "usd",
    partnerId: "skyfi",
    sensor: "optical",
    resolution: "0.5 m",
    eta: [90, 240],
    features: [
      "0.5 m optical capture",
      "Next available daylight pass",
      "Georeferenced GeoTIFF + JPEG",
      "Cloud-cover screened",
    ],
  },
  {
    id: "priority",
    name: "Priority Tasking",
    tagline: "Jump the queue for a native 30 cm capture on the next pass overhead.",
    price: 49,
    currency: "usd",
    partnerId: "airbus",
    sensor: "optical",
    resolution: "0.3 m",
    eta: [45, 120],
    features: [
      "0.3 m native optical",
      "Priority pass — front of the queue",
      "Pan-sharpened true colour",
      "Delivery within one orbit window",
    ],
    highlight: true,
  },
  {
    id: "allweather",
    name: "All-Weather SAR",
    tagline: "Radar that punches through cloud, smoke and night. It always sees.",
    price: 39,
    currency: "usd",
    partnerId: "capella",
    sensor: "sar",
    resolution: "0.5 m",
    eta: [60, 180],
    features: [
      "0.5 m synthetic-aperture radar",
      "Works day or night, any weather",
      "Amplitude image + metadata",
      "Guaranteed capture, no cloud risk",
    ],
  },
  {
    id: "dossier",
    name: "Full Dossier",
    tagline: "Optical + SAR of the same coordinates, fused into one intel packet.",
    price: 89,
    currency: "usd",
    partnerId: "umbra",
    sensor: "optical",
    resolution: "0.25–0.3 m",
    eta: [90, 300],
    features: [
      "Optical 0.3 m + SAR 0.25 m",
      "Two independent constellations",
      "Change-detection overlay",
      "PDF intel dossier export",
    ],
  },
];

export function tier(id: string): Tier {
  const t = TIERS.find((x) => x.id === id);
  if (!t) throw new Error(`unknown tier: ${id}`);
  return t;
}
