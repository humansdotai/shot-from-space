'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Band, Button, Container, CreditBox, Grid12 } from '@/components/fui';
import { GuaranteeStrip } from '@/components/landing';
import { MissionRef } from '@/components/mission';
import { currencyForRegion, formatPrice, priceMinor } from '@/lib/pricing';
import type { MissionDTO } from '@/lib/types';
import { clsx as cn } from 'clsx';
import { formatCoords } from '@/lib/utils';
import { completeMockCheckout } from './api';
import { CURVE, ErrorPlate, QUIET_BUTTON, SpecRow } from './fields';
import { loadCheckoutSnapshot, type CheckoutSnapshot } from './state';
import { StepAction } from './StepAction';

/**
 * Amber is deliberately outside the brand palette.
 *
 * The product has exactly one accent (signal orange) and it means "live".
 * Simulation chrome must never be able to pass for product chrome, so the
 * mock banner uses a colour that appears nowhere else in the system. It ships
 * only on /checkout/mock/*, which does not exist once Stripe is configured.
 */
const AMBER = '#f0a02a';

/**
 * How long the card is allowed to be "authorising" after the charge has
 * already been confirmed, before the screen stops waiting and tells the
 * customer the truth instead.
 *
 * `router.push` is not awaitable and has no failure channel: if the target
 * route cannot be produced — a stalled compile in dev, a chunk that 404s
 * after a deploy, an RSC payload that never arrives on a bad connection —
 * the promise chain in `pay()` simply ends and the button spins forever on
 * "Do not close". A customer whose card HAS been charged staring at that is
 * the worst state this flow can reach, so it is given a deadline.
 *
 * 6s is chosen to sit above a slow-but-working RSC fetch (the client router
 * has usually prefetched /m/{code} by now, and a cold uncached fetch on a
 * poor connection lands well inside this) and below the point where a person
 * decides the site is broken and reloads mid-charge.
 */
const NAV_GRACE_MS = 6000;

/**
 * `settled` is NOT "processing, still". It is the terminal state reached only
 * once /api/checkout/complete has answered ok: the money moved, the mission is
 * open, and only the navigation to it failed to happen. Nothing may set it on
 * any other path — a recovery screen that claims a successful payment before
 * the processor confirmed one would be worse than the hang it replaces.
 */
type Phase = 'idle' | 'processing' | 'settled' | 'failed';

