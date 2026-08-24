# PIPELINE — capture to print

How a photograph taken from orbit becomes a framed object on someone's wall,
what of that is real today, and exactly which function you replace to make the
rest real.

Written for the engineer who inherits this. Nothing here is aspirational: if
something is a stand-in, it says so.

Owner: Agent 9 (print pipeline). Files: `lib/poster/**`,
`app/api/poster/[code]/route.ts`.

---

## 0. THE FOUR STAGES

```
  CAPTURE            COMPOSITION           COLOUR / PREP          FULFILMENT
  SkyFi tasking  →   the poster plate  →   print-ready file   →   Gelato + carrier
  lib/integrations   lib/poster              (not built yet)      lib/integrations
  /skyfi.ts                                                       /gelato.ts
```

Mission stages (`lib/types.ts` `MISSION_STAGES`) map onto it one to one:

| Stage | Pipeline step | Who moves it |
|---|---|---|
| `MISSION_CONFIRMED` | order paid, coordinates locked | Stripe webhook |
| `SATELLITE_TASKED` | `skyfi.requestTasking()` returns an order id | order worker |
| `CAPTURE_WINDOW` | passes scheduled, waiting on weather | SkyFi polling / webhook |
| `IMAGE_ACQUIRED` | frame downlinked; **preview released** | `skyfi.fetchCapture()` |
| `PROCESSING` | grade + compose the plate | `lib/poster` |
| `PRINT` | print file handed to the facility | `gelato.createPrintOrder()` |
| `SHIPPED` → `DELIVERED` | carrier events | Gelato webhook |

`MissionDTO.previewUrl` is `/api/poster/{code}` from `IMAGE_ACQUIRED` onward.
Before that the route answers **404 with a JSON error**, not a placeholder
image — there is genuinely no frame yet and pretending otherwise would be a
lie told in the product's own voice.

---

## 1. CAPTURE

### What happens live

1. **Feasibility.** `POST {base}/feasibility` with the AOI, the resolution
   tier and the acceptable window. Returns whether the point is collectable,
   when, at what GSD and for how much. This is the call that decides whether we
   can sell a mission at all for a given address, and it is *not* wired into
   `/start` today — the purchase flow assumes every address is feasible.
2. **Order.** `POST {base}/order-tasking` with the AOI polygon
   (`aoiPolygon(lat, lon, areaKm)` already builds it), the resolution tier and
   the window. Returns an order id. Persist it on `Order.taskingOrderId`.
3. **Wait.** Either poll `GET {base}/order/{orderId}` or take the webhook at
   `POST /api/webhooks/skyfi`. Prefer the webhook; poll as a safety net. A
   tasking order over a residential rooftop is not fast: 7–14 days of window is
   normal and cloud kills a meaningful share of first attempts. `CAPTURE_WINDOW`
   is a real stage because the wait is real.
4. **Downlink.** `GET {base}/order/{orderId}/download` returns a signed URL to
   the asset — a GeoTIFF (multi-band, often 16-bit, with the full georeference)
   or a rendered JPEG/PNG preview product, depending on the tier ordered.

### What we already carry

`lib/integrations/skyfi.ts` `CaptureResult` is the full shape the composer
needs, and it is already populated in mock mode:

```ts
{ orderId, captureId, capturedAt, cloudPct, sensor, gsdM,
  imagerySlug,          // mock only: a lib/imagery.ts catalogue slug
  assetUrl,             // mock: the local /imagery file. live: signed URL
  bbox }                // [west, south, east, north]
```

Pass telemetry (`inclination`, `track`, `altitudeKm`, `azimuthDeg`,
`offNadirDeg`) comes back from `requestTasking()` and is stored on the mission,
so `OrbitData` on the poster is already fed by the same field names the live
API returns. **The composer needs no new fields to go live.**

### Resolution — the honest gap

