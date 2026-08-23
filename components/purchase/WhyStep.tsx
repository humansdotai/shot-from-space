'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/fui';
import { DEDICATION_MAX_LENGTH } from '@/lib/missions/dedication';
import { clsx as cn } from 'clsx';
import { CURVE, INK, INK_DIM, INPUT_CLASS, QUIET_BUTTON, RULE } from './fields';
import { StepAction } from './StepAction';
import { StepHead } from './StepScreen';

/**
 * WHY — the one question whose answer is printed.
 *
 * "What is this place?" sets the dedication line at the foot of the mission
 * sheet: `lib/missions/dedication.ts` sanitises it, the Mission row stores it,
 * and `lib/poster/sheet.ts` sets it under the target block. It is the only
 * free text in this product a customer authors, and it is the only screen in
 * the briefing that changes the object rather than the order.
 *
 * That is the whole reason the screen exists. If the line had nowhere to go
 * the question would be theatre, and this file would not be here.
 *
 * FOUR ANSWERS AND A FIFTH. The four presets advance on selection, like every
 * other choice in the sequence. "Something else" cannot — it opens a field,
 * and a field is answered by being filled — so it reveals one and closes on
 * its own control. The cap is the plate's, not an arbitrary one: the sheet's
 * left measure sets about seventy-three monospaced characters and gives the
 * dedication two lines of it.
 *
 * Leaving the sheet blank is offered, quietly, as its own answer. A print
 * that will hang in someone's hall should not be forced to carry a caption
 * they did not want.
 *
 * THE FOUR PRESETS NEED NO PINNED CONTROL — they are the control, and they
 * measure inside the viewport at every width. The free-text answer does: with
 * a field, a live preview of the line and a counter under the five rows, its
 * control sat 446px below the fold at 320 and was still under it at 1920. It
 * is pinned, and only while the field is open. See <StepAction />.
 */

const PRESETS: readonly { label: string; line: string }[] = [
  { label: 'Home', line: 'Home' },
  { label: 'The first house', line: 'The first house' },
  { label: 'Where we met', line: 'Where we met' },
  { label: 'A place that is gone', line: 'A place that is gone' },
];

/** How the line is set on the sheet. */
function sheetLine(value: string): string {
  return `DEDICATION: ${value.toUpperCase()}`;
}

export function WhyStep({
  dedication,
  onChoose,
}: {
  dedication: string;
  /** Answering advances the sequence. An empty string prints no line. */
  onChoose: (line: string) => void;
}) {
  const preset = PRESETS.find((p) => p.line === dedication);
  const [custom, setCustom] = useState(preset ? false : dedication.length > 0);
  const [text, setText] = useState(preset ? '' : dedication);
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (custom) fieldRef.current?.focus();
  }, [custom]);

  const trimmed = text.trim();
  const remaining = DEDICATION_MAX_LENGTH - Array.from(text).length;

  return (
    <div className="max-w-[44rem]">
      <StepHead title="What is this place?">
        Your answer is set at the foot of the mission sheet, under the target.
      </StepHead>

      <div role="radiogroup" aria-label="Dedication">
        {PRESETS.map((p) => {
          const active = !custom && p.line === dedication;
          return (
            <button
              key={p.line}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setCustom(false);
                onChoose(p.line);
              }}
              className={cn(
                'flex w-full items-center justify-between gap-5 border-t py-5 text-left transition-house',
                'hover:bg-[color:color-mix(in_srgb,var(--ink)_4%,transparent)]',
                RULE,
              )}
            >
              <span className={cn('min-w-0 text-heading', active ? INK : INK_DIM)}>{p.label}</span>
              {/* The line as it will be set. Hidden on a phone, where it
                  crowds the label it is describing; the preview under the
                  free-text field carries the same job for the one answer
                  that is not already written on its own row. */}
              <span
                data-telemetry
                className={cn('hidden shrink-0 font-mono text-tele-xs uppercase md:block', INK_DIM)}
              >
                {sheetLine(p.line)}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          role="radio"
          aria-checked={custom}
          aria-controls="dedication-custom"
          onClick={() => setCustom(true)}
          className={cn(
            'flex w-full items-center justify-between gap-5 border-y py-5 text-left transition-house',
            'hover:bg-[color:color-mix(in_srgb,var(--ink)_4%,transparent)]',
            RULE,
          )}
        >
          <span className={cn('min-w-0 text-heading', custom ? INK : INK_DIM)}>
            Something else
          </span>
          <span className={cn('shrink-0 text-label uppercase', INK_DIM)}>
            Up to {DEDICATION_MAX_LENGTH} characters
          </span>
        </button>
      </div>

      {custom ? (
        <div id="dedication-custom" className="pt-8">
          <label htmlFor="dedication" className={cn('block pb-3 text-label uppercase', INK_DIM)}>
            Your line
          </label>
          <input
            ref={fieldRef}
            id="dedication"
            type="text"
            inputMode="text"
            autoComplete="off"
            maxLength={DEDICATION_MAX_LENGTH}
            placeholder="The house my grandmother built"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && trimmed) {
                e.preventDefault();
                onChoose(trimmed);
              }
            }}
            className={INPUT_CLASS}
          />

          {/* The answer changing the object, while it is being typed. */}
          <div className={cn('mt-5 border px-4 py-4', CURVE, RULE)}>
            <p className={cn('text-label uppercase', INK_DIM)}>On the sheet</p>
            <p
              data-telemetry
              className={cn('mt-2 font-mono text-tele break-words uppercase', trimmed ? INK : INK_DIM)}
            >
              {trimmed ? sheetLine(trimmed) : 'No dedication set'}
            </p>
          </div>
        </div>
      ) : null}

      <div className="pt-8">
        <button type="button" onClick={() => onChoose('')} className={QUIET_BUTTON}>
          Leave it off the sheet
        </button>
      </div>

      {custom ? (
        <StepAction note={<span className="tabular-nums">{remaining} characters left</span>}>
          <Button
            id="dedication-submit"
            size="lg"
            variant="primary"
            disabled={trimmed.length === 0}
            onClick={() => onChoose(trimmed)}
            trailing={<span>&#8594;</span>}
          >
            Print this line
          </Button>
        </StepAction>
      ) : null}
    </div>
  );
}
