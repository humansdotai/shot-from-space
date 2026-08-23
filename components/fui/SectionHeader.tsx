import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Numbered section head: `01.` + title, over a hairline rule.
 * Section numbers are the site's spine — every top-level section has one.
 */
export function SectionHeader({
  index,
  title,
  meta,
  id,
  className,
}: {
  /** Two-digit section number, e.g. "01". */
  index: string;
  title: ReactNode;
  meta?: ReactNode;
  /** Anchor id, so a section can be linked to directly. */
  id?: string;
  className?: string;
}) {
  return (
    <div id={id} className={cn('border-t border-hairline pt-4', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-4">
          {/* The numeral is DIM, not accent. A section index never
              changes and never reports a state, so colouring it with
              the one signal hue spent it on decoration (SPEC-V4 §A5).
              It is already differentiated from the title by face,
              size and tracking; it does not also need a hue. */}
          <span
            data-telemetry
            className="font-mono text-[0.6875rem] leading-none tracking-[0.14em] text-paper-faint"
          >
            {index}.
          </span>
          <h2 className="text-label uppercase text-paper">
            {title}
          </h2>
        </div>
        {meta ? (
          <span className="text-label uppercase text-paper-faint">
            {meta}
          </span>
        ) : null}
      </div>
    </div>
  );
}
