import Link from 'next/link';
import { Band, Button, Container } from '@/components/fui';
import { Arrow } from './Arrow';
import { FeatureRow } from './FeatureRow';
import { Plate } from './Plate';
import { MEASURE } from './geometry';
import { frameBySlug } from '@/lib/imagery';
import { titleCase } from '@/lib/gallery';
import { CLOUD_THRESHOLD_WORD } from '@/lib/guarantees';
import { formatCoords } from '@/lib/utils';

/**
 * 05 · MISSION CLOCK — light. Feature/announcement, MEDIA LEFT.
 *
 * The first of the three alternating feature rows. On paper, because this
 * is the record half of the poster: the sequence of events, timed.
 *
 * The steps are labelled with a mission clock rather than 01 / 02 / 03,
 * because the deliverable already keeps time that way — every event on the
 * printed sheet is stamped as an offset from range zero, the second the
 * frame is exposed. The eyebrow is therefore real data, not decoration:
 * negative before the shutter, positive after it.
 *
 * The four moments are rows, not cards. A card grid here would repeat the
 * mosaic three bands above it; a hairline list under a photograph is the
 * document voice the rest of the page speaks in.
 */
const STEPS = [
  {
    clock: 'T − 21 d',
    title: 'You name the target',
    body: 'An address becomes a coordinate pair to four decimal places and a capture area of roughly one square kilometre.',
  },
  {
    clock: 'T − 03 d',
    title: 'The satellite is tasked',
    body: 'The order is filed against a sun-synchronous orbit. A specific target comes back around every one to three days, off-nadir under 25°.',
  },
  {
    clock: 'T 00:00:00',
    title: 'The frame is exposed',
    body:
      `One pass, one frame, about half a metre to a pixel. Cloud over ${CLOUD_THRESHOLD_WORD} percent ` +
      'fails the frame and the pass is re-tasked at no cost.',
  },
  {
    clock: 'T + 72:00:00',
    title: 'Declassified for print',
    body: 'The frame is composed with its own telemetry, cleared for release and handed to fulfilment as a finished object.',
  },
];

export function PassBand() {
  const frame = frameBySlug('samarkand-uz');

  return (
    <Band tone="light" top="open" bottom="open">
      <Container className={MEASURE}>
        <FeatureRow
          side="left"
          media={
            frame ? (
              <Plate
                src={frame.src}
                alt={`Satellite capture of ${titleCase(frame.city)}, ${titleCase(frame.country)}, at the resolution one pass returns`}
                aspect="aspect-[4/3] min-[768px]:aspect-[3/4] min-[1280px]:aspect-[4/5]"
                sizes="(min-width: 1280px) 50vw, (min-width: 768px) 50vw, 92vw"
                caption={`${titleCase(frame.city)}, ${titleCase(frame.admin)}`}
                meta={formatCoords(frame.lat, frame.lon)}
              />
            ) : null
          }
        >
          <p className="font-mono text-tele-s uppercase ink-faint">Mission clock</p>
          <h2 className="mt-3 max-w-[18ch] text-display ink">
            Range zero is the second the shutter opens.
          </h2>
          <p className="mt-5 max-w-[46ch] text-body ink-dim">
            Everything a mission does is logged against that instant, before it happens and
            after. Four moments matter, and you watch all four land in the file as they happen.
          </p>

          <dl className="mt-8">
            {STEPS.map((step) => (
              <div key={step.clock} className="row-hover border-t rule-ground py-4">
                <dt className="flex items-baseline justify-between gap-4">
                  <span className="text-[1.0625rem] leading-[1.25] font-normal tracking-[-0.01em] ink">
                    {step.title}
                  </span>
                  <span
                    data-telemetry
                    className="shrink-0 font-mono text-tele-s uppercase ink-faint"
                  >
                    {step.clock}
                  </span>
                </dt>
                <dd className="mt-3 max-w-[42ch] text-body ink-dim">{step.body}</dd>
              </div>
            ))}
          </dl>

          {/*
            The page's first action since the hero, roughly one screen and a
            half down (SPEC-V4 §B). The reader has just been shown the whole
            sequence from address to shipped object, which is the earliest
            point at which "start" means something specific. A button and a
            link, never two buttons — one of them is the action and the
            other is the way out of committing to it yet.

            It opens `/mission`, the configurator, which is the site's
            funnel. There is no address to carry at this point in the page —
            the two fields that have one, in the hero and in band 08
            (<OrbitEntryBand />, which used to be band 03 and sits three
            bands BELOW this one now), pass it as `?address=&lat=&lon=`.
          */}
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Button variant="primary" size="lg" href="/mission">
              Start a mission
            </Button>

            <Link
              href="/how-it-works"
              className="group link-underline inline-flex min-h-11 items-center gap-2 text-action ink transition-house hover:text-[color:var(--accent)]"
            >
              Read the method in full
              <Arrow direction="right" />
            </Link>
          </div>
        </FeatureRow>
      </Container>
    </Band>
  );
}
