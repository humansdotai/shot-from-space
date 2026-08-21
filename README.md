# Shot From Space 🛰️

**Task a satellite to photograph your house.** Drop a pin anywhere on Earth,
choose a capture spec, pay, and watch a live 3D mission-control globe track the
pass to your coordinates — then get the delivered image.

A humans.ai lab experiment, built in the spirit of
[0humans](https://0humans.com): an autonomous, zero-employee orbital imaging
desk. Live at **[shot-from-space.vercel.app](https://shot-from-space.vercel.app)**.

---

## What it does

1. **Lock the target** — geocode an address (OpenStreetMap Nominatim), use your
   browser location, type coordinates, or click the live satellite preview to
   refine the pin.
2. **Choose a capture** — optical or all-weather SAR, 0.5 m → 0.25 m, standard
   or priority tasking, priced per tier.
3. **Pay** — Stripe Checkout (live). The order round-trips entirely through the
   Stripe session metadata, so the app is **stateless** — no database.
4. **Watch it happen** — `/order/[id]` opens a real-time acquisition timeline
   over a 3D globe: the tasking satellite slews to the target, acquires,
   downlinks, and the capture is revealed. The delivered image is a **real
   overhead photo** of the exact coordinates (Esri World Imagery, keyless).
5. **Mission control** — `/mission-control` renders every tracked satellite,
   propagated live in the browser from Celestrak TLEs with SGP4.

## Live vs. simulated

The tasking layer sits behind one interface (`lib/tasking.ts`). With a partner
API key present it places a **real** order; without one it runs a faithful
**simulated** pass so the whole product works out of the box.

| Capability | Status |
| --- | --- |
| Live satellite globe (Celestrak + `satellite.js` SGP4) | ✅ real, no key |
| Real overhead imagery of any point (Esri World Imagery) | ✅ real, no key |
| Address geocoding (OSM Nominatim) | ✅ real, no key |
| Stripe payment | ✅ real (live keys) |
| **SkyFi** tasking (`POST /order-tasking`) | ✅ real (`SKYFI_API_KEY` configured) |
| **Copernicus Sentinel-2** archive (Element84 Earth Search STAC) | ✅ real, no key |
| Planet · Capella · Umbra · Airbus · Satellogic · Vantor | brokered live via SkyFi |

SkyFi is the primary live integration — the only partner where API keys are
self-serve *and* tasking is exposed over REST — and it brokers Planet, Umbra,
Satellogic, ICEYE, Vantor and Sentinel behind one key. Copernicus Sentinel-2 is
a second, fully keyless real integration (an actual archive lookup over the
target). SkyWatch EarthCache was dropped — its API is not publicly available.

Fulfilment always resolves to a real result: paid orders place a live SkyFi
tasking order; if the SkyFi key is ever absent, a real Copernicus Sentinel-2
archive scene over the coordinates is returned instead.

## Stack

- **Next.js 14** (App Router) · TypeScript · deployed on Vercel
- **three.js + three-globe** for the 3D Earth, **satellite.js** for SGP4 orbit
  propagation in the browser
- **Stripe** Checkout for payment
- No database — Stripe sessions are the source of truth

## Local development

```bash
npm install
cp .env.example .env.local   # add your Stripe keys
npm run dev                  # http://localhost:3000
```

### Environment variables

| Var | Required | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | ✅ | Stripe server key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | Stripe browser key |
| `NEXT_PUBLIC_SITE_URL` | — | Origin for redirect URLs (auto on Vercel) |
| `STRIPE_WEBHOOK_SECRET` | — | Enables `/api/webhook` order dispatch |
| `SKYFI_API_KEY` | — | Live tasking via SkyFi. Value is the `email:apikey` string, sent as the `X-Skyfi-Api-Key` header. |

## Routes

| Path | What |
| --- | --- |
| `/` | Landing + tasking console |
| `/mission-control` | Full-screen live satellite globe |
| `/order/[id]` | Post-payment acquisition tracker + delivered capture |
| `/api/checkout` | Creates a Stripe Checkout session |
| `/api/order/[id]` | Reads an order back from its Stripe session |
| `/api/satellites` | Proxies + caches Celestrak TLEs (1h) |
| `/api/geocode` | Address → coordinates (Nominatim) |
| `/api/webhook` | Optional Stripe webhook → dispatches live tasking |

---

*Imagery: Esri World Imagery · Basemap textures: NASA Blue Marble · Orbital
elements: Celestrak. Not affiliated with the imagery partners listed; those
integrations activate only when you supply your own credentials.*
