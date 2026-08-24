import Link from 'next/link';
import { Band, Button, Container } from '@/components/fui';
import { Arrow } from './Arrow';
import { BandHead } from './BandHead';
import { FeatureRow } from './FeatureRow';
import { Plate } from './Plate';
import { MEASURE } from './geometry';
import { frameBySlug } from '@/lib/imagery';
import { titleCase } from '@/lib/gallery';
import { CLOUD_THRESHOLD_WORD } from '@/lib/guarantees';
import { formatCoords } from '@/lib/utils';

/**
 * 09 · BEFORE YOU ASK — dark. Feature/announcement, MEDIA LEFT.
 *
 * The third alternating feature row, and the side flips back.
 *
 * Objection handling, answered with a photograph rather than a paragraph:
 * the honest thing to do about resolution is show a capture and list what
 * it does and does not contain. Both lists come from /how-it-works, so the
 * promise here is the one the rest of the site makes.
 *
 * The four questions underneath are the ones that actually stop a purchase
 * — time, weather, origin, privacy — and each is answered with a number.
 * They run as hairline rows in two columns from 768; a third column would
 * take each answer below its 48-character measure.
 */
const RESOLVES = [
  'The driveway, and parked cars as distinct rectangles',
  'A pool, a patio, a lawn, individual mature trees',
  'The street pattern your address sits inside',
];

const DOES_NOT = [
  'Faces — a person is a mark two pixels across',
  'Number plates, house numbers, any text on the ground',
  'Windows, and anything on the other side of one',
  'Anything indoors, under a canopy or under a tree',
];

const QUESTIONS = [
  {
    q: 'How long does it take?',
    a: 'Tasking is filed within a day of payment. A specific target comes back around every one to three days, and the capture window normally closes inside seven to fourteen. Printing and delivery add a few days once the frame is approved.',
  },
  {
    q: 'What if the sky is in the way?',
    a:
      'Every attempt is logged in your file, including the ones that fail. Cloud above ' +
      `${CLOUD_THRESHOLD_WORD} percent over the target fails the frame and the next pass is ` +
      're-tasked at no cost. Northern winters take longer; none of that is charged to you.',
  },
  {
    q: 'Where does it print?',
    a: 'Nevada for the United States and most of the world, the Netherlands for the EU, the UK and Switzerland. Short transit, and no customs bill waiting at the door.',
  },
  {
    q: 'Who can see my address?',
    a: 'The mission file and the public archive show a city, never a street address. The record says where the frame was taken, not who asked for it.',
  },
];

export function AnswersBand() {
  const frame = frameBySlug('seattle-us');

  return (
    <Band tone="dark" top="open" bottom="open">
      <Container className={MEASURE}>
        <BandHead
          label="Before you ask"
          title="Half a metre to a pixel, and what that buys."
          lede="The honest answer about resolution is a capture at the resolution you get, and
                two lists: what it holds, and what it never will."
        />

        <FeatureRow
          side="left"
          className="mt-12"
          media={
            frame ? (
              <Plate
                src={frame.src}
                alt={`Satellite capture of ${titleCase(frame.city)}, ${titleCase(frame.admin)}, at the resolution a mission delivers`}
                aspect="aspect-[4/3] min-[1280px]:aspect-[3/2]"
                sizes="(min-width: 768px) 50vw, 92vw"
                caption={`${titleCase(frame.city)}, ${titleCase(frame.admin)}`}
                meta={formatCoords(frame.lat, frame.lon)}
              />
            ) : null
          }
        >
          <h3 className="font-mono text-tele-s uppercase ink-faint">You will see</h3>
          <ul className="mt-3">
            {RESOLVES.map((item) => (
              <li key={item} className="row-hover border-t rule-ground py-3 text-body ink">
                {item}
              </li>
            ))}
          </ul>

          <h3 className="mt-8 font-mono text-tele-s uppercase ink-faint">You will not</h3>
          <ul className="mt-3">
            {DOES_NOT.map((item) => (
              <li key={item} className="row-hover border-t rule-ground py-3 text-body ink-dim">
                {item}
              </li>
            ))}
          </ul>
        </FeatureRow>

        <div className="mt-12 grid grid-cols-1 gap-x-[var(--grid-gap-x)] min-[768px]:grid-cols-2 min-[768px]:gap-x-12">
          {QUESTIONS.map((item) => (
            <div key={item.q} className="row-hover border-t rule-ground py-5">
              <h3 className="text-[1.0625rem] leading-[1.25] font-normal tracking-[-0.01em] ink">
                {item.q}
              </h3>
              <p className="mt-3 max-w-[48ch] text-body ink-dim">{item.a}</p>
            </div>
          ))}
        </div>

        {/*
          The third action, and the one placed where the objections have
          just been answered rather than where the price is quoted — a
          reader who has read the four questions above has finished
          hesitating, and the price is still two bands away.
        */}
        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t rule-ground pt-8">
          <Button variant="primary" size="lg" href="/mission">
            Start a mission
          </Button>

          <Link
            href="/legal/terms"
            className="group link-underline inline-flex min-h-11 items-center gap-2 text-action ink transition-house hover:text-[color:var(--accent)]"
          >
            Read the terms
            <Arrow direction="right" />
          </Link>
        </div>
      </Container>
    </Band>
  );
}
