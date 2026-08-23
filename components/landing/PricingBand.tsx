import { Band, Button, Container } from '@/components/fui';
import { BandHead } from './BandHead';
import { FormatPrice } from './FormatPrice';
import { Guarantees } from './Guarantees';
import { MEASURE } from './geometry';
import { FormatSilhouette, sheetOf } from '@/components/format/FormatSilhouette';
import { FORMATS, FULFILMENT_NOTE, PRINT_FACILITY } from '@/lib/pricing';
import { guaranteeTerm } from '@/lib/guarantees';

/**
 * 12 · FORMATS AND TERMS — light.
 *
 * Three formats, both finishes, both currencies, no asterisk. The price shown
 * is the price charged: tasking, print, frame, shipping and any import duty
 * are inside it, which is the single most persuasive thing this page can say
 * about money, so it is said in plain type and not in a badge.
 *
 * Every figure is read from `lib/pricing` — the catalogue the checkout charges
 * against — and every promise from `lib/guarantees`, which is what
 * /legal/terms is written from. Nothing on this band is typed twice, so this
 * band cannot drift away from what a customer actually pays or is owed.
 *
 * ------------------------------------------------------------------
 * WHY THIS IS NOT A PRICE LIST (READOUT D3)
 * ------------------------------------------------------------------
 * It used to be six rows of `SIZE · FINISH` against `$x / €y`: one weight,
 * one rhythm, four numbers per row, nothing leading. To compare two formats
 * you had to read all six and hold the differences in your head, and that
 * flat repetition is most of what reads as generated.
 *
 * Three things replace it, and all three are needed — any one alone leaves
 * the list intact in a new costume:
 *
 *   1  GROUPED BY SIZE. A format is one column carrying its own two
 *      finishes, not two rows sitting beside four unrelated ones.
 *   2  ONE FIGURE LEADS. The unframed price in the reader's currency is at
 *      display size; framed steps down; the second currency is a footnote.
 *      See `./FormatPrice.tsx` for which currency is "the reader's".
 *   3  PROPORTION IS THE ANCHOR. The three formats are genuinely different
 *      objects and the page never showed it. Each column opens with the
 *      sheet drawn at TRUE relative proportion — one shared scale, one
 *      baseline — so the size decision is made with the eye before a number
 *      is read at all. `components/format/FormatSilhouette.tsx`.
 *
 * There is no badge on any format. Nothing has sold, so "most popular" would
 * be a fabrication, and a recommendation the catalogue cannot support is
 * worse than no recommendation.
 *
 * ------------------------------------------------------------------
 * THE ORDER OF THIS BAND IS THE CONVERSION ARGUMENT (SPEC-V4 §B4, §B5)
 * ------------------------------------------------------------------
 * Nothing here is arranged by taste. A buyer reads a number, then reaches
 * for a reason not to pay it, and this band answers in that order:
 *
 *   1  the objects, at their real relative size, and what each one costs
 *   2  what is inside the number — stated once, in the contract's own
 *      words, on its own rules, directly under the prices it qualifies
 *   3  where it prints, and what that means at the door
 *   4  the four questions the price itself provokes — is this really the
 *      total, whose address may I task, do I get the file, and what if I
 *      change my mind. They are here rather than on /legal/terms because
 *      an objection answered one click away is an objection unanswered.
 *   5  the five guarantees, in full
 *   6  the button
 *
 * The guarantees are therefore the LAST thing read before the action, not
 * a footer note under it — risk reversal has to touch the control. Beside
 * the button is the one sentence that answers the hesitation the button
 * itself creates: the flow takes the target first and the money last, so
 * pressing it is not the moment of commitment.
 *
 * ------------------------------------------------------------------
 * WHAT CHANGES AT EACH BREAKPOINT
 * ------------------------------------------------------------------
 *   < 768   formats stack, each one drawing/label/price in a column;
 *           the inclusion line runs full width; questions in one column
 *   768     three formats across, drawings step up, questions in two columns
 *   1280    the inclusion line goes two-up, promise beside argument;
 *           the guarantee block splits 4 / 7 — heading left, terms right
 *   1920    the terms column pulls in to 6, holding its measure while the
 *           column around it grows
 */

