import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface NumberedItem {
  /** Two digits, written by the caller so section numbering stays explicit. */
  index: string;
  title: string;
  body: ReactNode;
}

/**
 * `01. / 02. / 03.` — the numbered procedure. Section numbers are the spine of
 * the site: a process, a spec, a set of guarantees. Hairline between every
 * step, index in the accent, body in sans.
 */
export function NumberedList({
  items,
  className,
}: {
  items: NumberedItem[];
  className?: string;
}) {
  return (
    <ol className={cn('flex flex-col border-t border-hairline', className)}>
      {items.map((item) => (
        <li
          key={item.index}
          className="grid grid-cols-[2.5rem_1fr] gap-x-4 gap-y-2 border-b border-hairline py-5 sm:grid-cols-[4rem_1fr] sm:gap-x-8 sm:py-7"
        >
          <span
            aria-hidden
            className="font-mono text-[0.6875rem] leading-[1.4] tracking-[0.14em] text-paper-faint"
          >
            {item.index}.
          </span>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[0.75rem] uppercase leading-[1.35] tracking-[0.12em] text-paper sm:text-[0.8125rem]">
              {item.title}
            </h3>
            <p className="max-w-[62ch] text-body text-paper-dim">{item.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
