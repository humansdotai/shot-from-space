import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * THE 12-COLUMN GRID.
 *
 * The column COUNT is 12 at every breakpoint — spans change, the grid
 * does not. That is what keeps the site feeling like one system seen
 * at five sizes rather than five layouts stacked behind media queries.
 * The usual progression for a set of tiles is
 * `col-span-12 sm:col-span-6 xl:col-span-4 xl2:col-span-3`.
 *
 * What DOES change is the gap, which comes from `--grid-gap-x` /
 * `--grid-gap-y` and steps with the viewport:
 *
 *      width   390   768   1280   1440   1920   2400
 *      gap-x    20    20     24     24     32     40
 *      gap-y    18    18     22     24     32     40
 *
 * The grid gets airier as the display gets bigger, not denser. A 40px
 * gutter at 2400 is the same optical weight as 20px at 390; holding it
 * at 20 is what makes a wide layout look like a stretched narrow one.
 *
 * Sitting inside a <Container> the grid spans 1376px maximum. Sitting
 * inside a `flush` Container with `.column-bleed`, it spans up to 1600
 * at 1920 and 2000 at 2400 — that is the version to use for index and
 * mosaic bands, which are the sections that should take a large
 * display's width.
 */
export function Grid12({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'section';
}) {
  return (
    <Tag
      className={cn(
        'grid grid-cols-12 gap-x-[var(--grid-gap-x)] gap-y-[var(--grid-gap-y)]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
