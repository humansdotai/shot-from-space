/**
 * Edge observer for the 0Humans decision network (SHADOW mode).
 *
 * For each observed page request it builds one privacy-safe observation (contract C3), signs the
 * raw JSON body with HMAC-SHA256 (Web Crypto) and POSTs it fire-and-forget to OH_OBSERVER_URL.
 * Web APIs only (fetch, crypto.subtle, TextEncoder, AbortSignal.timeout), so it runs unchanged on
 * the Next middleware runtime.
 *
 * Guarantees: a no-op unless OH_OBSERVER_URL and OH_OBSERVER_SECRET are both set; never throws;
 * the returned promise never rejects; the response is never touched. No IP, raw cookie, query string
 * or raw user agent ever leaves this module. Two narrow exceptions, both optional: a validated
 * `?oh=<tag>` demo tag, and the analytics id from the `eyepup_session` cookie, which leaves only as a
 * keyed 12-hex hash (SHA-256 of OH_OBSERVER_SECRET + id) so the console can join this request to the
 * same visitor's Eyepup events. Cookies are read, never set. For humans, the user agent, the
 * low-entropy client hints, accept-language and the region header leave only as five allow-listed
 * coarse values (clientOf): a US state code, a browser family and major version, an OS family and a
 * primary language subtag.
 */

export type ActorClass = "human" | "ai_agent" | "search_bot" | "other_bot" | "unknown";
export type Device = "mobile" | "desktop" | "tablet" | "bot" | "unknown";
export type Browser =
  | "chrome"
  | "safari"
  | "firefox"
  | "edge"
  | "opera"
  | "samsung"
  | "brave"
  | "facebook_app"
  | "instagram_app"
  | "tiktok_app"
  | "google_app"
  | "other";
export type Os = "ios" | "android" | "windows" | "macos" | "chromeos" | "linux" | "other";

/** The coarse client fields of a human page view, in contract order. Null when unknown. */
export interface ClientFields {
  /** A US state or DC code, only when the country is US. */
  region: string | null;
  browser: Browser | null;
  /** 1 to 999; null for in-app browsers, `other` and anything out of range. */
  browser_major: number | null;
  os: Os | null;
  /** The primary language subtag of the first accept-language entry: 2 or 3 lowercase letters. */
  lang: string | null;
}

/** Contract C3 body, in contract key order. */
export interface Observation {
  v: 1;
  ts: string;
  path: string;
  actor_class: ActorClass;
  agent_name: string | null;
  device: Device;
  country: string | null;
  referrer_host: string | null;
  utm: { source?: string; medium?: string; campaign?: string };
  deployment_id: string | null;
  visitor: string | null;
  request_id: string | null;
  /** The five ClientFields keys: present for humans only (null when unknown), absent for agents, bots and unknown requesters. */
  region?: string | null;
  browser?: Browser | null;
  browser_major?: number | null;
  os?: Os | null;
  lang?: string | null;
  /** Present only when the URL carries a valid `?oh=<tag>`: marks a live-demo visitor. */
  demo?: string;
  /** Present only when an Eyepup analytics id is readable: SHA-256(secret + id), first 12 hex. */
  eyepup_key?: string;
  /** "client" when the page change happened inside the site (reported by the /api/oh/nav beacon). */
  nav?: "client";
}

/** The parts of a NextRequest the observer reads. */
export interface RequestLike {
  method: string;
  headers: { get(name: string): string | null };
  nextUrl: { pathname: string; searchParams: URLSearchParams };
}

type Env = Readonly<Record<string, string | undefined>>;

export const OBSERVER_TIMEOUT_MS = 2500; // after the response, so never seen by visitors; covers a tunnelled demo console
const MAX_BODY_BYTES = 4096; // the console answers 413 above 4 KB

/**
 * Self-identified agents, matched as case-insensitive substrings of the user agent. First match
 * wins, so a specific token precedes any token it contains (Applebot-Extended before Applebot).
 * Every ai_agent token must also appear in the robots.txt matcher in middleware.ts; the tests
 * enforce that.
 */
