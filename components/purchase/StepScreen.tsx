'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { clsx as cn } from 'clsx';
import { SCREEN_MIN, SCREEN_PAD, SHELL } from './layout';

/**
 * ONE SCREEN OF THE BRIEFING.
 *
 * Mounts its children behind a short arrival on the house curve: the incoming
 * screen comes up from below when the sequence moves forward and down from
 * above when it moves back, so the direction of travel is legible without a
 * word being spent on it. There is no exit transition — the answered screen
 * is gone the moment it is answered, which is what makes an advance feel like
 * an answer rather than a page turn.
 *
 * REDUCED MOTION. Stated twice: the `motion-reduce` variants here, and the
 * global reduce block in globals.css, which drops every transition in the
 * product to nothing. Under either, the next screen is simply there.
 *
 * The screen also takes the page back to the top, instantly. A sequence that
 * advances into the middle of the next screen has lost its reader.
 */
export function StepScreen({
  stepKey,
  direction,
  children,
}: {
  /** Changing this re-runs the arrival. */
  stepKey: string;
  direction: 'forward' | 'back';
  children: ReactNode;
}) {
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    setArrived(false);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    // Two frames: the first commits the starting style, the second moves off
    // it. One frame and the browser coalesces both into no transition at all.
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => setArrived(true));
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [stepKey]);

  return (
    <div
      className={cn(
        'transition-[opacity,transform] duration-house ease-house',
        'motion-reduce:transition-none',
        arrived
          ? 'translate-y-0 opacity-100'
          : cn('opacity-0', direction === 'back' ? '-translate-y-3' : 'translate-y-3'),
        'motion-reduce:translate-y-0 motion-reduce:opacity-100',
      )}
    >
      {/* Short screens are centred in the viewport rather than parked under
          the chrome; long ones grow past it. `justify-center` on a box with a
          min-height does both without a second class. */}
      <div className={cn(SHELL, SCREEN_PAD, SCREEN_MIN, 'flex flex-col justify-center')}>
        {children}
      </div>
    </div>
  );
}

/**
 * The head of a screen: the question, and at most one line under it.
 *
 * Every screen in the sequence opens the same way, so the reader's eye lands
 * in the same place seven times running and the only thing that changes is
 * what is being asked.
 */
export function StepHead({
  title,
  children,
  aside,
}: {
  title: string;
  /** One line. If it takes two, the screen is carrying two decisions. */
  children?: ReactNode;
  /** A quiet value opposite the heading — a readout, never a status pill. */
  aside?: ReactNode;
}) {
  return (
    /* pb-6 below `md` for the same reason SCREEN_PAD tightens there: on a
       568px screen the question and the answer have to share the fold. */
    <header className="pb-6 md:pb-8 xl:pb-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <h1 className="max-w-[18ch] text-display text-[color:var(--ink)]">{title}</h1>
        {aside ? (
          <span className="text-label uppercase text-[color:var(--ink-dim)]">{aside}</span>
        ) : null}
      </div>
      {children ? (
        <p className="max-w-[var(--measure)] pt-4 text-body text-[color:var(--ink-dim)]">
          {children}
        </p>
      ) : null}
    </header>
  );
}
