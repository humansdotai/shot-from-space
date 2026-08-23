import type { Metadata } from 'next';
import { CATALOGUE, acquisitionLabel } from '@/lib/imagery';
import { isLive } from '@/lib/env';
import { formatCoords } from '@/lib/utils';
import { DocHeader } from '../DocHeader';
import { DocParagraph, DocSection } from '../DocSection';

export const metadata: Metadata = {
  title: 'Imagery credits',
  description:
    'Every example frame shown on this site is a public-domain NASA / USGS Landsat product, credited in full.',
};

/**
 * The attribution list below is a licensing requirement, not a design element.
 * Every frame in /public/imagery appears here with its source record; nothing
 * is summarised away and nothing is collapsed behind a control.
 *
 * ------------------------------------------------------------------
 * EVERY DATE ON THIS PAGE IS THE ONE THE SOURCE RECORD STATES.
 * ------------------------------------------------------------------
 * This page used to print an invented 2026 timestamp as each scene's capture
 * date, sitting directly beside a credit line naming the real acquisition —
 * Berlin dated 04.03.2026 next to a credit reading "Berlin 1986 07 31". It
 * read as a false attribution on public-domain imagery, which is the one
 * thing an attribution page cannot do.
 *
 * The dates now come from `frame.acquired`, which carries the record's own
 * date at the record's own precision, plus the sentence that justifies it.
 * A scene the record does not date renders as "DATE NOT STATED" — that is a
 * correct answer and it is meant to be visible. Do not fill it in with a
 * plausible one.
 */
export default function ImageryCreditsPage() {
  // Mock mode backs a mission's preview with one of these same archive frames,
  // so the page must not claim that missions are never drawn from the archive.
  const captureIsLive = isLive('skyfi');

  return (
    <>
      <DocHeader
        index="03"
        title="Imagery credits"
        revised="2026-08-01T00:00:00Z"
        summary="Every example frame in the mission archive is a public-domain NASA or USGS Landsat product. Nothing shown here is licensed, purchased or third-party owned. Each frame is listed with the acquisition date its own source record states."
      />

      <DocSection index="01" heading="Resolution">
        <DocParagraph>
          Landsat resolves roughly thirty metres per pixel — city blocks, coastlines,
          infrastructure. These frames demonstrate how a mission is composed, not what a
          tasked capture resolves. A commissioned mission is captured at sub-metre
          resolution.
        </DocParagraph>
      </DocSection>

      <DocSection index="02" heading="Where these frames appear">
        <DocParagraph>
          They are the mission archive, the landing page and the format examples. They are
          not customer captures, and none of them was made to order: the oldest was
          acquired in 1986.
        </DocParagraph>
        <DocParagraph>
          {captureIsLive
            ? 'A commissioned mission is captured to order and is not drawn from this archive. Until its own frame is downlinked, a mission file shows no frame at all.'
            : 'This deployment is running in demonstration mode, with satellite tasking mocked. While it is, a mission file is backed by one of the frames credited below rather than by a capture of its target — so a frame on a demonstration mission page is an archive frame, credited here.'}
        </DocParagraph>
      </DocSection>

      <DocSection index="03" heading="Catalogue">
        <ul className="flex flex-col">
          {CATALOGUE.map((frame) => (
            <li key={frame.slug} className="border-t border-hairline py-5 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <span className="font-mono text-tele-s uppercase text-paper">
                  {frame.city} — {frame.country}
                </span>
                <span
                  data-telemetry
                  className="font-mono text-tele-s uppercase tabular-nums text-paper-faint"
                >
                  {formatCoords(frame.lat, frame.lon)}
                </span>
              </div>

              <p
                data-telemetry
                className="mt-2 font-mono text-tele-s uppercase text-paper-faint"
              >
                {frame.orbit.sensor} · {frame.width}×{frame.height} · ACQUIRED{' '}
                {acquisitionLabel(frame.acquired)}
              </p>

              <p className="mt-3 max-w-[68ch] break-words text-prose text-paper-dim">
                {frame.credit}
              </p>

              {/* The evidence for the date, in the reader's own view. An
                  attribution that cannot be re-checked is an assertion. */}
              <p className="mt-2 max-w-[68ch] text-note text-paper-faint">
                {frame.acquired.basis}
              </p>

              <a
                href={frame.source}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-flex min-h-11 w-fit items-center text-action text-paper-dim underline underline-offset-4 transition-colors hover:text-paper"
              >
                Source record
              </a>
            </li>
          ))}
        </ul>
      </DocSection>

      <footer className="border-t border-hairline pt-6">
        {/* §A2. Two sentences of attribution. The source string was
            typed in caps as well as being run through an uppercase
            class — a disclaimer nobody can read is not a disclaimer. */}
        <p className="max-w-[62ch] text-note text-paper-faint">
          NASA and USGS material is in the public domain. This site is not endorsed by,
          affiliated with or produced by NASA or the USGS.
        </p>
      </footer>
    </>
  );
}
