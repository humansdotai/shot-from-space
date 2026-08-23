'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './artifact3d.module.css';

/**
 * A physical object on a page, not a picture of one.
 *
 * The patch and the coin are DEPICTIONS of objects — the distinctions are
 * digital and nothing here is manufactured, packed or posted. This component
 * is still built as if they were physical, and deliberately: a badge that
 * turns under the pointer and casts a real shadow reads as a RENDER of a
 * thing, which is what it is. Do not let this rationale drift back into
 * "things a customer will hold" — it said that, and the site shipped a
 * promise of a parcel it was never going to send. Presenting them
 * as flat art inside a bordered plate throws that away, so this component
 * removes the plate entirely: the object sits directly on the page ground,
 * carries a shape-accurate cast shadow, and rotates toward the pointer with
 * enough damping to read as mass.
 *
 * ------------------------------------------------------------------------
 * HOW THE MOTION WORKS
 * ------------------------------------------------------------------------
 * Three just-overdamped springs -- horizontal deflection, vertical
 * deflection, and lift -- are integrated in one rAF loop and written to the
 * stage as CSS custom properties. React state is never touched during a
 * gesture; the component renders once and then never re-renders. The CSS
 * (artifact3d.module.css) turns those three numbers into the object's
 * rotation, the shadow's counter-movement and the specular's travel, so all
 * three stay in agreement by construction.
 *
 * The pointer is a *target*, never the value. Mapping rotation straight to
 * the cursor is the tell of a cheap tilt effect: it arrives instantly, stops
 * dead, and feels like paper. A spring gives the object weight -- it lags
 * into the turn and coasts to a stop -- while an overdamped ratio guarantees
 * it never overshoots, which the house motion rules forbid.
 *
 * ------------------------------------------------------------------------
 * WHAT IT DOES NOT DO
 * ------------------------------------------------------------------------
 * - `prefers-reduced-motion: reduce`: no listeners are attached at all. The
 *   object renders flat with its resting shadow. Nothing moves, ever.
 * - Coarse pointers: no `pointermove` listener is ever bound, because there
 *   is no hover to track. A press plays a single settle -- the object dips
 *   onto its shadow and comes back -- and that is all.
 */

/* --- Spring ------------------------------------------------------------
   c_crit = 2 * sqrt(k) = 2 * sqrt(260) = 32.25. Running the damper above
   that (34, so zeta = 1.05) puts the system just into overdamped, which is
   the difference between "weighty" and "bouncy": measured overshoot is
   -0.04 %, i.e. the value approaches the target and never crosses it. The
   house rules forbid a bounce and this cannot produce one.

   Response is 266 ms to 90 % of a step and ~780 ms to full rest -- enough
   lag that the object is felt to have mass, short enough that it still
   tracks a moving cursor.

   Integrated at a fixed 1/120 s substep, so the curve is identical on a
   30Hz, 60Hz and 120Hz display (measured: 266 ms to 90 % on all three) and
   a long frame -- a tab returning to the foreground -- cannot blow the
   integrator up. */
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

export type Artifact3DProps = {
  /** The artwork. Used three times -- object, shadow, specular mask -- as one
   *  identical URL, so the browser fetches it once. */
  src: string;
  alt: string;
  /** Rendered square edge in px. Omitted, the object fills its column. */
  size?: number;
  /** Uppercase micro-label above the caption. */
  label?: ReactNode;
  /** One or two lines under the object. */
  caption?: ReactNode;
  /** Peak tilt in degrees at full pointer deflection. 12-16 is the range
   *  where the rotation reads as depth rather than as a wobble. */
  tilt?: number;
  /** Scales the artwork inside its square, for assets whose subject does not
   *  fill the canvas. Purely optical -- the shadow geometry stays tied to the
   *  square, which is what the client's specification is measured against. */
  artScale?: number;
  /** `contact` sits on a surface; `wall` is mounted proud of a wall. */
  surface?: 'contact' | 'wall';
  /** `textile` is matte (no specular); `metal` travels a highlight. */
  material?: 'textile' | 'metal';
  /** Skip lazy-loading for an object that is above the fold. */
  priority?: boolean;
  className?: string;
};

