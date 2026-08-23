# BRIEF V2 — the selling rebuild

Binding for every agent. Read completely before writing code.

## THE PRODUCT
Shot from Space sells one thing: a photograph of your home taken from orbit,
delivered as a framed print. Each order is a MISSION with a code (2 digits +
2 letters, e.g. 32BF). This is a **website that sells** — every screen should
move a visitor toward starting a mission.

## THE DELIVERABLE (see RESULT.pdf at repo root — this is the real product)
The poster is **dark on top, paper-white below**:
- Top ~65%: full-bleed satellite frame. Logo lockup top-left. Rotated
  `ORIGINAL` on the right edge. Bordered `[ SHOT FROM SPACE ]` credit + capture
  timestamp bottom-left. `MISSION 32BF` in wide display type bottom-right.
- Bottom ~35%, **light ground**: `MISSION / 32BF` heading, a mission-purpose
  paragraph, MISSION PERSONNEL, an orbit diagram with `ORBIT: //ELIPSE 33°`,
  `SHOT.SPACE/M32BF`, a SEQUENCE OF EVENTS table with elapsed timings
  (acquisition window open, target lock, frame exposed, downlink initiated,
  ground receipt confirmed, declassified for print), a TARGET block (actual vs
  planned frame centre, deviation, altitude, GSD), `ANOMALIES: NONE`, and the
  3D chrome mark as a large watermark. Rotated `DECLASSIFIED` on the right edge.

That dark→light split is the site's core aesthetic. Use it.

## BRAND ASSETS (installed, use them)
- `/brand/logo-wordmark.svg` — the real logo lockup. **There IS a logo now.**
  Use it in the header and footer.
- `/brand/mark-3d.png` + `.webp` — chrome 3D mark, for watermarks and accents
- `/brand/mission-patch.png` + `.webp` — embroidered mission patch
- `/brand/mission-coin.png` + `.webp` — struck bronze mission coin
- `/video/intro.mp4`, `/video/zoom-logo.mp4`, `/video/result.mp4` — H.264,
  720×1280 portrait, ~6–9s, silent. Each has a `-poster.jpg`.
  **Always** `muted playsInline loop` + `poster`, `preload="metadata"`, and
  never autoplay more than one per viewport.

## LIGHT / DARK
The page alternates ground, it does not run one value top to bottom.
- Dark bands: `bg-void` with `text-paper`
- Light bands: `bg-paper` with `text-void` (use `text-void/70` for secondary)
Imagery and video sit in dark bands; specification, proof, pricing and result
content sit in light bands. Aim for roughly half and half.

## TYPE — bigger than before
- Display/hero: **64→88px** desktop, 40→52px mobile, weight **400**,
  line-height **1.0–1.05**, tracking −0.02em. Big and calm, never bold.
- Section heading: 28→40px, weight 400, line-height 1.15
- Body: 16→17px, line-height 1.5
- Label: 12→13px uppercase, +0.04em, weight 500
Tokens live in `app/globals.css` under `@theme`.

## MOTION — one curve, everywhere
`0.3s cubic-bezier(0.4, 0, 0.2, 1)` is the house transition. Longer reveals may
use 0.6–0.9s with the same curve. Never bounce. Always honour
`prefers-reduced-motion`.

## BUTTONS
- Radius **6px** (cards 12px). Height 44–52px. Font 16px, weight 500.
- Primary: paper ground, void text. Hover: lifts 1px, gains a soft shadow,
  background shifts to the signal accent.
- Secondary: 1px hairline border, transparent. Hover: border brightens, faint
  fill.
- Transition colour/background/transform/box-shadow on the house curve.
- Press state: returns to 0 translate — the `interior` press-depth idiom.
- Shadows ARE allowed on buttons and lifted cards now (this reverses the
  earlier ban). Keep them soft and low-contrast, never a glow.

## HOVER EVERYWHERE
Every interactive element responds: links, cards, tiles, rows, images, nav.
Image cards: scale 1.02–1.04 with the house curve, plus a caption reveal.

