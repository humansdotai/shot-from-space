/**
 * FONT RESOLUTION FOR THE SVG OVERLAY LAYER
 *
 * The poster's FUI layer is an SVG string composited by sharp. sharp renders
 * SVG through librsvg + pango, and that stack knows nothing about the browser:
 * `@font-face` with a data URI is silently ignored (verified — it falls
 * straight through to the default family). So a face has to reach the renderer
 * through the platform's own font machinery:
 *
 *   1. Point fontconfig at `public/fonts` with a generated config file.
 *      FreeType 2.11+ reads WOFF2 directly (sharp 0.35 bundles 2.14 with
 *      brotli), so the same files the site loads in the browser are usable
 *      here — no extra assets, no new dependencies. This is the route that
 *      matters in production, where the renderer is Linux.
 *   2. Fall back to the generic `monospace` family, which always resolves to
 *      sharp's bundled DejaVu faces.
 *
 * ------------------------------------------------------------------------
 * WHAT IS AND IS NOT VERIFIED — read this before trusting a local render
 * ------------------------------------------------------------------------
 * ON macOS, ROUTE 1 DOES NOTHING. Measured, not assumed: a WOFF2 *and* an OTF
 * carrying a family name that exists nowhere else were dropped into
 * `public/fonts` and neither resolved, while `Ductile Display`, `Typestar` and
 * `IBM Plex Mono` all did — because all three are installed in the developer's
 * `~/Library/Fonts`. pango's macOS backend is CoreText, which enumerates
 * installed system fonts and ignores `FONTCONFIG_FILE` entirely.
 *
 * So a Mac render proves the PLATE (sizes, tracking, measures, glyph coverage)
 * and proves nothing about whether the shipped WOFF2 files can be embedded on
 * the deployment host. That has to be confirmed where it runs, and this file
 * makes it a one-line check: every process logs what actually resolved —
 *
 *     [poster] fonts — display "Ductile Display" (ductile, scale 0.807) ·
 *                      detail "Typestar" (typestar, advance 0.664em)
 *
 * If the Linux build cannot read the WOFF2, that line says `plex` or `dejavu`
 * instead and the plate is set in the documented fallback rather than in a
 * silent substitution. Check the line after the first deploy; if it reports a
 * fallback, ship the `.otf` originals from `assets/fonts-source/` into the
 * image (a desktop-licence question, see that directory's README) or subset
 * them to TTF, and point `fontDir()` at them.
 *
 * ------------------------------------------------------------------------
 * THE TWO MISSION FACES
 * ------------------------------------------------------------------------
 * The screen sets `MISSION / 32BF` in **Ductile Display** and every readout in
 * **Typestar OCR** (lib/fonts.ts, app/globals.css). The plate now asks
 * fontconfig for the same two, so the printed object and the mission page
 * agree.
 *
 *   display  Ductile Display — the mission code lockup and the large mission
 *            titles. CAPS ONLY: the file ships 82 glyphs, no lowercase, and
 *            no `°`, `·`, `—` or `−`. Anything set in it is uppercased at
 *            source and checked against `DISPLAY_COVERAGE` first, because
 *            pango's per-glyph fallback is silent — a missing glyph does not
 *            fail, it just changes face mid-word.
 *   detail   Typestar OCR — telemetry, the sequence-of-events table, the
 *            target rows, the labels, the prose. Monospaced at 0.664em.
 *
 * ------------------------------------------------------------------------
 * WHY EVERYTHING BELOW IS MEASURED RATHER THAN DECLARED
 * ------------------------------------------------------------------------
 * fontconfig never fails a request. Ask for a family it does not have and it
 * returns its best match, so "the SVG says Typestar" proves nothing about what
 * came out. Two things therefore have to be established by rendering:
 *
 *   1. DID THE FACE RESOLVE? A sample is rendered in the requested family and
 *      again in each of the defaults it could have been substituted with — an
 *      impossible family name, `sans-serif`, `serif`, `monospace`. Identical
 *      pixels against any of them mean fontconfig substituted, and we take the
 *      documented fallback rather than shipping a silent one. See `BASELINES`
 *      for why the impossible name alone is not enough.
 *   2. HOW WIDE AND HOW TALL IS IT? The plate has no text-measuring API: it
 *      places a bordered credit box around a string, hangs a slash inside a
 *      URL and wraps a paragraph to a measure, all from arithmetic. Those sums
 *      need the *real* advance of the *real* face — 0.664em for Typestar
 *      against 0.600em for Plex is an 11% error on every width on the sheet.
 *      So the advance is measured off two renders (10 glyphs and 20 glyphs,
 *      differenced to cancel side bearings) and the cap-height off one.
 *
 * The whole probe is ~8 tiny rasters, once per process.
 *
 * Note for anyone verifying by hand: the host's own `fc-scan`/`fc-list` cannot
 * read these WOFF2 files on macOS (Homebrew's FreeType is built without
 * brotli), so an empty `fc-list` says nothing about what sharp can do — and a
 * NON-empty one may be listing the developer's installed copies rather than
 * ours. Probe through sharp, which is what this file does.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

/** Which face is actually doing each job, once the probe has spoken. */
export type DisplaySource = 'ductile' | 'plex' | 'dejavu';
export type DetailSource = 'typestar' | 'plex' | 'dejavu';

