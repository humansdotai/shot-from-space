'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { clsx as cn } from 'clsx';
import type { FormatId, FrameOption, TargetAddress } from '@/lib/types';
import { AimStep } from './AimStep';
import { createOrder } from './api';
import { AuthoriseBlock } from './AuthoriseBlock';
import { BriefStep } from './BriefStep';
import { FinishStep, FormatStep } from './DeliverySteps';
import { BAR_BAND } from './layout';
import { OpenStep } from './OpenStep';
import { buildMissionBrief } from './profile';
import { StepChrome } from './StepChrome';
import { StepHead, StepScreen } from './StepScreen';
import {
  STEPS,
  type StepId,
  clampStep,
  stepAt,
  stepFromSearch,
  stepHref,
  stepIndex,
} from './steps';
import { TargetBlock } from './TargetBlock';
import { WhyStep } from './WhyStep';
import {
  DEFAULT_DRAFT,
  formatShort,
  isEmail,
  loadDraft,
  locationLabel,
  quoteFor,
  saveCheckoutSnapshot,
  saveDraft,
  type AreaKm,
  type StartDraft,
} from './state';

/**
 * /start — the mission briefing.
 *
 * Eight screens, one decision on each, and the screen advances the moment
 * that decision is made. There is no page of blocks, no running-total table
 * and no Next button on a screen a choice can close by itself. The
 * exceptions are stated where they live: the aim screen closes on a control
 * because the thing being chosen is the picture you are looking at, the
 * brief closes on a control because it is not a question at all, and the
 * free-text half of the dedication screen closes on one because a field is
 * answered by being filled.
 *
 * ------------------------------------------------------------------------
 * ONE PLACE FOR STATE
 * ------------------------------------------------------------------------
 * This is still the only stateful component in the flow. `draft` is the whole
 * order and every screen reads from it and reports back up; nothing below
 * holds a copy. The draft is mirrored into sessionStorage on every change, so
 * a refresh in the middle of the briefing, or a back-navigation out of
 * checkout, restores the target and everything derived from it.
 *
 * THE URL IS THE STEP, and it is the only thing in the URL. `?step=brief` is
 * pushed on every advance, which gives Back and Forward the behaviour a
 * sequence owes them, and a reload re-enters at that step with the draft
 * restored underneath it. The two restore independently: losing the query
 * costs you your place, never your target, and a step the draft cannot
 * support is clamped back to the target screen rather than rendering an
 * empty brief.
 *
 * The restore runs in a layout effect. An ordinary effect would let the
 * browser paint the first screen before the saved step replaced it, and a
 * reader refreshing on the brief would watch the sequence blink back to its
 * opening.
 *
 * ------------------------------------------------------------------------
 * BACK
 * ------------------------------------------------------------------------
 * Back is on every screen but the first and it never costs anything: each
 * screen is rendered from the draft, so returning to one shows the answer
 * that is already in it — the target field pre-filled, the chosen size still
 * marked. Where the reader has a real history entry behind them the control
 * uses it, so Back and the browser's own Back stay the same movement rather
 * than two stacks fighting; where they arrived cold on a deep link it walks
 * the sequence instead.
 *
 * ------------------------------------------------------------------------
 * IDENTITY LAST
 * ------------------------------------------------------------------------
 * Nothing before the final screen asks who you are. The target, the
 * footprint, the brief, the size and the finish are all decided anonymously,
 * and the authorise screen carries exactly one input. That ordering is the
 * single largest drop-off reduction there is evidence for. Do not regress it.
 */

