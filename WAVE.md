# WAVE — reference, IP, and the bar

Binding for every agent in this wave. Read with `CONFIGURATOR.md` (still in force).

---

## 1 · THE REFERENCE, AND THE LINE THROUGH IT

Reference clone: `/Users/sabindima/Downloads/albedo-clone`
(`src/components/sites/albedo-com-1ecba88f/**`, assets under `public/sites/**`).

**MEASURE AND MIRROR:** spacing rhythm, typography scale, tracking rules, card
anatomy, table-row anatomy, menu behaviour, popup structure, grid, density.

Their measured type scale — 10 / 12 / 15 / 24 / 36 / 38 px, with tracking
POSITIVE on small caps labels (+0.12 to +0.24px) and NEGATIVE on display
(−0.36 to −1.6px). That sign flip is already our rule; theirs confirms it.

**DO NOT SHIP, no exceptions:**

1. **Their satellite renders** — `render-precision-power.png`, `precision-*.avif`,
   `clarity-*.avif`, `vicinity-*.avif`, `render-*.png`, `offering-*.jpg`,
   `hero-poster.jpg`. These are Albedo Space Corp's own spacecraft. Putting them
   on this site presents another company's hardware as ours — the one claim on
   this site nobody could defend. **We have something better and it is already
   ours:** live CelesTrak orbital elements for eight real satellites, propagated
   in-browser (`lib/satellites/**`, `lib/integrations/celestrak.ts`). A card
   carrying a live sub-point beats a static render of someone else's hardware.
2. **`NBInternationalPro-*.woff2`** — a licensed commercial typeface (Neubau).
   Copying the files is font piracy. Our faces are already set in
   `app/layout.tsx`.
3. Their copy, their logo, their product names (PRECISION / CLARITY / VICINITY).

This is the same line the owner set for the Anduril reference and it is not
negotiable. If a task seems to require a forbidden asset, build it from our own
data instead and say so in your report.

---

## 2 · THE BAR

Everything in `CONFIGURATOR.md §3` still applies in full:

- Existing design system only — `components/fui`, existing type roles, existing
  spacing tokens, existing motion. **Our colours**: void/paper/ink, one accent.
  Albedo is lime-on-indigo; we are not. Mirror their STRUCTURE, never their hue.
- BANNED: rounded-2xl, gradient blobs, purple/indigo/teal, glassmorphism, drop
  shadows, emoji, Tailwind default blue, template components.
  Note the clone's `src/components/ui/button.tsx` is generic shadcn scaffolding
  (`rounded-lg`, `bg-primary`) — it is NOT their design. Do not copy it.
- MOCK_MODE stays true. Never require a key.
- **Honesty**: never state a fact the system cannot produce. No invented
  resolutions, ETAs, probabilities, counts or capabilities. If you show a
  satellite's pass over a user's coordinates it must be a real SGP4 propagation
  of real published elements, or it must say it is indicative.
- a11y: 44×44 targets, `env(safe-area-inset-*)` on anything fixed, inputs ≥16px,
  full keyboard, visible focus, correct ARIA, `prefers-reduced-motion`, AA.
- Widths 320 / 360 / 390 / 430 / 768 / 1280 / 1440 / 1920 / 2400. Zero overflow.
- **The CTA rule**: primary action visible without scrolling, every step, every
  width. Non-negotiable.

---

## 3 · WHAT THE OWNER SAID IS WRONG TODAY

Quoted, because these are the acceptance criteria:

- *"everything that is on the left is not easily to understand for the user,
  maybe because is on black. make it on white and make it clear and very very
  sharp the hierarchy of the information."*
- *"the entire purchase flow the right section doesn't look professional and
  user readable … no proper labels, just a simple text."*
- *"the user doesn't understand here that is a space mission"* — the flow must
  feel like being part of a mission: animated orbit/satellite SVGs, real
  satellite data, an explanation of what a pass actually means.
- *"when zoom the frame should stay still"* — the capture frame must not move
  or resize under zoom; the basemap moves beneath it.
- Commission vs Archive: the difference must be *visible*. Commission = a real
  satellite is tasked; show which spacecraft could fly it and when, from live
  elements. Archive = an existing picture. The commission card must earn its
  price.

## 4 · SHARED ASSETS ALREADY OURS

- `lib/satellites/fleet.ts` — 8 real satellites, live elements
- `lib/satellites/propagate.ts` — SGP4: `subPointAt`, `lookAngleAt`, `nextPass`
- `lib/integrations/celestrak.ts` — cached fetch + honest snapshot fallback
- `components/satellites/OrbitGlyph.tsx` — inclination-accurate orbit icon
- `components/frame/FrameOnMap.tsx` + `lib/tiles.ts` — keyless s2cloudless basemap
- `public/video/*.mp4` — four clips, `-540` mobile encodes, iOS-safe
- `lib/poster/styles.ts` — four composable poster styles
- `section-middle.pdf` composition: the poster centred on a full-bleed aerial,
  white mount, no outer border on the photograph.

---

## 5 · ACCEPTANCE

Paste real output. `npx tsc --noEmit` clean, `npm run lint` clean,
`npx playwright test --reporter=line` → 212 passed / 2 failed (the pre-existing
self-named `DEFECT … RSC payload` pair). Screenshot every surface you touch at
390 and 1440, **look at the images with the Read tool**, fix what looks wrong.
Zero console errors. Dev server is on **3200** — do not start another, do NOT
run `npm run build`.

Never claim something works that you have not observed.
