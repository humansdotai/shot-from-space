'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/fui';
import { GuaranteeStrip } from '@/components/landing';
import { formatPrice } from '@/lib/pricing';
import { clsx as cn } from 'clsx';
import {
  ErrorPlate,
  FieldError,
  FieldLabel,
  INK,
  INK_DIM,
  INPUT_CLASS,
  QUIET_BUTTON,
  RULE,
} from './fields';
import { Objections } from './Objections';
import { buildOrderLines } from './profile';
import { StepAction } from './StepAction';
import { StepHead } from './StepScreen';
import type { StepId } from './steps';
import type { Quote, StartDraft } from './state';

/**
 * AUTHORISE — the last screen, and the only one that asks who you are.
 *
 * WHAT IS DELIBERATE ABOUT THE ORDER OF THIS SCREEN
 * ------------------------------------------------------------------------
 * 1. The email is the LAST thing asked for in the whole sequence, it is asked
 *    for once, and it is the ONLY input on this page — the assertion the test
 *    suite makes is literally that. Nothing upstream — the target, the
 *    footprint, the brief, the size, the finish — requires identifying
 *    yourself, so a reader can build and price their entire mission before
 *    deciding whether to hand over an address. Moving sign-in to the end of an
 *    onboarding is the single largest drop-off reduction with evidence behind
 *    it. Do not move it back.
 *
 * 2. The four answers are restated above it, each able to send the reader
 *    back to the screen that made it. A summary you cannot act on is a
 *    receipt, and a receipt before the money is the wrong document.
 *
 * 3. The five guarantees sit AT the control, not in the footer. They are the
 *    same five terms the landing page argues under the price, imported from
 *    one array so the two can never drift, and every one of them is written
 *    into /legal/terms.
 *
 * 4. The five questions that actually stop this purchase are answered one tap
 *    below the button, closed by default. A reader who has already decided
 *    pays nothing for them; a reader who has not does not have to leave the
 *    page to get an answer, because leaving the page is leaving.
 *
 * 5. THE CONTROL AND THE FIGURE ARE PINNED. Five summary rows, a field, five
 *    guarantees and five disclosures make a 3244px screen on a phone, and the
 *    button sat 612px below the fold at 320 and 338px below it at 1440. The
 *    charge and the control that authorises it now sit at the foot of the
 *    viewport on every width (CONFIGURATOR.md §3.1 / §3.2). The `Due now` row
 *    that used to sit above the button IS that bar now — it was not
 *    duplicated, it was moved, so there is still exactly one statement of the
 *    figure on the screen besides the one written into the control itself.
 *
 *    The control is outside the <form> and reaches it by `form=`. The bar has
 *    to be the last child of the block that spans the whole screen or it
 *    cannot pin, and on a 568px phone the form itself starts too far down the
 *    page to be that block.
 */
