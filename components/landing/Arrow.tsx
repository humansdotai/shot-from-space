import { cn } from '@/lib/utils';

/**
 * THE ARROW GLYPH.
 *
 * One drawing, ~0.8rem, `shrink-0`, used by every link on this page that is
 * not a button (SYSTEM-V3 §4). It travels on hover — up-and-right for a
 * link that opens something, straight right for a row that continues the
 * list — and it travels on the one house curve, so a link, a row and a card
 * all move the same way.
 *
 * It is drawn rather than typed: an arrow character inherits the text
 * font's own metrics and never sits on the baseline the same way twice.
 */
export function Arrow({
  direction = 'out',
  className,
}: {
  /** `out` — opens a page. `right` — continues along a list. */
  direction?: 'out' | 'right';
  className?: string;
}) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={cn(
        'size-[0.8rem] shrink-0 transition-transform duration-house ease-house',
        direction === 'out'
          ? 'group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-focus-visible:-translate-y-0.5 group-focus-visible:translate-x-0.5'
          : 'group-hover:translate-x-1 group-focus-visible:translate-x-1',
        'motion-reduce:transform-none!',
        className,
      )}
    >
      {direction === 'out' ? (
        <path
          d="M3.25 10.75 10.75 3.25M10.75 3.25H5.25M10.75 3.25v5.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="square"
        />
      ) : (
        <path
          d="M2 7h10M8.25 3.25 12 7l-3.75 3.75"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="square"
        />
      )}
    </svg>
  );
}
