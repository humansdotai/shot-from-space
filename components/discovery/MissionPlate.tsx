import Image from 'next/image';
import { MosaicField } from '@/components/hero';
import { Container, CreditBox } from '@/components/fui';
import { frameAlt, titleCase, type ExampleMission } from '@/lib/gallery';
import { cn } from '@/lib/utils';

/**
 * Plate height, held in one place so the media and the overlay agree, and
 * stepped at all five breakpoints rather than interpolated between two: the
 * opening frame should gain height as the window widens, not only width.
 */
const PLATE_H =
  'min-h-[74svh] min-[768px]:min-h-[660px] min-[1280px]:min-h-[720px]' +
  ' min-[1440px]:min-h-[760px] min-[1920px]:min-h-[840px] min-[2400px]:min-h-[920px]';

/**
 * THE DOSSIER PLATE — the capture, full bleed, the first thing on the file.
 *
 * The only dark band at the top of the page, and the only place the mission
 * code and the place name are set large. Everything printed over the picture
 * is what is printed over the picture on the poster itself: the code, the
 * place, and the credit box carrying the capture timestamp and the
 * coordinates. Nothing sits under the floating header.
 */
export function MissionPlate({
  mission,
  className,
}: {
  mission: ExampleMission;
  className?: string;
}) {
  return (
    <figure className={cn('surface-dark flex flex-col', className)}>
      <div className={cn('relative w-full overflow-hidden', PLATE_H)}>
        <Image
          src={mission.src}
          alt={frameAlt(mission)}
          fill
          priority
          sizes="100vw"
          data-mosaic-source
          className="object-cover object-center"
        />

        {/*
          THE SAMPLING RASTER, AT THE HOMEPAGE'S READ.

          The same <MosaicField /> the homepage and the archive header run, at
          0.7. It sat at 0.3 on the argument that a dossier plate is the top of
          a document rather than a landing hero — it carries an h1, a mission
          code, a place and a coordinate rail, and all thirteen archive pages
          open on it. The argument was sound; the number was not, and it was
          never measured.

          `strength` multiplies THREE separate stages of the paint — the lamp
          body, the halo blits, and how far a lit cell pulls its own
          photographic sample out from under itself — so the light falls away
          far faster than linearly. Measured on this plate at 1440 with a
          pointer sweep across it, peak lit area (luminance > 120) against the
          homepage's own 5.1–6.3%:

            0.3   0.03%   max luminance 131 — never reaches white at all
            0.45  1.9%    229
            0.55  7.6%    253
            0.7   7.2–8.7%  255
            1.0   9.3%    255

          0.3 is not "the same effect, more subtle"; it is the effect switched
          off, which is what the owner was looking at. 0.7 lands on the
          homepage's read — slightly more lit area than the homepage, and
          FEWER blown-to-white cores (1.3–2.3% over 200, against the
          homepage's 2.0–3.1%). That last number is the concession the h1
          needs: the cascade arrives, and its hottest cells stay amber rather
          than becoming flat white blocks over running text.

          The resting lattice is untouched by `strength` in either direction —
          it is the structure of the thing, and dimming it would only look
          like a lower-contrast picture.

          z-[1], beneath both scrims at z-[2] and far beneath the copy, so no
          cascade can ever cross the type.
        */}
        <MosaicField className="z-[1]" strength={0.7} />

        {/* Legibility scrims — functional, never a decorative wash. */}
        <div
          aria-hidden
          className="absolute inset-0 z-[2] bg-linear-to-t from-void via-void/40 to-void/10"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 z-[2] h-36 bg-linear-to-b from-void/85 to-transparent"
        />

        <Container
          className={cn(
            'relative z-10 flex flex-col justify-end pb-10 min-[1280px]:pb-14 min-[1920px]:pb-16',
            PLATE_H,
          )}
        >
          <div className="flex flex-col gap-10 min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between min-[768px]:gap-12 min-[1920px]:gap-20">
            <div>
              <p
                data-telemetry
                className="font-mono text-[0.8125rem] uppercase tracking-[0.2em] text-paper/80"
              >
                MISSION {mission.code}
              </p>
              <h1 className="mt-6 max-w-[16ch] text-hero text-paper min-[1920px]:mt-8">
                {titleCase(mission.city)}, {titleCase(mission.country)}
              </h1>
              <p className="mt-6 text-label uppercase text-paper/70">
                {mission.orbit.sensor} · {mission.classification}
              </p>
            </div>

            {/* The print credit, in the corner of the frame, exactly as it
                sits on the finished poster. */}
            <div className="hidden shrink-0 min-[768px]:block">
              <CreditBox
                size="xs"
                align="right"
                orientation="stack"
                timestamp={mission.acquired.date ?? undefined}
                lat={mission.lat}
                lon={mission.lon}
              />
            </div>
          </div>
        </Container>
      </div>
    </figure>
  );
}
