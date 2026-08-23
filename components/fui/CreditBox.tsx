import { cn, formatCoords, formatTelemetryTimestamp } from '@/lib/utils';

/**
 * THE brand element — and the ONLY place the name is ever set in type.
 *
 * `[ SHOT FROM SPACE ]` is never a logo and never a wordmark. It appears only
 * as a print credit / film-frame element: a small bordered box paired with
 * telemetry — timestamp and coordinates — the way a credit sits on a frame.
 *
 * Rules enforced here, not by convention:
 *  - `md` is the ceiling. Anything else falls back to `sm`, so no caller can
 *    scale the name up by passing a bigger token.
 *  - The box is never coloured with the accent. It is paper on void.
 *  - It is never centred as a hero: the component only offers left/right
 *    alignment, matching a credit in the corner of a frame.
 *
 * If you find yourself wanting a bigger one, you want a headline instead.
 */

/** The three permitted sizes. There is no fourth. */
const SIZE = {
  xs: {
    box: 'text-[0.5625rem] tracking-[0.2em] px-[0.4375rem] py-[0.3125rem]',
    meta: 'text-[0.5625rem] tracking-[0.16em]',
    gapX: 'gap-x-2',
    gapY: 'gap-y-1',
  },
  sm: {
    box: 'text-[0.625rem] tracking-[0.2em] px-2 py-[0.375rem]',
    meta: 'text-[0.625rem] tracking-[0.16em]',
    gapX: 'gap-x-2.5',
    gapY: 'gap-y-1.5',
  },
  md: {
    box: 'text-[0.6875rem] tracking-[0.2em] px-2.5 py-2',
    meta: 'text-[0.625rem] tracking-[0.16em]',
    gapX: 'gap-x-3',
    gapY: 'gap-y-1.5',
  },
} as const;

export type CreditBoxSize = keyof typeof SIZE;

/** Anything not in SIZE is refused and rendered at `sm`. */
function clampSize(size: unknown): CreditBoxSize {
  return size === 'xs' || size === 'sm' || size === 'md' ? size : 'sm';
}

export function CreditBox({
  timestamp,
  lat,
  lon,
  dp = 4,
  align = 'left',
  size = 'sm',
  orientation = 'row',
  className,
}: {
  timestamp?: string | Date;
  lat?: number;
  lon?: number;
  /**
   * Decimal places on the fix. 4 dp is the print credit's own precision and
   * stays the default, because a poster is the owner's object.
   *
   * A PUBLIC OR SHARED MISSION VIEW MUST PASS 2. `lib/missions/dto.ts` already
   * rounds those projections to PUBLIC_COORD_DP before they reach a component,
   * and printing a rounded value at 4 dp does not restore the missing digits —
   * it pads them with zeros, so a shared exhibit credited `34.1000, -118.3400`
   * and claimed eleven-metre precision the view was deliberately denied.
   * See `coordDp()` in components/mission/telemetry.ts.
   */
  dp?: 2 | 4;
  align?: 'left' | 'right';
  /** Capped at `md` — larger values are ignored. */
  size?: CreditBoxSize;
  /** `stack` puts the telemetry under the box, for narrow frame corners. */
  orientation?: 'row' | 'stack';
  className?: string;
}) {
  const s = SIZE[clampSize(size)];
  const right = align === 'right';
  const hasCoords = typeof lat === 'number' && typeof lon === 'number';

  return (
    <div
      className={cn(
        'flex font-mono uppercase',
        orientation === 'stack'
          ? cn('flex-col', right ? 'items-end text-right' : 'items-start')
          : cn('flex-wrap items-center', right ? 'justify-end text-right' : 'justify-start'),
        s.gapX,
        s.gapY,
        className,
      )}
    >
      <span
        className={cn(
          'border border-paper/45 leading-none whitespace-nowrap text-paper/85',
          s.box,
        )}
      >
        SHOT FROM SPACE
      </span>
      {timestamp ? (
        <span data-telemetry className={cn('leading-none whitespace-nowrap text-paper/55', s.meta)}>
          {formatTelemetryTimestamp(timestamp)}
        </span>
      ) : null}
      {hasCoords ? (
        <span data-telemetry className={cn('leading-none whitespace-nowrap text-paper/55', s.meta)}>
          {formatCoords(lat as number, lon as number, dp)}
        </span>
      ) : null}
    </div>
  );
}
