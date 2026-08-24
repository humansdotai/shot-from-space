import type { ReactNode } from 'react';
import { Button, Container, Grid12 } from '@/components/fui';
import { BELOW_BAR } from './layout';
import { Redacted } from './Redacted';
import { operationsMetadata } from './redaction';

/**
 * A designed dead end. Every failure on a mission route lands here: an
 * unknown code, a share link without a key, a key that does not match.
 * Written as a stamp on a file, not an error page — the same grounds, the
 * same grid and the same voice as an open file.
 *
 * The footer of the dark band carries two identifiers: the reference the
 * visitor asked for, plainly — they may need to quote it — and the handling
 * code the request was logged under, behind a bar. The bar is styling, not a
 * barrier: the code is in the accessibility tree either way, and lifts on
 * hover, focus or tap.
 */
export function MissionNotice({
  stamp,
  title,
  body,
  reference,
  tags = ['MISSION FILE', 'NO ACCESS'],
  actions,
}: {
  /** The stamp on the file, e.g. "File not found". Sits as the eyebrow. */
  stamp: string;
  /** The headline: what is actually the matter. */
  title: string;
  body: ReactNode;
  /** Reference line — the code that was requested, if any. */
  reference?: string;
  tags?: string[];
  actions?: ReactNode;
}) {
  const ops = operationsMetadata(reference ?? 'SFS');

  return (
    <main>
      <section className={`surface-dark pb-[var(--band-open)] ${BELOW_BAR}`}>
        <Container>
          <Grid12>
            <div className="col-span-12 md:col-span-10 xl:col-span-7">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {tags.map((tag, i) => (
                  <span key={tag} className="flex items-center gap-3">
                    {i > 0 ? <span aria-hidden className="h-3 w-px bg-hairline" /> : null}
                    <span className="text-label uppercase text-paper-dim">{tag}</span>
                  </span>
                ))}
              </div>
              <p className="mt-8 text-label uppercase text-signal">{stamp}</p>
              <h1 className="mt-4 max-w-[18ch] text-display text-paper">{title}</h1>
              <p className="mt-6 max-w-[var(--measure)] text-body text-paper-dim">{body}</p>
              <div
                data-telemetry
                className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-hairline pt-4 font-mono text-tele-s uppercase text-paper-dim"
              >
                {reference ? <p>Reference / {reference}</p> : null}
                <p className="flex items-center gap-2">
                  <span>Handling /</span>
                  <Redacted reason="handling">{ops.handling}</Redacted>
                </p>
              </div>
            </div>
          </Grid12>
        </Container>
      </section>

      <section className="surface-light pt-[var(--band-open)] pb-[var(--band-open)]">
        <Container>
          <div className="flex flex-wrap items-center gap-3">
            {actions ?? (
              <>
                <Button variant="primary" size="lg" href="/start">
                  Start a mission
                </Button>
                <Button variant="secondary" size="lg" href="/missions">
                  Browse missions
                </Button>
              </>
            )}
          </div>
        </Container>
      </section>
    </main>
  );
}
