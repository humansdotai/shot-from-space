import { cn } from '@/lib/utils';

export interface SpecItem {
  label: string;
  value: string;
  /**
   * Set the value in the monospaced face. Reserved for what actually is
   * telemetry: coordinates, timestamps, mission codes, elapsed times. A
   * paragraph of monospace is a bug, and so is a place name in it.
   */
  mono?: boolean;
  /** Pull the value to the accent. One per list at most. */
  signal?: boolean;
}

/**
 * A SPECIFICATION LIST, on whatever ground it is dropped into.
 *
 * Rows on rules, not a boxed table: label left, value right, one hairline
 * between each. Every colour reads `--ink` / `--rule`, so the same list is
 * paper-on-void at the top of a page and void-on-paper further down with no
 * prop.
 *
 * ------------------------------------------------------------------------
 * TWO THINGS THIS DELIBERATELY DOES NOT DO
 * ------------------------------------------------------------------------
 * 1. NO HOVER. A row here is a fact, not a target. Lighting it under the
 *    pointer promises a click that will never happen, so the highlight is
 *    reserved for rows that are actually links (see <ArchiveRow />).
 * 2. NO BOX. There is no border around the list and no fill behind it. The
 *    rules do the work; a framed table would turn twelve readings into a
 *    piece of furniture.
 *
 * `columns` is the maximum the list is allowed to reach, and the widths it
 * reaches it at are fixed rather than fluid: one column on a phone, two from
 * 768, and the third only from 1920 — where a twelve-row list in two columns
 * has started to run longer than the picture beside it. Data columns get
 * added; they do not stretch.
 */
export function SpecList({
  items,
  columns = 1,
  className,
}: {
  items: SpecItem[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-[var(--gutter-shell)] min-[1920px]:gap-x-14',
        columns >= 2 ? 'min-[768px]:grid-cols-2' : null,
        columns >= 3 ? 'min-[1920px]:grid-cols-3' : null,
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-baseline justify-between gap-6 border-t py-3.5 rule-ground min-[1920px]:py-4"
        >
          <dt className="text-label uppercase ink-dim">{item.label}</dt>
          <dd
            className={cn(
              'text-right',
              item.mono ? 'font-mono text-[0.8125rem] tracking-[0.06em]' : 'text-body',
              item.signal ? 'text-[var(--accent)]' : 'ink',
            )}
            data-telemetry={item.mono ? '' : undefined}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
