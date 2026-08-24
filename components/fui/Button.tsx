'use client';

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * THE button. The one control the whole site sells through, and now
 * the only control anatomy on the site: <ActionButton /> renders the
 * same `.btn` stack with a different variant vocabulary.
 *
 * ------------------------------------------------------------------
 * WHY THE STYLES LIVE IN CSS AND NOT IN CLASS STRINGS
 * ------------------------------------------------------------------
 * Every colour is read from `--ground` / `--ink`, which `.surface-dark`
 * and `.surface-light` set on the band. That is what makes ONE primary
 * button paper-on-void at the top of the poster and void-on-paper at
 * the bottom, with no variant, no prop and no duplicated CSS. Pass
 * `tone` only when the button sits on a ground its ancestor cannot
 * declare — over a photograph, most often.
 *
 * ------------------------------------------------------------------
 * THE ANATOMY (see `app/globals.css` → CONTROL for the measurements)
 * ------------------------------------------------------------------
 *   radius     3px, self-coloured 1px border
 *   height     44 / 44 / 52   (sm is narrower, never shorter)
 *   padding    20 / 32 / 40 inline
 *   label      mono · 12px · 500 · uppercase · +0.12em
 *   response   colour only, 200ms; the press is one further step of
 *              tone over 90ms. No lift, no shadow, no transform.
 *   disabled   the face withdraws to 35% — it is not rebuilt
 *
 * The API is unchanged: `variant`, `size`, `href`, `tone`, `trailing`,
 * `loading`, `disabled`, `className` all mean what they meant.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
/** `sm` is a NARROWER button, not a shorter one — all three clear 44px. */
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
};

type BaseProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a <Link> instead of a <button>. */
  href?: string;
  /** Force the ground. Omit to inherit from the enclosing band. */
  tone?: 'dark' | 'light';
  /** Leading glyph — a mark, a state dot. Never an icon-only button. */
  leading?: ReactNode;
  /** Trailing glyph — an arrow, a count. Never an icon-only button. */
  trailing?: ReactNode;
  /** Awaiting a response. Keeps the label, scans the bottom edge. */
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

export type ButtonProps = BaseProps &
  Omit<ComponentProps<'button'>, keyof BaseProps | 'ref'> & {
    /** Only meaningful on the <Link> form. */
    target?: string;
    rel?: string;
  };

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  tone,
  leading,
  trailing,
  loading = false,
  disabled = false,
  className,
  type = 'button',
  target,
  rel,
  ...rest
}: ButtonProps) {
  const inert = disabled || loading;

  const classes = cn(
    'btn group',
    SIZE[size],
    VARIANT[variant],
    tone === 'dark' && 'on-dark',
    tone === 'light' && 'on-light',
    className,
  );

  /**
   * The glyph slots sit OUTSIDE `.btn-label` so the busy state can dim
   * the words without dimming the mark — the reference pairs an 18px
   * glyph with a 12px label at an 8px gap, and the pairing is the
   * thing that has to survive.
   */
  const content = (
    <>
      {leading ? (
        <span aria-hidden className="btn-glyph inline-flex shrink-0 items-center">
          {leading}
        </span>
      ) : null}
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
    // An anchor cannot be disabled, so an inert link is rendered as a
    // span: aria-disabled alone still leaves it in the tab order and
    // still navigates on Enter.
    if (inert) {
      return (
        <span className={classes} aria-disabled="true" aria-busy={loading || undefined}>
          {content}
        </span>
      );
    }
    return (
      <Link href={href} className={classes} target={target} rel={rel}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
}

/**
 * The trailing mark used on forward actions. A 1px arrow that steps
 * right on hover — the smallest possible confirmation that the control
 * is alive. Drawn, never a glyph from a font.
 */
export function ButtonArrow() {
  return (
    <svg
      width="14"
      height="10"
      viewBox="0 0 14 10"
      fill="none"
      aria-hidden
      className="transition-transform duration-house ease-house group-hover:translate-x-0.5"
    >
      <path
        d="M0 5h12M8.5 1.5 12 5l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
