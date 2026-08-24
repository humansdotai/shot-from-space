# IMAGERY

Every frame in `public/imagery` is a **public-domain NASA / USGS Landsat
product**, sourced through Wikimedia Commons. Nothing in this repository is
licensed, watermarked, purchased or third-party-owned.

These frames stand in for real captures throughout the demo: the mission
archive, the landing hero, the seeded demo missions, the capture-area preview
in the purchase flow, and the poster composer. In production they are replaced
by SkyFi tasking output — see `PIPELINE.md`.

Pictures OF spacecraft are a separate and much more restricted matter, and
they live in `public/spacecraft` under their own audit — see
**SPACECRAFT HARDWARE IMAGERY** at the foot of this file. Read that section
before adding any image of a satellite to this site.

## Processing applied

Downloaded at up to 2560px, resized to a maximum width of 2400px and
re-encoded as progressive JPEG at quality 82 (mozjpeg). No cropping, no colour
grading, no compositing. Total committed weight: 12.4 MB.

## A note on resolution

Landsat imagery has a ground sample distance of roughly 30 metres — it resolves
city blocks, coastlines and infrastructure, not individual houses. It is used
here because it is genuinely public domain and genuinely from orbit. Product
copy never claims these example frames show a single address; a real mission is
tasked at sub-metre resolution through SkyFi.

## Metadata

Each frame's coordinates, acquisition date and orbit telemetry live in
`lib/imagery.ts`.

**Coordinates and acquisition dates are real.** `acquired.date` is the date the
scene's own source record states, at the precision that record supports — a day
for most, a year for `las-vegas-us` (a frame from a 1972–2023 time series), and
`null` for `cape-town-za`, whose record does not date the Landsat frame inside
the composite. `acquired.basis` quotes the evidence for each one, and
`/legal/imagery` prints both.

These frames used to carry invented 2026 capture timestamps, which the
attribution page rendered as the scene's date beside a credit naming the real
acquisition — Berlin dated 04.03.2026 next to a credit reading "Berlin 1986 07
31". If you add a frame, read its Commons record and record what it says. If it
states no date, set `precision: 'UNKNOWN'` and leave `date` null; the page
renders "DATE NOT STATED", which is a correct answer.

`orbit.sensor` is also taken from the record. The rest of the orbit block —
inclination, ground track, azimuth, off-nadir, cloud — is plausible operational
telemetry assigned for the demo, and appears only on decorative surfaces, never
on the attribution page.

## Catalogue

