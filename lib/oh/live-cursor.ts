/**
 * Live cursor feed for the 0Humans console (Eyepup's live cursor channel), DOM-free so it can be
 * tested without a browser. The component in components/oh/LiveCursor.tsx wires it to
 * the real window.
 *
 * Privacy: each point is the pointer position, the viewport size, the scroll offset,
 * the path and the host. Nothing about the element under the pointer, no text and no form values.
 */

export const CURSOR_ENDPOINT = "https://analytics.enhance.ac/agent/cursor/track";
/** 4 Hz at most. */
export const THROTTLE_MS = 250;
/** Stop sending 30 minutes into a page view; the next page view starts a fresh window. */
export const MAX_PAGEVIEW_MS = 30 * 60 * 1000;

/** The exact keys of every point sent, in order. Nothing else ever leaves the page. */
export const PAYLOAD_KEYS = ["distinct_id", "session_id", "x", "y", "vw", "vh", "page_y", "path", "host"] as const;

export type CursorPayload = {
  distinct_id: string;
  session_id: string;
  x: number;
  y: number;
  vw: number;
  vh: number;
  page_y: number;
  path: string;
  host: string;
};

/** The parts of the Eyepup (posthog-js) instance this module touches. */
type Tracker = {
  get_distinct_id?: () => unknown;
  get_session_id?: () => unknown;
  has_opted_out_capturing?: () => unknown;
};

/** A mouse event or a touch point: both carry viewport and page coordinates. */
type PointerLike = { clientX: number; clientY: number; pageY: number };

type Listener = (event: Event) => void;
type ListenerTarget = {
  addEventListener(type: string, listener: Listener, options?: AddEventListenerOptions): void;
  removeEventListener(type: string, listener: Listener, options?: EventListenerOptions): void;
};

export type CursorWindow = ListenerTarget & {
  eyepup?: Tracker;
  posthog?: Tracker;
  innerWidth: number;
  innerHeight: number;
  location: { pathname: string; host: string };
  navigator: { sendBeacon?: (url: string, data?: BodyInit | null) => boolean };
  Blob: typeof Blob;
};

export type CursorDocument = ListenerTarget & { visibilityState: string };

/** On only for a build with NEXT_PUBLIC_OH_LIVE_CURSOR=1. */
export function liveCursorEnabled(flag: string | undefined): boolean {
  return flag === "1";
}

const ROUTE_PATH = /^\/[A-Za-z0-9._~\-/]{0,255}$/;

/** Route characters only (same rule as the edge observer); anything else is redacted. */
export function safePath(pathname: string): string {
  return typeof pathname === "string" && ROUTE_PATH.test(pathname) ? pathname : "/(redacted)";
}

/**
 * Pages where the senders send nothing. Empty: every observed page is followed. The operator pages
 * and customers' own pages are handled in edge-observer.ts (not observed, or redacted). The three
 * lists stay so a page can be excluded by adding it here.
 */
/** Prefixes (the path itself and anything below it). */
export const CURSOR_DENY_PREFIXES: readonly string[] = [];
/** Everything below these. */
export const CURSOR_DENY_UNDER: readonly string[] = [];
/** Any path containing one of these, anywhere, in any case. */
export const CURSOR_DENY_WORDS: readonly string[] = [];

/**
 * Excluded pages: neither sender sends anything there, and the route drops a batch for them.
 * Case-insensitive, checked on the raw path and on its percent-decoded form, so a path the sender
 * would redact (or encode) cannot slip past.
 */
export function cursorPathDenied(pathname: unknown): boolean {
  if (typeof pathname !== "string") return true;
  const forms = [pathname.toLowerCase()];
  try {
    forms.push(decodeURIComponent(pathname).toLowerCase());
  } catch {
    // malformed escape: the raw form is checked
  }
  return forms.some(
    (p) =>
      CURSOR_DENY_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + "/")) ||
      CURSOR_DENY_UNDER.some((prefix) => p.startsWith(prefix)) ||
      CURSOR_DENY_WORDS.some((word) => p.includes(word)),
  );
}

