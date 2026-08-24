'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * VIDEO PLATE — one supplied clip, played well.
 *
 * The clips are 720x1280 portrait, silent, a few seconds long. They are
 * texture, not content: they play only while on screen, they never carry
 * sound, and they never load ahead of what the visitor is looking at.
 *
 *   - `muted playsInline loop preload="metadata"` with its poster, always.
 *   - TWO SOURCES. A 540x960 encode is served below 768px and the 720x1280
 *     one above it, which is 30-40% fewer bytes on the connection least able
 *     to spare them, at a size no phone can resolve past. `<source media>` is
 *     evaluated once at load and does not re-evaluate on resize — that is
 *     correct here: a phone does not become a desktop mid-session, and
 *     re-loading a playing clip on an orientation change would be worse than
 *     the pixels it saved.
 *   - EVERY CLIP IS yuv420p IN TV RANGE. `result.mp4` used to be full-range
 *     yuvj420p; Safari's handling of full-range H.264 is inconsistent and the
 *     format is deprecated, so it is normalised at the asset level.
 *   - Playback is gated on IntersectionObserver, so two plates on one page
 *     never both decode, and a plate scrolled past stops.
 *   - Hover lifts the plate a hair, scales the frame on the house curve and
 *     brings the caption up.
 *   - Under `prefers-reduced-motion` the element is never played and never
 *     asked for more than its metadata: what you see is the poster frame,
 *     which is exactly the still the client supplied.
 *   - A pause control appears on hover or focus — looping motion has to be
 *     stoppable (WCAG 2.2.2), and it doubles as the play affordance when a
 *     browser refuses autoplay.
 *
 *     ON A TOUCH SCREEN IT IS ALWAYS VISIBLE, and that is an iOS bug fix, not
 *     a preference. There is no hover on a phone, so `group-hover:opacity-100`
 *     left the control permanently invisible there. Combined with iOS Low
 *     Power Mode — which refuses `play()` outright, muted or not — a phone on
 *     low battery showed a poster frame with no way whatsoever to start the
 *     clip, and no indication there was anything to start. The control is now
 *     shown whenever the pointer is coarse, and also whenever a `play()`
 *     promise has actually been rejected, on any device.
 *
 * Markup is identical on server and client; only behaviour is conditional, so
 * there is nothing here that can mismatch on hydration.
 */
export function VideoPlate({
  src,
  mobileSrc,
  poster,
  alt,
  label,
  caption,
  className,
  aspect = '9 / 16',
  rounded = true,
}: {
  /** e.g. `/video/intro.mp4` */
  src: string;
  /**
   * The narrow-viewport encode. Defaults to the `-540` sibling of `src` by
   * convention (`/video/intro.mp4` -> `/video/intro-540.mp4`), which is what
   * every clip in `public/video` ships. Pass `null` for a clip that has no
   * small encode, so the browser is never pointed at a 404.
   */
  mobileSrc?: string | null;
  /** e.g. `/video/intro-poster.jpg` */
  poster: string;
  /** Describes the clip for assistive tech. Never decorative filler. */
  alt: string;
  /** Small uppercase tag printed on the plate, e.g. `ACQUISITION`. */
  label?: string;
  caption?: string;
  className?: string;
  /** CSS aspect-ratio. The supplied clips are 9 / 16. */
  aspect?: string;
  rounded?: boolean;
}) {
  // `/video/intro.mp4` -> `/video/intro-540.mp4`, which is the naming every
  // clip in public/video follows. Passing null opts a clip out entirely, so
  // a source without a small encode is never pointed at a 404.
  const small = mobileSrc === null ? null : (mobileSrc ?? src.replace(/\.mp4$/, '-540.mp4'));

  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);
  const [wanted, setWanted] = useState(true);
  /** Coarse pointer, or a play() the browser actually refused. Either one
   *  means the control has to be visible without a hover to reveal it. */
  const [needsControl, setNeedsControl] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia('(hover: none), (pointer: coarse)');
    const onChange = () => setNeedsControl((prev) => prev || coarse.matches);
    onChange();
    coarse.addEventListener('change', onChange);
    return () => coarse.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Play only while visible, wanted, and the tab is in front.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let onScreen = false;

    const sync = () => {
      const video = videoRef.current;
      if (!video) return;
      if (onScreen && wanted && !reduced && !document.hidden) {
        // Autoplay can be refused by policy — Low Power Mode on iOS refuses it
        // even when muted. That is not an error to throw, but it IS something
        // the interface has to react to: reveal the control so there is a way
        // in. `wanted` is left true so a later attempt can still succeed.
        void video.play().catch(() => setNeedsControl(true));
      } else {
        video.pause();
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      },
      { threshold: 0.25 },
    );
    io.observe(wrap);
    document.addEventListener('visibilitychange', sync);

    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [reduced, wanted]);

  return (
    <figure ref={wrapRef} className={cn('group relative flex flex-col', className)}>
      <div
        className={cn(
          'relative overflow-hidden border border-hairline bg-deck',
          'transition-house',
          'group-hover:-translate-y-px group-hover:border-hairline-strong',
          'group-hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]',
          rounded && 'rounded-card',
        )}
        style={{ aspectRatio: aspect }}
      >
        <video
          ref={videoRef}
          poster={poster}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={alt}
          className={cn(
            'absolute inset-0 h-full w-full object-cover',
            'transition-house group-hover:scale-[1.03]',
          )}
        >
          {small ? <source src={small} type="video/mp4" media="(max-width: 767px)" /> : null}
          <source src={src} type="video/mp4" />
        </video>

        {label ? (
          <span className="pointer-events-none absolute left-[max(0.75rem,var(--safe-inset-left))] top-3 z-10 font-mono text-[0.5625rem] uppercase leading-none tracking-[0.2em] text-paper/85 [text-shadow:0_1px_6px_rgba(8,9,11,0.9)]">
            {label}
          </span>
        ) : null}

        {reduced ? null : (
          <button
            type="button"
            onClick={() => setWanted((p) => !p)}
            aria-label={wanted ? 'Pause clip' : 'Play clip'}
            className={cn(
              // Right inset clears the display cutout in landscape; 0.75rem
              // on every device without one.
              'absolute bottom-3 right-[max(0.75rem,var(--safe-inset-right))] z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[6px] border border-hairline bg-void/80 px-3',
              'font-mono text-[0.5625rem] uppercase leading-none tracking-[0.2em] text-paper/80',
              'transition-house',
              'hover:border-hairline-strong hover:text-paper',
              // Coarse pointer or refused autoplay: always visible. Otherwise
              // the house behaviour — revealed by hover or by focus.
              needsControl ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              'focus-visible:opacity-100',
            )}
          >
            {wanted ? 'PAUSE' : 'PLAY'}
          </button>
        )}
      </div>

      {caption ? (
        <figcaption
          className={cn(
            // §A2. Captions are sentences — every string passed here is
            // one or two of them — so this is the `note` role, sentence
            // case, negative tracking. It used to be 10px monospace,
            // uppercased and tracked out +0.16em, i.e. the telemetry
            // LABEL treatment applied to running prose.
            'mt-3 max-w-[52ch] text-note',
            'text-paper-faint transition-house group-hover:text-paper-dim',
          )}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