| Slug | Dimensions | Size | Licence | Credit | Source |
|---|---|---|---|---|---|
| `hero-los-angeles` | 2400×1017 | 609 KB | Public domain | http://photojournal.jpl.nasa.gov/catalog/PIA03376 | [source](https://commons.wikimedia.org/wiki/File%3ALos_Angeles_JPLLandsat.jpg) |
| `paris-fr` | 2400×2530 | 1674 KB | Public domain | http://glovis.usgs.gov/ image ID LT51990262006197KIS00 | [source](https://commons.wikimedia.org/wiki/File%3AParis_and_vicinities%2C_LandSat-5_false_color_satellite_image%2C_2006-07-16.jpg) |
| `berlin-de` | 2400×1388 | 690 KB | Public domain | Berlin 1986 07 31 | [source](https://commons.wikimedia.org/wiki/File%3ABerlin_1986_07_31_(32824581725).jpg) |
| `las-vegas-us` | 2400×1350 | 692 KB | Public domain | 50+ years of Landsat: Las Vegas | [source](https://commons.wikimedia.org/wiki/File%3A50%2B_years_of_Landsat-_Las_Vegas_(SVS31195_-_landsat_las_vegas_2023).tiff) |
| `london-uk` | 2400×1920 | 591 KB | Public domain | http://earthobservatory.nasa.gov/IOTD/view.php?id=82844 | [source](https://commons.wikimedia.org/wiki/File%3AThames_Estuary_and_Wind_Farms_from_Space_NASA.jpg) |
| `sao-paulo-br` | 2400×2091 | 1261 KB | Public domain | Wikimedia Commons/NASA | [source](https://commons.wikimedia.org/wiki/File%3AS%C3%A3o_Paulo_satellite_image%2C_Landsat-5_2010-04-18_(cropped).jpg) |
| `rio-de-janeiro-br` | 2400×1807 | 907 KB | Public domain | Wikimedia Commons/NASA | [source](https://commons.wikimedia.org/wiki/File%3ARio_de_Janeiro%2C_satellite_image%2C_LandSat-5%2C_2011-05-09_(cropped).jpg) |
| `buenos-aires-ar` | 2400×2431 | 1372 KB | Public domain | http://edcsns17.cr.usgs.gov/NewEarthExplorer/ image ID LT52250842011233COA01 | [source](https://commons.wikimedia.org/wiki/File%3ABuenos_Aires%2C_city_and_vicinities%2C_satellite_image_LandSat-5%2C_2011-08-21%2C_near_natural_colors%2C_30_m_resolution.jpg) |
| `lisse-nl` | 2400×1600 | 843 KB | Public domain | https://earthobservatory.nasa.gov/images/92148/flower-power-in-the-netherlands | [source](https://commons.wikimedia.org/wiki/File%3AFlower_Power_in_the_Netherlands.jpeg) |
| `seattle-us` | 1280×1280 | 394 KB | Public domain | NASA Satellite Captures Super Bowl Cities – Seattle | [source](https://commons.wikimedia.org/wiki/File%3ALandsat_7_Captures_Super_Bowl_Cities_%E2%80%93_Seattle.jpg) |
| `cape-town-za` | 2184×1377 | 603 KB | Public domain | 8.727 MB TIFF ALSO AVAILABLE: http://photojournal.jpl.nasa.gov/catalog/PIA04961 http://www.nasa.gov/multimedia/imagegallery/image_feature_186.html | [source](https://commons.wikimedia.org/wiki/File%3ASatellite_image_of_Cape_peninsula.jpg) |
| `lena-delta-ru` | 2400×2400 | 1747 KB | Public domain | http://visibleearth.nasa.gov/view_detail.php?id=3451 Visible Earth v1 ID: 18024 Credit: Image provided by the USGS EROS Data Center Satellite Systems Branch. This image is part of the ongoing Landsat Earth as Art series. This image was acquired by Landsat 7’s Enhanced Thematic Mapper plus (ETM+) sensor on 2000-02-27 (Visualization Date: 2002-08-19). (The Lena Delta can be found on Landsat 7 WRS Path 131 Row 8/9, center: 72.21, 126.15.) | [source](https://commons.wikimedia.org/wiki/File%3ALena_River_Delta_-_Landsat_2000.jpg) |
| `samarkand-uz` | 2400×2042 | 1322 KB | Public domain | http://earthexplorer.usgs.gov/ image ID LC81550322015298LGN00 and LC81550332015298LGN00 | [source](https://commons.wikimedia.org/wiki/File%3ASamarkand_city_and_vicinities%2C_Uzbekistan%2C_LandSat-8_near_natural_colors_satellite_image%2C_25-OCT-2015.jpg) |

## Attribution in the product

The credit and source URL for each frame render on its mission dossier page and
are listed in full at `/legal/imagery`.

---

## PROVENANCE — RESOLVED, kept as the record of what was wrong

### `/imagery/aerial-pitch-2400.webp` — **REMOVED, no longer in the repo**

**Closed.** The file is deleted and nothing renders it. The homepage hero and
the orbit-entry band (band 03 then, band 08 now) compose from the Landsat
catalogue instead, which carries a source,
a licence and a credit — and which does not outrun the product. The reasoning
below is kept because it is the standard any future asset has to meet.

A low-altitude aerial of a football pitch, shipped on the homepage by
`components/landing/OrbitEntryBand.tsx:152`. **Its source is not known to this
repository.**

What is on the record, and nothing more: the file was supplied by the owner as
`~/Downloads/stadion.png` on 22 August 2026 and encoded to WebP for the site.
It carries no EXIF, it is not in the catalogue above, it is not in
`public/imagery/manifest.json`, and it is not covered by the footer's
`Example imagery: NASA / USGS Landsat — public domain` credit, because it is
not Landsat — it is a drone or light-aircraft frame at roughly 5 cm per pixel.

**Two things follow, and both matter:**

1. **Licensing.** Nobody here can say who took it or under what terms. It is the
   first thing a visitor sees. It needs a named source and a licence, or it
   needs replacing with a frame from the catalogue.
2. **It outruns the product.** It sits under the words "Your home. Photographed
   from orbit." At ~5 cm per pixel, individual people and cars are resolvable —
   an order of magnitude sharper than the 30–75 cm this product actually sells,
   and the brief deck's own card says "a person is a mark two pixels across".
   Even with a clean licence, it sets an expectation the mission cannot meet.

This was raised by the agent that built `components/landing/MissionCarousel.tsx`,
which is why that component uses each slide's own Landsat frame as its
full-bleed ground instead: the same place seen wider, with the print lying on
it — the reference composition, and fully covered by the public-domain credit.

### `las-vegas-us.jpg` — **FIXED**

**Closed.** The frame was re-cropped to `extract(142,160,2116x1190)` and resized
back to 2400x1350, so the declared dimensions and the 16:9 proportion are
unchanged and both the city and Lake Mead remain in frame. The burnt-in NASA SVS
furniture is gone. Note the crop is a 1.125x zoom, so the file's effective
pixel scale is about 27 m; `gsdM: 30` describes the instrument, which is what
the record prints. The original problem is kept below.

Has NASA's own captions burnt into the pixels — "Landsat 9 OLI", "2023" and a
scale bar. Correctly licensed, but the text is visible wherever the frame is
shown large, including as slide 01 of the carousel. Needs a clean re-export
from the USGS source rather than a crop.

---

## SPACECRAFT HARDWARE IMAGERY

Everything above concerns pictures the satellites TOOK. This section is about
pictures OF the satellites, which is a different licensing world, and a much
worse one.

The owner asked for photographs of the spacecraft on the fleet band
(`components/landing/FleetBand.tsx`, eight cards). The reference clone's
renders are forbidden — WAVE.md §1, they are Albedo Space Corp's own hardware
— so the question was whether any of our eight can be legitimately
illustrated. **One can. The audit is below and the conclusion is: ship
Landsat 9, ship nothing else.**

Every licence below was read from the operator's own published terms during
this pass, not from memory. Where a claim could not be verified it is marked
as a gap rather than resolved in our favour.

### Verdict, spacecraft by spacecraft

| Spacecraft | Operator | Usable? | Why |
|---|---|---|---|
| **Landsat 9** | NASA / USGS | **YES — SHIPPED** | US Government work, public domain. A real photograph of the real spacecraft. |
| Terra | NASA | yes, but not shipped | Public domain, but the only free images are **artist's renderings**, not photographs. See DELIBERATELY NOT SHIPPED below. |
| Sentinel-2C | ESA Copernicus | **no** | Every ESA image of this spacecraft carries the **ESA Standard Licence**, which is non-commercial. |
| Cartosat-3 | ISRO | **no** | No photograph of the spacecraft exists anywhere; the Commons render is tagged GODL-India, a tag not corroborated by ISRO's own policy and flagged unreviewed by Commons. |
| WorldView-3 | Vantor (ex-Maxar) | **no** | All rights reserved. No free image exists in any repository. |
| GeoEye-1 | Vantor (ex-Maxar) | **no** | Same. The only free images are USAF photographs of the **Delta II on the pad** — a rocket, not the satellite. |
| Pléiades Neo 3 | Airbus DS | **no** | Airbus media terms: non-commercial, no redistribution, no modification. |
| SkySat-C11 | Planet | **no** | Planet publishes under CC BY-**NC**-SA, and publishes no hardware photograph at all. |

### The operative licence text

**NASA** — https://www.nasa.gov/nasa-brand-center/images-and-media/

> "NASA content – images, audio, video, and media files used in the rendition
> of 3-dimensional models, such as texture maps and polygon data in any format
> – generally are not subject to copyright in the United States."

> "NASA content used in a factual manner that does not imply endorsement may
> be used without needing explicit permission. NASA should be acknowledged as
> the source of the material."

> "The NASA Insignia, Logotype, identifiers, and imagery are not in the public
> domain. The use of the Insignia, Logotype and NASA identifiers is protected
> by law."

Two conditions follow and both are met on the band:

1. **No insignia in the frame.** The full-resolution original was inspected
   before the asset was cut. The frame contains cleanroom equipment,
   `REMOVE BEFORE FLIGHT` streamers and `QUAD II / QUAD III` fairing
   markings. No NASA meatball, worm or logotype.
2. **No implied endorsement.** The caption states what the photograph is, who
   took it, and — twice on the band — that the spacecraft shown is not the
   one assigned to any mission.

**A FLAG THAT IS NOT RESOLVED.** NASA's separate merchandise page
(https://nasa.gov/nasa-brand-center/merchandise-approvals) defines
NASA-inspired merchandise as *"any product which features NASA logos,
identifiers, emblems, devices or imagery"* and asks producers to notify NASA
in writing. This site is a shop. The judgement taken here is that an
editorial photograph on a page, captioned and credited, is not a product
featuring NASA imagery — and note the site already prints NASA/USGS Landsat
frames as example posters, which is the larger version of the same question
and predates this pass. **If anyone ever composites this photograph into a
printed product, that judgement no longer holds and NASA must be notified.**

**ESA** — https://www.esa.int/ESA_Multimedia/Terms_and_conditions_of_use_of_images_and_videos_available_on_the_esa_website

> "The website of the European Space Agency (the ESA Website) provides to
> users an online access to space images and videos for education, editorial
> and/or information purposes only. All other uses (e.g. commercial ones) are
> excluded and require a specific licence."

> "Images or videos available on the ESA Website shall not be used for a
> commercial purpose, such as but not limited to, entertainment,
> advertisement, merchandising, etc. A commercial use requires a separate
> written authorisation by ESA."

Some ESA media is CC BY-SA 3.0 IGO, which would permit commercial use. The
split is sharp and was sampled: ESA's **Earth-observation products** are
CC-tagged; ESA's **photographs of spacecraft and launch campaigns** are not.
Every Sentinel-2C hardware image found — `Sentinel-2C fully loaded`,
`Sentinel-2C arrives`, `Keeping an eye on Sentinel-2C`, `Sentinel-2C in the
Vega launch tower` — carries `ESA Standard Licence and Additional permission
may be required`. So there is nothing to use.

Note also the *Copernicus Sentinel data* legal notice ("free, full and open
access") covers the pictures the satellite TAKES, not pictures OF it. It does
not help here.

**Vantor (formerly Maxar)** — the archived Maxar website terms:

> "These Terms of Use permit you to use the Website for your personal,
> non-commercial use only… you must not… use any imagery, illustrations,
> photographs, video or audio sequences or any graphics separately from the
> accompanying text."

Their Open Data Program is CC BY-**NC** 4.0 and covers Earth event imagery
only. Two independent bars. **Gap on the record:** Maxar rebranded to Vantor
around October 2025 and the live `vantor.com` terms page is client-rendered
and could not be retrieved; the quotation above is from the archived
predecessor. The conclusion does not turn on it — the NC licence on the Open
Data Program is confirmed on the live page.

**Airbus Defence and Space** — media library legal notice:

> "you are allowed to use (represent and edit) the Photos for the sole
> purposes of news and internal communication (reports and presentations),
> provided such use is on a non-commercial basis… you shall not publish,
> post, broadcast or otherwise circulate all or part of the Photos on any
> computer network or on any other media whatsoever, without the prior
> consent of Airbus… No other rights than those restrictively provided herein
> are granted in respect of the Photos."

**Planet** — FAQ:

> "Planet's imagery that is posted online via our owned media channels… is
> done so under creative common CC-BY-NC-SA… The imagery may not be sold or
> commercialized under this creative commons license."

Their terms also reserve `SkySat` as a trademark. Naming the spacecraft in a
specification table is nominative use and is fine; putting the mark on
anything sold is not.

**ISRO / URSC** — the one that is not a flat no, and still not a yes:

> "Material featured on this site belongs to the DOS/ISRO and the same may be
> reproduced free of charge in any format or media without requiring specific
> permission… the source must be prominently acknowledged."

There is no non-commercial clause. But four things stop it being usable, and
they all point the same way: *"free of charge"* is undefined and untested; the
permission carries no perpetuity or irrevocability; the URSC footer
simultaneously reads `© Copyright 2026. All rights reserved.`; and the only
Commons file is an artist's render tagged **GODL-India**, a licence ISRO
itself never references, sitting in Commons' *"Unreviewed"* queue. **There is
no photograph of the Cartosat-3 spacecraft at all** — the eight `PSLV C47`
files on Commons all show the rocket.

### What is shipped

| File | Dimensions | Size | Licence | Credit | Source |
|---|---|---|---|---|---|
| `/spacecraft/landsat-9-encapsulation-1000.jpg` | 1000×1500 | 271 KB | Public domain (17 U.S.C. §105, US federal government work) | NASA / Randy Beaudoin — NASA Kennedy Space Center, Photo ID KSC-20210816-PH-RNB01_0090 | [source](https://commons.wikimedia.org/wiki/File:Landsat_9_Encapsulation_(KSC-20210816-PH-RNB01_0090).jpg) |

**What it depicts, from NASA's own caption and nothing added:** *"Inside the
Integrated Processing Facility at Vandenberg Space Force Base in California,
the Landsat 9 spacecraft is moved into position for encapsulation on Aug. 16,
2021."* It is a photograph of the real flight article, not a model, not a
render, not an engineering unit.

**Licence verified, not assumed.** Read from the Commons API record for that
file on this pass: `License = pd`, `LicenseShortName = Public domain`,
`UsageTerms = Public domain`, `Copyrighted = False`, `Restrictions` empty.

**Processing applied.** Downloaded at the original 4000×6000, resized to
1000×1500, re-encoded as progressive mozjpeg at quality 82. No cropping, no
colour grading, no compositing — the same discipline as the Landsat catalogue
above. 271 KB.

**Where the credit renders.** On the band itself, in
`components/landing/FleetBand.tsx → HardwarePlate`: photographer, licence, and
a link to the source record. It is **not** on `/legal/imagery`, and it must
not be assumed to be: that page enumerates `lib/imagery.ts`, which is the
Landsat Earth-frame catalogue, and this file is not in it. If this asset is
ever mounted anywhere else, the credit travels with it.

### Deliberately not shipped, though it could be

**Terra** — https://commons.wikimedia.org/wiki/File:TERRA_am1.jpg — public
domain, NASA/JPL, and freely usable. It is an **artist's rendering**, not a
photograph. It is not on the page because this band's whole argument is that
its contents are measured rather than illustrated: eight live propagations of
published elements. Putting a drawing beside a photograph, both captioned
"NASA, public domain", invites a reader to take the drawing for evidence. If
that judgement is ever reversed, the file and its credit line are here.

Also public domain and also renderings, if a future pass wants a consistent
illustrated set for NASA spacecraft only:
`File:643743main terra instruments full.jpg`,
`File:Terra spacecraft model.png`.

### Traps found and rejected — read this before adding to this section

- **`File:Terra spacecraft in the cleanroom.jpg`** — a real cleanroom
  photograph of Terra, tagged **CC0**. Its stated source is *"LMMS (Lockheed
  Martin Missiles and Space)"* and its author *"Unknown author"*, uploaded by
  a third party. **A Commons uploader cannot CC0-dedicate a Lockheed Martin
  photograph they do not own.** The tag is almost certainly invalid. Do not
  use it.
- **`File:Sentinel 2-IMG 5873-white.jpg`** — Wikipedia's Sentinel-2C infobox
  image. Freely licensed (CC BY-SA 2.0 FR, credit `Rama`), but it is a
  photograph of a **scale model**, taken in **March 2012**, twelve years
  before Sentinel-2C existed.
- **ESA's Sentinel-2A hardware photographs on Flickr** — genuinely CC BY-SA
  2.0, genuinely usable. They are **Sentinel-2A**, not 2C. 2C is a recurring
  unit of the same build and looks identical, which is exactly why labelling
  one as the other would be a false statement of fact rather than a licensing
  problem. Do not do it.
- **The GeoEye-1 launch photographs** — PD-USGov and usable, but they show a
  Delta II on a pad. They are not pictures of the satellite and must not be
  captioned as if they were.

### The rule this section establishes

A spacecraft image ships only if all four hold: **(1)** the licence permits
commercial use, read from the rightsholder's own published terms; **(2)** the
image is of the spacecraft named, not a model, a sibling unit or its launch
vehicle; **(3)** the credit renders on the surface that mounts it; **(4)** what
it is — photograph or rendering — is stated where a reader can see it. If any
one fails, the card keeps its live orbit figure, which is ours, is a real
SGP4 propagation, and moves.
