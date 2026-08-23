'use client';

import { clsx as cn } from 'clsx';
import { INK, INK_DIM, RULE } from './fields';
import { SHELL } from './layout';
import { STEPS, type StepId, stepIndex } from './steps';

/**
 * THE CHROME — where you are, and the way back.
 *
 * It carries the two things that have to be true on every screen of a
 * sequence: the position is visible, and the previous decision is one tap
 * away. Nothing else is in it. There is no forward control here — a screen
 * advances by being answered.
 *
 * POSITION. `sticky top-0`, and the site bar above it is `absolute`, so at
 * rest the chrome sits directly under the bar and once the page scrolls the
 * bar leaves and the chrome takes its place at zero. The two are never on top
 * of each other at any scroll offset.
 *
 * GROUND. Nothing here names a colour. The chrome inherits `--ink` and
 * `--rule` from the screen it belongs to, so it inverts with the sequence at
 * the brief without a variant or a prop.
 */
export function StepChrome({
  step,
  onBack,
}: {
  step: StepId;
  /** Omitted on the first screen, where there is nowhere back to. */
  onBack?: () => void;
}) {
  const index = stepIndex(step);
  const current = STEPS[index];
  const position = `${String(index + 1).padStart(2, '0')} / ${String(STEPS.length).padStart(2, '0')}`;

  return (
    <nav
      aria-label="Mission briefing"
      className={cn(
        'sticky top-0 z-30 border-b bg-[color:var(--ground)]',
        RULE,
      )}
    >
      <div className={cn(SHELL, 'flex items-center justify-between gap-4 py-2.5 xl:py-3')}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className={cn(
              'group -ml-2 inline-flex min-h-11 items-center gap-2.5 rounded-[var(--radius-action)] px-2 text-action transition-house',
              'text-[color:var(--ink-dim)] hover:text-[color:var(--ink)]',
            )}
          >
            <span aria-hidden className="inline-block transition-house group-hover:-translate-x-0.5">
              &#8592;
            </span>
            Back
          </button>
        ) : (
          /* Holds the row height so the chrome does not resize between the
             first screen and the second. */
          <span aria-hidden className="min-h-11" />
        )}

        <p className="flex min-w-0 items-baseline gap-3">
          <span className={cn('truncate text-label uppercase', INK)}>{current.label}</span>
          <span
            data-telemetry
            className={cn('shrink-0 font-mono text-tele uppercase tabular-nums', INK_DIM)}
          >
            {position}
          </span>
        </p>
      </div>

      {/* The rail runs edge to edge on the chrome's bottom hairline. Fill is
          a scaled child, so the transition runs on the compositor. */}
      <ol
        aria-label={`Step ${index + 1} of ${STEPS.length}: ${current.label}`}
        className="absolute inset-x-0 -bottom-px flex h-[2px] gap-px"
      >
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            aria-current={i === index ? 'step' : undefined}
            className="h-[2px] flex-1 overflow-hidden bg-[color:var(--rule)]"
          >
            <span
              aria-hidden
              className={cn(
                'block h-full w-full origin-left transition-transform duration-house ease-house',
                i > index ? 'scale-x-0' : 'scale-x-100',
                i === index ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--ink)]',
              )}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
}
