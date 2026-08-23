'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './framedposter.module.css';

/**
 * THE PRINT, FRAMED — the deliverable as an object hanging on a wall.
 *
 * The mission poster is not a picture on the page, it is a physical thing the
 * customer will receive: a print behind a slim brushed-aluminium moulding,
 * mounted proud of a wall. This component builds that object in CSS — no
 * bitmap frame, no mockup photograph — and turns it toward the pointer with
 * enough damping that it reads as something heavy.
 *
 * ------------------------------------------------------------------------
 * THE FRAME
 * ------------------------------------------------------------------------
 * Four mitred rails, each a separate element with a 45 degree `clip-path`, so
 * the corners meet on a real mitre the way an extruded moulding does. Each
 * rail carries two stacked gradients:
 *
 *   1. a cross-profile gradient running *across* the rail's width, which is
 *      what makes it read as an extruded profile rather than a border: the
 *      outer roll-over catches light, the face falls away, the inner lip
 *      turns down into the rabbet;
 *   2. a brushed grain running *along* the rail — horizontal on the top and
 *      bottom rails, vertical on the sides, because that is how a milled
 *      aluminium length is finished.
 *
 * The four rails are not the same value. The light is up and to the left, so
 * the top and left rails sit bright and the bottom and right rails sit dark;
 * a 1px lit/shadowed outline over the whole moulding closes the extrusion. A
 * grey border has none of this and reads flat immediately.
 *
 * The print sits in the rabbet, *below* the frame face, so an inner shadow
 * falls across its edges — deepest at the top where the moulding overhangs
 * it. That inner shadow is the only thing drawn onto the photograph. The
 * print is a matte inkjet surface: no gloss, no sweep, no glare, ever. Only
 * the aluminium is specular, and its highlight is physically prevented from
 * reaching the print — the specular layer is painted *underneath* the opaque
 * print, so no mask is required and none can fail.
 *
 * ------------------------------------------------------------------------
 * THE SHADOW  (see framedposter.module.css for the arithmetic)
 * ------------------------------------------------------------------------
 * A wall shadow, not a contact shadow: dropped, spread and mostly penumbra,
 * so it is much lighter than an object resting on a surface. Every term is a
 * `cqw` — a percentage of the frame's own width — so the cast is identical at
 * 300px and at 1200px with no measurement and no resize handler.
 *
 * ------------------------------------------------------------------------
 * THE MOTION
 * ------------------------------------------------------------------------
 * Three just-overdamped springs (horizontal deflection, vertical deflection,
 * lift) are integrated in one rAF loop and written to the stage as CSS custom
 * properties. React state is never touched during a gesture: the component
 * renders once and then never re-renders. The stylesheet turns those three
 * numbers into the rotation, the shadow's counter-movement and the specular's
 * travel, so all three agree by construction.
 *
 * The pointer is a *target*, never the value. A 1:1 mapping arrives instantly
 * and stops dead, which is what makes a cheap tilt feel like paper. This is a
 * big framed object, so it is tuned heavier and slower than the small
 * artifacts (Artifact3D) — softer spring, longer settle, less rotation.
 *
 * ------------------------------------------------------------------------
 * WHAT IT DOES NOT DO
 * ------------------------------------------------------------------------
 * - `prefers-reduced-motion: reduce`: no listener is attached at all. Static
 *   frame, resting shadow, no specular, no parallax. Nothing moves, ever.
 * - Coarse pointers: no `pointermove` listener is ever bound, because there
 *   is no hover to track. A tap plays one gentle settle — the frame presses
 *   toward the wall and springs back — and that is all.
 */

/* --- Spring ------------------------------------------------------------
   c_crit = 2 * sqrt(k) = 2 * sqrt(150) = 24.495. Running the damper at 26
   gives zeta = 1.061: just overdamped, so the value approaches its target
   and provably never crosses it. The house motion rules forbid a bounce and
   this cannot produce one.

   Measured (fixed-step integration of a unit step):
       90 % of the step   350 ms
       99 % of the step   642 ms
       full rest          1.02 s
       peak overshoot     0.0000 % (measured -0.0000, i.e. never crosses)

   That is deliberately slower than Artifact3D's 267 ms. The patch and the
   coin are palm-sized; this is a framed print with glass in it, and a heavy
   object that snaps to the cursor stops being heavy.

   Integrated at a fixed 1/120 s substep so the curve is identical on a 30Hz,
   60Hz or 120Hz display, and a long frame — a tab returning to the
   foreground — cannot blow the integrator up. */
const STIFFNESS = 150;
const DAMPING = 26;
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

