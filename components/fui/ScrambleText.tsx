'use client';

import { useCallback, useEffect, useRef, useState, type ElementType } from 'react';
import { cn } from '@/lib/utils';

/**
 * SCRAMBLE TEXT — a line that decodes out of noise into the real words.
 *
 * The idiom is a downlink resolving: every character cycles through a
 * small technical glyph pool and locks to its final letter left to
 * right, so the string reads as it arrives. It is the one piece of
 * decorative motion this system allows, because it is literally the
 * product — a frame being received from orbit.
 *
 * ------------------------------------------------------------------
 * THE THREE THINGS THIS EFFECT USUALLY GETS WRONG
 * ------------------------------------------------------------------
 *
 * 1. LAYOUT SHIFT. Random glyphs are not the same width as the real
 *    ones in a proportional face, so a naive implementation reflows on
 *    every frame and shoves the rest of the card around. Here the final
 *    string is always rendered — `visibility: hidden` — and it is what
 *    reserves the box. The animating glyphs are painted on top of it,
 *    absolutely positioned, out of flow. The element's measured size is
 *    the FINAL size from the first frame to the last, and nothing
 *    around it can ever move.
 *
 * 2. SCREEN READERS. Assistive technology must never be read noise.
 *    The real string sits in an `sr-only` span that is present the whole
 *    time and never changes; the animating layer is `aria-hidden`. What
 *    a screen reader announces is identical before, during and after
 *    the scramble.
 *
 * 3. LEAKED LOOPS. One rAF drives every character — not a timer each —
 *    and the handle is cancelled on unmount and before any restart, so
 *    a card hovered twenty times still has exactly one loop.
 *
 * `prefers-reduced-motion: reduce` skips the animation entirely and
 * renders the final text: the information is the point, the decode is
 * the flourish.
 *
 * The server-rendered HTML is the final text, so this degrades to plain
 * type with JavaScript disabled.
 */

/**
 * Uppercase, digits and a few instrument symbols — the same alphabet
 * the telemetry layer speaks in. No katakana (that is a different
 * brand's effect) and no punctuation that reads as a typo.
 */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\<>[]{}+=*#·:';

/** Characters that never scramble — they carry the shape of the line. */
const PRESERVED = /\s/;

/**
 * ~24fps for the glyph roll. The rAF loop still runs at 60, but
 * re-rolling every frame reads as static; at 40ms the eye can see
 * individual characters cycling, which is what makes it read as
 * machinery decoding rather than as noise.
 */
const ROLL_MS = 40;

export type ScrambleTrigger = 'mount' | 'hover' | 'inview';

/** Elements a line of text is allowed to be. */
export type ScrambleTag = 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'strong';

/**
 * When `trigger="hover"`, the effect binds to the nearest ancestor
 * carrying this attribute — so hovering a whole card decodes a subtitle
 * buried three levels inside it, with no client boundary on the card.
 * <MediaCard /> sets it. Without an ancestor, the element binds itself.
 */
const HOST_SELECTOR = '[data-scramble-trigger]';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function ScrambleText({
  text,
  trigger = 'mount',
  duration = 600,
  className,
  as = 'span',
}: {
  /** The real string. This is what is announced and what is measured. */
  text: string;
  /**
   * `mount` decodes once on hydrate, `inview` once when scrolled into
   * view, `hover` every time the card (or the element) is hovered or
   * receives keyboard focus.
   */
  trigger?: ScrambleTrigger;
  /** Total decode time in ms. The last character locks at `duration`. */
  duration?: number;
  className?: string;
  as?: ScrambleTag;
}) {
  const Tag = as as ElementType;

  // The visible layer. Starts as — and always ends as — the real text,
  // so SSR output and the resting state are both correct.
  const [display, setDisplay] = useState(text);

  const rootRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  /**
   * One loop for the whole string. Each character gets a lock time on a
   * left-to-right ramp — the first locks at 35% of the run, the last at
   * 100% — which is what makes the word resolve as a wipe rather than
   * all at once.
   */
  const run = useCallback(() => {
    stop();

    const chars = Array.from(text);
    if (chars.length === 0) return;

    if (prefersReducedMotion()) {
      setDisplay(text);
      return;
    }

    const total = Math.max(1, duration);
    const lockAt = chars.map((_, i) => total * (0.35 + 0.65 * ((i + 1) / chars.length)));
    const start = performance.now();
    let lastRoll = 0;

    const tick = (now: number) => {
      const elapsed = now - start;

      if (now - lastRoll >= ROLL_MS) {
        lastRoll = now;
        setDisplay(
          chars
            .map((char, i) =>
              elapsed >= lockAt[i] || PRESERVED.test(char)
                ? char
                : GLYPHS[(Math.random() * GLYPHS.length) | 0],
            )
            .join(''),
        );
      }

      if (elapsed < total) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        setDisplay(text);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [duration, stop, text]);

  // Whatever the trigger, the loop dies with the component.
  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (trigger !== 'mount') return;
    run();
    return stop;
  }, [run, stop, trigger]);

  useEffect(() => {
    if (trigger !== 'inview') return;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    // Once. A line that re-decodes every time it scrolls past is a
    // ticker, and this system does not have tickers.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            run();
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.2 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [run, stop, trigger]);

  useEffect(() => {
    if (trigger !== 'hover') return;
    const el = rootRef.current;
    if (!el) return;

    const host = (el.closest(HOST_SELECTOR) as HTMLElement | null) ?? el;

    const onEnter = () => run();
    // Keyboard gets the same reveal as the pointer — but only for
    // :focus-visible, so a mouse click on the card does not fire the
    // decode a second time on top of the hover.
    const onFocus = () => {
      if (host.matches(':focus-visible')) run();
    };

    host.addEventListener('mouseenter', onEnter);
    host.addEventListener('focusin', onFocus);
    return () => {
      host.removeEventListener('mouseenter', onEnter);
      host.removeEventListener('focusin', onFocus);
      stop();
    };
  }, [run, stop, trigger]);

  return (
    <Tag ref={rootRef} className={cn('relative inline-block', className)}>
      {/* The accessible name. Never scrambled, never removed. */}
      <span className="sr-only">{text}</span>

      {/* The visible layer: a hidden copy of the final string holds the
          box open, the animating copy floats on top of it. */}
      <span aria-hidden="true" className="relative block select-none">
        <span className="invisible">{text}</span>
        <span className="absolute inset-0 whitespace-pre-wrap">{display}</span>
      </span>
    </Tag>
  );
}