export interface FontStack {
  /** Family for the mission code lockup and large mission titles. */
  display: string;
  /** Family for telemetry, tables, labels and prose. Monospaced. */
  detail: string;
  /**
   * Measured horizontal advance of `detail`, in em. Every width on the sheet
   * is derived from this — see `monoWidth`.
   */
  detailAdvance: number;
  /**
   * Multiplier applied to display sizes so the display face lands at the
   * cap-height the plate was drawn against. Ductile's cap is 875/1000 against
   * Plex's 698, so set at the same px it is 25% taller; without this the
   * lockup would grow by a quarter the day the licence lands.
   */
  displayScale: number;
  /** `display` is caps-only with a restricted glyph set. */
  displayCapsOnly: boolean;
  /** What resolved, for the log line and for tracking decisions. */
  source: { display: DisplaySource; detail: DetailSource };
}

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

/**
 * Typestar's name table is inconsistent across platform records: the Windows
 * record calls the family `Typestar OCR`, the Mac and Unicode records call it
 * `Typestar` with style `OCR`. Which one fontconfig indexes depends on the
 * build — on sharp 0.35/macOS it is `Typestar` — so both are offered and the
 * probe picks whichever actually renders.
 */
const DETAIL_CANDIDATES = ['Typestar OCR', 'Typestar'] as const;
const DISPLAY_CANDIDATE = 'Ductile Display';
const PLEX = 'IBM Plex Mono';
const GENERIC_MONO = 'monospace';

/**
 * The faces a request can land on when the one we asked for is not there.
 *
 * A family name that cannot exist is NOT enough on its own: fontconfig's
 * best-match for an unknown name is not always the same as its `sans-serif`,
 * and it is not — on sharp 0.35/macOS an unknown name lands on DejaVu Serif
 * while `Typestar OCR` (a name fontconfig does not index, because the font's
 * Mac record calls the family `Typestar`) lands on DejaVu Sans. Comparing
 * against the unknown name alone would have called that a success and shipped
 * the whole sheet set in DejaVu.
 *
 * So a candidate is compared against all four defaults, and matching any one
 * of them means it did not resolve to itself.
 */
const BASELINES = ['Sfs Unresolvable Face 0000', 'sans-serif', 'serif', 'monospace'] as const;

/**
 * The 81 code points Ductile Display actually ships. A string outside this set
 * must not be set in it — pango would fall back per glyph, silently, and the
 * lockup would change face halfway through. Read off the font's cmap.
 */
