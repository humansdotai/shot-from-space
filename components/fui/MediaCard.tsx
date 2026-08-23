import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ScrambleText } from './ScrambleText';

/**
 * MEDIA CARD — the workhorse. A full-bleed frame that opens on hover.
 *
 * ------------------------------------------------------------------
 * THE ARCHETYPE (SYSTEM-V3 §4)
 * ------------------------------------------------------------------
 *   frame     fixed ratio, media filling it edge to edge, clipped
 *   overlay   ~50%, `mix-blend-mode: multiply`, above the media and
 *             below the content
 *   content   bottom-left, 2rem from the bottom, 1.15rem from the
 *             left, `pointer-events: none`
 *   arrow     ~0.8rem glyph, shrink-0, in the subtitle's row
 *
 * ------------------------------------------------------------------
 * WHY MULTIPLY AND NOT A BLACK SCRIM
 * ------------------------------------------------------------------
 * A flat black layer at 50% opacity mixes every pixel halfway toward
 * black, which pulls saturation out with the luminance: a blue ocean
 * goes slate, a red desert goes brown. `mix-blend-mode: multiply`
 * against near-black instead scales each channel toward zero
 * proportionally, so the hue survives and only the value drops. The
 * frame gets darker; the photograph stays a photograph. That is the
 * entire reason the token is a blend mode and not an opacity.
 *
 * The multiply layer is a gradient, not a fill — heavy at the bottom
 * where the type sits, gone by the top third, so the subject of the
 * picture is untouched.
 *
 * A second, ordinary-blend gradient sits under the type. It is not
 * decoration and it is not a duplicate of the first: multiply alone
 * cannot guarantee contrast, because multiplying a blown-out white
 * cloud by 50% still leaves ~50% luminance and paper-white type on
 * that is roughly 1.3:1. The two together put the bottom edge near
 * 0.17 relative luminance, which clears 3:1 for the heading-size title
 * on the brightest frame we can be handed. Contrast is not something
 * the photograph gets a vote on.
 *
 * ------------------------------------------------------------------
 * THE HOVER — four moves, ONE gesture, FOUR durations (SPEC-V4 §A4)
 * ------------------------------------------------------------------
 * One curve for all of it — `--ease-out`, the classic
 * `cubic-bezier(0, 0, 0.58, 1)`, which decelerates across the whole
 * duration instead of snapping and coasting the way Tailwind's stock
 * `ease-out` does. Then four different durations on top of it:
 *
 *   1. MEDIA · 200ms.  The image scales to 1.03 inside a frame that
 *      does not resize, and the multiply overlay deepens with it.
 *      Both are the picture, so both are on the media duration.
 *   2. REVEAL · 250ms. The title rises to make room and the subtitle
 *      block arrives under it, decoding as it lands (<ScrambleText />).
 *   3. ICON · 150ms wait, then 350ms. The arrow does nothing at all
 *      while the first two are running, then fades in slowly and
 *      finishes last.
 *
 * THE OFFSET IS THE POINT — do not collapse these to one number.
 * A compound hover where everything starts and stops together reads
 * as a CSS transition; the same four moves staggered read as a
 * sequence that was designed, because the eye can follow them. 200 →
 * 250 → (150 + 350) puts the arrow's arrival at 500ms against the
 * image's 200ms, so the picture has already settled when the last
 * element lands on it and the gaze ends where the affordance is.
 *
 * 1.03 rather than 1.04 for the same reason §A4 caps it there: above
 * about 1.05 a media scale stops reading as a plate coming forward
 * and starts reading as a carousel effect. It matches <HoverCard />,
 * which is the other half of this vocabulary.
 *
 * Only `transform` and `opacity` animate, so it composites on the GPU.
 *
 * HOW THE TITLE MAKES ROOM WITHOUT A LAYOUT ANIMATION
 * The text block is absolutely positioned against the bottom edge and
 * contains BOTH lines at all times, so its height is fixed. At rest it
 * is translated down by exactly the height of the subtitle row (20px
 * line + 8px gap = 28px), which parks that row below the card edge and
 * leaves the title sitting on the 2rem bottom inset. Hover releases
 * the translate to 0. No height animation, no measurement, no reflow.
 *
 * ------------------------------------------------------------------
 * WHY THIS IS STILL A SERVER COMPONENT
 * ------------------------------------------------------------------
 * The entire hover is CSS. The only client code in the tree is the
 * subtitle's <ScrambleText />, which finds its trigger by walking up
 * to `data-scramble-trigger` on this link — so hovering anywhere on
 * the card decodes it, with no state and no handler here.
 *
 * Keyboard parity is not optional: every hover rule is duplicated for
 * `group-focus-visible`, so tabbing to the card gives the focus ring
 * AND the subtitle. On touch (`hover: none`) the second line is simply
 * always visible — information is never left behind a gesture the
 * device cannot perform.
 *
 * The whole card is one link. There is no small "view" target inside
 * it, which is also why the content layer is `pointer-events: none`.
 *
 * ------------------------------------------------------------------
 * RATIO AT THE FIVE STEPS
 * ------------------------------------------------------------------
 * `aspect` is a plain CSS aspect-ratio and defaults to the stepped
 * `--aspect-card` token: 3/4 at 390, 4/5 from 768, 3/4 again from 1280
 * and up. Pass `aspect="var(--aspect-bleed)"` for a card that is
 * itself a full-bleed band (4/5 → 16/9 → 2.5:1), or any literal ratio
 * to opt out of the system.
 */
