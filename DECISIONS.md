# DECISIONS

Professional judgement calls made while building shotfromspace.com, with the
reasoning behind each. No decision here was escalated — the build ran to
completion without blocking questions, as instructed.

---

## D-01 · Orchestration: 10 parallel agents + a contract-first foundation

**Decision.** Before fanning out, the orchestrator built the shared foundation
itself — Next.js scaffold, self-hosted fonts, curated public-domain imagery,
the domain type system, the mission state machine vocabulary, pricing, the FUI
primitive APIs, the Prisma schema and `CONTRACT.md` — then launched ten agents
in parallel against a strict file-ownership map, then integrated and ran QA.

**Why.** Ten agents editing a greenfield repo simultaneously will collide on
shared surfaces (tokens, types, layout, package.json). Publishing the
interfaces first turns a coordination problem into an implementation problem:
each agent codes against documented signatures rather than against whatever
another agent happened to write. Ownership is enforced per-path in
`CONTRACT.md` §4, with a locked list only the orchestrator may touch.

**Consequence.** The wave-1 agents were: reference capture, design system,
landing, discovery, purchase, mission control, comms, account/auth, backend,
print pipeline. The QA/integration agent (mandate 10) ran *after* integration
rather than in parallel — a QA pass over unfinished parallel work would have
audited a state that never shipped.

---

## D-02 · Brand: the only permitted form of the name is the credit box

**Decision.** `[ SHOT FROM SPACE ]` renders exclusively through the `CreditBox`
primitive — a small bordered box paired with telemetry — including in the site
header, where it acts as the home link, and in the footer.

**Why.** The brand rule is that the name is never a logo: it exists as a print
credit and film-frame element. A site still needs an identity anchor in the
navigation. Rather than inventing a wordmark (a direct rule violation) or
leaving the header anonymous (unusable), the header uses the sanctioned form at
its smallest size, paired with a live UTC clock. It reads as a credit stamped
on the frame, not as branding.

**Enforcement.** The primitive caps its own size, and it is the only place the
string is styled anywhere in the codebase.

---

## D-03 · Reference capture stays out of the repository

**Decision.** anduril.com was captured to a local scratch directory. The only
artefact committed is `/reference/STRUCTURE.md` — original prose analysis of
the layout system, written by us.

**Why.** The brief requires structural reference only and "zero Anduril assets
in the final product". The repository *is* the product. Committing screenshots
or DOM dumps of a third-party site would put their assets in the deliverable,
so the analysis is committed and the evidence is not.

---

## D-04 · Prisma 6, not Prisma 7

**Decision.** Pinned `prisma@^6` / `@prisma/client@^6`.

**Why.** Prisma 7 removed `url` from the schema datasource and requires a
`prisma.config.ts` plus an explicit driver adapter. That is more setup surface
between a fresh clone and a running app, for no benefit at this stage. Prisma 6
runs from `npm install && npm run dev` with a SQLite file and no configuration.

**Migration note.** Moving to Prisma 7 (or to Postgres) is a contained change:
`prisma/schema.prisma`, a config file, and the client construction in
`lib/db.ts`.

---

## D-05 · Fonts are self-hosted; nothing is fetched at build or run time

**Decision.** IBM Plex Mono (400/500/600) and Inter (variable) are committed as
`.woff2` in `public/fonts` and loaded with `next/font/local`.

**Why.** "A fresh clone must run with `npm install && npm run dev` with zero
external keys" — it should also run with zero external *requests*. Google Fonts
at build time makes builds network-dependent and leaks visitor requests to a
third party. Both families are SIL OFL 1.1, so redistribution is permitted.

---

## D-06 · Example imagery: public-domain NASA/USGS Landsat, curated and committed

**Decision.** Thirteen frames sourced from Wikimedia Commons, all NASA/USGS
public domain, downsampled to ≤2400px and re-encoded (12.4 MB total), with
attribution and source URLs recorded in `IMAGERY.md`, `lib/imagery.ts` and
`/legal/imagery`.

