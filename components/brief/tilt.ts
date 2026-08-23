'use client';

/**
 * THE CARD TILT — the deck's front card turns toward the pointer.
 *
 * ==================================================================
 * THIS IS NOT A NEW MOTION MODEL
 * ==================================================================
 * It is the one already in the product, in `components/artifact/Artifact3D.tsx`
 * and `components/artifact/FramedPoster.tsx`: three just-overdamped springs —
 * horizontal deflection, vertical deflection, lift — integrated in ONE rAF
 * loop at a fixed substep and written to a stage element as CSS custom
 * properties, which the stylesheet turns into the rotation, the shadow's
 * counter-movement and the depth. React state is never touched during a
 * gesture, so the deck does not re-render while a card is turning.
 *
 * The constants are Artifact3D's, unchanged:
 *
 *     c_crit = 2 * sqrt(260) = 32.25; running the damper at 34 gives
 *     zeta = 1.05 — just overdamped, so the value approaches its target and
 *     provably never crosses it. The house motion rules forbid a bounce and
 *     this cannot produce one. 266ms to 90% of a step, ~780ms to full rest.
 *
 * Integrated at a fixed 1/120 s substep, so the curve is identical on a 30Hz,
 * 60Hz and 120Hz display and a long frame — a tab returning to the
 * foreground — cannot blow the integrator up.
 *
 * WHY IT IS A COPY AND NOT AN IMPORT. `bind()` in Artifact3D is welded to
 * that component's own three custom properties and its own CSS-module class
 * for `will-change`, and `components/artifact/**` is not this agent's to
 * change. Lifting the integrator into a shared module is the right refactor
 * and it is a change to a file this work does not own. What is duplicated is
 * forty lines of arithmetic with the constants stated once at the top; what
 * is NOT duplicated is a second, different feel — which is the thing that
 * actually matters.
 *
 * ==================================================================
 * WHAT IT DOES NOT DO — the same discipline, for the same reasons
 * ==================================================================
 * · `prefers-reduced-motion: reduce`: NO LISTENER IS BOUND AT ALL. The card
 *   sits flat on its resting shadow and nothing ever moves.
 * · Coarse pointers: no `pointermove` is bound, because there is no hover to
 *   track. Artifact3D plays a single press-settle there; this does not, and
 *   that is the one deliberate difference — a brief card is a SHEET YOU
 *   SCROLL WITH YOUR THUMB, and a card that dips every time a finger lands on
 *   it to read it would be reacting to the reading, not to an intent.
 * · Both queries are watched, so a reader who plugs in a mouse or turns
 *   reduced motion on mid-session gets the right behaviour with no reload.
 */

/* --- Spring ------------------------------------------------------------ */

const STIFFNESS = 260;
const DAMPING = 34;
const SUBSTEP = 1 / 120;
const MAX_SUBSTEPS = 8;

/** Settled = within half a thousandth of target with no meaningful velocity. */
const EPSILON = 5e-4;
const EPSILON_V = 5e-3;

type Spring = { value: number; velocity: number; target: number };

function spring(): Spring {
  return { value: 0, velocity: 0, target: 0 };
}

function advance(s: Spring, dt: number) {
  const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(dt / SUBSTEP)));
  const h = dt / steps;
  for (let i = 0; i < steps; i += 1) {
    // Semi-implicit Euler: acceleration from the current offset, then the
    // position from the *new* velocity. Stable at these constants.
    const accel = (s.target - s.value) * STIFFNESS - s.velocity * DAMPING;
    s.velocity += accel * h;
    s.value += s.velocity * h;
  }
}

function settled(s: Spring) {
  return Math.abs(s.target - s.value) < EPSILON && Math.abs(s.velocity) < EPSILON_V;
}

/* --- Public entry ------------------------------------------------------ */

/**
 * Turns `stage` toward the pointer for as long as the returned teardown has
 * not been called. Writes `--bd-nx`, `--bd-ny` and `--bd-lift` on `stage`;
 * `brief.module.css` is the only reader of those three.
 *
 * @param stage       the element the pointer is measured against AND the
 *                    element the three channels are written to. In the deck
 *                    that is the slide, which is also the perspective host.
 * @param activeClass toggled on `stage` while the loop is running, so an
 *                    idle deck holds no promoted compositor layers.
 */