/** Layout effects do not run on the server; this keeps React from saying so. */
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function StartFlow() {
  const router = useRouter();

  const [draft, setDraft] = useState<StartDraft>(DEFAULT_DRAFT);
  const [step, setStep] = useState<StepId>('open');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [hydrated, setHydrated] = useState(false);
  /* The schedule in the brief is stated from the moment the reader is looking
     at it, so it is taken once on mount rather than on every render — a date
     that changed under the reader mid-briefing would be worse than a date
     that is a few minutes old, and it keeps the brief out of the server
     render, where `new Date()` would be a hydration mismatch. */
  const [openedAt, setOpenedAt] = useState<Date | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* Read by listeners that outlive a render: popstate has no access to the
     render's closure and must clamp against the draft as it is now. */
  const draftRef = useRef(draft);
  const stepRef = useRef(step);
  /* How many history entries this flow has pushed. Tells the Back control
     whether there is one of ours to pop or whether it has to walk. */
  const pushedRef = useRef(0);
  /* Where a "change this" jump came from, so answering the screen it jumped
     to returns there instead of re-walking the rest of the sequence. */
  const returnToRef = useRef<StepId | null>(null);
  /* Belt and braces against a double authorise: state lags a fast second
     tap, a ref does not. */
  const inFlightRef = useRef(false);

  /* Restore an in-progress order and the screen it was left on. */
  useBrowserLayoutEffect(() => {
    const saved = loadDraft();
    const restored = saved ?? DEFAULT_DRAFT;
    if (saved) setDraft(saved);
    draftRef.current = restored;

    const landed = clampStep(stepFromSearch(window.location.search), restored);
    setStep(landed);
    stepRef.current = landed;
    window.history.replaceState({ step: landed }, '', stepHref(landed));

    setHydrated(true);
    setOpenedAt(new Date());
  }, []);

  useEffect(() => {
    draftRef.current = draft;
    if (hydrated) saveDraft(draft);
  }, [draft, hydrated]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  /* The browser's own Back and Forward move the sequence. */
  useEffect(() => {
    const onPop = () => {
      const requested = stepFromSearch(window.location.search);
      const landed = clampStep(requested, draftRef.current);
      setDirection(stepIndex(landed) < stepIndex(stepRef.current) ? 'back' : 'forward');
      setStep(landed);
      returnToRef.current = null;
      if (landed !== requested) {
        window.history.replaceState({ step: landed }, '', stepHref(landed));
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /** Move to a screen and put it in the history stack. */
  const go = useCallback((next: StepId) => {
    if (next === stepRef.current) return;
    setDirection(stepIndex(next) < stepIndex(stepRef.current) ? 'back' : 'forward');
    setStep(next);
    window.history.pushState({ step: next }, '', stepHref(next));
    pushedRef.current += 1;
  }, []);

  const back = useCallback(() => {
    if (pushedRef.current > 0) {
      pushedRef.current -= 1;
      // popstate does the rest, so the two stacks never diverge.
      window.history.back();
      return;
    }
    go(stepAt(stepIndex(stepRef.current) - 1).id);
  }, [go]);

  /**
   * Answer the current screen.
   *
   * A jump made from the authorise screen returns there once it is answered;
   * a jump back to the target or the aim does not, because a different target
   * is a different frame and a different brief, and both are worth seeing
   * again before paying for them.
   */
  const answer = useCallback(
    (fallback: StepId) => {
      const to = returnToRef.current;
      returnToRef.current = null;
      go(to ?? fallback);
    },
    [go],
  );

  const jump = useCallback(
    (target: StepId) => {
      returnToRef.current =
        target === 'why' || target === 'format' || target === 'finish' ? 'authorise' : null;
      go(target);
    },
    [go],
  );

  const quote = useMemo(() => quoteFor(draft), [draft]);
  const address = draft.address;

  /* The artifact the briefing builds toward. Null until there is a target,
     which is the same gate the sequence itself uses. */
  const brief = useMemo(
    () => (openedAt ? buildMissionBrief(draft, quote, openedAt) : null),
    [draft, quote, openedAt],
  );

  const lockTarget = useCallback(
    (next: TargetAddress) => {
      setDraft((d) => ({ ...d, address: next }));
      go('aim');
    },
    [go],
  );

  const setArea = useCallback((areaKm: AreaKm) => setDraft((d) => ({ ...d, areaKm })), []);

  const chooseDedication = useCallback(
    (dedication: string) => {
      setDraft((d) => ({ ...d, dedication }));
      answer('brief');
    },
    [answer],
  );

  const chooseFormat = useCallback(
    (formatId: FormatId) => {
      setDraft((d) => ({ ...d, formatId }));
      answer('finish');
    },
    [answer],
  );

  const chooseFinish = useCallback(
    (frame: FrameOption) => {
      setDraft((d) => ({ ...d, frame }));
      answer('authorise');
    },
    [answer],
  );

  const setEmail = useCallback((email: string) => {
    setDraft((d) => ({ ...d, email }));
    setEmailError(null);
    setRequestError(null);
  }, []);

  const submit = useCallback(async () => {
    if (submitting || inFlightRef.current) return;
    if (!address) {
      setRequestError('No target is locked. Go back and name the place to be photographed.');
      return;
    }
    if (!isEmail(draft.email)) {
      setEmailError(
        draft.email.trim().length === 0
          ? 'An email is required — the mission file is delivered to it.'
          : 'That address will not accept mail. Check it and retry.',
      );
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    setRequestError(null);

    const result = await createOrder({
      address,
      formatId: draft.formatId,
      frame: draft.frame,
      email: draft.email.trim(),
      areaKm: draft.areaKm,
      // Absent rather than empty: the route reads a missing dedication as
      // "no line on the sheet", which is exactly what an empty one means.
      dedication: draft.dedication.trim() || undefined,
    });

    if (!result.ok) {
      inFlightRef.current = false;
      setSubmitting(false);
      setRequestError(result.message);
      return;
    }

    // Hand the checkout screen everything it needs to render a summary
    // without a second round trip.
    saveCheckoutSnapshot({
      missionCode: result.data.missionCode,
      email: draft.email.trim(),
      locationLabel: locationLabel(address),
      formatLabel: formatShort(draft),
      frame: draft.frame,
      areaKm: draft.areaKm,
      amountMinor: quote.totalMinor,
      currency: quote.currency,
      region: quote.region,
      lat: address.lat,
      lon: address.lon,
    });

    router.push(result.data.checkoutUrl);
  }, [address, draft, quote, router, submitting]);

  const ground = STEPS[stepIndex(step)].ground;

  return (
    <>
      {/* The site bar's own band. See BAR_BAND — the bar is paper-inked and
          lays a void scrim under itself, so the sequence keeps a strip of void
          under it at every step, including the ones that turn paper. */}
      <div aria-hidden className={cn('surface-dark', BAR_BAND)} />

      <div
        className={cn(
          ground === 'dark' ? 'surface-dark' : 'surface-light',
          'transition-colors duration-house ease-house motion-reduce:transition-none',
        )}
      >
        <StepChrome step={step} onBack={step === 'open' ? undefined : back} />

        <StepScreen stepKey={step} direction={direction}>
          {step === 'open' ? <OpenStep onBegin={() => go('target')} /> : null}

          {step === 'target' ? (
            <div className="max-w-[40rem]">
              <StepHead title="Where do you want us to look?">
                A street address, anywhere the satellite can see.
              </StepHead>
              <TargetBlock
                initialQuery={
                  address ? [address.line1, address.city].filter(Boolean).join(', ') : ''
                }
                onLock={lockTarget}
              />
            </div>
          ) : null}

          {step === 'aim' && address ? (
            <AimStep
              address={address}
              areaKm={draft.areaKm}
              onAreaChange={setArea}
              onConfirm={() => go('why')}
            />
          ) : null}

          {step === 'why' ? (
            <WhyStep dedication={draft.dedication} onChoose={chooseDedication} />
          ) : null}

          {step === 'brief' && brief ? (
            <BriefStep
              data={brief}
              onContinue={() => go('format')}
              onChangeTarget={() => jump('target')}
            />
          ) : null}

          {step === 'format' ? (
            <FormatStep
              formatId={draft.formatId}
              frame={draft.frame}
              quote={quote}
              onChoose={chooseFormat}
              /* The pinned bar takes the size the draft already holds — the
                 same answer a row gives, from the same handler. */
              onContinue={() => chooseFormat(draft.formatId)}
            />
          ) : null}

          {step === 'finish' ? (
            <FinishStep
              formatId={draft.formatId}
              frame={draft.frame}
              quote={quote}
              onChoose={chooseFinish}
              onContinue={() => chooseFinish(draft.frame)}
            />
          ) : null}

          {step === 'authorise' ? (
            <AuthoriseBlock
              draft={draft}
              quote={quote}
              emailError={emailError}
              requestError={requestError}
              submitting={submitting}
              onEmailChange={setEmail}
              onSubmit={submit}
              onJump={jump}
            />
          ) : null}
        </StepScreen>
      </div>
    </>
  );
}
