'use client';

import type { ComponentProps, ReactNode } from 'react';
import { ScanSweep } from '@/components/fui';
import { cn } from '@/lib/utils';

/**
 * The comms action face.
 *
 * This used to carry a THIRD control anatomy — sentence case, 14/15px,
 * weight 400 — on the argument that comms is shell UI and a
 * conversation should not be labelled in uppercase micro-type. That
 * argument was sound while the shell itself was sentence-case. It is
 * not any more: <Button /> and <ActionButton /> are now one control,
 * measured off the reference (`app/globals.css` → CONTROL), and a
 * sentence-case button in the comms drawer is no longer the shell's
 * voice — it is the only button on the site that is not.
 *
 * So this is now the same control, and the file keeps only what is
 * actually its own: the two-variant API its ten call sites use, and
 * the <ScanSweep /> loading treatment, which reads better across a
 * full-width drawer button than the 2px bottom-edge scan does.
 */
export function CommsButton({
  children,
  variant = 'ghost',
  size = 'md',
  loading = false,
  disabled,
  className,
  ...rest
}: {
  children: ReactNode;
  variant?: 'primary' | 'ghost';
  /**
   * `sm` is the same 44px control at 20px of side padding rather than 32.
   * It exists for the channel header, where a full `btn-md` beside the
   * status chip does not fit a 320px column. Height is untouched — the
   * 44 × 44 floor is not a thing a size prop may lower.
   */
  size?: 'sm' | 'md';
  loading?: boolean;
} & Omit<ComponentProps<'button'>, 'ref'>) {
  const inert = Boolean(disabled) || loading;

  return (
    <button
      disabled={inert}
      aria-busy={loading || undefined}
      className={cn(
        'btn group overflow-hidden',
        size === 'sm' ? 'btn-sm' : 'btn-md',
        variant === 'primary' ? 'btn-primary' : 'btn-secondary',
        className,
      )}
      {...rest}
    >
      <span className="btn-label relative z-10">{children}</span>
      {loading ? <ScanSweep repeat tone={variant === 'primary' ? 'signal' : 'paper'} /> : null}
    </button>
  );
}
