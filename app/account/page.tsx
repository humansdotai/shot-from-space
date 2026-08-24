/*
 * No `loading.tsx` in this segment or its children — deliberately.
 *
 * A segment-level loading file makes the whole subtree a streaming boundary,
 * so Next flushes the shell and its 200 status before this component reaches
 * `requireUser()`. An unauthenticated request for /account/missions/<bad code>
 * was answering 200 and serving the signed-in account skeleton to a stranger,
 * instead of redirecting to sign-in or returning 404.
 *
 * If a loading state is needed, put a Suspense boundary around the slow child
 * *inside* the page, after the auth and existence checks have run.
 */
import type { Metadata } from 'next';
import { Button, Container, Grid12 } from '@/components/fui';
import { BELOW_BAR } from '@/components/mission/layout';
import { SectionHead } from '@/components/mission';
import { requireUser } from '@/lib/auth';
import { listMissionsForUser } from '@/lib/missions';
import { formatPrice } from '@/lib/pricing';
import { formatTelemetryDate } from '@/lib/utils';
import type { Currency, MissionDTO } from '@/lib/types';
import { MissionRow } from './MissionRow';
import { SignOutButton } from './SignOutButton';

export const metadata: Metadata = {
  title: 'Account file',
  description: 'Every mission commissioned from this address.',
  robots: { index: false, follow: false },
};

/** Sums what has been commissioned, per currency — US and EU orders coexist. */
function totalsByCurrency(missions: MissionDTO[]): Array<[Currency, number]> {
  const totals = new Map<Currency, number>();
  for (const mission of missions) {
    if (!mission.private) continue;
    const current = totals.get(mission.private.currency) ?? 0;
    totals.set(mission.private.currency, current + mission.private.amountMinor);
  }
  return [...totals.entries()];
}

/**
 * One line of the header readout. Label left, value right, hairline above.
 *
 * No hover. This is a readout, not a control — nothing happens if it is
 * clicked, so nothing lights up when it is pointed at. Hover on this page
 * belongs to the mission rows below, every one of which opens a receipt.
 */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-hairline py-3.5">
      <dt className="text-label uppercase text-paper-dim">{label}</dt>
      <dd data-telemetry className="text-action tabular-nums text-paper">
        {value}
      </dd>
    </div>
  );
}

/**
 * /account — the account file.
 *
 * Quiet and light-leaning: one dark band carrying the identity (the site bar
 * is transparent and absolute over it, so the first band of every page has to
 * be dark), then paper for everything that is a record. Rows with hover
 * states, not bordered boxes — the file is a list, and a list does not need a
 * box drawn round each entry to be read as one. The hover belongs to the
 * mission rows, which open a receipt; the header readout beside the address
 * has none, because nothing happens when it is clicked.
 *
 * WIDTH. 390 stacks. At 768 the identity takes eight columns and the readout
 * six under it, so neither runs the full 704px. From 1280 they sit side by
 * side; above 1440 the content column stops growing and the extra width
 * becomes margin.
 */
