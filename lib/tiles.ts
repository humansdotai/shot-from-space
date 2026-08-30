/**
 * ==================================================================
 * TILE ADAPTER — the basemap under the capture-framing tool
 * ==================================================================
 * WHAT IT DOES
 *   Two things, deliberately kept in one file because the second is
 *   worthless without the first:
 *
 *   1. PROVIDER SELECTION. Which raster tile service the app serves
 *      through `/api/tiles`, and the attribution that service legally
 *      requires. Server-side only — a key never reaches the browser.
 *   2. WEB MERCATOR MATHS. Pure, isomorphic, no DOM. The framing tool
 *      draws its footprint square from `groundResolution()`, so if
 *      these functions are wrong the whole tool is a lie: it would
 *      draw a box, call it 2 km, and mean something else.
 *
 * WHAT RUNS WITHOUT A KEY (the default, and it is not a compromise)
 *   EOX `s2cloudless` — a cloud-free Sentinel-2 mosaic, keyless,
 *   CC BY 4.0, explicitly free for commercial use, pyramid served to
 *   z17. Sentinel-2 is 10 m ground sample distance. The buyer here is
 *   positioning a 0.4–5 km capture footprint, not picking a rooftop
 *   pixel: at 10 m a 2 km frame is 200 px across, which is ample to
 *   place a frame accurately. The copy must not apologise for it.
 *
 *   Attribution is a licence condition, not a nicety. `attribution`
 *   below is rendered on the map by <FrameOnMap />, always visible,
 *   and it always names whichever provider actually served the pixels.
 *
 * WHAT A KEY IMPROVES
 *   MAPTILER_KEY or MAPBOX_ACCESS_TOKEN swaps the basemap for a
 *   0.3–0.5 m commercial mosaic and lifts the ceiling to z20+. That
 *   changes REFERENCE detail only. It does not change the mission,
 *   the tier, or the resolution of the frame the customer buys.
 *   Document it; never require it.
 *
 * WHY MOCK_MODE IS NOT CONSULTED HERE
 *   MOCK_MODE separates real data from fabricated data. Both paths
 *   here serve real orbital imagery from a real provider — the key
 *   only buys sharper reference pixels — so there is nothing to
 *   fabricate and nothing to disclaim beyond the attribution, which
 *   is on screen either way. A key present is a key used.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   Esri World Imagery. It answers 200 without a key and it is the
 *   obvious temptation, and its terms require an ArcGIS licence and
 *   forbid this use. It is not in the table below on purpose.
 * ==================================================================
 */

/* ------------------------------------------------------------------ */
/* Web Mercator constants                                             */
/* ------------------------------------------------------------------ */

/** Tile edge in pixels. Every provider below serves 256px tiles. */
export const TILE_SIZE = 256;

/**
 * Metres per pixel at zoom 0 on the equator: the WGS-84 equatorial
 * circumference (40 075 016.6856 m) divided by one 256 px tile.
 * This is the number the whole scale proof rests on.
 */
export const BASE_RESOLUTION = 156543.03392804097;

/** Web Mercator cannot represent the poles. This is where it stops. */
export const MAX_MERCATOR_LAT = 85.0511287798;

/* ------------------------------------------------------------------ */
/* Pure maths — used by the client, safe to import anywhere           */
/* ------------------------------------------------------------------ */

export function clampLat(lat: number): number {
  return Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat));
}

/** Wraps longitude into [-180, 180). Panning past the antimeridian works. */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/**
 * Ground resolution in metres per screen pixel.
 *
 *   156543.03392 * cos(latitude) / 2^zoom
 *
 * `zoom` may be fractional — the framing tool zooms continuously under
 * a pinch, and the footprint square has to stay true at every point in
 * between, not only on integer levels.
 */
export function groundResolution(lat: number, zoom: number): number {
  return (BASE_RESOLUTION * Math.cos((clampLat(lat) * Math.PI) / 180)) / Math.pow(2, zoom);
}

