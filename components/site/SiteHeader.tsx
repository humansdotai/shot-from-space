'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, SmoothScroll } from '@/components/fui';
import { cn } from '@/lib/utils';
import { MobileNavPanel, MobileNavTrigger, useDisclosure } from './MobileNav';
import { Wordmark } from './Wordmark';

const NAV = [
  { href: '/missions', label: 'Missions' },
  { href: '/how-it-works', label: 'Process' },
  { href: '/account', label: 'Account' },
];

/** The acquisition funnel. One constant, so the bar and the index agree. */
const START_HREF = '/mission';

/* ==================================================================
   THE GROUND UNDER THE BAR
   ==================================================================
   The header is `absolute` and it is the FIRST thing in the document,
   so it sits over whatever the page opens with — and until this
   existed it assumed that was always a photograph or a void band, and
   hard-coded paper ink. On a paper opening that measured 2.52 : 1 on
   the wordmark and 1.80 : 1 on the nav links. Both are WCAG AA
   failures, and the only reason the site got away with it is that no
   page opened light until `/mission`'s preview column did.

   The reference solves this with a static `theme` prop, and the spec
   recommends the same as "the sane starting point". It is not the
   sane starting point HERE: a prop has to be threaded through every
   route, it is silently wrong the moment a page changes its opening
   band, and it cannot answer a bar that spans two grounds at once.

   So this samples the RENDERED ground instead: three points across
   the plate, walking the document for the last-painted opaque
   background under each, then a relative-luminance test. A page has
   to do nothing to be handled correctly, a photograph falls through
   to <body> (void, which is right — that is what the scrim is for),
   and a band that changes its own ground is picked up on the next
   route or resize.

   The result flips `.on-dark` / `.on-light`, and every colour in the
   bar reads `--ground` / `--ink` off that, exactly as `.btn` does.
   ================================================================== */

type Ground = 'dark' | 'light';

/** sRGB relative luminance, WCAG 2.x §relative-luminance. */
function luminance(r: number, g: number, b: number): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** `rgb(r g b / a)` or `rgba(r,g,b,a)` → the four channels. */
function parseColor(value: string): [number, number, number, number] | null {
  const nums = value.match(/[\d.]+/g);
  if (!nums || nums.length < 3) return null;
  const [r, g, b] = nums.map(Number);
  const a = nums.length > 3 ? Number(nums[3]) : 1;
  return [r, g, b, a];
}

interface GroundReading {
  /** The ground under the LOCKUP — the end of the plate identity sits on. */
  ground: Ground;
  /** True when the nine sample points do not agree: the plate spans two
   *  grounds — sideways, downwards, or both — so no single ink is safe
   *  across the whole of it. */
  split: boolean;
  /** True once the page has scrolled far enough that CONTENT is passing
   *  underneath the plate rather than the page's own opening. The plate
   *  stops being a wash and declares a ground at that point — see the
   *  `[data-header-scrolled]` rule in `app/globals.css`. */
  scrolled: boolean;
}

/**
 * Which ground is under the plate.
 *
 * NOT `elementsFromPoint`. That was the first implementation and it is
 * wrong here for one specific reason: it is a HIT TEST, so it skips
 * every `pointer-events: none` layer — and decorative grounds in this
 * codebase are routinely painted by exactly such a layer (a scrim, an
 * `aria-hidden` plate, a band drawn behind content). On `/mission` at
 * 390 that made the sampler report `light` while the pixels under the
 * bar were void, and the header inverted to dark ink on a dark band.
 *
 * So this does its own approximation of paint order: one pass over the
 * document collecting every visible element with an opaque background
 * whose box contains the sample point, then LAST IN DOCUMENT ORDER
 * wins. That ignores z-index, which is a real limitation and an
 * acceptable one — the question being asked is only "light or dark",
 * and a band that paints its own ground is essentially never doing it
 * from a negative stacking context.
 *
 * It samples a 3 x 3 grid over the plate — both ends and the middle, at
 * the top edge, the waist and the bottom edge — because the plate can
 * straddle two grounds in either axis: sideways on `/mission`, where a
 * paper configurator sits beside a void panel, and DOWNWARDS on any page
 * whose opening band is shorter than the 90px bar, where the plate's
 * lower edge lands on the page beneath it.
 *
 * IT NOW RUNS ON SCROLL TOO, because the plate is `fixed`. While it was
 * `absolute` the ground was a constant: the plate only ever sat over the
 * top of the document, so one reading per route was the whole truth. A
 * fixed plate crosses every band on the page — the index alternates
 * void / paper / void, a mission file opens on a black masthead and ends
 * on paper — and a reading taken at y = 0 is wrong for the rest of the
 * page.
 *
 * SCROLL IS A HOT PATH, so the walk is split in two. `collect()` does the
 * expensive half — one pass over the document, `getComputedStyle` on
 * every element, keeping only those few dozen that paint an opaque
 * ground. `sample()` does the cheap half: nine points against the cached
 * candidates' boxes. `collect()` re-runs only when a MutationObserver
 * says the DOM changed, so a scroll frame costs a handful of
 * `getBoundingClientRect` calls and no style recalculation. The whole
 * thing is rAF-throttled and the state setter bails when the reading has
 * not changed, so scrolling a page whose ground never varies causes
 * exactly zero re-renders.
 *
 * Candidate boxes are read live rather than cached as document
 * coordinates, which costs a little and buys correctness: `sticky` and
 * `fixed` grounds inside a page — the configurator's panel is one —
 * move relative to the document as you scroll, and a cached document
 * rect would have them in the wrong place.
 */
