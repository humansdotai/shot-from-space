import { Band, Container, Grid12 } from '@/components/fui';
import { MEASURE } from './geometry';
import { REFUND_WINDOW_DAYS } from '@/lib/guarantees';

/**
 * 11 · FOUNDER'S NOTE — dark. One voice, and it is the owner's.
 *
 * ------------------------------------------------------------------
 * WHAT THIS IS, AND WHAT IT IS NOT (SPEC-V4 §C)
 * ------------------------------------------------------------------
 * This is NOT a testimonial and it must never be built as one. No mission
 * has been sold, so there is no customer to quote — and a founder's words
 * dressed as an independent verdict is the same lie as an invented review,
 * only better typeset. What is legitimate is the owner saying, under his
 * own name and title, what happened when he ran the pipeline himself.
 *
 * So the constraints on this file are hard:
 *
 *   · The name and the role are in the VISIBLE copy, in the rail, before
 *     the first sentence is read. A reader must know inside a second that
 *     this is the person who built it, not somebody who bought it.
 *   · First person throughout, about building and testing.
 *   · No stars, no rating, no score, no review count, no second voice, no
 *     carousel, no "what customers say". If a future edit adds any of
 *     those, this band has become a lie and should be deleted instead.
 *   · The footnote states plainly that this is the founder writing about
 *     his own product. Saying it out loud costs nothing and is the whole
 *     reason the block is allowed to exist.
 *
 * ------------------------------------------------------------------
 * WHY IT SITS HERE
 * ------------------------------------------------------------------
 * Between the public archive and the price. The archive is the record of
 * what the instrument returns; this is the one person who has driven the
 * pipeline end to end — NOT someone who has received a finished print, and
 * the note says so in its own third paragraph. Keep the two in step: no
 * mission has flown for a customer, so nothing in this file may imply a
 * delivered object. The price is next, and the last line hands the reader
 * straight to the guarantees rather than asking to be believed on
 * character.
 *
 * It also repairs the page's ground alternation: the archive and the price
 * are both paper, and a dark band between them puts the page back on a
 * clean flip at every join except 07→08.
 *
 * ------------------------------------------------------------------
 * WHAT CHANGES AT EACH BREAKPOINT
 * ------------------------------------------------------------------
 *   < 1280  the attribution rail stacks above the note
 *   1280    4 / 7 — rail left, note right, on the same rail the guarantee
 *           block below uses, so the two align down the page edge
 *   1920    the note column pulls in to 6 and holds its measure while the
 *           column around it grows
 *
 * The prose is capped at 60 characters in `ch`, so no width ever lengthens
 * the line — a wider screen buys margin, never a longer sentence.
 */

/**
 * The note. Kept as data so the prose is readable in the file and cannot
 * be broken up by markup — every paragraph is first person and every
 * detail in it comes from the mission the founder actually ran.
 */
const NOTE = [
  'I built this pipeline. Before putting it on sale I ran the whole of it end to end myself — target entry, tasking, the capture window, composition, the print file, the mission file you get afterwards — and watched where it broke and fixed it.',
  'What I can tell you honestly is what I have tested and what I have not. The software works: an address becomes a coordinate pair, a coordinate pair becomes a tasking order, and the order becomes a file you can follow. What I cannot tell you yet is what it is like to open the tube, because no customer mission has flown. We are at the start.',
  'So I am not going to describe a photograph I have not received, and you will not find a review on this page, because there is nobody to quote yet. Everything shown here is labelled for what it is: the example frames are public-domain Landsat, and the example mission is a demonstration file.',
  `The part that is not provisional is the terms. I wrote the five guarantees below to be the ones I would want if I were the first person to order: if no usable frame comes back inside ${REFUND_WINDOW_DAYS} days you are refunded in full, a pass lost to cloud is re-flown at our cost, and nothing is tasked until you have seen the capture area and authorised the mission.`,
  'I am the person selling this, so weigh my word accordingly. The guarantees underneath are the part you can hold us to, and they are the reason it is safe to be early.',
];

export function FounderBand() {
  return (
    <Band tone="dark" top="open" bottom="open">
      <Container className={MEASURE}>
        <Grid12 className="items-start gap-y-8">
          {/* --- The attribution rail. Name and role before the first word. --- */}
          <div className="col-span-12 min-[1280px]:col-span-4">
            <p className="font-mono text-tele-s uppercase ink-faint">Founder&rsquo;s note</p>

            <p className="mt-3 text-heading ink">Sabin Dima</p>
            <p className="mt-3 font-mono text-tele-s uppercase ink-dim">
              Founder, Shot from Space
            </p>

            {/*
              ASSET NEEDED — a real photograph of Sabin Dima, or a scan of his
              signature, belongs here and nowhere else on the page.

              It is deliberately NOT rendered as an empty placeholder box and a
              portrait was NOT generated for it: an invented face on a signed
              note is exactly the kind of fabricated proof the rest of this
              page refuses. Drop the real file into /brand/, uncomment, and
              set the intrinsic dimensions.

              <Image
                src="/brand/sabin-dima-signature.png"   // real asset required
                alt="Sabin Dima's signature"
                width={0}                                // set from the file
                height={0}                               // set from the file
                className="mt-8 h-12 w-auto opacity-90"
              />
            */}

            {/*
              Set in sentence case, in the body face. This is prose, and
              prose in a label style is the §A2 mistake — the uppercase
              tracked treatment on this page belongs to labels, never to a
              sentence, however small the sentence is.
            */}
            <p className="mt-8 max-w-[40ch] border-t rule-ground pt-5 text-body ink-faint">
              Written by the founder about his own product. It is not a customer review, and
              there are none on this page.
            </p>
          </div>

          {/* --- The note itself. --- */}
          <div className="col-span-12 min-[1280px]:col-span-7 min-[1280px]:col-start-6 min-[1920px]:col-span-6">
            <h2 className="max-w-[20ch] text-display ink">
              I ran the first mission against my own roof.
            </h2>

            {NOTE.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="mt-5 max-w-[60ch] text-body ink-dim">
                {paragraph}
              </p>
            ))}

            {/* The signature line. Name and role again, at the end, where a
                signature goes on a document that is being vouched for. */}
            <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t rule-ground pt-5">
              <span className="text-action ink">Sabin Dima</span>
              <span className="font-mono text-tele-s uppercase ink-faint">
                Founder, Shot from Space
              </span>
            </div>
          </div>
        </Grid12>
      </Container>
    </Band>
  );
}
