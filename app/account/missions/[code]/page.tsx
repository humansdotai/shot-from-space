/*
 * No `loading.tsx` in this segment — deliberately.
 *
 * A loading file makes the segment a streaming boundary, so Next flushes the
 * shell (and its 200) before this component reaches `requireUser()` or
 * `notFound()`. The result was that a receipt for a mission that does not
 * exist — or one belonging to somebody else — answered 200 instead of 404,
 * which makes bad links indexable and hides the gate from uptime checks.
 * `/m/[code]` had the identical bug for the identical reason.
 *
 * If this segment ever needs a loading state, use a Suspense boundary around
 * the slow child *inside* the page, after the auth and existence checks have
 * run — not a segment-level loading file.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, Container, Grid12 } from '@/components/fui';
import { Chip, MissionRef, Row, SectionHead } from '@/components/mission';
import { BELOW_BAR_TIGHT } from '@/components/mission/layout';
import { requireUser } from '@/lib/auth';
import { missionPath, missionShortLink, normalizeMissionCode } from '@/lib/codes';
import { getMissionByCode, listMissionsForUser } from '@/lib/missions';
import { PRINT_FACILITY, formatPrice, getFormat, priceMinor } from '@/lib/pricing';
import { formatCoordsHemisphere, formatTelemetryTimestamp } from '@/lib/utils';
import type { MissionDTO, TargetAddress } from '@/lib/types';
import { chipLabelFor, chipStateFor, MissionThumb } from '../../MissionRow';
import { PrintReceiptButton } from './PrintReceiptButton';
import { RECEIPT_PRINT_CSS } from './print.css';

export const metadata: Metadata = {
  title: 'Receipt',
  description: 'Order detail and receipt for a commissioned mission.',
  robots: { index: false, follow: false },
};

/**
 * `MissionDTO.private` is the owner-only block. `paidAt` is not on the shared
 * type yet — read it if the backend supplies it, fall back to the order
 * timestamp if it does not.
 */
type PrivateBlock = NonNullable<MissionDTO['private']> & { paidAt?: string | null };

/** Reorder carries the target and the product forward into /start. */
function reorderHref(mission: MissionDTO, address: TargetAddress | undefined, email: string) {
  const params = new URLSearchParams({ from: 'reorder', ref: mission.code });
  if (address) {
    params.set('line1', address.line1);
    if (address.line2) params.set('line2', address.line2);
    params.set('city', address.city);
    if (address.region) params.set('region', address.region);
    params.set('postal', address.postalCode);
    params.set('countryCode', address.countryCode);
    params.set('country', address.country);
    params.set('lat', String(address.lat));
    params.set('lon', String(address.lon));
  }
  params.set('format', mission.format.id);
  params.set('frame', mission.format.frame);
  if (email) params.set('email', email);
  return `/start?${params.toString()}`;
}

