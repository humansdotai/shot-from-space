'use client';

import { cn } from '@/lib/utils';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

/**
 * The archive's filter switch.
 *
 * A row of plain words on one hairline. The selected word carries a short
 * accent rule under it that grows from the leading edge — the way a tab is
 * marked on an instrument panel, not a pill, not a fill, not a rounded chip.
 * Reads `--ink` / `--rule` / `--accent`, so it inverts with its band.
 *
 * On a phone the row scrolls inside its own rail so the page itself never
 * scrolls sideways.
 */
export function SegmentedControl<T extends string>({
  label,
  segments,
  value,
  onChange,
  className,
}: {
  /** Visible label, rendered above the control and used as the group name. */
  label: string;
  segments: ReadonlyArray<Segment<T>>;
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <span id={`seg-${slug(label)}`} className="text-label uppercase ink-dim">
        {label}
      </span>
      {/* `overscroll-behavior-x: contain`, as on `.tab-row` and <MetaPill />:
          the rail runs to both screen edges on a phone, and without it a
          swipe past either end chains into the document and rubber-bands the
          whole page sideways. */}
      <div className="-mx-[var(--gutter-shell)] overflow-x-auto overscroll-x-contain px-[var(--gutter-shell)] sm:mx-0 sm:overflow-visible sm:px-0">
        <div
          role="group"
          aria-labelledby={`seg-${slug(label)}`}
          className="inline-flex w-max border-b rule-ground"
        >
          {segments.map((s) => {
            const active = s.value === value;
            return (
              <button
                key={s.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(s.value)}
                className={cn(
                  // 44 square is the floor for a touch target, and "All" is
                  // narrower than that on its own.
                  'relative min-h-11 min-w-11 whitespace-nowrap pr-6 text-action transition-house',
                  active ? 'ink' : 'ink-dim hover:[color:var(--ink)]',
                )}
              >
                {s.label}
                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute bottom-0 left-0 right-6 h-px origin-left bg-[var(--accent)] transition-transform duration-house ease-house motion-reduce:transition-none',
                    active ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