| | Demo (today) | Real tasking order |
|---|---|---|
| Source | Landsat archive, public domain | VHR commercial tasking |
| GSD | **30 m/px** | 0.3–0.5 m/px |
| A house | invisible — one pixel is 30 m across | 2–5 px across, roof shape resolves |
| Frame size | 1280–2400 px on the long edge | 10 000+ px, hundreds of MB GeoTIFF |
| Cost | zero | per-collection, VHR is the top tier |

This is the single largest difference between the demo and the product. The
demo frames are beautiful *cities*; the product sells a *house*. At 30 m GSD
the F70 print (70 × 100 cm) would need a source ~8268 px wide and the
catalogue's widest frame is 2400 px, so the demo poster is upsampled roughly
3.5×. At 0.5 m GSD a real tasked capture over a 1 km AOI is ~2000 px, and over
a 4 km AOI ~8000 px — which is why `areaKm` on the order matters as much as the
resolution tier.

**Consequence for the print file:** the AOI must be sized so that
`AOI_metres / GSD_metres >= print_pixels`. `lib/poster/layout.ts` `PRINT_INTENT`
gives `print_pixels` per format. Check this at order time, in feasibility, not
at print time.

---

## 2. COMPOSITION — what `lib/poster` does today

`lib/poster` composes the plate server-side with `sharp` (libvips + librsvg).
It is deterministic: the same options in produce byte-identical PNG out, which
is what makes the LRU cache and the route's `ETag` honest.

### Exports

```ts
composePoster(opts: PosterOptions): Promise<Buffer>   // print-intent, unwatermarked
composePreview(opts: PosterOptions): Promise<Buffer>  // low-res, watermarked
composeFallback(opts?, line?): Promise<Buffer>        // the designed failure plate
printGeometry(formatId): PrintIntent                  // 300 DPI pixel geometry
posterCacheKey(opts, width, ratio): string            // stable hash over the inputs
previewCacheKey(opts): string                         // the exact key/ETag for a preview
```

```ts
interface PosterOptions {
  slug?: string;            // a CATALOGUE frame
  imageBuffer?: Buffer;     // or a real downlinked capture
  missionCode: string;      // rendered as `MISSION / 32BF`
  capturedAt: string;       // ISO → `21:34PM 02.10.2026`
  lat: number; lon: number; // decimal degrees
  locationLabel: string;    // city level, never a street address
  orbit: OrbitData;
  formatId?: FormatId;      // drives ratio + the print-intent footer
  watermark?: boolean;
  width?: number;           // clamped 240…4800
  ratio?: '3:4' | '5:7' | '7:10' | '1:1';
  sourceLabel?: string;     // provenance line under the frame
  print?: boolean;          // render at 300 DPI trim geometry
}
```

### The pipeline inside `composePoster`

1. `resolveGeometry(width, ratio)` — every measurement on the plate is a
   fraction of the poster width, so the design holds at 700 px and at 3543 px.
2. `deletterbox()` — trims uniform near-black borders off the source, guarded
   so it can never eat a dark subject (it must keep ≥ 55% of the frame).
   Several archive frames are oblique renders pasted on black; without this the
   bars end up inside the image well.
3. `fitFrame()` — `cover` crop, centre position, a restrained grade
   (saturation 0.94, a small contrast lift) so the frame sits on the near-black
   margin instead of fighting it.
4. `grain()` — one gaussian pass at σ 7, soft-light, over the frame only, never
   over the type. Skipped above 2600 px wide.
5. `buildPlateSvg()` — the FUI layer as a single SVG string, composited on top.
6. PNG encode; `density` is stamped at 300 for print-intent renders.

### The plate

