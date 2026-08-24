'use client';

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'ghost' | 'quiet';
type Size = 'sm' | 'md' | 'lg';

/**
 * The FUI-layer action. Same control, different vocabulary.
 *
 * ------------------------------------------------------------------
 * WHY THIS FILE IS NOW SIX LINES OF MAPPING
 * ------------------------------------------------------------------
 * It used to carry its own anatomy — an inline BASE string, its own
 * SIZE table, its own VARIANT table, its own disabled hatch and its
 * own loading sweep — none of which matched <Button />. On `/system`
 * and `/s/[code]` the two rendered side by side: 11px uppercase mono
 * in a square-cornered outline next to 16px sentence-case sans in a
 * 6px-rounded slab. Two control languages on one page is not a
 * variant system, it is an unfinished merge.
 *
 * There is now ONE anatomy, in `app/globals.css` → CONTROL, measured
 * off the reference and set in our palette. This component keeps its
 * own variant NAMES because ~10 call sites use them, and maps them:
 *
 *   primary  → .btn-primary    ink fill, ground label
 *   ghost    → .btn-secondary  45% ink hairline, ink label
 *   quiet    → .btn-ghost      no border, dim ink label
 *
 * Sizes, props, states and ARIA are unchanged.
 */
const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary',
  ghost: 'btn-secondary',
  quiet: 'btn-ghost',
};

/**
 * Every size clears the 44px tap target from CONTRACT.md §3 — `sm` is a
 * narrower button, never a shorter one.
 */
const SIZE: Record<Size, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
};

/**
 * Primary site action. Renders as a link when `href` is given.
 *
 * States are designed, not defaulted:
 *  - `loading` keeps the label, dims it and runs a single hairline
 *    scan along the bottom edge. There is no spinner anywhere in this
 *    product.
 *  - `disabled` withdraws the whole face to 35% rather than rebuilding
 *    it, so a disabled primary can never be mistaken for an enabled
 *    secondary.
 */
export function ActionButton({
  children,
  variant = 'primary',
  size = 'md',
  href,
  className,
  trailing,
  loading = false,
  disabled,
  ...rest
}: {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  href?: string;
  className?: string;
  trailing?: ReactNode;
  /** Awaiting a response. Sets aria-busy and blocks input. */
  loading?: boolean;
} & Omit<ComponentProps<'button'>, 'ref'>) {
  const inert = Boolean(disabled) || loading;
  const classes = cn('btn group', SIZE[size], VARIANT[variant], className);

  const content = (
    <>
      <span className="btn-label">{children}</span>
      {trailing ? (
        <span aria-hidden className="btn-glyph inline-flex shrink-0 items-center">
          {trailing}
        </span>
      ) : null}
      {loading ? <span aria-hidden className="btn-scan" /> : null}
    </>
  );

  if (href) {
    // An anchor cannot be disabled: an inert link becomes a span so it
    // leaves the tab order instead of merely announcing itself as off.
    if (inert) {
      return (
        <span className={classes} aria-disabled="true" aria-busy={loading || undefined}>
          {content}
        </span>
      );
    }
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      disabled={inert}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
}