/** A drawn, inert field. Nothing can be typed into mock card inputs. */
function DeadField({
  label,
  children,
  hatched = true,
}: {
  label: string;
  children: React.ReactNode;
  hatched?: boolean;
}) {
  return (
    // min-w-0 on both boxes: a grid/flex child defaults to a min-content floor,
    // and the letterspaced card placeholder cannot wrap — without this its
    // ~440px min-content became the floor and pushed the whole page sideways
    // at 390. overflow-hidden keeps the glyphs inside the field.
    <div className="min-w-0">
      <p className="pb-2 text-label uppercase text-paper-dim">{label}</p>
      <div
        className={cn(
          'flex h-12 min-w-0 items-center overflow-hidden border border-hairline px-4 text-[1rem] text-paper-dim',
          CURVE,
          hatched ? 'fui-disabled tracking-[0.2em]' : 'bg-deck',
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function MockCheckout({ missionCode }: { missionCode: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CheckoutSnapshot | null>(null);
  const [resolving, setResolving] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  /* The code the PROCESSOR confirmed, not the one in the URL. Set only from a
     successful /api/checkout/complete, and the only thing the recovery link
     is ever built from. */
  const [settledCode, setSettledCode] = useState<string | null>(null);
  const navWatchdog = useRef<number | null>(null);

  /* A completed navigation unmounts this component, which cancels the
     watchdog — that is the whole detection mechanism. Nothing has to observe
     the router: if the push worked, this cleanup runs before the timer can. */
  useEffect(
    () => () => {
      if (navWatchdog.current !== null) window.clearTimeout(navWatchdog.current);
    },
    [],
  );

  /* The order was just created in this tab, so the summary is already in
     session storage. If the reader arrived cold (a shared link, a reload in
     a new tab) the mission record is read back from the API instead. */
  useEffect(() => {
    let cancelled = false;

    const local = loadCheckoutSnapshot(missionCode);
    if (local) {
      setSnapshot(local);
      setResolving(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/missions/${missionCode}`);
        if (!res.ok) throw new Error('not found');
        const body = (await res.json()) as { mission?: MissionDTO };
        const m = body.mission;
        if (!m || cancelled) throw new Error('not found');
        const currency = m.private?.currency ?? currencyForRegion(m.region);
        setSnapshot({
          missionCode: m.code,
          email: m.private?.email ?? '',
          locationLabel: m.locationLabel,
          formatLabel: `${m.format.designation} / ${m.format.metric}`,
          frame: m.format.frame,
          areaKm: 2,
          amountMinor:
            m.private?.amountMinor ?? priceMinor(m.format.id, m.format.frame, currency),
          currency,
          region: m.region,
          lat: m.lat,
          lon: m.lon,
          // The public projection, so the fix is city-level. See CheckoutSnapshot.
          coordDp: 2,
        });
      } catch {
        if (!cancelled) setSnapshot(null);
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [missionCode]);

  const pay = async () => {
    if (phase === 'processing' || phase === 'settled') return;
    setPhase('processing');
    setError(null);

    /* ------------------------------------------------------------------
     * GOING LIVE — this is the whole diff.
     *
     * Everything from here to `router.push` is the simulation. With
     * STRIPE_SECRET_KEY set, /api/orders returns a real Stripe Checkout
     * Session URL from `stripe.checkout.sessions.create({ mode: 'payment',
     * line_items, customer_email, success_url: '/m/{code}', cancel_url:
     * '/start' })` and the browser is sent straight there — this route is
     * never reached, this component is never mounted, and the
     * `checkout.session.completed` webhook replaces the call to
     * /api/checkout/complete below.
     *
     * The watchdog around the push is NOT part of the simulation and does
     * not get deleted with it. Stripe's success_url returns the customer to
     * /m/{code} as a full document load, so the client router is out of the
     * picture there; but any future client-side hop after a confirmed charge
     * needs the same deadline, because `router.push` cannot report that it
     * failed. If this block is replaced wholesale by a redirect to Stripe,
     * delete the timer with it — a watchdog with no navigation to watch is
     * dead code, not safety.
     * ------------------------------------------------------------------ */

    // Hosted checkout takes about this long to authorise a card.
    await new Promise((r) => setTimeout(r, 1200));
    const result = await completeMockCheckout(missionCode);

    if (!result.ok) {
      setPhase('failed');
      setError(result.message);
      return;
    }

    /* Past this line the charge is CONFIRMED. Everything that follows is
       navigation, and navigation is not allowed to swallow that fact. */
    const code = result.data.toUpperCase();
    setSettledCode(code);
    navWatchdog.current = window.setTimeout(() => {
      setPhase('settled');
    }, NAV_GRACE_MS);
    router.push(`/m/${code}`);
    // ---------------------- end of the replaced block -------------------
  };

  const price = snapshot ? formatPrice(snapshot.amountMinor, snapshot.currency) : '—';

  return (
    <main className="surface-dark pt-[calc(4.25rem+1.5rem)] lg:pt-[calc(6rem+1.5rem)]">
      <Band top="tight" bottom="snug">
        <Container size="narrow" className="xl:max-w-[64rem] xl2:max-w-[72rem]">
          {/* MOCK banner ------------------------------------------------- */}
          <div
            role="note"
            className="flex flex-col items-start gap-3 border px-3 py-3 md:flex-row md:items-center md:gap-4"
            style={{
              borderColor: `${AMBER}66`,
              backgroundColor: `${AMBER}12`,
              borderLeftWidth: 2,
            }}
          >
            <span
              className="border px-2 py-1 text-label uppercase"
              style={{ borderColor: `${AMBER}99`, color: AMBER }}
            >
              Mock checkout
            </span>
            <p className="min-w-0 flex-1 text-body text-paper-dim">
              No payment is taken and no card details are collected. This screen stands in
              for Stripe Checkout; set{' '}
              <span className="font-mono text-[0.9em] text-paper">STRIPE_SECRET_KEY</span> and
              the order is sent to the real hosted page instead.
            </p>
          </div>

          <div className="pt-10">
            <p className="text-label uppercase text-paper-dim">Payment authorisation</p>
            <h1 className="mt-5 max-w-[18ch] text-display text-paper">
              Authorise the mission.
            </h1>
            <div className="mt-6">
              <MissionRef code={missionCode} size="md" />
            </div>
          </div>
        </Container>
      </Band>

      <Band top="flush" bottom="open">
        <Container size="narrow" className="xl:max-w-[64rem] xl2:max-w-[72rem]">
          {resolving ? (
            <div className="border border-hairline" aria-busy="true">
              <div className="fui-loading h-40" />
            </div>
          ) : !snapshot ? (
            <ErrorPlate
              title="Mission file not found"
              action={
                <Link href="/start" className={QUIET_BUTTON}>
                  Return to intake
                </Link>
              }
            >
              No open order matches {missionCode.toUpperCase()} in this session. Start the
              mission again — nothing has been charged.
            </ErrorPlate>
          ) : (
            <Grid12>
              {/* Order column — first on a phone, right on a desktop. */}
              <div className="col-span-12 min-w-0 md:order-2 md:col-span-5 xl:col-span-4 xl:col-start-9">
                <p className="pb-1 text-label uppercase text-paper-dim">Order</p>
                <dl>
                  <SpecRow label="Target" value={snapshot.locationLabel} />
                  <SpecRow
                    label="Coordinates"
                    value={formatCoords(snapshot.lat, snapshot.lon, snapshot.coordDp ?? 4)}
                  />
                  <SpecRow
                    label="Footprint"
                    value={`${snapshot.areaKm} × ${snapshot.areaKm} KM`}
                  />
                  <SpecRow label="Format" value={snapshot.formatLabel} />
                  <SpecRow
                    label="Finish"
                    value={snapshot.frame === 'FRAMED' ? 'Framed' : 'Unframed'}
                  />
                  <SpecRow label="Shipping" value="Included" tone="dim" />
                  {/* Duties only. /legal/terms and lib/pricing.ts promise shipping and
                      import duties; VAT is a tax treatment nobody else on this site
                      promises, and it was promised only here. */}
                  <SpecRow label="Duties" value="Included" tone="dim" />
                </dl>
                <div className="flex items-baseline justify-between gap-6 border-t border-hairline pt-4">
                  <span className="text-label uppercase text-paper-dim">Due now</span>
                  <span className="text-heading tabular-nums text-paper">
                    {price} {snapshot.currency}
                  </span>
                </div>
                <div className="pt-6">
                  <CreditBox
                    size="xs"
                    lat={snapshot.lat}
                    lon={snapshot.lon}
                    dp={snapshot.coordDp ?? 4}
                  />
                </div>
              </div>

              {/* Payment column ----------------------------------------- */}
              <div className="col-span-12 min-w-0 md:order-1 md:col-span-7 xl:col-span-7">
                <p className="pb-2 text-label uppercase text-paper-dim">Express</p>
                <div className="grid grid-cols-2 gap-4">
                  {['Apple Pay', 'Google Pay'].map((w) => (
                    <button
                      key={w}
                      type="button"
                      disabled
                      aria-label={`${w} — simulated, not available in mock mode`}
                      className={cn(
                        "fui-disabled flex min-h-12 items-center justify-center border border-hairline px-2 text-action",
                        CURVE,
                      )}
                    >
                      {w}
                    </button>
                  ))}
                </div>
                <p className="pt-3 text-body text-paper-dim">
                  Wallets are simulated in mock mode.
                </p>

                <div className="flex items-center gap-4 py-7">
                  <span aria-hidden className="h-px flex-1 bg-hairline" />
                  <span className="text-label uppercase text-paper-dim">Or card</span>
                  <span aria-hidden className="h-px flex-1 bg-hairline" />
                </div>

                <div className="grid gap-4">
                  <DeadField label="Email" hatched={false}>
                    <span className="truncate">
                      {snapshot.email || 'On file with the mission'}
                    </span>
                  </DeadField>

                  {/* Inert placeholders. No card input exists in mock mode —
                      these are drawn fields, not disabled inputs, so nothing
                      can ever be typed into them. */}
                  <DeadField label="Card number">•••• •••• •••• ••••</DeadField>

                  <div className="grid grid-cols-2 gap-4">
                    <DeadField label="Expiry">MM / YY</DeadField>
                    <DeadField label="CVC">•••</DeadField>
                  </div>
                </div>

                {error ? (
                  <div className="pt-6">
                    <ErrorPlate title="Authorisation refused">{error}</ErrorPlate>
                  </div>
                ) : null}

                {/* THE PAID-BUT-STRANDED STATE.
                    Rendered only from `phase === 'settled'`, which only the
                    watchdog sets and only after the processor answered ok, so
                    it cannot announce a payment that did not happen. It is
                    NOT an <ErrorPlate />: the accent means "refused" three
                    lines above, and nothing went wrong with the money. A
                    hairline plate on the deck, the house's neutral. */}
                {phase === 'settled' && settledCode ? (
                  <div
                    role="status"
                    className={cn(
                      'mt-7 border border-l-2 border-hairline bg-deck px-4 py-4',
                      CURVE,
                    )}
                  >
                    <p className="text-label uppercase text-paper">Payment authorised</p>
                    <p className="pt-2 text-body text-paper-dim">
                      Mission {settledCode} is open at {price}{' '}
                      {snapshot.currency}. No card was charged — this checkout is
                      simulated. The mission file did not load by itself; it is
                      safe to close this page, and the link below opens the file.
                    </p>
                  </div>
                ) : null}

                {/* RISK REVERSAL, AT THE BUTTON (SPEC-V4 §B4). The same five
                    contractual terms /start carries, read from the same one
                    array, restated at the last screen that takes money. The
                    button itself is in the pinned bar below — see the note on
                    <StepAction /> at the foot of this file's layout. */}
                <GuaranteeStrip className="mt-7 min-[768px]:grid-cols-1 min-[1280px]:grid-cols-2" />

                {/* "Cancel" is a lie once the card has been charged, so the
                    settled state trades it for the archive. */}
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pt-7">
                  {phase === 'settled' ? (
                    <Link href="/missions" className={QUIET_BUTTON}>
                      Return to the mission archive
                    </Link>
                  ) : (
                    <Link href="/start" className={QUIET_BUTTON}>
                      Cancel and return to intake
                    </Link>
                  )}
                  <span className="text-label uppercase text-paper-dim">
                    {phase === 'settled' ? 'Nothing further to do' : 'Your entries are kept'}
                  </span>
                </div>
              </div>
            </Grid12>
          )}
        </Container>
      </Band>

      {/* THE CONTROL THAT TAKES THE MONEY, PINNED (CONFIGURATOR.md §3.1).
          Measured under the card fields it sat 968px below the fold at 320,
          571px at 390 and still 109px below it at 1440 — a checkout whose pay
          button has to be hunted for.

          It is a child of <main /> rather than of the payment column or even
          of the band. `position: sticky` can never leave its own containing
          block, and on a phone both the payment column and the band that holds
          it start below the fold, so a bar inside either could not pin at
          first paint. Its parent has to be the one box that starts at the top
          of the page, which is the page.

          The label carries the figure and the figure is `snapshot.amountMinor`
          — the amount written when the order was created, not a second
          computation of it.

          The settled branch is the payment-recovery state: it is reached only
          from the watchdog, only after the processor answered ok, and it swaps
          the charge for the way into the file that was paid for. Do not
          collapse the two branches. */}
      {snapshot ? (
        <StepAction
          edge="page"
          innerClassName="column-narrow xl:max-w-[64rem] xl2:max-w-[72rem]"
          /* One line, and short enough to stay one line at 320: the amber
             banner above carries the full explanation of what mock mode is,
             and a bar that wraps to two lines takes 24px off the fold on the
             narrowest screen in the matrix. */
          note={phase === 'settled' ? 'No card was charged.' : 'No payment is taken.'}
        >
          {phase === 'settled' && settledCode ? (
            <Button
              href={`/m/${settledCode}`}
              variant="primary"
              size="lg"
              className="justify-between gap-6"
            >
              <span>Open mission file</span>
              <span className="text-label uppercase opacity-60">{settledCode}</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={pay}
              loading={phase === 'processing'}
              className="justify-between gap-6"
            >
              <span>{phase === 'processing' ? 'Authorising' : `Pay ${price}`}</span>
              <span className="text-label uppercase opacity-60">
                {phase === 'processing' ? 'Do not close' : 'Simulated'}
              </span>
            </Button>
          )}
        </StepAction>
      ) : null}
    </main>
  );
}
