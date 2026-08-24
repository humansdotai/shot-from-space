'use client';

import {
  FORMATS,
  FULFILMENT_NOTE,
  PRINT_FACILITY,
  formatPrice,
  getFormat,
  priceMinor,
} from '@/lib/pricing';
import type { FormatId, FrameOption } from '@/lib/types';
import { MATERIALS, PACKAGING, guaranteeTerm } from '@/lib/guarantees';
import { Button, Guarantee } from '@/components/fui';
import { FormatSilhouette, sheetOf } from '@/components/format/FormatSilhouette';
import { clsx as cn } from 'clsx';
import { INK, INK_DIM, RULE } from './fields';
import { StepAction } from './StepAction';
import { StepHead } from './StepScreen';
import type { Quote } from './state';

/**
 * DELIVERY — how the mission comes back.
 *
 * Two screens, one decision each: the size, then the finish. They are two
 * rather than one because a screen that asks twice is a screen the reader has
 * to read before answering, and because neither question can advance the
 * other — tapping a size cannot also choose a frame. Answering a screen IS
 * the advance, and it still is: tapping a row moves the sequence on with no
 * confirm step in between.
 *
 * WHAT THE PINNED BAR IS, AND WHAT IT IS NOT. It is not a Next button under a
 * pair of controls — the rows still close the screen by themselves. It is the
 * price, on screen at all times, with the control that takes the answer the
 * draft already holds (CONFIGURATOR.md §2: `PRICE │ PRIMARY CTA`, pinned, and
 * §3.2: the figure shown is the figure charged). Both are needed here for the
 * same reason: at 320 the first row's foot fell 103px below the fold on the
 * size screen and 89px below it on the finish screen, because 128px of header
 * band, the chrome and a three-line question leave 395px of a 568px phone —
 * and a row that draws the sheet to scale cannot be made shorter than that
 * without lying about the object. The figure comes from the caller's `quote`,
 * which is the same object `saveCheckoutSnapshot` bills from.
 *
 * ------------------------------------------------------------------
 * THE SIZE IS DRAWN, NOT SPELT (READOUT D3)
 * ------------------------------------------------------------------
 * Each row opens with the sheet itself, drawn at TRUE relative proportion to
 * the other two — one shared scale, one baseline, straight out of the
 * catalogue's own centimetres. A buyer picking a size is picking how big an
 * object arrives on a wall, and three rectangles say that in one look where
 * "30 × 40" and "70 × 100" only say it to someone doing arithmetic. The
 * drawing lives in `components/format/FormatSilhouette.tsx` and is the same
 * one the landing band uses, at the same scale.
 *
 * SIZE COMES FIRST, AND CARRIES BOTH FINISHES. Every row states the price for
 * the finish currently selected and, quietly under it, the price of the same
 * size in the other finish. So the price is on screen once and in full before
 * either decision is made, and the finish screen that follows cannot surprise
 * anyone with a number they have not already seen.
 *
 * ONE CURRENCY, BECAUSE HERE IT IS KNOWN. The landing page shows dollars and
 * euro together because it cannot know the target's country. This flow can —
 * `quoteFor` resolves it through `regionForCountry` / `currencyForRegion` —
 * so the alternate currency is not a footnote here, it is simply absent. A
 * European buyer sees no dollar figure anywhere in the purchase.
 *
 * A row is a bigger and faster target on a phone than a card in a grid, and it
 * lets the drawing, the size and the price sit on one baseline where they can
 * be compared down the column. Every price shown is the price paid: shipping
 * and duties are inside it, said once at the head of the screen in the
 * contract's own words, and the facility that will print the job is named
 * beside the question. The chosen row is marked by the ink itself — a filled
 * disc, full-weight type and a sheet drawn in full ink — rather than by a
 * tint, so the selection survives on either ground.
 *
 * NOTHING BELOW IS TYPED TWICE. Prices come from `lib/pricing`, promises and
 * material claims from `lib/guarantees`. Both files exist because the same
 * value written out by hand in two places is how this product acquired
 * fourteen factual contradictions; do not re-type one here to save an import.
 */

/** The disc that marks the chosen row. */
function Mark({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-house',
        active
          ? 'border-[color:var(--ink)] bg-[color:var(--ink)]'
          : 'border-[color:var(--rule-strong)]',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full transition-house',
          active ? 'bg-[color:var(--ground)]' : 'bg-transparent',
        )}
      />
    </span>
  );
}

const ROW = cn(
  'flex w-full items-start gap-4 border-t py-6 text-left transition-house md:gap-5 md:py-7',
  'hover:bg-[color:color-mix(in_srgb,var(--ink)_4%,transparent)]',
  RULE,
);

/** The drawing column. One height for every row, which is what makes the
 *  rectangles inside it comparable. */
const DRAWING = 'flex h-24 shrink-0 items-end md:h-32 xl:h-36';

const SHIPPING = guaranteeTerm('shipping');
const CANCEL = guaranteeTerm('cancel');

/* ------------------------------------------------------------------ */
/* Size                                                                */
/* ------------------------------------------------------------------ */

