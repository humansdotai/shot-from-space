import { after, type NextRequest } from "next/server";
import { observeNavigation } from "@/lib/oh/edge-observer";

const MAX_BODY_BYTES = 1024;
const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });

/**
 * Same-origin beacon for page changes inside the site (client-side navigation). Static routes are
 * fully prefetched, so a click usually makes no request the proxy (middleware.ts) could see; the
 * OhNavBeacon component reports the new path here instead.
 *
 * Always answers 204 and is never cached. The signed POST to the console runs in after(), so it never
 * delays the answer. A no-op without OH_OBSERVER_URL and OH_OBSERVER_SECRET. Only same-origin JSON
 * from a browser is read (Origin and Sec-Fetch-Site must agree when present); everything is checked
 * before the body is read, and bodies over 1 KB are ignored. These checks stop cross-site browsers;
 * a scripted client can still forge a beacon, so console rows with nav: "client" are client claims.
 */
export async function POST(request: NextRequest) {
  try {
    const headers = request.headers;
    const fetchSite = headers.get("sec-fetch-site");
    const origin = headers.get("origin");
    if (fetchSite !== null && fetchSite !== "same-origin") return noContent();
    if (origin !== null && origin !== request.nextUrl.origin) return noContent();
    if (fetchSite === null && origin === null) return noContent();
    if (!(headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return noContent();
    const declared = Number(headers.get("content-length") ?? "0");
    if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) return noContent();
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return noContent();
    const body = JSON.parse(raw) as { path?: unknown; search?: unknown } | null;
    if (!body || typeof body !== "object") return noContent();
    const pending = observeNavigation(headers, process.env, body.path, body.search);
    if (pending) after(pending);
  } catch {
    // A malformed beacon is ignored.
  }
  return noContent();
}
