'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CommsButton } from './CommsButton';

/**
 * The composer. A single line that grows to a few lines and stops.
 *
 * Mobile rules that are not negotiable, and why:
 *  - 16px font. Anything smaller and iOS Safari zooms the viewport on focus,
 *    which is the layout jump.
 *  - 44px minimum height on the field and on the transmit control.
 *  - `enterKeyHint="send"` so the phone keyboard says SEND, not RETURN.
 *  - While a transmission is in flight the field goes read-only rather than
 *    `disabled`: disabling a focused input on iOS dismisses the keyboard, and
 *    the keyboard cannot be reopened without another tap. Read-only holds the
 *    keyboard, holds the caret and blocks input just as effectively. The field
 *    carries `aria-busy` and the send path is guarded regardless.
 *
 * The prompt caret and the keyboard hint are telemetry, so they stay
 * monospace. Everything the customer reads or types is shell UI: sentence
 * case, body size.
 */

const MAX_HEIGHT_PX = 132;
const MAX_LENGTH = 1000;

export function CommsComposer({
  onSend,
  sending,
  disabled = false,
  note = null,
  className,
}: {
  onSend: (body: string) => void;
  sending: boolean;
  disabled?: boolean;
  /**
   * One sentence under the field. The channel uses it to say what is
   * simulated: it is the last thing read before a message is sent, which is
   * the point at which a customer deserves to know the operator is scripted.
   */
  note?: string | null;
  className?: string;
}) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }, []);

  useEffect(resize, [value, resize]);

  const submit = useCallback(() => {
    if (sending || disabled) return;
    const body = value.trim();
    if (!body) return;
    setValue('');
    onSend(body);
    // Keep the caret and, on a phone, the keyboard.
    requestAnimationFrame(() => ref.current?.focus());
  }, [disabled, onSend, sending, value]);

  const busy = sending || disabled;

  return (
    <form
      className={cn('border-t border-hairline', className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {/* The field takes a 15rem flex basis rather than `flex-1`, so on a
          narrow column the transmit control wraps onto its own line instead
          of squeezing the field down to 180px — which is where the
          placeholder broke across two lines and the composer stopped looking
          like one. From ~640 everything sits on one row as before. */}
      <div className="flex flex-wrap items-end gap-3 px-4 py-4 sm:px-6">
        <span
          aria-hidden
          className={cn(
            'select-none pb-3.5 font-mono text-[0.8125rem] leading-none',
            busy ? 'text-signal' : 'text-paper-faint',
          )}
        >
          &gt;
        </span>

        <label className="sr-only" htmlFor="comms-composer">
          Message Mission Control
        </label>
        <textarea
          id="comms-composer"
          ref={ref}
          rows={1}
          value={value}
          readOnly={busy}
          aria-busy={sending}
          maxLength={MAX_LENGTH}
          enterKeyHint="send"
          inputMode="text"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          placeholder={sending ? 'Transmitting' : 'Message Mission Control'}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey) return;
            e.preventDefault();
            submit();
          }}
          className={cn(
            'min-h-11 min-w-0 grow basis-60 resize-none border-0 bg-transparent py-3 text-[1rem] leading-[1.4] outline-none',
            'placeholder:text-paper-faint',
            busy ? 'text-paper-faint' : 'text-paper',
          )}
        />

        <CommsButton
          type="submit"
          variant="primary"
          size="sm"
          className="ml-auto"
          loading={sending}
          disabled={!sending && value.trim().length === 0}
          aria-label="Transmit message to Mission Control"
        >
          {sending ? 'Sending' : 'Transmit'}
        </CommsButton>
      </div>

      <div className="px-4 pb-4 sm:px-6">
        {/* The keyboard hint is a phrase a desktop reader needs once; the
            mock-mode sentence is the one that must always be legible, so it
            takes the sans note role and the hint drops to the micro ramp. */}
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-tele-xs uppercase text-paper-faint">
            ENTER TRANSMITS / SHIFT ENTER NEW LINE
          </span>
          {value.length > MAX_LENGTH - 120 ? (
            <span
              data-telemetry
              className="shrink-0 font-mono text-tele-s uppercase tabular-nums text-signal"
            >
              {MAX_LENGTH - value.length} LEFT
            </span>
          ) : null}
        </div>
        {note ? <p className="mt-3 max-w-[62ch] text-note text-paper-dim">{note}</p> : null}
      </div>
    </form>
  );
}
