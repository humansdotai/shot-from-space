import { cn } from '@/lib/utils';
import { CropMarks } from './CropMarks';

/**
 * The loading state. There are no spinners in this product.
 *
 * A pending thing is a plate that has not resolved yet: a hairline frame,
 * registration marks, a scanning sweep and an `ACQUIRING` stamp. It occupies
 * exactly the space the real content will take, so nothing jumps.
 *
 * Pass `aspect` for an image plate, `lines` for a text block, or both.
 */
export function Skeleton({
  className,
  lines,
  aspect,
  label = 'ACQUIRING',
}: {
  className?: string;
  /** Number of text bars to draw. */
  lines?: number;
  /** CSS aspect-ratio string for an image plate, e.g. `16 / 9`. */
  aspect?: string;
  /** Rail stamp. Keep it a single mission-voice word. */
  label?: string;
}) {
  const barCount = lines ?? (aspect ? 0 : 3);

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn('relative border border-hairline bg-deck/40', className)}
    >
      <span className="sr-only">{label}</span>

      {aspect ? (
        <div
          className="fui-loading relative border-b border-hairline"
          style={{ aspectRatio: aspect }}
        >
          <CropMarks length={14} inset={8} tone="paper" />
        </div>
      ) : null}

      {barCount > 0 ? (
        <div className="flex flex-col gap-2.5 p-3">
          {Array.from({ length: barCount }).map((_, i) => (
            <span
              key={i}
              aria-hidden
              className="fui-loading block h-2.5"
              style={{ width: `${100 - i * (55 / Math.max(barCount, 2))}%` }}
            />
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-hairline px-3 py-2">
        <span className="font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-paper-faint">
          {label}
        </span>
        <span
          aria-hidden
          className="font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-paper-faint"
        >
          — — . — —
        </span>
      </div>
    </div>
  );
}
