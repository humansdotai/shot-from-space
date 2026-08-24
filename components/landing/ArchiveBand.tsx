import Image from 'next/image';
import Link from 'next/link';
import { Band, Container, Grid12 } from '@/components/fui';
import { Arrow } from './Arrow';
import { BandHead } from './BandHead';
import { MEASURE } from './geometry';
import { listExampleMissions, titleCase } from '@/lib/gallery';
import { cn } from '@/lib/utils';

/**
 * 10 · MISSION ARCHIVE — light. News/index (SYSTEM-V3 §5.6).
 *
 * A dated index with a lead item. Ours is not a newsroom — Shot from Space
 * has no announcements to make and inventing some would be the same lie as
 * inventing a testimonial — so the index is the thing we genuinely publish:
 * the example missions, each one a real frame from the public Landsat
 * archive, filed the way a commissioned mission is filed and dated by the
 * moment it was captured.
 *
 * The lead is the most recent capture, chosen by the data rather than by
 * hand: `listExampleMissions()` is sorted newest-first, so the index
 * re-leads itself whenever a frame is added to the catalogue.
 *
 * ------------------------------------------------------------------
 * WHAT CHANGES AT EACH BREAKPOINT
 * ------------------------------------------------------------------
 *   < 768   lead stacks, each row breaks into a date line over a place
 *           line — two lines, which is what makes a row 76px tall and
 *           comfortably past the 44px touch minimum
 *   768     lead goes 6 / 6, rows collapse onto one line with the date on
 *           a fixed 7.5rem rail
 *   1280    the lead's text column moves onto the same 9—12 rail the band
 *           head's lede sits on, and the rows gain the instrument column —
 *           extra width buys another field, not a longer line
 *   1920    the lead frame opens to 21:9 and the index takes the column's
 *           first measured step up
 */
const ROW_COUNT = 6;

export function ArchiveBand() {
  const missions = listExampleMissions();
  const lead = missions[0];
  const rest = missions.slice(1, 1 + ROW_COUNT);

  if (!lead) return null;

  return (
    <Band tone="light" top="open" bottom="open">
      <Container className={MEASURE}>
        <BandHead
          label="Mission archive"
          title="Every frame is published as a dated file."
          lede="Reference missions, open to read in full. Each one carries the frame, the
                instrument that took it, the orbit it was taken from and the date it was
                exposed."
        />

        {/* ---------- The lead item ---------- */}
        <Link
          href={`/missions/${lead.code}`}
          className="group mt-12 block border-t rule-ground pt-8"
        >
          <Grid12 className="items-start gap-y-8">
            <div className="col-span-12 min-[768px]:col-span-6 min-[1280px]:col-span-7">
              <div
                className={cn(
                  'relative w-full overflow-hidden rounded-card bg-void',
                  'aspect-[4/3] min-[768px]:aspect-[3/2] min-[1920px]:aspect-[21/9]',
                )}
              >
                <Image
                  src={lead.src}
                  alt={`Satellite capture of ${titleCase(lead.city)}, ${titleCase(lead.country)}`}
                  fill
                  sizes="(min-width: 1280px) 58vw, (min-width: 768px) 50vw, 92vw"
                  className="object-cover object-center transition-transform duration-house ease-house group-hover:scale-[1.03] motion-reduce:transform-none!"
                />
              </div>
            </div>

            <div className="col-span-12 min-[768px]:col-span-6 min-[1280px]:col-span-4 min-[1280px]:col-start-9">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span data-telemetry className="font-mono text-tele-s uppercase ink-faint">
                  {lead.acquiredLabel}
                </span>
                <span className="font-mono text-tele-s uppercase ink-faint">
                  Mission {lead.code}
                </span>
              </div>

              {/* No accent on the heading (SPEC-V4 §A5: never a heading
                  colour). The card's hover is already carried by the
                  media scale and by the CTA below, which is the element
                  the tint belongs on. */}
              <h3 className="mt-3 max-w-[16ch] text-heading ink">
                {titleCase(lead.city)}, {titleCase(lead.country)}
              </h3>

              <p className="mt-5 max-w-[46ch] text-body ink-dim">{lead.summary}</p>

              <span className="mt-8 inline-flex min-h-11 items-center gap-2 text-action ink transition-house group-hover:text-[color:var(--accent)]">
                Open mission {lead.code}
                <Arrow />
              </span>
            </div>
          </Grid12>
        </Link>

        {/* ---------- The dated index ---------- */}
        <div className="mt-8">
          {rest.map((m) => (
            <Link
              key={m.code}
              href={`/missions/${m.code}`}
              className="group row-hover flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t rule-ground py-4"
            >
              <span
                data-telemetry
                className="w-full font-mono text-tele-s uppercase ink-faint min-[768px]:w-[7.5rem] min-[768px]:shrink-0"
              >
                {m.acquiredLabel}
              </span>

              <span className="min-w-0 flex-1 text-body ink transition-house group-hover:text-[color:var(--accent)]">
                {titleCase(m.city)}, {titleCase(m.country)}
              </span>

              <span className="hidden font-mono text-tele-s uppercase ink-faint min-[1280px]:block">
                {m.orbit.sensor} · {m.orbit.gsdM} m
              </span>

              <Arrow direction="right" className="ink-faint self-center" />
            </Link>
          ))}
        </div>

        <Link
          href="/missions"
          className="group link-underline mt-8 inline-flex min-h-11 items-center gap-2 text-action ink transition-house hover:text-[color:var(--accent)]"
        >
          Open the archive — {missions.length} missions
          <Arrow direction="right" />
        </Link>
      </Container>
    </Band>
  );
}