export const KNOWN_AGENTS: ReadonlyArray<readonly [token: string, actor: ActorClass]> = [
  // AI assistants, AI search and AI training crawlers.
  ["ChatGPT-User", "ai_agent"],
  ["OAI-SearchBot", "ai_agent"],
  ["GPTBot", "ai_agent"],
  ["Claude-SearchBot", "ai_agent"],
  ["Claude-User", "ai_agent"],
  ["Claude-Web", "ai_agent"],
  ["ClaudeBot", "ai_agent"],
  ["anthropic-ai", "ai_agent"],
  ["Perplexity-User", "ai_agent"],
  ["PerplexityBot", "ai_agent"],
  ["Google-Extended", "ai_agent"], // a robots.txt token rather than a UA today; kept for completeness
  ["Google-CloudVertexBot", "ai_agent"],
  ["Applebot-Extended", "ai_agent"],
  ["Applebot", "ai_agent"], // feeds Siri / Apple Intelligence answers
  ["meta-externalagent", "ai_agent"],
  ["meta-externalfetcher", "ai_agent"],
  ["FacebookBot", "ai_agent"], // Meta's language-model crawler (link previews are facebookexternalhit)
  ["Bytespider", "ai_agent"],
  ["CCBot", "ai_agent"],
  ["DuckAssistBot", "ai_agent"],
  ["YouBot", "ai_agent"],
  ["cohere-training-data-crawler", "ai_agent"],
  ["cohere-ai", "ai_agent"],
  ["Amazonbot", "ai_agent"],
  ["MistralAI-User", "ai_agent"],
  ["AI2Bot", "ai_agent"],
  ["Diffbot", "ai_agent"],
  // Search engine crawlers.
  ["Googlebot", "search_bot"], // also Googlebot-Image / -News / -Video
  ["Google-InspectionTool", "search_bot"],
  ["Storebot-Google", "search_bot"],
  ["bingbot", "search_bot"],
  ["BingPreview", "search_bot"],
  ["DuckDuckBot", "search_bot"],
  ["YandexBot", "search_bot"],
  ["Baiduspider", "search_bot"],
  ["PetalBot", "search_bot"],
  ["Slurp", "search_bot"],
  // Fetchers whose user agent carries no generic bot word.
  ["GoogleOther", "other_bot"],
  ["Google-Read-Aloud", "other_bot"],
  ["Mediapartners-Google", "other_bot"],
  ["facebookexternalhit", "other_bot"],
  ["WhatsApp", "other_bot"],
];

/** HTTP libraries and automation tools, matched at the start of the user agent. */
const AUTOMATION =
  /^(?:python-requests|python-urllib|python-httpx|httpx|aiohttp|curl|wget|libwww-perl|go-http-client|java|okhttp|axios|node-fetch|undici|node|deno|bun|scrapy|postmanruntime|insomnia)\b/i;
const BOT_WORDS =
  /bot\b|crawl|spider|slurp|scrap|fetch|headless|lighthouse|preview|monitor|uptime|validator|checker|phantomjs|puppeteer|playwright|selenium/i;
// Bounded: an unbounded lazy prefix here is quadratic on a hostile user agent (measured 464 ms at 32 KB).
const BOT_NAME = /\b[a-z][\w.-]{0,40}?(?:bot|crawler|spider|fetcher|scraper)\b/i;
const BROWSER = /^(?:Mozilla|Opera)\/.*(?:AppleWebKit|Gecko\/|Trident\/|Presto\/)/;

function agentName(raw: string | undefined): string | null {
  const name = (raw ?? "").replace(/[^\w.-]/g, "").slice(0, 40);
  return name || null;
}

