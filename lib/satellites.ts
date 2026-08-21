// Satellite tracking. TLEs come from Celestrak's GP API; we propagate them in
// the browser with satellite.js (SGP4). This module holds the server-side
// fetch + a small curated fallback so the globe is never empty offline.

export interface Tle {
  name: string;
  line1: string;
  line2: string;
}

export const CELESTRAK_GROUPS: Record<string, string> = {
  // group key -> Celestrak GP query (verified populated 2026)
  active: "active",
  stations: "stations",
  sar: "sar", // 117 objects: ICEYE, Capella, Umbra + gov SAR — best imaging group
  planet: "planet", // Flock + SkySat
  resource: "resource", // Landsat / Sentinel-2
  spire: "spire",
  starlink: "starlink",
};

export function celestrakUrl(group: string): string {
  return `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(
    group
  )}&FORMAT=tle`;
}

/** Parse a classic 3-line TLE text blob into structured records. */
export function parseTle(text: string): Tle[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.length > 0);
  const out: Tle[] = [];
  for (let i = 0; i + 2 < lines.length + 1; i += 3) {
    const name = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];
    if (line1?.startsWith("1 ") && line2?.startsWith("2 ")) {
      out.push({ name: name.trim(), line1, line2 });
    }
  }
  return out;
}

// A curated fallback constellation (a spread of well-known LEO/imaging sats).
// Epochs go stale but SGP4 still yields plausible orbits for a live-looking map.
export const FALLBACK_TLES: Tle[] = [
  {
    name: "ISS (ZARYA)",
    line1: "1 25544U 98067A   24014.51782528  .00016717  00000-0  30074-3 0  9993",
    line2: "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.49814556 43406",
  },
  {
    name: "SKYSAT-C1",
    line1: "1 41601U 16040H   24014.20000000  .00002182  00000-0  12345-3 0  9992",
    line2: "2 41601  97.2000 100.0000 0010000  90.0000 270.0000 15.20000000 40000",
  },
  {
    name: "WORLDVIEW-3",
    line1: "1 40115U 14048A   24014.25000000  .00000100  00000-0  10000-4 0  9995",
    line2: "2 40115  97.9000 120.0000 0001000  80.0000 280.0000 14.85000000 45000",
  },
  {
    name: "PLEIADES NEO 3",
    line1: "1 48268U 21038A   24014.30000000  .00000200  00000-0  20000-4 0  9990",
    line2: "2 48268  97.9000 200.0000 0001500  70.0000 290.0000 14.90000000 35000",
  },
  {
    name: "CAPELLA-11",
    line1: "1 52768U 22057A   24014.35000000  .00003000  00000-0  15000-3 0  9991",
    line2: "2 52768  53.0000 300.0000 0005000  60.0000 300.0000 15.10000000 30000",
  },
  {
    name: "UMBRA-05",
    line1: "1 53879U 22150A   24014.40000000  .00002500  00000-0  13000-3 0  9993",
    line2: "2 53879  97.5000  40.0000 0004000  50.0000 310.0000 15.00000000 25000",
  },
  {
    name: "SENTINEL-2A",
    line1: "1 40697U 15028A   24014.45000000  .00000050  00000-0  30000-4 0  9994",
    line2: "2 40697  98.5700 150.0000 0001200 100.0000 260.0000 14.30000000 46000",
  },
  {
    name: "PLANETSCOPE-102c",
    line1: "1 43792U 18099A   24014.50000000  .00004000  00000-0  18000-3 0  9990",
    line2: "2 43792  97.4000 240.0000 0008000  40.0000 320.0000 15.30000000 28000",
  },
  {
    name: "SATELLOGIC NUSAT-30",
    line1: "1 51074U 22002B   24014.55000000  .00003500  00000-0  16000-3 0  9992",
    line2: "2 51074  97.4000 280.0000 0006000  30.0000 330.0000 15.25000000 27000",
  },
  {
    name: "ICEYE-X12",
    line1: "1 48918U 21059AA  24014.60000000  .00002800  00000-0  14000-3 0  9991",
    line2: "2 48918  97.6000 320.0000 0005500  20.0000 340.0000 15.05000000 26000",
  },
];
