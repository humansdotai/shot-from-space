'use client';

import { clsx as cn } from 'clsx';

/**
 * THE STAGE CLOCK — the one thing on the timeline that moves.
 *
 * ==================================================================
 * WHY THERE IS EXACTLY ONE OF THESE ON THE PAGE
 * ==================================================================
 * The house rule is that motion plots a value and never decorates
 * (<OrbitGlyph /> states it: "nothing in this glyph moves on a timer of its
 * own. It is a plot of a value that is changing, which is the same category
 * as a clock, and the opposite of a marquee.").
 *
 * A mission timeline has nine rows. Eight of them are a RECORD — a stage that
 * has already happened and carries the instant it happened at, or a stage
 * that has not happened and carries the condition that opens it. Neither of
 * those is moving, so neither of them animates: a completed stage and a
 * future stage are static marks. Nine looping animations down one column
 * would be nine claims that nine things are happening, and eight of them
 * would be false.
 *
 * Exactly one row IS moving: the stage the mission is sitting on right now.
 * What is moving about it is the time it has been sitting there, and that is
 * what this draws — a clock whose hands are at the real elapsed time in the
 * current stage, counted from the stage's own recorded event. The same
 * number is printed as text beside it, so the motion is never the only
 * carrier of the reading.
 *
 * ==================================================================
 * HOW IT STAYS TRUE
 * ==================================================================
 * Two hands, and the split between them is what makes this honest under
 * every condition:
 *
 *   MINUTE HAND   a static `rotate()` at the real minutes-into-the-hour of
 *                 the elapsed time. It advances when the file's own clock
 *                 ticks (60s) and at no other time, because that is when the
 *                 value it plots actually changes.
 *   SECOND HAND   a static `rotate()` at the real seconds-into-the-minute,
 *                 with a 60-second linear sweep applied INSIDE it. The
 *                 static angle is where the hand is now; the sweep carries
 *                 it on from there. Composed, the hand reads the true
 *                 elapsed seconds at every frame, and the next clock tick
 *                 re-seats the static angle so the pair can never drift.
 *
 * The nesting is not a flourish. It is what makes `prefers-reduced-motion`
 * correct rather than merely quiet: cancelling the animation leaves the hand
 * parked at the STATIC angle, which is still the true reading. A single
 * animated hand with a negative `animation-delay` would park at twelve
 * o'clock under reduced motion and quietly report zero.
 *
 * The instant is never read here — `elapsedMs` arrives as a prop, derived
 * from the clock <MissionFile /> seeds with the server's own, so the first
 * client render emits byte-identical angles and hydration is clean.
 */

/**
 * Scoped keyframes. React 19 hoists this into the head and dedupes it by
 * `href`, so the page ships one copy no matter how many clocks render — the
 * same pattern components/fui/icons/Icon.tsx uses, and the reason no motion
 * CSS reaches a page that renders no clock.
 */
const CLOCK_CSS = `
@keyframes sfs-stage-sweep {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.sfs-stage-sweep {
  transform-box: view-box;
  transform-origin: 8px 8px;
  animation: sfs-stage-sweep 60s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .sfs-stage-sweep { animation: none !important; }
}
`;

/** Six degrees a step, on both hands. A clock face, drawn as one. */
const STEP_DEG = 6;

export function StageClock({
  elapsedMs,
  size = 16,
  className,
}: {
  /** Time the mission has been at this stage, in ms. Never negative. */
  elapsedMs: number;
  /** Edge length in px. Drawn on the icon set's own 16-grid and hairline. */
  size?: number;
  className?: string;
}) {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const secondAngle = (seconds % 60) * STEP_DEG;
  const minuteAngle = (Math.floor(seconds / 60) % 60) * STEP_DEG;

  return (
    <>
      <style href="sfs-stage-clock" precedence="medium">
        {CLOCK_CSS}
      </style>
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        /* Stated in RENDERED pixels, exactly as the icon frame states it, so
           a clock at 14px carries the same hairline as a mark at 16px. */
        strokeWidth={(1.25 * 16) / size}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        focusable="false"
        className={cn('block shrink-0', className)}
      >
        <circle cx="8" cy="8" r="6.2" opacity="0.55" />
        <g transform={`rotate(${minuteAngle} 8 8)`}>
          <path d="M8 8V4.6" />
        </g>
        <g transform={`rotate(${secondAngle} 8 8)`}>
          <g className="sfs-stage-sweep">
            <path d="M8 8V2.4" opacity="0.75" />
          </g>
        </g>
        <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    </>
  );
}

/**
 * `04D 07H` / `07H 12M` / `12M` — the same elapsed value the clock draws,
 * written out. Uppercase and padded so a column of them does not jitter as
 * the file polls.
 */
export function elapsedLabel(elapsedMs: number): string {
  const minutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  if (days > 0) return `${pad(days)}D ${pad(hours)}H`;
  if (hours > 0) return `${pad(hours)}H ${pad(rest)}M`;
  return `${pad(rest)}M`;
}
