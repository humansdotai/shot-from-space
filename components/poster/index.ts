/**
 * The poster style system.
 *
 * `lib/poster/styles.ts` is the catalogue; these two components are the
 * depiction and the choice. Mount them by their own paths —
 * `@/components/poster/StyledPoster` and `@/components/poster/PosterStylePicker`
 * — or through this barrel; they are the same modules either way.
 */
export { StyledPoster } from './StyledPoster';
export type { PosterSubject, StyledPosterProps } from './StyledPoster';
export { PosterStylePicker, posterStyleNote } from './PosterStylePicker';