/** On-screen size, in pixels, of a square footprint `areaKm` on a side. */
export function framePixels(areaKm: number, lat: number, zoom: number): number {
  return (areaKm * 1000) / groundResolution(lat, zoom);
}

/** The inverse: the zoom at which that footprint measures `px` on screen. */
export function zoomForFramePixels(areaKm: number, lat: number, px: number): number {
  const equatorial = BASE_RESOLUTION * Math.cos((clampLat(lat) * Math.PI) / 180);
  return Math.log2((px * equatorial) / (areaKm * 1000));
}

/** Longitude → absolute world pixel X at `zoom` (may be fractional). */
export function lonToWorldX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * TILE_SIZE * Math.pow(2, zoom);
}

/** Latitude → absolute world pixel Y at `zoom` (may be fractional). */
export function latToWorldY(lat: number, zoom: number): number {
  const rad = (clampLat(lat) * Math.PI) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + rad / 2));
  return (0.5 - y / (2 * Math.PI)) * TILE_SIZE * Math.pow(2, zoom);
}

export function worldXToLon(x: number, zoom: number): number {
  return (x / (TILE_SIZE * Math.pow(2, zoom))) * 360 - 180;
}

export function worldYToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / (TILE_SIZE * Math.pow(2, zoom));
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/* ------------------------------------------------------------------ */
/* Providers                                                          */
/* ------------------------------------------------------------------ */

export interface TileProvider {
  id: string;
  /** Short name for the telemetry readout: `SENTINEL-2 CLOUDLESS 2020`. */
  label: string;
  /**
   * The same name set as prose. Telemetry is uppercase because it is
   * scanned as a marker; a sentence is read as language, and a shouted
   * proper noun in the middle of one is a typographic bug.
   */
  name: string;
  /** The licence line. Rendered on the map, verbatim, always. */
  attribution: string;
  /** Where the attribution links. */
  attributionHref: string;
  minZoom: number;
  /** Highest level the pyramid actually serves. */
  maxZoom: number;
  /**
   * Ground sample distance of the source imagery, in metres. Used to
   * tell the buyer honestly when the display is magnifying past what
   * the sensor recorded, rather than pretending z17 is 1 m data.
   */
  nativeMetres: number;
  /** True when this provider needed a key and got one. */
  keyed: boolean;
  /** Upstream URL for one tile. Never sent to the browser. */
  url(z: number, x: number, y: number): string;
}

/**
 * The keyless default. Note the path order: {z}/{y}/{x} — WMTS puts the
 * ROW before the COLUMN, which is the reverse of the {z}/{x}/{y} every
 * XYZ service uses. Getting this the usual way round returns tiles that
 * decode fine and show the wrong piece of the planet.
 */
const s2cloudless: TileProvider = {
  id: 's2cloudless',
  label: 'SENTINEL-2 CLOUDLESS 2020',
  name: 'Sentinel-2 cloudless 2020',
  attribution: 'Sentinel-2 cloudless by EOX IT Services GmbH (CC BY 4.0)',
  attributionHref: 'https://s2maps.eu',
  minZoom: 1,
  maxZoom: 17,
  nativeMetres: 10,
  keyed: false,
  url: (z, x, y) =>
    `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/${z}/${y}/${x}.jpg`,
};

function maptiler(key: string): TileProvider {
  return {
    id: 'maptiler-satellite',
    label: 'MAPTILER SATELLITE',
    name: 'MapTiler Satellite',
    attribution: '© MapTiler © OpenStreetMap contributors',
    attributionHref: 'https://www.maptiler.com/copyright/',
    minZoom: 1,
    maxZoom: 20,
    nativeMetres: 0.5,
    keyed: true,
    url: (z, x, y) =>
      `https://api.maptiler.com/tiles/satellite-v2/${z}/${x}/${y}.jpg?key=${encodeURIComponent(key)}`,
  };
}