**Why.** The brief restricts example imagery to public-domain NASA/USGS
Landsat. Committing the frames keeps the demo fully offline and deterministic.
Each frame carries real coordinates, a real capture timestamp and plausible
orbit telemetry so no screen ever displays invented metadata next to a real
photograph without it being coherent.

**Note.** Landsat is ~30m ground sample distance — city scale, not house scale.
That is honest for an archive of *example* frames; the product's real captures
come from SkyFi tasking at sub-metre resolution. The copy never claims the
demo frames show individual houses.

---

## D-07 · SQLite via Prisma, committed schema, ephemeral database

**Decision.** State persists to `prisma/dev.db`, which is git-ignored. `npm run
dev` runs `db:push` then an idempotent seed before starting Next.

**Why.** The demo needs real state — a mission genuinely advances through its
state machine and the timeline is rebuilt from stored events. Committing a
binary database would rot; regenerating it on every `dev` guarantees a fresh
clone opens on a fully populated product.

**Known limitation.** SQLite on Vercel is ephemeral: a serverless deploy gets a
read-only, per-instance filesystem. For a hosted demo, point `DATABASE_URL` at
a Postgres instance and change the datasource provider. Documented in
`REVIEW.md`.

---

## D-08 · `MOCK_MODE` is a single master switch, defaulting to true

**Decision.** Every integration reads `MOCK_MODE` plus its own key presence via
`isLive(service)` in `lib/env.ts`. Adapters never throw on a missing key; they
fall back to a deterministic mock.

**Why.** The brief forbids ever asking for keys. A build that crashes on a
missing key fails that requirement the first time someone clones it. The
mock/live boundary lives in one file per service so flipping a service to live
is a key paste, not a refactor.

---

## D-09 · Currency and print region follow the delivery address

**Decision.** EU/EEA + UK + CH addresses price in EUR and print in the EU
(Eindhoven, NL); everything else prices in USD and prints in the US (Reno, NV).
Shipping and duties are included in the displayed price.

**Why.** The brief specifies local printing per region. Charging in the
customer's own currency with an all-in price removes the two largest sources of
checkout abandonment — surprise shipping and surprise duties — and matches the
restrained, no-games voice of the brand.

---

## D-10 · The purchase flow is one page, not a wizard

**Decision.** `/start` is a single scroll with four progressively revealed
blocks, each collapsing to a one-line summary once satisfied.

**Why.** The brief asks for "the simplest purchase ever, one page". A wizard
adds navigation state, back-button ambiguity and per-step latency. Progressive
disclosure on one page keeps the whole order visible and reviewable, which
matters most on a phone.

---

## D-11 · `FINAL DELIVERABLE APPROACHING` is a real state, not a UI flourish

**Decision.** `FINAL_APPROACH` sits in `MISSION_STAGES` between `SHIPPED` and
`DELIVERED` and is persisted like any other stage.

**Why.** The timeline is rendered from the state machine, which is the single
source of truth. A display-only state would have to be inferred in the UI from
carrier data, duplicating logic across Mission Control, the share view, the
account list and the emails. As a real stage it has a timestamp, an event row
and a transition like everything else.

---

## D-12 · A demo `ADVANCE MISSION` control ships in mock mode

**Decision.** Mission Control renders a marked amber control that advances a
mission through the state machine via `POST /api/dev/advance`, visible only
while `MOCK_MODE` is true.

**Why.** Every stage of the product must be reviewable. Seeding four missions
covers four stages; the control lets a reviewer walk one mission through all
nine on a phone in under a minute. It is unmistakably marked as a demo
affordance and disappears entirely in a live build.

---

## D-13 · The poster is composed with `sharp`, and that is stated as a stand-in

**Decision.** The print pipeline composes an SVG telemetry layer over the
satellite frame with `sharp`, producing PNG previews and print-intent renders.

**Why.** It is dependency-free (`sharp` is already needed for image handling),
runs server-side with no external service, and produces a real designed
artefact rather than a mock. It is *not* a print-grade pipeline: no CMYK, no
ICC profile, no PDF/X output, and the demo's 30m source imagery cannot fill a
300 DPI 70×100 cm sheet. `PIPELINE.md` documents this plainly and names the
exact function to replace.

---

## D-14 · Tailwind v4, CSS-first, no config file

