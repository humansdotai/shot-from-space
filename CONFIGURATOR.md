# CONFIGURATOR — the acquisition standard

Every agent working on a purchase surface reads this first and does not deviate
from it. It is the contract between five parallel builds.

---

## 1 · THE DEFECT THIS FIXES

`/mission` today is ten sequential full-page screens. On a 1440 × 820 desktop
viewport, screen 1 shows a header, a progress rail, an eyebrow, a headline, an
address and the top of a picture — **and no button at all**. The primary action
is below the fold. Every screen after it has the same shape.

That is the single biggest conversion defect on the site, and it is not a
styling problem. It is a layout-model problem: a *wizard* was built where the
category standard is a *configurator*.

---

## 2 · WHAT THE STANDARD ACTUALLY IS

Measured from six live competitors in this exact category (personalised
astronomical / cartographic prints): Under Lucky Stars, The Night Sky, Mapiful,
CanvasDiscount. Every one of them, without exception, uses the same model.

### Desktop — a persistent split, both halves filling the viewport

```
┌──────────────────────────────────┬─────────────────────────┐
│                                  │  TABS / SECTION RAIL    │
│                                  ├─────────────────────────┤
│        LIVE PREVIEW              │                         │
│        (the object)              │   CONTROLS for the      │
│        60–65% width              │   active section        │
│                                  │   35–40% width          │
│                                  │   scrolls internally    │
│                                  ├─────────────────────────┤
│                                  │  PRICE  │  PRIMARY CTA  │  ← pinned
└──────────────────────────────────┴─────────────────────────┘
```

- The **page itself does not scroll**. The panel scrolls inside its own column.
- The **CTA is pinned to the foot of the panel** and is visible at all times,
  on every section, without exception. Mapiful pins `44.99 € · ADD TO CART`;
  CanvasDiscount pins `Poster 8"x12" $19.00 · Checkout`; Under Lucky Stars and
  The Night Sky pin `NEXT`.
- The **price sits beside the CTA** and updates live. Baymard: unexpected cost
  at the final step is a leading abandonment cause; a persistent total removes
  the surprise.
- Sections are **tabs or a rail**, not pages — the buyer can go back to any
  earlier decision without losing the later ones.
- The preview **updates on every change**, immediately.

### Mobile — REPLACED. Stepped pages, one floating action.

**Two owner instructions, on 2026-08-24, the second refining the first.**

> 1. "on mobile make the purchase payment as a scrollable page with all
>    the elements on a page with not fixed buttones or components just
>    like you have on mapiful.com … white background and black text."
>
> 2. "for purchase BREAK IN STEPS ON MOBILE BUT EVERY STEP SHOULD BE A
>    SCROLLABLE PAGE WITH ONLY FLOAT BUTTON IS CONTINUE/NEXT/BUY AND
>    SOME INFO"

The shape below 1024 is therefore:

```
┌───────────────────────┐
│ ← Back      Step 3/6  │   in the document, scrolls away
├───────────────────────┤
│      THE STAGE        │   in the document, scrolls away
│                       │
│   head + controls     │   ordinary page scroll, 3–5k px
│                       │
├───────────────────────┤
│ TOTAL · SPEC   €279   │   ← the ONLY floating element
│ [ CONTINUE / PAY ]    │     + env(safe-area-inset-bottom)
└───────────────────────┘
```

- **One step at a time.** Not the six-section single scroll of (1), and
  not the tabbed panel either — the rail presents every section as
  simultaneously reachable, which is what (2) asked to be broken up.
- **The step is an ordinary page.** Stage, head and controls all scroll.
  This is what survives from (1) and it is the difference from the
  original panel shape, where the stage was pinned at 38–46svh and the
  controls fought it for one viewport.
- **Exactly one floating element**, carrying the action AND the price —
  "and some info". Zero and two are both wrong, and the test counts.
- **A spacer reserves its height.** Fixed furniture is out of flow;
  without it the last control of every step sits under the bar.
- **Paper ground, black type**, from (1).

§3.1 holds unchanged at ≥ 1024. It also effectively holds here — the
floating action is visible at every scroll position on every step — but
by a different mechanism than the desktop split.

Locked by `tests/e2e/mobile-stacked-configurator.spec.ts`, which asserts
the floating count, that nothing hides under the bar on any of the six
steps, and that the ≥ 1024 split is untouched.

The superseded shape is kept below for the record.

### Mobile (superseded) — preview above, controls below, CTA in the thumb zone

```
┌───────────────────────┐
│    LIVE PREVIEW       │   upper 40–50svh, sticky
├───────────────────────┤
│  ‹ tab tab tab tab ›  │   horizontal section scroller
│                       │
│  controls (scroll)    │
│                       │
├───────────────────────┤
│  PRICE │ PRIMARY CTA  │   ← fixed footer, thumb zone,
└───────────────────────┘      + env(safe-area-inset-bottom)
```

- The sticky footer is **not optional**. The lower third of a phone is the
  one-handed thumb zone, and the primary action belongs in it.
- The preview stays visible while controls are used. A buyer changing a size
  must see the size change.

### Ordering — progressive disclosure

Broadest, most consequential choice first; finest last. Never present a screen
whose options the buyer cannot yet evaluate.

---

## 3 · NON-NEGOTIABLE RULES FOR EVERY BUILD