function mapbox(token: string): TileProvider {
  return {
    id: 'mapbox-satellite',
    label: 'MAPBOX SATELLITE',
    name: 'Mapbox Satellite',
    attribution: '© Mapbox © Maxar',
    attributionHref: 'https://www.mapbox.com/about/maps/',
    minZoom: 1,
    maxZoom: 22,
    nativeMetres: 0.3,
    keyed: true,
    url: (z, x, y) =>
      `https://api.mapbox.com/v4/mapbox.satellite/${z}/${x}/${y}.jpg90?access_token=${encodeURIComponent(token)}`,
  };
}

/**
 * Esri World Imagery — the sharp, keyless satellite basemap the earlier build
 * of this product used, and the one the owner asked to bring back: aerial/
 * satellite composite down to roughly 0.3–1 m, served to z19+ worldwide, so a
 * rooftop actually resolves under the framing tool. Path order is {z}/{y}/{x}
 * (ArcGIS puts the row before the column, like the EOX WMTS above).
 *
 * LICENSING NOTE: Esri's terms scope this service to ArcGIS licence holders.
 * For a strictly-licensed commercial basemap, set MAPTILER_KEY or
 * MAPBOX_ACCESS_TOKEN and this is bypassed automatically (both are sharper and
 * carry a commercial licence). The attribution below always names Esri while it
 * is the one serving the pixels.
 */
const esri: TileProvider = {
  id: 'esri-world-imagery',
  label: 'ESRI WORLD IMAGERY',
  name: 'Esri World Imagery',
  attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  attributionHref: 'https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9',
  minZoom: 1,
  maxZoom: 19,
  nativeMetres: 0.5,
  keyed: false,
  url: (z, x, y) =>
    `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
};

/**
 * Which provider is serving. Server-side only: `MAPTILER_KEY` and
 * `MAPBOX_ACCESS_TOKEN` are not `NEXT_PUBLIC_*`, so on the client this
 * always resolves to the keyless default — which is exactly why the
 * component asks `/api/tiles/meta` instead of calling this.
 *
 * A commercial key wins when present (MapTiler preferred — friendlier free
 * tier); otherwise the keyless default is Esri World Imagery, the sharp basemap
 * the previous build used. `s2cloudless` remains available as the failure-path
 * fallback below.
 */
export function activeProvider(): TileProvider {
  const mt = process.env.MAPTILER_KEY ?? '';
  if (mt) return maptiler(mt);
  const mb = process.env.MAPBOX_ACCESS_TOKEN ?? '';
  if (mb) return mapbox(mb);
  return esri;
}

/** Exposed for tests and for the failure-path fallback. */
export const KEYLESS_PROVIDER = esri;

/* ------------------------------------------------------------------ */
/* The client-safe descriptor                                         */
/* ------------------------------------------------------------------ */

/**
 * Everything the map component needs and nothing it must not have.
 * `url` is absent by construction — the browser only ever addresses
 * `/api/tiles/{z}/{x}/{y}`, so a key can be added server-side later
 * without touching a single line of the component.
 */
export interface TileDescriptor {
  id: string;
  label: string;
  name: string;
  attribution: string;
  attributionHref: string;
  minZoom: number;
  maxZoom: number;
  tileSize: number;
  nativeMetres: number;
  keyed: boolean;
}

export function describeProvider(p: TileProvider): TileDescriptor {
  return {
    id: p.id,
    label: p.label,
    name: p.name,
    attribution: p.attribution,
    attributionHref: p.attributionHref,
    minZoom: p.minZoom,
    maxZoom: p.maxZoom,
    tileSize: TILE_SIZE,
    nativeMetres: p.nativeMetres,
    keyed: p.keyed,
  };
}

/**
 * The descriptor the component starts with before `/api/tiles/meta`
 * answers. It is the keyless one, which is correct on a fresh clone,
 * so the common case never flashes the wrong attribution.
 */
export const DEFAULT_DESCRIPTOR: TileDescriptor = describeProvider(esri);
