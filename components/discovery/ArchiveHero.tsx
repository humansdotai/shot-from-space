import Image from 'next/image';
import { MosaicField } from '@/components/hero';
import { Band, Container } from '@/components/fui';
import { cn, formatCoords } from '@/lib/utils';

/**
 * THE ARCHIVE HERO (SYSTEM-V3 §5.2).
 *
 * One full-bleed capture at zero padding, the site bar over it, everything
 * else along the bottom edge. Nothing is centred and there is no button pair:
 * the index is directly below and the bar is directly above, so the picture
 * carries the band on its own.
 *
 * The rail sits at the FOOT of the plate rather than the head. A rail under
 * the header is a rail fighting the logo, and this shell's header floats over
 * the opening band by design.
 *
 * Height is set at each of the five breakpoints. Between 1280 and 2400 the
 * picture gains 180px of height while the copy stays on its own measure, so
 * the frame opens up instead of the type drifting apart in the middle of it.
 *
 * ------------------------------------------------------------------
 * THE SAMPLING RASTER
 * ------------------------------------------------------------------
 * The same <MosaicField /> as the homepage hero, at the SAME strength — the
 * default 1. The frame carries `data-mosaic-source` so the field samples this
 * picture's own colour rather than inventing one.
 *
 * It ran at 0.5 for a while, on the argument that this header carries more
 * running text than the homepage's and a full-gain cascade would read as
 * interference behind it. That was overruled: the archive header is the
 * second-most-seen picture on the site and it should behave like the first.
 * What makes it survivable is the layering — the field is at z-[1], both
 * scrims at z-[2] and the copy at z-10, so a cascade always passes UNDER the
 * legibility wash rather than through the type. Contrast is a function of the
 * scrims, never of where a cascade happens to be.
 */
const HERO_H =
  'min-h-[72svh] min-[768px]:min-h-[620px] min-[1280px]:min-h-[680px]' +
  ' min-[1440px]:min-h-[720px] min-[1920px]:min-h-[800px] min-[2400px]:min-h-[880px]';

export function ArchiveHero({
  src,
  alt,
  eyebrow,
  title,
  body,
  lat,
  lon,
  target,
  meta,
}: {
  src: string;
  alt: string;
  eyebrow: string;
  title: string;
  body: string;
  lat: number;
  lon: number;
  /** Place printed in the foot rail, e.g. `Lena delta · Sakha`. */
  target: string;
  /** Second foot-rail line, e.g. `13 files on record`. */
  meta: string;
}) {
  return (
    <Band top="flush" bottom="flush" tone="dark" className="isolate overflow-hidden">
      <div className={cn('relative w-full', HERO_H)}>
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="100vw"
          data-mosaic-source
          className="object-cover object-center"
        />

        <MosaicField className="z-[1]" />

        <div
          aria-hidden
          className="absolute inset-0 z-[2] bg-linear-to-t from-void via-void/45 to-void/15"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 z-[2] h-36 bg-linear-to-b from-void/85 to-transparent"
        />

        <Container
          className={cn(
            'relative z-10 flex flex-col justify-end pb-10 min-[1280px]:pb-14 min-[1920px]:pb-16',
            HERO_H,
          )}
        >
          <div className="flex flex-col gap-10 min-[1280px]:flex-row min-[1280px]:items-end min-[1280px]:justify-between min-[1280px]:gap-16 min-[1920px]:gap-24">
            <div>
              <p className="text-label uppercase text-paper/70">{eyebrow}</p>
              <h1 className="mt-6 max-w-[14ch] text-hero text-paper min-[1920px]:mt-8">{title}</h1>
              <p className="mt-7 max-w-[52ch] text-body text-paper/75 min-[1920px]:mt-9 min-[1920px]:max-w-[58ch]">
                {body}
              </p>
            </div>

            {/* The three readouts that belong to this frame. Left-aligned in
                the stack, right-aligned once the rail sits beside the copy. */}
            <div className="flex shrink-0 flex-col gap-2 min-[1280px]:items-end min-[1280px]:text-right">
              <span className="text-label uppercase text-paper/70">{target}</span>
              <span
                data-telemetry
                className="font-mono text-[0.75rem] tracking-[0.08em] text-paper/70"
              >
                {formatCoords(lat, lon)}
              </span>
              <span className="text-label uppercase text-paper/70">{meta}</span>
            </div>
          </div>
        </Container>
      </div>
    </Band>
  );
}
