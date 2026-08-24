import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A promise the company can actually keep.
 *
 * This is the site's only form of social proof, because no mission has
 * shipped yet and inventing a testimonial is not an option (BRIEF-V2 →
 * HONESTY RULE). Each one states a term from /legal/terms in one line.
 *
 * The mark is a 1px drawing, never an emoji and never a filled icon —
 * it belongs to the same hand as the orbit diagram and the crop marks.
 */

export type GuaranteeIcon = 'refund' | 'retask' | 'replace' | 'shipping' | 'cancel';

/** 20×20, 1px, square-cut. Drawn to be read at a glance, not admired. */
const GLYPH: Record<GuaranteeIcon, ReactNode> = {
  // A frame with a returning arrow — money back.
  refund: (
    <>
      <rect x="2.5" y="4.5" width="15" height="11" />
      <path d="M12 10.5 9.5 8m2.5 2.5L9.5 13M12 10.5H6.5" />
    </>
  ),
  // A pass re-flown — a second arc over the same ground.
  retask: (
    <>
      <path d="M3 12.5a7.5 7.5 0 0 1 14-3.6" />
      <path d="M17 5.5V9h-3.5" />
      <path d="M3.2 11.4 5 13l1.8-1.6" />
    </>
  ),
  // Two frames, one replacing the other.
  replace: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" />
      <path d="M6.5 17.5h11v-11" />
    </>
  ),
  // A crate on a baseline.
  shipping: (
    <>
      <path d="M2.5 6.5 10 3l7.5 3.5v7L10 17l-7.5-3.5z" />
      <path d="M2.5 6.5 10 10m0 0 7.5-3.5M10 10v7" />
    </>
  ),
  // A struck window — stopped before it opens.
  cancel: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M5.5 5.5 14.5 14.5" />
    </>
  ),
};

export function Guarantee({
  icon,
  label,
  detail,
  className,
}: {
  /** A built-in mark, or your own 20×20 node. */
  icon?: GuaranteeIcon | ReactNode;
  label: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  const built = typeof icon === 'string' && icon in GLYPH ? (icon as GuaranteeIcon) : null;

  return (
    <div
      className={cn(
        'group flex items-start gap-3.5 py-3',
        className,
      )}
    >
      {/* No accent hover on the glyph. The `group` is a plain <div> —
          nothing about this row is clickable — so tinting it on hover
          promised an affordance that does not exist AND spent the
          state colour on a static mark (SPEC-V4 §A5). The glyph is
          furniture; it stays faint. */}
      <span aria-hidden className="mt-px shrink-0">
        {built ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="ink-faint"
            vectorEffect="non-scaling-stroke"
          >
            {GLYPH[built]}
          </svg>
        ) : (
          icon ?? null
        )}
      </span>

      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-action ink">{label}</span>
        {detail ? <span className="max-w-[52ch] text-body ink-dim">{detail}</span> : null}
      </span>
    </div>
  );
}
