import { NextRequest, NextResponse } from "next/server";
import {
  celestrakUrl,
  parseTle,
  FALLBACK_TLES,
  CELESTRAK_GROUPS,
} from "@/lib/satellites";

export const runtime = "nodejs";
// Cache the TLE set for an hour — orbits don't change faster than that and it
// keeps us well under Celestrak's rate limits.
export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const group = req.nextUrl.searchParams.get("group") ?? "active";
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? "120", 10) || 120,
    400
  );
  const g = CELESTRAK_GROUPS[group] ?? "active";

  try {
    const res = await fetch(celestrakUrl(g), {
      next: { revalidate: 3600 },
      headers: { "User-Agent": "shot-from-space/1.0" },
    });
    if (!res.ok) throw new Error(`celestrak ${res.status}`);
    const text = await res.text();
    const tles = parseTle(text);
    if (tles.length === 0) throw new Error("empty TLE set");
    return NextResponse.json({
      source: "celestrak",
      group: g,
      count: Math.min(tles.length, limit),
      tles: tles.slice(0, limit),
    });
  } catch (e) {
    return NextResponse.json({
      source: "fallback",
      group: g,
      count: FALLBACK_TLES.length,
      note: `Celestrak unavailable (${(e as Error).message}); using curated set.`,
      tles: FALLBACK_TLES,
    });
  }
}