/** How far the page must move before the plate stops being a wash and
 *  declares its own ground. One plate height: below that the page's own
 *  opening is still what is behind the bar. */
const SCROLLED_AT = 24;

function useGroundBeneath(barRef: React.RefObject<HTMLDivElement | null>): GroundReading {
  const [reading, setReading] = useState<GroundReading>({
    ground: 'dark',
    split: false,
    scrolled: false,
  });
  const pathname = usePathname();

  /** Every element that paints an opaque ground, in document order, with
   *  the tone it paints. Rebuilt by `collect()`, read by `sample()`. */
  const candidatesRef = useRef<Array<{ el: HTMLElement; tone: Ground }>>([]);
  /** Set by the MutationObserver; cleared by `collect()`. */
  const staleRef = useRef(true);

  const collect = useCallback(() => {
    const bar = barRef.current;
    const out: Array<{ el: HTMLElement; tone: Ground }> = [];

    // `document.documentElement` and `body` are included so a page that
    // paints its ground on either of them still answers.
    for (const el of document.querySelectorAll<HTMLElement>('body, body *')) {
      // The bar paints its own plate and its own scrim; neither of them
      // is the ground we are asking about.
      if (bar?.contains(el) || el.closest('[data-header-ground]')) continue;

      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const parsed = parseColor(style.backgroundColor);
      if (!parsed) continue;
      const [r, g, b, a] = parsed;
      // Below 0.6 the layer is a veil over something else, not a ground.
      if (a < 0.6) continue;

      out.push({ el, tone: luminance(r, g, b) > 0.5 ? 'light' : 'dark' });
    }

    candidatesRef.current = out;
    staleRef.current = false;
  }, [barRef]);

  const sample = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;

    const rect = bar.getBoundingClientRect();
    if (rect.height === 0) return;

    if (staleRef.current) collect();

    const clampX = (x: number) => Math.min(window.innerWidth - 1, Math.max(1, x));
    const clampY = (y: number) => Math.min(window.innerHeight - 1, Math.max(1, y));
    const xs = [rect.left + 12, rect.left + rect.width / 2, rect.right - 12].map(clampX);
    // THREE ROWS, not one. A single row at the plate's waist answers "is
    // there a light column beside a dark one" and misses the case that
    // actually bit: a page whose opening band is SHORTER than the plate,
    // so the plate's lower edge lands on the paper below it and the 25px
    // blur drags that paper up behind the wordmark. Sampling the top and
    // bottom edges as well as the waist catches both axes with the same
    // mechanism and the same answer — declare a ground.
    const ys = [rect.top + 4, rect.top + rect.height / 2, rect.bottom - 4].map(clampY);
    /** Reading index for row `r`, column `c`. */
    const at = (r: number, c: number) => r * xs.length + c;

    // `document.documentElement` and `body` are included so a page that
    // paints its ground on either of them still answers.
    const found: Array<Ground | null> = new Array(xs.length * ys.length).fill(null);
    for (const { el, tone } of candidatesRef.current) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      // Cheap reject before the nine-point test: the overwhelming
      // majority of candidates are nowhere near the bar on a long page.
      if (box.bottom < rect.top || box.top > rect.bottom) continue;

      for (let row = 0; row < ys.length; row += 1) {
        if (ys[row] < box.top || ys[row] > box.bottom) continue;
        for (let col = 0; col < xs.length; col += 1) {
          if (xs[col] >= box.left && xs[col] <= box.right) found[at(row, col)] = tone;
        }
      }
    }

    const resolved = found.map((t) => t ?? 'dark') as Ground[];
    // The identity end of the plate, at its waist — the ink the wordmark
    // and the first link are actually set in.
    const ground = resolved[at(1, 0)];
    const next: GroundReading = {
      ground,
      split: !resolved.every((t) => t === ground),
      scrolled: window.scrollY > SCROLLED_AT,
    };
    // Bail when nothing moved. This runs on every scroll frame, and a
    // page whose ground never changes must not re-render for it.
    setReading((prev) =>
      prev.ground === next.ground && prev.split === next.split && prev.scrolled === next.scrolled
        ? prev
        : next,
    );
  }, [barRef, collect]);

  useEffect(() => {
    // A route change replaces the whole document under the bar.
    staleRef.current = true;

    // Once on mount/route, once after the first frame (client-only
    // bands paint late), once more shortly after for anything that
    // waits on media.
    sample();
    const raf = requestAnimationFrame(sample);
    const later = window.setTimeout(sample, 400);

    // SCROLL, rAF-throttled. `sample()` is called at most once per frame
    // no matter how many scroll events the browser delivers.
    let pending = 0;
    const onScroll = () => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        sample();
      });
    };

    // Lazily-mounted bands, a disclosure opening, a theme class landing:
    // any of these can change what paints a ground. The observer does not
    // re-collect — it only marks the cache stale, and the next sample pays
    // for the walk. Attributes are watched because a band can change its
    // ground with a class rather than by mounting.
    const observer = new MutationObserver(() => {
      staleRef.current = true;
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', sample, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      if (pending) cancelAnimationFrame(pending);
      window.clearTimeout(later);
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', sample);
    };
  }, [sample, pathname]);

  return reading;
}