/** `3:4`, `3 / 4`, `7:10` -> `[3, 4]`. Anything unreadable falls back to 3:4,
 *  which is the house print proportion. */
function parseRatio(ratio: string | undefined): [number, number] {
  const m = ratio?.match(/^\s*(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)\s*$/);
  if (!m) return [3, 4];
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? [w, h] : [3, 4];
}

/** Four decimals is well past a subpixel at any plausible render size, and
 *  keeps the server and client strings byte-identical. */
function round(n: number): string {
  return String(Number(n.toFixed(4)));
}

export type FramedPosterProps = {
  /**
   * The poster image. `/api/poster/{code}` in production.
   *
   * Optional only because a composed poster — one built out of DOM rather
   * than fetched as a raster, e.g. `<PosterPreview />` — passes `children`
   * instead. Exactly one of the two is required; see the runtime note on
   * the `children` prop.
   */
  src?: string;
  /** Required with `src`. Ignored when `children` carries its own labelling. */
  alt?: string;
  /**
   * A poster composed in DOM, rendered into the rabbet in place of `<img>`.
   *
   * The window is already the print's proportion by construction, so
   * children get a plain 100% x 100% box and do not need to restate the
   * ratio. Whatever is passed must be OPAQUE: the specular layer is painted
   * underneath the print precisely so the highlight is occluded rather than
   * masked, and a translucent child would let the aluminium's travelling
   * beam show through the photograph.
   */
  children?: ReactNode;
  /**
   * Which moulding. Default `aluminium`.
   *
   * `wood` is the black wood + plexiglass profile that
   * `lib/integrations/gelato.ts` actually orders, and it belongs on any
   * surface depicting a specific customer's framed order. Aluminium is the
   * presentation moulding used everywhere the frame is scene-setting.
   */
  moulding?: 'aluminium' | 'wood';
  /** Print proportion, `w:h` or `w / h`. Default `3:4`. */
  ratio?: string;
  /**
   * The frame's size along its sizing axis. A number is px; a string is used
   * verbatim, so `100%`, `86%` and `42rem` all work. Default `100%`.
   */
  size?: number | string;
  /**
   * `width` (default) sizes the object by its width and lets the height
   * follow. `height` does the reverse, which is what a fixed-height wall band
   * needs — the frame then fits the band instead of overflowing it.
   */
  fit?: 'width' | 'height';
  /**
   * Peak rotation in degrees at full pointer deflection. 8-12 is the range
   * for an object this size: enough to show the moulding's depth, little
   * enough that it still reads as heavy. Vertical rotation is taken at 0.8x
   * of this, because the print is taller than it is wide and equal degrees
   * about the long axis look like a wobble.
   */
  tilt?: number;
  /** Skip lazy-loading for a frame that is above the fold. */
  priority?: boolean;
  className?: string;
};