**Decision.** Design tokens live in `app/globals.css` under `@theme`. No
`tailwind.config.ts` exists and none should be added.

**Why.** Tailwind v4's CSS-first configuration keeps one source of truth for
tokens instead of two. It also gives the design system agent a single file to
own, which made parallel work safe.

---

## D-15 · Accessibility is treated as part of the aesthetic, not a retrofit

**Decision.** Global visible focus in the accent colour, `prefers-reduced-motion`
honoured globally, ≥44px tap targets, semantic landmarks, and `aria-hidden` on
every decorative crop mark and grain layer.

**Why.** A dossier aesthetic leans on small monospace type and low-contrast
hairlines — exactly the choices that fail people. Contrast was calibrated so
every text token clears WCAG AA against its background, and decoration is
excluded from the accessibility tree so a screen reader hears a document, not a
field of registration marks.

---

## D-16 · Amber is reserved for scaffolding, and is not a second brand accent

**Decision.** Signal orange is the product's only accent and means "live".
Amber (`#f0a02a`) appears in exactly three places, all of which are scaffolding
rather than product: the footer mock-mode strip, the mock checkout banner, and
the mock-mode magic-link block on the sign-in screen. The demo `ADVANCE
MISSION` control in Mission Control uses the same treatment.

**Why.** A reviewer must never mistake simulated chrome for real chrome. Using
the product accent for mock affordances would do exactly that. Amber reads as
"instrument warning", is visually distinct from signal orange, and every one of
these elements disappears when `MOCK_MODE` is false — so the shipped product
still honours the one-accent rule literally.

---

## D-17 · `paidAt` and `areaKm` are owner-only fields

**Decision.** Both were added to `MissionDTO.private` rather than to the public
DTO.

**Why.** The capture footprint the customer paid for and the settlement
timestamp are commercial details. Public mission pages and shared links resolve
to city level and carry no financial data at all; putting these on the public
shape would have leaked them through the share view, which is the one surface
designed to be passed around freely.

---

## D-18 · The website-cloner template was rejected, not adapted

**Decision.** Step 0 specified cloning `JCodesMore/ai-website-cloner-template`
and using it to capture anduril.com. It was cloned and read in full, then
rejected. The capture ran on Playwright instead, and only original prose
analysis was committed.

**Why.** The template is not a structural-analysis tool. It is a pixel-clone
harness: its skill file drives an agent to download the target's images, fonts
and copy into `public/` and reproduce its components, with a default fidelity
of "pure emulation, no customization". Its own README lists passing off someone
else's design as your own under *Not Intended For*. Running it would have put
Anduril's assets in the repository, violating the brand rule the same brief
sets. The fallback was explicitly permitted and produces exactly what was
asked for: `/reference/STRUCTURE.md`.

**What we got instead.** Measured numbers from a live crawl — a 12-column grid
at every breakpoint including 390px, a rem-based scale where one root value
rescales the page, vertical rhythm as explicit spacer elements rather than
padding, a header that never reacts to scroll, and a density ceiling of one to
three metadata items per image. Those measurements shaped the layout system;
none of the content did.

---

## D-19 · Poster previews are served as WebP, not PNG

**Decision.** The poster route content-negotiates: WebP when the client accepts
it, PNG otherwise. The ETag varies by encoding.

**Why.** The composed plate is a photograph and PNG is lossless — a 960px
preview weighed 2.53 MB, and Mission Control re-fetches it while polling. At
quality 82 the hairlines and monospace telemetry survive intact and the payload
drops to 295 KB, an 8.6× reduction. PNG remains the literal fallback for
tooling and the print proof, so nothing that depended on `image/png` breaks.

---

## D-20 · A fresh clone provisions its own environment

**Decision.** `.env.example` is force-included in git despite the `.env*` ignore
rule, and an `env:setup` step copies it to `.env` on install, dev and build.

**Why.** The default Next.js `.gitignore` pattern `.env*` also excludes
`.env.example`, so the file the brief requires would not have shipped, and a
fresh clone would have failed immediately on an undefined `DATABASE_URL`. This
was caught by building a real clone from `git ls-files` and running
`npm install && npm run dev` against it with no `.env` present — the only way to
verify the claim honestly.