## BANNED (still)
Purple/indigo/teal accents, glassmorphism, emoji, Tailwind default blue,
gradient blobs, generic SaaS centred-hero-with-two-buttons, uniform section
padding everywhere.

## DROPPED FROM THE OLD SPEC (deliberately)
- **No `01.` `02.` `03.` numbered section eyebrows.** They read as
  vibe-coded. Use a short uppercase label or nothing.
- **No hairline square boxes as the default container.** Prefer full-bleed
  media, generous whitespace, and light/dark ground changes to separate
  sections. A bordered box must earn its place.

## HONESTY RULE — non-negotiable
This company has not shipped a mission yet. **Do not invent customer
testimonials, names, quotes, photos, ratings, review counts, customer numbers
or press logos.** Social proof must come from things that are true: the
guarantees below, the physical artifacts (patch, coin, print), the process
itself, and clearly-labelled example missions.

Real guarantees you may state (they are in `/legal/terms`):
- Full refund if no usable frame is acquired within 60 days.
- Cloud-blocked passes are re-tasked at no cost.
- Damaged or misprinted deliveries are replaced.
- Shipping and duties included in the price shown.
- Cancel any time before the satellite is tasked.

## LOGIC IS A DONOR — DO NOT BREAK IT
`lib/`, `app/api/`, `prisma/` are working and must keep working: the 9-stage
mission state machine, mocked adapters (`MOCK_MODE=true`), seeded demo missions
32BF / 74KL / 18QD / 55RA, magic-link auth, poster route, comms. Change
presentation, not behaviour.

## VERIFY
`npx tsc --noEmit` and `npx eslint .` clean. A dev server runs on :3000 — do
NOT start another and do NOT run `npm run build` (it now writes to
`.next-build`, but still avoid it). Check your pages return 200.

---

## TOKEN CONTRACT — code against these names now

Agent 1 owns `app/globals.css` and the button/hover primitives. Everyone else
consumes these exact names and must not redefine them. They will exist.

### Type utilities
`text-hero` (64→88px, w400, lh1.0, −0.02em) · `text-display` (40→52px) ·
`text-heading` (28→40px) · `text-body` (16→17px, lh1.5) ·
`text-label` (12→13px, uppercase, +0.04em, w500) · `text-action` (16px, w500)

### Ground utilities
`surface-dark` → `bg-void text-paper` · `surface-light` → `bg-paper text-void`
Secondary text inside them: `text-paper-dim` / `text-void-dim`

### Motion
`ease-house` → `cubic-bezier(0.4,0,0.2,1)` · `duration-house` → `300ms`
Utility `transition-house` = transition-all with both.

### Components (from `@/components/fui`)
```
<Button variant="primary"|"secondary"|"ghost" size="md"|"lg" href? onClick? />
<Band top bottom tone="dark"|"light"> — tone sets the ground
<Container size="wide"|"narrow"|"flush">
<Grid12>
<HoverCard>      — image/media card with hover scale + caption reveal
<OrbitDiagram animated>  — must animate: the marker travels the track
<Guarantee icon label detail />
```

### Existing, still available
`CreditBox`, `MissionCode`, `CropMarks`, `FileTags`, `StatusChip`,
`DataRow`, `KeyValueGrid`, `Rule`, `Spacer`, `ScanSweep`, `Skeleton`,
`EmptyState`, plus `components/interior/*` (MIT: `value-flash`,
`streaming-text`, `blur-up-image`, `copy-button`) and `motion` for animation.

### Ownership — do not edit outside your paths
- A1 foundation: `app/globals.css`, `components/fui/**`, `components/site/**`
- A2 hero: `components/hero/**`
- A3 landing: `app/page.tsx`, `components/landing/**`
- A4 result: `lib/poster/**`, `app/missions/**`, `components/discovery/**`
- A5 flows: `app/start/**`, `components/purchase/**`, `app/m/**`,
  `components/mission/**`, `app/account/**`, `app/auth/**`
