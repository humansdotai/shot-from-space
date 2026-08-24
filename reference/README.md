# /reference

Structural reference for the Shot from Space build.

**What this is.** Original prose analysis of a layout system — page
architecture, grid geometry, vertical rhythm, type hierarchy, density rules and
motion — written from real measurements taken in a headless browser. It exists
so that layout decisions across the nine screens come from one documented system
instead of nine separate guesses.

**What is here.**

- `STRUCTURE.md` — the analysis, twelve reusable section archetypes with
  wireframes, and a concrete mapping from each archetype to a Shot from Space
  screen, including what we explicitly reject.

**Rules for this directory.**

- **Prose and diagrams only.** No third-party assets are stored in this
  repository — no screenshots, no HTML dumps, no images, fonts, icons, copy,
  logos or brand elements. The capture artifacts behind this analysis are
  local-only and live outside the repo; `STRUCTURE.md` §11 says where.
- Nothing here is imported by application code. It is documentation.
- Per CONTRACT §2.3, the reference informs **layout architecture, section
  rhythm, navigation patterns and density calibration only.** Copy nothing else.
