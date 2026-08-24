import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CropMarks } from './CropMarks';

/**
 * A 1px bordered container — the base surface of every dossier element.
 * `corners` adds registration marks; `label`/`tag` render a hairline header bar.
 */
export function HairlineFrame({
  children,
  className,
  innerClassName,
  label,
  tag,
  corners = false,
  tone = 'default',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  label?: ReactNode;
  tag?: ReactNode;
  corners?: boolean;
  /** `active` brightens the rule, `alert` tints it with the accent. */
  tone?: 'default' | 'active' | 'alert';
  as?: 'div' | 'section' | 'article' | 'aside';
}) {
  return (
    <Tag
      className={cn(
        'relative border bg-deck/40',
        tone === 'active'
          ? 'border-hairline-strong'
          : tone === 'alert'
            ? 'border-signal/45'
            : 'border-hairline',
        className,
      )}
    >
      {corners ? <CropMarks length={10} inset={-1} /> : null}
      {label || tag ? (
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-3 py-2">
          <span className="font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-paper-dim">
            {label}
          </span>
          {tag ? (
            <span className="font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-paper-faint">
              {tag}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className={innerClassName}>{children}</div>
    </Tag>
  );
}
