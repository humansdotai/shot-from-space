'use client';

import { clsx as cn } from 'clsx';
import { Button, ButtonArrow } from '@/components/fui';
import { INK, INK_DIM, RULE } from '@/components/purchase/fields';
import { formatPrice } from '@/lib/pricing';
import type { Currency } from '@/lib/types';

/**
 * PRICE AND PRIMARY ACTION — the foot of the panel.
 *
 * ------------------------------------------------------------------
 * THIS IS THE ACCEPTANCE TEST FOR THE WHOLE SURFACE
 * ------------------------------------------------------------------
 * CONFIGURATOR.md §3.1 and §3.2: the primary action is visible without
 * scrolling on every section at every width, and the price is visible
 * wherever the action is, and it is the price that will be charged.
 *
 * It is visible because of WHERE IT IS, not because of how it is
 * positioned: <Configurator /> makes it a sibling of the only scrolling
 * region on the page. Nothing here is fixed or sticky, so there is
 * nothing to come unstuck.
 *
 * IT IS ALSO THE HEIGHT BUDGET. Every line added here is a line taken
 * off the scroller at 320 × 568, so the foot is TWO ROWS on a phone and
 * never three: the labelled price line, and the control. `Total` is a
 * prefix on the spec line rather than a caption above it for exactly
 * that reason.
 *
 * ------------------------------------------------------------------
 * ONE PRICE FUNCTION
 * ------------------------------------------------------------------
 * The minor-unit amount is passed in already computed by
 * `tierPriceMinor(tier, formatId, effectiveFrame(tier, frame), currency)`
 * — the same call the order route prices from. This component does no
 * arithmetic of its own and must never be given any: a second
 * implementation is how a €79 button once recorded €170.
 *
 * The currency is a UNIT, not part of the number, and is set as one —
 * dim, monospace, beside the figure. Same rule as every other reading
 * in the panel.
 *
 * THUMB ZONE. Below `sm` the price sits on its own line and the button
 * is full width, because `Pay €189 EUR` beside a price does not fit a
 * 320px column. The padding carries `env(safe-area-inset-bottom)` so
 * the control clears an iPhone's home indicator.
 */
export function PanelFoot({
  label,
  totalMinor,
  currency,
  action,
}: {
  /** What the price is FOR — the tier and the size, in the label role. */
  label: string;
  totalMinor: number;
  currency: Currency;
  action: PrimaryAction;
}) {
  const hintId = action.hint ? 'panel-foot-hint' : undefined;

  return (
    <div
      data-panel-foot
      className={cn(
        'px-5 sm:px-6 xl:px-8 xl2:px-10',
        // TIGHTER UNDER 380px, AND THE REASON IS ARITHMETIC.
        // At 320 x 568 the shell is 497px once the mock-mode strip has
        // taken its 71; <Configurator /> caps the preview so that rail +
        // scroller + foot share a fixed reserve, and every pixel this
        // foot does not need is a pixel the buyer can reach a control
        // in. So under 380 the padding steps down, the gap closes and
        // the control drops from the 52px `lg` height to the 44px tap
        // floor. 44 is the floor and it is not negotiable further.
        //
        // 380 and not `sm`: from 390 up the reserve already leaves the
        // scroller ~240px and the generous control is the better one.
        // Only the two narrow steps in the matrix are starved.
        'pt-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))]',
        'max-[379px]:pt-3 max-[379px]:pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]',
      )}
    >
      {action.hint ? (
        <p id={hintId} className={cn('pb-3 text-note max-[379px]:pb-2 max-[379px]:leading-snug', INK_DIM)}>
          {action.hint}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 max-[379px]:gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        {/* THE LABELLED PRICE.
            `TOTAL` names the figure and the spec says what the figure is
            FOR, so neither is a number floating on its own.

            Below `sm` the two sit on ONE row — label left, figure right —
            because that row is 16px of foot, and 16px of foot is 16px
            taken off a scroller that is already only a couple of hundred
            pixels tall on the map phase. From `sm` up there is room to
            stack them and let a rule carry the eye across. */}
        <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 sm:flex-col sm:items-stretch sm:gap-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn('shrink-0 font-mono text-tele-xs uppercase', INK_DIM)}>Total</span>
            <span aria-hidden className={cn('hidden min-w-2 flex-1 border-t sm:block', RULE)} />
            <span aria-hidden className={cn('shrink-0 font-mono text-tele-xs sm:hidden', INK_DIM)}>
              ·
            </span>
            <span
              data-telemetry
              className={cn('min-w-0 truncate font-mono text-tele-xs uppercase', INK_DIM)}
              title={label}
            >
              {label}
            </span>
          </span>

          <p
            data-telemetry
            aria-live="polite"
            className={cn('shrink-0 text-heading tabular-nums', INK)}
          >
            {formatPrice(totalMinor, currency)}{' '}
            <span className={cn('font-mono text-tele-s uppercase', INK_DIM)}>{currency}</span>
          </p>
        </div>

        <Button
          variant="primary"
          size="lg"
          href={action.href}
          onClick={action.onClick}
          disabled={action.disabled}
          loading={action.loading}
          aria-describedby={hintId}
          // The arrow means FORWARD. `Continue` earns it; `Pay €409` does
          // not — the money is not another step.
          trailing={
            action.arrow === false || action.href || action.disabled ? undefined : <ButtonArrow />
          }
          // `lg` is 52px and is right on a desktop split. Below `sm` it
          // drops to the 44px tap-target floor, which is eight pixels
          // back into the scroller on the width that has none to spare.
          className="w-full justify-center max-[379px]:h-11 sm:w-auto sm:shrink-0"
        >
          {action.label}
        </Button>
      </div>
    </div>
  );
}

/**
 * What the foot's button does on the section that is open. Built by
 * <MissionFlow />, which is the only thing that knows both the section
 * and the draft.
 */
export interface PrimaryAction {
  label: string;
  onClick?: () => void;
  /** Renders the action as a link. Used once, on the confirmation. */
  href?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Forward arrow on the control. Default true; false on the payment. */
  arrow?: boolean;
  /**
   * One line saying what is still needed, shown above the button when the
   * action is blocked. A disabled control with no reason given is a dead
   * end; this is the reason.
   */
  hint?: string;
}