function humanDevice(ua: string, chMobile: string | null): Device {
  if (/iPad|Tablet|PlayBook|Kindle|Silk\//i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (chMobile === "?1" || /Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini|BlackBerry/i.test(ua)) return "mobile";
  return "desktop";
}

/** Who is asking: user-agent tokens first, then the ChatGPT agent's request signature, then heuristics. */
export function classify(headers: RequestLike["headers"]): Pick<Observation, "actor_class" | "agent_name" | "device"> {
  // Classify on the first 512 characters: real user agents are far shorter, and this bounds every regex below.
  const ua = (headers.get("user-agent") ?? "").slice(0, 512).trim();
  const lower = ua.toLowerCase();
  for (const [token, actor] of KNOWN_AGENTS) {
    if (lower.includes(token.toLowerCase())) return { actor_class: actor, agent_name: token, device: "bot" };
  }
  // ChatGPT agent drives a real browser (so its UA looks human) but signs requests as chatgpt.com.
  if ((headers.get("signature-agent") ?? "").includes("chatgpt.com")) {
    return { actor_class: "ai_agent", agent_name: "ChatGPT-Agent", device: "bot" };
  }
  if (!ua) return { actor_class: "unknown", agent_name: null, device: "unknown" };
  const tool = ua.match(AUTOMATION);
  if (tool) return { actor_class: "other_bot", agent_name: agentName(tool[0]), device: "bot" };
  // "Cubot" is a phone brand, not a bot.
  if (BOT_WORDS.test(ua.replace(/cubot/gi, ""))) {
    const name = ua.match(BOT_NAME)?.[0];
    return { actor_class: "other_bot", agent_name: name?.toLowerCase() === "cubot" ? null : agentName(name), device: "bot" };
  }
  if (BROWSER.test(ua)) {
    return { actor_class: "human", agent_name: null, device: humanDevice(ua, headers.get("sec-ch-ua-mobile")) };
  }
  return { actor_class: "unknown", agent_name: null, device: "unknown" };
}

/** Agent-facing files advertised in llms.txt: observed for every requester. */
const AGENT_FILES = new Set(["/llms.txt", "/llms-full.txt"]);
/**
 * API routes, the operator pages (/admin), the mission-control data routes, framework internals,
 * metadata images and any path ending in a file extension.
 */
const NOT_A_PAGE =
  /^\/(?:api|admin|_next|_vercel|\.well-known|mission\/(?:fleet|passes|scene))(?:\/|$)|\.[^/]*$|(?:^|\/)(?:opengraph-image|twitter-image|apple-icon|icon)$/;

/** Mirrors the matcher in middleware.ts (the tests check that they agree) so the code is safe on its own. */
export function shouldObserve(pathname: string, actor: ActorClass): boolean {
  if (pathname === "/robots.txt") return actor === "ai_agent";
  if (AGENT_FILES.has(pathname)) return true;
  return !NOT_A_PAGE.test(pathname);
}

export function observerUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    // Plain http only to a local receiver: the body carries visitor hashes.
    const local = /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
    return url.protocol === "https:" || (url.protocol === "http:" && local) ? url.href : null;
  } catch {
    return null;
  }
}

/** Site routes use only these characters; anything else (markup, quotes, control or bidi characters, look-alikes) is not a route. */
export const ROUTE_PATH = /^\/[A-Za-z0-9._~\-/]{0,255}$/;

/**
 * Pages whose address names one customer's mission or order: the mission file and its poster short
 * link (/m/CODE and the /MCODE redirect), the shared link, the account's missions and the checkout.
 * The code is that customer's, so the whole path is redacted before it leaves the site. The archive
 * sheets (/missions/CODE) are public reference frames and stay as they are.
 */
const CUSTOMER_PAGE = /^\/(?:(?:m|s|account\/missions|checkout)\/.+|M\d{2}[A-Za-z]{2})$/i;

/** Paths are site routes; a non-route path, a customer's own page or one carrying a long number is redacted. */
export function safePath(pathname: string): string {
  const path = pathname.slice(0, 256);
  if (!ROUTE_PATH.test(path) || /\d{5,}/.test(path) || CUSTOMER_PAGE.test(path)) return "/(redacted)";
  return path;
}

