import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 86400;

// Address -> coordinates via OpenStreetMap Nominatim (keyless, fair-use).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "shot-from-space/1.0 (satellite tasking demo)",
        "Accept-Language": "en",
      },
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const data = (await res.json()) as any[];
    const results = data.map((r) => ({
      label: r.display_name as string,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      type: r.type as string,
    }));
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { results: [], error: (e as Error).message },
      { status: 200 }
    );
  }
}