function str(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

/**
 * The visitor's Eyepup identity: the `eyepup_session` cookie identity the console joins on.
 * window.eyepup wins. window.posthog is used only when window.eyepup is absent, so a page where
 * Eyepup is still a queue stub (no id yet) sends nothing rather than a different identity.
 * Returns null when there is no id yet or the visitor opted out of capture.
 */
export function readIdentity(win: Pick<CursorWindow, "eyepup" | "posthog">): { distinct_id: string; session_id: string } | null {
  const tracker = win.eyepup ?? win.posthog;
  if (!tracker || typeof tracker.get_distinct_id !== "function") return null;
  if (typeof tracker.has_opted_out_capturing === "function" && tracker.has_opted_out_capturing() === true) return null;
  const distinct_id = str(tracker.get_distinct_id(), 200);
  if (!distinct_id) return null;
  const session_id = typeof tracker.get_session_id === "function" ? str(tracker.get_session_id(), 200) : null;
  return { distinct_id, session_id: session_id ?? "" };
}

function int(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

/** One point. Scroll offset comes from the event (pageY - clientY), so window.scrollY is never read. */
export function cursorPayload(
  identity: { distinct_id: string; session_id: string },
  point: PointerLike,
  viewport: { vw: number; vh: number },
  location: { pathname: string; host: string },
): CursorPayload {
  return {
    distinct_id: identity.distinct_id,
    session_id: identity.session_id,
    x: int(point.clientX),
    y: int(point.clientY),
    vw: int(viewport.vw),
    vh: int(viewport.vh),
    page_y: Math.max(0, int(point.pageY - point.clientY)),
    path: safePath(location.pathname),
    host: str(location.host, 253) ?? "",
  };
}

export type LiveCursor = {
  /** Attach the listeners (idempotent). */
  start(): void;
  /** Detach the listeners. */
  stop(): void;
  /** A new page view: restart the 30-minute window (and re-attach if the window had run out). */
  pageView(): void;
  /** Whether the listeners are attached. */
  readonly active: boolean;
};

/**
 * Throttled, fire-and-forget sender. Never throws: every handler swallows errors, because
 * observation must never affect the visitor.
 */
export function createLiveCursor(deps: { win: CursorWindow; doc: CursorDocument; now: () => number }): LiveCursor {
  const { win, doc, now } = deps;
  const passive: AddEventListenerOptions = { passive: true, capture: true };
  let attached = false;
  let pageStart = now();
  let last = -Infinity;
  // Cached on resize so the hot path never reads layout-dependent window properties.
  let viewport = { vw: 0, vh: 0 };

  const readViewport = () => {
    try {
      viewport = { vw: win.innerWidth, vh: win.innerHeight };
    } catch {
      // keep the previous value
    }
  };

  const send = (point: PointerLike) => {
    if (doc.visibilityState !== "visible") return;
    if (cursorPathDenied(win.location.pathname)) return;
    const t = now();
    if (t - pageStart >= MAX_PAGEVIEW_MS) {
      stop();
      return;
    }
    if (t - last < THROTTLE_MS) return;
    const identity = readIdentity(win);
    if (!identity) return;
    const beacon = win.navigator.sendBeacon;
    if (typeof beacon !== "function") return;
    last = t;
    const body = JSON.stringify(cursorPayload(identity, point, viewport, win.location));
    // text/plain keeps the beacon a simple request (no CORS preflight).
    beacon.call(win.navigator, CURSOR_ENDPOINT, new win.Blob([body], { type: "text/plain" }));
  };

  const onMouse: Listener = (event) => {
    try {
      send(event as MouseEvent);
    } catch {
      // Observation must never affect the visitor.
    }
  };
  const onTouch: Listener = (event) => {
    try {
      const touch = (event as TouchEvent).touches?.[0];
      if (touch) send(touch);
    } catch {
      // Observation must never affect the visitor.
    }
  };
  const onResize: Listener = () => readViewport();

  function start() {
    if (attached) return;
    try {
      readViewport();
      doc.addEventListener("mousemove", onMouse, passive);
      doc.addEventListener("touchmove", onTouch, passive);
      win.addEventListener("resize", onResize, { passive: true });
      attached = true;
    } catch {
      stop();
    }
  }

  function stop() {
    attached = false;
    try {
      doc.removeEventListener("mousemove", onMouse, passive);
      doc.removeEventListener("touchmove", onTouch, passive);
      win.removeEventListener("resize", onResize);
    } catch {
      // nothing to undo
    }
  }

  return {
    start,
    stop,
    pageView() {
      pageStart = now();
      last = -Infinity;
      start();
    },
    get active() {
      return attached;
    },
  };
}

/* ------------------------------------------------------------------------------------------------
 * Real-time channel (v2): same-origin batches to /api/oh/cursor, which signs and forwards them to
 * the console at once. Eyepup's read API above only answers after its once-a-minute recorder has
 * written the visitor; this channel needs no recorder, and it covers mobile (touch, taps, scroll).
 * Server half: app/api/oh/cursor/route.ts and lib/oh/cursor-ingest.ts.
 * ---------------------------------------------------------------------------------------------- */


export const CHANNEL_ENDPOINT = "/api/oh/cursor";
/** At most one POST per 500 ms while there are new samples (taps and clicks are sent at once). */
export const FLUSH_MS = 500;
/** The flush interval after the route answers `x-oh-cursor: slow`, for the rest of the page view. */
export const SLOW_FLUSH_MS = 3000;
/** Under `x-oh-cursor: slow`, taps and clicks too leave at most once a second. */
export const SLOW_URGENT_GAP_MS = 1000;
/**
 * Urgent flushes (a tap or a click) at most once per 150 ms: an urgent sample within 150 ms of the
 * last urgent flush rides one flush scheduled 150 ms after it. A touch tap also waits up to 150 ms
 * for the click the browser fires right after it, so a tap and its click leave in one POST. The
 * touch's own samples wait for the tap while one can still happen (500 ms at most): one POST per tap.
 */
export const URGENT_GAP_MS = 150;
/** A touch is a tap when the finger moved under 10 px, lifted within 500 ms and nothing scrolled. */
export const TAP_MAX_MOVE_PX = 10;
export const TAP_MAX_MS = 500;
/** Mouse and finger positions: 15 Hz at most. */
export const MOVE_INTERVAL_MS = 1000 / 15;
/** Window scroll: 10 Hz at most. */
export const SCROLL_INTERVAL_MS = 100;
export const MAX_SAMPLES = 64;
/** A batch never spans more than this; the route rejects larger `t`. */
export const MAX_SAMPLE_T = 60_000;
/** Live requests in flight before a regular flush waits (keeps the keepalive quota free for the final flush). */
export const MAX_INFLIGHT = 2;
/** The route's back-off lever, read from fetch responses (a beacon has none): `on`, `slow` or `off`. */
export const MODE_HEADER = "x-oh-cursor";
export const BATCH_KEYS = ["v", "path", "vw", "vh", "dpr", "pointer", "epoch", "samples"] as const;
export const SAMPLE_KEYS = ["t", "k", "x", "y", "page_y"] as const;

/** `hide` and `show` mark the tab going hidden and visible again (only with the `visibility` option). */
export type SampleKind = "move" | "scroll" | "touch" | "touchend" | "tap" | "click" | "hide" | "show";
export type CursorSample = { t: number; k: SampleKind; x: number; y: number; page_y: number };
export type CursorBatch = {
  v: 1;
  path: string;
  vw: number;
  vh: number;
  dpr: number;
  pointer: "fine" | "coarse";
  epoch: number;
  samples: CursorSample[];
};

export type ChannelWindow = CursorWindow & {
  devicePixelRatio?: number;
  scrollY?: number;
  matchMedia?: (query: string) => { matches: boolean };
  fetch?: typeof fetch;
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
};

type Timers = { set(fn: () => void, ms: number): unknown; clear(id: unknown): void };

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, int(value)));