export function bindCardTilt(stage: HTMLElement, activeClass: string): () => void {
  const fineQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let detach: (() => void) | null = null;

  const sync = () => {
    detach?.();
    detach = bind(stage, activeClass, fineQuery.matches, reduceQuery.matches);
  };

  sync();
  fineQuery.addEventListener('change', sync);
  reduceQuery.addEventListener('change', sync);

  return () => {
    fineQuery.removeEventListener('change', sync);
    reduceQuery.removeEventListener('change', sync);
    detach?.();
  };
}

/**
 * Attaches the interaction for one input mode and returns its teardown.
 * Split out so each branch reads as a whole.
 */
function bind(
  stage: HTMLElement,
  activeClass: string,
  fine: boolean,
  reduced: boolean,
): () => void {
  const rest = () => {
    stage.style.removeProperty('--bd-nx');
    stage.style.removeProperty('--bd-ny');
    stage.style.removeProperty('--bd-lift');
    stage.classList.remove(activeClass);
  };

  // Reduced motion, and every coarse pointer: the resting state is the only
  // state, and not one listener is bound.
  if (reduced || !fine) {
    rest();
    return rest;
  }

  const nx = spring();
  const ny = spring();
  const lift = spring();
  const springs = [nx, ny, lift];

  let raf = 0;
  let last = 0;

  const write = () => {
    stage.style.setProperty('--bd-nx', nx.value.toFixed(4));
    stage.style.setProperty('--bd-ny', ny.value.toFixed(4));
    stage.style.setProperty('--bd-lift', lift.value.toFixed(4));
  };

  const stop = () => {
    raf = 0;
    for (const s of springs) {
      s.value = s.target;
      s.velocity = 0;
    }
    write();
    stage.classList.remove(activeClass);
  };

  const tick = (now: number) => {
    // Clamp: a backgrounded tab hands back a multi-second delta.
    const dt = Math.min(0.064, Math.max(0.001, (now - last) / 1000));
    last = now;
    for (const s of springs) advance(s, dt);
    write();

    if (springs.every(settled)) {
      stop();
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  const run = () => {
    if (raf) return;
    last = performance.now();
    stage.classList.add(activeClass);
    raf = requestAnimationFrame(tick);
  };

  // The rect is read on enter and re-read only when the page has moved under
  // the pointer. Measuring inside pointermove would force a layout on every
  // one of ~120 events a second.
  let rect: DOMRect | null = null;
  let stale = true;

  const invalidate = () => {
    stale = true;
  };

  const move = (event: PointerEvent) => {
    if (stale || !rect) {
      rect = stage.getBoundingClientRect();
      stale = false;
    }
    // Normalised offset from centre, clamped to the card's own extent so a
    // pointer arriving at a corner cannot exceed full deflection.
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    nx.target = Math.max(-1, Math.min(1, x));
    ny.target = Math.max(-1, Math.min(1, y));
    lift.target = 1;
    run();
  };

  const enter = () => {
    invalidate();
  };

  const leave = () => {
    nx.target = 0;
    ny.target = 0;
    lift.target = 0;
    run();
  };

  stage.addEventListener('pointerenter', enter, { passive: true });
  stage.addEventListener('pointermove', move, { passive: true });
  stage.addEventListener('pointerleave', leave, { passive: true });
  window.addEventListener('resize', invalidate, { passive: true });
  // The deck is a dialog over a locked page, so the only thing that moves the
  // card under the pointer is the card's OWN body scrolling. Captured, so a
  // scroll inside the card invalidates the rect the same way a resize does.
  stage.addEventListener('scroll', invalidate, { passive: true, capture: true });

  return () => {
    stage.removeEventListener('pointerenter', enter);
    stage.removeEventListener('pointermove', move);
    stage.removeEventListener('pointerleave', leave);
    window.removeEventListener('resize', invalidate);
    stage.removeEventListener('scroll', invalidate, { capture: true });
    if (raf) cancelAnimationFrame(raf);
    rest();
  };
}
