import { cn } from '@/lib/utils';

/**
 * Vertical rhythm as an element rather than as padding.
 *
 * The structural reference (see reference/STRUCTURE.md) treats section spacing
 * as an explicit spacer in the flow, not as a property of its neighbours. That
 * keeps rhythm readable in the markup and stops adjacent sections fighting over
 * whose margin wins.
 *
 * Three steps only. If you need a fourth, you need a different composition.
 */
const SIZE = {
  base: 'h-8',   // 2rem  — inside a block
  lg: 'h-12',    // 3rem  — between related blocks
  xxl: 'h-20 sm:h-28', // 5/7rem — between major sections
} as const;

export type SpacerSize = keyof typeof SIZE;

export function Spacer({ size = 'lg', className }: { size?: SpacerSize; className?: string }) {
  return <div aria-hidden className={cn('w-full shrink-0', SIZE[size], className)} />;
}