export function AuthoriseBlock({
  draft,
  quote,
  emailError,
  requestError,
  submitting,
  onEmailChange,
  onSubmit,
  onJump,
}: {
  draft: StartDraft;
  quote: Quote;
  emailError: string | null;
  requestError: string | null;
  submitting: boolean;
  onEmailChange: (v: string) => void;
  onSubmit: () => void;
  /** Sends the reader back to the screen a line was decided on. */
  onJump: (step: StepId) => void;
}) {
  const price = formatPrice(quote.totalMinor, quote.currency);
  const lines = buildOrderLines(draft, quote);
  const refusal = useRef<HTMLDivElement>(null);

  /**
   * A REFUSAL HAS TO BE WHERE THE READER IS LOOKING.
   *
   * The control is pinned to the foot of the viewport, so the field it
   * refuses — and the plate the route's refusal is written into — can both be
   * off screen at the moment they are written. `role="alert"` tells assistive
   * tech; this tells everyone else. The field is centred rather than merely
   * scrolled to, because the bar itself occupies the foot of the screen.
   */
  useEffect(() => {
    if (!emailError && !requestError) return;
    const target: HTMLElement | null = requestError
      ? refusal.current
      : document.getElementById('authorise-email');
    if (!target) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
    if (!requestError) (target as HTMLInputElement).focus({ preventScroll: true });
  }, [emailError, requestError]);

  return (
    <div className="max-w-[44rem]">
      <StepHead title="Authorise the mission." aside="One charge">
        The file opens the moment this settles, and the tasking goes out within a day.
      </StepHead>

      {/* The four answers, each one tap from the screen that made it. ---- */}
      <dl className="pb-9">
        {lines.map((line) => (
          <div
            key={line.label}
            className={cn('flex items-baseline justify-between gap-5 border-t py-3', RULE)}
          >
            <dt className={cn('shrink-0 text-label uppercase', INK_DIM)}>{line.label}</dt>
            <div className="flex min-w-0 items-baseline gap-5">
              <dd className={cn('min-w-0 truncate text-right text-action', INK)}>{line.value}</dd>
              {line.step ? (
                <button
                  type="button"
                  onClick={() => onJump(line.step as StepId)}
                  className={cn(QUIET_BUTTON, 'shrink-0')}
                >
                  {/* "Change" is the word on the row; which thing it changes
                      is already the row's own label, so it is given to
                      assistive tech rather than repeated on screen. */}
                  Change<span className="sr-only"> the {line.label.toLowerCase()}</span>
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </dl>

      <form
        id="authorise-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <FieldLabel htmlFor="authorise-email" hint="Required">
          Your email
        </FieldLabel>
        <input
          id="authorise-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="you@domain.com"
          value={draft.email}
          onChange={(e) => onEmailChange(e.target.value)}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? 'authorise-email-err' : 'authorise-email-help'}
          className={INPUT_CLASS}
        />
        {emailError ? (
          <FieldError id="authorise-email-err">{emailError}</FieldError>
        ) : (
          <p
            id="authorise-email-help"
            className={cn('max-w-[var(--measure)] pt-4 text-body', INK_DIM)}
          >
            Your mission file, every status update and the receipt go here. There is no
            password to set.
          </p>
        )}

        {requestError ? (
          <div ref={refusal} className="mt-8">
            <ErrorPlate title="Authorisation refused">{requestError}</ErrorPlate>
          </div>
        ) : null}

        <p className={cn('mt-9 border-t pt-5 text-body', RULE, INK_DIM)}>
          Cancel free until the satellite is tasked — ask through Mission Comms on your
          mission file and we cancel it and refund the payment.
        </p>

        {/* RISK REVERSAL, AT THE BUTTON. The same five contractual terms the
            landing page carries, read from that one array. */}
        <div className="mt-6">
          <GuaranteeStrip className="min-[1280px]:grid-cols-2" />
        </div>

        <div className="mt-10">
          <Objections region={quote.region} />
        </div>

        <p className={cn('mt-8 max-w-[var(--measure-wide)] border-t pt-5 text-body', RULE, INK_DIM)}>
          Authorising opens a mission file and charges {price} {quote.currency} once. You accept
          the{' '}
          <Link
            href="/legal/terms"
            className="link-underline text-[color:var(--ink-dim)] transition-house hover:text-[color:var(--ink)]"
          >
            terms
          </Link>{' '}
          and the{' '}
          <Link
            href="/legal/privacy"
            className="link-underline text-[color:var(--ink-dim)] transition-house hover:text-[color:var(--ink)]"
          >
            privacy notice
          </Link>
          .
        </p>
      </form>

      {/* The charge and the control that takes it, at the foot of every
          viewport. The figure is `quote.totalMinor` — the same object
          `saveCheckoutSnapshot` bills from — and it is written twice on
          purpose: once as the sum, once inside the control, because a button
          reading "Authorise" with no number on it asks the reader to remember
          one. */}
      <StepAction price={{ label: 'Due now', value: `${price} ${quote.currency}` }}>
        <Button
          id="authorise-submit"
          type="submit"
          form="authorise-form"
          variant="primary"
          size="lg"
          loading={submitting}
          className="justify-between gap-6"
        >
          <span>{submitting ? 'Opening the file' : 'Authorise mission'}</span>
          <span data-telemetry className="tabular-nums">
            {price}
          </span>
        </Button>
      </StepAction>
    </div>
  );
}
