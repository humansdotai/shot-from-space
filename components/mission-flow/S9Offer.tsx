'use client';

import { useCallback, useEffect, useState } from 'react';
import { clsx as cn } from 'clsx';
import { Guarantee } from '@/components/fui';
import {
  CURVE,
  ErrorPlate,
  FieldError,
  FieldLabel,
  INK,
  INK_DIM,
  INPUT_CLASS,
  RULE,
  SpecRow,
} from '@/components/purchase/fields';
import { formatPrice, getFormat } from '@/lib/pricing';
import { missionShortLink } from '@/lib/codes';
import { captureDate } from './S7Archives';
import type { ChosenArchive } from '@/lib/mission-flow/state';
import { guaranteeTerm } from '@/lib/guarantees';
import type { Currency, FormatId, FrameOption } from '@/lib/types';
import {
  RECOMMENDED_TAG,
  RECOMMENDED_TIER,
  PASS_ATTRIBUTION,
  REVEAL_SOURCE_NOTICE,
  TIER_COPY,
  TIER_FORCED_FRAME,
  TIER_IDS,
  effectiveFrame,
  tierPriceMinor,
  type TierId,
} from '@/lib/mission-flow/config';
import {
  createOrder,
  fetchScene,
  resolveAddress,
  revealFrameUrl,
  toTargetAddress,
} from '@/lib/mission-flow/api';
import type { OverheadResult } from '@/lib/mission-flow/overhead';
import type { SceneInfo } from '@/lib/mission-flow/scene';
import type { ChosenWindow, MissionTarget } from '@/lib/mission-flow/state';
import { isEmail } from '@/lib/mission-flow/state';
import { PanelGroup, PanelHead, PanelNote } from './Panel';
import { CardGroup, type CardOption } from './CardGroup';
import { isTasked } from './S8Dossier';
import {
  SatelliteList,
  formatInstant,
  formatRemaining,
  formatWindowDate,
  useNow,
  useOverhead,
} from './S7Windows';

/**
 * Amber is deliberately outside the brand palette — the same decision, and
 * the same reason, as `components/purchase/MockCheckout.tsx`, which this
 * section's payment path calls into. The product has exactly one accent and
 * it means "live". Simulation chrome must never be able to pass for
 * product chrome. It disappears with MOCK_MODE.
 */
const AMBER = '#f0a02a';

export type CommissionPhase = 'idle' | 'paying' | 'opened' | 'failed';

/** Set once the order exists: the buyer's keyed link, shown before the redirect. */
export interface OpenedOrder {
  missionCode: string;
  missionLink: string;
  checkoutUrl: string;
}

