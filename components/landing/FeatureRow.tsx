import type { ReactNode } from 'react';
import { Grid12 } from '@/components/fui';
import { cn } from '@/lib/utils';

/**
 * THE FEATURE / ANNOUNCEMENT ARCHETYPE — media one side, a text column the
 * other, and the side alternates down the page (SYSTEM-V3 §5.6).
 *
 * Three bands on this page use it: the mission clock (media left), the
 * object that arrives (media right) and the resolution answer (media left).
 * The alternation is the whole idiom — three rows on the same side is a
 * template, three rows that swap is a composition.
 *
 * ------------------------------------------------------------------
 * WHAT CHANGES AT EACH BREAKPOINT
 * ------------------------------------------------------------------
 *   < 768   stacked, media first, one column
 *   768     6 / 6 — the row becomes a row
 *   1280    6 / 4 — the text column pulls onto the 9—12 rail. That rail is
 *           not arbitrary: `<BandHead>` sets its lede on columns 9—12, so
 *           the paragraph above a feature row and the text column inside
 *           it start on exactly the same vertical line. Setting it flush
 *           to a nearer column instead leaves it ninety pixels off every
 *           element it is supposed to align with, and that single
 *           misalignment is most of what reads as amateur.
 *   1920    7 / 4 — the media takes the extra width and the text column
 *           holds its four columns, so the picture grows and the line
 *           length does not. That is the whole answer to "compose at
 *           1920".
 *
 * Both children are pinned to `row-start-1` from 768 up, so the explicit
 * column starts can never push one of them onto a second row.
 */
export function FeatureRow({
  side,
  media,
  children,
  align = 'start',
  className,
}: {
  /** Which side the media sits on from 768 up. */
  side: 'left' | 'right';
  media: ReactNode;
  /** The text column. */
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  const ALIGN = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
  }[align];

  const mediaCols =
    side === 'left'
      ? 'min-[768px]:col-span-6 min-[768px]:col-start-1 min-[1280px]:col-span-6 min-[1920px]:col-span-7'
      : 'min-[768px]:col-span-6 min-[768px]:col-start-7 min-[1280px]:col-span-6 min-[1280px]:col-start-7 min-[1920px]:col-span-7 min-[1920px]:col-start-6';

  const textCols =
    side === 'left'
      ? 'min-[768px]:col-span-6 min-[768px]:col-start-7 min-[1280px]:col-span-4 min-[1280px]:col-start-9'
      : 'min-[768px]:col-span-6 min-[768px]:col-start-1 min-[1280px]:col-span-4 min-[1280px]:col-start-1';

  return (
    <Grid12 className={cn(ALIGN, 'gap-y-8', className)}>
      {/* Media is always first in the DOM: on a phone the picture opens the
          band whichever side it takes on a wide screen. */}
      <div className={cn('col-span-12 min-[768px]:row-start-1', mediaCols)}>{media}</div>
      <div className={cn('col-span-12 min-[768px]:row-start-1', textCols)}>{children}</div>
    </Grid12>
  );
}
