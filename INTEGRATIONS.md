# INTEGRATIONS

Everything external sits behind an adapter in `lib/integrations/`. Each adapter
exposes one narrow interface with two implementations: a **mock** that runs by
default, and a **live** path that is written, commented and inactive until you
supply a key.

**Nothing in this repository requires a key to run.** `MOCK_MODE=true` is the
default and no adapter ever throws because a credential is missing.

---

## How the switch works

Two conditions must both be true for a service to go live:

1. `MOCK_MODE=false` in your environment, and
2. every variable that service needs is present.

`lib/env.ts` enforces this:

```ts
isLive('stripe')  // false if MOCK_MODE is true, or if any Stripe key is empty
```

This means you can flip services on **one at a time**. Set `MOCK_MODE=false`,
fill in Stripe only, and Stripe goes live while SkyFi, Gelato, ElevenLabs and
email stay mocked. The footer strip disappears once `NEXT_PUBLIC_MOCK_MODE` is
`false`; individual services that are still missing keys continue to mock
silently and log which ones on boot.

### Steps

```bash
cp .env.example .env        # already done for you locally
# paste keys into .env
MOCK_MODE=false
NEXT_PUBLIC_MOCK_MODE=false
npm run dev
```

---

## 1 · STRIPE — payments

**What it does today.** `lib/integrations/stripe.ts` creates a mock checkout
session and returns `/checkout/mock/{missionCode}`, a hosted-checkout-shaped
page that completes instantly with realistic latency. No money moves.

**What you must provide**

