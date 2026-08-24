'use client';

import Image from 'next/image';
import { FramedPoster } from '@/components/artifact';
import { useEffect, useRef, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/** Rendered width requested from the composer. 2× the display width. */
const RENDER_W = 900;

/* ------------------------------------------------------------------ */
/* The tip                                                             */
/* ------------------------------------------------------------------ */

/**
 * HOW THE PLATE MOVES.
 *
 * A printed poster held in two hands and tipped toward a window: it turns to
 * FACE the light, it lifts off the surface it was lying on, and its shadow
 * gets longer and darker as it comes up. Three things, one gesture.
 *
 * `MAX_TILT` is the half-angle at the very edge of the plate. 5.5° is about
 * as far as this can go before the perspective divide starts to shear the
 * monospace telemetry on the sheet and the whole thing reads as a gimmick.
 *
 * `TAU` is the damping. The transform is never the pointer position: it is a
 * value that *chases* the pointer position, closing the remaining distance on
 * an exponential with a 110 ms time constant. That is what gives it mass —
 * a raw 1:1 mapping tracks a shaky hand exactly, and a heavy object does not.
 * Solved against elapsed time rather than per frame, so it damps identically
 * on a 60 Hz panel and a 120 Hz one.
 */
const MAX_TILT = 5.5;
const TAU = 110;
/** Below this, the plate has arrived; stop burning frames. */
const EPSILON = 0.0006;

interface Tip {
  /** −1 → 1 across the plate. */
  x: number;
  y: number;
  /** 0 at rest, 1 fully engaged. Drives lift, scale and shadow together. */
  on: number;
}

const REST: Tip = { x: 0, y: 0, on: 0 };

function paint(el: HTMLElement, t: Tip): void {
  // Sign convention: the plate turns to face the pointer. Pointer right of
  // centre → the right edge goes back (rotateY positive); pointer above
  // centre → the top edge comes forward (rotateX negative, and `y` is already
  // negative up there).
  el.style.setProperty('--tilt-x', `${(t.y * MAX_TILT).toFixed(3)}deg`);
  el.style.setProperty('--tilt-y', `${(t.x * MAX_TILT).toFixed(3)}deg`);
  el.style.setProperty('--tilt-on', t.on.toFixed(4));
}

/**
 * Install the pointer model on one element. Everything below runs outside
 * React: pointer positions land in refs, the transform is written straight to
 * the node's custom properties from a rAF, and the component never re-renders
 * while the pointer is moving.
 */
function trackPointer(el: HTMLElement): () => void {
  const target: Tip = { ...REST };
  const now: Tip = { ...REST };
  let frame = 0;
  let last = 0;

  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  };

  const tick = (time: number) => {
    const dt = last ? Math.min(64, time - last) : 16;
    last = time;

    // Exponential approach. `k` is the fraction of the REMAINING distance to
    // close this frame, derived from how long the frame actually took.
    const k = 1 - Math.exp(-dt / TAU);
    now.x += (target.x - now.x) * k;
    now.y += (target.y - now.y) * k;
    now.on += (target.on - now.on) * k;
    paint(el, now);

    const settled =
      Math.abs(target.x - now.x) < EPSILON &&
      Math.abs(target.y - now.y) < EPSILON &&
      Math.abs(target.on - now.on) < EPSILON;

    if (settled) {
      paint(el, target);
      stop();
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  const start = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  const onMove = (event: PointerEvent) => {
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) return;
    // Clamped because a pointer can leave the box between the last move and
    // the leave event, and an un-clamped value would overshoot the half-angle.
    target.x = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1));
    target.y = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height) * 2 - 1));
    target.on = 1;
    start();
  };

  const onLeave = () => {
    target.x = REST.x;
    target.y = REST.y;
    target.on = REST.on;
    start();
  };

  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('pointercancel', onLeave);

  return () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('pointercancel', onLeave);
    stop();
    paint(el, REST);
  };
}

/* ------------------------------------------------------------------ */
/* The component                                                       */
/* ------------------------------------------------------------------ */

/**
 * THE THING THAT ARRIVES.
 *
 * The composed plate for this file, straight out of `lib/poster` by way of
 * `/api/poster/{code}` — the same composition, the same type, the same
 * two grounds as the printed object. It is deliberately the real endpoint
 * and not a screenshot: if the composer changes, this changes.
 *
 * `unoptimized` because the route already negotiates WebP and holds its own
 * ETag; putting the Next image optimiser in front of it would re-encode a
 * picture that is already exactly the size it is being displayed at.
 */