1. **The primary CTA is visible without scrolling, at every step, at every
   breakpoint ≥ 1024.** This is the acceptance test for the whole project. An
   agent that ships a surface failing this has not done the job.
   **Below 1024 on `/mission` the mechanism differs** — see the mobile
   section above: the action floats over a scrolling step rather than
   being a sibling of an internal scroller. The rule itself still holds.
   Do not "fix" the phone configurator back to the pinned-stage panel.
2. **The price is visible wherever a CTA is**, and it is the price that will be
   charged — `tierPriceMinor(tier, formatId, frame, currency)` and nothing
   else. Display and charge come from one function; that was a real defect
   once (a €79 button recorded €170) and it must not return.
3. **Use the existing design system exactly.** `components/fui` primitives, the
   existing type roles (`text-hero`/`display`/`heading`/`body`/`label`/`note`/
   `tele`/`tele-s`/`tele-xs`), existing spacing tokens, existing motion
   (`transition-house`, `duration-house`, `ease-house`). Read `app/globals.css`
   and `components/fui/index.ts` before writing a line. **This is a layout and
   logic task, not a redesign.**
4. **BANNED, instant rejection:** rounded-2xl cards, gradient blobs, purple /
   indigo / teal accents, glassmorphism, drop shadows, emoji, Tailwind default
   blue, uniform 4rem section padding, anything that looks like a template.
   Do not copy any competitor's *visuals* — the layout MODEL is the standard,
   their look is theirs.
5. **MOCK_MODE stays true. Never require a key.** Every external sits behind an
   adapter that degrades and says on screen what it is showing.
6. **Honesty.** Never state a fact the system cannot produce. No invented
   dates, resolutions, counts or capabilities; no claim that a specific
   satellite is assigned; no fabricated social proof. Guarantee wording comes
   from `lib/guarantees.ts` only.
7. **Accessibility.** 44 × 44 minimum targets, `env(safe-area-inset-*)` on
   anything fixed, inputs ≥ 16px (below that iOS zooms the page on focus),
   full keyboard operation, visible focus, correct ARIA for tabs
   (`role="tablist"`) and option groups (`role="radiogroup"`),
   `prefers-reduced-motion` honoured, WCAG AA contrast.
8. **Widths:** 320 / 360 / 390 / 430 / 768 / 1280 / 1440 / 1920 / 2400. Zero
   horizontal overflow at any of them.

---

## 4 · THE MAP TILES — what is available without a key

Researched and tested, not assumed:

| Source | Keyless | Commercial use | Resolution | Verdict |
|---|---|---|---|---|
| **EOX `s2cloudless`** | **yes** | **yes, CC BY 4.0** | Sentinel-2, 10 m, serves to z17 | **USE THIS** |
| Esri World Imagery | yes | **NO — ArcGIS licence required, not for commercial use** | 0.3–1 m | do not ship |
| OpenStreetMap standard | yes | yes (ODbL) | street map, not imagery | fallback only |
| Mapbox / MapTiler / Google | no — key | yes, paid | 0.3 m | the production upgrade |

`s2cloudless` is not a compromise here, and the copy must not apologise for it:
the buyer is positioning a **1–4 km capture footprint**, not choosing a rooftop
pixel. At 10 m, a 2 km frame is 200 px across — ample to place a frame.

Attribution is **required** and must be visible on the map:
`Sentinel-2 cloudless by EOX IT Services GmbH (CC BY 4.0)`.

The framing tool must state plainly that the basemap is reference imagery for
positioning, and that the mission captures a **new** frame at the ordered
resolution tier. Supplying `MAPTILER_KEY` / `MAPBOX_ACCESS_TOKEN` is what
raises the basemap to rooftop detail — document it, never require it.

---

## 5 · POSTER STYLE OPTIONS

The buyer chooses how the print is composed. This is the `Design` tab in every
reference. Minimum: variants that trade **image area against record area** —
one that is almost entirely the frame, one that carries the full telemetry
sheet, and points between. Plus finish/ink variants where they are real.

Every style must be a **true rendering of what will print**, composed from the
same parts the real poster uses (`components/fui/CreditBox`, the telemetry
strip, `lib/pricing` formats). A style that cannot be printed must not be
offered.

---

## 6 · ACCEPTANCE — how each build is checked

Paste real output, not claims:

1. `npx tsc --noEmit` clean; `npm run lint` clean.
2. **The CTA test.** For every purchase surface, at 320 / 390 / 768 / 1280 /
   1440 / 1920: assert the primary CTA's bounding box is inside the viewport
   **before any scrolling**. Paste the table.
3. Zero horizontal overflow at every width; zero inputs under 16px; zero
   targets under 44 × 44 (use the `hitBox` logic in `tests/support/a11y.ts`,
   which unions absolutely-positioned pseudo-elements — a naive
   `getBoundingClientRect()` produces false positives here).
4. Screenshot each surface at 390 and 1440, **look at the images with the Read
   tool**, and fix what looks wrong. You are the last reviewer.
5. `npx playwright test --reporter=line` — expect 212 passed / 2 failed, the
   two being the pre-existing self-named `DEFECT … RSC payload` tests.
6. Zero console errors on every surface.

A dev server is already running on **port 3200**. Do not start another and do
**not** run `npm run build` — it corrupts the running dev server's manifests.