/** True when both settings are present and the URL is acceptable: the layout renders the beacon only then. */
export function observerEnabled(env: Env): boolean {
  return Boolean(observerUrl(env.OH_OBSERVER_URL) && env.OH_OBSERVER_SECRET);
}

/**
 * The console's real-time cursor endpoint, derived from OH_OBSERVER_URL by replacing its trailing
 * `/observe` path segment with `/cursor-ingest` (https://c.example/api/glp1/observe becomes
 * https://c.example/api/glp1/cursor-ingest). Null when the observer URL is unusable or does not end
 * in `/observe`: the channel is then off rather than guessing an endpoint.
 */
export function cursorIngestUrl(env: Env): string | null {
  const raw = observerUrl(env.OH_OBSERVER_URL);
  if (!raw) return null;
  const url = new URL(raw);
  if (!/\/observe\/?$/.test(url.pathname)) return null;
  url.pathname = url.pathname.replace(/\/observe\/?$/, "/cursor-ingest");
  return url.href;
}

/** True when the real-time cursor channel can forward: the layout turns the browser half on only then. */
export function cursorChannelEnabled(env: Env): boolean {
  return Boolean(env.OH_OBSERVER_SECRET && cursorIngestUrl(env));
}

/** Host only, and only a public DNS name: IP literals and intranet names can identify a network. */
function referrerHost(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["http:", "https:", "android-app:"].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (!host.includes(".") || /^[\d.]+$/.test(host) || host.startsWith("[")) return null;
    if (/\.(?:local|localhost|internal|intranet|lan|corp|home|test|invalid)$/.test(host)) return null;
    return host.slice(0, 253);
  } catch {
    return null;
  }
}

/** UTM labels only, and only short plain ones: no emails, no long numbers. */
// A campaign tag is free text anyone can put in a link: one that looks like a phone number (however it is written), or names a
// personal field or a mail host, is never sent.
const UTM_PHONE_LIKE = /(?:\d[\s().+_-]*){7,}/;
const UTM_PERSONAL =
  /(?:^|[._ -])(?:dob|ssn|phone|tel|zip|addr|address|f?name|firstname|lastname|lname|fname)(?:$|[._ -])|gmail|yahoo|hotmail|outlook|icloud|aol|proton/i;

function utmOf(params: URLSearchParams): Observation["utm"] {
  const utm: Observation["utm"] = {};
  for (const key of ["source", "medium", "campaign"] as const) {
    const value = (params.get(`utm_${key}`) ?? "").trim().slice(0, 64);
    if (
      value &&
      !value.includes("@") &&
      !/\d{5,}/.test(value) &&
      /^[\w .:+~-]+$/.test(value) &&
      !UTM_PHONE_LIKE.test(value) &&
      !UTM_PERSONAL.test(value)
    )
      utm[key] = value;
  }
  return utm;
}

/** `?oh=<tag>` marks the presenter's own visit in a live demo; anything else in the query stays here. */
export function demoTag(params: URLSearchParams): string | null {
  const tag = params.get("oh");
  return tag && /^[A-Za-z0-9_-]{1,16}$/.test(tag) ? tag : null;
}

/**
 * The Eyepup (PostHog) distinct id from the `eyepup_session` persistence cookie, or null. The cookie
 * holds URL-encoded JSON; anything malformed, oversized or odd is ignored. The id never leaves raw.
 */
export function eyepupDistinctId(cookieHeader: string | null): string | null {
  try {
    if (!cookieHeader || cookieHeader.length > 8192) return null;
    for (const part of cookieHeader.split(";")) {
      const eq = part.indexOf("=");
      if (eq < 0 || part.slice(0, eq).trim() !== "eyepup_session") continue;
      const value = JSON.parse(decodeURIComponent(part.slice(eq + 1).trim()));
      const id = value && typeof value === "object" ? value.distinct_id : null;
      return typeof id === "string" && id.length >= 1 && id.length <= 200 && !/[\u0000-\u001f]/.test(id) ? id : null;
    }
  } catch {
    // A malformed cookie just means no join key.
  }
  return null;
}