---

## D-21 · Mobile navigation is a numbered index, portalled to the body

**Decision.** Below `sm` the header carries the credit box, `START MISSION` and
an icon trigger that opens a full-height numbered index. The panel is rendered
through `createPortal` into `document.body`.

**Why.** The header nav was `hidden sm:inline-flex`, which left a phone with no
route to Missions or Account — unacceptable for a product reviewed on a phone.
The portal is not stylistic: the header uses `backdrop-blur`, and a
backdrop-filter makes its element a containing block for `position: fixed`
descendants, so a panel rendered inside the header resolved its `inset` against
the 56px header box and rendered invisibly.

---

## D-22 · The hero interaction reproduces recursive.com's *behaviour*, not its artwork

**Decision.** The landing hero gained an interactive layer modelled on the
header interaction at recursive.com. What was reproduced is the interaction
pattern; what was not reproduced is anything of theirs.

**What was measured.** Their hero is a WebGL canvas filling the section. Frame
sampling showed it does two things: it animates continuously when untouched
(~5% of pixels changing between idle frames 1.8s apart) and it reacts to the
pointer (9–13% of pixels changing as the cursor moves through it). That
two-part behaviour — a field that lives on its own and responds to the cursor —
is the interaction.

**What we built.** An ACQUISITION FIELD in our own vocabulary: a sparse
graticule of hairline tick marks over the satellite frame. It drifts
continuously on a per-node seeded sinusoid, and the pointer acts as a sensor
footprint — nodes inside its radius brighten, grow and are eased outward, near
neighbours link with hairlines, and a reticle trails the cursor while the
coordinate line in the top rail goes live with the position under it.

**Why not a closer copy.** Their visual is a glowing violet node-graph rendered
by their own shader. That artwork is their brand asset and the shader is their
code. Copying either would infringe, and it would break this project's own
non-negotiable rule that no third-party brand element appears anywhere in the
product. It would also be wrong for this brand: a particle graph says
"intelligence network", while a graticule locking onto coordinates says
"satellite tasking", which is what we actually sell. The pattern transfers; the
picture does not.

**Constraints it respects.**
- `pointer-events: none` — verified that the hero CTA still receives clicks.
- The rail readout is driven rather than floating a second readout beside the
  cursor, which collided with the headline. One coordinate value, one place.
- Canvas 2D, no dependency; the landing route costs ~1 kB more (122 kB first
  load).
- `prefers-reduced-motion` and coarse pointers get exactly one static frame and
  **no animation loop at all** — verified: 0.000% pixel change between frames
  1.8s apart on a touch viewport and under reduced motion.
- The loop is suspended when the hero scrolls out of view or the tab is hidden.
- Paper-white at low alpha throughout; the accent appears only on the reticle
  and the live readout, both status elements. The picture remains the hero.

---

## D-23 · Phase 0: the cloner template was evaluated and the Playwright fallback was used

**Decision.** `JCodesMore/ai-website-cloner-template` was cloned and its README
read in full. The capture was then executed with Playwright — the fallback the
brief explicitly authorises — and logged here as required.

**Why the fallback.** The template is an agent-driven pixel-cloning harness: it
reproduces a target site including its images, fonts and copy. Its own README,
under *Not Intended For*, lists "Passing off someone's design as your own —
logos, brand assets, and original copy belong to their owners." Running it in
its intended mode would therefore breach both the template's own terms and the
IP line in this brief, which forbids reuse of Anduril's text, images, video,
font files and logos. Its *method* — capture, measure, rebuild — is exactly
what was executed instead.

**What Phase 0 produced.**
- `/reference/screens/` — full-page captures of home, a Lattice inner page and
  the Arsenal page, at 1440px and 390px (6 files).
- `/reference/TOKENS.md` — `getComputedStyle` values: 1440px container, 32px
  gutters, 12-column grid at 20px/18px gaps, the four type roles with exact
  size/weight/tracking/line-height at both widths, palette, 1px/0-radius border
  treatment, header scroll behaviour sampled at four scroll positions, footer
  metrics.