/** One decimal, within the route's bounds. */
export function roundDpr(value: unknown): number {
  const dpr = typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
  return Math.min(10, Math.max(0.1, Math.round(dpr * 10) / 10));
}

/**
 * A rate gate on a fixed grid: at most one pass per `period` on average, tolerant of frame jitter
 * (a plain "at least 67 ms since the last sample" keeps only every 5th 60 Hz frame, i.e. 12 Hz).
 */
export function rateGate(period: number) {
  let next = -Infinity;
  return {
    pass(t: number): boolean {
      if (t < next - 1) return false;
      next = t - next < period ? next + period : t + period;
      return true;
    },
    /** ms until the next pass is allowed. */
    wait(t: number): number {
      return Math.max(0, next - t);
    },
    reset() {
      next = -Infinity;
    },
  };
}

/** Untrusted (script-dispatched) events are not the visitor. */
const trusted = (event: Event | null | undefined) => !!event && (event as { isTrusted?: boolean }).isTrusted !== false;

/** One finger on the screen, followed from touchstart to touchend to tell a tap from a scroll. */
type Contact = { x: number; y: number; t: number; scroll: number; moved: number; scrolled: boolean };

/**
 * Batched same-origin sender. Captures pointer samples (no element, no text, no form data),
 * flushes at most every 500 ms while there are new samples and promptly on a tap or click (at
 * most one urgent POST per 150 ms), sends nothing while idle or hidden or on an excluded page,
 * honours the route's `x-oh-cursor` back-off answer, and stops 30 minutes into a page view.
 * With `visibility` (the server forwards the kinds: OH_CURSOR_VISIBILITY=on), the tab going hidden
 * adds a `hide` sample to the final beacon and coming back adds a `show` sample on the regular
 * schedule, each at the last pointer position and scroll offset. Never throws.
 */
