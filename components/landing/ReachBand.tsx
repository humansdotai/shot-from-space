import { Band, Container } from '@/components/fui';
import { BandHead } from './BandHead';
import { CLOUD_THRESHOLD_WORD } from '@/lib/guarantees';
import { FeaturedMosaic } from './FeaturedMosaic';
import { MEASURE } from './geometry';

/**
 * 03 · COVERAGE — light, and the page's first opt-out from the column.
 *
 * The band that has to land the repositioning: what is being sold is a
 * pass, not a poster. It opens on the column with a head, drops the column
 * entirely for the featured mosaic — ten real frames, edge to edge — and
 * comes back to the column for the three specifications that make a target
 * reachable: where it is, what flies over it, and what the sensor gets when
 * it does.
 *
 * Every value is the one published on /how-it-works, so the pitch and the
 * method cannot drift apart. Nothing in this band mentions paper.
 *
 * ------------------------------------------------------------------
 * WHAT CHANGES AT EACH BREAKPOINT
 * ------------------------------------------------------------------
 *   < 768   spec columns stack
 *   768     three specs across, mosaic goes to four columns
 *   1280    mosaic to six columns
 *   1920    mosaic to eight, and the column takes its first measured step
 *           up; the spec row stays at three, because each column is a
 *           38-character measure and widening it would buy a longer line
 *   2400    mosaic to ten columns and two more frames
 *
 * The spec columns deliberately do NOT carry `row-hover`: that idiom bleeds
 * its highlight 10px past the text on both sides, which is right for a list
 * row and wrong here — it would push each rule outside its own column and
 * close the gutter between them to nothing.
 */
const CAPABILITY = [
  {
    label: 'Target',
    value: '≈ 1 km² · 4 dp',
    body: 'An address resolves to a coordinate pair at four decimal places, and a capture area of about one square kilometre is drawn around it — the building, its street, and the ground it sits in.',
  },
  {
    label: 'Orbit',
    value: 'SSO 98.2° · ≤ 25°',
    body: 'The request is filed against a sun-synchronous orbit, which crosses your latitude at the same solar hour on every pass and returns to a specific target every one to three days.',
  },
  {
    label: 'Frame',
    value: '≈ 0.50 m / px',
    body:
      `One pass, one exposure, about half a metre to a pixel. Cloud over ${CLOUD_THRESHOLD_WORD} percent ` +
      'of the target fails the frame, and the next pass is booked at our cost rather than yours.',
  },
];

export function ReachBand() {
  return (
    <Band tone="light" top="open" bottom="open">
      <Container className={MEASURE}>
        <BandHead
          label="Coverage"
          title="Any address on Earth is a target."
          lede="You are not buying a photograph off a shelf. You are buying one pass of a working
                imaging satellite, aimed at a place you name, and everything the pass returns."
        />
      </Container>

      {/* The column stops here. The mosaic is the band's full width. */}
      <div className="mt-12">
        <FeaturedMosaic />
      </div>

      <Container className={`mt-12 ${MEASURE}`}>
        {/* §A2. Two sentences, and the 92ch measure was the tell — no
            label needs ninety-two characters. Set as prose. */}
        <p className="max-w-[68ch] text-note ink-faint">
          Frames from the public Landsat archive, filed the way a commissioned mission is
          filed. Open any one to read it.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-x-[var(--grid-gap-x)] gap-y-8 min-[768px]:grid-cols-3">
          {CAPABILITY.map((c) => (
            <div key={c.label} className="border-t rule-ground pt-4">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-mono text-tele-s uppercase ink-faint">{c.label}</h3>
                <span data-telemetry className="font-mono text-tele-s uppercase ink">
                  {c.value}
                </span>
              </div>
              <p className="mt-3 max-w-[38ch] text-body ink-dim">{c.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </Band>
  );
}
