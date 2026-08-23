import type { ReactNode } from 'react';
import { clsx as cn } from 'clsx';

/**
 * THE ICON FRAME — one drawing surface for the whole set.
 *
 * ------------------------------------------------------------------
 * WHAT AN ICON IS FOR HERE
 * ------------------------------------------------------------------
 * These are TYPE MARKS on a readout row. A row that carries one is
 * saying "this value is a coordinate / an instant / a cloud fraction",
 * so the eye can jump to the kind of fact it wants without reading the
 * label. That is the entire job, and it has two consequences:
 *
 *   1. The icon is never the only carrier of meaning. Every row that
 *      takes one also carries its written label, so the mark is
 *      `aria-hidden` and invisible to assistive technology.
 *   2. A row with no type gets NO icon. A handling code, a callsign, a
 *      tasking reference and a carrier name are strings, not types, and
 *      marking them anyway would put the uniformity that this set
 *      exists to break straight back on the page in a new costume.
 *
 * ------------------------------------------------------------------
 * THE DRAWING RULES
 * ------------------------------------------------------------------
 *   grid          16 × 16, ~1.6 of optical padding on every side
 *   stroke        1.25, `currentColor`, round caps and joins
 *   fill          none, except a deliberate solid dot or pixel
 *   colour        inherited — never named, so a mark renders correctly
 *                 on the file's paper bands and its void bands alike
 *   size          16 by default; 18 where a mark leads a headline value
 *
 * The stroke is stated in RENDERED pixels, not in grid units: the frame
 * divides 1.25 by the scale it is drawn at, so a mark set at 20px keeps
 * exactly the same hairline as one set at 16. (`vector-effect` would say
 * the same thing but it is not an inherited property, so it would have
 * to be repeated on every path in the set; the arithmetic is stated once
 * and cannot drift.) Same argument <OrbitDiagram /> makes, and what
 * stops the set thickening as the type ramp steps at 1920 and 2400.
 *
 * ------------------------------------------------------------------
 * MOTION — rare, earned, and switchable off
 * ------------------------------------------------------------------
 * Two marks in the set can animate and only when passed `live`:
 * <IconOrbit /> turns its bearing tick while a pass is still ahead of
 * the mission, and <IconPassWindow /> pulses its marker while a capture
 * window is actually open. Both are driven by state the mission record
 * already holds, never by a clock, so an animated mark always means the
 * value under it is genuinely moving. On a static value the animation is
 * simply not requested.
 *
 * The keyframes live in a scoped stylesheet React 19 hoists and dedupes
 * by `href` — the same pattern <Redacted /> uses — so no motion CSS is
 * shipped to a page that renders no animated mark, and `app/globals.css`
 * stays untouched. Under `prefers-reduced-motion: reduce` both rules are
 * cancelled outright with `animation: none`, which parks the tick and
 * the marker at their rest frame rather than snapping them to 100%.
 */

export interface IconProps {
  /** Edge length in px. 16 on a readout row, 18 leading a headline. */
  size?: number;
  className?: string;
}

/** Props for the two marks that may animate. */
export interface LiveIconProps extends IconProps {
  /**
   * The value under this mark is genuinely in motion right now. Off by
   * default: a still mark is the correct rendering of a still value.
   */
  live?: boolean;
}

/**
 * The scoped stylesheet for the two animated marks. Rendered only by the
 * marks themselves, and only when they are live.
 *
 * `transform-box: view-box` is what makes `transform-origin: 8px 8px`
 * mean the centre of the 16-grid rather than the tick's own bounding
 * box — without it the tick would swing around its own end and leave
 * the ring.
 */
const ICON_MOTION_CSS = `
@keyframes sfs-icon-bearing {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.sfs-icon-bearing {
  transform-box: view-box;
  transform-origin: 8px 8px;
  animation: sfs-icon-bearing 24s linear infinite;
}
@keyframes sfs-icon-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.25; }
}
.sfs-icon-pulse {
  animation: sfs-icon-pulse 2.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
@media (prefers-reduced-motion: reduce) {
  .sfs-icon-bearing,
  .sfs-icon-pulse {
    animation: none !important;
  }
}
`;

/**
 * Mounts the icon motion keyframes. React 19 hoists this into the head
 * and dedupes it by `href`, so N live marks on a page ship one copy.
 */
export function IconMotionStyles() {
  return (
    <style href="sfs-icon-motion" precedence="medium">
      {ICON_MOTION_CSS}
    </style>
  );
}

/**
 * The frame every glyph in this set is drawn in. Not exported from the
 * barrel: consumers render a named mark, never a bare frame.
 */
export function Icon({
  size = 16,
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={(1.25 * 16) / size}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={cn('block shrink-0', className)}
    >
      {children}
    </svg>
  );
}