export function Artifact3D({
  src,
  alt,
  size,
  label,
  caption,
  tilt = 14,
  artScale = 1,
  surface = 'contact',
  material = 'textile',
  priority = false,
  className,
}: Artifact3DProps) {
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
     *  Re-run whenever either changes -- a user plugging in a mouse, or
     *  turning reduced motion on, gets the right behaviour without a reload. */
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

  /**
   * Only a struck or polished surface travels a highlight, so
   * artifact3d.module.css ships `--a3d-spec: 0` and only `.gloss`
   * (material="metal") raises it. On every other material the specular
   * layer's opacity is `lift * 0.85 * 0` — permanently zero, invisible on
   * every device and in every state.
   *
   * Its `mask-image` was still costing a full-resolution download of the
   * artwork, and a CSS mask is a background resource: it is fetched the
   * moment the rule matches and neither `loading="lazy"` nor an
   * IntersectionObserver can defer it. Measured on an emulated iPhone,
   * that pulled 207 KB (patch) + 93 KB (pin) on the mission file and
   * 328 KB + 213 KB on an archive page, for a layer that can never be
   * drawn. The layer, and the mask URL that feeds it, are now emitted
   * only where they can actually be seen.
   */
  const specular = material === 'metal';

  const style = {
    '--a3d-size': size ? `${size}px` : '100%',
    '--a3d-tilt': `${tilt}deg`,
    '--a3d-art': String(artScale),
    ...(specular ? { '--a3d-mask': `url("${src}")` } : null),
  } as CSSProperties;

  return (
    <figure className={cn(styles.root, className)} style={style}>
      <div
        ref={frameRef}
        className={[styles.frame, surface === 'wall' && styles.wall, material === 'metal' && styles.gloss]
          .filter(Boolean)
          .join(' ')}
      >
        <div ref={stageRef} className={styles.stage}>
          <div className={styles.shadowWrap} aria-hidden>
            <div className={styles.shadow}>
              {/* Plain <img> on purpose, three times over: the object, the
                  shadow and the CSS mask must resolve to the *same* URL or
                  the browser downloads the artwork more than once. next/image
                  rewrites the src and cannot be referenced from mask-image. */}
              {/* The loading mode MUST match the object copy below. It used
                  to carry none, i.e. `eager`, which quietly cancelled the
                  object's `loading="lazy"`: both copies point at the same
                  URL, so the eager shadow pulled the artwork the moment the
                  document parsed. Measured on an emulated iPhone at 390,
                  /m/32BF fetched 2.7 MB of honours renders before the reader
                  had scrolled a pixel. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className={styles.art}
                draggable={false}
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
              />
            </div>
          </div>

          <div className={styles.object}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className={styles.art}
              draggable={false}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              {...(priority ? { fetchPriority: 'high' as const } : null)}
            />
            {specular ? (
              <span className={styles.spec} aria-hidden>
                <span className={styles.specGlow} />
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {label || caption ? (
        <figcaption className={styles.caption}>
          {label ? (
            <span className="font-mono text-tele-s uppercase ink-faint">{label}</span>
          ) : null}
          {caption ? <span className="text-body ink-dim">{caption}</span> : null}
        </figcaption>
      ) : null}
    </figure>
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
    stage.style.removeProperty('--a3d-nx');
    stage.style.removeProperty('--a3d-ny');
    stage.style.removeProperty('--a3d-lift');
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
    stage.style.setProperty('--a3d-nx', nx.value.toFixed(4));
    stage.style.setProperty('--a3d-ny', ny.value.toFixed(4));
    stage.style.setProperty('--a3d-lift', lift.value.toFixed(4));
  };

  const stop = () => {
    raf = 0;
    for (const s of springs) {
      s.value = s.target;
      s.velocity = 0;
    }
    write();
    // Idle pages hold no promoted layers.
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
  // No hover exists, so no pointermove is bound. A press dips the object
  // onto its shadow and the spring returns it: one gentle settle, no tilt.
  if (!fine) {
    const down = () => {
      lift.target = 1;
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
  // The rect is read on enter and re-read only when the page has moved
  // under the pointer. Measuring inside pointermove would force a layout
  // on every one of ~120 events per second.
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
    // Normalised offset from centre, clamped to the square's own extent so a
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