/** The one promise the price itself makes. Never re-typed — see lib/guarantees. */
const SHIPPING = guaranteeTerm('shipping');

/**
 * The questions a price provokes, as opposed to the ones a satellite
 * provokes — those are answered in band 09. Every answer here is a
 * restatement of a clause in /legal/terms and nothing else, and the one
 * about the total opens with that clause's own sentence rather than a
 * paraphrase of it.
 */
const AT_THE_PRICE = [
  {
    q: 'Is the number on this page the number I pay?',
    a: `Yes. ${SHIPPING.detail} Tasking, the print, the frame if you choose one, shipping and any import duty are inside it. Payment is taken when you authorise the mission, before tasking, because pointing the satellite commits a real cost at that moment.`,
  },
  {
    q: 'Which addresses can I task?',
    a: 'One you own, occupy or have a genuine connection to, or any location that is not a private residence. Somebody else’s home is not a target we accept. Some territories are closed to the operator entirely; if yours is one, the mission is declined and refunded before anything is tasked.',
  },
  {
    q: 'Do I get the digital file?',
    a: 'You are buying the printed object. The frame is yours to view in Mission Control and licensed to you for personal use, including displaying and reproducing the print. Commercial use needs written permission.',
  },
  {
    q: 'What if I change my mind after it prints?',
    a: 'Cancelling is free until the satellite is tasked, which in practice means a few hours. After that the frame is captured and the sheet is printed for one address, so a change of mind is not a return — damage and misprints are still replaced.',
  },
];

