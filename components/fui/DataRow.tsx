import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const TONE = {
  paper: 'ink',
  signal: 'text-[var(--accent)]',
  dim: 'ink-dim',
} as const;

/**
 * Label/value row with a dotted lead — the readout unit of every dossier.
 *
 * The lead rule shrinks before the value does, so a long value wraps under
 * its own label instead of pushing the row into a horizontal scroll at 390px.
 *
 * Set `semantic` when the row sits inside a <dl> (see <KeyValueGrid />): the
 * label becomes a <dt> and the value a <dd>.
 *
 * Rows light up under the pointer. A readout is not clickable, but a long
 * label/value list IS scanned across a gap, and the highlight is what keeps
 * the eye on one line — the same reason a spreadsheet highlights its row.
 * Pass `hover={false}` for a single isolated row where it would read as a
 * broken affordance.
 *
 * Colours come from `--ink`, so a row works unchanged on either ground.
 */
export function DataRow({
  label,
  value,
  tone = 'paper',
  semantic = false,
  hover = true,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: keyof typeof TONE;
  /** Render as <dt>/<dd> inside a definition list wrapper. */
  semantic?: boolean;
  /** Row highlight under the pointer. */
  hover?: boolean;
  className?: string;
}) {
  const Label = semantic ? 'dt' : 'span';
  const Value = semantic ? 'dd' : 'span';

  return (
    <div
      className={cn(
        'group flex items-baseline gap-3 py-2',
        hover &&
        className,
      )}
    >
      <Label className="shrink-0 text-label uppercase ink-faint transition-house group-hover:text-[color:var(--ink-dim)]">
        {label}
      </Label>
      <span
        aria-hidden
        className="min-w-3 flex-1 shrink translate-y-[-3px] border-b border-dotted transition-house rule-ground group-hover:border-[color:var(--rule-strong)]"
      />
      <Value
        data-telemetry
        className={cn(
          'min-w-0 max-w-[68%] text-right font-mono text-[0.6875rem] uppercase leading-[1.4] tracking-[0.08em] break-words',
          TONE[tone],
        )}
      >
        {value}
      </Value>
    </div>
  );
}
