# REVIEW

Shot from Space, after the SPEC-V4 pass (design system, purchase flow, landing
page, mission file, and a new `tests/` suite, built in parallel). This file is
the QA and integration pass: what exists, what is mocked, what needs the
owner's keys, and what is still open. It is written to be believed, so where
something was not verified it says so rather than claiming a pass.

Audited by driving a real browser against the dev server on **:3200** at six
widths — **390 · 768 · 1280 · 1440 · 1920 · 2400** — across fourteen routes
(84 renders), after waiting for the source tree to go quiet. Harness and raw
JSON live in `/tmp/sfs-qa/` (`qa6.mjs`, `probe-lib.mjs`, `deadspace6.mjs`,
`final2.json`). The harness is outside the repo on purpose; it is not a
dependency of this project.

**The single most important section is §3.** The layout, the flows and the
accessibility work are in good shape. The product's *factual claims* are not,
and several of them are the kind a buyer checks.

---

## 1 · VERIFICATION

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx eslint .` | **clean** |
| HTTP status, 14 routes × 6 widths | **200 on all 84 renders** |
| Console errors / page errors | **none** |
| Failed requests | **none** (media `ERR_ABORTED` preload aborts ignored — normal) |
| Horizontal overflow (incl. with `overflow-x:hidden` lifted) | **none at any width** |
| Inputs under 16px (iOS zoom) | **none** — every input is 16px, 56–69px tall |
| Tap targets < 44px at 390 / 768 | **none** (see §5.1 for the one false positive) |
| Images missing `alt` | **none**, after the fix in §2 |
| Contrast AA, both grounds | **clean** |
| Dead space at 1920 / 2400 | **clean**, after the fix in §2 |

`npm run build` was **not** run — the brief forbids it while the dev server
holds `.next`. Everything below was verified against `next dev`.

### 1.1 The fluid root font-size ladder was deliberately NOT installed

SPEC-V4 §A1 calls the fluid root ladder "the highest-value item". The design
system **declined it**, and documented why in a 60-line block in
`app/globals.css` (`ROOT FONT SIZE — why the §A1 ladder is NOT installed
here`). The short version: every width-sensitive value in this codebase is
already re-stated at six breakpoints, so there are no `clamp()`s left for the
ladder to collapse; and the ladder would overwrite three deliberate decisions
— a body that is flat at 16px from 390 to 1440, headline sizes that are capped
rather than tracking the viewport, and micro type ramps that grow slowly on
purpose.

What it took from §A1 instead: `scrollbar-gutter: stable`, and `--spacing: 4px`
pinned in `@theme` so `min-h-11` is 44 CSS px at every width rather than only
while the root is 16.

**I verified the claim rather than accepting it**, because the brief flagged
this as the most likely regression. At 390: root = **16px**, `min-h-11` =
**exactly 44px**, `w-11` = **44px**, every input **16px**, smallest real UI
text **9px**. The regression did not happen, because the change did not
happen. This is a documented, reasoned deviation from a binding spec and the
owner should know it was made.

---

## 2 · FIXED IN THIS PASS

| # | Issue | Where | Fix |
|---|---|---|---|
| 1 | **The carrier tracking number shipped on public and shared views.** `/api/missions/{code}` (unauthenticated) and `/s/{code}` both returned `1Z1853297529863153` plus a UPS deep link, and it leaked a second way through `events[].detail` ("Handed to UPS … Tracking 1Z…"). A tracking number is a bearer token for the delivery address: pasted into the carrier's tracker it returns the destination town, postcode, delivery status and often a "left with" line. The shared view states in its own copy that "the address, the receipt and the amount paid stay with its owner" — it was contradicting itself. | `lib/missions/dto.ts` | Gated on ownership as well as stage, at the mapper. `redactDetail()` now scrubs the number from the narrative too, so a new event string cannot reintroduce it. The carrier **name** stays public — it is not a key to anything. |
| 2 | The same fix, one level up: `/m/{code}` builds a private DTO for **any** signed-in session and then strips only the `private` block, so a signed-in non-owner would have kept the tracking number. | `app/m/[code]/page.tsx` | The non-owner branch now strips every owner-gated field, not just `private`. |
| 3 | Consequence of #1: the shared view would have read "Tracking — **Not issued**", which is false; the parcel is numbered. | `components/mission/MissionDataBlock.tsx`, `CurrentStagePanel.tsx` | Two different nulls, two different strings. Owner view: "Not issued" / "Pending scan". Public view: **"Held with the owner"**. |
| 4 | Consequence of #1: Mission Comms is unauthenticated, so the operator began answering "**No tracking number exists yet**" for a parcel that is out for delivery — a plain untruth. | `lib/integrations/llm.ts` | `trackingReply()` now distinguishes "not yet issued" (stage < SHIPPED) from "issued, not held in this channel", and points the reader at their signed-in mission file. |
| 5 | `tests/unit/dto-redaction.spec.ts` **asserted the leak was correct** — it expected a public DTO to return the tracking number. | same file | Re-pointed at the owner view, plus two new tests: a public view gets the carrier but never the number, and the number does not walk out through the event narrative. |
| 6 | The mission masthead rendered `alt=""` with **no `aria-hidden`**, so it sat in the accessibility tree as an unlabelled graphic. The caller's intent is decorative and the watermark branch of the same component already does this correctly. | `components/mission/ChromeMark.tsx` | A masthead called with `alt=""` now carries `aria-hidden`; one called with a real alt stays exposed. |
| 7 | **`/account` was a 1440 layout floating in dead space** — 1376px of ink in 272px rails at 1920 and 512px rails at 2400. Carried over from the last pass, where it was left alone as someone else's area. | `app/account/page.tsx` | The two mission-index sections now sit on `.column-expand` (the foundation's own remedy, same idiom as the footer): 1376 → **1600 at 1920** → **2000 at 2400**. The header and closing rail stay on `.column` because they are prose. |
| 8 | **Both commercial font originals were downloadable from the web root.** `GET /fonts/DuctileDisplay.otf` → 200, 158 KB; `GET /fonts/TypestarOCR-Regular.otf` → 200, 22 KB. Nothing referenced them — only the `.woff2` are loaded — but `public/` is the static web root. Serving the installable desktop binary of a licensed typeface is a materially larger act than serving a subset webfont, and essentially every commercial EULA forbids it. | `public/fonts/` → `assets/fonts-source/` | Moved out of the served tree with a README explaining why. Both now 404. All six webfonts still load 200, all four families still render, and the poster composer (which scans `public/fonts` through fontconfig) still returns a valid 960×1344 PNG. **This does not license them — see §5.3.** |
| 9 | The `FounderBand` doc comment described the note as "the one person who has taken a mission all the way through to a framed object", which the note's own body now explicitly denies. | `components/landing/FounderBand.tsx` | Comment corrected to match the shipped copy, with a note to keep the two in step. |
| 10 | **Test residue in the demo database**: 11 stray missions from other agents' purchase runs (10 as `sabin@humans.ai`, 1 as `qa+final@`), 4 stray user accounts, extra comms rows, and mission 18QD left advanced a stage by my own flow test. | `prisma/dev.db` | Restored to exactly the four seeded missions at their seeded stages, verified against a pre-test snapshot: event counts 18QD 5 / 32BF 9 / 55RA 10 / 74KL 5 and 11 comms rows, all matching. One user, `operator@shotfromspace.com`. |

Nothing else was touched. The artifacts' material values, the hero mosaic, the
type ramps and the logic layer are as their owners left them.

---

## 3 · HONESTY AUDIT — the section that matters

Grepped the rendered text of all fourteen routes and the source behind them.

### 3.1 What is clean

**No invented social proof anywhere.** No testimonials, no customer names, no
quotes, no star ratings, no review counts, no "N people viewing", no countdown
timers, no fake scarcity, no partner logos, no press mentions. Not in the
rendered pages, not in the source. Several components carry comments
explaining why they refuse to invent it, which is the right instinct.

The **provider bar** (`components/site/ProviderBar.tsx`) is a model of how to
do this: operator names set in type rather than logos, labelled "Imagery
sourced via SkyFi from commercial constellation operators", with a footnote
stating that none of them is a partner and none endorses the company — plus a
written pre-launch checklist in the file. The mission "distinctions" block
disclaims its own scarcity in the visible copy ("None of them is scarce,
competitive or held back for a result — nobody awards them").

### 3.2 The founder's note — correct, and it improved during this pass

`components/landing/FounderBand.tsx` is built exactly as SPEC-V4 §C requires,
and is **not** a testimonial:

- Name and role are in the **visible** copy, twice — a rail heading
  ("Founder's note" / **Sabin Dima** / "Founder, Shot from Space") and a
  sign-off in the same form.
- First person throughout, about building and testing the pipeline.
- Its own block, on its own ground. **No stars, no rating, no score, no review
  count, no second voice, no carousel, no "what customers say"** anywhere near
  it — verified in the rendered DOM.
- A visible footnote: *"Written by the founder about his own product. It is
  not a customer review, and there are none on this page."*

An earlier revision of this note narrated a completed mission — a scrubbed
first pass, an eleven-day re-fly, a capture nineteen degrees off nadir, a
print in hand — while three other files asserted that no mission has shipped.
**That was rewritten while this audit was running**, and the current copy is
honest about the boundary: *"What I cannot tell you yet is what it is like to
open the tube, because no customer mission has flown"* and *"I am not going to
describe a photograph I have not received."*

One residual wording tension, for the owner's eye rather than a defect: the
headline is still **"I ran the first mission against my own roof."** The body
makes clear this means driving the pipeline end to end, not receiving a
print — but the headline on its own implies a capture happened. If no frame
was ever collected over his roof, the headline overstates what the paragraphs
underneath are careful to deny.

### 3.3 Claims that are NOT true — open, and none of them mine to rewrite

These are contradictions between what the site says and what the code does.
Each needs the owner's fact, not a QA guess, so all of them are **open**. They
are ordered by consequence.

**1 · The published cloud threshold is not the one the system uses.**

| Says | Where |
|---|---|
| "Cloud above **ten percent** over the target fails the frame" | `components/landing/Guarantees.tsx:52` |
| "Cloud threshold ≤ **10%** over target" | `app/how-it-works/page.tsx:296` |
| also 10% in `ReachBand`, `PassBand`, `AnswersBand`, `Objections` | landing + purchase |
| `maxCloudCoveragePercent: **15**` — the value actually sent to the operator | `lib/integrations/skyfi.ts:282` |
| "the first pass under the **15**% / **20**% threshold is taken" | `lib/missions/state.ts:214` |
| seeded timelines cite **15%** and **20%** thresholds | `prisma/seed.ts:178,308,403,479` |
| `cloudPct` is generated in the range **0–24%** for every mission | `lib/missions/telemetry.ts:64` |

The guarantee is a contractual promise with a number in it, and the number is
wrong in the customer's favour — which means the company is promising a
re-task it will not automatically trigger. Mission 55RA is seeded as accepted
at "Cloud 14%", i.e. above the published failure threshold, on a page that
says 10% fails. `/legal/terms` states **no** threshold at all, so the 10% is
UI-only. Pick one number, put it in `lib/`, and read it everywhere.

**2 · Four of the five guarantees do not match `/legal/terms`.**

| # | UI says | Terms say |
|---|---|---|
| 1 | "Sixty days **from tasking**" (`Guarantees.tsx:45`) | "within sixty days of the mission **being confirmed**" (`terms:22`) — an earlier start, so the UI understates the customer's right |
| 1b | short form at both CTAs: "Full refund if no **frame** in 60 days" | its own long form and the terms both say "no **usable** frame". The short form is a strictly stronger promise, and the file's own doc comment forbids exactly this |
| 2 | "Cloud above ten percent … fails the frame" | no threshold stated at all |
| 3 | "replaced … **without a return argument**", unconditional | "Report it **within thirty days of delivery**" (`terms:50`) — a deadline that appears nowhere in the UI |
| 5 | "you can **cancel it from your mission file**" | timing agrees, but **there is no cancel control in the mission file.** `cancelMission()` exists in `lib/missions/index.ts` and is reachable only from `app/api/dev/advance/route.ts`, which 404s outside `MOCK_MODE` and has no owner check |

Guarantee 4 (shipping and duties included) is consistent. Note that the UI
also promises "Duties **and VAT** — Included" (`FormatBlock.tsx:130`,
`MockCheckout.tsx:218`) where the terms and `lib/pricing.ts` promise duties
only; VAT is never promised anywhere else.

**3 · The physical product is described four incompatible ways.**

| Says | Where |
|---|---|
| "Museum-grade **cotton**, matte" / "Ink: **Pigment**" | `components/landing/ObjectBand.tsx:65` |
| "**pigment ink on museum-grade cotton** paper … glazed with **anti-glare** acrylic" | `app/how-it-works/page.tsx:456` |
| "200 gsm **fine-art matte**" | `prisma/seed.ts`, `lib/missions/state.ts:296` |
| "pigment print on **heavyweight archival stock**" | `lib/integrations/llm.ts:516` |
| what is actually ordered: `200-gsm-**uncoated**-white` unframed; `200-gsm-matt` framed with plain **`plexiglass`** | `lib/integrations/gelato.ts:120,126,132` |

Cotton, pigment and anti-glare are not in the fulfilment catalogue. This is a
material claim about an object a buyer will hold.

**4 · Packaging is described three incompatible ways** — and two of them reach
the same customer. "In a tube" (`FormatBlock.tsx:16`, `profile.ts:296`,
`Objections.tsx:49`) vs "ship **flat in a rigid case**"
(`how-it-works:457`) vs "The print ships **flat in a rigid sleeve**"
(`lib/integrations/email.ts:320,329`, sent for framed orders too). The Gelato
product is `flat_product_…`. Frame material is "**black oak**" in three UI
places and `black_wood` / "black wood frame" in the adapter and seed.

**5 · The capture area in the copy is not the one sold.** Marketing says "≈ 1
km²" / "roughly one square kilometre" (`ReachBand.tsx:38`, `PassBand.tsx:31`,
`how-it-works:207,232`). `/start` offers 1, 2 or 4 km **per side** and
defaults to **2** — i.e. 4 km², four times the published figure, and
`profile.ts:229` correctly prints "4 square kilometres" on the very same flow.
`lib/missions/index.ts:186` uses a third value, 1.2 km per side.

**6 · The landing page publishes telemetry that contradicts the mission it
claims to mirror.** `components/landing/example-mission.ts` presents mission
32BF's instrument block as `LANDSAT / OLI-2`, `SSO 98.2°`, off-nadir `4.1°`,
cloud `2%`, altitude/GSD `505 km / 0.50 m`, track `//ELIPSE 33°`, frame centre
`34.0522N 118.2437W` at 4 dp. `missionTelemetry('32BF')` and the seeded row
say `SKYFI-HR / OPTICAL`, `SSO 97.4°`, `1.3°`, **21%**, `514 km / 0.54 m`,
`//ELIPSE 53°`, and the target is at `34.1017, -118.3406` — about 9 km from
the published centre. Two of these matter beyond tidiness: the cloud figure
(2% vs 21%) sits next to "anomalies: None" on a page that says 10% fails the
frame; and publishing a **4 dp** centre for a mission whose public DTO is
deliberately rounded to 2 dp works against the redaction boundary in §2.

