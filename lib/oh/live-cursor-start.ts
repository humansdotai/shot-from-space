/**
 * When the live cursor senders start: at the visitor's first input (pointer, touch, scroll, wheel or
 * key) or when the browser is next idle (at most `idleMs`), whichever comes first, and only once.
 * The senders then begin loading at the first input instead of after up to 4 s of waiting for an
 * idle moment. They capture from about one chunk fetch later: the input that triggers the start is
 * not itself sent. Kept apart from lib/oh/live-cursor.ts so the page bundle carries only this and
 * the senders stay in their own lazy chunk.
 */
export type StartWindow = {
  addEventListener(type: string, fn: () => void, options: AddEventListenerOptions): void;
  removeEventListener(type: string, fn: () => void, options: EventListenerOptions): void;
  requestIdleCallback?: (fn: () => void, options: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
};

/** The first sign of a visitor. Listened to passively in the capture phase, so no page handler can hide them. */
export const START_INPUTS = ["pointerdown", "pointermove", "touchstart", "scroll", "wheel", "keydown"] as const;

export const START_IDLE_MS = 1000;

/** Calls `start` once, on the first input or idle moment. Returns a function that cancels a start that has not happened. */
export function startOnFirstSign(win: StartWindow, start: () => void, idleMs = START_IDLE_MS): () => void {
  let done = false;
  let idle: number | undefined;
  let timer: unknown;

  const stop = () => {
    done = true;
    for (const type of START_INPUTS) win.removeEventListener(type, go, { capture: true });
    if (idle !== undefined) win.cancelIdleCallback?.(idle);
    if (timer !== undefined) win.clearTimeout(timer);
  };

  function go() {
    if (done) return;
    stop();
    start();
  }

  for (const type of START_INPUTS) win.addEventListener(type, go, { capture: true, passive: true });
  if (typeof win.requestIdleCallback === "function") idle = win.requestIdleCallback(go, { timeout: idleMs });
  else timer = win.setTimeout(go, idleMs);

  return () => {
    if (!done) stop();
  };
}
