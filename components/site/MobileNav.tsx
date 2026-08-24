'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { Button } from '@/components/fui';
import { cn } from '@/lib/utils';
import { Wordmark } from './Wordmark';

/**
 * The nav breakpoint, as a query. ONE place, so the media listener
 * below and the `@media (width <= 1024px)` block in `app/globals.css`
 * can never disagree.
 *
 * 1024 exactly — `max-width: 1024px`, so 1024 is the panel and 1025 is
 * the plate. Note this is deliberately NOT a framework breakpoint: it
 * is neither Tailwind's `lg` (1024 MIN-width, which would put 1024 on
 * the desktop side) nor Webflow's 991.
 */
const NAV_BREAKPOINT_QUERY = '(max-width: 1024px)';

/**
 * The disclosure's state and its four ways of closing.
 *
 * Lives here rather than in <SiteHeader /> because it belongs to the
 * mobile index, but it is CALLED there: the panel is no longer a
 * portalled drawer, it is the plate itself growing, so the header
 * needs the flag to change its own padding.
 *
 * Closes on: Escape (focus returns to the trigger), any navigation,
 * the viewport crossing back above the breakpoint, and a click on the
 * overlay. The third of those is the reference's own `mql` handler —
 * without it a rotation from portrait to landscape on a large tablet
 * leaves an invisible `overflow: hidden` on <body> and a dialog nobody
 * can see.
 */
export function useDisclosure(triggerRef: RefObject<HTMLButtonElement | null>): {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  close: () => void;
} {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Any navigation closes the index.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes and returns focus to the trigger, and the page behind
  // is locked so a thumb-scroll cannot move the document under the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, triggerRef]);

  // Crossing back above the nav breakpoint closes the panel with no tween.
  useEffect(() => {
    if (!open) return;
    const mql = window.matchMedia(NAV_BREAKPOINT_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (!e.matches) setOpen(false);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [open]);

  return {
    open,
    setOpen,
    close: () => setOpen(false),
  };
}

/**
 * The trigger. Sits in the plate's second cell, below the breakpoint
 * only, and turns into the close mark in place — the same element, so
 * focus never has to move when the panel opens.
 *
 * Their glyph is an 18px box and that IS the hit target, which is 40%
 * of the 44px floor. Ours is the same 18px mark inside a 44px box.
 */
export function MobileNavTrigger({
  ref,
  open,
  onToggle,
}: {
  ref: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="site-index"
      aria-label={open ? 'Close index' : 'Open index'}
      className="site-bar-trigger"
    >
      <MenuGlyph open={open} />
    </button>
  );
}

/**
 * The panel — the plate's second row.
 *
 * ------------------------------------------------------------------
 * WHY THIS IS NOT A PORTAL ANY MORE
 * ------------------------------------------------------------------
 * It used to be `createPortal(<div className="fixed …" />, body)`, for
 * a real reason: a `backdrop-filter` anywhere on the header makes that
 * element a containing block for `position: fixed` descendants, so a
 * fixed panel rendered inside the plate resolved its `inset` against
 * the 70px plate box and vanished.
 *
 * The spec's whole mobile trick is that the plate does NOT slide a
 * drawer in from the side — the same object grows into the panel in
 * place. That only reads as one object if it IS one object, so the
 * panel is now a child of the plate and is not `fixed` at all: the
 * plate takes `height: max(55vh, 470px)`, drops its radius, deepens
 * its blur 25 → 50, and lays itself out as a two-row grid. The old
 * hazard is gone because nothing here is viewport-anchored; the two
 * things that still are — the scrim and the overlay — are siblings of
 * the plate rather than descendants, for exactly the old reason.
 *
 * The dividend is that the DOM order is now the tab order: lockup,
 * close mark, destinations, action. The portal had the panel after
 * everything on the page.
 *
 * Taken from the reference: the expanding plate, `max(55vh, 470px)`,
 * the 50px blur, the 33 / 39 / 28 padding, the centred column on a
 * 28px gap, the mono uppercase destinations, and the oversized
 * wordmark closing the panel — drawn from OUR lockup, in
 * `currentColor`.
 *
 * Not taken: their 12px destination label. At 12px a menu item is a
 * caption; ours is 15px mono uppercase in a 44px row, still the marker
 * treatment, at a size a phone can act on.
 */
export function MobileNavPanel({
  open,
  items,
  startHref = '/mission',
}: {
  open: boolean;
  items: { href: string; label: string }[];
  /** The acquisition funnel. Passed by <SiteHeader /> so the bar and
   *  the index can never point at two different routes. */
  startHref?: string;
}) {
  const pathname = usePathname();
  if (!open) return null;

  return (
    <div className="site-bar-panel">
      <nav aria-label="Site index" className="site-panel-nav">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className="site-panel-link"
            >
              {item.label}
              <span
                aria-hidden
                className={cn(
                  'h-1.5 w-1.5 transition-house',
                  active ? 'bg-[var(--accent)]' : 'bg-transparent',
                )}
              />
            </Link>
          );
        })}

        {/* The action the plate's own row gives up while the panel is
            open — full width here, which is more of the first viewport
            than it had before, not less. */}
        <Button href={startHref} size="lg" className="mt-2 w-full">
          Start a mission
        </Button>
      </nav>

      <div className="site-panel-mark" aria-hidden>
        <Wordmark className="h-10 w-auto" />
      </div>
    </div>
  );
}

/**
 * The 18px trigger mark. Three rules that fold into a cross — the
 * reference ships two separate 18px glyphs and swaps them; folding one
 * into the other keeps the transition the bar already has everywhere
 * else and costs one element fewer.
 */
function MenuGlyph({ open }: { open: boolean }) {
  return (
    <span aria-hidden className="flex h-[18px] w-[18px] flex-col justify-center gap-[5px]">
      <span
        className={cn(
          'block h-px w-[18px] bg-current transition-house',
          open && 'translate-y-[6px] rotate-45',
        )}
      />
      <span className={cn('block h-px w-[18px] bg-current transition-house', open && 'opacity-0')} />
      <span
        className={cn(
          'block h-px w-[18px] bg-current transition-house',
          open && '-translate-y-[6px] -rotate-45',
        )}
      />
    </span>
  );
}