**7 · Delivery timing is promised three different ways.** "The next clear pass
over your roof is **one to three days out**" (`ClosingBand.tsx:53`) vs the
purchase flow's own profile, which opens the window 3–8 days after
authorisation and runs it 7–14 days (`profile.ts:46–55,83–90`, and
`HeroBand.tsx:44` says "Capture window 7 — 14 days"). Mission Control tells
customers the window "normally lands **within twenty-four hours** of the
mission being confirmed" (`llm.ts:405,460`). `PassBand.tsx:29,35` shows a
mission clock with **18 days** between order and tasking, against terms that
say tasking happens "within a few hours of ordering".

**8 · `/legal/imagery` presents invented dates as the licensing record.**
Every `capturedAt` in `lib/imagery.ts` is a fabricated 2026 timestamp, and
`imagery/page.tsx:58` renders it as the frame's capture date — directly beside
a credit line stating the real acquisition. Paris is dated `27.01.2026` next
to a credit for a **2006** Landsat-5 scene; Berlin `04.03.2026` next to a
credit reading "Berlin **1986** 07 31"; Lena Delta `30.06.2026` against a real
**2000-02-27**; Samarkand `12.03.2026` against **25-OCT-2015**. The same
fabricated dates drive the archive index ("Every frame is published as a dated
file"). An attribution page is the one page that has to be literally true.

**9 · Smaller present-tense claims the codebase contradicts.**
`SiteFooter.tsx:132` prints "© 2026 — **All frames captured to order**" one
line above "Example imagery: NASA / USGS Landsat — public domain".
`ProviderBar.tsx:106` says imagery **is** "sourced via SkyFi" while
`MOCK_MODE` disables SkyFi entirely and every frame is Landsat.
`legal/imagery:25` says "Real missions are captured to order and are **not**
drawn from this archive", but `lib/missions/frames.ts` backs every mission
with a catalogue frame in mock mode and all four seeded missions carry an
`imagerySlug`. `ReachBand.tsx:72` says "**Ten** frames from the public Landsat
archive" while `FeaturedMosaic` renders **8** below 2400px.

### 3.4 Legal promises with no implementation

`/legal/terms` and `/legal/privacy` promise mechanisms that do not exist. Not
a copy bug — missing product.

- **"refunded in full, automatically. You do not need to ask."** (`terms:22`)
  There is no refund code at all. `lib/integrations/stripe.ts` has no refund
  call; the Stripe webhook handles `charge.refunded` as "noted, no
  transition". No 60-day timer, no cron, no scheduled job.
- **Cancellation** (`terms:49`) — no customer route and no UI, as above.
- **Replacement for damage** (`terms:50`) — Comms exists, but there is no
  reprint trigger and no 30-day clock.
- **"Ask us … and we will remove it"** for archive display (`terms:57`) —
  `isPublic` is hardcoded to default `false` with no API parameter, no toggle
  and no removal path. Customer frames are never displayed today, so the
  promise is currently moot rather than broken.
- **The perpetual personal-use licence** (`terms:56`) is never issued or
  recorded as an artefact.
- **"Ask us to delete your account and we delete your personal data"**
  (`privacy:40`) — no deletion code exists anywhere.
- **Subject-access requests "answered within thirty days"** (`privacy:46`) —
  no intake, no tracking. Both routes point at Mission Comms, which has no
  privacy or data-request intent, so such a message falls through to the
  generic operator reply.
- **Retention periods** ("seven years", "as long as your account exists",
  `privacy:39`) — no retention or purge logic.

Verified accurate in privacy: the single httpOnly `sameSite=lax` cookie with a
30-day expiry, the 15-minute magic link, and the described Stripe / SkyFi /
Gelato data flows.

---

## 4 · FUNCTIONAL FLOWS — verified end to end

All driven in a real browser against :3200, not asserted from source.

1. **Purchase at 390** — `/start` → typed address → **6 autocomplete
   suggestions** → capture preview renders → three formats and framed/unframed
   as a proper ARIA `radiogroup`/`radio` with `aria-checked` (not native
   inputs, but correctly labelled), live prices `$180 / $260 / $280 / $420 /
   $640` → **email is the only input on the page and it is last** (SPEC-V4 §B1
   held) → all five guarantees present at the button (§B4 held) → `Authorise
   mission $280` → `/checkout/mock/47FA` → `Pay` → `/m/47FA` showing MISSION
   CONFIRMED against the right target. **Zero console errors.** Test mission
   removed afterwards.
2. **Magic-link auth** — `/account` while signed out correctly redirects to
   `/auth/sign-in?next=%2Faccount`; submitting the operator address renders
   the dev link; following it lands on `/account` listing **all four**
   missions. The link is built from the live host, so it correctly pointed at
   :3200 rather than the `NEXT_PUBLIC_SITE_URL` default of :3000.
3. **Mission Control `/m/32BF`** — **9/9 stages** render; the exhibit reveals
   with its poster image and a real descriptive `alt`; comms answered a
   delivery question with a correct, stage-aware operator reply; the demo
   advance control stepped 18QD from stage 03 → 04. Seed state restored
   afterwards and verified against a snapshot.
4. **Share-token gating `/s/32BF?k=…`** — valid token shows city-level data
   only: `LOS ANGELES, CA / US`, coordinates at 2 dp, **no street address, no
   email, no amount, no receipt, no comms, and now no tracking number**. A
   wrong key and a missing key both render the designed refusal, not an error
   page. Confirmed from the opposite side too: signed in as the owner, the
   same file shows the street, the receipt, the tracking number and the
   carrier link.
5. **Hero mosaic cascade** — the field is a `<canvas>` in a `pointer-events:
   none`, `aria-hidden` wrapper. Lit-pixel share: **17.6% at rest → 18.1% on
   hover → 25.0% at +350 ms** as the cascade spreads → 22.2% decaying →
   **38.4%** under a pointer sweep. Both hero CTAs are hit-testable *through*
   the overlay at 390, 1440 and 1920.
6. **Artifacts** — patch is **matte**: `--a3d-spec: 0`, specular opacity 0 at
   rest *and* on hover. Coin is **gloss**: `--a3d-spec: 1`, specular 0 →
   **0.85** on hover, and the highlight travels with the pointer (0.843 at
   top-left, 0.850 at bottom-right). **Both tilt** — identity transform → real
   `matrix3d` rotation, in opposite directions on opposite corners.

---

## 5 · WHAT IS REAL / MOCKED / NEEDS KEYS

Real and running with no key at all: the SQLite data model, the nine-stage
mission state machine, the poster composer (`sharp`), address autocomplete,
the capture preview, passwordless magic-link auth, the operator comms, the
four transactional emails, the share-token view and the receipt page.

Every external service sits behind an adapter and is **mocked by default**
(`MOCK_MODE=true`). Each can be switched on independently — see
`INTEGRATIONS.md` for the per-service walkthrough.

| Service | Purpose | Key the owner must supply |
|---|---|---|
| Stripe | payment | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` |
| SkyFi | satellite tasking | `SKYFI_API_KEY`, `SKYFI_WEBHOOK_SECRET` |
| Gelato | print and fulfilment | `GELATO_API_KEY`, `GELATO_WEBHOOK_SECRET` |
| Anthropic | the Mission Control operator | `ANTHROPIC_API_KEY` |
| ElevenLabs | the voice link | `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` |
| Resend | transactional email | `RESEND_API_KEY`, `EMAIL_FROM` |
| Mapbox | address autocomplete | `MAPBOX_ACCESS_TOKEN` |

Also set `NEXT_PUBLIC_SITE_URL` to the real origin before anything is emailed:
it defaults to `http://localhost:3000`, and on this machine port 3000 is a
different project.

---

## 6 · KNOWN GAPS

### 6.1 Open from this pass

1. **Everything in §3.3 and §3.4.** Fourteen factual contradictions and eight
   unimplemented legal promises. None was fixed here: each needs the owner's
   fact (what the printer actually ships, what the cloud threshold actually
   is, whether a refund job exists) rather than a QA guess, and most sit in
   copy that other agents were writing during this pass. **This is the
   highest-value follow-up in the file.**
2. **The raw Prisma row still appears in the HTML of `/m/{code}`** —
   `addressLine1`, `postalCode`, `email`, `shareToken` and the exact fix, all
   readable from View Source on an *unauthenticated* request. Strong evidence
   this is React's **dev-only** server-component debug channel: it sits inside
   a `{"env":"Server","stack":…}` envelope alongside absolute local source
   paths. It is **gone from `/s/{code}`** since the last pass, which is
   consistent with that diagnosis. Still **not verified against a production
   build, because the brief forbids running one.** This remains the single
   highest-consequence unverified item in this file — re-check it on a real
   build before launch.
3. **The poster plate still prints the exact fix.** `lib/poster/sheet.ts`
   renders coordinates to 4 dp onto the artwork, and `/api/poster/{code}` is
   unauthenticated because the shared view uses it as its preview. The
   redaction in §2 deliberately does not apply here — the plate is the product
   and degrading it is the owner's call. So a shared link still leaks the
   street-level fix *as pixels*. Decide: round the printed fix, or
   authenticate the preview and keep the print file exact. The route is
   annotated.
4. **Mission Comms has no ownership check.** Anyone with a mission code can
   read and post to that transcript (`GET /api/comms/{code}` returns 200
   unauthenticated). This is why the tracking number could not simply be
   handed to the operator in §2.4 — it would have leaked through a third
   channel. Fine for a demo, not for live.
5. **`.sfs-redact` hit areas measure 42px, 2px under the 44px target.** The
   component deliberately grows a 15.9px line of type into a real target with
   `::after { inset: -15px -8px }`, and I measured the true hit area rather
   than the border box: **42 × 119px** for three bars, 53px for the fourth.
   That clears WCAG 2.5.8 (24px) comfortably and misses the 44px platform
   guideline by 2px. Left alone deliberately: the file documents an explicit
   no-overlap budget between stacked bars ("4 + 10 + 10 + 4 = 28px … two ±14px
   hit areas meet across without ever overlapping"), and widening the inset
   trades against it. That is the component owner's geometry to re-balance,
   not mine.
6. **The test suite has no runner.** `tests/` now holds unit, integration and
   e2e specs written against `@playwright/test`, but there is no `test` script
   in `package.json` and no runner in `node_modules` — so **nothing runs
   them**, including the redaction tests I extended in §2.5. Add
   `@playwright/test` and a `test` script. Until then the suite is documentation.
7. **No feasibility gate at purchase** (`PIPELINE.md` §6.8) — `/start` will
   sell a mission over a target SkyFi cannot collect.

### 6.2 Carried forward

8. **Commercial webfont licensing is unresolved.** **Typestar OCR** and
   **Ductile Display** are licensed commercial typefaces used on the mission
   file and the poster. The owner must hold a **webfont** licence for both,
   sized to expected pageviews, before this ships publicly. §2.8 removed the
   `.otf` originals from the web root, which reduces exposure but licenses
   nothing. Both have a fallback already wired in `lib/fonts.ts` (Typestar →
   IBM Plex Mono, Ductile → Inter, both OFL-1.1 and self-hosted), so the site
   degrades without a code change if a licence cannot be obtained.
   `THIRD_PARTY.md` documents the vendored `interior[.]dev` components but
   **does not mention either font** — add them.
9. **SkyFi operator verification is unresolved.** `components/site/ProviderBar.tsx`
   carries a seven-point pre-launch checklist in its own header, all of it
   still open: that each operator is available through the SkyFi account the
   company actually holds; that SkyFi's terms permit naming its upstream
   operators and naming SkyFi as supplier; legal sign-off that the label and
   footnote do not imply endorsement; a trademark check on each name as set in
   type; whether "ICEYE" or "ICEYE US" is correct; whether "Vantor" is still
   the current name of the former Maxar commercial business; and same-day
   removal of any name dropped from entitlements.
10. **SQLite will not survive on Vercel** — point `DATABASE_URL` at Postgres.
    The one blocking change before a hosted deploy.
11. **The print file is preview-grade** — `sharp` PNG; no PDF/X, CMYK, ICC or
    bleed, and the F50/F70 renders are clamped below their true 300 DPI
    geometry. `PIPELINE.md` names the function to replace.
12. **Demo imagery is 30 m/pixel Landsat** — city scale, not house scale. The
    copy is honest about this, and the founder's note now says so explicitly.
13. **Rate limits are in-memory, per-process.** They fired during this audit
    and blocked a legitimate sign-in, which is worth knowing before load.
14. **Disabled controls are very faint** — `fui-disabled` at roughly 2:1.
    WCAG exempts disabled controls, and the hatch carries the meaning, but it
    is close to invisible on a poor screen.
15. **Several source comments cite `reference/TOKENS.md` and
    `reference/STRUCTURE.md`**, which are not part of this repository. They
    will read as dead links to a new developer.
16. **The telemetry timestamp format is `16:08PM 31.07.2026`** — a 24-hour
    clock with an AM/PM suffix. This is deliberate and contractual
    (`CONTRACT.md` §2.8, `lib/utils.ts` says "do not fix it"), but it reads as
    a bug to every reviewer who meets it, so it is recorded here as intended
    rather than broken.

---

## 7 · WHERE TO LOOK FIRST

- `SPEC-V4.md` / `SYSTEM-V3.md` — the specs this pass audits against. Note
  §1.1 above: SPEC-V4 §A1 was deliberately not implemented.
- `app/globals.css` — tokens, the six-step type ramps, the column/bleed
  system, motion, and the reasoned refusal of the fluid root ladder.
- `components/fui/` — `Band`, `Container`, `Grid12`, `MediaCard`.
- `/system` — every primitive and token in the browser.
- `lib/types.ts`, `lib/missions/state.ts` — domain model and state machine.
- **`lib/missions/dto.ts`** — the single redaction boundary. Read it before
  adding any field to a public view. Three things are gated there now: the
  `private` block, coordinate precision, and the carrier tracking number.
- `lib/pricing.ts` — the price and format source of truth. Every number in the
  copy should be read from here; §3.3 lists the places that are not.