export function createCursorChannel(deps: {
  win: ChannelWindow;
  doc: CursorDocument;
  now: () => number;
  timers?: Timers;
  visibility?: boolean;
}): LiveCursor {
  const { win, doc, now } = deps;
  const signalVisibility = deps.visibility === true;
  const timers: Timers = deps.timers ?? {
    set: (fn, ms) => win.setTimeout(fn, ms),
    clear: (id) => win.clearTimeout(id),
  };
  const capture: AddEventListenerOptions = { passive: true, capture: true };
  const passive: AddEventListenerOptions = { passive: true };

  let attached = false;
  let pageStart = now();
  /** Bumped on every page view, so a late `x-oh-cursor` answer only affects the view that asked. */
  let viewId = 0;
  let flushMs = FLUSH_MS;
  let urgentGap = URGENT_GAP_MS;
  let view = { vw: 1, vh: 1, dpr: 1 };
  let pointer: "fine" | "coarse" = "fine";
  let batch: { path: string; epoch: number; samples: CursorSample[] } | null = null;
  let lastFlush = -Infinity;
  let lastUrgent = -Infinity;
  const moveGate = rateGate(MOVE_INTERVAL_MS);
  const touchGate = rateGate(MOVE_INTERVAL_MS);
  const scrollGate = rateGate(SCROLL_INTERVAL_MS);
  let lastX = 0;
  let lastY = 0;
  /** The scroll offset of the newest sample on this page view (0 before any): `hide` and `show` reuse it, no layout read. */
  let lastPageY = 0;
  let flushTimer: unknown = null;
  let flushDue = Infinity;
  let flushUrgent = false;
  /** The pending regular flush waits for a possible tap (see holdForTap). */
  let flushHeld = false;
  let scrollTimer: unknown = null;
  let inflight = 0;
  let contact: Contact | null = null;
  let deniedFor: string | null = null;
  let deniedNow = false;

  const guard = (fn: () => void) => {
    try {
      fn();
    } catch {
      // Observation must never affect the visitor.
    }
  };

  const readView = () =>
    guard(() => {
      view = { vw: clamp(win.innerWidth, 1, 16_384), vh: clamp(win.innerHeight, 1, 16_384), dpr: roundDpr(win.devicePixelRatio) };
    });

  const optedOut = () => {
    try {
      const tracker = win.eyepup ?? win.posthog;
      return typeof tracker?.has_opted_out_capturing === "function" && tracker.has_opted_out_capturing() === true;
    } catch {
      return false;
    }
  };

  const visible = () => doc.visibilityState === "visible";

  /** An excluded page (cached per pathname): nothing is captured there. */
  const denied = (raw: string) => {
    if (raw !== deniedFor) {
      deniedFor = raw;
      deniedNow = cursorPathDenied(raw);
    }
    return deniedNow;
  };

  const clearTimer = (id: unknown) => {
    if (id !== null) guard(() => timers.clear(id));
  };

  const clearFlushTimer = () => {
    clearTimer(flushTimer);
    flushTimer = null;
    flushDue = Infinity;
    flushUrgent = false;
    flushHeld = false;
  };

  /**
   * One flush timer. A regular request never moves a pending timer (so a wait for requests in
   * flight is kept); an urgent one moves it earlier, or makes the earlier one urgent.
   */
  function flushAt(at: number, urgent: boolean) {
    if (flushTimer !== null && (!urgent || flushDue <= at)) {
      flushUrgent = flushUrgent || urgent;
      return;
    }
    const keepUrgent = flushTimer !== null && flushUrgent;
    clearTimer(flushTimer);
    flushDue = at;
    flushUrgent = urgent || keepUrgent;
    flushHeld = false;
    flushTimer = timers.set(() => {
      const isUrgent = flushUrgent;
      flushTimer = null;
      flushDue = Infinity;
      flushUrgent = false;
      flushHeld = false;
      guard(() => flush(false, isUrgent));
    }, Math.max(0, at - now()));
  }

  /** The route's back-off answer, for the page view that sent the request. */
  function applyMode(response: unknown, sentIn: number) {
    if (sentIn !== viewId) return;
    const headers = (response as { headers?: { get?: (name: string) => unknown } } | null | undefined)?.headers;
    const mode = typeof headers?.get === "function" ? headers.get(MODE_HEADER) : null;
    if (mode === "off") {
      // Stop for the rest of this page view: drop what is pending, send nothing more.
      batch = null;
      contact = null;
      clearFlushTimer();
      detach();
    } else if (mode === "slow" && flushMs !== SLOW_FLUSH_MS) {
      flushMs = SLOW_FLUSH_MS;
      urgentGap = SLOW_URGENT_GAP_MS;
      // A regular flush already waiting moves to the slow grid (an urgent one keeps its time).
      if (flushTimer !== null && !flushUrgent) {
        clearFlushTimer();
        schedule();
      }
    }
  }

  function transmit(body: string, final: boolean) {
    const beacon = () => {
      try {
        const send = win.navigator.sendBeacon;
        return typeof send === "function" && send.call(win.navigator, CHANNEL_ENDPOINT, new win.Blob([body], { type: "application/json" })) === true;
      } catch {
        return false; // some engines refuse non-safelisted Blob types: fall back to fetch
      }
    };
    const post = () => {
      try {
        const f = win.fetch;
        if (typeof f !== "function") return false;
        const pending = f.call(win, CHANNEL_ENDPOINT, {
          method: "POST",
          body,
          keepalive: true,
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
        });
        inflight++;
        const sentIn = viewId;
        const done = () => {
          inflight = Math.max(0, inflight - 1);
        };
        Promise.resolve(pending).then(
          (response) => {
            done();
            guard(() => applyMode(response, sentIn));
          },
          done,
        );
        return true;
      } catch {
        return false;
      }
    };
    // The final flush (hidden, pagehide) must survive the page: the beacon first. Otherwise fetch
    // keepalive first, so a failed beacon quota never drops a live batch.
    if (final) {
      if (!beacon()) post();
    } else if (!post()) beacon();
  }

  /** final: the page is going away (beacon first). urgent: sent even when requests are in flight. */
  function flush(final: boolean, urgent = false) {
    clearFlushTimer();
    if (!batch || batch.samples.length === 0) return;
    if (optedOut()) {
      batch = null;
      return;
    }
    if (!final && !urgent && inflight >= MAX_INFLIGHT) {
      schedule(flushMs); // the network is slow: try again later, keeping the newest samples
      return;
    }
    const out: CursorBatch = {
      v: 1,
      path: batch.path,
      vw: view.vw,
      vh: view.vh,
      dpr: view.dpr,
      pointer,
      epoch: batch.epoch,
      samples: batch.samples,
    };
    batch = null;
    lastFlush = now();
    if (urgent) lastUrgent = lastFlush;
    transmit(JSON.stringify(out), final);
  }

  function schedule(minimum = 0) {
    const t = now();
    const at = Math.max(t + minimum, lastFlush + flushMs, t);
    // The held touch is no tap after all: stop waiting for one.
    if (flushHeld && flushTimer !== null && !flushUrgent && at < flushDue) clearFlushTimer();
    flushAt(at, false);
  }

  /** A one-finger touch that can still become a tap. */
  const tapPossible = (t: number) =>
    contact !== null && !contact.scrolled && contact.moved < TAP_MAX_MOVE_PX && t - contact.t < TAP_MAX_MS;

  /**
   * While a touch can still become a tap, its samples wait for it (500 ms after touchstart at most),
   * so the touch, the tap and its click leave in one POST. A flush already due takes them as it is.
   */
  function holdForTap(start: number) {
    if (flushTimer !== null) return;
    flushAt(Math.max(start + TAP_MAX_MS, lastFlush + flushMs), false);
    flushHeld = true;
  }

  /** A click (or a tap whose click never came): at once, unless an urgent POST left under 150 ms ago. */
  function urgentFlush(t: number) {
    if (t - lastUrgent < urgentGap) flushAt(lastUrgent + urgentGap, true);
    else flush(false, true);
  }

  function record(k: SampleKind, x: number, y: number, pageY: number, t: number) {
    if (t - pageStart >= MAX_PAGEVIEW_MS) {
      expire();
      return;
    }
    const raw = win.location.pathname;
    const path = safePath(raw);
    // A batch holds one page: when the path changed, the old page's samples leave first.
    if (batch && batch.path !== path) flush(false, true);
    if (batch && batch.path !== path) batch = null;
    if (denied(raw)) return;
    if (batch && t - batch.epoch > MAX_SAMPLE_T) flush(false);
    if (batch && t - batch.epoch > MAX_SAMPLE_T) batch = null; // could not send: drop rather than overflow `t`
    if (!batch) batch = { path, epoch: t, samples: [] };
    if (batch.samples.length >= MAX_SAMPLES) batch.samples.shift(); // full and waiting: keep the newest
    const sx = clamp(x, 0, 16_384);
    const sy = clamp(y, 0, 16_384);
    if (k !== "scroll" && k !== "hide" && k !== "show") {
      lastX = sx;
      lastY = sy;
    }
    lastPageY = clamp(pageY, 0, 1_000_000);
    batch.samples.push({ t: clamp(t - batch.epoch, 0, MAX_SAMPLE_T), k, x: sx, y: sy, page_y: lastPageY });
    if (k === "click") urgentFlush(t);
    else if (k === "tap") flushAt(t + urgentGap, true); // its click normally follows within ms and sends both at once
    else if (batch.samples.length >= MAX_SAMPLES) flush(false);
    else if (contact !== null && tapPossible(t)) holdForTap(contact.t);
    else schedule();
  }

  /** Scroll offset from the event itself (pageY - clientY): no layout read. */
  const point = (k: SampleKind, p: PointerLike | null | undefined, t: number) => {
    if (p) record(k, p.clientX, p.clientY, p.pageY - p.clientY, t);
  };

  const onMouseMove: Listener = (event) =>
    guard(() => {
      if (!visible() || !trusted(event)) return;
      const t = now();
      if (moveGate.pass(t)) point("move", event as MouseEvent, t);
    });

  const distance = (c: Contact, p: PointerLike) => Math.hypot(p.clientX - c.x, p.clientY - c.y);

  const onTouch = (kind: "start" | "move" | "end"): Listener => (event) =>
    guard(() => {
      if (!visible() || !trusted(event)) return;
      const t = now();
      const touches = event as TouchEvent;
      const down = touches.touches?.length ?? 0;
      if (kind === "end") {
        const p = touches.changedTouches?.[0];
        const c = contact;
        // A tap: one finger, under 10 px of travel, under 500 ms, and no scroll in between.
        const tap = c !== null && p != null && down === 0 && !c.scrolled && t - c.t < TAP_MAX_MS && Math.max(c.moved, distance(c, p)) < TAP_MAX_MOVE_PX && Math.abs(p.pageY - p.clientY - c.scroll) < 1;
        // No tap: the contact ends first, so the touchend sample releases a flush held for one.
        if (down === 0 && !tap) contact = null;
        point("touchend", p, t);
        if (tap) point("tap", p, t);
        if (down === 0) contact = null;
        return;
      }
      const first = touches.touches?.[0] ?? touches.changedTouches?.[0];
      if (kind === "start") {
        // A second finger (pinch, two-finger scroll) is never a tap.
        contact = first && down <= 1 ? { x: first.clientX, y: first.clientY, t, scroll: first.pageY - first.clientY, moved: 0, scrolled: false } : null;
        touchGate.reset(); // touchstart always passes (and restarts the grid)
      } else if (contact) {
        if (down > 1) contact = null;
        else if (first) contact.moved = Math.max(contact.moved, distance(contact, first));
      }
      // touchmove at 15 Hz.
      if (touchGate.pass(t)) point("touch", first, t);
    });
  const onTouchStart = onTouch("start");
  const onTouchMove = onTouch("move");
  const onTouchEnd = onTouch("end");
  const onTouchCancel: Listener = () => {
    contact = null;
  };

  const onClick: Listener = (event) =>
    guard(() => {
      if (!visible() || !trusted(event)) return;
      // detail 0: a keyboard or programmatic click, whose coordinates are not a pointer position.
      if ((event as MouseEvent).detail === 0) return;
      point("click", event as MouseEvent, now());
    });

  // The only layout-dependent read (scrollY), and only here, at 10 Hz at most.
  const sampleScroll = (t: number) => {
    if (denied(win.location.pathname)) return;
    record("scroll", lastX, lastY, Number(win.scrollY) || 0, t);
  };

  const onScroll: Listener = () =>
    guard(() => {
      if (contact) contact.scrolled = true; // a finger that scrolled the page is not a tap
      if (!visible()) return;
      const t = now();
      if (scrollTimer === null && scrollGate.pass(t)) sampleScroll(t);
      else if (scrollTimer === null) {
        // Trailing sample, so the position where the scroll stopped is always sent.
        scrollTimer = timers.set(() => {
          scrollTimer = null;
          guard(() => {
            const at = now();
            if (visible() && scrollGate.pass(at)) sampleScroll(at);
          });
        }, scrollGate.wait(t));
      }
    });

  /**
   * A tab visibility change, as a sample at the last pointer position and scroll offset: only with
   * the `visibility` option, never on an excluded page (record() returns early there) and never
   * after the page view's 30 minutes (the pending samples still leave on the final flush).
   */
  const visibilitySample = (k: "hide" | "show") =>
    guard(() => {
      if (!signalVisibility) return;
      const t = now();
      if (t - pageStart >= MAX_PAGEVIEW_MS) return;
      // A batch too old to take another sample leaves by beacon first: record() would drop it while
      // requests are stuck in flight, and the hide flush below used to carry it.
      if (batch && t - batch.epoch > MAX_SAMPLE_T) flush(true);
      record(k, lastX, lastY, lastPageY, t);
    });

  const onVisibility: Listener = () =>
    guard(() => {
      if (visible()) {
        readView();
        visibilitySample("show"); // sent on the regular schedule
      } else {
        clearTimer(scrollTimer);
        scrollTimer = null;
        contact = null;
        visibilitySample("hide"); // rides the final beacon below
        flush(true);
      }
    });
  const onPageHide: Listener = () => guard(() => flush(true));
  const onResize: Listener = () => readView();

  // No pointerdown: a touch scroll starts with one, and a mouse press is followed by its click.
  const docListeners: Array<[string, Listener, AddEventListenerOptions]> = [
    ["mousemove", onMouseMove, capture],
    ["touchstart", onTouchStart, capture],
    ["touchmove", onTouchMove, capture],
    ["touchend", onTouchEnd, capture],
    ["touchcancel", onTouchCancel, capture],
    ["click", onClick, capture],
    ["visibilitychange", onVisibility, passive],
  ];
  const winListeners: Array<[string, Listener, AddEventListenerOptions]> = [
    ["scroll", onScroll, passive],
    ["resize", onResize, passive],
    ["pagehide", onPageHide, passive],
  ];

  function detach() {
    attached = false;
    clearTimer(scrollTimer);
    scrollTimer = null;
    guard(() => {
      for (const [type, fn, options] of docListeners) doc.removeEventListener(type, fn, options);
      for (const [type, fn, options] of winListeners) win.removeEventListener(type, fn, options);
    });
  }

  /** 30 minutes into a page view: send what is pending, then stop listening. */
  function expire() {
    flush(false);
    detach();
  }

  function start() {
    if (attached) return;
    try {
      readView();
      pointer = typeof win.matchMedia === "function" && win.matchMedia("(pointer: coarse)").matches ? "coarse" : "fine";
      for (const [type, fn, options] of docListeners) doc.addEventListener(type, fn, options);
      for (const [type, fn, options] of winListeners) win.addEventListener(type, fn, options);
      attached = true;
    } catch {
      detach();
    }
  }

  return {
    start,
    stop() {
      guard(() => flush(true));
      detach();
    },
    pageView() {
      // The previous page's samples leave now, even with requests in flight.
      guard(() => flush(false, true));
      viewId++;
      flushMs = FLUSH_MS;
      urgentGap = URGENT_GAP_MS;
      contact = null;
      lastPageY = 0; // a new page: the old page's scroll offset no longer applies
      pageStart = now();
      moveGate.reset();
      touchGate.reset();
      scrollGate.reset();
      start();
    },
    get active() {
      return attached;
    },
  };
}
