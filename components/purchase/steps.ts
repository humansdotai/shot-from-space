/**
 * PURCHASE — the briefing sequence.
 *
 * /start is a sequence of screens, one decision each. This file is the only
 * place that knows what those screens are, what order they run in and what
 * has to be true before one can be entered. <StartFlow /> reads it; nothing
 * else needs to.
 *
 * THE URL IS THE STEP. `?step=aim` is pushed on every advance, so Back and
 * Forward move through the briefing rather than off the page, and a refresh
 * lands on the screen that was open. The draft itself is not in the URL — it
 * stays in sessionStorage, where it already was — so a reload restores the
 * target and the step independently and neither can lose the other.
 *
 * DELIVERY IS TWO SCREENS, NOT ONE. Size and finish are the same act — how
 * the mission comes back — but they are two answers, and a screen that
 * advances on selection can only take one. Splitting them keeps every screen
 * closable by the choice on it; merging them would need a Next button under a
 * pair of controls, which is the shape this flow exists to get away from.
 */

import type { StartDraft } from './state';

export type StepId =
  | 'open'
  | 'target'
  | 'aim'
  | 'why'
  | 'brief'
  | 'format'
  | 'finish'
  | 'authorise';

export interface Step {
  id: StepId;
  /** Named in the chrome while the screen is open. Two words at most. */
  label: string;
  /** Paper for documents and specification, void for instruments and imagery. */
  ground: 'dark' | 'light';
}

/**
 * The sequence.
 *
 * One ground change, at the brief. Everything before it is the instrument —
 * a demonstration, a target, a frame being aimed — and sits on the void.
 * Everything from the brief on is a document: the file itself, the object it
 * is printed as, and the money. The flip is the reveal.
 */
export const STEPS: readonly Step[] = [
  { id: 'open', label: 'Begin', ground: 'dark' },
  { id: 'target', label: 'Target', ground: 'dark' },
  { id: 'aim', label: 'Frame', ground: 'dark' },
  { id: 'why', label: 'Dedication', ground: 'dark' },
  { id: 'brief', label: 'Brief', ground: 'light' },
  { id: 'format', label: 'Size', ground: 'light' },
  { id: 'finish', label: 'Finish', ground: 'light' },
  { id: 'authorise', label: 'Authorise', ground: 'light' },
] as const;

const IDS: readonly StepId[] = STEPS.map((s) => s.id);

export function stepIndex(id: StepId): number {
  return IDS.indexOf(id);
}

export function stepAt(index: number): Step {
  return STEPS[Math.min(Math.max(index, 0), STEPS.length - 1)];
}

export function isStepId(value: string | null | undefined): value is StepId {
  return typeof value === 'string' && (IDS as readonly string[]).includes(value);
}

/**
 * The one gate in the sequence: everything from the aim onward is derived
 * from a target, so nothing past the target screen exists without one.
 */
export function canEnter(id: StepId, draft: StartDraft): boolean {
  if (id === 'open' || id === 'target') return true;
  return Boolean(draft.address);
}

/**
 * The furthest step a draft can legally open, used to clamp a hand-typed or
 * restored URL back onto something real.
 */
export function clampStep(id: StepId, draft: StartDraft): StepId {
  return canEnter(id, draft) ? id : 'target';
}

/* ------------------------------------------------------------------ */
/* URL                                                                 */
/* ------------------------------------------------------------------ */

const PARAM = 'step';

/** `/start?step=aim`. The first screen is the bare path. */
export function stepHref(id: StepId): string {
  return id === 'open' ? '/start' : `/start?${PARAM}=${id}`;
}

/** Reads the step out of a query string. `open` when there is none. */
export function stepFromSearch(search: string): StepId {
  const value = new URLSearchParams(search).get(PARAM);
  return isStepId(value) ? value : 'open';
}