export default async function AccountPage() {
  const user = await requireUser('/account');
  const missions = await listMissionsForUser(user.id);

  const sorted = [...missions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const active = sorted.filter((m) => m.stage !== 'DELIVERED');
  const closed = sorted.filter((m) => m.stage === 'DELIVERED');
  const totals = totalsByCurrency(sorted);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <main>
      {/* Identity — the one dark band. --------------------------------- */}
      <section className={`surface-dark pb-[var(--band-open)] ${BELOW_BAR}`}>
        <Container>
          <div className="flex items-center justify-between gap-6">
            <p className="text-label uppercase text-paper-dim">Account file</p>
            <SignOutButton />
          </div>

          <Grid12 className="mt-10 items-end">
            <div className="col-span-12 min-w-0 md:col-span-8 xl:col-span-7">
              {/* An address is one unbreakable token: no measure cap (which
                  would split it early), `min-w-0` on the cell so it cannot set
                  a min-content floor and push the grid wide, and `break-all`
                  so a long address wraps inside the column. */}
              <h1 className="break-all text-display text-paper">{user.email}</h1>
              <p className="mt-6 max-w-[var(--measure)] text-body text-paper-dim">
                Every mission commissioned from this address is filed here. Access is by
                single-use link — there is no password on this account.
              </p>
            </div>

            <dl className="col-span-12 min-w-0 self-end md:col-span-6 xl:col-span-4 xl:col-start-9">
              <Stat label="Member since" value={formatTelemetryDate(user.createdAt)} />
              <Stat label="Missions" value={pad(sorted.length)} />
              {totals.length ? (
                totals.map(([currency, minor]) => (
                  <Stat
                    key={currency}
                    label={`Commissioned / ${currency}`}
                    value={formatPrice(minor, currency)}
                  />
                ))
              ) : (
                <Stat label="Commissioned" value="—" />
              )}
            </dl>
          </Grid12>
        </Container>
      </section>

      {/* Active missions ------------------------------------------------ */}
      <section className="surface-light pt-[var(--band-open)] pb-[var(--band-open)]">
        {/* Index, so it takes the display above 1920 — see the Delivered
            section below. The empty-state prose inside is already capped at
            `--measure`, so growing the column never lengthens a line. */}
        <Container size="flush">
          <div className="column-expand">
            <SectionHead
              label="In flight"
              title="Active missions"
              meta={active.length ? `${pad(active.length)} running` : 'None'}
            />

            {active.length ? (
              <ul className="mt-8 border-t border-[color:var(--rule)]">
                {active.map((mission) => (
                  <MissionRow key={mission.code} mission={mission} />
                ))}
              </ul>
            ) : sorted.length ? (
              <div className="mt-8 border-t border-[color:var(--rule)] pt-6">
                <p className="text-label uppercase text-[color:var(--ink-dim)]">
                  Nothing in flight
                </p>
                <p className="mt-4 max-w-[var(--measure)] text-body text-[color:var(--ink-dim)]">
                  Every mission on this file has been delivered. The closed files are below.
                </p>
              </div>
            ) : (
              <div className="mt-8 border-t border-[color:var(--rule)] pt-8">
                <h3 className="max-w-[18ch] text-heading text-[color:var(--ink)]">
                  No missions on file yet.
                </h3>
                <p className="mt-5 max-w-[var(--measure)] text-body text-[color:var(--ink-dim)]">
                  Nothing has been commissioned from this address. Give an address, a satellite is
                  tasked over it, and the file fills itself.
                </p>
                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Button href="/start" size="lg" className="w-full sm:w-auto">
                    Start a mission
                  </Button>
                  <Button href="/missions" variant="ghost" size="lg" className="w-full sm:w-auto">
                    See example missions
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* Delivered ------------------------------------------------------ */}
      {closed.length ? (
        <section className="surface-light pb-[var(--band-open)]">
          {/* An INDEX, not prose — so it sits on `.column-expand`, which is
              the column up to 1920 and then takes the display (1376 → 1600 →
              2000). Without it the list froze at 1376 and left a 512px rail
              either side at 2400. Same idiom as the footer. */}
          <Container size="flush">
            <div className="column-expand">
              <SectionHead
                label="Closed"
                title="Delivered"
                meta={`${pad(closed.length)} on file`}
              />
              <ul className="mt-8 border-t border-[color:var(--rule)]">
                {closed.map((mission) => (
                  <MissionRow key={mission.code} mission={mission} />
                ))}
              </ul>
            </div>
          </Container>
        </section>
      ) : null}

      {/* Closing rail --------------------------------------------------- */}
      {sorted.length ? (
        <section className="surface-dark pt-[var(--band-snug)] pb-[var(--band-open)]">
          <Container>
            <Grid12 className="items-end">
              <div className="col-span-12 md:col-span-9 xl:col-span-7">
                <p className="text-label uppercase text-paper-dim">Another address, another pass</p>
                <h2 className="mt-5 max-w-[20ch] text-heading text-paper">
                  Every address has a frame waiting over it.
                </h2>
              </div>
              <div className="col-span-12 md:col-span-8 xl:col-span-4 xl:col-start-9 xl:flex xl:justify-end">
                <Button href="/start" size="lg" className="w-full sm:w-auto">
                  Start a mission
                </Button>
              </div>
            </Grid12>
          </Container>
        </section>
      ) : null}
    </main>
  );
}
