# WAVE 7 — the owner's six corrections

Binding. Read with `CONFIGURATOR.md` and `WAVE.md`, both still in force in full.
Dev server is already on **3200**. Do not start another. Do **not** run `npm run build`.

## THE SIX, quoted

1. *"this is too much text for a header first landing page"* — the homepage hero.
2. *"make the menu bar floatin and fixed all of the pages"*.
3. *"beside teh addres you should choose the date as well or 'first come'"*.
4. *"same design as orbits but make the satelites svg and orbit show on click"* — the fleet cards.
5. *"ask for mobile hone after the purchae to 'let you know when we find a satellite'"*.
6. *"here put awards"* — the DISTINCTIONS / DIGITAL ONLY section, which today opens with
   two paragraphs of prose before any artwork is visible.

## OWNERSHIP — do not edit a file owned by another agent

| Agent | Owns |
|---|---|
| A · NAV | `components/site/SiteHeader.tsx`, `components/site/MobileNav.tsx`, header rules in `app/globals.css`, `components/purchase/layout.ts` |
| B · HERO | `components/landing/HeroBand.tsx`, `MissionEntry.tsx`, `OrbitEntryBand.tsx`, `lib/mission-flow/state.ts`, `lib/mission-flow/config.ts`, `components/mission-flow/MissionFlow.tsx`, `S7Windows.tsx`, `S4Name.tsx` |
| C · FLEET | `components/satellites/**`, `components/landing/FleetBand.tsx` |
| D · PHONE | `components/mission-flow/S10Confirmation.tsx`, `prisma/schema.prisma`, `app/api/**` (new route only), `lib/missions/index.ts` |
| E · AWARDS | `components/mission/HonoursBlock.tsx` |

Shared read-only: everything else. If you believe you must touch another agent's file,
**do not** — write the requirement in your report and I will land it.

## HARD RULES (unchanged)

- Existing design system only. `components/fui`, existing type roles, existing spacing,
  existing motion. BANNED: rounded-2xl, gradient blobs, purple/indigo/teal, glassmorphism,
  drop shadows, emoji, Tailwind default blue, template components.
- **MOCK_MODE stays true. Never require a key. Never ask the owner for one.**
- **Honesty.** Never state a fact the system cannot produce. No invented dates, ETAs,
  probabilities or capabilities. If nothing is sent, the screen says nothing is sent.
- a11y: 44x44 targets, `env(safe-area-inset-*)` on anything fixed, inputs >=16px,
  full keyboard, visible focus, correct ARIA, `prefers-reduced-motion`, WCAG AA.
- Widths 320 / 360 / 390 / 430 / 768 / 1280 / 1440 / 1920 / 2400. Zero horizontal overflow.
- **The CTA rule**: the primary action is visible without scrolling, every step, every width.
- Never delete a file with a variable path. Absolute paths inside the repo only.

## ACCEPTANCE — paste real output, never a claim

1. `npx tsc --noEmit` clean, `npm run lint` clean.
2. Screenshot every surface you touched at 390 and 1440, **open the PNG with the Read
   tool and look at it**, fix what looks wrong. You are the last reviewer of your own work.
3. Zero console errors on those surfaces.
4. `npx playwright test --reporter=line` at the end of your task; report the count.
   Baseline is 215 passed / 2 failed (the self-named `DEFECT ... RSC payload` pair).
5. Report exactly what you changed, and anything you could not do and why.
