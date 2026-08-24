'use client';

import Image, { getImageProps } from 'next/image';
import { clsx as cn } from 'clsx';
import { Artifact3D } from '@/components/artifact';

/**
 * THE CHROME MARK — the house mark as a physical object.
 *
 * `/brand/mark-chrome.png` is a 925 x 722 render of the mark in polished
 * chrome, on transparency, with its own soft contact shadow baked in. It has
 * two jobs on the mission file and they are not the same job:
 *
 *   MASTHEAD    Full opacity, large, load-bearing, and PHYSICAL — it zooms,
 *               casts, and tilts toward the pointer. The mark IS the element;
 *               it opens the document the way a crest opens a certificate.
 *   WATERMARK   Very low contrast, very large, behind content, and completely
 *               inert. The poster does exactly this in its lower half (see
 *               RESULT.pdf): it is felt rather than read.
 *
 * ==================================================================
 * THE MOTION IS NOT WRITTEN HERE
 * ==================================================================
 * A masthead mark is an <Artifact3D>, the same component the patch and the
 * coin use. There is exactly one tilt implementation in this codebase and
 * this is not a second one: the spring damping (just overdamped, so the
 * rotation approaches the pointer and never crosses it), the shadow that
 * parallaxes opposite the tilt, the lift along the viewer's axis and the
 * specular sweep all come from <Artifact3D> and its stylesheet. Reduced
 * motion and coarse pointers degrade there too, once, for every object on
 * the site.
 *
 * `material="metal"` is what turns the specular on: the mark is polished
 * chrome, and polished chrome genuinely travels a highlight as it turns.
 * `surface="contact"` is the shorter, denser cast of an object resting on
 * the page rather than one hung proud of a wall.
 *
 * TWO THINGS ARE OVERRIDDEN ON THE WAY IN, both from the outside and both
 * because this artwork is not a square:
 *
 *   ASPECT   <Artifact3D> frames a square, because a patch and a coin are
 *            square. The mark is 925 x 722, so the frame is restated at the
 *            artwork's own ratio. Every measurement inside the component is
 *            in `cqw` — a share of the frame's WIDTH — so the shadow
 *            geometry, the perspective and the specular travel all stay
 *            exactly as specified; only the dead space above and below the
 *            mark goes away.
 *   CRISP    The per-ground treatment below, applied to the artwork itself
 *            rather than to the stage, so it cannot flatten the 3D context.
 *
 * ==================================================================
 * CRISP ON BOTH GROUNDS
 * ==================================================================
 * The mark is mid-grey chrome with near-white speculars and near-black
 * outlines, so it carries its own form on either ground — but not for the
 * same reason, and the two need different help:
 *
 *   ON VOID     The baked contact shadow is dark on dark and disappears; the
 *               speculars do the separating. `brightness(1.06)` lifts the
 *               chrome just clear of the ground without touching the
 *               outlines, which are already at maximum contrast there. The
 *               cast <Artifact3D> draws is black on near-black and stays
 *               subtle by physics; on this ground the hover is carried by
 *               the tilt, the lift and the specular.
 *   ON PAPER    The speculars are the part that vanishes, and the outlines
 *               and the shadow do the separating — and here the live cast
 *               reads fully, so no static `drop-shadow` is added on top of
 *               it. Two shadows on one object is the tell.
 *
 * The filter is set on the <img> elements, which is deliberate: a filter on
 * any element BETWEEN the perspective and the rotated object would flatten
 * the 3D context and kill the tilt. On the shadow copy the filter is
 * harmless — <Artifact3D> puts `brightness(0)` over it, and 0 x 1.06 is
 * still 0.
 *
 * ==================================================================
 * ONE URL, THE RIGHT SIZE
 * ==================================================================
 * <Artifact3D> uses the artwork three times — object, cast, and the CSS mask
 * that keeps the specular on the metal — and a `mask-image` cannot read a
 * `srcset`. All three must therefore resolve to ONE url or the browser
 * downloads the mark more than once.
 *
 * So the responsive step is chosen here instead of by the browser:
 * `getImageProps` builds the optimiser url for the width this step actually
 * needs at 2x, and the source's own 925px caps it — Next never upscales, and
 * upscaling a raster past its own resolution is how a premium mark starts
 * looking like a JPEG. That single url is AVIF/WebP rather than the 493KB
 * PNG, so the mark is both sharper and several times smaller than it was
 * when it was served as an ordinary <Image>.
 *
 * The watermark keeps its plain <Image> and its full `sizes` behaviour: it
 * is never masked, so nothing there needs a single url.
 *
 * ==================================================================
 * IT NEVER HURTS READING
 * ==================================================================
 * A watermark is `aria-hidden`, `pointer-events-none`, `select-none`, and its
 * opacity is CLAMPED to 0.12 — the `opacity` prop cannot raise it past that,
 * whatever a caller passes. At 0.12 the mark can shift the ground's luminance
 * by at most 12% of the distance to the mark's own value, which leaves body
 * ink on paper (16.99:1) above 13:1 and ink on void above 12:1 — AAA on both,
 * with the whole of the AA margin still unspent. `grayscale(1)` on top of
 * that removes any hue the chrome could push into the text behind it.
 *
 * The watermark also does not position itself. It renders `absolute inset-0`
 * inside whatever `relative` box it is given and fits itself with
 * `object-contain`, so the caller decides where it sits and how big the box
 * is, and no consumer can accidentally push it into a text column at a size
 * this component did not measure.
 */