```
ORIGINAL / JPEG / DECLASSIFIED                        ORBIT: //ELIPSE 33°
──────────────────────────────────────────────────────────────────────────
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                    the satellite frame — ~70% of the plate             │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
30 M GSD / 3:4 / SINGLE FRAME              SOURCE / NASA · USGS / PUBLIC DOMAIN
──────────────────────────────────────────────────────────────────────────
MISSION / 32BF                                        ┌─────────────────┐
LOS ANGELES / CALIFORNIA / UNITED STATES              │ SHOT FROM SPACE │
                                                      └─────────────────┘
                                                       18:42PM 11.02.2026
                                                       34.0522, -118.2437
──────────────────────────────────────────────────────────────────────────
SENSOR         ALTITUDE   GSD    AZIMUTH   OFF-NADIR   CLOUD
LANDSAT · OLI-2  705 KM   30 M   104°      4.1°        02%

shot.space/M32BF                          FMT-30 / 30 × 40 CM / 300 DPI
```

Brand rules the composer enforces, not by convention but in code:

- `SHOT FROM SPACE` appears **only** inside the bordered credit box, paired
  with the timestamp and coordinates, and is never larger than the mission code
  above it. It is a print credit, not a logo.
- Exactly **one** signal-orange element per plate: `DECLASSIFIED` on a print
  plate, `LOW RESOLUTION` on a watermarked preview. Never both — see
  `data.watermark` in `plate.ts`.
- Six telemetry values, no more. The imagery carries the colour.
- A watermarked plate never claims a DPI it does not have: the footer reads
  `FMT-30 / 30 × 40 CM / PREVIEW`.

### Fonts

`sharp` renders SVG through librsvg + pango + fontconfig. Two things were
verified empirically, not assumed:

- **`@font-face` with a `data:` URI is silently ignored.** Embedding the WOFF2
  produced glyphs byte-identical to the default face — i.e. it did nothing.
- **fontconfig will index our WOFF2 directly** (FreeType ≥ 2.11 reads WOFF2),
  if you point it at `public/fonts` with a generated `fonts.conf`.

`lib/poster/fonts.ts` writes that config into `os.tmpdir()`, sets
`FONTCONFIG_FILE`, then **probes** by rendering the same string in
`IBM Plex Mono` and in `monospace` and comparing bytes. Identical output means
fontconfig never saw our files (it initialises once per process, so the env var
can arrive too late) and the stack falls back to the generic families, which
resolve to sharp's bundled DejaVu faces. Both branches render every glyph the
product uses — `°`, `·`, `—`, `Î`, `Ã` — and both are 0.6 em monospace, so the
layout maths in `monoWidth()` holds either way. On this machine the probe
resolves to IBM Plex Mono.

### Why `sharp`, and what replaces it for print

`sharp` is here because it was already a dependency, it needs no headless
browser, and it composes a 960 px preview in ~300 ms. That is the right tool
for **previews**. It is the wrong tool for a **print file**, and the current
output is a preview-grade stand-in, not a production asset:

- PNG only. No PDF, no vector type, no crop/bleed box.
- sRGB only. `sharp` can attach an ICC profile, but it has no real CMYK
  separation, no rendering intent, no black-point compensation.
- Type is rasterised at the render resolution. Fine at 300 DPI, but a printer
  would rather have live vector type at 1200 DPI for the hairlines and the
  small letterspaced telemetry.
- No bleed, no trim marks in the print sense (the corner marks on the plate are
  a design element, not registration for a cutter).

**The swap.** Keep `lib/poster/plate.ts` — it already emits a resolution-
independent SVG of the whole FUI layer, which is exactly what a print renderer
wants. Replace only the rasteriser:

| Today | Live print path |
|---|---|
| `buildPlateSvg()` → sharp composite → PNG | `buildPlateSvg()` → SVG → PDF at 300 DPI with embedded fonts and ICC |
| `composePoster()` | `renderPrintFile(missionCode): Promise<{url, bytes, checksum}>` |

Two viable renderers, neither of which needs the design to change:

1. **Headless Chromium** (Playwright) printing the SVG inside an HTML page to
   PDF. Gives live vector type, real font embedding, and `@page` bleed. Costs a
   browser in the deploy image.
2. **A native SVG→PDF library** (librsvg's own `rsvg-convert -f pdf`, or
   Cairo). Lighter, but text handling and colour management need checking per
   glyph.

