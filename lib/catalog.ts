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

// Ground-sample-distance stops for the resolution slider, mapped to the SkyFi
// resolution enum used when placing a live tasking order.
export interface ResolutionStop {
  m: number;
  label: string;
  skyfi: string;
}

export const RESOLUTIONS: ResolutionStop[] = [
  { m: 0.25, label: "0.25 m", skyfi: "SUPER HIGH" },
  { m: 0.3, label: "0.30 m", skyfi: "VERY HIGH" },
  { m: 0.5, label: "0.50 m", skyfi: "HIGH" },
  { m: 1, label: "1 m", skyfi: "HIGH" },
  { m: 3, label: "3 m", skyfi: "MEDIUM" },
  { m: 10, label: "10 m", skyfi: "LOW" },
];

/** Nearest slider index for a tier's resolution label like "0.3 m" or "0.25–0.3 m". */
export function resolutionIndexFor(label: string): number {
  const first = parseFloat(label.replace(",", "."));
  if (Number.isNaN(first)) return 1;
  let best = 0;
  let bestD = Infinity;
  RESOLUTIONS.forEach((r, i) => {
    const d = Math.abs(r.m - first);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Map a GSD label ("0.30 m") to the SkyFi resolution enum for a sensor. */
export function resolutionToSkyfi(label: string | undefined, sensor: Sensor): string {
  if (sensor === "sar") return "HIGH";
  const stop = RESOLUTIONS.find((r) => r.label === label);
  return stop?.skyfi ?? "VERY HIGH";
}

// ── Pricing ────────────────────────────────────────────────────────────────
// Price is driven primarily by ground resolution (sharper = pricier), with a
// SAR premium and a per-tier surcharge for priority/bundled products.
const RES_PRICE: Record<string, number> = {
  "0.25 m": 79,
  "0.30 m": 49,
  "0.50 m": 29,
  "1 m": 19,
  "3 m": 12,
  "10 m": 9,
};
const TIER_SURCHARGE: Record<string, number> = {
  priority: 15,
  dossier: 25,
};

/** Final USD price for a concrete capture spec. Shared by the console + the
 *  checkout route so the client never sets its own amount. */
export function computePrice(
  tierId: string,
  sensor: Sensor,
  resolutionLabel: string
): number {
  const base = RES_PRICE[resolutionLabel] ?? 29;
  const sar = sensor === "sar" ? 1.3 : 1;
  const surcharge = TIER_SURCHARGE[tierId] ?? 0;
  return Math.max(9, Math.round(base * sar + surcharge));
}

/** Representative price shown on a tier card (its default spec). */
export function tierPrice(t: Tier): number {
  const label = RESOLUTIONS[resolutionIndexFor(t.resolution)].label;
  return computePrice(t.id, t.sensor, label);
}
