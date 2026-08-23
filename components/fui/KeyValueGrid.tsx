import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DataRow } from './DataRow';

export interface KeyValueItem {
  label: ReactNode;
  value: ReactNode;
  tone?: 'paper' | 'signal' | 'dim';
}

/**
 * A block of readouts. One column on a phone, `columns` on desktop, hairlines
 * between rows so the block reads as a printed table rather than a list.
 */
export function KeyValueGrid({
  items,
  columns = 2,
  className,
}: {
  items: KeyValueItem[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const cols =
    columns === 1
      ? 'sm:grid-cols-1'
      : columns === 3
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : 'sm:grid-cols-2';

  return (
    <dl className={cn('grid grid-cols-1 gap-x-8', cols, className)}>
      {items.map((item, i) => (
        <DataRow
          key={`${String(item.label)}-${i}`}
          label={item.label}
          value={item.value}
          tone={item.tone}
          semantic
          className="border-b border-hairline-soft"
        />
      ))}
    </dl>
  );
}
