import { Band, Button, Container } from '@/components/fui';
import { MATERIALS, PACKAGING } from '@/lib/guarantees';
import { FeatureRow } from './FeatureRow';
import { PosterPreview } from './PosterPreview';
import { MEASURE } from './geometry';

/**
 * 08 · WHAT ARRIVES — light. Feature/announcement, MEDIA RIGHT.
 *
 * The second of the three alternating feature rows, and the side flips: the
 * mission clock put its picture on the left, this one puts it on the right.
 *
 * It sits on the paper directly under the record because this is the object
 * that carries that record — the light-on-light join is the argument, not an
 * oversight. It is also where the paper finally gets to speak: the top third
 * of this page sells a pass, and the print specification is not allowed to
 * appear until a visitor already believes a satellite will be moved for them.
 *
 * The poster miniature does all of the work now, hung in the aluminium
 * presentation moulding and given the full media column.
 *
 * THE PATCH AND THE COIN USED TO STAND BESIDE IT HERE, IN A SECTION HEADED
 * "WHAT ARRIVES". They do not arrive. They are honorary and digital —
 * conferred on the mission, held on its file, never manufactured and never
 * posted — so a section whose entire job is to enumerate the contents of the
 * box is the one place on the site they must not be depicted. Showing an
 * embroidered patch under that heading is a promise the parcel cannot keep.
 * They are shown in full, and described accurately, on the mission file
 * itself (`components/mission/HonoursBlock.tsx`); the paragraph at the foot
 * of this column says what they are.
 *
 * Every specification is read from lib/guarantees.ts, which describes what
 * lib/integrations/gelato.ts actually orders, so the page cannot promise
 * something the fulfilment pipeline does not buy. This list used to say
 * "Museum-grade cotton" and "Pigment"; neither is in the print catalogue.
 *
 * ------------------------------------------------------------------
 * WHAT CHANGES AT EACH BREAKPOINT
 * ------------------------------------------------------------------
 *   < 1280  poster full width, the two artifacts side by side under it
 *   1280    the media column splits: poster left of the artifacts, which
 *           stack — otherwise a 5:7 poster in half a column runs a
 *           thousand pixels tall
 *   1920    the media column takes the extra width and the text column
 *           narrows, so the specification list keeps its measure
 */
const SPEC = [
  { label: 'Paper', value: MATERIALS.paper },
  { label: 'Formats', value: '30 × 40 · 50 × 70 · 70 × 100 cm' },
  { label: 'Frame', value: `Optional — ${MATERIALS.frameLower}, ${MATERIALS.glazing} glazing` },
  { label: 'Packing', value: `Unframed ${PACKAGING.unframedShort.toLowerCase()}; framed ready to hang` },
  { label: 'Printed in', value: 'Reno NV or Eindhoven NL' },
  { label: 'In the price', value: 'Shipping and duties' },
];

export function ObjectBand() {
  return (
    <Band tone="light" top="snug" bottom="open">
      <Container className={MEASURE}>
        <FeatureRow
          side="right"
          media={<PosterPreview className="mx-auto w-full max-w-[420px] min-[1280px]:max-w-none" />}
        >
          <p className="font-mono text-tele-s uppercase ink-faint">What arrives</p>
          <h2 className="mt-3 max-w-[18ch] text-display ink">
            A print, and a file that stays open.
          </h2>
          <p className="mt-5 max-w-[46ch] text-body ink-dim">
            The photograph is printed with its own telemetry set beneath it, the way a flight
            document is printed: the frame on top, the record underneath. Unframed, it{' '}
            {PACKAGING.unframed}; framed, it {PACKAGING.framed}. The print is the only object
            in the box.
          </p>

          <h3 className="mt-8 font-mono text-tele-s uppercase ink-faint">Print specification</h3>
          <dl className="mt-3">
            {SPEC.map((s) => (
              <div
                key={s.label}
                className="row-hover flex items-baseline justify-between gap-6 border-t rule-ground py-3"
              >
                <dt className="text-label uppercase ink-faint">{s.label}</dt>
                <dd data-telemetry className="text-right text-body ink">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>

          {/* FIVE, NOT FOUR, AND THE LIST IS `HonoursBlock`'s OWN ORDER.
              The Mission plate was added to `DISTINCTIONS` and this sentence
              was not updated with it, so the page undercounted the set it was
              describing and named a list that no longer matched the one a
              buyer sees on the file. Both halves are read off
              `components/mission/HonoursBlock.tsx`; if a sixth is ever
              conferred, this line changes with it. The second sentence is the
              load-bearing one and it does not move: the five are DIGITAL, and
              the print is the only thing that is manufactured or posted. */}
          <p className="mt-8 max-w-[42ch] text-body ink-dim">
            Five honorary distinctions — a plate, a patch, a badge, a coin and a pin — are
            conferred on the mission and held on its file. They are digital: nothing beyond the
            print is manufactured or posted. The file does not expire when the print ships.
          </p>

          {/*
            The second action on the page. The object has just been argued in
            full — paper, ink, format, frame, facility — so this is where a
            reader who came for the print, rather than for the orbit, is
            ready to act. It sits inside the text column and takes the
            column's ground, so it inverts with the band like every other
            control on the page.
          */}
          <Button variant="primary" size="lg" href="/mission" className="mt-8">
            Start a mission
          </Button>
        </FeatureRow>
      </Container>
    </Band>
  );
}
