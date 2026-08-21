// Geospatial helpers: coordinate math + keyless satellite-imagery URLs.

export interface LatLng {
  lat: number;
  lng: number;
}

export function clampLat(lat: number): number {
  return Math.max(-85, Math.min(85, lat));
}

export function fmtCoord({ lat, lng }: LatLng): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}°${ns} ${Math.abs(lng).toFixed(5)}°${ew}`;
}

/** A meters-per-degree helper for building a bbox around a point. */
export function bboxAround({ lat, lng }: LatLng, meters: number) {
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return {
    minLng: lng - dLng,
    minLat: lat - dLat,
    maxLng: lng + dLng,
    maxLat: lat + dLat,
  };
}

/**
 * A REAL overhead satellite image of the given coordinates, pulled keyless
 * from Esri World Imagery (ArcGIS). This is what a "delivered capture" shows —
 * an actual photo of the customer's roof from orbit.
 */
export function esriImageUrl(p: LatLng, meters = 220, size = 1024): string {
  const b = bboxAround(p, meters);
  const bbox = `${b.minLng},${b.minLat},${b.maxLng},${b.maxLat}`;
  const base =
    "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export";
  const q = new URLSearchParams({
    bbox,
    bboxSR: "4326",
    imageSR: "4326",
    size: `${size},${size}`,
    format: "jpg",
    f: "image",
  });
  return `${base}?${q.toString()}`;
}

/** XYZ tile URL for Esri World Imagery — used by the interactive locator map. */
export function esriTileTemplate(): string {
  return "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
}

/** Web-mercator tile coords for a lat/lng/zoom. */
export function lngLatToTile(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y, z };
}