export default async function ReceiptPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const user = await requireUser(`/account/missions/${raw}`);

  const code = normalizeMissionCode(raw);
  if (!code) notFound();

  // Ownership is decided by the user's own index — a mission filed against
  // another account is indistinguishable from one that does not exist.
  const owned = await listMissionsForUser(user.id);
  const listed = owned.find((m) => m.code === code);
  if (!listed) notFound();

  const mission = (await getMissionByCode(code, { includePrivate: true })) ?? listed;
  const priv = (mission.private ?? listed.private) as PrivateBlock | undefined;

  const currency = priv?.currency ?? (mission.region === 'EU' ? 'EUR' : 'USD');
  const format = getFormat(mission.format.id);
  const itemMinor = priceMinor(mission.format.id, mission.format.frame, currency);
  const totalMinor = priv?.amountMinor ?? itemMinor;
  const settled = Boolean(priv?.receiptNumber);
  const paidAt = priv?.paidAt ?? mission.createdAt;
  const address = priv?.address;
  const facility = mission.printFacility ?? PRINT_FACILITY[mission.region];

  /* -------- Production readout, built from what exists ---------- */
  type ReceiptRow = {
    label: string;
    value: React.ReactNode;
    tone?: 'strong' | 'dim' | 'accent';
    mono?: boolean;
  };
  const production: ReceiptRow[] = [
    { label: 'Facility', value: facility },
    { label: 'Region', value: mission.region, tone: 'dim' },
  ];
  if (mission.carrier) production.push({ label: 'Carrier', value: mission.carrier });
  if (mission.trackingNumber) {
    production.push({
      label: 'Tracking',
      mono: true,
      value: mission.trackingUrl ? (
        <a
          href={mission.trackingUrl}
          target="_blank"
          rel="noreferrer"
          className="link-underline inline-flex min-h-11 items-center transition-house hover:text-[color:var(--accent)]"
        >
          {mission.trackingNumber}
        </a>
      ) : (
        mission.trackingNumber
      ),
    });
  } else {
    production.push({ label: 'Tracking', value: 'Not yet issued', tone: 'dim' });
  }
  if (mission.estimatedDeliveryAt) {
    production.push({
      label: 'Estimated delivery',
      mono: true,
      value: formatTelemetryTimestamp(mission.estimatedDeliveryAt),
      tone: 'dim',
    });
  }

  return (
    <main>
      <style dangerouslySetInnerHTML={{ __html: RECEIPT_PRINT_CSS }} />

      {/* Rail — where this record sits, and what state it is in. -------- */}
      <section
        data-print-hide
        className={`surface-dark pb-[var(--band-snug)] ${BELOW_BAR_TIGHT}`}
      >
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/account"
              className="link-underline inline-flex min-h-11 items-center text-action text-paper-dim transition-house hover:text-paper"
            >
              ← Account file
            </Link>
            <Chip label={chipLabelFor(mission)} state={chipStateFor(mission)} />
          </div>
        </Container>
      </section>

      {/* The receipt document, with its controls on the outer column. ---- */}
      <section className="surface-light pt-[var(--band-open)] pb-[var(--band-open)]">
        <Container>
          <Grid12>
            <article data-receipt className="col-span-12 min-w-0 md:col-span-8 xl:col-span-7 2xl:col-span-8">
              <header>
                <p className="text-label uppercase text-[color:var(--ink-dim)]">Receipt</p>
                <h1 className="mt-4">
                  <MissionRef code={mission.code} size="lg" />
                </h1>
                <p className="mt-5 max-w-[var(--measure)] text-body text-[color:var(--ink-dim)]">
                  One pass, one print, one price. Shipping and duties were settled at checkout —
                  nothing further is owed on delivery.
                </p>
                <p
                  data-telemetry
                  className="mt-4 font-mono text-tele-s uppercase text-[color:var(--ink-dim)]"
                >
                  {missionShortLink(mission.code)}
                </p>
              </header>

              {/* -------- Order -------- */}
              <section className="mt-8">
                <SectionHead
                  label="Payment"
                  title="Order"
                  meta={settled ? 'Settled' : 'Pending'}
                />
                <dl className="mt-6 border-t border-[color:var(--rule)] pt-1">
                  <Row label="Receipt no" mono value={priv?.receiptNumber ?? '—'} />
                  <Row label="Ordered" mono value={formatTelemetryTimestamp(mission.createdAt)} />
                  <Row
                    label="Payment"
                    tone={settled ? 'strong' : 'accent'}
                    value={settled ? 'Settled' : 'Awaiting settlement'}
                  />
                  <Row
                    label="Paid at"
                    mono
                    tone="dim"
                    value={settled ? formatTelemetryTimestamp(paidAt) : '—'}
                  />
                  <Row label="Account" tone="dim" value={priv?.email ?? user.email} />
                </dl>
              </section>

              {/* -------- Line items -------- */}
              <section className="mt-8">
                <SectionHead label="Charge" title="Line items" meta={currency} />
                <dl className="mt-6 border-t border-[color:var(--rule)] pt-1">
                  <Row label="Item" value={`${format.designation} / ${format.metric}`} />
                  <Row label="Format" tone="dim" value={`${format.imperial} / ${format.ratio}`} />
                  <Row
                    label="Frame"
                    tone="dim"
                    value={mission.format.frame === 'FRAMED' ? 'Framed' : 'Unframed'}
                  />
                  <Row label="Print" value={formatPrice(itemMinor, currency)} />
                  <Row label="Shipping" tone="dim" value="Included" />
                  <Row label="Duties and tax" tone="dim" value="Included" />
                </dl>

                <div className="mt-6 flex items-baseline justify-between gap-6 border-t border-[color:var(--rule)] pt-6">
                  <p className="text-label uppercase text-[color:var(--ink-dim)]">Total</p>
                  <span
                    data-telemetry
                    className="text-heading tabular-nums text-[color:var(--ink)]"
                  >
                    {formatPrice(totalMinor, currency)}
                  </span>
                </div>
              </section>

              {/* -------- Target and delivery -------- */}
              <section className="mt-8">
                <SectionHead label="Destination" title="Target and delivery" meta={mission.region} />
                {address ? (
                  <address className="mt-6 text-body not-italic text-[color:var(--ink)]">
                    <span className="block">{address.line1}</span>
                    {address.line2 ? <span className="block">{address.line2}</span> : null}
                    <span className="block">
                      {address.city}
                      {address.region ? `, ${address.region}` : ''} {address.postalCode}
                    </span>
                    <span className="block">{address.country}</span>
                  </address>
                ) : (
                  <p className="mt-6 max-w-[var(--measure)] text-body text-[color:var(--ink-dim)]">
                    The shipping address is held on the mission record and is not readable from
                    here.
                  </p>
                )}

                <dl className="mt-6 border-t border-[color:var(--rule)] pt-1">
                  <Row label="Target" value={mission.locationLabel} />
                  <Row
                    label="Coordinates"
                    mono
                    tone="dim"
                    value={formatCoordsHemisphere(mission.lat, mission.lon)}
                  />
                </dl>
              </section>

              {/* -------- Production -------- */}
              <section className="mt-8">
                <SectionHead label="Fulfilment" title="Production" meta="Printed locally" />
                <dl className="mt-6 border-t border-[color:var(--rule)] pt-1">
                  {production.map((row) => (
                    <Row
                      key={row.label}
                      label={row.label}
                      value={row.value}
                      tone={row.tone}
                      mono={row.mono}
                    />
                  ))}
                </dl>
              </section>

              {/* The document footer carries telemetry, not the credit box.
                  The credit is a mark on a film frame; the bottom half of the
                  poster — and this receipt is its paper half — signs itself
                  with the mission and its readings instead. */}
              <footer className="mt-8 flex flex-wrap items-end justify-between gap-6 border-t border-[color:var(--rule)] pt-6">
                <div className="flex flex-col gap-1.5">
                  <span
                    data-telemetry
                    className="font-mono text-tele-s uppercase text-[color:var(--ink-dim)]"
                  >
                    {formatTelemetryTimestamp(mission.capturedAt ?? mission.createdAt)}
                  </span>
                  <span
                    data-telemetry
                    className="font-mono text-tele-s uppercase text-[color:var(--ink-dim)]"
                  >
                    {formatCoordsHemisphere(mission.lat, mission.lon)}
                  </span>
                </div>
                {/* Sans, not mono. The two readings opposite are a timestamp
                    and a coordinate; this is a line of copy, and monospace on
                    this site is spent on instrument values only. */}
                <p className="text-label uppercase text-[color:var(--ink-dim)]">
                  Zero employees / operated by agents
                </p>
              </footer>
            </article>

            {/* -------- Controls, off the document -------- */}
            <aside className="col-span-12 min-w-0 md:col-span-4 xl:col-span-3 xl:col-start-10" data-print-hide>
              <div className="group max-w-[200px] overflow-hidden rounded-[6px]">
                <MissionThumb mission={mission} sizes="200px" />
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <Button href={missionPath(mission.code)} size="lg" className="w-full">
                  Open mission control
                </Button>
                <PrintReceiptButton className="w-full" />
                <Button
                  href={reorderHref(mission, address, priv?.email ?? user.email)}
                  variant="secondary"
                  size="lg"
                  className="w-full"
                >
                  Reorder
                </Button>
              </div>

              <p className="mt-6 max-w-[var(--measure-tight)] text-body text-[color:var(--ink-dim)]">
                Reorder opens a new mission pre-loaded with this target and format. A fresh pass is
                tasked — the frame will not be the same photograph.
              </p>
            </aside>
          </Grid12>
        </Container>
      </section>
    </main>
  );
}
