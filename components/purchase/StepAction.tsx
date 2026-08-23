'use client';

import type { ReactNode } from 'react';
import { clsx as cn } from 'clsx';
import { INK, INK_DIM, RULE } from './fields';

/**
 * THE PINNED ACTION — the price and the primary control, always on screen.
 *
 * ------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ------------------------------------------------------------------------
 * CONFIGURATOR.md §3.1: the primary CTA is visible without scrolling, at
 * every step, at every breakpoint. Measured before this component existed,
 * /start failed that on five of its eight screens — the brief's control sat
 * 1995px below the fold at 320 and 641px below it at 1440, because a screen
 * that hands over a document cannot also fit a button under it.
 *
 * The fix is the one every configurator in this category uses: the action is
 * pinned to the foot of the viewport and the price sits beside it. That is
 * §2's `PRICE │ PRIMARY CTA` on both halves of the diagram — the phone's
 * thumb zone and the desktop panel's foot are the same element here, because
 * /start composes in one column rather than a split.
 *
 * ------------------------------------------------------------------------
 * STICKY, NOT FIXED, AND THE REASON MATTERS
 * ------------------------------------------------------------------------
 * <StepScreen /> animates each arrival with a `translate`, and a non-`none`
 * `translate` makes an element a containing block for `position: fixed`
 * descendants — a fixed bar inside a screen would anchor to the screen's own
 * box and scroll away with it. `position: sticky` has no such coupling: it
 * resolves against the viewport, so the bar pins from the first paint and
 * releases only when the screen's own foot arrives, where it comes to rest in
 * the flow. Nothing is ever permanently hidden underneath it and no spacer is
 * needed to stop the last line of a screen disappearing behind it.
 *
 * The bar therefore has to be the LAST child of the block that spans the
 * whole screen. Put it inside a short sibling and it cannot pin, because
 * sticky can never leave its own containing block.
 *
 * ------------------------------------------------------------------------
 * GROUND, EDGES, SAFE AREA
 * ------------------------------------------------------------------------
 * Nothing here names a colour: the bar reads `--ground`, `--ink` and `--rule`
 * from the screen it belongs to, so it inverts with the sequence at the brief
 * exactly as the chrome does.
 *
 * Below `md` it breaks out to the shell gutters and runs edge to edge, which
 * is what makes it read as the thumb-zone bar rather than a button that has
 * been parked; from `md` up it stays on the screen's own column so it lines
 * up with the copy above it. `env(safe-area-inset-bottom)` keeps the control
 * clear of the home indicator on a notched phone (CONFIGURATOR.md §3.7).
 *
 * `edge="page"` is the second case: a surface whose content is banded rather
 * than composed in one block — the checkout — cannot hang the bar off a
 * content column, because that column starts below the fold on a phone and
 * sticky can never leave its own containing block. There the bar is a child
 * of the page, runs edge to edge at every width, and holds its own content on
 * the column with `innerClassName`.
 */
export function StepAction({
  price,
  note,
  children,
  edge = 'screen',
  className,
  innerClassName,
}: {
  /**
   * The figure beside the control. It must come from the same `quoteFor`
   * result the order is built from — display and charge come from one
   * function (§3.2) and a second source of truth for money is how a €79
   * button once recorded €170.
   */
  price?: { label: string; value: string };
  /** One short line where a step has no price. Never a second sentence. */
  note?: ReactNode;
  /** The primary control. A `.btn` is made full width below `md`. */
  children: ReactNode;
  /**
   * `screen` — a child of the screen's own content block (every /start step).
   * `page`   — a child of the page, edge to edge, content held on the column
   *            by `innerClassName` (the checkout).
   */
  edge?: 'screen' | 'page';
  className?: string;
  /** The column the bar's content sits on. `edge="page"` only. */
  innerClassName?: string;
}) {
  return (
    <div
      className={cn(
        /* `sticky` is itself a positioned box, so the scrim below resolves
           against it — do not add `relative` here, it would collide with
           `position: sticky` in the cascade rather than order after it. */
        'sticky bottom-0 z-20 border-t bg-[color:var(--ground)] pb-[env(safe-area-inset-bottom,0px)]',
        edge === 'screen' &&
          'mt-8 -mx-[var(--gutter-shell)] px-[var(--gutter-shell)] md:mx-0 md:px-0 xl:mt-10',
        RULE,
        className,
      )}
    >
      {/* The same scrim idiom <SiteHeader /> lays under itself, inverted: a
          short fade to the ground above the hairline, so the content the bar
          is over reads as passing under it rather than as being clipped by
          it. It is a legibility scrim on the ground's own colour, not a
          decoration, and it is inert to the pointer. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-full h-8 bg-linear-to-t from-[color:var(--ground)] to-transparent"
      />

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3 xl:py-4',
          innerClassName,
        )}
      >
        {price ? (
          <p className="flex min-w-0 basis-full items-baseline gap-3 md:basis-auto">
            <span className={cn('shrink-0 text-label uppercase', INK_DIM)}>{price.label}</span>
            <span data-telemetry className={cn('min-w-0 truncate text-heading tabular-nums', INK)}>
              {price.value}
            </span>
          </p>
        ) : note ? (
          <p className={cn('min-w-0 basis-full text-body md:basis-auto', INK_DIM)}>{note}</p>
        ) : null}

        {/* One rule for every caller rather than a `w-full` repeated eight
            times: the control fills the thumb-zone bar on a phone and takes
            its own width from `md` up. */}
        <div className="w-full md:w-auto [&>.btn]:w-full md:[&>.btn]:w-auto">{children}</div>
      </div>
    </div>
  );
}
