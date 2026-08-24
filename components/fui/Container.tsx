import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * THE CONTENT COLUMN — the only thing allowed to set the page's width.
 *
 * ------------------------------------------------------------------
 * THE MEASUREMENT (SYSTEM-V3 §1)
 * ------------------------------------------------------------------
 *   width      : calc(100% - 4rem)          // 2rem gutter each side
 *   max-width  : calc(1440px - 4rem)        // = 1376px, reached at 1440
 *
 * Both live in `.column` (app/globals.css) so the shell can be drawn
 * from CSS alone — the site bar and the mobile index use the same
 * class and therefore line up with page content to the pixel, which
 * they could not do if the numbers were spelled out in three files.
 *
 * WIDTH, NOT PADDING. The element IS the column: its box edge sits on
 * the text edge, so a border, a rule or a background painted on a
 * Container lands where the type does. The gutters are still real
 * space — `margin-inline: auto` puts them there — so the established
 * escape idiom (`-mx-[var(--gutter-shell)]` plus matching padding, for
 * a scroller that must run to the screen edge inside a padded band)
 * resolves to exactly the pixels it always did.
 *
 * ------------------------------------------------------------------
 * ABOVE 1440 THE COLUMN DOES NOT GROW
 * ------------------------------------------------------------------
 * At 1920 the margin either side is 272px; at 2400 it is 512px. That
 * is deliberate and it is the point: measure is what is being
 * protected, and a paragraph set across 2400px is unreadable however
 * large the type is. The extra width is spent by full-bleed sections
 * instead — `size="flush"` plus `.column-bleed` or the `bleed-pad`
 * utility, both of which DO grow (1376 → 1600 → 2000, on a gutter that
 * runs 20 → 80). The alternation between a fixed column and a growing
 * bleed is what composes 1920 and 2400.
 *
 * A band that wants its margins stated rather than merely empty can
 * add `column-guides`, which draws a hairline on each column edge from
 * 1920 up.
 *
 * ------------------------------------------------------------------
 * SIZES
 * ------------------------------------------------------------------
 *   wide    the column. 1376px cap. The default; almost everything.
 *   narrow  long-form. 696px cap — the reading measure, ~68ch at every
 *           step because the cap is fixed while the type grows. Aligns
 *           with the purchase flow's own 696px content blocks.
 *   flush   the opt-out. 100% width, no gutter, no cap, at every
 *           breakpoint. The section takes the whole viewport and owns
 *           its internal padding from there.
 */
export function Container({
  children,
  size = 'wide',
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  size?: 'wide' | 'narrow' | 'flush';
  className?: string;
  as?: ElementType;
}) {
  return (
    <Tag
      className={cn(
        size === 'wide' && 'column',
        size === 'narrow' && 'column-narrow',
        size === 'flush' && 'column-flush',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
