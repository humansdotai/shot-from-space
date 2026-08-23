# Font sources — NOT served

The OpenType originals for the two **commercial** mission faces live here,
outside `public/`, so the web server cannot hand them out.

    DuctileDisplay.otf
    TypestarOCR-Regular.otf

## Why they moved

They sat in `public/fonts/` next to the `.woff2` files the site actually
loads. Nothing referenced them — `lib/fonts.ts` loads only the `.woff2` — but
`public/` is the static web root, so both were downloadable in full:

    GET /fonts/DuctileDisplay.otf      → 200, 158 KB
    GET /fonts/TypestarOCR-Regular.otf → 200,  22 KB

Serving the installable desktop binary of a licensed typeface is a different
and much larger act than serving a subset webfont. Almost every commercial
font EULA separates a *webfont* licence from a *desktop* licence and forbids
redistribution of the original file. This removes that exposure. It changes
nothing at runtime.

## Licensing is still OPEN — see REVIEW.md

Moving the files does not license them. Before this ships publicly the owner
must hold a **webfont licence** for both faces, sized to the expected monthly
pageviews:

  - **Typestar OCR** — the detail layer (telemetry, labels, timestamps).
  - **Ductile Display** — the mission code lockup and mission titles.

If either licence cannot be obtained, both have a documented fallback already
wired in `lib/fonts.ts` (Typestar → IBM Plex Mono, Ductile → Inter, both
OFL-1.1 and already self-hosted), so the site degrades without a code change.

## Regenerating the subsets

The `.woff2` in `public/fonts/` were built from these. Keep them here for that
purpose only.
