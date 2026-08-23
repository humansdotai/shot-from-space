import type { ReactNode } from 'react';
import { Container, Grid12 } from '@/components/fui';
import { BELOW_BAR } from '@/components/mission/layout';

/**
 * The shared frame behind both access screens.
 *
 * Access is the quietest surface in the product: a label, one display line,
 * one paragraph and one control. No plate, no crop marks, no card.
 *
 * Two grounds, weighted towards the light one. The head is dark because the
 * site bar is transparent and absolute over the first band of every page;
 * everything the reader acts on is on paper, which is where a form belongs,
 * and the paper band is the taller of the two. There are no numbered eyebrows
 * — the screen is identified by what it is called.
 *
 * WIDTH. The form is one field, so it never needs more than a column; what
 * changes across the five steps is where that column sits. At 390 and 768 it
 * is the page. From 1280 it takes five of the twelve and the closing note
 * moves off the bottom of the form into its own column opposite, so the
 * screen composes across the width instead of running as one centred stack
 * with a rule under it. Above 1440 the column stops growing and the margin
 * takes the extra width — the field does not get longer because the display
 * did.
 */
export function AuthShell({
  eyebrow,
  title,
  intro,
  meta,
  children,
  footer,
}: {
  /** Eyebrow text. Set in the label role, uppercased by the type role. */
  eyebrow: string;
  title: string;
  intro: ReactNode;
  /**
   * One quiet value opposite the eyebrow. Set in the sans label role: it is a
   * status word, and monospace on this site is reserved for coordinates,
   * timestamps, mission codes and elapsed times.
   */
  meta?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main>
      <section data-print-hide className={`surface-dark pb-[var(--band-snug)] ${BELOW_BAR}`}>
        <Container>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="text-label uppercase text-paper-dim">{eyebrow}</p>
            {meta ? (
              <span className="text-label uppercase text-paper-dim">{meta}</span>
            ) : null}
          </div>

          <h1 className="mt-8 max-w-[16ch] text-display text-paper">{title}</h1>
          <p className="mt-6 max-w-[var(--measure)] text-body text-paper-dim">{intro}</p>
        </Container>
      </section>

      <section className="surface-light pt-[var(--band-open)] pb-[calc(var(--band-open)+2rem)]">
        <Container>
          <Grid12>
            <div className="col-span-12 min-w-0 md:col-span-8 xl:col-span-5">{children}</div>

            {footer ? (
              <div className="col-span-12 min-w-0 border-t border-[color:var(--rule)] pt-6 md:col-span-8 xl:col-span-4 xl:col-start-9 xl:mt-0 xl:border-t-0 xl:pt-0">
                {footer}
              </div>
            ) : null}
          </Grid12>
        </Container>
      </section>
    </main>
  );
}