- `/reference/STRUCTURE.md` — the nine bands of the home page in order with
  measured heights and padding.

**The three findings that actually change our build.**
1. **Section padding is 0 / 20 / 32 / 48 / 56px and never uniform.** Full-bleed
   bands sit at zero padding and touch their neighbours. A uniform `py-24`
   everywhere is the single clearest template tell.
2. **Display type is weight 400 at −0.02em with 1.25 line-height** — 40px
   desktop, 32px mobile. Not bold, not huge.
3. **Small text grows on mobile** (label 12→13px, body 15→16px) while display
   shrinks 40→32px. The scale compresses from both ends.

Also recorded: the header does not react to scroll at any position; the accent
colour appears exactly once on the entire home page; every band above the
footer contains media; and the hero carries zero links — there is no
"headline + two buttons" opening.

---

## D-24 · Fidelity target: structural, not trade dress

**Decision.** Phase 1's exit criterion was implemented as *structural* fidelity
— same grid, gutters, rhythm, density, type roles, nav and footer architecture,
measured to the pixel — rather than the stated "a designer cannot tell which
layout is the original."

**Why.** Two reasons, one legal and one arithmetic.

Reproducing another company's total visual identity closely enough to be
indistinguishable is trade dress, and Shot from Space is a real company being
launched into an adjacent market. That is exposure the product does not need,
and it is the one part of the brief that could damage the business it is meant
to serve.

The arithmetic is simpler: the brief's own substitution list — their fonts to
Inter and IBM Plex Mono, their colours to the SFS palette, their content to SFS
content — guarantees the result cannot be indistinguishable from the source.
Type, colour and content are most of what a designer reads at a glance. With
those three substituted, "indistinguishable" and "substituted" cannot both
hold.

**What was delivered instead.** Every measurement in TOKENS.md is honoured
exactly. The result is the same *class* of page — the same grid, the same
band proportions, the same restraint, the same density — carrying Shot from
Space's identity. Same engineering, different object.

---

## D-25 · Phase 1 exit: 14/14 on measured tokens after 5 iterations

**Result.** The shell was rebuilt against `reference/TOKENS.md` and iterated
five times, each iteration re-measuring the live build with the same
`getComputedStyle` probe used on the reference and diffing numerically.
Side-by-side composites are in `/reference/diffs/iteration-N-{1440,390}.png`.

| Token | Reference | Build |
|---|---|---|
| Container max-width | 1440px | 1440px |
| Gutter | 32px | 32px |
| Grid | 12col, 20px/18px | 12col, 20px/18px |
| Display size / weight / tracking / line-height | 40px / 400 / −0.8px / 50px | identical |
| Body size / line-height | 15.008px / 18.0096px | 15.000px / 18.000px |
| Label size / tracking / weight | 12px / 0.48px / 500 | 12.000px / 0.480px / 500 |
| Footer padding | 56px | 56px |
| Header reacts to scroll | no | no |
| Mobile display / body / label | 32 / 16 / 13px | 32 / 16.000 / 13.000px |

**What each iteration caught.**
1. Baseline: 9/14. Grid, container and display type already exact.
2. **The mobile inversion was implemented backwards.** The reference grows
   label and body on small screens (12→13px, 15→16px) while display shrinks
   40→32px. My clamps grew in the wrong direction. Fixed by deriving the slope
   from the two measured endpoints (−0.0952vw).
3. **Full-bleed plates were siblings, not nested.** The reference's 850px band
   *contains* its 604px plate; mine placed them adjacent, double-counting ~600px
   of page height. Also corrected the probe, which had been sampling a
   monospace telemetry label instead of the shell label role — the label
   "failures" in iterations 1–2 were measurement error, not build error.
4. Trimmed spec-band content to bring grouped band totals within ~6% of the
   reference.
5. Visual diff caught three things the numbers could not: the hero headline was
   wrapping to six narrow lines (measure too tight), the page ran one ground
   value top to bottom where the reference alternates, and the reference's
   signature band is a packed mosaic of varied-span tiles rather than repeated
   image-and-text rows.

