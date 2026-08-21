import { NextRequest, NextResponse } from "next/server";
import {
  celestrakUrl,
  parseTle,
  FALLBACK_TLES,
  CELESTRAK_GROUPS,
  type Tle,
} from "@/lib/satellites";

export const runtime = "nodejs";
// Cache the TLE set for an hour — orbits don't change faster than that and it
// keeps us well under Celestrak's rate limits.
export const revalidate = 3600;

async function fetchGroup(g: string): Promise<Tle[]> {
  const res = await fetch(celestrakUrl(g), {
    next: { revalidate: 3600 },
    headers: { "User-Agent": "shot-from-space/1.0" },
  });
  if (!res.ok) throw new Error(`celestrak ${res.status} for ${g}`);
  const tles = parseTle(await res.text());
  if (tles.length === 0) throw new Error(`empty TLE set for ${g}`);
  return tles;
}

function dedupe(tles: Tle[]): Tle[] {
  const seen = new Set<string>();
  const out: Tle[] = [];
  for (const t of tles) {
    if (seen.has(t.name)) continue;
    seen.add(t.name);
    out.push(t);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const group = req.nextUrl.searchParams.get("group") ?? "active";
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? "120", 10) || 120,
    400
  );
  const g = CELESTRAK_GROUPS[group] ?? "active";

  try {
    // Celestrak rate-limits the huge "active" list (frequent 403s). For the
    // "all active" view we instead merge the reliable Earth-observation groups
    // into one diverse, real fleet.
    if (g === "active") {
      const groups = ["resource", "planet", "sar", "stations"];
      const settled = await Promise.allSettled(groups.map(fetchGroup));
      const merged = dedupe(
        settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      );
      if (merged.length === 0) throw new Error("all EO groups unavailable");
      return NextResponse.json({
        source: "celestrak",
        group: "eo-merged",
        count: Math.min(merged.length, limit),
        tles: merged.slice(0, limit),
      });
    }

    const tles = await fetchGroup(g);
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
