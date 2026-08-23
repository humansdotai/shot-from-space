'use client';

import { useEffect } from 'react';

/**
 * SMOOTH SCROLL — document level, CSS first.
 *
 * ------------------------------------------------------------------
 * WHAT THIS IS NOT
 * ------------------------------------------------------------------
 * It is not a scroll-jacking library. Those work by pinning the
 * document at `position: fixed` and translating a wrapper on a RAF
 * loop, which costs you the native scrollbar, the scrollbar thumb,
 * find-in-page, focus scrolling, `scrollIntoView`, keyboard paging,
 * accessibility-tree scroll position, and the browser's own scroll
 * restoration. That trade is never worth a nicer wheel curve.
 *
 * The whole implementation is one CSS declaration, in
 * app/globals.css:
 *
 *     @media (prefers-reduced-motion: no-preference) {
 *       html:not([data-smooth-scroll='off']) { scroll-behavior: smooth; }
 *     }
 *
 * `scroll-behavior: smooth` smooths NAVIGATION — anchor links,
 * `scrollTo`, `scrollIntoView`, focus jumps — and leaves the wheel,
 * the trackpad, the scrollbar and the keyboard entirely alone. The
 * scrollbar is the real one, anchors still work, focus still works,
 * and under `prefers-reduced-motion` the rule does not apply at all
 * (twice over: this query, and the global reduce block, which sets
 * `scroll-behavior: auto !important`).
 *
 * ------------------------------------------------------------------
 * SO WHAT IS THE COMPONENT FOR
 * ------------------------------------------------------------------
 * One thing CSS cannot express: a back/forward navigation should land
 * where you left it INSTANTLY. With `scroll-behavior: smooth` in
 * force, some engines animate the restored position, so returning from
 * a mission page glides down four thousand pixels while you watch.
 *
 * This parks `data-smooth-scroll="off"` on <html> for the duration of
 * a history traversal and puts it back on the next frame after the
 * restore has landed. It touches one attribute and adds two passive
 * listeners; there is no state, no wrapper element and no measurement.
 *
 * It also holds the attribute at `off` until after first paint, so an
 * inbound `/page#anchor` link jumps straight to the target instead of
 * animating there from the top of a page the visitor has never seen.
 *
 * Render it once — <SiteHeader /> does, which puts it on every page.
 * Rendering it twice is harmless: both instances write the same value.
 */
export function SmoothScroll() {
  useEffect(() => {
    const root = document.documentElement;

    /** Hand scrolling back to the CSS rule. */
    const enable = () => {
      root.removeAttribute('data-smooth-scroll');
    };

    /** Take it away — instant scrolling until told otherwise. */
    const disable = () => {
      root.setAttribute('data-smooth-scroll', 'off');
    };

    // The initial hash jump happens before/around first paint. Stay out
    // of its way, then enable on the frame after.
    disable();
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(enable);
    });

    // A history traversal restores a scroll offset. Let it land hard.
    const onPopState = () => {
      cancelAnimationFrame(frame);
      disable();
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(enable);
      });
    };

    // Back/forward cache restore is the same story.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) onPopState();
    };

    window.addEventListener('popstate', onPopState, { passive: true });
    window.addEventListener('pageshow', onPageShow, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pageshow', onPageShow);
      enable();
    };
  }, []);

  return null;
}
