import localFont from 'next/font/local';

/**
 * Fonts are self-hosted (see public/fonts). Nothing is fetched from a third
 * party at build or run time — a fresh clone works offline.
 * IBM Plex Mono and Inter are both SIL Open Font License 1.1.
 */

export const plexMono = localFont({
  src: [
    { path: '../public/fonts/IBMPlexMono-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/IBMPlexMono-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../public/fonts/IBMPlexMono-SemiBold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
});

export const inter = localFont({
  src: [{ path: '../public/fonts/Inter-Variable.woff2', weight: '100 900', style: 'normal' }],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
});

/* ==================================================================
   THE MISSION FACES — scoped, not global.

   Two commercial faces used on the mission file (`/m`, `/s`) and on
   the poster, and nowhere else. They are DECLARED at the root (the
   `--font-*-face` custom properties below are put on <html> by
   app/layout.tsx) but nothing uses them until a `font-ductile` /
   `font-typestar` utility asks for them, and a webfont is only
   downloaded when it is actually rendered. Declaring them costs
   nothing; the body face is untouched.

   The two-name split matches the pattern the system already uses for
   Inter and Plex: next/font owns a `--font-<face>` variable holding
   ONE family, and @theme owns `--font-<role>` holding the whole stack
   including the fallback. That is why the loader variables here end
   in `-face` — `--font-ductile` and `--font-typestar` are the theme
   tokens (app/globals.css) and they wrap these.

   `adjustFontFallback` is off on both. Next's automatic fallback
   builds a size-adjusted @font-face from Arial or Times, and neither
   is what these fall back to: Ductile falls back to Inter (the site
   grotesk) and Typestar to IBM Plex Mono. A synthetic Arial metric
   between them would be a worse match than the real face underneath.
   ================================================================== */

/**
 * DUCTILE DISPLAY — the mission code lockup (`MISSION / 32BF`) and the
 * large mission titles. Display sizes only; never body, never a label.
 *
 * CAPS ONLY. The file ships 82 glyphs and no lowercase, so anything
 * set in it must carry `text-transform: uppercase` or the lowercase
 * letters drop through to Inter mid-word. The `.mission-title` and
 * `.mission-lockup` classes in globals.css do this for you — prefer
 * them to a bare `font-ductile`.
 *
 * Metrics: 1000 upm, cap-height 875 (very tall), advance ~1.0em. It
 * sets far larger than Inter at the same px, so the display roles it
 * takes are stated at their own sizes rather than borrowing
 * `--text-hero`.
 */
export const ductile = localFont({
  src: [{ path: '../public/fonts/DuctileDisplay.woff2', weight: '400', style: 'normal' }],
  variable: '--font-ductile-face',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
});

/**
 * TYPESTAR OCR — the detail layer. Telemetry labels, readings,
 * timestamps, coordinates, file tags, sequence rows. Everything that
 * is a fact rather than a sentence.
 *
 * Metrics: 1000 upm, x-height 545, cap-height 709, advance 0.664em.
 * The x-height is 6% larger than IBM Plex Mono's (516) and the advance
 * 11% wider, which is the whole reason the detail ramp could come down
 * to 11/10/9: it reads a size larger than it is set, and it needs less
 * tracking than the mono ramp to stay open.
 */
export const typestar = localFont({
  src: [{ path: '../public/fonts/TypestarOCR-Regular.woff2', weight: '400', style: 'normal' }],
  variable: '--font-typestar-face',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
});

/**
 * The two mission faces as one className, for a subtree that has to
 * carry them itself — a standalone document render, or the poster
 * route's own HTML shell. The app shell already puts both on <html>,
 * so a page inside it never needs this.
 */
export const missionFontVars = `${ductile.variable} ${typestar.variable}`;
