# READOUT — killing the generated look

Binding. Six named defects, all visible on `/m/[code]` and the landing page.

## THE DIAGNOSIS
The same label/value row is repeated across the entire product: mono type at
one size, label left, value right, hairline between, every row weighted
identically. Nothing is more important than anything else, so the reader has to
scan every row to find one fact. That uniformity is what reads as generated —
not the colours and not the fonts.

Researched principle: *design it so the structure speaks; status becomes a
scannable token; icons signal type or state without spending a word; the value
that drives the decision dominates, supporting values step back.*

## D1 · THE HAIRLINE STRIP → A PILL
The strip reading `MISSION FILE · SHOT.SPACE/M03HA · HANDLING — ROUTINE ·
RELEASE — FILE HOLDER` is four mono labels between two hairlines. Replace with
a **solid pill**: white/paper fill, **fully rounded** ends, dark ink, its
segments divided by thin dividers rather than floating in space.

**This is a deliberate exception to the 2px radius rule.** Pills apply to
status chips and these meta strips only; cards, plates, inputs and buttons keep
their existing radii. Document the exception where the radius tokens live.

## D2 · LABEL/VALUE LISTS → A READABLE INSTRUMENT BLOCK
Applies to the mission specification block, conditions, pass telemetry, and the
example-mission readouts.

Fix all four of these together — any one alone leaves it looking generated:
1. **Hierarchy.** Pick the two or three values that actually matter on that
   screen and let them dominate in size and weight. Everything else steps back.
   Not every row is a headline.
2. **Grouping.** Cluster related values with real separation between clusters.
   One flat list of nine rows is the problem.
3. **Icons.** A small, precise icon per row signalling *type* — coordinate,
   time, orbit, cloud, sun, facility, format. Line icons, currentColor,
   consistent stroke weight, ~16px, drawn as inline SVG. **A few may animate**
   where the value is live (a pulsing dot on an active pass, a rotating tick on
   an orbit). Animation must be rare, slow, and off under
   `prefers-reduced-motion`.
4. **Status as a token**, not a sentence. `ROUTINE`, `NOMINAL`, `CLEAR` become
   chips.

Do NOT invent icon meanings that contradict the data, and do not add an icon
to a row that has no type — an icon per row for its own sake is the same
uniformity in a new costume.

## D3 · PRICE LIST → NOT A LEDGER
Six rows of `SIZE · FINISH` against `$x / €y` is the same flat pattern. Rebuild
so a buyer can compare in one glance: group by size, show the finish choice
within it, let one price be primary and the alternate secondary. Consider the
physical proportion of each format as the visual anchor — the object is
different at each size and the page never shows that.

## D4 · THE CHROME MARK → BIGGER, AND PHYSICAL
`public/brand/mark-chrome.png` (925×722). Everywhere it appears: render it
**larger and more confidently**, and on hover give it a smooth zoom, a real
shadow, and a **damped 3D tilt toward the pointer**.

`components/artifact/Artifact3D.tsx` already implements exactly this physics —
spring damping, shadow parallax, specular for metal. **Reuse it.** The mark is
polished chrome, so `material="metal"` is correct here. Do not write a second
tilt implementation.

## D5 · THE EMPTY PLATE + AMBIENT MOSAIC
The awaiting-acquisition plate is a large empty dark rectangle with a caption.
It is the biggest dead area in the product.

- **On that plate: run the mosaic field prominently.** It is the frame being
  resolved — cells sampling and settling, cascading. `components/hero/` already
  has the engine; reuse it, do not rewrite it.
- **Elsewhere on the mission page: run it far more subtly** as ambient texture
  behind dark bands — barely perceptible, no cascade seeding on pointer move.
- Both must respect `prefers-reduced-motion` and coarse pointers exactly as the
  hero does: one static frame, no loop.

## D6 · "SEARCHING FOR SATELLITES" — the Uber moment
While a mission is before `IMAGE_ACQUIRED`, the top of `/m/[code]` should carry
a **small floating status card**: a clean orbit animation — Earth arc,
satellites tracking, the target marked — with a short line in small type
(`Searching for a pass over your target`, `Next pass in …`). The reference is
a ride-hailing app looking for a driver: calm, confident, obviously alive,
never a spinner.

Use real mission data — `windowOpensAt`, `windowClosesAt`, the orbit block. Do
not invent a countdown that is not real. `components/mission/OrbitPlot.tsx`
exists and has real orbital geometry; this is a smaller, calmer sibling, not a
duplicate.

## RULES
- No emoji, ever, including as icons.
- One curve: `cubic-bezier(0.4,0,0.2,1)`, 300ms. Nothing bounces.
- Accent is a state colour; it is not a fill.
- Everything works at 390 / 768 / 1280 / 1440 / 1920 / 2400.
- All logic in `lib/`, `app/api/`, `prisma/` is untouched.
- Nothing invented: every number shown is real or clearly derived demo data.

## VERIFY
`npx tsc --noEmit`, `npx eslint .`, `npm test`. Dev server on **:3200** — do not
start another, do not run `npm run build`. Port 3000 is a different project.