/**
 * ==================================================================
 * SECTION 6 — REVIEW (was screens 8 and 9, the dossier and the offer)
 * ==================================================================
 *
 * Three tiers, stacked, the middle one pre-selected and tagged. Wallets
 * first, card below, and the email is collected HERE and only here — as
 * the receipt address, after the buyer has decided, which is the whole
 * reason there is no account anywhere earlier in this flow.
 *
 * ------------------------------------------------------------------
 * THE TIERS ARE SHOWN, NOT ASSERTED
 * ------------------------------------------------------------------
 * The two products are not two price points on one thing. One flies a
 * spacecraft over the buyer's coordinates and returns a frame that did
 * not exist; the other prints a picture that already does. A card that
 * only SAYS that leaves the buyer to take it on trust, and the more
 * expensive one is the one asking for the trust.
 *
 * So the section proves it, from the same SGP4 propagation the Window
 * tab runs (`/mission/passes?op=overhead`), and the proof changes with
 * the selection:
 *
 *   COMMISSION  a live countdown to the next real pass over these exact
 *               coordinates; how high it climbs; how many opportunities
 *               the tracked fleet gives inside the search; which real
 *               spacecraft they belong to; and how old the elements the
 *               figures came from are.
 *   ARCHIVE     the picture. Which archive scene it is, how far that
 *               scene's centre is from the target, what it was taken
 *               with, and its acquisition date when the record supports
 *               one. No tasking, no window, no countdown, because none
 *               of those happens.
 *
 * ------------------------------------------------------------------
 * TWO THINGS THIS SECTION WILL NOT PRINT
 * ------------------------------------------------------------------
 * A NAMED SPACECRAFT FOR THE MISSION. The satellites listed are the
 * fleet this site TRACKS. Tasking is brokered at capture time and the
 * assigned vehicle is very often none of them; `PASS_ATTRIBUTION` says
 * exactly that, under the list, in the words `config.ts` holds.
 *
 * A CAPTURE PROBABILITY. It is the number this screen would most like to
 * have and the one it is least able to produce: it needs a cloud
 * forecast bound to a future pass and an operator commitment, and there
 * is no source for either in this repository. A percentage invented to
 * fill the gap would be the single most damaging sentence on the site.
 * What is printed instead is the count of opportunities, the elevation
 * of each, and the re-task guarantee — which is a promise somebody
 * actually made, quoted from `lib/guarantees.ts`.
 *
 * ------------------------------------------------------------------
 * WHERE THE PAY BUTTON WENT
 * ------------------------------------------------------------------
 * Into the panel foot, with the price beside it, where it is visible on
 * this section without scrolling — which it was not, on any desktop
 * viewport, when this was screen 9. So the ORCHESTRATION had to move
 * with it: `useCommission()` below holds the payment exactly as it was
 * written and hands <MissionFlow /> a `pay` function and a phase.
 *
 * PAYMENT IS NOT REIMPLEMENTED. Pressing pay resolves the postal detail
 * for the coordinates through the existing geocode adapter, opens the
 * order through `/api/orders` — which builds the Stripe session via
 * `lib/integrations/stripe.ts`, mock or live — and settles it through
 * `/api/checkout/complete`, exactly as `/checkout/mock/[id]` does. In
 * mock mode no card details are collected and no money moves, and the
 * section says so in a colour that exists nowhere else on the site.
 *
 * THE WALLET ROW IS DRAWN, NOT WIRED. Apple Pay and Google Pay are
 * rendered first because that is the order they belong in, and they are
 * disabled and labelled simulated because there is no payment sheet
 * behind them. A wallet button that silently did nothing would be worse
 * than no wallet button.
 */