/**
 * The site bar.
 *
 * ------------------------------------------------------------------
 * THE ONE IDEA
 * ------------------------------------------------------------------
 * This is NOT a full-width bar. It is a floating blurred plate — an
 * auto-width capsule centred in a transparent header, with the page
 * content visible around it and running behind it. Every number in
 * `app/globals.css → THE SITE BAR` is transcribed from the reference's
 * computed styles: `inline-flex`, `rgb(0 0 0 / .1)` over `blur(25px)`,
 * 13px / 15px padding, 109px between the lockup and the nav, 37px
 * between links, 12px uppercase mono at +0.12px, one breakpoint at
 * exactly 1024px, and the plate growing into the mobile panel in
 * place.
 *
 * THE RADIUS IS THE EXCEPTION. The reference is 3px and says so
 * loudly; the owner asked for round corners, so the plate is 12px.
 * The reasoning for that specific number — and for why it is not the
 * 35px full pill a 70px-tall plate would otherwise take — is on the
 * `border-radius` property in `app/globals.css`.
 *
 * POSITION: `fixed`, on every route. It was `absolute` for a long time
 * and the reasoning was real — the plate sat over the full-bleed opening
 * frame and scrolled away with it, because the frame is the product and
 * a bar that follows you down a photograph is a bar you resent. The
 * owner overruled it: the bar is the only route out of any page, it
 * sells, and on a six-thousand-pixel mission file it was reachable only
 * by scrolling back to the top. It was measured `absolute` on `/`,
 * `/missions`, `/m/[code]`, `/start`, `/how-it-works` and `/legal/*`,
 * gone from the viewport after a single screen of scrolling on all of
 * them.
 *
 * `fixed` costs no layout: like `absolute` it is out of flow and takes
 * no vertical space, so `--site-bar-h` and every page's opening padding
 * are unchanged by the switch. It costs two other things, and both are
 * paid for here rather than left to the page:
 *
 *   1. THE GROUND IS NO LONGER A CONSTANT. See `useGroundBeneath`.
 *   2. CONTENT NOW PASSES UNDERNEATH. The scrim exists to make a 10%
 *      plate legible over a photograph; a permanent 128px wash over
 *      running text is a different thing entirely, and it fogs it. So
 *      the scrim belongs to the OPENING only — `data-header-scrolled`
 *      fades it out and hands legibility to the plate, which declares
 *      its own ground from that point on, exactly as it already does on
 *      a split ground.
 *
 * `z-50`, not the spec's `z-101`: several surfaces (`PreviewStage`'s
 * header band, the grain overlay at `z-40`) are authored against that
 * number.
 *
 * THE FOURTH ELEMENT. The spec says three elements, do not add a
 * fourth. This site sells, and `Start a mission` has to be inside the
 * first viewport at every width on every route. It is therefore in
 * the plate — but it is NOT a fourth cell at a fourth distance, which
 * is what would have broken the 109px reading. The plate still has
 * two cells either side of that gap and the action joins the second
 * one on the LIST's own 37px rhythm, as a terminal item in the same
 * measure. It is also the one thing the group-dim does not touch: the
 * list dims around the pointer, the sale does not.
 *
 * THE BLUR'S HONEST CAVEAT. `backdrop-filter` needs something behind
 * it to blur; over a flat ground it degrades to a plain 10% tint. Over
 * `/`, `/missions` and `/m/[code]` — imagery — it is doing real work.
 * Over `/mission`, `/start`, `/account` and `/legal/*` it is a tint,
 * and the plate is carried there by its edge and its ground instead:
 * on a SPLIT ground the plate declares a ground outright (see the
 * `[data-header-split]` rule), which is the state those flat pages
 * are usually in.
 *
 * SCRIM: a short, weak wash under the bar in `--ground` — void over a
 * photograph, paper over a paper band. It is what makes the 10% plate
 * legible at all over imagery: the reference's own plate floats over a
 * video that is already under a 40% scrim, and without an equivalent
 * a paper wordmark on a 10%-tinted cloud measures under 2:1. It is
 * gone well before it reaches content, so it never reads as a band.
 *
 * IDENTITY: the real lockup, in <Wordmark />, drawn in `currentColor`
 * so it inverts with its ground.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const pillRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { ground, split, scrolled } = useGroundBeneath(pillRef);
  const { open, setOpen, close } = useDisclosure(triggerRef);

  return (
    <header
      data-header-ground={ground}
      data-header-split={split || undefined}
      data-header-scrolled={scrolled || undefined}
      data-open={open || undefined}
      className={cn(
        'site-bar fixed inset-x-0 top-0 z-50',
        ground === 'light' ? 'on-light' : 'on-dark',
      )}
    >
      {/* Document-level smooth scrolling. Rendered from the shell so it
          is present on every route without touching the root layout. */}
      <SmoothScroll />

      {/* The scrim, and the overlay the panel opens onto. Both are
          siblings of the plate rather than descendants: a
          backdrop-filter makes its element a containing block for
          `position: fixed` children, so anything viewport-anchored has
          to live outside the plate. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-32 xl:h-40 xl2:h-52',
          // 86 / 36 / 0, and both numbers are measured rather than chosen.
          // At 70 / 22 the dimmed `ACCOUNT` label — the group-dim's own
          // transient state, over the brightest part of the opening frame
          // at 1440 — measured 4.42 : 1, which is an AA failure by 0.08.
          // 86 / 36 puts it at 4.77 : 1 on this frame and 5.10 : 1 on
          // `/missions`, and the margin matters because the frame under
          // this bar is not fixed: a page may open on cloud.
          'bg-linear-to-b from-[color-mix(in_srgb,var(--ground)_86%,transparent)]',
          'via-[color-mix(in_srgb,var(--ground)_36%,transparent)] to-transparent',
          // AND IT BELONGS TO THE OPENING ONLY. A 128px wash sitting
          // permanently over the top of a fixed viewport does not make
          // a plate legible, it fogs whatever text is scrolling
          // underneath it. Once the page has moved, the scrim goes and
          // the plate carries its own ground instead.
          'transition-opacity duration-500 ease-house',
          scrolled ? 'opacity-0' : 'opacity-100',
        )}
      />
      {/* Not a <button>: `aria-hidden` on a focusable element is a
          defect, and this needs no accessible name — Escape and the
          close mark in the panel are the real affordances, and both
          are keyboard-reachable. This is the pointer shortcut only. */}
      <div aria-hidden className="site-bar-overlay" onClick={close} />

      {/* ---------------------------------------------------------------
          THE PLATE. `inline-flex` — this is the single line that stops
          the design being a full-width bar with a background colour.
          When the disclosure is open it IS the dialog, so the lockup
          and the close mark inside it stay reachable under
          `aria-modal`.
          --------------------------------------------------------------- */}
      <div
        ref={pillRef}
        id="site-index"
        className={cn('site-bar-pill', open && 'on-dark')}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? 'Site index' : undefined}
      >
        <div className="site-bar-a">
          <Link href="/" aria-label="Shot from Space — home" className="site-bar-lockup">
            <Wordmark className="h-9 w-auto min-[360px]:h-10" />
          </Link>
        </div>

        <div className="site-bar-b">
          {/* The destinations. The group-dim lives on the <ul>: hovering
              the list dims every item and the hovered one comes back —
              the inverse of a per-link highlight, and the part of this
              design that is actually distinctive. */}
          <nav aria-label="Primary" className="site-nav">
            <ul className="site-nav-list">
              {NAV.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className="site-nav-link"
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <Button
            href={START_HREF}
            size="md"
            className="site-bar-cta px-5 sm:px-8"
          >
            <span className="sm:hidden">Start</span>
            <span className="hidden sm:inline">Start a mission</span>
          </Button>

          <MobileNavTrigger ref={triggerRef} open={open} onToggle={() => setOpen((v) => !v)} />
        </div>

        <MobileNavPanel open={open} items={NAV} startHref={START_HREF} />
      </div>
    </header>
  );
}
