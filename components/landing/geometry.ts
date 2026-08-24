/**
 * THE PAGE'S ONE GEOMETRY.
 *
 * Every band on this page opens on the same measure and moves on the same
 * four vertical steps. Nothing here is a per-section decision — that is the
 * point. A page reads as composed when the eye can predict where the next
 * heading starts, and as assembled when each section invents its own gap.
 *
 * ------------------------------------------------------------------
 * THE FIVE BREAKPOINTS
 * ------------------------------------------------------------------
 * SYSTEM-V3 §2: `768 · 1280 · 1440 · 1920 · 2400`. They are written here as
 * explicit `min-[…]` variants rather than as named ones so that this page
 * states the width it is composing for in the class itself, and so that a
 * rename in the theme cannot silently re-point a layout decision.
 *
 * What actually changes, band by band, is recorded in `app/page.tsx`.
 *
 * ------------------------------------------------------------------
 * THE MEASURE
 * ------------------------------------------------------------------
 * The content column is 1440 with 32px gutters (SYSTEM-V3 §1). Above 1920 it
 * is allowed two measured steps rather than floating in dead space — the
 * column grows, prose inside it does not: every paragraph on this page is
 * capped in `ch`, so a wider column buys more media and more columns, never
 * a longer line.
 *
 * Sections that opt out of the column entirely — the hero, the featured
 * mosaic, the film rail, the media-link panel, the closing frame — are the
 * page's other half of that rhythm and carry their own widths.
 */
export const MEASURE = 'min-[1920px]:max-w-[1680px] min-[2400px]:max-w-[1920px]';

/**
 * THE VERTICAL SET — four values, and only four. They are applied directly
 * as utilities rather than exported as constants, because a name adds
 * nothing to `mt-8` and hides which of the four a band actually used.
 *
 *   12px  mt-3   a label to the value it names
 *   20px  mt-5   inside one block
 *   32px  mt-8   block to block within a column
 *   48px  mt-12  a band head to the content under it
 *
 * Band padding is separate and comes only from `Band`'s measured tokens
 * (0 / 20 / 32 / 48 / 56). No band on this page declares its own padding —
 * the single exception is the announcement strip, which reserves the
 * absolutely positioned site header's height and says so in its own file.
 */
