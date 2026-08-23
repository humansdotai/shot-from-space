'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * THE DECK MECHANISM — one index, and the two ways it is allowed to move.
 *
 * <BriefDeck /> is the shell; this is the part of it that changes. It is a
 * short file now, and that is the point of it.
 *
 * ==================================================================
 * 1. THERE IS NO GESTURE HERE ANY MORE, AND THAT IS THE FEATURE
 * ==================================================================
 * This hook used to carry a full pointer-drag rig: axis locking, pointer
 * capture, a velocity window, a flick threshold, edge resistance and a
 * synthetic-click suppressor — about 200 lines whose entire job was to let a
 * thumb push a horizontal track around.
 *
 * The deck is a STACK now. Cards sit on top of one another and the top one is
 * shuffled away to reveal the next, which is a different physical claim: a
 * track is something you scrub, a stack is something you deal. A stack that
 * also answered to a horizontal drag would be making both claims at once, and
 * the drag is the one that has to go — you cannot slide the second card out
 * from under the first one with your thumb in the real world either.
 *
 * What replaces it is what was always the primary path: the Next and Back
 * controls, the left and right arrow keys, and Escape. All three were already
 * required by §D and all three are unchanged.
 *
 * ==================================================================
 * 2. WHAT THIS FILE STILL OWNS
 * ==================================================================
 * · the index, clamped and never wrapped — there is nothing past card six;
 * · `handleArrowKey`, called from the dialog's own keydown listener so the
 *   deck answers arrows wherever focus is inside it, and never steals an
 *   arrow that belongs to a caret in a text field;
 * · `onFocusCapture`, which is the whole accessibility trade the stack makes.
 *   Every card is in the DOM and in the accessibility tree at all times (see
 *   BriefDeck.tsx), so Tab can land on a control inside a card that is not
 *   the top of the stack. When focus enters card i, card i becomes the top
 *   card: the deck follows the reader rather than the reader following the
 *   deck.
 *
 * ==================================================================
 * 3. WHERE THE MOVEMENT WENT
 * ==================================================================
 * Into CSS. Each slide is positioned from its DEPTH — how far it is from the
 * top of the stack — and a change of index is therefore a change of two
 * custom properties, which the house transition interpolates on the
 * compositor. No transform is written from JavaScript, no rAF loop runs, and
 * the global reduced-motion reset in app/globals.css takes the transition to
 * nothing without this file needing to know. See `brief.module.css`.
 */

export interface DeckHandle {
  /** Current card, 0-based. The top of the stack. */
  index: number;
  count: number;
  canPrev: boolean;
  canNext: boolean;
  next: () => void;
  prev: () => void;
  /** Jump to a card. Out-of-range values are clamped, never wrapped. */
  goTo: (i: number) => void;
  /** Spread onto the element that holds the slides. */
  stackProps: {
    onFocusCapture: (e: React.FocusEvent<HTMLElement>) => void;
  };
  /** Call from a keydown handler. Returns true when it consumed the key. */
  handleArrowKey: (e: KeyboardEvent) => boolean;
}

export function useDeck(count: number, initialIndex = 0): DeckHandle {
  const [index, setIndex] = useState(() => clamp(initialIndex, 0, count - 1));

  // Live mirrors. `next` and `prev` are handed to controls and to a keydown
  // listener installed once; reading state out of those closures would read a
  // stale card.
  const indexRef = useRef(index);
  indexRef.current = index;
  const countRef = useRef(count);
  countRef.current = count;

  const goTo = useCallback((i: number) => {
    setIndex(clamp(i, 0, countRef.current - 1));
  }, []);

  const next = useCallback(() => goTo(indexRef.current + 1), [goTo]);
  const prev = useCallback(() => goTo(indexRef.current - 1), [goTo]);

  /* --- Focus follows the reader ------------------------------------- */

  const onFocusCapture = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      const slide = (e.target as HTMLElement).closest<HTMLElement>('[data-slide-index]');
      if (!slide) return;
      const i = Number(slide.dataset.slideIndex);
      if (Number.isInteger(i) && i !== indexRef.current) goTo(i);
    },
    [goTo],
  );

  /* --- Keyboard ------------------------------------------------------ */

  const handleArrowKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return false;
      // An arrow inside a field is a caret move; it is never ours.
      if (isTextEntry(e.target)) return false;
      e.preventDefault();
      if (e.key === 'ArrowRight') next();
      else prev();
      return true;
    },
    [next, prev],
  );

  return {
    index,
    count,
    canPrev: index > 0,
    canNext: index < count - 1,
    next,
    prev,
    goTo,
    stackProps: { onFocusCapture },
    handleArrowKey,
  };
}

/* ------------------------------------------------------------------ */
/* Internals                                                          */
/* ------------------------------------------------------------------ */

function clamp(n: number, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