export function DeliverablePreview({
  code,
  slug,
  ratio,
  label,
  detail,
  width = 450,
  framed = false,
  className,
}: {
  code: string;
  slug: string;
  /** `3:4` etc. Drives the requested and the rendered aspect. */
  ratio: string;
  /** Optional caption label. Omit when the block already has a heading. */
  label?: string;
  detail: string;
  width?: number;
  /**
   * Hang the plate in the aluminium presentation moulding instead of showing
   * it as a bare sheet lying on the page.
   *
   * The two are different claims, which is why this is a prop and not a
   * restyle: the sheet metaphor answers "this is the file that goes to the
   * printer", the frame answers "this is the object on your wall". Framed,
   * the tilt, the wall shadow and the specular all come from
   * <FramedPoster />, so none of the pointer machinery below is attached.
   */
  framed?: boolean;
  className?: string;
}) {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    // Framed: <FramedPoster /> owns the interaction entirely. Two tilt
    // handlers on one object fight, and the stage is not even rendered.
    if (!el || framed) return;

    // A touch screen has no pointer to lean toward, and reduced motion means
    // the plate does not move at all. In both cases NOTHING is attached —
    // not a throttled listener, not a disabled one.
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');

    let detach: (() => void) | undefined;

    const sync = () => {
      detach?.();
      detach = fine.matches && !still.matches ? trackPointer(el) : undefined;
    };

    sync();
    fine.addEventListener('change', sync);
    still.addEventListener('change', sync);

    return () => {
      fine.removeEventListener('change', sync);
      still.removeEventListener('change', sync);
      detach?.();
    };
  }, [framed]);

  const [w, h] = ratio.split(':').map(Number);
  const aspect = w && h ? w / h : 0.75;
  const src = `/api/poster/${code}?slug=${encodeURIComponent(slug)}&w=${RENDER_W}&ratio=${encodeURIComponent(ratio)}`;

  const alt = `The composed plate for mission ${code}: the capture above, the mission sheet below.`;

  if (framed) {
    return (
      <figure className={cn('flex flex-col gap-6', className)}>
        <FramedPoster src={src} alt={alt} ratio={ratio} />
        <figcaption className="flex max-w-[40ch] flex-col gap-2">
          {label ? <span className="text-label uppercase ink-dim">{label}</span> : null}
          <p className="text-body ink-dim">{detail}</p>
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className={cn('flex flex-col gap-6', className)}>
      {/* The stage owns the perspective and the pointer; the plate inside it
          owns the transform. Splitting them is what keeps the vanishing point
          fixed to the frame instead of travelling with the tilt. */}
      <div
        ref={stage}
        style={
          {
            '--tilt-x': '0deg',
            '--tilt-y': '0deg',
            '--tilt-on': 0,
            perspective: '1100px',
            aspectRatio: `${aspect}`,
          } as CSSProperties
        }
        className="w-full"
      >
        <div
          style={{
            transform:
              'rotateX(var(--tilt-x)) rotateY(var(--tilt-y))' +
              ' translate3d(0, calc(var(--tilt-on) * -8px), 0)' +
              ' scale(calc(1 + var(--tilt-on) * 0.008))',
            // One contact shadow and one cast shadow, both driven off the same
            // scalar, so the plate's weight and its height off the page never
            // disagree. Neutral ink, never a glow.
            boxShadow:
              '0 calc(2px + var(--tilt-on) * 3px) calc(6px + var(--tilt-on) * 8px) -4px' +
              ' rgb(8 9 11 / calc(0.16 + var(--tilt-on) * 0.10)),' +
              ' 0 calc(18px + var(--tilt-on) * 20px) calc(50px + var(--tilt-on) * 30px) -24px' +
              ' rgb(8 9 11 / calc(0.45 + var(--tilt-on) * 0.20))',
            willChange: 'transform',
          }}
          className="h-full w-full overflow-hidden rounded-[2px]"
        >
          <Image
            src={src}
            alt={alt}
            width={RENDER_W}
            height={Math.round(RENDER_W / aspect)}
            unoptimized
            sizes={`${width}px`}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
      <figcaption className="flex max-w-[40ch] flex-col gap-2">
        {label ? <span className="text-label uppercase ink-dim">{label}</span> : null}
        <p className="text-body ink-dim">{detail}</p>
      </figcaption>
    </figure>
  );
}
