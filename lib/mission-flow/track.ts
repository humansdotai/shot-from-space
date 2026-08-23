/**
 * /mission — analytics.
 *
 * Two events, `step_viewed` and `step_completed`, both carrying the step
 * id. Screen 2 additionally carries the answer that was chosen, because
 * "why this place" is stored NOWHERE ELSE: it is an analytics property
 * and never part of the order.
 *
 * NO THIRD-PARTY SCRIPT IS LOADED HERE, and none should be added to this
 * file. `track()` looks for a sink that the site may or may not have and
 * does nothing at all when there is none — which, in this repo today, is
 * always. Wiring a real destination is one line inside `emit()`.
 *
 * It never throws: an analytics failure must not be able to stop a
 * purchase.
 */

import type { StepId } from './steps';

export type TrackEvent = 'step_viewed' | 'step_completed';

export type TrackProps = Record<string, string | number | boolean | null | undefined>;

/**
 * The shape a sink has to have to be picked up. Kept structural on
 * purpose so any of the usual suspects — or a hand-rolled queue — works
 * without this file importing anything.
 */
type Sink = (event: string, props?: TrackProps) => void;

interface AnalyticsWindow extends Window {
  /** Vercel Analytics and several others expose exactly this. */
  va?: (event: string, ...args: unknown[]) => void;
  /** A plain queue, if the site ever adds one. */
  sfsAnalytics?: Sink;
  /** Test hook: the Playwright walk reads this to assert the sequence. */
  __missionFlowEvents?: { event: TrackEvent; props: TrackProps }[];
}

function resolveSink(w: AnalyticsWindow): Sink | null {
  if (typeof w.sfsAnalytics === 'function') return w.sfsAnalytics;
  if (typeof w.va === 'function') {
    const va = w.va;
    return (event, props) => va('event', { name: event, data: props });
  }
  return null;
}

export function track(event: TrackEvent, step: StepId, props: TrackProps = {}): void {
  if (typeof window === 'undefined') return;
  const w = window as AnalyticsWindow;
  const payload: TrackProps = { step, ...props };

  try {
    // Always recorded in-page, so the flow is observable in a browser and
    // in a test run without a network destination existing.
    (w.__missionFlowEvents ??= []).push({ event, props: payload });
    resolveSink(w)?.(event, payload);
  } catch {
    /* A sink that throws is the sink's problem, not the buyer's. */
  }
}