export function MediaCard({
  href,
  src,
  alt,
  title,
  subtitle,
  aspect = 'var(--aspect-card)',
  priority = false,
  sizes = '(min-width: 1920px) 25vw, (min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw',
  className,
}: {
  /** The whole card is this link. */
  href: string;
  src: string;
  alt: string;
  /** The only thing visible at rest, bottom-left. */
  title: string;
  /** One line, revealed on hover. It decodes as it appears. */
  subtitle: string;
  /**
   * CSS aspect-ratio for the frame, which never resizes on hover.
   * Defaults to the stepped `--aspect-card` token.
   */
  aspect?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      data-scramble-trigger
      style={{ aspectRatio: aspect }}
      className={cn(
        // `on-dark` points --focus-ring at the accent that clears
        // contrast on a photograph. `group` drives every rule below.
        // `isolate` is load-bearing: mix-blend-mode blends against the
        // nearest stacking context, and without it the overlay would
        // reach past the card and multiply the page behind it.
        'group on-dark relative isolate block w-full overflow-hidden rounded-card bg-void',
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn(
          'object-cover will-change-transform',
          // §A4 · MEDIA, 200ms.
          'transition-transform duration-media ease-out',
          'group-hover:scale-[1.03] group-focus-visible:scale-[1.03]',
          // A 3% jump with no transition is worse than no move at all.
          'motion-reduce:scale-100!',
        )}
      />

      {/* THE OVERLAY. ~50% at rest, deepening to ~72% on hover — the
          only thing that changes is opacity, so it composites free. */}
      <span
        aria-hidden
        style={{
          backgroundImage:
            'linear-gradient(to top, var(--color-void) 0%, color-mix(in srgb, var(--color-void) 55%, transparent) 46%, transparent 82%)',
        }}
        className={cn(
          'pointer-events-none absolute inset-0 mix-blend-multiply',
          // §A4 · MEDIA, 200ms — the scrim is part of the picture, so
          // it deepens on exactly the beat the image scales on.
          'opacity-50 transition-opacity duration-media ease-out',
          'group-hover:opacity-[0.72] group-focus-visible:opacity-[0.72]',
          '[@media(hover:none)]:opacity-[0.72]',
        )}
      />

      {/* THE LEGIBILITY FLOOR. Ordinary blend, bottom half only, never
          animated — the title's contrast must not depend on a hover
          state or on how bright the photograph happens to be. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-void/70 via-void/25 to-transparent"
      />

      {/* Bottom-left type. 2rem bottom / 1.15rem left, per the
          archetype. The inset lives on this static wrapper so the
          moving block can travel without dragging it along. */}
      {/* The designed inset is 1.15rem. On a notched device in landscape the
          side insets are 47-59px, so on a full-bleed tile this caption — the
          city and the mission code — sat under the sensor housing. `max()`
          takes whichever is larger, which is the designed value on every
          device without a cutout. */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 block pb-8 pl-[max(1.15rem,var(--safe-inset-left))] pr-[max(1.15rem,var(--safe-inset-right))]">
        <span
          className={cn(
            // §A4 · REVEAL, 250ms. The title makes room 50ms behind
            // the image, so the frame is already moving when the type
            // starts.
            'block translate-y-7 transition-transform duration-reveal ease-out',
            'group-hover:translate-y-0 group-focus-visible:translate-y-0',
            '[@media(hover:none)]:translate-y-0',
          )}
        >
          <span className="block text-heading text-paper">{title}</span>

          {/* Fixed 20px row: the subtitle can never wrap and change the
              28px offset the title's rise is built on. */}
          <span
            className={cn(
              'mt-2 flex h-5 items-center gap-2 overflow-hidden',
              // §A4 · REVEAL, 250ms. The description, on the same beat
              // as the title's rise so the two arrive as one line.
              'translate-y-1 opacity-0 transition-[opacity,transform] duration-reveal ease-out',
              'group-hover:translate-y-0 group-hover:opacity-100',
              'group-focus-visible:translate-y-0 group-focus-visible:opacity-100',
              '[@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100',
            )}
          >
            <ScrambleText
              text={subtitle}
              trigger="hover"
              duration={620}
              className="truncate font-mono text-tele-s uppercase leading-5 text-paper/75"
            />

            {/* THE ARROW. §A4 · ICON — 150ms of nothing, then 350ms.
                It is the only element in the card with a delay, and
                that delay is what stages the hover: the image (200ms)
                and the description (250ms) both finish before the
                arrow has fully arrived at 500ms, so the eye is led
                from the picture, to the line, to the affordance,
                in that order, instead of being shown all three at
                once. Collapsing this onto the reveal duration is what
                makes a card hover read as animated rather than
                engineered.

                Its own opacity is transitioned rather than the parent
                row's, because the row is already carrying the reveal
                beat — the arrow needs a second, slower one.

                0.8rem, shrink-0, on the subtitle's baseline row so the
                two read as one line rather than as a caption and an
                unrelated corner button. */}
            <svg
              aria-hidden
              viewBox="0 0 14 14"
              fill="none"
              className={cn(
                'size-[0.8rem] shrink-0 text-paper/75',
                'opacity-0 transition-opacity delay-icon duration-icon ease-out',
                'group-hover:opacity-100 group-focus-visible:opacity-100',
                '[@media(hover:none)]:opacity-100',
                // Under reduced motion the row is already visible; a
                // lone invisible arrow would be information withheld.
                'motion-reduce:opacity-100 motion-reduce:delay-0',
              )}
            >
              <path
                d="M3.25 10.75 10.75 3.25M10.75 3.25H5.25M10.75 3.25v5.5"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="square"
              />
            </svg>
          </span>
        </span>
      </span>
    </Link>
  );
}