The image itself is composited separately in either case: place the graded
capture as a linked/embedded raster at the exact well geometry from
`resolveGeometry()`, converted to the print profile.

**Design-tool alternative.** If the art direction is owned by a designer rather
than the code, the same swap works with a template: a Figma/Sketch/InDesign
master per format with named layers — `frame` (the image), `mission_code`,
`timestamp`, `coordinates`, `location`, `telemetry.*`, `credit_box` — driven by
the Figma REST API or an InDesign data-merge. The template needs exactly the
fields in `ResolvedPoster` plus the graded image. That path buys design control
and costs a round trip to a third-party service on every order.

### Print-intent resolution — stated plainly

`PRINT_INTENT` in `lib/poster/layout.ts`, computed from `FORMATS` trim sizes:

| Format | Trim | 300 DPI pixels |
|---|---|---|
| F30 | 30 × 40 cm | 3543 × 4724 |
| F50 | 50 × 70 cm | 5906 × 8268 |
| F70 | 70 × 100 cm | 8268 × 11811 |

`composePoster({ print: true, formatId })` renders at that geometry, clamped by
`MAX_RENDER_WIDTH = 4800`. F30 at full 3543 × 4724 takes ~1.7 s and produces a
~27 MB PNG. **F50 and F70 are clamped**: a true F70 render is 8268 px wide and
would be ~100 MB, which nothing on a request thread should allocate. That
clamp, and the 30 m source imagery behind it, are why today's "print" output is
a proof and not a deliverable.

---

## 3. COLOUR AND PRINT PREP — not built

Nothing in this repo does any of the following. It is listed so the gap is
visible rather than discovered at the first misprint.

- **Bleed.** Gelato wants 3 mm bleed on each edge for flat posters. The plate
  currently composes to trim exactly. Add bleed by rendering at
  `trim + 2×3 mm` and extending the near-black background into it — the design
  is background-dominant at the edges, so this is a background extension, not a
  re-layout.
- **Safe area.** Keep all type ≥ 5 mm inside trim. The plate's margin is
  6.2% of the width — 18.6 mm at F30, 43 mm at F70 — so it already clears this
  comfortably at every format.
- **DPI.** 300 DPI at trim size, effective, not interpolated. See the AOI/GSD
  inequality in §1.
- **Colour profile.** Output today is sRGB with no embedded profile. For print:
  soft-proof against the facility's profile, embed it, and decide the rendering
  intent (relative colorimetric with BPC is the sane default for imagery).
  Satellite false-colour composites — the Paris and Lena Delta frames are the
  obvious cases — shift hard in CMYK. Expect to hand-tune a per-frame grade or
  accept the shift.
- **Black.** The margin is `#08090b`. A single-channel K black at that value
  prints as washed grey on matte stock. A rich black build (roughly
  C60 M50 Y40 K100) is what makes the plate read as near-black on paper.
- **Paper stock.** 200 gsm uncoated white fine-art matte, per the Gelato
  product UIDs in `lib/integrations/gelato.ts`. Uncoated eats contrast; the
  grade in `fitFrame()` is tuned for screen and will need a print variant.
- **Framing.** Black wood, 12 mm profile (20 mm at F70), acrylic glazing —
  already encoded in `GELATO_PRODUCT_UID[*].FRAMED`. Framed products mount the
  same file; the frame eats a few mm of the sheet, which is another reason the
  safe area matters.

---

## 4. PRINT AND FULFILMENT

`lib/integrations/gelato.ts` is complete in shape and fully mocked.

- `createPrintOrder({ missionCode, formatId, frame, region, address, fileUrl })`
  → `POST {base}/v4/orders`.
- `getOrderStatus(orderId)` → `GET {base}/v4/orders/{id}`.
- `POST /api/webhooks/gelato` takes production and shipment events and advances
  the mission through `PRINT → SHIPPED → DELIVERED`.

