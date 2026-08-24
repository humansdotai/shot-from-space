import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn, formatCoords, formatTelemetryTimestamp } from '@/lib/utils';
import { CreditBox } from './CreditBox';
import { CropMarks } from './CropMarks';
import { FileTags } from './FileTags';

/**
 * THE core image treatment. The single most important component on the site.
 *
 * A satellite frame inside a hairline frame, with registration marks and one
 * telemetry rail beneath it: coordinates, capture timestamp, file tags.
 *
 * Density discipline (CONTRACT.md §2.4): the image is the hero, the frame is
 * quiet. The rail is capped at six values — coordinates, timestamp and at most
 * four tags — and extra tags are dropped rather than wrapped into a second
 * band. If a plate feels busy, remove telemetry, never imagery.
 *
 * Nothing is printed over the picture except the corner credit, and only when
 * `credit` is set — in which case a short scrim is drawn under it for
 * legibility. No tint, no decorative gradient, no copy across the subject.
 */
export function ImagePlate({
  src,
  alt,
  width,
  height,
  lat,
  lon,
  capturedAt,
  tags,
  caption,
  aspect,
  priority = false,
  sizes = '(min-width: 1024px) 66vw, 100vw',
  credit = false,
  label,
  creditAlign = 'left',
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  lat?: number;
  lon?: number;
  capturedAt?: string | Date;
  tags?: string[];
  caption?: ReactNode;
  /** CSS aspect-ratio string, e.g. `16 / 9`. Omit to use the intrinsic ratio. */
  aspect?: string;
  priority?: boolean;
  sizes?: string;
  /** Renders <CreditBox /> in the frame corner. Print exhibits only. */
  credit?: boolean;
  /** Optional hairline header above the image, e.g. `FRAME / 01`. */
  label?: ReactNode;
  creditAlign?: 'left' | 'right';
  className?: string;
}) {
  const hasCoords = typeof lat === 'number' && typeof lon === 'number';
  /** Six telemetry values maximum around one image. */
  const railTags = (tags ?? []).slice(0, 4);
  const hasRail = hasCoords || Boolean(capturedAt) || railTags.length > 0;

  return (
    <figure className={cn('flex flex-col', className)}>
      <div className="relative border border-hairline bg-void">
        {label ? (
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-3 py-2">
            <span className="font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-paper-dim">
              {label}
            </span>
          </div>
        ) : null}

        <div
          className="relative overflow-hidden bg-deck"
          style={aspect ? { aspectRatio: aspect } : undefined}
        >
          {aspect ? (
            <Image
              src={src}
              alt={alt}
              fill
              sizes={sizes}
              priority={priority}
              className="object-cover"
            />
          ) : (
            <Image
              src={src}
              alt={alt}
              width={width}
              height={height}
              sizes={sizes}
              priority={priority}
              className="block h-auto w-full"
            />
          )}

          <CropMarks length={14} inset={8} />

          {credit ? (
            <>
              {/* Legibility scrim — functional, only under the credit, never
                  a decorative gradient across the picture. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-linear-to-t from-void/70 via-void/20 to-transparent"
              />
              <div
                className={cn(
                  'pointer-events-none absolute bottom-3 z-20 sm:bottom-4',
                  creditAlign === 'right' ? 'right-3 sm:right-4' : 'left-3 sm:left-4',
                )}
              >
                <CreditBox
                  size="xs"
                  align={creditAlign}
                  orientation="stack"
                  timestamp={capturedAt}
                  lat={lat}
                  lon={lon}
                />
              </div>
            </>
          ) : null}
        </div>

        {hasRail ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-hairline px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {hasCoords ? (
                <span
                  data-telemetry
                  className="font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-paper-dim"
                >
                  {formatCoords(lat as number, lon as number)}
                </span>
              ) : null}
              {capturedAt ? (
                <span
                  data-telemetry
                  className="font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-paper-faint"
                >
                  {formatTelemetryTimestamp(capturedAt)}
                </span>
              ) : null}
            </div>
            {railTags.length ? <FileTags tags={railTags} /> : null}
          </div>
        ) : null}
      </div>

      {caption ? (
        <figcaption className="mt-3 max-w-[62ch] text-body text-paper-dim">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
