'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/fui';
import { clsx as cn } from 'clsx';
import { CURVE, INK, INK_DIM, QUIET_BUTTON, RULE } from './fields';
import type { MissionBriefData, ProfileField } from './profile';
import { StepAction } from './StepAction';

/**
 * THE BRIEF — the artifact, handed over.
 *
 * Every screen before this one took something from the reader. This one gives
 * something back: their own mission, named after their own target, with the
 * window it will be flown in, the geometry of the pass over that exact
 * latitude, the facility that will print it and the dates it should arrive
 * between. It is the last screen before an object is specified and the last
 * screen before any money is named.
 *
 * It earns that framing only because every value in it is real. The target
 * and the footprint are what they entered, the facility comes from the
 * catalogue, the window comes from the pipeline's published timings and the
 * pass geometry is the NOAA solar position at their own coordinates. See
 * `profile.ts`, where each field carries the file it is read from.
 *
 * THE REVEAL. The sheet arrives in five beats on the house curve — the
 * header, then each section — so it reads as a file being laid down rather
 * than a panel appearing. Under `prefers-reduced-motion` there are no beats:
 * the whole sheet is simply there.
 *
 * THE CONTROL IS PINNED. This was the worst surface on the site by the CTA
 * measurement: a sheet of eleven fields is 2500px tall on a phone and 1400px
 * tall on a laptop, so a button under it sat below the fold at every one of
 * the nine widths — 1995px below it at 320, 641px at 1440. No amount of
 * tightening fixes a document that is simply taller than a screen; the
 * control belongs at the foot of the viewport instead. See <StepAction />.
 */

/** Number of parts revealed so far. All of them, at once, under reduced motion. */
function useReveal(count: number): number {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(count);
      return;
    }
    const timers = Array.from({ length: count }, (_, i) =>
      window.setTimeout(() => setShown(i + 1), 90 + i * 110),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [count]);

  return shown;
}

function Beat({ shown, children }: { shown: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'transition-[opacity,transform] duration-house ease-house',
        'motion-reduce:transition-none motion-reduce:translate-y-0 motion-reduce:opacity-100',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
    >
      {children}
    </div>
  );
}

function Field({ field }: { field: ProfileField }) {
  return (
    <div className={cn('border-t py-4', RULE)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <dt className={cn('shrink-0 text-label uppercase', INK_DIM)}>{field.label}</dt>
        <dd
          data-telemetry
          className={cn(
            'min-w-0 text-right tabular-nums',
            field.mono ? 'font-mono text-tele uppercase' : 'text-action',
            INK,
          )}
        >
          {field.value}
        </dd>
      </div>
      {field.note ? (
        <p className={cn('max-w-[52ch] pt-2 text-body', INK_DIM)}>{field.note}</p>
      ) : null}
    </div>
  );
}

/**
 * Registration marks that follow the ground.
 *
 * <CropMarks /> draws in `--color-paper`, which is correct on the void and
 * invisible on paper. The brief is a paper document, so its marks are drawn
 * here against `--rule-strong` instead.
 */
function SheetMarks() {
  const corners = [
    'left-2 top-2',
    'right-2 top-2 rotate-90',
    'right-2 bottom-2 rotate-180',
    'left-2 bottom-2 -rotate-90',
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {corners.map((position) => (
        <span
          key={position}
          className={cn(
            'absolute h-3 w-3 border-t border-l border-[color:var(--rule-strong)]',
            position,
          )}
        />
      ))}
    </div>
  );
}

export function BriefStep({
  data,
  onContinue,
  onChangeTarget,
}: {
  data: MissionBriefData;
  onContinue: () => void;
  onChangeTarget: () => void;
}) {
  const shown = useReveal(data.sections.length + 1);

  return (
    /* The sheet is a document, not a reading measure: its fields are short
       and paired, so it is allowed to take the display at the widest steps
       rather than stranding itself in a 1376px column. */
    <div className="max-w-[60rem] xl2:max-w-[72rem]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <p className={cn('text-label uppercase', INK_DIM)}>Mission brief</p>
        <button type="button" onClick={onChangeTarget} className={QUIET_BUTTON}>
          Change the target
        </button>
      </div>

      <div
        className={cn(
          'relative mt-6 border px-5 py-6 md:px-8 md:py-9 xl:px-10 xl:py-10',
          CURVE,
          RULE,
          'bg-[color:color-mix(in_srgb,var(--ink)_3%,transparent)]',
        )}
      >
        <SheetMarks />

        <Beat shown={shown >= 1}>
          <header className={cn('border-b pb-7', RULE)}>
            <h1 className={cn('text-display break-words', INK)}>{data.designation}</h1>
            <p className={cn('mt-5 text-heading break-words', INK)}>{data.street}</p>
            <p className={cn('mt-2 text-label uppercase break-words', INK_DIM)}>{data.place}</p>
            <p
              data-telemetry
              className={cn('mt-3 font-mono text-tele uppercase tabular-nums', INK_DIM)}
            >
              {data.coords}
            </p>
          </header>
        </Beat>

        <div className="grid gap-x-12 md:grid-cols-2">
          {data.sections.map((section, i) => (
            <Beat key={section.title} shown={shown >= i + 2}>
              <section className="pt-8">
                <h2 className={cn('pb-1 text-label uppercase', INK)}>{section.title}</h2>
                <dl>
                  {section.fields.map((field) => (
                    <Field key={field.label} field={field} />
                  ))}
                </dl>
              </section>
            </Beat>
          ))}
        </div>
      </div>

      <StepAction note="Nothing is charged yet.">
        <Button
          id="brief-continue"
          size="lg"
          variant="primary"
          onClick={onContinue}
          trailing={<span>&#8594;</span>}
          /* At 320 (iPhone SE) this label is 293px inside a 256px column and
             `.btn` sets `white-space: nowrap`, so the button ran 5px past the
             viewport and the whole document scrolled sideways. Bounding it to
             its container and letting the label take a second line inside the
             52px box costs nothing at 360 and up, where it still fits on one. */
          className="max-w-full whitespace-normal"
        >
          Choose how it comes back
        </Button>
      </StepAction>
    </div>
  );
}