export function FormatStep({
  formatId,
  frame,
  quote,
  onChoose,
  onContinue,
}: {
  formatId: FormatId;
  frame: FrameOption;
  quote: Quote;
  /** Answering the screen advances it. */
  onChoose: (id: FormatId) => void;
  /** Takes the size already marked — the same answer, from the pinned bar. */
  onContinue: () => void;
}) {
  const otherFrame: FrameOption = frame === 'FRAMED' ? 'UNFRAMED' : 'FRAMED';
  const total = formatPrice(quote.totalMinor, quote.currency);

  return (
    <div className="max-w-[44rem]">
      <StepHead title="How large should it be?" aside={`Printed in ${PRINT_FACILITY[quote.region]}`}>
        {SHIPPING.detail}
      </StepHead>

      <div role="radiogroup" aria-label="Print format">
        {FORMATS.map((f) => {
          const active = f.id === formatId;
          const sheet = sheetOf(f);
          const price = formatPrice(priceMinor(f.id, frame, quote.currency), quote.currency);
          const other = formatPrice(priceMinor(f.id, otherFrame, quote.currency), quote.currency);
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChoose(f.id)}
              className={ROW}
            >
              <Mark active={active} />

              {/* The object, to scale. Hidden from the accessible name: a
                  screen reader is already given the size in centimetres and
                  in inches on the row beside it. */}
              <span aria-hidden className={DRAWING}>
                {sheet ? (
                  <FormatSilhouette
                    sheet={sheet}
                    tone={active ? 'ink' : 'faint'}
                    className="h-full w-auto"
                  />
                ) : null}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <span className={cn('text-heading', active ? INK : INK_DIM)}>{f.metric}</span>
                  <span
                    data-telemetry
                    className={cn('text-action tabular-nums', active ? INK : INK_DIM)}
                  >
                    {price}
                  </span>
                </span>
                <span className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <span className={cn('text-label uppercase', INK_DIM)}>
                    {f.imperial} / {f.ratio}
                  </span>
                  {/* The finish you are NOT on, priced. Nothing on the next
                      screen can then be a number you have not seen. */}
                  <span className={cn('text-label uppercase', INK_DIM)}>
                    {otherFrame === 'FRAMED' ? 'Framed' : 'Unframed'} {other}
                  </span>
                </span>
                <span className={cn('mt-3 block max-w-[var(--measure)] text-body', INK_DIM)}>
                  {f.note}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <Guarantee
        icon="shipping"
        label={FULFILMENT_NOTE[quote.region]}
        className={cn('border-t pt-6', RULE)}
      />

      <StepAction price={{ label: 'Total', value: `${total} ${quote.currency}` }}>
        <Button
          id="format-continue"
          size="lg"
          variant="primary"
          onClick={onContinue}
          trailing={<span>&#8594;</span>}
        >
          Continue
        </Button>
      </StepAction>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Finish                                                              */
/* ------------------------------------------------------------------ */

/**
 * The two finishes, described only in words `lib/guarantees` actually holds.
 * "Wired" used to be here and is not something the fulfilment adapter orders;
 * a claim about an object the buyer will hold and can check has to come from
 * the file that also drives the order.
 */
const FINISHES: readonly { value: FrameOption; label: string; note: string }[] = [
  {
    value: 'UNFRAMED',
    label: 'Unframed',
    note: `Ships ${PACKAGING.unframedPhrase}. Frame it yourself, or pin it.`,
  },
  {
    value: 'FRAMED',
    label: 'Framed',
    note: `A ${MATERIALS.framedSpec}, ${PACKAGING.framedShort.toLowerCase()}.`,
  },
];

export function FinishStep({
  formatId,
  frame,
  quote,
  onChoose,
  onContinue,
}: {
  formatId: FormatId;
  frame: FrameOption;
  quote: Quote;
  onChoose: (f: FrameOption) => void;
  /** Takes the finish already marked — the same answer, from the pinned bar. */
  onContinue: () => void;
}) {
  const format = getFormat(formatId);
  const sheet = sheetOf(format);
  const total = formatPrice(quote.totalMinor, quote.currency);

  return (
    <div className="max-w-[44rem]">
      <StepHead title="How should it arrive?" aside={`${format.designation} / ${format.metric}`}>
        {`Both are ${MATERIALS.paper}, at the size you have chosen. ` +
          'The frame is the only difference, and it is drawn beside each one.'}
      </StepHead>

      <div role="radiogroup" aria-label="Frame option">
        {FINISHES.map((f) => {
          const active = f.value === frame;
          const price = formatPrice(priceMinor(formatId, f.value, quote.currency), quote.currency);
          return (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChoose(f.value)}
              className={ROW}
            >
              <Mark active={active} />

              {/* The same sheet at the same scale as the size screen, with
                  and without its moulding. */}
              <span aria-hidden className={DRAWING}>
                {sheet ? (
                  <FormatSilhouette
                    sheet={sheet}
                    framed={f.value === 'FRAMED'}
                    tone={active ? 'ink' : 'faint'}
                    className="h-full w-auto"
                  />
                ) : null}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <span className={cn('text-heading', active ? INK : INK_DIM)}>{f.label}</span>
                  <span
                    data-telemetry
                    className={cn('text-action tabular-nums', active ? INK : INK_DIM)}
                  >
                    {price}
                  </span>
                </span>
                <span className={cn('mt-3 block max-w-[var(--measure)] text-body', INK_DIM)}>
                  {f.note}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* The two terms that answer "and if I get this wrong?", in the words
          /legal/terms uses. Neither is re-typed. */}
      <div className={cn('border-t pt-4', RULE)}>
        <Guarantee icon="shipping" label={SHIPPING.label} className="py-2" />
        <Guarantee icon="cancel" label={CANCEL.label} className="py-2" />
      </div>

      <StepAction price={{ label: 'Total', value: `${total} ${quote.currency}` }}>
        <Button
          id="finish-continue"
          size="lg"
          variant="primary"
          onClick={onContinue}
          trailing={<span>&#8594;</span>}
        >
          Continue
        </Button>
      </StepAction>
    </div>
  );
}
