/**
 * SHOT FROM SPACE — the print pipeline.
 *
 * `composePoster` and `composePreview` turn a satellite frame plus mission
 * telemetry into the product: a designed plate, not a screenshot with type on
 * it. Everything is server-side (`sharp` + librsvg) and deterministic.
 *
 * `composePoster({ styleId })` chooses HOW the paper is divided — one entry of
 * ./styles.ts, the same catalogue the picker and <StyledPoster /> read.
 * Omitted, it composes `dossier`, which is what it has always composed.
 *
 * See PIPELINE.md for what runs in production and where each stub plugs in.
 */

export {
  composePoster,
  composePreview,
  composeFallback,
  printGeometry,
  posterCacheKey,
  previewCacheKey,
} from './compose';
export { cacheStats, cacheClear } from './cache';
export {
  FORMAT_RATIO,
  PRINT_INTENT,
  PRINT_DPI,
  MAX_RENDER_WIDTH,
  MIN_RENDER_WIDTH,
  PREVIEW_WIDTH,
  POSTER_WIDTH,
  DEFAULT_DIVISION,
  clampWidth,
  isPosterRatio,
  printIntent,
  resolveGeometry,
} from './layout';
export { resolveFontStack, type FontStack } from './fonts';
export type { PosterOptions, PosterRatio, PosterStyleId, ResolvedPoster } from './types';
