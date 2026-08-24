# SYSTEM V3 — the layout system

Binding for every agent. This document describes **measurements and structural
archetypes**. Build original implementations of them in this codebase.

## WHAT YOU MAY NOT DO
There is a scraped copy of a reference site on this machine. **Do not read it,
import from it, or copy any file out of it.** Specifically never bring across:
- Font files. It ships licensed commercial typefaces (Helvetica Now Display,
  Elios). We use Inter + IBM Plex Mono, already installed.
- Photography, video, posters, logos, icons.
- Copy. Every word on our site is ours.
Everything you need is in this document.

---

## 1 · THE CONTENT COLUMN
- Max width **1440px**, gutters **2rem (32px)** each side → `width: calc(100% - 4rem)`,
  clamped to `calc(1440px - 4rem)` at ≥1440.
- A section may **opt out** and run full-bleed. That alternation — column,
  full-bleed, column — is the page's rhythm. It is not decorative.
- Full-bleed sections control their own internal padding.

## 2 · BREAKPOINTS — five, not two
`768` · `1280` · `1440` · `1920` · `2400`

We currently design at 390 and 1440 and let everything in between stretch. That
is the single biggest structural gap. Layouts must be deliberate at each step:
column counts, type size and media aspect should change at these widths, and
the page must still be composed at 1920 and 2400 rather than a 1440 design
floating in dead space.

## 3 · TYPE
Keep our roles (`text-hero` 40→60, `text-display` 28→40, `text-heading` 20→26,
`text-body` 16, `text-label` 12→13, `text-action`). What changes: they must be
tuned at all five breakpoints, not interpolated between two. Weight stays 400
for display; negative tracking on large sizes; uppercase +0.04em on labels.

## 4 · MEDIA CARD ARCHETYPE
The workhorse. Structure:
- A fixed-ratio frame, full-bleed media filling it.
- A dark overlay layer at ~50% using `mix-blend-mode: multiply`, sitting above
  the media and below the content. Multiply (not a plain black scrim) is what
  keeps the photograph's colour rather than greying it.
- Content anchored **bottom-left**, inset ~2rem bottom / ~1.15rem left, above
  the overlay, `pointer-events: none` so the whole card stays one link.
- A small arrow glyph, ~0.8rem, shrink-0.
- At rest: title only. On hover: media scales slightly, overlay deepens, title
  rises, subtitle + arrow appear. We already have this in `<MediaCard>` —
  align it to these measurements.

## 5 · SECTION ARCHETYPES
Build our equivalents; the *shape* is what transfers, the content is ours.
1. **Announcement band** — thin full-width strip, one line, one link.
2. **Hero** — full-bleed media, copy low-left, minimal chrome.
3. **Featured grid** — a grid of media cards at mixed spans, no gutters between
   tiles, forming a mosaic block.
4. **Media-link section** — one large media panel that is itself a link, with a
   heading over it.
5. **Feature/announcement** — media on one side, a text column on the other,
   alternating side down the page.
6. **News/index** — a list of dated entries with a lead item.
7. **Footer** — tall, link-dense, grouped columns.

## 6 · MOTION
- One easing curve site-wide: `cubic-bezier(0, 0, 0.58, 1)` (ease-out) for
  entrances; keep our `cubic-bezier(0.4, 0, 0.2, 1)` at 300ms for hover/state.
- Smooth scroll on the document.
- Scroll-in reveals: opacity + small translate, ~1s, heavily eased. Nothing
  bounces. Respect `prefers-reduced-motion` everywhere.

## 7 · KEEP OURS
- The mosaic hero (`components/hero/`) with its cascade — do not replace it.
- The 3D artifacts (`components/artifact/`) — patch matte, coin gloss.
- Light/dark band alternation and the SFS palette (`--color-void`,
  `--color-paper`, one signal accent).
- Our videos (`/video/*.mp4`), imagery (`/imagery/*`), brand marks (`/brand/*`).
- All logic: `lib/`, `app/api/`, `prisma/`, the 9-stage state machine,
  mocked adapters, seeded demos, magic-link auth, poster route, comms.

## 8 · HONESTY
No invented testimonials, customer names, quotes, ratings or partner logos.
Proof is the five contractual guarantees, the physical artifacts, and
clearly-labelled example missions.

## 9 · VERIFY
`npx tsc --noEmit` and `npx eslint .` clean. Dev server runs on :3000 — do not
start another and do not run `npm run build`. Check 390 / 768 / 1280 / 1440 /
1920: no horizontal overflow, nothing under 44px tappable on touch widths.
