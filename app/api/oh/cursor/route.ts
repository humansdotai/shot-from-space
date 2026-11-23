import { after, type NextRequest } from "next/server";
import { CURSOR_MAX_BODY_BYTES, cursorMode, observeCursor } from "@/lib/oh/cursor-ingest";

const noContent = (mode: string) =>
  new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store", "x-oh-cursor": mode } });

/**
 * Real-time cursor channel: same-origin batches of pointer samples from the live cursor sender
 * (createCursorChannel in lib/oh/live-cursor.ts), forwarded signed to the 0Humans console's
 * /cursor-ingest endpoint.
 *
 * Always answers 204 and is never cached, with `x-oh-cursor: on|slow|off` taken from
 * OH_CURSOR_MODE (default `on`): the back-off lever the sender obeys for the rest of its page view
 * (`slow`: a batch at most every 3 s, a tap or click at most once a second; `off`: stop). With `off` the route also reads and forwards
 * nothing. The signed POST runs in after(), so it never delays the answer. A no-op unless OH_OBSERVER_SECRET is set and OH_OBSERVER_URL ends in /observe. Only
 * same-origin JSON from a browser is read (Origin and Sec-Fetch-Site must agree when present, and
 * at least one must be present); the declared content-length must be present and at most 8 KB
 * before the body is read. The batch is then validated strictly and forwarded only for humans.
 * These checks stop cross-site browsers; a scripted client can still forge a batch, so the console
 * treats these rows as client claims and should rate-limit them per visitor.
 */
export async function POST(request: NextRequest) {
  const mode = cursorMode(process.env);
  try {
    if (mode === "off") return noContent(mode);
    const headers = request.headers;
    const fetchSite = headers.get("sec-fetch-site");
    const origin = headers.get("origin");
    if (fetchSite !== null && fetchSite !== "same-origin") return noContent(mode);
    if (origin !== null && origin !== request.nextUrl.origin) return noContent(mode);
    if (fetchSite === null && origin === null) return noContent(mode);
    if (!(headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return noContent(mode);
    const declared = headers.get("content-length");
    if (declared === null || !/^\d{1,5}$/.test(declared)) return noContent(mode);
    const length = Number(declared);
    if (length < 2 || length > CURSOR_MAX_BODY_BYTES) return noContent(mode);
    const raw = await request.text();
    if (raw.length > CURSOR_MAX_BODY_BYTES) return noContent(mode);
    const pending = observeCursor(headers, process.env, JSON.parse(raw));
    if (pending) after(pending);
  } catch {
    // A malformed batch is ignored.
  }
  return noContent(mode);
}