const encoder = new TextEncoder();

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Hex HMAC-SHA256 of the exact body bytes: the `x-oh-signature` header the console verifies. */
export async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
}

async function sha256Hex(input: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(input)));
}

/** Country from the Vercel geo header: two capital letters, or null. */
export function countryOf(headers: RequestLike["headers"]): string | null {
  const raw = headers.get("x-vercel-ip-country");
  return raw && /^[A-Z]{2}$/.test(raw) ? raw : null;
}

/** The 50 states and DC: the only region codes that ever leave, and only with country US. */
export const US_STATES: ReadonlySet<string> = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "),
);

/** In-app browsers win: their user agents also carry the engine's own tokens. */
const IN_APP: ReadonlyArray<readonly [RegExp, Browser]> = [
  [/FBAN|FBAV|FB_IAB/, "facebook_app"],
  [/Instagram/, "instagram_app"],
  [/musical_ly|Bytedance|TikTok/i, "tiktok_app"],
  [/\bGSA\/\d/, "google_app"],
];
/** Low-entropy `sec-ch-ua` brands. A Map, so a brand named like an Object.prototype key maps to nothing. */
const BRANDS: ReadonlyMap<string, Browser> = new Map([
  ["Google Chrome", "chrome"],
  ["Microsoft Edge", "edge"],
  ["Opera", "opera"],
  ["Brave", "brave"],
  ["Samsung Internet", "samsung"],
]);
/** One `"brand";v="141"` entry (Samsung Internet sends "28.0"). Bounded, so linear on any input. */
const BRAND_ENTRY = /"([^"\\]{1,40})";\s?v="(\d{1,4})(?:\.\d{1,8}){0,3}"/g;
/** GREASE decoys such as "Not?A_Brand" or "Not)A;Brand". */
const DECOY_BRAND = /not.{0,3}a.{0,3}brand/i;
/** User-agent tokens, in order: a Chromium fork also says Chrome, and Chrome also says Safari. */
const UA_BROWSERS: ReadonlyArray<readonly [RegExp, Browser]> = [
  [/\bEdg(?:e|A|iOS)?\/(\d{1,4})/, "edge"],
  [/\b(?:OPR|OPiOS)\/(\d{1,4})/, "opera"],
  [/\bSamsungBrowser\/(\d{1,4})/, "samsung"],
  [/\b(?:Firefox|FxiOS)\/(\d{1,4})/, "firefox"],
  [/\b(?:Chrome|CriOS)\/(\d{1,4})/, "chrome"],
];
/** `sec-ch-ua-platform` values (quotes stripped). */
const PLATFORMS: ReadonlyMap<string, Os> = new Map([
  ["Windows", "windows"],
  ["macOS", "macos"],
  ["Android", "android"],
  ["iOS", "ios"],
  ["Chrome OS", "chromeos"],
  ["Chromium OS", "chromeos"],
  ["Linux", "linux"],
]);
/** User-agent tokens, in order: iPhones say "Mac OS X", Android and ChromeOS say "Linux". */
const UA_OSES: ReadonlyArray<readonly [RegExp, Os]> = [
  [/iPhone|iPad|iPod/, "ios"],
  [/Android/, "android"],
  [/CrOS/, "chromeos"],
  [/Windows/, "windows"],
  [/Macintosh|Mac OS X/, "macos"],
  [/Linux|X11/, "linux"],
];

/** A major version: an integer from 1 to 999, else null. */
function major(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 999 ? n : null;
}