export function ReviewSection({
  target,
  missionName,
  formatId,
  frame,
  tier,
  window: captureWindow,
  gift,
  giftNote,
  receiptEmail,
  onTier,
  onGiftNote,
  onEmail,
  currency,
  onCurrencyChange,
  archive = null,
  phase,
  opened = null,
  error,
  emailError,
}: {
  /** Read for the pass propagation and the archive scene. Both are per-point. */
  target: MissionTarget | null;
  missionName: string;
  formatId: FormatId;
  frame: FrameOption;
  tier: TierId;
  /** The tasking day chosen on the Window tab. Not used by the archive tier. */
  window: ChosenWindow | null;
  gift: boolean | null;
  giftNote: string;
  receiptEmail: string;
  onTier: (t: TierId) => void;
  onGiftNote: (v: string) => void;
  onEmail: (v: string) => void;
  /**
   * The currency this configuration will actually be CHARGED in, derived
   * from the target's country by `currencyForTarget`. Passed in rather than
   * read from a constant so the section cannot quote one currency while the
   * order records another — which it did, until an audit caught a US target
   * being shown "€189 EUR" and billed $260.
   */
  currency: Currency;
  /** Switch the billing currency (USD/EUR). */
  onCurrencyChange?: (c: Currency) => void;
  /** The historical scene chosen on the Window step, if any. */
  archive?: ChosenArchive | null;
  phase: CommissionPhase;
  /** The opened order (code + keyed link), while the checkout redirect is pending. */
  opened?: OpenedOrder | null;
  error: string | null;
  emailError: string | null;
}) {
  const activeFrame = effectiveFrame(tier, frame);
  const format = getFormat(formatId);
  const tasked = isTasked(tier);

  /* THE TWO PROMISES SHOWN ARE THE TWO THAT APPLY TO THIS TIER.
     Both are quoted verbatim from `lib/guarantees.ts`, which is the only
     source of guarantee wording — what changes here is WHICH pair, and
     that has to follow the product.

     A COMMISSION is a tasking, so the risks are the tasking's: cloud
     over the target, and no usable frame coming back. `retask` and
     `refund` are exactly those, and `TaskingEvidence` above points at
     the cloud promise by name where it explains why no capture-likelihood
     figure is printed.

     An ARCHIVE order flies nothing. The frame over those coordinates
     already exists — it is on file, it is dated in the record above, and
     it is being printed. Offering `Cloud-blocked passes are re-tasked at
     no cost` against it advertises a pass that will never be flown, and
     `Full refund if no usable frame is acquired within 60 days` a
     capture that has already happened: two promises with nothing behind
     them on this order, which is a worse failure than a missing one. The
     promises that DO cover a print — the replacement and the inclusive
     price — take their place, in the same words. */
  const [primaryTerm, secondaryTerm] = tasked
    ? ([guaranteeTerm('retask'), guaranteeTerm('refund')] as const)
    : ([guaranteeTerm('replace'), guaranteeTerm('shipping')] as const);

  /* Both evidence blocks are per-coordinate and both are cached, so
     opening this tab after the Window tab costs no second propagation and
     no second scene lookup. */
  const overhead = useOverhead(target?.lat ?? null, target?.lon ?? null);
  const scene = useScene(target?.lat ?? null, target?.lon ?? null);

  const options: readonly CardOption<TierId>[] = TIER_IDS.map((id) => {
    const copy = TIER_COPY[id];
    return {
      value: id,
      label: copy.name,
      /* `Recommended`, never `Most popular`. Nothing has shipped from this
         system, so there is no popularity to report; what IS true is that
         this is the tier the flow pre-selects. See `RECOMMENDED_TIER`. */
      tag: id === RECOMMENDED_TIER ? RECOMMENDED_TAG : undefined,
      note: (
        <>
          {copy.body}
          {TIER_FORCED_FRAME[id] ? <> Framed regardless of the finish chosen earlier.</> : null}
          {/* ONE LINE OF EVIDENCE ON THE CARD ITSELF, so the difference is
              legible before a card is selected rather than only after. Both
              lines are counts, and both are computed. */}
          {isTasked(id) ? (
            overhead && overhead.satellites.length > 0 ? (
              <>
                {' '}
                {overhead.satellites.length} of {overhead.tracked} tracked spacecraft cross this
                sky in the next {overhead.searchHours / 24} days.
              </>
            ) : null
          ) : archive ? (
            <>
              {' '}
              Your chosen capture: {captureDate(archive.capturedAt)}
              {archive.gsdCm ? `, ${archive.gsdCm} cm per pixel` : ''}
              {archive.cloudPct !== null ? `, ${archive.cloudPct}% cloud` : ''}.
            </>
          ) : (
            <> The most recent priced capture on file is used; pick a specific one on the Window step.</>
          )}
        </>
      ),
      /* `asideLabel` is what turns a bare number into a labelled field. The
         card control has carried the slot since the panel vocabulary landed and
         nothing passed it, so the three tier prices sat on the payment screen
         as unlabelled figures — the one place on the site where a number needs
         to say what it is. It is the TOTAL for that tier at the size and finish
         already chosen, which is exactly what `tierPriceMinor` returns and
         exactly what the foot will charge. */
      asideLabel: 'Total',
      aside: formatPrice(
        tierPriceMinor(id, formatId, effectiveFrame(id, frame), currency),
        currency,
      ),
    };
  });

  return (
    <div className="space-y-8">
      <PanelHead eyebrow="Confirmation" title="Review your commission." aside={missionName}>
        {format.metric}, {activeFrame === 'FRAMED' ? 'framed' : 'unframed'}. Shipping and duties
        are inside the price.
      </PanelHead>

      <PanelGroup label="Choose the commission">
        <CardGroup label="Commission tier" options={options} value={tier} onSelect={onTier} />
      </PanelGroup>

      {/* THE PROOF, for whichever tier is selected. */}
      {target ? (
        tasked ? (
          <TaskingEvidence overhead={overhead} window={captureWindow} />
        ) : (
          <ArchiveEvidence
            lat={target.lat}
            lon={target.lon}
            scene={scene}
            hasWindow={captureWindow !== null}
          />
        )
      ) : null}

      {/* What is included — moved here from the dossier screen, which is
          now the document in the preview column and has no room to read
          in. The lines follow the tier: an archive order has no pass to
          plate and nothing is tasked for it. */}
      <PanelGroup label="What is included">
        <ul>
          {[
            `The print — ${format.metric}, ${activeFrame === 'FRAMED' ? 'framed' : 'unframed'}.`,
            tasked
              /* "What is included" is a list of what ARRIVES. The plate is a
                 digital distinction, so it is named as one here — on its own
                 line beside "The print" it read as a second object in the box. */
              ? 'The telemetry plate of that pass — a digital distinction on your file.'
              : 'The telemetry plate of the archive frame — a digital distinction on your file.',
            /* THE CERTIFICATE IS PROMISED TO EVERYONE BECAUSE IT IS NOW
               OFFERED TO EVERYONE. This line used to appear on every
               order while <ConfirmationSection /> only showed the
               download to gift buyers — a promise kept for some of the
               people it was made to. The button moved, not the words. */
            'A commission certificate, downloadable the moment payment settles.',
          ].map((line) => (
            <li key={line} className={cn('border-t py-3 text-body', RULE, INK)}>
              {line}
            </li>
          ))}
        </ul>
      </PanelGroup>

      {/* THE MOCK MARKING, WHERE THE MONEY IS.

          It used to sit between the head and the tier cards, and at 390 it
          is 144px of a 291px scroller: the first thing a buyer saw on the
          payment section was one line of heading and a truncated amber
          plate reading `No money moves and no ca…`, with `PAY €279` in the
          foot and not one tier card in view. The choice this section exists
          for was below the fold on the section that takes the money.

          It has not been softened and it has not been shrunk — it is the
          same one-row plate, in the same off-palette amber, with the same
          words. It is simply beside the thing it is about. It marks the
          PAYMENT, not the tier: the wallets, the card fields and the
          receipt address all sit under it now, and the button it qualifies
          is pinned in the foot where it is visible from anywhere in this
          section. Nothing about the flow can reach a charge without passing
          it. */}
      {/* Billing currency — defaults to the visitor's region (geolocated), but
          the buyer picks. The whole flow re-prices from this instantly. */}
      {onCurrencyChange ? (
        <div className="flex items-center justify-between gap-3">
          <span className={cn('text-label uppercase', INK_DIM)}>Billing currency</span>
          <div className={cn('inline-flex overflow-hidden border', RULE, CURVE)}>
            {(['USD', 'EUR'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCurrencyChange(c)}
                aria-pressed={currency === c}
                className={cn('px-4 py-1.5 text-label uppercase transition-colors', currency === c ? INK : INK_DIM)}
                style={currency === c ? { backgroundColor: 'var(--color-signal)', color: '#08090b' } : undefined}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        role="note"
        className="flex flex-wrap items-baseline gap-x-3 gap-y-2 border px-3 py-2.5"
        style={{ borderColor: `${AMBER}66`, backgroundColor: `${AMBER}12`, borderLeftWidth: 2 }}
      >
        <span
          className="shrink-0 border px-2 py-1 text-label uppercase"
          style={{ borderColor: `${AMBER}99`, color: AMBER }}
        >
          Secure checkout
        </span>
        <p className={cn('min-w-0 flex-1 text-note', INK_DIM)}>
          Payment is taken on a secure hosted checkout page. Card details are entered there,
          never here.
        </p>
      </div>

      <div>
        <FieldLabel htmlFor="receipt-email" hint="For the receipt">
          Email
        </FieldLabel>
        <input
          id="receipt-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className={INPUT_CLASS}
          placeholder="you@example.com"
          value={receiptEmail}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? 'receipt-email-error' : 'receipt-email-note'}
          onChange={(e) => onEmail(e.target.value)}
        />
        {emailError ? (
          <FieldError id="receipt-email-error">{emailError}</FieldError>
        ) : (
          <p id="receipt-email-note" className={cn('pt-3 text-note', INK_DIM)}>
            Only used to send the receipt and the mission link. No account is created.
          </p>
        )}
      </div>

      {gift ? (
        <div>
          <FieldLabel htmlFor="gift-note" hint={`${giftNote.length} / 200`}>
            Gift note
          </FieldLabel>
          <textarea
            id="gift-note"
            rows={3}
            maxLength={200}
            className={cn(INPUT_CLASS, 'h-auto py-4 leading-normal')}
            placeholder="A line for whoever opens it."
            value={giftNote}
            onChange={(e) => onGiftNote(e.target.value)}
          />
        </div>
      ) : null}

      {error ? <ErrorPlate title="Authorisation refused">{error}</ErrorPlate> : null}

      {/* The two promises, once, above the button in the foot. Quoted
          from lib/guarantees.ts — the same strings /legal/terms sets. */}
      <div className={cn('grid gap-4 border-t pt-6', RULE)}>
        <Guarantee
          icon={primaryTerm.key}
          label={primaryTerm.label}
          detail={primaryTerm.detail}
        />
        <Guarantee
          icon={secondaryTerm.key}
          label={secondaryTerm.label}
          detail={secondaryTerm.detail}
        />
      </div>


      {phase === 'paying' ? (
        <p role="status" aria-live="polite" className={cn('text-label uppercase', INK_DIM)}>
          Opening secure checkout…
        </p>
      ) : null}

      {phase === 'opened' && opened ? (
        <div
          role="status"
          aria-live="polite"
          className="border px-4 py-3"
          style={{ borderColor: 'var(--color-signal)' }}
        >
          <p className="text-label uppercase" style={{ color: 'var(--color-signal)' }}>
            Mission {opened.missionCode} opened
          </p>
          <p className="mt-1 text-sm">
            Your mission link:{' '}
            <a href={opened.missionLink} className="underline break-all">
              {opened.missionLink.replace(/^https?:\/\//, '')}
            </a>
          </p>
          <p className={cn('mt-1 text-xs', INK_DIM)}>
            Keep it — it reopens payment any time and shows the mission&apos;s progress. Taking
            you to secure checkout…{' '}
            <a href={opened.checkoutUrl} className="underline">
              continue now
            </a>
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* What a commission actually buys                                     */
/* ------------------------------------------------------------------ */

/**
 * THE TASKING — the case for the price, made out of propagated geometry.
 *
 * Every figure here is produced by `lib/mission-flow/overhead.ts` running
 * SGP4 over the buyer's own coordinates against published CelesTrak
 * elements. Nothing is a constant, nothing is an average, and nothing is
 * a percentage.
 */
function TaskingEvidence({
  overhead,
  window: captureWindow,
}: {
  overhead: OverheadResult | null;
  window: ChosenWindow | null;
}) {
  const now = useNow(1000);

  if (!overhead) {
    return (
      <PanelGroup label="The tasking">
        <p className={cn('text-body', INK_DIM)} role="status">
          Propagating the tracked fleet over your coordinates…
        </p>
      </PanelGroup>
    );
  }

  if (overhead.satellites.length === 0) {
    /* A truthful empty answer. It is reachable — an element fetch that
       degraded to nothing, or coordinates no tracked satellite reaches —
       and it is stated rather than filled with a plausible list. */
    return (
      <PanelGroup label="The tasking">
        <p className={cn('text-body', INK_DIM)}>
          No pass over your coordinates could be propagated from the published elements just
          now. The commission is unaffected — tasking is brokered against the whole catalogue of
          operators, not against the fleet this site tracks — but nothing is shown here that was
          not computed.
        </p>
      </PanelGroup>
    );
  }

  const at = now ?? Date.parse(overhead.computedAt);
  const next = overhead.satellites
    .map((s) => ({ s, t: Date.parse(s.risesAt) }))
    .sort((a, b) => a.t - b.t)
    .find((x) => x.t > at);

  const day = captureWindow
    ? overhead.days.find((d) => d.date === captureWindow.date)
    : undefined;
  const totalPasses = overhead.days.reduce((sum, d) => sum + d.passes, 0);

  return (
    <PanelGroup label="The tasking" hint="Computed now">
      {next ? (
        <div className={cn('border-t pt-4', RULE)}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <span className={cn('text-label uppercase', INK_DIM)}>
              Next pass over your coordinates
            </span>
            <span
              data-telemetry
              className={cn('font-mono text-tele-s uppercase tabular-nums', INK_DIM)}
            >
              {next.s.peakElevationDeg}° PEAK
            </span>
          </div>
          <p
            data-telemetry
            aria-live="off"
            className={cn('pt-2 font-mono text-heading uppercase tabular-nums', INK)}
          >
            {now === null ? '—' : formatRemaining(next.t - at)}
          </p>
          <p className={cn('pt-2 text-note', INK_DIM)}>{formatInstant(next.s.risesAt)}</p>
        </div>
      ) : null}

      <dl className="pt-2">
        {captureWindow ? (
          <SpecRow label="Your tasking day" value={formatWindowDate(captureWindow.date)} mono />
        ) : null}
        {day ? (
          <>
            <SpecRow label="Passes that day" value={String(day.passes)} mono />
            <SpecRow label="Highest that day" value={`${day.peakElevationDeg}°`} mono />
          </>
        ) : null}
        <SpecRow
          label={`Opportunities in ${overhead.searchHours / 24} days`}
          value={`${totalPasses} passes · ${overhead.satellites.length} spacecraft`}
          mono
        />
      </dl>

    </PanelGroup>
  );
}

/* ------------------------------------------------------------------ */
/* What an archive order actually buys                                 */
/* ------------------------------------------------------------------ */

/**
 * THE EXISTING FRAME — an archive order shown as what it is: a picture.
 *
 * No countdown, no satellite list and no window, because an archive order
 * flies nothing. The picture is the same endpoint the reveal descends
 * through, and the record beside it is `lib/mission-flow/scene.ts` —
 * which is careful about the one thing that matters here: beyond
 * `ARCHIVE_MATCH_RADIUS_KM` the scene is a stand-in for somewhere else,
 * so it has no acquisition date to quote and none is quoted.
 */
function ArchiveEvidence({
  lat,
  lon,
  scene,
  hasWindow,
}: {
  lat: number;
  lon: number;
  scene: SceneInfo | null;
  hasWindow: boolean;
}) {
  return (
    <PanelGroup label="The existing frame">
      <div className={cn('overflow-hidden border', RULE)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={revealFrameUrl(lat, lon, 15)}
          alt="Archive satellite imagery over the target coordinates."
          className="block aspect-square w-full object-cover"
          decoding="async"
        />
      </div>

      <dl className="pt-4">
        <SpecRow
          label="Scene"
          value={scene ? `${scene.city} / ${scene.countryCode}` : 'Reading…'}
          mono
        />
        <SpecRow
          label="Acquired"
          value={scene ? (scene.acquired ?? 'Undated in the record') : '—'}
          mono
        />
        <SpecRow
          label="Scene centre"
          value={scene ? `${scene.distanceKm} KM from target` : '—'}
          mono
        />
        <SpecRow label="Sensor" value={scene ? scene.sensor : '—'} mono />
      </dl>

      <PanelNote className="pt-4">
        Nothing is tasked and no pass is flown, so an archive order ships as soon as it is
        printed.
        {hasWindow
          ? ' The capture window you chose is not used by this tier — it belongs to a commission, where a spacecraft is actually sent.'
          : ''}
      </PanelNote>
    </PanelGroup>
  );
}

/**
 * The archive scene record for a point, cached for the life of the page.
 *
 * The reveal already asks this question on section 1; the cache means
 * selecting the archive tier does not ask it again.
 */
const SCENE_CACHE = new Map<string, Promise<SceneInfo | null>>();

function useScene(lat: number | null, lon: number | null): SceneInfo | null {
  const [scene, setScene] = useState<SceneInfo | null>(null);

  useEffect(() => {
    if (lat === null || lon === null) return;
    const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    let pending = SCENE_CACHE.get(key);
    if (!pending) {
      pending = fetchScene(lat, lon)
        .then((r) => (r.ok ? r.data : null))
        .then((v) => {
          if (v === null) SCENE_CACHE.delete(key);
          return v;
        })
        .catch(() => {
          SCENE_CACHE.delete(key);
          return null;
        });
      SCENE_CACHE.set(key, pending);
    }

    let live = true;
    void pending.then((v) => {
      if (live && v) setScene(v);
    });
    return () => {
      live = false;
    };
  }, [lat, lon]);

  return scene;
}

/* ------------------------------------------------------------------ */
/* The commission itself                                               */
/* ------------------------------------------------------------------ */

/**
 * OPENING AND SETTLING THE ORDER.
 *
 * Lifted out of the offer screen unchanged so that the button which
 * triggers it can live in the panel foot, where it is visible without
 * scrolling. Every line below — the email gate, the late address
 * resolve, the tier sent to the server, the mock settlement — is the code
 * that was there before, in the order it was in.
 *
 * WHAT IS STILL NOT SENT, AND WHY IT IS NOT QUIETLY FUDGED. The chosen
 * tasking day. `/api/orders` has no field for it and `Mission.windowOpensAt`
 * is not that field — it means the collection window the operator BOOKED,
 * which is why `<SearchingForPass />` prints "no capture window until the
 * constellation accepts the collection" for a mission at MISSION_CONFIRMED.
 * Writing the buyer's requested day into it would make the mission file
 * contradict itself on the same screen. Persisting it properly needs one
 * nullable column of its own; until it exists,
 * <ConfirmationSection /> says what is and is not scheduled rather than
 * counting down to a booking nobody has made.
 */
export function useCommission({
  target,
  formatId,
  frame,
  tier,
  currency,
  areaKm,
  missionName,
  posterStyle,
  archiveId,
  gift,
  giftNote,
  receiptEmail,
  onPaid,
}: {
  target: MissionTarget | null;
  formatId: FormatId;
  frame: FrameOption;
  tier: TierId;
  currency: Currency;
  /** Footprint, km per side — the framing step's view slider. */
  areaKm: number;
  /** The buyer's mission name and poster composition, recorded on the order. */
  missionName: string;
  posterStyle: string;
  /** The historical scene chosen on the Window step, if any. */
  archiveId: string | null;
  gift: boolean | null;
  giftNote: string;
  receiptEmail: string;
  onPaid: (missionCode: string) => void;
}) {
  const [phase, setPhase] = useState<CommissionPhase>('idle');
  const [opened, setOpened] = useState<OpenedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const clearEmailError = useCallback(() => setEmailError(null), []);

  const pay = useCallback(async () => {
    if (phase === 'paying' || !target) return;

    if (!isEmail(receiptEmail)) {
      setEmailError('A receipt needs somewhere to go. Check the address.');
      document.getElementById('receipt-email')?.focus();
      return;
    }
    setEmailError(null);
    setPhase('paying');
    setError(null);

    const activeFrame = effectiveFrame(tier, frame);

    // The order route needs postal detail; this flow only ever had
    // coordinates, so they are resolved now — once, at the last moment.
    const resolved = await resolveAddress(target.lat, target.lon);
    if (!resolved) {
      setPhase('failed');
      setError(
        'No postal record could be resolved for these coordinates, so the order cannot be opened. Nothing has been charged.',
      );
      return;
    }

    const address = {
      ...toTargetAddress(resolved),
      // The line the reader gave is the target they meant; the resolved
      // record supplies the city, postcode and country the order needs.
      line1: target.label.slice(0, 160) || resolved.line1,
      // And the coordinates are theirs, never the geocoder's nearest match.
      lat: target.lat,
      lon: target.lon,
    };

    /* `tier` is sent and the SERVER prices from it. The amount is never
       sent from the browser: a client-supplied price is a client-supplied
       discount. Before this, no tier travelled at all and the order route
       priced from the catalogue instead, so the button said one number and
       the receipt said another. */
    const order = await createOrder({
      address,
      tier,
      formatId,
      frame: activeFrame,
      currency,
      email: receiptEmail.trim(),
      areaKm,
      missionName: missionName.trim() || undefined,
      posterStyle,
      archiveId: archiveId ?? undefined,
      dedication: gift && giftNote.trim() ? giftNote.trim() : undefined,
    });

    if (!order.ok) {
      setPhase('failed');
      setError(order.message);
      return;
    }

    // The mission now exists and has its keyed link — shown for a beat so the
    // buyer can keep it — then payment completes on Stripe's hosted checkout.
    // Its success_url returns the buyer to /m/{code}?paid=1&k=…, its cancel
    // URL to the same file with "Complete payment"; no card detail is ever
    // collected here. In mock mode the URL is the local checkout page.
    const missionLink =
      order.data.missionLink ?? `https://${missionShortLink(order.data.missionCode)}`;
    setOpened({ missionCode: order.data.missionCode, missionLink, checkoutUrl: order.data.checkoutUrl });
    setPhase('opened');
    window.setTimeout(() => window.location.assign(order.data.checkoutUrl), 3500);
  }, [phase, target, receiptEmail, tier, frame, formatId, currency, areaKm, missionName, posterStyle, archiveId, gift, giftNote]);

  return { phase, opened, error, emailError, pay, clearEmailError };
}
