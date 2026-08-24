import Link from 'next/link';
import { Grid12, Guarantee } from '@/components/fui';
import { GUARANTEE_TERMS } from '@/lib/guarantees';
import { Arrow } from './Arrow';
import { cn } from '@/lib/utils';

/**
 * THE GUARANTEES — the page's proof, and the only proof it offers.
 *
 * No mission has shipped, so there are no customers to quote, no ratings to
 * average and no logos to line up. Inventing any of that on a page that
 * takes $180 to $640 is fraud with nice typography. What is left is better
 * anyway: five terms the company is bound to, each of them already written
 * into /legal/terms.
 *
 * It is a block rather than a band so that it can sit inside the price,
 * under the number it qualifies, on the same ground. A tone flip between a
 * price and its terms would read as two separate offers.
 *
 * ------------------------------------------------------------------
 * THE WORDS ARE NOT AUTHORED HERE (SPEC-V4 §B4)
 * ------------------------------------------------------------------
 * Risk reversal belongs AT the decision, and this page has two of those:
 * the price and the closing action. So the same five terms are exported
 * twice — `<Guarantees />` argues them under the price where a buyer is
 * comparing formats, and `<GuaranteeStrip />` restates them in one line
 * each at the closing button, for the reader who scrolled past the price
 * and came back at the bottom.
 *
 * Both read `GUARANTEE_TERMS` from lib/guarantees.ts, which is also what
 * /legal/terms is written against. The short form used to be re-typed in
 * this file, and had drifted into "Full refund if no FRAME in 60 days" —
 * dropping "usable" and promising more than the contract does. Do not
 * re-type a guarantee here. Edit lib/guarantees.ts and both forms, the
 * contract page and the purchase flow move together.
 */

export function Guarantees() {
  return (
    <Grid12 className="items-start gap-y-8">
      <div className="col-span-12 min-[1280px]:col-span-4">
        <p className="font-mono text-tele-s uppercase ink-faint">Guarantees</p>
        <h3 className="mt-3 max-w-[16ch] text-heading ink">
          You are buying a photograph that does not exist yet.
        </h3>
        <p className="mt-5 max-w-[40ch] text-body ink-dim">
          So every way it can go wrong is answered before you pay, and all five answers are in
          the contract rather than on a poster.
        </p>
        <Link
          href="/legal/terms"
          className="group link-underline mt-5 inline-flex min-h-11 items-center gap-2 text-action ink transition-house hover:text-[color:var(--accent)]"
        >
          Read the terms
          <Arrow direction="right" />
        </Link>
      </div>

      <div className="col-span-12 min-[1280px]:col-span-7 min-[1280px]:col-start-6 min-[1920px]:col-span-6">
        {GUARANTEE_TERMS.map((g) => (
          <Guarantee
            key={g.key}
            icon={g.key}
            label={g.label}
            detail={g.detail}
            className="row-hover border-t rule-ground py-5"
          />
        ))}
      </div>
    </Grid12>
  );
}

/**
 * THE SAME FIVE TERMS, AT THE BUTTON.
 *
 * One line each, no detail paragraph, no heading above it — it is not a
 * second section, it is the fine print that should not be fine, sitting
 * where the last decision is made. The full argument stays under the price.
 *
 * Five items do not divide evenly into two, three or four columns, so the
 * grid is authored to land on five across only at 1920, where each column
 * still clears the longest line comfortably. Below that it runs 1 · 2 · 3
 * and the short rows fill from the left, which is what a hairline list does
 * anyway.
 */
export function GuaranteeStrip({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        'grid grid-cols-1 gap-x-8 gap-y-0',
        'min-[768px]:grid-cols-2 min-[1280px]:grid-cols-3 min-[1920px]:grid-cols-5',
        className,
      )}
    >
      {GUARANTEE_TERMS.map((g) => (
        <li key={g.key}>
          <Guarantee icon={g.key} label={g.short} className="border-t rule-ground py-4" />
        </li>
      ))}
    </ul>
  );
}
