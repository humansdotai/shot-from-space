import { Container, Grid12 } from '@/components/fui';
import { BELOW_BAR, EXHIBIT_PLATE, EXHIBIT_WALL } from './layout';

/** A drawn placeholder bar. No spinner exists anywhere in this product. */
function Bar({ className }: { className?: string }) {
  return <div className={`fui-loading rounded-[2px] ${className ?? ''}`} />;
}

/**
 * Loading state for a mission file. It occupies the same grounds, the same
 * grid and the same proportions the file will occupy, so nothing jumps when
 * the record arrives. The plates are drawn and swept, never spun.
 */
export function MissionFileSkeleton() {
  return (
    <main aria-busy="true" aria-label="Opening mission file">
      <section className={`surface-dark pb-[var(--band-open)] ${BELOW_BAR}`}>
        <Container>
          <Grid12>
            <div className="col-span-12 md:col-span-10 xl:col-span-7">
              <Bar className="h-7 w-40" />
              <Bar className="mt-8 h-10 w-full max-w-[26rem]" />
              <Bar className="mt-3 h-10 w-full max-w-[20rem]" />
              <Bar className="mt-8 h-9 w-56" />
            </div>
            <div className="col-span-12 self-end md:col-span-8 xl:col-span-4 xl:col-start-9">
              {Array.from({ length: 5 }).map((_, i) => (
                <Bar key={i} className="mt-3 h-4 w-full" />
              ))}
            </div>
          </Grid12>
        </Container>
      </section>

      <section className="surface-light pt-[var(--band-open)] pb-[var(--band-open)]">
        <Container>
          <div className="border-t border-[color:var(--rule)] pt-5">
            <p className="text-label uppercase text-[color:var(--ink-dim)]">Status</p>
            <p className="mt-3 text-heading text-[color:var(--ink)]">Mission timeline</p>
          </div>
          <Grid12 className="mt-10">
            <ol className="col-span-12 border-t border-[color:var(--rule)] xl:col-span-8">
              {Array.from({ length: 9 }).map((_, i) => (
                <li key={i} className="border-b border-[color:var(--rule)]">
                  <Grid12 className="py-6 xl:py-7">
                    <div className="col-span-12 flex items-center gap-3.5 md:col-span-7 xl:col-span-4">
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full border border-[color:var(--ink-faint)]"
                      />
                      <Bar className="h-4 w-44" />
                    </div>
                    <div className="col-span-12 flex md:col-span-5 md:col-start-8 md:row-start-1 md:justify-end xl:col-span-3 xl:col-start-10">
                      <Bar className="h-4 w-32" />
                    </div>
                    <div className="col-span-12 md:col-span-10 md:col-start-1 md:row-start-2 xl:col-span-5 xl:col-start-5 xl:row-start-1">
                      <Bar className="h-4 w-full max-w-[32rem]" />
                    </div>
                  </Grid12>
                </li>
              ))}
            </ol>
            <div className="col-span-12 hidden xl:col-span-3 xl:col-start-10 xl:block">
              <Bar className="h-72 w-full rounded-[12px]" />
            </div>
          </Grid12>
        </Container>
      </section>

      <section className="surface-dark pt-[var(--band-open)]">
        <Container>
          <div className="border-t border-hairline pt-5">
            <p className="text-label uppercase text-paper-dim">Exhibit A</p>
            <p className="mt-3 text-heading text-paper">The frame</p>
          </div>
        </Container>
        <div
          className={`mt-[var(--band-snug)] flex w-full items-center justify-center border-y border-hairline bg-deck/30 ${EXHIBIT_WALL}`}
        >
          <div
            className={`fui-loading h-full ${EXHIBIT_PLATE}`}
            style={{ aspectRatio: '3 / 4' }}
          />
        </div>
        <Container className="pt-[var(--band-snug)] pb-[var(--band-open)]">
          <Grid12>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="col-span-6 border-t border-hairline pt-4 md:col-span-3 xl:col-span-2"
              >
                <Bar className="h-3 w-20" />
                <Bar className="mt-3 h-4 w-28" />
              </div>
            ))}
          </Grid12>
        </Container>
      </section>
    </main>
  );
}