const INTRINSIC = { width: 925, height: 722 } as const;
const SRC = '/brand/mark-chrome.png';

/** The ceiling on the watermark's opacity. Stated once, enforced once. */
const WATERMARK_MAX = 0.12;

export type ChromeMarkRole = 'masthead' | 'watermark';

/**
 * Masthead sizes, as the CSS width the mark actually occupies at each of the
 * six steps. `full` fills its container and is the one to use inside a grid
 * cell that already has a measured width.
 *
 * Every step is larger than it was: the mark was being rendered at roughly
 * two thirds of the width its slot could carry, which is what made it read as
 * a decoration next to the heading instead of as the crest on the file. The
 * ceiling on the large steps is 462px and it is not arbitrary — 462 x 2 is
 * 924, one pixel under the artwork's own resolution, so the mark is still
 * pixel-exact on a 2x display at its largest.
 */
export type ChromeMarkSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const MASTHEAD_WIDTH: Record<ChromeMarkSize, string> = {
  /** A crest beside a heading. 128 → 176. */
  sm: 'w-[128px] xl:w-[152px] xl2:w-[176px]',
  /** The default. 200 → 320. */
  md: 'w-[200px] md:w-[236px] xl:w-[272px] 2xl:w-[296px] xl2:w-[320px]',
  /** Opens a band, and fills its column rather than sitting inside it.
      320 → 462. */
  lg: 'w-[320px] md:w-[400px] xl:w-[420px] 2xl:w-[462px]',
  /** The mark AS the composition. 360 → 925, the file's own width. */
  xl: 'w-[360px] md:w-[520px] xl:w-[660px] 2xl:w-[780px] xl2:w-[880px] xl3:w-[925px]',
  /** Fills the box it is given, but never past the file's own 925px. */
  full: 'w-full max-w-[925px]',
};

/**
 * The largest CSS width each step reaches. `getImageProps` treats a fixed
 * width as a 1x/2x pair and points `src` at the 2x member, which is exactly
 * the url wanted here — so this table states the CSS width and reads back the
 * retina one. `lg` and above resolve past the artwork's own 925px, which the
 * optimiser caps: Next never upscales, so those steps all land on the full
 * 925px render, in AVIF, at 43KB against the PNG's 493KB.
 */
const FETCH_WIDTH: Record<ChromeMarkSize, number> = {
  sm: 176,
  md: 320,
  lg: 462,
  xl: 925,
  full: 925,
};