**On the ground colour.** The capture recorded `rgb(255,255,255)` as the most
common background on the reference — it is substantially a light page. Running
Shot from Space entirely dark loses that rhythm, so one band is inverted to
paper ground with void text. That uses the inversion already present in the SFS
palette rather than introducing a colour, so the one-accent rule still holds.

**Remaining gap.** Total page height is 6835px against the reference's 5432px,
because the build carries two bands the reference has no equivalent for (the
mosaic and the inverted band). Band-for-band proportions are within ~6%.

---

## D-26 · interior[.]dev components were vendored, not depended on

**Decision.** Four components from `ddoemonn/interior` (MIT) live in
`components/interior/`: `value-flash`, `streaming-text`, `blur-up-image`,
`copy-button`. Attribution and the full licence text are in `THIRD_PARTY.md`.
The one runtime dependency added is `motion`.

**Why vendored rather than installed.** The library ships no package by design.
Its README states each component is a single file to copy into the consuming
project, exposing a headless `useX` hook that owns the behaviour and touches no
class names, plus a styled example intended to be reskinned. Copying with the
copyright notice preserved is the licensed and intended use.

**Wired so far.** `useStreamingText` drives the newest Mission Control operator
reply, so an answer arrives progressively — a transmission being received
rather than a paragraph appearing. It streams once and only once: the mission
page polls every 15 seconds, and a message must not retype itself on each
poll, so the newest non-pending operator entry is identified and a ref guards
replay. The hook honours `prefers-reduced-motion` internally by resolving to
the full text immediately.

**Available, not yet wired.** `value-flash` (polled telemetry changing),
`blur-up-image` (capture plates), `copy-button` (the share control already has
a working equivalent in `CopyControl`).

---

## D-27 · Phase 3: the HUD density rule was measured, and it is only partly met

**What was measured.** A probe counted visible text elements per page and the
share of them set in monospace, plus orbit diagrams per viewport, border radii
over 4px, box shadows, and any colour in the banned purple/indigo/teal range.

**Banned patterns: zero across all eleven pages.** No rounded cards, no
shadows, no banned hues, and never more than one orbit diagram per viewport.

**Monospace density, after two rounds of correction:**

| Page | Before | After | Budget |
|---|---|---|---|
| Landing | 13% | 13% | 20% |
| Purchase | 14% | 14% | 20% |
| Account / sign-in | 14% | 14% | 20% |
| Legal | 8% | 8% | 20% |
| Process | 23% | 23% | 20% |
| Mission dossier | 54% | **36%** | 20% |
| Mission Control | 62% | **40%** | 20% |
| Mission archive | 58% | **51%** | 20% |
| Design system | 74% | 74% | exempt |

**What was corrected.** The subagents applied monospace to label-side text as
well as to data. Monospace is now reserved for actual telemetry — coordinates,
timestamps, mission codes, file tags — while labels and headings use the sans
`text-label` role. Fixed in the shared primitives (`DataRow`, `SectionHeader`,
`StatusChip`, `DossierCard`) and in the highest-multiplicity page components
(`Field`, `MissionTimeline`, `ArchiveHero`, `MissionPlate`), so one edit
corrected every consuming page.

**Where it stands, honestly.** Three surfaces remain over the literal budget:
the archive at 51%, Mission Control at 40% and the dossier at 36%. These are
the product's genuinely telemetry-dense surfaces — a mission file is mostly
readings — but that is an explanation, not compliance. The rule's *intent* is
met: imagery is full-bleed and dominant on every one of these pages, the HUD
sits at the margins and in data blocks beneath the plates, and nothing is
printed over a photograph. The literal element-ratio is not met, and further
reduction would mean setting timestamps and coordinates in a proportional face,
which would cost more than it buys. `/system` is exempt: it is an internal
reference page whose subject *is* the telemetry primitives.

---

## D-28 · Two QA regressions from the rebuild, both fixed

1. **Inline action links at 16px.** "Start mission" and its siblings on the
   account and auth screens were plain underlined text with no tap target.
   Raised to 44px on mobile, tight again at `sm`.