**Product UIDs** are in `GELATO_PRODUCT_UID`, keyed `FormatId → FrameOption`.
They are the correct shape and intent (200 gsm matte poster; black wood framed
variant) but Gelato versions its catalogue, so re-read them from
`GET https://product.gelatoapis.com/v3/catalogs/posters/products` before a live
order. A wrong UID is a rejected order.

**Regional routing.** `regionForCountry()` in `lib/pricing.ts` sends EU/EEA + UK
+ CH to `EU`, everything else to `US`. `productionCountryFor(region)` turns that
into Gelato's preferred production country (`NL` / `US`), and
`PRINT_FACILITY[region]` is the human label shown in Mission Control
(`EU / EINDHOVEN, NL`, `US / RENO, NV`). This routing is the entire basis of the
"shipping and duties included" promise — do not let an order cross the Atlantic.

**File delivery.** Gelato **fetches** `fileUrl` itself; it does not accept an
upload. So the print file must be at a publicly reachable, stable URL that
survives long enough for production to pull it — object storage with a signed
URL of at least 7 days, not a Next.js route. `/api/poster/{code}` is **not** a
valid `fileUrl`: it is watermarked, it is low resolution, and it is not a print
file. Wire `renderPrintFile()` → upload → pass that URL.

**Shipping and tracking.** The mock returns a region-appropriate carrier, a
carrier-shaped tracking number, a working tracking URL template and an ETA 4–9
days out. Live, all four come off the Gelato order's shipment object and land on
`MissionDTO.carrier / trackingNumber / trackingUrl / estimatedDeliveryAt`.

---

## 5. FILE-BY-FILE MAP

### `lib/poster/index.ts`
Public surface. Re-exports the composer, the cache stats, the layout constants
and the types. Nothing else should reach into the submodules.

### `lib/poster/types.ts`
`PosterOptions`, `PosterRatio`, `ResolvedPoster`. `ResolvedPoster` is the fully
defaulted shape the plate renderer consumes — **this is the exact field list a
design template would need to be driven by.**

### `lib/poster/layout.ts`
Ratios (`FORMAT_RATIO`, derived from `FORMATS` so the poster can never drift
from the catalogue), `PRINT_INTENT`, width clamps, and `resolveGeometry()` —
every rail, baseline and margin on the plate as a fraction of its width.
*Live change:* add bleed to `resolveGeometry` (`trim + 3 mm` per edge) when the
print renderer lands.

### `lib/poster/fonts.ts`
`resolveFontStack()` — the fontconfig install + probe described in §2, cached
per process. `monoWidth()` measures monospace runs so the credit box can be
drawn around a string without a text-measuring API.
*Live change:* if the print renderer is headless Chromium, this file becomes
unnecessary for the print path (the browser reads WOFF2 natively) and stays for
previews.

### `lib/poster/svg.ts`
The eight SVG primitives the plate uses, plus `INK` — the palette mirrored from
`app/globals.css`. Keep the two in step by hand; there is no build step linking
them.

### `lib/poster/plate.ts`
**The design.** `buildPlateSvg()` returns the entire FUI layer as one
resolution-independent SVG string, and `buildEmptyWellSvg()` draws the hairline
grid used by the fallback. This is the file you edit to change how the poster
looks, and the file the print renderer keeps.

### `lib/poster/compose.ts`
The sharp pipeline: `deletterbox → fitFrame → grain → composite → encode`, plus
`composePoster` / `composePreview` / `composeFallback`.
*Live change:* **`composePoster()` is the function to replace.** Keep its
signature; swap the body for the 300 DPI SVG→PDF renderer, and have it return
the print file rather than a PNG. `composePreview()` stays on sharp.

### `lib/poster/cache.ts`
Bounded LRU: 32 entries, 96 MB total, single entries over 24 MB not cached.
In-process by design — it is a cache, not a store; cold starts recompose.
*Live change:* if previews get expensive, put them in object storage keyed by
`posterCacheKey()` and keep this as the hot tier.