const DISPLAY_COVERAGE = /^[A-Z0-9 !"#$%&'()*+,\-./:;<=>?@[\\\]_{}~£¥©®ÂÎ×÷ĂȘȚ€™]*$/;

/**
 * True when `value` can be set in the display face without any glyph dropping
 * through to another one. Callers pass an already-uppercased string.
 */
export function displaySafe(fonts: FontStack, value: string): boolean {
  return !fonts.displayCapsOnly || DISPLAY_COVERAGE.test(value);
}

/** IBM Plex Mono and DejaVu Sans Mono are both 0.6em. Typestar is 0.664em. */
export const MONO_ADVANCE = 0.6;

const FALLBACK_STACK: FontStack = {
  display: GENERIC_MONO,
  detail: GENERIC_MONO,
  detailAdvance: MONO_ADVANCE,
  displayScale: 1,
  displayCapsOnly: false,
  source: { display: 'dejavu', detail: 'dejavu' },
};

/* ------------------------------------------------------------------ */
/* fontconfig                                                          */
/* ------------------------------------------------------------------ */

/** Where the site's self-hosted WOFF2 files live. */
function fontDir(): string {
  return path.join(process.cwd(), 'public', 'fonts');
}

/**
 * Write a minimal fontconfig file that adds `public/fonts` to the search path
 * and give fontconfig a writable cache directory. Returns false if anything
 * about the filesystem says no — a read-only bundle, a missing public dir, a
 * serverless layout that did not ship static assets.
 */
function installFontconfig(): boolean {
  const dir = fontDir();
  if (!fs.existsSync(dir)) return false;

  // Respect an operator-provided config; never clobber it.
  if (process.env.FONTCONFIG_FILE) return true;

  try {
    const root = path.join(os.tmpdir(), 'shot-from-space-fontconfig');
    const cache = path.join(root, 'cache');
    fs.mkdirSync(cache, { recursive: true });
    const conf = path.join(root, 'fonts.conf');
    fs.writeFileSync(
      conf,
      `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${dir}</dir>
  <cachedir>${cache}</cachedir>
</fontconfig>
`,
      'utf8',
    );
    process.env.FONTCONFIG_FILE = conf;
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* The probe                                                           */
/* ------------------------------------------------------------------ */

const PROBE_SIZE = 100;
const PROBE_HEIGHT = 220;
const PROBE_BASELINE = 170;
const PROBE_PAD = 20;
/** Greyscale value above which a pixel counts as inked. White on black. */
const PROBE_INK = 40;

interface ProbeResult {
  /** Raw greyscale bytes — compared against the sentinel to detect a swap. */
  raw: Buffer;
  /** Inked bounding box, or null if nothing was drawn. */
  box: { w: number; h: number } | null;
}

async function probe(family: string, value: string, canvasW: number): Promise<ProbeResult> {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${PROBE_HEIGHT}">` +
    `<rect width="${canvasW}" height="${PROBE_HEIGHT}" fill="#000"/>` +
    `<text x="${PROBE_PAD}" y="${PROBE_BASELINE}" font-family="${family}"` +
    ` font-size="${PROBE_SIZE}" fill="#fff">${value}</text></svg>`;
  const { data, info } = await sharp(Buffer.from(svg))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let x0 = info.width;
  let x1 = -1;
  let y0 = info.height;
  let y1 = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[y * info.width + x] < PROBE_INK) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return {
    raw: data,
    box: x1 < x0 || y1 < y0 ? null : { w: x1 - x0 + 1, h: y1 - y0 + 1 },
  };
}

/** `HHHHHHHHHH` — one glyph both faces have, repeated, so the diff is clean. */
const SHORT_RUN = 'H'.repeat(10);
const LONG_RUN = 'H'.repeat(20);
const canvasFor = (value: string) => value.length * PROBE_SIZE + PROBE_PAD * 3;

interface FaceReading {
  /** Advance in em, measured. */
  advance: number;
  /** Cap-height as a fraction of the em, measured. */
  cap: number;
}

/**
 * Measure whatever `family` renders as. Two runs of the same glyph, differenced
 * so the side bearings cancel and what is left is ten advances exactly; the
 * cap-height comes off the height of the run.
 *
 * Returns null when the measurement is absurd, which means we did not
 * understand what came back — better to fall back than to lay the sheet out
 * against a number that cannot be right.
 */
async function measure(family: string): Promise<{ reading: FaceReading; short: Buffer } | null> {
  const [short, long] = await Promise.all([
    probe(family, SHORT_RUN, canvasFor(SHORT_RUN)),
    probe(family, LONG_RUN, canvasFor(LONG_RUN)),
  ]);
  if (!short.box || !long.box) return null;
  const advance = (long.box.w - short.box.w) / 10 / PROBE_SIZE;
  const cap = short.box.h / PROBE_SIZE;
  if (!(advance > 0.3 && advance < 2.2) || !(cap > 0.4 && cap < 1.2)) return null;
  return { reading: { advance, cap }, short: short.raw };
}

/**
 * The same, but null unless the face that rendered is genuinely the one asked
 * for — see `BASELINES`.
 */
async function readFace(family: string, baselines: Buffer[]): Promise<FaceReading | null> {
  const measured = await measure(family);
  if (!measured) return null;
  if (baselines.some((b) => b.equals(measured.short))) return null;
  return measured.reading;
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

let resolved: Promise<FontStack> | null = null;

/**
 * Resolve the family names to put in the SVG, with their measured metrics.
 * Cached for the life of the process; costs a handful of tiny rasters once.
 */
export function resolveFontStack(): Promise<FontStack> {
  resolved ??= (async () => {
    if (!installFontconfig()) return FALLBACK_STACK;
    try {
      const baselines = await Promise.all(
        BASELINES.map(async (family) => (await probe(family, SHORT_RUN, canvasFor(SHORT_RUN))).raw),
      );

      /* --- the detail face --------------------------------------- */
      let detail = GENERIC_MONO;
      let detailSource: DetailSource = 'dejavu';
      let detailReading: FaceReading | null = null;
      for (const family of [...DETAIL_CANDIDATES, PLEX]) {
        const reading = await readFace(family, baselines);
        if (!reading) continue;
        detail = family;
        detailSource = family === PLEX ? 'plex' : 'typestar';
        detailReading = reading;
        break;
      }
      // Nothing of ours resolved: generic monospace, measured all the same so
      // the layout is still working from a real number rather than a guess.
      detailReading ??= (await measure(GENERIC_MONO))?.reading ?? null;

      /* --- the display face -------------------------------------- */
      const displayReading = await readFace(DISPLAY_CANDIDATE, baselines);
      const display = displayReading ? DISPLAY_CANDIDATE : detail;
      const displaySource: DisplaySource = displayReading
        ? 'ductile'
        : detailSource === 'typestar'
          ? 'plex' // Typestar is not a display face; Plex is the stated fallback.
          : detailSource;

      const detailCap = detailReading?.cap ?? 0.698;
      const stack: FontStack = {
        display: displayReading ? display : detail,
        detail,
        detailAdvance: detailReading?.advance ?? MONO_ADVANCE,
        displayScale: displayReading ? detailCap / displayReading.cap : 1,
        displayCapsOnly: Boolean(displayReading),
        source: { display: displaySource, detail: detailSource },
      };

      console.info(
        `[poster] fonts — display "${stack.display}" (${stack.source.display}, ` +
          `scale ${stack.displayScale.toFixed(3)}) · detail "${stack.detail}" ` +
          `(${stack.source.detail}, advance ${stack.detailAdvance.toFixed(3)}em)`,
      );
      return stack;
    } catch {
      return FALLBACK_STACK;
    }
  })();
  return resolved;
}

/* ------------------------------------------------------------------ */
/* Measurement                                                         */
/* ------------------------------------------------------------------ */

/**
 * Horizontal advance of a monospaced run, in px.
 *
 * `advance` defaults to Plex/DejaVu's 0.6em so existing callers keep their
 * numbers; anything laying out the sheet passes `fonts.detailAdvance`, which
 * is what the probe measured off the face that actually rendered.
 */
export function monoWidth(
  text: string,
  size: number,
  trackingEm = 0,
  advance: number = MONO_ADVANCE,
): number {
  return text.length * size * (advance + trackingEm);
}

/** The same, bound to the detail face of a resolved stack. */
export function detailWidth(
  fonts: FontStack,
  text: string,
  size: number,
  trackingEm = 0,
): number {
  return monoWidth(text, size, trackingEm, fonts.detailAdvance);
}

/** How many detail-face characters fit in `width` at `size`. */
export function detailChars(fonts: FontStack, width: number, size: number): number {
  return Math.floor(width / (size * fonts.detailAdvance));
}