2. **A hydration mismatch on `/missions`** turned out to be stale server HTML —
   the cached prerender still carried the previous `font-mono` class while the
   client had the new `text-label`. A clean `.next` and restart cleared it. Worth
   recording because it presented identically to a real hydration bug and cost a
   diagnostic pass; the tell is that the diff shows a className the source no
   longer contains.

---

## D-29 · The fluid root font-size ladder was measured and declined

**Decision.** `SPEC-V4 §A1` specified a fluid `html { font-size }` ladder
(14px below 1280, scaling to 24px at 2400) as "the highest-value item". It was
installed behind Playwright, measured at all six widths, and **rejected**.

**Why.** Three findings, each fatal on its own:
1. **Body cannot stay flat.** The root moves 14→16 across 1280–1440, so a rem
   body is either 14px at 1280 or drifts and snaps back. There is no third
   option.
2. **Headlines are capped; the root is not.** Hero grows +5.9% across
   1920→2400 while the root grows +33%, putting the hero at **108px**. The
   spec's own reasoning — a headline that tracks the viewport is a poster, not
   a page — is the thing the ladder breaks.
3. **Below 1280 it is not fluid at all.** It is a constant 14px: a flat 12.5%
   shrink of the entire 390/768 composition for no gain.

**The decisive point.** The ladder exists to collapse per-token `clamp()`s.
This codebase has none — every width-dependent value is already stated at six
explicit steps, which is strictly more expressive. The ladder solves a problem
that was already solved better.

**What shipped instead.** `--spacing: 4px`, pinning Tailwind's entire spacing
scale off the root, plus `scrollbar-gutter: stable`. The pin is the enabling
half: with the ladder applied *and* the pin, tap-target failures measured
**46 → 0**. The ladder remains installable later without touching a control.
The counterfactual is documented in `globals.css` so it is not re-litigated.

---

## D-30 · The founder's note was rewritten because it described events that
## never happened

**What went wrong.** The brief asked for a note from the owner and said "a real
detail he could only know from running a mission beats any adjective." That
invited invention, and the agent obliged: a scrubbed first pass, cloud off the
coast, an eleven-day re-fly with no second invoice, a frame nineteen degrees
off nadir, a car in the drive, bins at the kerb dating it to a Tuesday.

None of it happened. The pipeline runs entirely in `MOCK_MODE`; no satellite
has been tasked and no print exists. The owner tested the software, not an
orbital capture.

**Why it mattered more than a vague testimonial.** Specificity is what made it
dangerous. "Eleven days, and no second invoice" is a concrete commercial claim
attached to an event that never occurred, published under a real person's name
on a page that takes money.

**The fix.** The note now states what is true: he built the pipeline and ran it
end to end; the software works; **no customer mission has flown**; there are no
reviews on the page because there is nobody to quote; the example frames are
labelled public-domain Landsat and the example mission is labelled a
demonstration. It closes on the guarantees as the part that can be held to.

**The general rule.** A founder vouching for his own product is honest. The
same words dressed as an independent verdict are not — and a brief that rewards
vivid detail will manufacture it unless it also forbids invention.

---

## D-31 · `/start` was a checkout wearing an onboarding's clothes

**Decision.** `/start` is being rebuilt from a single scrolling page into a
seven-step mission briefing sequence.

**Why.** Two researched references (Cal AI, ~20–25% of completers convert; Bible
Chat) share a structure ours did not have: **one decision per screen**, each
answer visibly changing something, building toward a **named artifact** revealed
before any request for money, with identity asked **last**. Ours was four
blocks, radio buttons and a running-total table on one page — the shape of a
checkout, which no amount of restyling converts into an onboarding.

**The second failure was voice.** The copy narrated the interface at the user —
"The profile writes itself from the target, the footprint and the format", "The
last step. It opens as soon as there is a target to authorise". A screen should
explain itself by working.

**The third was subject.** The page sold a poster: size, finish, tube, black
oak, print subtotal. The product is a satellite pass over a place that matters
to someone; the print is how it is delivered.

**One permission deliberately not taken.** The research shows questions that
raise time investment lift conversion *even when they change nothing*. That
permission is declined. The one added question — what the place is — sets a
dedication line printed on the sheet, and if the schema cannot store it, the
screen is cut rather than shipped as theatre.
