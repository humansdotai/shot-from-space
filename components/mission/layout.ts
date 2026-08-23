/**
 * MISSION FILE — the measurements the file is composed on.
 *
 * The system's five steps are 768 / 1280 / 1440 / 1920 / 2400 — `md` / `xl` /
 * `2xl` / `xl2` / `xl3`. This file states what the mission surfaces do at
 * each of them, once, so the file, the skeleton and the account screens that
 * borrow its vocabulary cannot drift apart.
 *
 * The shape of the argument:
 *
 *   390   one column. Every row stacks; nothing is hidden behind a hover.
 *   768   the twelve-column grid starts carrying real spans. Timeline rows
 *         split into a two-line record — name and time on the first line,
 *         what happened on the second.
 *   1280  the timeline and the readout of the stage it is sitting on stop
 *         being stacked and stand side by side, the readout held in view.
 *         Timeline rows flatten to a single line of three parts.
 *   1440  the content column reaches its maximum and stops growing.
 *   1920  full-bleed media takes the extra width; the reading column does
 *         not. The exhibit plate grows, the specification does not.
 *   2400  the same again, wider.
 */

/**
 * Top padding that clears the site bar, which is absolute over the first band
 * of every page.
 *
 * READ THE TOKEN, NEVER RE-TYPE THE HEIGHT. This used to carry its own copy
 * of the bar — `4.25rem` under 1024 and `6rem` over it — from a bar that was
 * 68/96. It is 70/90 now, so both numbers and the breakpoint they switched on
 * were wrong, and the same stale copy in `app/legal/layout.tsx` and
 * `app/system/page.tsx` (a 56px `h-14`) really did put the first line of
 * those files underneath the plate. `--site-bar-h` is the one number the bar
 * publishes, and it already steps at the bar's own breakpoint, so no
 * responsive variant is needed here at all.
 */
export const BELOW_BAR = 'pt-[calc(var(--site-bar-h)_+_var(--band-open))]';

/** The shallower version, for the rails that only carry a back link. */
export const BELOW_BAR_TIGHT = 'pt-[calc(var(--site-bar-h)_+_var(--band-snug))]';

/**
 * The exhibit plate. It is the one thing on the file allowed to take the
 * extra width a large display offers, because it is the photograph.
 * 58svh → 560 → 660 → 720 → 820 → 900.
 */
export const EXHIBIT_WALL =
  'h-[58svh] min-h-[340px] md:h-[560px] xl:h-[660px] 2xl:h-[720px] xl2:h-[820px] xl3:h-[900px]';

/** How much of the wall the plate is allowed to occupy, inset from its edges. */
export const EXHIBIT_PLATE = 'max-w-[calc(100%-2rem)] md:max-w-[calc(100%-8rem)] xl2:max-w-[calc(100%-14rem)]';

/* ==================================================================
   THE DOCUMENT RHYTHM
   ==================================================================
   The structural skeleton the reference pages share, as class strings
   rather than as prose, so that four surfaces built by four people
   land on the same measure.

   The skeleton, top to bottom:

     1  a large display headline, top-left, on a dark ground
     2  a LOT of air under it — `--file-head-air`, 48→152px, the
        biggest single gap on the page
     3  a two-column meta row: a narrow column of small uppercase
        labels, a wider column of running text, sharing a baseline
     4  stacked data rows separated by 1px rules, label above value
     5  generous space between sections — `--file-section-gap`,
        56→160px — and nothing between them but that space
     6  a light document panel, with a cut top-right corner, wherever
        the content is a printed or archived record
     7  section tabs on a full-width rule where a section has parallel
        views, an `01 / 04` index pair where it has a position, and a
        very large numeral where it has a number

   The measurements themselves live in app/globals.css as tokens; what
   is here is only which token goes where. A number written in this
   file and not in the stylesheet is a number that cannot step at a
   breakpoint, so there are none.
   ================================================================== */

/**
 * The air under the file headline. Applied by <FileHead />; stated
 * here because a surface that composes its own head still owes the
 * page the same gap. 48 / 64 / 88 / 96 / 128 / 152.
 */
export const HEAD_AIR = 'mb-[var(--file-head-air)]';

/**
 * Between two stacked sections of the file. 56 / 72 / 96 / 112 / 136 /
 * 160 — the page reads as a document with margins because this number
 * is roughly twice what a dashboard would use, and because it is the
 * ONLY thing separating two sections. No card, no border, no fill.
 */
export const SECTION_GAP = 'mt-[var(--file-section-gap)]';

/** The same measure as a flow gap, for a column of sections. */
export const SECTION_FLOW = 'flex flex-col gap-[var(--file-section-gap)]';

/**
 * The two-column meta row. One column at 390 — the label sits above
 * its text, which is the only honest way to render a pair at that
 * width. From 768 it is a real pair: a narrow label column
 * (`--file-meta-col`, 8.5rem → 11.5rem) and the rest.
 *
 * `items-baseline` is the point of the whole thing: the first line of
 * the label and the first line of the running text sit on one
 * baseline even though they are set at different sizes.
 */
export const META_GRID =
  'grid grid-cols-1 items-baseline gap-x-[var(--grid-gap-x)] gap-y-2 md:grid-cols-[var(--file-meta-col)_1fr]';

/**
 * A stack of ruled data rows. Rules only — the group is bounded top
 * and bottom by its rows' own borders, so it needs no container.
 */
export const RULE_STACK = 'rule-stack flex flex-col';

/**
 * A document panel on a dark band. The panel is `.surface-light`, so
 * the corner cut shows the void through it; this is the wrapper that
 * gives it somewhere to sit.
 */
export const DOC_INSET = 'relative';

/**
 * The mission faces as a className, for a mission subtree rendered
 * outside the app shell — a standalone document or the poster's own
 * HTML. Inside the shell the variables are already on <html> and this
 * is not needed.
 */
export { missionFontVars as MISSION_FONT_SCOPE } from '@/lib/fonts';
