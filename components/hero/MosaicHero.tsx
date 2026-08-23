import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn, formatCoords } from '@/lib/utils';
import { HERO_FRAME, type CatalogueFrame } from '@/lib/imagery';
import { MosaicField } from './MosaicField';

/**
 * MOSAIC HERO — the first thing anyone sees.
 *
 * One satellite frame, full bleed, with the sensor's own sampling raster drawn
 * over it (see ./MosaicField). At rest the raster only takes light away, and
 * the gutters between tiles are the capture at full strength. Touch it and the
 * cells light up and pass that light to their neighbours, a chain reaction
 * spreading unevenly through the field and twinkling down behind the pointer.
 *
 * Layering, bottom to top:
 *   0  the frame
 *   1  a flat sink, so the raster has something to sit against
 *   2  the mosaic field (pointer-events: none, always)
 *   3  legibility scrims — bottom and left, where copy lives. Deliberately
 *      ABOVE the field: a cascade running under the headline stays readable,
 *      and the mosaic reads strongest in the open part of the frame.
 *   4  telemetry rails and whatever the page passes as children
 *
 * The section is self-contained: mount it, pass a headline as children.
 */
export function MosaicHero({
  frame = HERO_FRAME,
  children,
  className,
  /** The frame's own margin telemetry. Off if the page supplies its own. */
  telemetry = true,
  seed,
  density,
  interactive = true,
  priority = true,
}: {
  frame?: CatalogueFrame;
  children?: ReactNode;
  className?: string;
  telemetry?: boolean;
  seed?: number;
  density?: number;
  interactive?: boolean;
  priority?: boolean;
}) {
  return (
    <section
      className={cn(
        'relative isolate flex w-full flex-col overflow-hidden',
        'min-h-[560px] sm:min-h-[620px] lg:min-h-[min(88svh,880px)]',
        className,
      )}
    >
      <Image
        src={frame.src}
        alt={`Satellite capture of ${frame.city}, ${frame.admin}, recorded from orbit at ${formatCoords(frame.lat, frame.lon)}`}
        fill
        priority={priority}
        sizes="100vw"
        className="object-cover object-center"
        // The field samples this element directly — no second download.
        data-mosaic-source=""
      />

      {/* A whisper of a sink under the raster, so the bare gutters read as
          light against the samples rather than as glare. */}
      <div aria-hidden className="absolute inset-0 z-[1] bg-void/15" />

      <MosaicField className="z-[2]" seed={seed} density={density} interactive={interactive} />

      {/* Legibility only. Anchored to the two edges that carry copy; the open
          upper-right of the picture is left alone. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 z-[3] h-1/2 bg-gradient-to-t from-void via-void/55 to-transparent sm:h-2/5 sm:via-void/45"
      />
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 z-[3] w-1/2 bg-gradient-to-r from-void/45 to-transparent"
      />

      <div className="relative z-10 flex flex-1 flex-col">
        {telemetry ? (
          <div className="mx-auto flex w-full max-w-[1600px] items-start justify-between gap-6 px-4 pt-[5.25rem] sm:px-6 lg:px-8 lg:pt-[6.75rem]">
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-paper/70 [text-shadow:0_1px_10px_rgba(8,9,11,0.9)]">
                TARGET // {frame.city} · {frame.admin}
              </span>
              <span
                data-telemetry
                className="font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-paper/75 tabular-nums [text-shadow:0_1px_10px_rgba(8,9,11,0.9)]"
              >
                {formatCoords(frame.lat, frame.lon)}
              </span>
            </div>
            <div className="hidden flex-col items-end gap-1.5 sm:flex">
              <span
                data-telemetry
                className="font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-paper/70 [text-shadow:0_1px_10px_rgba(8,9,11,0.9)]"
              >
                {frame.orbit.sensor}
              </span>
              <span
                data-telemetry
                className="font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-paper/45 [text-shadow:0_1px_10px_rgba(8,9,11,0.9)]"
              >
                ORBIT: {frame.orbit.track}
              </span>
            </div>
          </div>
        ) : null}

        {children}
      </div>
    </section>
  );
}