export function FramedPoster({
  src,
  alt,
  children,
  moulding = 'aluminium',
  ratio,
  size = '100%',
  fit = 'width',
  tilt = 10,
  priority = false,
  className,
}: FramedPosterProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const stage = stageRef.current;
    if (!frame || !stage) return;

    const fineQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    let detach: (() => void) | null = null;

    /** Binds the behaviour appropriate to the current input and preference.
     *  Re-run whenever either changes — a user plugging in a mouse, or turning
     *  reduced motion on, gets the right behaviour without a reload. */
    const sync = () => {
      detach?.();
      detach = bind(frame, stage, fineQuery.matches, reduceQuery.matches);
    };

    sync();
    fineQuery.addEventListener('change', sync);
    reduceQuery.addEventListener('change', sync);

    return () => {
      fineQuery.removeEventListener('change', sync);
      reduceQuery.removeEventListener('change', sync);
      detach?.();
    };
  }, []);

  const [rw, rh] = parseRatio(ratio);

  const style = {
    '--fp-size': typeof size === 'number' ? `${Math.round(size)}px` : size,
    '--fp-rw': round(rw),
    '--fp-rh': round(rh),
    '--fp-tilt': `${round(tilt)}deg`,
  } as CSSProperties;

  return (
    <div
      className={cn(
        styles.root,
        fit === 'height' && styles.fitHeight,
        moulding === 'wood' && styles.wood,
        className,
      )}
      style={style}
    >
      <div ref={frameRef} className={styles.frame}>
        <div ref={stageRef} className={styles.stage}>
          {/* The wall shadow. Two nested elements on purpose: the outer one is
              transformed every frame, the inner one carries the blur, so the
              browser rasterises the Gaussian once and then moves it on the
              compositor instead of re-running it per frame. */}
          <div className={styles.shadowWrap} aria-hidden>
            <div className={styles.shadow} />
          </div>

          <div className={styles.object}>
            {/* Specular first, so the opaque print paints over it. This is
                what keeps the highlight on the aluminium and off the
                photograph — occlusion, not a mask that could fail. */}
            <span className={styles.spec} aria-hidden>
              <span className={styles.specBeam} />
            </span>

            {/* Four mitred rails: the moulding. */}
            <span className={cn(styles.rail, styles.railTop)} aria-hidden />
            <span className={cn(styles.rail, styles.railBottom)} aria-hidden />
            <span className={cn(styles.rail, styles.railLeft)} aria-hidden />
            <span className={cn(styles.rail, styles.railRight)} aria-hidden />

            {/* The 1px lit/shadowed outline that closes the extrusion. */}
            <span className={styles.edges} aria-hidden />

            <div className={styles.window}>
              {children ?? (
                /* Plain <img>: the src is an API route that already emits a
                   sized, watermarked WebP/PNG, so next/image would re-encode a
                   render it does not improve. */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={src}
                  alt={alt ?? ''}
                  className={styles.print}
                  draggable={false}
                  loading={priority ? 'eager' : 'lazy'}
                  decoding="async"
                  {...(priority ? { fetchPriority: 'high' as const } : null)}
                />
              )}
              {/* The rabbet: the print sits below the frame face, so the
                  moulding shadows its edges. The only mark on the print. */}
              <span className={styles.rabbet} aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Attaches the interaction for one input mode and returns its teardown.
 *
 * Split out of the component so each branch reads as a whole: reduced motion
 * binds nothing, coarse pointers bind press only, fine pointers bind the tilt.
 */
function bind(
  frame: HTMLElement,
  stage: HTMLElement,
  fine: boolean,
  reduced: boolean,
): () => void {
  // Reduced motion: the resting state is the only state.
  if (reduced) {
    stage.style.removeProperty('--fp-nx');
    stage.style.removeProperty('--fp-ny');
    stage.style.removeProperty('--fp-lift');
    stage.classList.remove(styles.active);
    return () => {};
  }

  const nx = spring();
  const ny = spring();
  const lift = spring();
  const springs = [nx, ny, lift];

  let raf = 0;
  let last = 0;

  const write = () => {
    stage.style.setProperty('--fp-nx', nx.value.toFixed(4));
    stage.style.setProperty('--fp-ny', ny.value.toFixed(4));
    stage.style.setProperty('--fp-lift', lift.value.toFixed(4));
  };

  const stop = () => {
    raf = 0;
    for (const s of springs) {
      s.value = s.target;
      s.velocity = 0;
    }
    write();
    // will-change is carried by .active, so an idle page holds no promoted
    // layers.
    stage.classList.remove(styles.active);
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
    stage.classList.add(styles.active);
    raf = requestAnimationFrame(tick);
  };

  // --- Coarse pointers ---------------------------------------------------
  // No hover exists, so no pointermove is bound. A press eases the frame back
  // toward the wall and the spring returns it: one settle, no tilt.
  if (!fine) {
    const down = () => {
      lift.target = -1;
      run();
    };
    const up = () => {
      lift.target = 0;
      run();
    };

    frame.addEventListener('pointerdown', down, { passive: true });
    frame.addEventListener('pointerup', up, { passive: true });
    frame.addEventListener('pointercancel', up, { passive: true });

    return () => {
      frame.removeEventListener('pointerdown', down);
      frame.removeEventListener('pointerup', up);
      frame.removeEventListener('pointercancel', up);
      if (raf) cancelAnimationFrame(raf);
      stage.classList.remove(styles.active);
    };
  }

  // --- Fine pointers -----------------------------------------------------
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
      rect = frame.getBoundingClientRect();
      stale = false;
    }
    // Normalised offset from centre, clamped to the frame's own extent so a
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
    window.addEventListener('scroll', invalidate, { passive: true, capture: true });
  };

  const leave = () => {
    window.removeEventListener('scroll', invalidate, { capture: true });
    nx.target = 0;
    ny.target = 0;
    lift.target = 0;
    run();
  };

  frame.addEventListener('pointerenter', enter, { passive: true });
  frame.addEventListener('pointermove', move, { passive: true });
  frame.addEventListener('pointerleave', leave, { passive: true });
  window.addEventListener('resize', invalidate, { passive: true });

  return () => {
    frame.removeEventListener('pointerenter', enter);
    frame.removeEventListener('pointermove', move);
    frame.removeEventListener('pointerleave', leave);
    window.removeEventListener('resize', invalidate);
    window.removeEventListener('scroll', invalidate, { capture: true });
    if (raf) cancelAnimationFrame(raf);
    stage.classList.remove(styles.active);
  };
}