### `app/api/poster/[code]/route.ts`
`GET /api/poster/{code}` → `image/png`, the watermarked preview.
- `?slug=` renders any `CATALOGUE` frame with no mission lookup — used by the
  archive gallery and the purchase preview.
- `?w=` output width, clamped to 2048.
- `?ratio=` overrides the format's ratio.
- `?print=1` renders at print-intent geometry, clamped to 2400 px, **still
  watermarked**. This route never emits a print file.
- `ETag` is `previewCacheKey()`; conditional requests get a 304. Archive frames
  cache for a day at the edge, mission previews for a minute.
- Returns 404 + JSON before `IMAGE_ACQUIRED`, and **never 500** — on any throw
  it serves `composeFallback()` with `X-Poster-Fallback: 1`.

### `lib/integrations/skyfi.ts` (Agent 8)
Today: deterministic mock tasking, and `fetchCapture()` returns a catalogue
slug chosen by proximity (`lib/missions/frames.ts`).
Live: replace `live.fetchCapture()` to download the signed asset and hand the
composer a real buffer via `PosterOptions.imageBuffer` instead of `slug`. That
is the only change the composer needs — it already accepts a buffer.

### `lib/integrations/gelato.ts` (Agent 8)
Today: deterministic mock order, facility, carrier, tracking, ETA.
Live: `live.createPrintOrder()` needs a real `fileUrl` from the print renderer,
and the product UIDs re-verified against the catalogue API.

---

## 6. KNOWN LIMITATIONS

Listed plainly, worst first.

1. **The source imagery is 30 m/px Landsat.** A house is not visible. Every
   poster in the demo is a city, not a home. This is the product's core claim
   and the demo cannot demonstrate it.
2. **`sharp` PNG is not a print file.** No PDF, no vector type, no CMYK, no ICC
   profile, no bleed. §2 and §3 describe what replaces it. Today's `?print=1`
   output is a proof.
3. **F50 and F70 print renders are clamped** to 4800 px in the library and
   2400 px on the route. Their true 300 DPI geometries (5906 and 8268 px wide)
   are exposed by `PRINT_INTENT` but not produced. `?print=1` is also the most
   expensive thing this route can be asked to do — ~2 s of CPU and a ~14 MB
   response at F50 — so put it behind the CDN or drop the clamp to 1600 px if
   it is ever exposed to untrusted traffic.
4. **Portrait posters crop landscape sources hard.** The plate's image well is
   roughly square; a 2400 × 1017 archive frame loses ~55% of its width to the
   centre crop. Correct for a tasked capture (the target is at frame centre),
   a compromise for archive frames composed for another purpose.
5. **PNG previews are large** — ~2.3 MB at 960 px, because a photograph in a
   lossless format is. Mitigated by the LRU and a stable `ETag`, not solved.
   The contract specifies `image/png`; WebP or AVIF at the same width would be
   roughly an order of magnitude smaller if that is ever relaxed.
6. **Font resolution is environment-dependent.** IBM Plex Mono renders when
   fontconfig can read `public/fonts`; on a deploy that does not ship static
   assets into the function filesystem, the plate silently falls back to DejaVu
   Sans Mono. Layout is identical, the typeface is not. Check
   `resolveFontStack().source` if a plate looks subtly wrong.
7. **The grade is tuned for screen.** `saturation 0.94`, `linear(1.04, -6)` on
   a near-black background. Matte uncoated stock will need its own grade.
8. **No feasibility gate at purchase.** `/start` will happily sell a mission
   over a target SkyFi cannot collect. §1 step 1 is where that check belongs.
9. **`lib/poster/svg.ts` `INK` duplicates `app/globals.css`.** Two sources of
   truth for the palette, kept in step by hand.
10. **The mission code on a `?slug=` render is cosmetic.** With no mission to
    look up, the route stamps whatever code is in the path (or `00AA`). The
    archive gallery passes stable codes from `lib/gallery.ts`; anything else
    gets a placeholder.