export function PricingBand() {
  return (
    <Band tone="light" top="open" bottom="open">
      <Container className={MEASURE}>
        <BandHead
          label="Formats"
          title="One mission. Three ways to hang it."
          titleClassName="max-w-[14ch]"
          lede="Three different objects, drawn below at the size they are relative to each
                other. Pick the one that fits the wall; the number under it is the whole
                number."
        />

        {/* --- The objects, at true relative proportion. --- */}
        <div className="mt-12 grid grid-cols-1 gap-x-[var(--grid-gap-x)] gap-y-12 min-[768px]:grid-cols-3 min-[768px]:gap-y-0">
          {FORMATS.map((format) => {
            const sheet = sheetOf(format);
            return (
              <article key={format.id} className="flex flex-col">
                {/* Stacked, the sheet stands beside its own name so the three
                    drawings stay close enough to compare on a phone; three
                    across, it sits above the name in its own column. */}
                <div className="flex items-end gap-6 min-[768px]:block">
                  {/* One shared scale, one baseline. The three boxes are the
                      same height at every breakpoint, so the rectangles inside
                      them are in true proportion to one another and to the
                      wall the print ends up on. */}
                  <div className="flex h-32 shrink-0 items-end min-[768px]:h-44 min-[1280px]:h-52 min-[1920px]:h-60">
                    {sheet ? (
                      <FormatSilhouette sheet={sheet} tone="dim" className="h-full w-auto" />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1 min-[768px]:mt-6">
                    <div className="flex items-baseline justify-between gap-4 border-t rule-ground pt-3">
                      <span data-telemetry className="font-mono text-tele-s uppercase ink-faint">
                        {format.designation}
                      </span>
                      <span className="font-mono text-tele-s uppercase ink-faint">
                        {format.ratio}
                      </span>
                    </div>

                    <h3 className="mt-5 text-heading ink">{format.metric}</h3>
                    <p className="mt-2 font-mono text-tele-s uppercase ink-faint">
                      {format.imperial}
                    </p>
                  </div>
                </div>

                <p className="mt-4 max-w-[26ch] text-body ink-dim">{format.note}</p>

                <div className="mt-auto pt-8">
                  <FormatPrice format={format} />
                </div>
              </article>
            );
          })}
        </div>

        {/* --- What is inside the number, in the contract's own words,
                against the prices it qualifies. --- */}
        <div className="mt-12 grid grid-cols-1 items-baseline gap-x-12 gap-y-4 border-y rule-ground py-6 min-[1280px]:grid-cols-[minmax(0,34ch)_minmax(0,1fr)]">
          <p className="max-w-[34ch] text-heading ink">{SHIPPING.label}</p>
          <p className="max-w-[52ch] text-body ink-dim">
            Which currency you are charged follows the country of the target address, so both
            are printed on every format and the second one is the smaller figure.
          </p>
        </div>

        {/* --- Where it prints, and what that means at the door. --- */}
        <dl className="mt-10 grid grid-cols-1 gap-x-12 gap-y-5 min-[768px]:grid-cols-2">
          {(['US', 'EU'] as const).map((region) => (
            <div key={region} className="row-hover py-1">
              <dt data-telemetry className="font-mono text-tele-s uppercase ink-faint">
                {PRINT_FACILITY[region]}
              </dt>
              <dd className="mt-3 max-w-[36ch] text-body ink-dim">{FULFILMENT_NOTE[region]}</dd>
            </div>
          ))}
        </dl>

        {/* --- The four questions the number itself provokes. --- */}
        <div className="mt-12 grid grid-cols-1 gap-x-[var(--grid-gap-x)] min-[768px]:grid-cols-2 min-[768px]:gap-x-12">
          {AT_THE_PRICE.map((item) => (
            <div key={item.q} className="row-hover border-t rule-ground py-5">
              <h3 className="text-[1.0625rem] leading-[1.25] font-normal tracking-[-0.01em] ink">
                {item.q}
              </h3>
              <p className="mt-3 max-w-[48ch] text-body ink-dim">{item.a}</p>
            </div>
          ))}
        </div>

        {/* --- The five terms, then the control they qualify. --- */}
        <div className="mt-12">
          <Guarantees />
        </div>

        {/*
          THE ONE CONTROL ON THIS PAGE THAT STILL OPENS `/start`, AND WHY.

          Every other acquisition control on the site now opens `/mission`,
          the configurator, which is the funnel. This one does not, and it is
          not an oversight.

          The three columns above are `lib/pricing`, the print catalogue:
          30 x 40 unframed is EUR 170 and the band states, twice and in the
          contract's own words, that the number under each format is the
          number charged. `/mission` does not price from that catalogue. It
          prices by TIER and adds the catalogue's size difference on top
          (`tierPriceMinor` in lib/mission-flow/config.ts), so the cheapest
          thing it can charge for a 30 x 40 is EUR 79 as an archive frame or
          EUR 189 as a commission. EUR 170 is not a price that funnel can
          reach at any size or finish.

          Sending a reader from a table of prices to a checkout that charges
          different ones is precisely the defect CONFIGURATOR.md §3.2 exists
          to prevent — it happened once already, a EUR 79 button that
          recorded EUR 170. So this control stays on the funnel whose prices
          this band publishes until the two price lists are made one.

          That is an owner's decision, not an engineer's: INTEGRATIONS.md §10
          records the tier prices as placeholders awaiting sign-off. Either
          align TIER_PRICE.COMMISSION with the catalogue, or reprice this
          band from `tierPriceMinor`. Do one of the two and this href becomes
          `/mission` with no other change.
        */}
        <div className="mt-12 flex flex-col gap-5 border-t rule-ground pt-8 min-[1280px]:flex-row min-[1280px]:items-center min-[1280px]:gap-12">
          <Button variant="primary" size="lg" href="/start" className="self-start shrink-0">
            Start a mission
          </Button>
          <p className="max-w-[56ch] text-body ink-dim">
            You name the target first and pay last. Nothing is tasked, and nothing is charged,
            until you have seen the capture area resolve on the map and approved it.
          </p>
        </div>
      </Container>
    </Band>
  );
}
