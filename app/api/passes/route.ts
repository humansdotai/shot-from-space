import { NextRequest, NextResponse } from "next/server";
import * as satellite from "satellite.js";
import {
  celestrakUrl,
  parseTle,
  FALLBACK_TLES,
  type Tle,
} from "@/lib/satellites";

export const runtime = "nodejs";
export const revalidate = 0;

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

// Approximate solar elevation (degrees) at a point/time — for day/night gating.
function solarElevation(lat: number, lng: number, date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0;
  const g = (357.529 + 0.98560028 * d) % 360;
  const q = (280.459 + 0.98564736 * d) % 360;
  const L = (q + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD)) % 360;
  const e = 23.439 - 0.00000036 * d;
  const RA = Math.atan2(Math.cos(e * RAD) * Math.sin(L * RAD), Math.cos(L * RAD)) * DEG;
  const dec = Math.asin(Math.sin(e * RAD) * Math.sin(L * RAD)) * DEG;
  const gmst = (280.46061837 + 360.98564736629 * d) % 360;
  let ha = (gmst + lng - RA) % 360;
  if (ha < -180) ha += 360;
  if (ha > 180) ha -= 360;
  const el =
    Math.asin(
      Math.sin(lat * RAD) * Math.sin(dec * RAD) +
        Math.cos(lat * RAD) * Math.cos(dec * RAD) * Math.cos(ha * RAD)
    ) * DEG;
  return el;
}

async function fetchImagingTles(sensor: string): Promise<Tle[]> {
  const groups = sensor === "sar" ? ["sar"] : ["planet", "resource"];
  const all: Tle[] = [];
  await Promise.all(
    groups.map(async (g) => {
      try {
        const res = await fetch(celestrakUrl(g), {
          next: { revalidate: 3600 },
          headers: { "User-Agent": "shot-from-space/1.0" },
        });
        if (res.ok) all.push(...parseTle(await res.text()));
      } catch {
        /* ignore */
      }
    })
  );
  const seen = new Set<string>();
  const dedup = all.filter((t) => (seen.has(t.name) ? false : seen.add(t.name)));
  return dedup.length ? dedup.slice(0, 60) : FALLBACK_TLES;
}

interface Pass {
  aos: number; // acquisition-of-signal epoch ms
  peak: number; // peak-elevation epoch ms
  peakElevation: number;
  satName: string;
  sunElevation: number;
  lit: boolean;
}

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lng = parseFloat(req.nextUrl.searchParams.get("lng") ?? "");
  const sensor = req.nextUrl.searchParams.get("sensor") === "sar" ? "sar" : "optical";
  const nowParam = parseInt(req.nextUrl.searchParams.get("now") ?? "", 10);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }

  const observer = {
    longitude: lng * RAD,
    latitude: lat * RAD,
    height: 0.1, // km
  };

  const tles = await fetchImagingTles(sensor);
  const recs = tles
    .map((t) => {
      try {
        return { name: t.name, rec: satellite.twoline2satrec(t.line1, t.line2) };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as { name: string; rec: satellite.SatRec }[];

  const t0 = Number.isFinite(nowParam) ? nowParam : Date.now();
  const HORIZON_H = 48;
  const STEP_S = 45;
  const MIN_PEAK = 22; // degrees — a usable overhead pass
  const passes: Pass[] = [];

  for (const { name, rec } of recs) {
    let inPass = false;
    let peakEl = -90;
    let peakT = 0;
    let aosT = 0;
    for (let s = 0; s <= HORIZON_H * 3600; s += STEP_S) {
      const when = new Date(t0 + s * 1000);
      const pv = satellite.propagate(rec, when);
      if (!pv || !pv.position || typeof pv.position === "boolean") continue;
      const gmst = satellite.gstime(when);
      const ecf = satellite.eciToEcf(pv.position as satellite.EciVec3<number>, gmst);
      const look = satellite.ecfToLookAngles(observer as any, ecf);
      const el = look.elevation * DEG;
      if (el > 0) {
        if (!inPass) {
          inPass = true;
          aosT = when.getTime();
          peakEl = el;
          peakT = when.getTime();
        } else if (el > peakEl) {
          peakEl = el;
          peakT = when.getTime();
        }
      } else if (inPass) {
        // pass ended
        if (peakEl >= MIN_PEAK) {
          const sun = solarElevation(lat, lng, new Date(peakT));
          passes.push({
            aos: aosT,
            peak: peakT,
            peakElevation: Math.round(peakEl),
            satName: name,
            sunElevation: Math.round(sun),
            lit: sun > 0,
          });
        }
        inPass = false;
        peakEl = -90;
      }
    }
  }

  // optical needs daylight; SAR works any time
  let windows = passes.filter((p) => (sensor === "sar" ? true : p.lit));
  windows.sort((a, b) => a.peak - b.peak);
  // thin near-duplicate times (< 4 min apart), keep the higher-elevation one
  const thinned: Pass[] = [];
  for (const w of windows) {
    const near = thinned.find((x) => Math.abs(x.peak - w.peak) < 4 * 60000);
    if (!near) thinned.push(w);
    else if (w.peakElevation > near.peakElevation)
      thinned[thinned.indexOf(near)] = w;
  }

  return NextResponse.json({
    sensor,
    count: thinned.length,
    windows: thinned.slice(0, 8),
    tracked: recs.length,
  });
}