| Variable | Where to get it |
|---|---|
| `STRIPE_SECRET_KEY` | dashboard.stripe.com → Developers → API keys → Secret key (`sk_live_…` / `sk_test_…`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | same page → Publishable key (`pk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | dashboard.stripe.com → Developers → Webhooks → add endpoint `https://YOUR_DOMAIN/api/webhooks/stripe` → reveal signing secret (`whsec_…`) |

Paste all three into `.env` (and into your Vercel project's environment
variables for a deployment).

**Webhook events to subscribe to**
`checkout.session.completed`, `checkout.session.expired`,
`payment_intent.payment_failed`, `charge.refunded`.

**What flips.** `POST /api/orders` returns a real Stripe Checkout URL instead
of the mock page. Apple Pay and Google Pay appear automatically once your
domain is verified under Settings → Payments → Payment methods → Apple Pay
(add the domain; Stripe hosts the verification file for Checkout). The mock
checkout route stops being reachable. `checkout.session.completed` drives
`markMissionPaid()`, which transitions the mission to `MISSION_CONFIRMED` and
sends the order confirmation email.

**Test it.** Use `sk_test_…` with card `4242 4242 4242 4242`, then
`stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

---

## 2 · SKYFI — satellite tasking

**What it does today.** `lib/integrations/skyfi.ts` returns a deterministic
tasking order: an order id, a plausible 7–14 day capture window, and pass
telemetry (sensor, GSD, azimuth, off-nadir, inclination, orbit track,
altitude). The "captured" frame is selected from the public-domain Landsat
catalogue in `lib/imagery.ts`.

**What you must provide**

| Variable | Where to get it |
|---|---|
| `SKYFI_API_KEY` | app.skyfi.com → sign in → Account → API / Developers → generate key |
| `SKYFI_API_BASE_URL` | keep the default unless SkyFi gives you a different host |
| `SKYFI_WEBHOOK_SECRET` | the shared secret you configure on your SkyFi webhook, pointed at `https://YOUR_DOMAIN/api/webhooks/skyfi` |

You will also need a **funded SkyFi account** — tasking a satellite is a real,
per-capture cost, and orders are rejected without balance. Talk to SkyFi about
archive-versus-tasking pricing before going live; it materially changes unit
economics.

**What flips.** Entering `SATELLITE_TASKED` posts a real tasking order for the
mission's coordinates and area. `windowOpensAt` / `windowClosesAt` and all pass
telemetry come from SkyFi's response instead of the seeded generator. The
webhook (or the polling fallback in `getTaskingStatus`) advances the mission to
`IMAGE_ACQUIRED` and hands the downlinked frame to the poster composer.

**Caveat.** Some territories cannot be tasked. Handle a rejected order as a
declined mission plus an automatic refund — the hook is marked in
`lib/missions/`.

---

## 3 · GELATO — print and fulfilment

**What it does today.** `lib/integrations/gelato.ts` returns a mock print order
with a facility, carrier, tracking number and estimated delivery. Routing is
real: US-region missions print in the US, EU-region missions print in the EU,
decided by `regionForCountry()` in `lib/pricing.ts`.

**What you must provide**

| Variable | Where to get it |
|---|---|
| `GELATO_API_KEY` | dashboard.gelato.com → Developers → API keys → create |
| `GELATO_API_BASE_URL` | keep the default (`https://order.gelatoapis.com`) |
| `GELATO_WEBHOOK_SECRET` | dashboard.gelato.com → Developers → Webhooks → add `https://YOUR_DOMAIN/api/webhooks/gelato` |

**One thing you must verify yourself.** The product UIDs mapping our three
formats and the framed/unframed option to Gelato's catalogue are written as
plausible placeholders in `lib/integrations/gelato.ts`. Gelato's UIDs encode
paper stock, finish, frame colour and country. Pull your real catalogue from
their product API and replace the mapping table — it is a single object,
clearly marked. Nothing else changes.

**What flips.** Entering `PRINT` submits a real order with the composed print
file. `SHIPPED` is driven by Gelato's fulfilment webhook, which supplies the
real carrier and tracking number and updates the mission timeline.

---

## 4 · ANTHROPIC — the Mission Control operator

**What it does today.** `lib/integrations/llm.ts` runs a scripted operator that
matches intent and answers from the real mission state — actual capture window,
actual facility, actual tracking number — with realistic latency. It is good
enough to demo and honest about being scripted.

**What you must provide**

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys → create key (`sk-ant-…`) |
| `MISSION_CONTROL_MODEL` | optional; defaults to `claude-sonnet-4-20250514` |

**What flips.** Mission Comms calls the Messages API with the operator system
prompt already written in that file, passing the mission's live state as
context. The operator persona, its restrictions (never invent mission facts,
never use exclamation marks, escalate to the voice link when it cannot help)
and the context payload are all defined there.

**Cost note.** Each customer message is one API call with a small context.
Budget accordingly if comms volume grows; the adapter is the right place to add
caching or a cheaper model for common intents.

---

## 5 · ELEVENLABS — the voice link

**What it does today.** `lib/integrations/voice.ts` simulates the full call
lifecycle — `REQUESTING → CONNECTING → LIVE → ENDED` — with an operator
callsign, a call timer and a mocked audio level. No audio is produced, and the
call UI says so while mock mode is on.

**What you must provide**

| Variable | Where to get it |
|---|---|
| `ELEVENLABS_API_KEY` | elevenlabs.io → Profile → API key |
| `ELEVENLABS_AGENT_ID` | elevenlabs.io → Agents / Conversational AI → create an agent → copy its Agent ID |

Configure the agent with the Mission Control persona (reuse the system prompt
from `lib/integrations/llm.ts`) and a voice that matches the brand: level,
unhurried, technical.

**What flips.** `POST /api/comms/[code]/voice` requests a signed conversation
URL from ElevenLabs and returns it to the client, which opens a real WebSocket
audio session. The exact call and the point where the browser SDK attaches are
marked in the adapter. Note this is the one integration that also needs a
client-side package (`@elevenlabs/client`) — it is deliberately not installed,
so the mock build stays dependency-free.

---

## 6 · EMAIL — transactional messages

**What it does today.** `lib/integrations/email.ts` renders four real emails —
order confirmed, image acquired, shipped, magic link — as plain text and HTML,
logs them to the console in a readable block, and writes an `EmailLog` row so
they are inspectable in the database.

**What you must provide**

| Variable | Where to get it |
|---|---|
| `RESEND_API_KEY` | resend.com → API Keys → create (`re_…`) |
| `EMAIL_FROM` | must be an address on a domain you have verified at resend.com → Domains |

**What flips.** The same rendered emails are sent over the Resend API instead
of logged. Nothing about the templates changes. Swapping Resend for Postmark or
SES is a change to one function.

**Do not skip.** Magic-link sign-in depends on this. With email mocked, links
appear in the server console and on screen — convenient for review, unusable in
production.

---

## 7 · GEOCODING — address autocomplete

**What it does today.** `lib/integrations/geocode.ts` runs a believable mock
geocoder over a built-in dataset of real street addresses across US and EU
cities, ranks matches, and synthesises plausible results for arbitrary input so
autocomplete never dead-ends. `GET /api/geocode/static` serves the
capture-area preview by deterministically cropping a real Landsat frame for the
requested coordinates.

**What you must provide**

| Variable | Where to get it |
|---|---|
| `MAPBOX_ACCESS_TOKEN` | account.mapbox.com → Access tokens → create a token with `search` and `styles:tiles` scopes |

**What flips.** Autocomplete calls the Mapbox Search API. The static preview
calls the Mapbox Static Images API with a satellite style, which is what should
ship — the cropped-Landsat stand-in exists only so the demo needs no key.
Restrict the token by URL before deploying.

**Alternatives.** Google Places and Geoapify both drop into the same adapter
interface. If your customers are mostly in one country, a national address API
will beat all of them on accuracy.

---

## 8 · MAP BASEMAP — the tiles under the capture-framing map

**This one needs nothing from you either, and that is a decision rather than a
gap.** The basemap the buyer positions their capture frame on is EOX
**`s2cloudless`** — a cloud-free Sentinel-2 mosaic. It is **keyless**, licensed
**CC BY 4.0**, and **usable commercially**. Sentinel-2 is **10 m** ground
sample distance and the pyramid **serves to z17**.

That is not a compromise and the copy must not apologise for it. The buyer is
positioning a 1–4 km capture footprint, not choosing a rooftop pixel: at 10 m
a 2 km frame is 200 px across, which is ample to place a frame accurately.

**Attribution is a licence condition, not a nicety.** The string

```
Sentinel-2 cloudless by EOX IT Services GmbH (CC BY 4.0)
```

is required and is rendered on the map itself, always visible. It must always
name whichever provider actually served the pixels — if a key is supplied and
the basemap switches, the credit switches with it.

**What a key upgrades**

| Variable | Where to get it | What changes |
|---|---|---|
| `MAPTILER_KEY` | cloud.maptiler.com → Keys | basemap becomes a 0.3–0.5 m commercial mosaic, zoom ceiling rises past z17 to rooftop detail |
| `MAPBOX_ACCESS_TOKEN` | account.mapbox.com → Access tokens (`styles:tiles` scope) | same upgrade; this is the token §7 already uses |

`MAPBOX_ACCESS_TOKEN` is already in `.env.example` as an empty optional (§7);
`MAPTILER_KEY` is not there at all. Neither should ever become required. A key
changes **reference detail on the positioning map only**. It does
not change the mission, the tier, or the resolution of the frame the customer
buys — that comes from the capture the satellite is tasked to make, not from
the tiles used to aim it. Document the upgrade; never require it.

**Esri World Imagery was rejected — do not ship it.** It is 0.3–1 m, it
answers `200` without a key, and it is the obvious temptation for exactly that
reason. Its terms require an ArcGIS licence and do not permit this commercial
use. Reachable is not the same as licensed. It is absent from the provider
table on purpose, and it should stay absent.

**OpenStreetMap standard** tiles were the other keyless option considered.
They are ODbL and free to use, but they are a street map, not imagery, so they
cannot be what a buyer positions a photographic frame against. No OSM provider
is wired up today.

**Where it lives.** `lib/tiles.ts` selects the provider and carries its
required attribution; tiles are served through the app's own `/api/tiles`
route, so a key — when there is one — stays on the server and never reaches
the browser.

---

## 9 · CELESTRAK — orbital elements (THE ONE THAT IS ALREADY LIVE)

**This integration is not mocked and needs nothing from you.** CelesTrak
publishes general perturbations element sets over plain HTTPS, free, with no
account and no key, so it already meets the "a fresh clone runs with no
credentials" bar. Gating it behind `MOCK_MODE` would have meant showing
invented orbits on a readout whose whole claim is that the numbers are real.

**What it does.** `lib/integrations/celestrak.ts` fetches the Earth Resources
group once, cached three hours, and filters it to the eight satellites in
`lib/satellites/fleet.ts`. `lib/satellites/propagate.ts` runs SGP4 against those
elements in the browser, once a second, to drive the fleet tracker on
`/missions` and `/m/[code]`, and to compute the real capture windows on the
`/mission` flow's pass screen.

**Failure.** No network, an outage or a slow response all fall back to a
bundled snapshot (`lib/satellites/snapshot.json`) and the readout says so —
"from a set bundled with this build — the live request did not complete". It
always prints the element epoch and its age, because SGP4 error grows with
that age. Verified by pointing the adapter at an unreachable host.

**Courtesy.** CelesTrak runs on donated bandwidth. Do not lower
`REVALIDATE_SECONDS` (3 h) or fetch per-satellite — one request covers the
whole fleet. The `User-Agent` identifies this site deliberately.

**Pinned dependency.** `satellite.js` is pinned to **exactly 6.0.2**, not
caret-ranged. 7.x ships ESM-only with an `exports` map carrying no `default`
condition, which Turbopack cannot resolve for the client graph — and it does
not error, it *stalls*: one route hangs on "Compiling …" forever while the
server stays up and every other page serves. It presents as a network problem.
`transpilePackages` does not fix it. See the note in `lib/satellites/propagate.ts`.

---

## 10 · THE /mission FLOW — decisions only you can make

The 10-screen flow at `/mission` is built and works end to end in mock mode.
Everything tunable lives in **`lib/mission-flow/config.ts`**. These are not
engineering gaps; they are figures and policies that need an owner's sign-off
before anyone is charged.

| Decision | Where | Today |
|---|---|---|
| Tier prices and the size-supplement model | `lib/mission-flow/config.ts` | 79 / 189 / 349 EUR, placeholders |
| `CAPTURE_GSD_CM` — the only resolution figure the flow prints | same | 50 cm; confirm against the SkyFi VERY HIGH tier contract |
| `TASKING_LEAD_DAYS` — the commissioning cut-off | same | 2 days; currently an assumption, not an operator commitment |
| Surname source for `MISSION [LASTNAME]-001` | `lib/mission-flow/config.ts` | falls back to `MISSION 001`; nothing asks for a name before payment, by design |
| **Where delivery details are collected** | — | **the flow records the TARGET address only and never asks for a shipping address.** This must be resolved before fulfilment. |
| Whether `/start` or `/mission` is the real funnel | — | both exist and both create orders. See below. |

**TWO FLOWS NOW EXIST.** `/start` (`components/purchase/`) and `/mission`
(`components/mission-flow/`) both take a customer from an address to a charge.
Running both is a decision, not an accident of the build — but it should be a
deliberate one, because they can price the same object differently and they
collect different things. Pick one as the funnel and retire or repurpose the
other.

**Wallets.** Apple Pay / Google Pay are rendered first on the offer screen as
specified, but drawn and disabled, labelled "Wallets are simulated in mock
mode". Making them real needs `STRIPE_SECRET_KEY` (§1) **plus Apple Pay domain
verification** — the domain association file has to be served and the domain
registered in the Stripe dashboard. That is an extra step beyond pasting a key.

**Tiles.** The reveal screen degrades honestly: with no keyed provider it
composites the existing public-domain archive scene at rising zoom and states,
on screen, that the frame is not geo-registered to the address. Supplying
`MAPBOX_ACCESS_TOKEN` or `MAPTILER_KEY` (§8) is what makes that screen show the actual rooftop
and quote a real tile date.

---

## Runtime dependencies added

`motion` (motion.dev) — required by the vendored interior[.]dev components in
`components/interior/`. No key, no account, no network calls. See
`THIRD_PARTY.md`.

---

## Deployment checklist

- [ ] Every key above set in the Vercel project (Production and Preview).
- [ ] `MOCK_MODE=false` and `NEXT_PUBLIC_MOCK_MODE=false`.
- [ ] `NEXT_PUBLIC_SITE_URL` set to the real domain — magic links, share links
      and email links all derive from it.
- [ ] `DATABASE_URL` pointed at Postgres, not SQLite. See `REVIEW.md`.
- [ ] Webhook endpoints registered with Stripe, SkyFi and Gelato, each with its
      signing secret set.
- [ ] Apple Pay domain verified in Stripe.
- [ ] Map basemap: nothing to do. `s2cloudless` needs no key and its EOX
      attribution is already on the map. Set `MAPTILER_KEY` or
      `MAPBOX_ACCESS_TOKEN` only if you want rooftop-detail reference tiles
      (§8) — and never ship Esri World Imagery, which is keyless but not
      licensed for this.
- [ ] Sending domain verified with your email provider (SPF, DKIM).
- [ ] `shot.space` registered and redirecting `/M{code}` → `/m/{code}`, so the
      short link printed on every poster resolves.

---

## Where each adapter lives

| Service | File | Route(s) it powers |
|---|---|---|
| Stripe | `lib/integrations/stripe.ts` | `/api/orders`, `/api/checkout/*`, `/api/webhooks/stripe` |
| SkyFi | `lib/integrations/skyfi.ts` | mission transitions, `/api/webhooks/skyfi` |
| Gelato | `lib/integrations/gelato.ts` | mission transitions, `/api/webhooks/gelato` |
| Anthropic | `lib/integrations/llm.ts` | `/api/comms/[code]` |
| ElevenLabs | `lib/integrations/voice.ts` | `/api/comms/[code]/voice` |
| Email | `lib/integrations/email.ts` | mission transitions, `/api/auth/magic-link` |
| Geocoding | `lib/integrations/geocode.ts` | `/api/geocode/autocomplete`, `/api/geocode/static` |
| Map basemap | `lib/tiles.ts` | `/api/tiles` |
