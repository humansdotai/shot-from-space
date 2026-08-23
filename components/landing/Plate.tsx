import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A BARE MEDIA PLATE — the media half of a feature band.
 *
 * Deliberately not a bordered box. The page's default container is the
 * hairline and the band, never a framed panel with a caption tucked inside
 * it; a plate is a photograph with a clipped corner radius and a caption
 * hanging under it on the band's own ground.
 *
 * It still moves: the frame is fixed and the image scales 1.03 inside it on
 * the one house curve, so nothing reflows and the hairline under it never
 * shifts. Under `prefers-reduced-motion` the scale is dropped entirely — a
 * 3% jump with no transition is worse than no move at all.
 *
 * The group is named (`group/plate`) so a plate can sit inside a card or a
 * row that already owns the anonymous `group`.
 */
export function Plate({
  src,
  alt,
  aspect = 'aspect-[4/3]',
  sizes = '(min-width: 1280px) 46vw, (min-width: 768px) 50vw, 92vw',
  priority = false,
  caption,
  meta,
  className,
}: {
  src: string;
  alt: string;
  /** Aspect utilities, including any breakpoint steps. */
  aspect?: string;
  sizes?: string;
  priority?: boolean;
  /** Left-hand caption line, under the frame. */
  caption?: ReactNode;
  /** Right-hand telemetry line, under the frame. */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn('group/plate m-0', className)}>
      <div className={cn('relative w-full overflow-hidden rounded-card bg-void', aspect)}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={cn(
            'object-cover object-center will-change-transform',
            'transition-transform duration-house ease-house',
            'group-hover/plate:scale-[1.03]',
            'motion-reduce:transform-none!',
          )}
        />
      </div>

      {caption || meta ? (
        <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t rule-ground pt-3">
          {caption ? (
            <span className="font-mono text-tele-s uppercase ink-dim">{caption}</span>
          ) : null}
          {meta ? (
            <span data-telemetry className="font-mono text-tele-s uppercase ink-faint">
              {meta}
            </span>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