/** In-app browser, then the `sec-ch-ua` brand (at most 6 entries), then user-agent tokens, else `other`. */
function browserOf(ua: string, brands: string): Pick<ClientFields, "browser" | "browser_major"> {
  for (const [pattern, browser] of IN_APP) if (pattern.test(ua)) return { browser, browser_major: null };
  let entries = 0;
  for (const entry of brands.slice(0, 256).matchAll(BRAND_ENTRY)) {
    if (++entries > 6) break;
    const name = entry[1].trim();
    if (name === "Chromium" || DECOY_BRAND.test(name)) continue;
    const browser = BRANDS.get(name);
    if (browser) return { browser, browser_major: major(entry[2]) };
  }
  for (const [pattern, browser] of UA_BROWSERS) {
    const found = ua.match(pattern);
    if (found) return { browser, browser_major: major(found[1]) };
  }
  const version = ua.match(/\bVersion\/(\d{1,4})/);
  if (version && /Safari\//.test(ua)) return { browser: "safari", browser_major: major(version[1]) };
  return { browser: "other", browser_major: null };
}

/** `sec-ch-ua-platform` first, then user-agent tokens, else `other`. An iPad in desktop mode reports macOS. */
function osOf(ua: string, platform: string): Os {
  const hinted = PLATFORMS.get(platform.slice(0, 32).replace(/"/g, "").trim());
  if (hinted) return hinted;
  for (const [pattern, os] of UA_OSES) if (pattern.test(ua)) return os;
  return "other";
}

/** The first accept-language entry, up to `;` and `-`, lowercased: 2 or 3 letters, else null. */
function langOf(raw: string | null): string | null {
  const tag = (raw ?? "").slice(0, 64).split(",")[0].split(";")[0].split("-")[0].trim().toLowerCase();
  return /^[a-z]{2,3}$/.test(tag) ? tag : null;
}

/**
 * The coarse client fields of a human page view, each from a fixed allow-list: the US state code
 * (`x-vercel-ip-country-region`, only when `country` is US), the browser family and major version
 * and the OS family (user agent, `sec-ch-ua`, `sec-ch-ua-platform`), and the primary language
 * subtag (`accept-language`). Every input is cut short before any pattern runs. No raw header value,
 * city, postal code, timezone, coordinates or high-entropy client hint is read or returned. Never throws.
 */
export function clientOf(headers: RequestLike["headers"], country: string | null): ClientFields {
  try {
    const ua = (headers.get("user-agent") ?? "").slice(0, 512).trim();
    const region = country === "US" ? headers.get("x-vercel-ip-country-region") : null;
    return {
      region: region !== null && US_STATES.has(region) ? region : null,
      ...browserOf(ua, headers.get("sec-ch-ua") ?? ""),
      os: osOf(ua, headers.get("sec-ch-ua-platform") ?? ""),
      lang: langOf(headers.get("accept-language")),
    };
  } catch {
    return { region: null, browser: null, browser_major: null, os: null, lang: null };
  }
}

/**
 * The daily, cookieless visitor key: first 16 hex of SHA-256(UTC day, user agent, accept-language,
 * country). The same browser gets a new key every UTC day. No IP is used.
 */
export function dailyVisitor(headers: RequestLike["headers"], country: string | null, ts: string): Promise<string> {
  const input = [ts.slice(0, 10), headers.get("user-agent") ?? "", headers.get("accept-language") ?? "", country ?? ""].join("\n");
  return sha256Hex(input).then((digest) => digest.slice(0, 16));
}

/** Same formula as the console's visitor_key(): sha256(secret + distinct_id)[:12]. */
export function eyepupKey(secret: string, analyticsId: string): Promise<string> {
  return sha256Hex(secret + analyticsId).then((digest) => digest.slice(0, 12));
}

/**
 * Signs `body` and POSTs it to `url` (fire-and-forget, 2.5 s timeout, no redirects). Skipped when
 * the body is over `maxBytes`. Never rejects.
 */
export async function postSigned(url: string, secret: string, body: string, maxBytes: number): Promise<void> {
  try {
    if (encoder.encode(body).length > maxBytes) return;
    const response = await fetch(url, {
      method: "POST",
      // ngrok-skip-browser-warning: harmless elsewhere; lets a tunnelled demo console receive the POST.
      headers: { "content-type": "application/json", "x-oh-signature": await hmacHex(secret, body), "ngrok-skip-browser-warning": "1" },
      body,
      redirect: "manual", // never re-send a signed body to wherever a redirect points
      signal: AbortSignal.timeout(OBSERVER_TIMEOUT_MS),
    });
    await response.body?.cancel();
  } catch {
    // Fire-and-forget: a slow, failing or unreachable observer is never the visitor's problem.
  }
}

async function send(url: string, secret: string, observation: Observation, headers: RequestLike["headers"], analyticsId: string | null): Promise<void> {
  try {
    observation.visitor = await dailyVisitor(headers, observation.country, observation.ts);
    if (analyticsId) observation.eyepup_key = await eyepupKey(secret, analyticsId);
    await postSigned(url, secret, JSON.stringify(observation), MAX_BODY_BYTES);
  } catch {
    // Fire-and-forget: a slow, failing or unreachable observer is never the visitor's problem.
  }
}

/** Builds one observation for `path` and returns the pending signed POST (never rejects). */
function dispatch(
  url: string,
  secret: string,
  headers: RequestLike["headers"],
  pathname: string,
  params: URLSearchParams,
  who: Pick<Observation, "actor_class" | "agent_name" | "device">,
  env: Env,
  now: Date,
  nav: "client" | null,
): Promise<void> {
  const country = countryOf(headers);
  const deployment = env.VERCEL_DEPLOYMENT_ID;
  const ts = now.toISOString();
  const observation: Observation = {
    v: 1,
    ts,
    path: safePath(pathname),
    ...who,
    country,
    // A page change inside the site has no external referrer (the beacon's referer is the site itself).
    referrer_host: nav ? null : referrerHost(headers.get("referer")),
    utm: utmOf(params),
    deployment_id: deployment && /^[\w-]{1,64}$/.test(deployment) ? deployment : null,
    visitor: null, // set in send(): first 16 hex of SHA-256(UTC day, user agent, accept-language, country)
    request_id: globalThis.crypto?.randomUUID?.() ?? null,
    // Humans only: agents, bots and unknown requesters get none of these keys.
    ...(who.actor_class === "human" ? clientOf(headers, country) : {}),
  };
  const demo = demoTag(params);
  if (demo) observation.demo = demo;
  if (nav) observation.nav = nav;
  return send(url, secret, observation, headers, eyepupDistinctId(headers.get("cookie")));
}

/**
 * Builds the observation synchronously (cheap header reads) and returns the pending signed POST,
 * or null when there is nothing to send. The promise never rejects. Hand it to `event.waitUntil`.
 */
export function observe(request: RequestLike, env: Env, now: Date = new Date()): Promise<void> | null {
  try {
    const url = observerUrl(env.OH_OBSERVER_URL);
    const secret = env.OH_OBSERVER_SECRET;
    if (!url || !secret || request.method !== "GET") return null;

    const { headers, nextUrl } = request;
    const who = classify(headers);
    if (!shouldObserve(nextUrl.pathname, who.actor_class)) return null;
    return dispatch(url, secret, headers, nextUrl.pathname, nextUrl.searchParams, who, env, now, null);
  } catch {
    return null;
  }
}

/**
 * A page change inside the site. Static routes are fully prefetched, so clicking a link usually makes
 * no request the proxy could see; the same-origin beacon route reports `path` (and the new URL's
 * query, of which only utm_* and a valid `oh` tag are kept) instead. Humans only. Never rejects.
 */
export function observeNavigation(
  headers: RequestLike["headers"],
  env: Env,
  path: unknown,
  search: unknown,
  now: Date = new Date(),
): Promise<void> | null {
  try {
    const url = observerUrl(env.OH_OBSERVER_URL);
    const secret = env.OH_OBSERVER_SECRET;
    if (!url || !secret || typeof path !== "string") return null;
    if (!ROUTE_PATH.test(path) || path.startsWith("//")) return null;
    const params = new URLSearchParams(typeof search === "string" ? search.slice(0, 512) : "");
    const who = classify(headers);
    if (who.actor_class !== "human" || !shouldObserve(path, who.actor_class)) return null;
    return dispatch(url, secret, headers, path, params, who, env, now, "client");
  } catch {
    return null;
  }
}