/** `sizes` for the watermark, which is unmasked and keeps a real srcset. */
const WATERMARK_SIZES = '(min-width: 1280px) 60vw, 90vw';

export interface ChromeMarkProps {
  /**
   * `masthead` is the mark at full strength as an element in its own right.
   * `watermark` is the mark behind content, clamped low and inert.
   */
  role?: ChromeMarkRole;
  /** Masthead only — a watermark always fills the box it is given. */
  size?: ChromeMarkSize;
  /**
   * The ground it is sitting on. Decides which of the two crispness
   * treatments applies; there is no way to detect this from inside a
   * component, so the caller states it.
   */
  ground?: 'dark' | 'light';
  /** Watermark only. Clamped to 0.12; the default is 0.08 on void, 0.10 on paper. */
  opacity?: number;
  /** Masthead only. A watermark is decorative and is always `aria-hidden`. */
  alt?: string;
  /** Set on the one mark that is above the fold. */
  priority?: boolean;
  className?: string;
}

export function ChromeMark({
  role = 'masthead',
  size = 'md',
  ground = 'dark',
  opacity,
  alt = 'Shot from Space mark',
  priority = false,
  className,
}: ChromeMarkProps) {
  const dark = ground === 'dark';

  if (role === 'watermark') {
    // The ceiling is enforced here and cannot be raised from outside.
    const level = Math.min(WATERMARK_MAX, Math.max(0.02, opacity ?? (dark ? 0.08 : 0.1)));
    return (
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 select-none overflow-hidden',
          className,
        )}
      >
        <Image
          src={SRC}
          alt=""
          width={INTRINSIC.width}
          height={INTRINSIC.height}
          sizes={WATERMARK_SIZES}
          className="h-full w-full object-contain"
          style={{
            opacity: level,
            // Greyscale so the chrome cannot tint the text in front of it.
            filter: dark ? 'grayscale(1) brightness(1.35)' : 'grayscale(1) contrast(1.1)',
          }}
        />
      </span>
    );
  }

  const width = FETCH_WIDTH[size];
  const { props: optimised } = getImageProps({
    src: SRC,
    alt,
    width,
    height: Math.round((width * INTRINSIC.height) / INTRINSIC.width),
    quality: 88,
  });

  return (
    /* The wrapper carries the slot and the a11y decision; the object inside
       it fills that slot. A masthead called with `alt=""` is decorative by
       the caller's own intent (MissionFile passes it that way: the file is
       already named by its lockup and its heading). <Artifact3D> renders a
       <figure>, and an empty alt alone still leaves a figure in the tree for
       some AT to announce as an unlabelled graphic — so the whole object is
       hidden, exactly as the watermark branch hides its own. A masthead with
       a real alt is a named image and stays exposed. */
    <div
      aria-hidden={alt === '' ? true : undefined}
      className={cn('max-w-full', MASTHEAD_WIDTH[size], className)}
    >
      <Artifact3D
        src={optimised.src}
        alt={alt}
        material="metal"
        surface="contact"
        priority={priority}
        className={cn(
          // The square frame, restated at the artwork's own ratio. `> div` is
          // the frame; the only other child a figure can have is its caption,
          // and a mark never has one.
          //
          // The `!` is not a shortcut. Tailwind's utilities live in
          // `@layer utilities` and a CSS Module's rules are unlayered, so the
          // module wins on cascade LAYER no matter what the specificity says —
          // an unimportant utility cannot override `aspect-ratio: 1` here, at
          // any weight. Important is the documented way out of a layer, and it
          // is used for exactly one declaration.
          '[&>div]:aspect-[925/722]!',
          // Crispness, on the artwork rather than on the stage. See above.
          dark ? '[&_img]:[filter:brightness(1.06)]' : null,
          // THE ZOOM. The tilt is a spring, deliberately; the zoom is not
          // physics, it is the object coming forward, so it rides the house
          // curve at the house duration. Nothing bounces, and under reduced
          // motion it does not happen at all.
          'motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-house',
          'motion-safe:hover:scale-[1.035]',
        )}
      />
    </div>
  );
}
