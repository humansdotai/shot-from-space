import Image from 'next/image';
import { FramedPoster } from '@/components/artifact';
import { CreditBox } from '@/components/fui';
import { PRINT_EXAMPLE } from './example-mission';
import { cn } from '@/lib/utils';

/**
 * A miniature of the printed poster — the object the whole page sells.
 *
 * The composition is the deliverable's own: a full-bleed frame across the top
 * two thirds with the lockup, the rotated ORIGINAL, the print credit and the
 * mission code set into it, then a paper panel underneath carrying the mission
 * heading, its purpose, the sequence of events, the orbit and the mission URL.
 * Dark over light, at poster proportion (5:7, the standard 50 × 70 cm format).
 *
 * It is a depiction of a print, so its type is small by design — every size
 * here is a fraction of a real one, which is what makes it read as an object
 * rather than as a section of the page. All of it is true: the frame, the
 * capture stamp and the orbit come from the same example mission the file
 * behind /m/74KL records.
 *
 * ------------------------------------------------------------------
 * THE MOUNT
 * ------------------------------------------------------------------
 * The composition is handed to <FramedPoster /> as `children` rather than
 * drawn on a bare sheet, so it hangs in the same milled aluminium moulding —
 * and under the same wall shadow and damped tilt — as every other poster on
 * the site. That component owns the hover entirely: the old `group-hover`
 * lift on the sheet and the 1.03 scale on the satellite frame are gone,
 * because two hover treatments on one object fight each other.
 *
 * The mount shown is a DISPLAY frame and the caption says so. The frame that
 * actually ships is black wood behind acrylic — `MATERIALS.framedSpec`, which
 * describes the Gelato UID this site orders — and the specification list
 * beside this preview states that. A picture of an aluminium frame next to a
 * line reading "black wood" is a contradiction a reader can see in one
 * glance, so the caption resolves it rather than leaving it to be noticed.
 */
