import { Button, Container } from '@/components/fui';
import { BELOW_BAR } from '@/components/mission/layout';

/**
 * Nothing on this file matches that request — a mission that does not exist,
 * or one that belongs to another address. Both answer identically: the file
 * is not on record. Ownership is never disclosed by an error message.
 */
export default function AccountNotFound() {
  return (
    <main>
      <section className={`surface-dark pb-[var(--band-open)] ${BELOW_BAR}`}>
        <Container size="narrow">
          <div className="flex items-baseline justify-between gap-6">
            <p className="text-label uppercase text-paper-dim">Account file</p>
            <span data-telemetry className="font-mono text-tele-s uppercase text-signal">
              404 / NO RECORD
            </span>
          </div>

          <h1 className="mt-10 max-w-[16ch] text-display text-paper">File not on record.</h1>
          <p className="mt-6 max-w-[var(--measure)] text-body text-paper-dim">
            No mission under that code sits on this account. Check the code against the
            confirmation email, or return to the file and open it from the index.
          </p>
        </Container>
      </section>

      <section className="surface-light pt-[var(--band-open)] pb-[var(--band-open)]">
        <Container size="narrow">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button href="/account" size="lg" className="w-full sm:w-auto">
              Return to file
            </Button>
            <Button href="/start" variant="secondary" size="lg" className="w-full sm:w-auto">
              Start a mission
            </Button>
          </div>
        </Container>
      </section>
    </main>
  );
}
