# MISSION BRIEF — video card + swipeable deck

For `/m/[code]`. Binding.

## A · THE ENTRY CARD
A floating card near the top of the mission page, **rounded corners**, playing a
short silent video on loop, labelled **MISSION BRIEF**. Pressing it opens the
deck.

Clips available in `/video/` — all H.264, 720×1280 portrait, silent, each with a
matching `-poster.jpg`: `intro.mp4`, `zoom-logo.mp4`, `orbit.mp4`, `result.mp4`.
`<VideoPlate>` in `components/hero/` already handles muted/playsInline/loop,
poster, intersection + tab-visibility gating and a pause control — **reuse it**,
do not write a second video component.

The card floats: it sits above the page surface with a soft shadow, not inside
a band. On hover it lifts slightly. Under `prefers-reduced-motion` the poster
frame shows and nothing plays.

## B · THE DECK
Opening the brief presents the whole mission as a **stack of cards**:
**white cards on a black ground**. One subject per card, advanced by a Next
control, by **swipe on touch**, and by **arrow keys on desktop**.

Suggested cards — six, adjust if the data argues otherwise:
1. **Where we are looking** — city-level place, coordinates, the capture
   footprint in km.
2. **The pass** — inclination, altitude, azimuth, off-nadir, orbit track.
3. **Conditions** — cloud cover and sky state, sun elevation and azimuth,
   visibility, wind, temperature.
4. **What will resolve** — ground sample distance, and honestly what that does
   and does not show at that scale.
5. **Next steps** — the remaining stages from `MISSION_STAGES` with what each
   one means and, where the record holds one, when.
6. **What arrives** — format, finish, packaging, print facility, delivery
   estimate.

## C · DATA — real only
Everything comes off the mission record and the existing derivations:
- place / coordinates / footprint → the mission row
- pass geometry → `mission.orbit`
- conditions → `lib/missions/conditions.ts` (real NOAA solar maths, documented
  climatology, cloud read off the record — do not re-derive or decorate)
- stages → `MISSION_STAGES`, `STAGE_LABEL`, `STAGE_DESCRIPTION`, and the
  mission's own events
- object → `lib/pricing.ts`, `MATERIALS` / `PACKAGING` in `lib/guarantees.ts`
- guarantees → `lib/guarantees.ts` only, never re-typed

**If the record does not hold a value, the card says so.** No invented pass
time, no fabricated countdown, no placeholder weather. A card with one honest
line beats a card with six invented ones.

Public/shared viewers must never see private fields — the deck follows the same
ownership rules the page already applies. Coordinates: 4dp for the owner, 2dp
for everyone else.

## D · INTERACTION
- **Swipe** on touch, horizontally, with the card following the finger and
  settling. A short flick advances; a slow short drag springs back.
- **Next / Back** controls, always visible, ≥44px.
- **Arrow keys** left/right when the deck has focus; **Escape** closes.
- Progress shown as position in the set (e.g. `03 / 06`) — a real readout, not
  dots.
- The deck is a dialog: focus is trapped while open, focus returns to the entry
  card on close, `role="dialog"` + `aria-modal`, and the page behind does not
  scroll.
- **`prefers-reduced-motion`: no slide, no spring** — cards change instantly.
- Cards must be readable as a **linear document** to assistive technology; a
  screen reader user must be able to reach every card's content.

## E · LOOK
- White cards on black. Ink on a card is `--color-void`; the ground is
  `--color-void` too, so the card must separate by fill and shadow, not by a
  border.
- **Rounded corners are a deliberate exception** to the 2px rule, alongside
  pills. Add a token, document which components may use it, and do not let it
  spread to plates, inputs, tables or bands.
- Type: the same roles as the rest of the product. Detail ramp for readouts,
  sans for prose. Monospace only for coordinates, timestamps, codes, elapsed
  times.
- Use the icon set in `components/fui/icons/` for typed rows. No emoji.
- One curve: `cubic-bezier(0.4,0,0.2,1)`, 300ms. Nothing bounces.

## F · VERIFY
`npx tsc --noEmit`, `npx eslint .`, `npm test`. Dev server on **:3200** — do not
start another, do not run `npm run build`. Port 3000 is a different project.
Check 390 / 768 / 1280 / 1440 / 1920: no horizontal overflow, nothing under
44px tappable at touch widths, no console errors, no hydration warnings.
