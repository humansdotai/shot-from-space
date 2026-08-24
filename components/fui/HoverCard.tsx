import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The media card, and the site's hover vocabulary in one component.
 *
 * On hover: the image scales to 1.03 on the house curve inside a frame
 * that does not move, the card itself lifts 2px onto a soft shadow, and
 * the caption rises 8px into view. Three small moves on one curve read
 * as a single gesture — the plate coming forward — which is the whole
 * point. Anything larger reads as a carousel.
 *
 * The behaviour is CSS (`app/globals.css` → `.hovercard`), so this stays
 * a server component and works inside a static tree. Touch devices and
 * `prefers-reduced-motion` get the caption permanently visible rather
 * than a hover they can never perform.
 *
 * `href` makes the whole card one link — the entire surface is the tap
 * target, never a 20px "Read more" inside a 400px card.
 *
 * Sibling: <MediaCard /> is the full-bleed variant of the same idea —
 * no border, no footer, title only until hover, and a subtitle that
 * decodes as it arrives. Reach for that one when the photograph is the
 * whole content and for this one when the card carries metadata.
 */
export function HoverCard({
  src,
  alt,
  href,
  title,
  meta,
  caption,
  aspect = '4 / 3',
  sizes = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
  priority = false,
  overlay = false,
  footer,
  className,
}: {
  src: string;
  alt: string;
  /** Makes the whole card a link. */
  href?: string;
  /** Headline printed under the frame (or over it when `overlay`). */
  title?: ReactNode;
  /** Uppercase micro-label above the title — a code, a date, a place. */
  meta?: ReactNode;
  /** One line that is revealed on hover. Keep it to a sentence. */
  caption?: ReactNode;
  /** CSS aspect-ratio string for the frame. */
  aspect?: string;
  sizes?: string;
  priority?: boolean;
  /** Sets the text over the image with a legibility scrim beneath it. */
  overlay?: boolean;
  /** Below the card body — a price, a status. Ignored when `overlay`. */
  footer?: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <div className="hovercard-media" style={{ aspectRatio: aspect }}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />

        {overlay ? (
          <>
            {/* Functional scrim: it exists so type on a bright frame
                clears contrast, and it covers only the type. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-void/85 via-void/40 to-transparent"
            />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4 sm:p-5">
              {meta ? (
                <span className="font-mono text-tele-s uppercase text-paper/70">{meta}</span>
              ) : null}
              {title ? (
                <span className="text-heading text-paper">{title}</span>
              ) : null}
              {caption ? (
                <span className="hovercard-reveal max-w-[46ch] text-body text-paper/75">
                  {caption}
                </span>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {!overlay && (meta || title || caption || footer) ? (
        <div className="flex flex-col gap-2 p-4 sm:p-5">
          {meta ? (
            <span className="font-mono text-tele-s uppercase ink-faint">{meta}</span>
          ) : null}
          {title ? <span className="text-heading ink">{title}</span> : null}
          {caption ? (
            <span className="hovercard-reveal max-w-[52ch] text-body ink-dim">{caption}</span>
          ) : null}
          {footer ? <div className="mt-1">{footer}</div> : null}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn('hovercard', className)}>
        {body}
      </Link>
    );
  }

  return <div className={cn('hovercard', className)}>{body}</div>;
}