export function PosterPreview({ className }: { className?: string }) {
  return (
    <figure className={cn('m-0', className)}>
      <FramedPoster ratio="5:7">
        {/*
          THE SHEET IS ITS OWN CONTAINER, and every measurement inside it is a
          fraction of its width.

          This composition is a picture of a printed object. A printed object's
          internal proportions do not change when a browser window changes, so
          none of the type below may be set in `rem` with `sm:` / `lg:` steps —
          those are VIEWPORT breakpoints, and this object's width is set by the
          band that mounts it, which is a different number entirely.

          The bug that came from mixing the two was measurable and ugly: at 320
          the sheet is 246px wide, its data panel is 34% of 345px = 117px tall,
          and the record paragraph at a viewport-fixed 8px/1.75 took five lines
          and ran straight through the orbit glyph and the `Orbit:` block that
          is pinned to `bottom-[7%]`. Text on text, both unreadable. It also
          explained why the fault was NOT monotonic in viewport width — at 390
          the sheet is 314px and clears it, at 768 it is 329px and collides,
          because 768 crosses `sm:` and steps every size in the panel UP while
          the object itself barely grew.

          `container-type: inline-size` plus `cqw` removes the viewport from
          the object entirely. Every value below is calibrated at the 650px
          sheet — the 1440 mount, where this design was drawn — so the large
          end is unchanged to the pixel and every smaller mount is now the
          same composition photographed from further away, which is what a
          miniature of a print is.
        */}
        <div className="relative h-full w-full bg-paper [container-type:inline-size]">
        {/* --- Top: the frame ------------------------------------- */}
        <div className="relative h-[66%] w-full overflow-hidden bg-void on-dark">
          <Image
            src={PRINT_EXAMPLE.frame.src}
            alt={PRINT_EXAMPLE.frame.alt}
            fill
            sizes="(min-width: 1024px) 46vw, 92vw"
            className="object-cover"
          />

          {/* A short scrim along the foot of the frame. The print has its own
              dark ground there; a satellite frame does not, and the credit
              rail has to stay readable over whatever the sensor returned. */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-void/85 via-void/40 to-transparent"
          />

          {/* Lockup, top-left — the poster's own placement. */}
          <div className="absolute left-[4%] top-[4%] w-[34%] max-w-[150px] drop-shadow-[0_1px_3px_rgba(8,9,11,0.6)]">
            <Image
              src="/brand/logo-wordmark.svg"
              alt="Shot from Space"
              width={596}
              height={124}
              className="h-auto w-full"
            />
          </div>

          {/* Rotated ORIGINAL down the right edge. */}
          <span
            aria-hidden
            className="absolute right-[2.5%] top-[8%] font-mono text-[1.38cqw] uppercase leading-none tracking-[0.3em] text-paper/85 drop-shadow-[0_1px_3px_rgba(8,9,11,0.6)] [writing-mode:vertical-rl]"
          >
            Original
          </span>

          {/* Print credit + capture timestamp, bottom-left.

              <CreditBox /> is a shared `components/fui` stamp and its `xs`
              size is a fixed 9px — correct on a page, wrong on a miniature,
              because it is the one element in this composition that does not
              shrink with the sheet. Measured at 320, where the sheet is
              246px: the credit rail ran to x=247 and the MISSION lockup
              opposite it started at x=236, an 11px collision.

              Rather than fork the stamp, the whole rail is scaled by the same
              ratio everything else here uses — the sheet's width over the
              650px reference — anchored at its own bottom-left corner so the
              4% / 5% inset it sits on does not move. At the reference width
              the ratio is exactly 1 and nothing about it changes. */}
          <div className="absolute bottom-[5%] left-[4%] origin-bottom-left [scale:calc(100cqw_/_650px)] [&_*]:text-paper">
            <CreditBox timestamp={PRINT_EXAMPLE.capturedAt} size="xs" />
          </div>

          {/* MISSION 74KL, bottom-right, wide display type. */}
          <div className="absolute bottom-[5%] right-[4%] text-right font-mono text-[2.77cqw] uppercase leading-[1.15] tracking-[0.18em] text-paper">
            <span className="block">Mission</span>
            <span data-telemetry className="block">
              {PRINT_EXAMPLE.code}
            </span>
          </div>
        </div>

        {/* --- Bottom: the data panel ----------------------------- */}
        <div className="surface-light relative h-[34%] w-full px-[4%] py-[3.5%]">
          <div className="flex items-start justify-between gap-[1.85cqw]">
            <span
              data-telemetry
              className="font-mono text-[1.7cqw] uppercase leading-none tracking-[0.16em] ink"
            >
              Mission / {PRINT_EXAMPLE.code}
            </span>
            <span className="font-mono text-[1.54cqw] uppercase leading-none tracking-[0.14em] ink-dim">
              {PRINT_EXAMPLE.url}
            </span>
          </div>

          <div className="mt-[3.5%] flex items-start justify-between gap-[6%]">
            <p className="max-w-[34ch] font-mono text-[1.38cqw] uppercase leading-[1.75] ink-dim">
              {PRINT_EXAMPLE.purposeShort}
            </p>

            <dl className="w-[42%] shrink-0">
              <dt className="font-mono text-[1.23cqw] uppercase leading-none tracking-[0.2em] ink-faint">
                Sequence of events
              </dt>
              {PRINT_EXAMPLE.sequence.map((e) => (
                <dd
                  key={e.label}
                  className="mt-[0.86cqw] flex items-baseline justify-between gap-[1.23cqw] border-b rule-ground pb-[0.5cqw] font-mono text-[1.23cqw] uppercase leading-[1.5] ink-dim"
                >
                  <span className="truncate">{e.label}</span>
                  <span data-telemetry className="shrink-0 ink">
                    {e.elapsed}
                  </span>
                </dd>
              ))}
            </dl>
          </div>

          <div className="absolute bottom-[7%] left-[4%] flex items-end gap-[1.23cqw]">
            <PosterOrbitGlyph />
            <span className="font-mono text-[1.38cqw] uppercase leading-[1.4] tracking-[0.14em] ink-dim">
              Orbit:
              <br />
              {PRINT_EXAMPLE.orbitTrack}
            </span>
          </div>

          <span
            aria-hidden
            className="absolute bottom-[7%] right-[3%] font-mono text-[1.23cqw] uppercase leading-none tracking-[0.3em] ink-faint [writing-mode:vertical-rl]"
          >
            Declassified
          </span>
        </div>
        </div>
      </FramedPoster>

      <figcaption className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-tele-s uppercase ink-dim">
          Format 50 × 70 cm — display mount shown
        </span>
        <span className="font-mono text-tele-s uppercase ink-faint">Example mission</span>
      </figcaption>
    </figure>
  );
}

/** The small graticule glyph the poster prints beside its orbit readout. */
function PosterOrbitGlyph() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className="h-[4cqw] w-[4cqw] shrink-0 opacity-70"
    >
      <g stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <circle cx="20" cy="20" r="13" />
        <ellipse cx="20" cy="20" rx="13" ry="5" />
        <ellipse cx="20" cy="20" rx="6.5" ry="13" />
        <line x1="7" y1="14" x2="33" y2="14" />
        <line x1="7" y1="26" x2="33" y2="26" />
      </g>
      <circle cx="20" cy="20" r="2" fill="currentColor" />
    </svg>
  );
}
