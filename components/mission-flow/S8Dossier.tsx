'use client';

import { clsx as cn } from 'clsx';
import { INK, INK_DIM, RULE, SpecRow } from '@/components/purchase/fields';
import { getFormat, formatPrice } from '@/lib/pricing';
import type { Currency } from '@/lib/types';
import { effectiveFrame, TIER_COPY, tierPriceMinor, type TierId } from '@/lib/mission-flow/config';
import { captureDate } from './S7Archives';
import { telemetryCoords } from '@/lib/mission-flow/entry';
import { revealFrameUrl } from '@/lib/mission-flow/api';
import type { MissionDraft } from '@/lib/mission-flow/state';
import { MissionGround, type MissionClip, type MissionStill } from './MissionGround';
import { formatWindowDate } from './S7Windows';

/**
 * ==================================================================
 * THE DOSSIER — the preview column's artefact for Review and for the
 * Confirmation, and the one place the two tiers look different before
 * a word is read.
 * ==================================================================
 *
 * ------------------------------------------------------------------
 * WHY A SCREEN BECAME AN OBJECT
 * ------------------------------------------------------------------
 * Screen 8 was everything answered so far, on one page, before any money
 * was discussed — and then a `Review your commission` button that was
 * below the fold. It carried no decision of its own.
 *
 * A configurator already has a place for a thing with no decision in it:
 * the preview column. So the dossier is now literally the document on the
 * desk beside the money, and the price on it and the price on the button
 * are the same call to `tierPriceMinor()`.
 *
 * ------------------------------------------------------------------
 * THE GROUND UNDER THE DOCUMENT IS THE ARGUMENT
 * ------------------------------------------------------------------
 * The two tiers are two different acts and the column says so without
 * asserting anything:
 *
 *   COMMISSION   motion. A spacecraft in orbit, moving, under a document
 *                for a frame that does not exist yet.
 *   ARCHIVE      a still. The picture that already exists over these
 *                coordinates, because that is the entire product: an
 *                existing capture, printed.
 *
 * That is the composition `section-middle.pdf` sets — the sheet centred
 * on a full-bleed aerial, held by a white mount — used here to carry a
 * distinction rather than as decoration.
 *
 * THIS FILE NO LONGER OWNS THAT COMPOSITION. It was written here first
 * and it is now <MissionGround />, which every section putting a card in
 * the preview column uses — the clip, the measured scrim, the mount and
 * the honesty note are one construction so the treatment cannot drift
 * between steps. All that is decided here is WHICH ground the tier gets;
 * see `dossierGround()` at the foot of the file.
 *
 * THE PAPER. Everything else on this surface is the instrument. This is
 * the document, and the document is on paper: `.surface-light` inverts
 * every ground-following atom inside it with no variant and no prop.
 */
export function DossierDocument({
  draft,
  currency,
}: {
  draft: MissionDraft;
  currency: Currency;
}) {
  const target = draft.target;
  if (!target) return null;

  const format = getFormat(draft.formatId);
  const activeFrame = effectiveFrame(draft.tier, draft.frame);
  const total = tierPriceMinor(draft.tier, draft.formatId, activeFrame, currency);
  const captureWindow = draft.window;
  /* THE SAME DOCUMENT, BEFORE AND AFTER THE MONEY. It is the Review
     section's artefact and then the Confirmation's, and the one line it
     must not get wrong is whether anything has been charged. */
  const commissioned = draft.missionCode !== null;
  const tasked = isTasked(draft.tier);

  return (
    /* THE GROUND. <MissionGround /> owns the clip, the measured scrim,
       the mount and the honesty note, here and on every other section
       that puts a card in the preview column. This file no longer knows
       which file is played or what the note says. */
    <MissionGround {...dossierGround(draft.tier, target.lat, target.lon)}>
      {/* Two elements, not one: the sheet SCROLLS when the column is
          shorter than the record — a 390 phone always is — and a fade
          drawn inside a scroller scrolls away with the content it is
          supposed to be marking. So the fade rides the wrapper. */}
      <div className="relative flex max-h-full w-full max-w-[30rem] flex-col">
        <div
          className={cn(
            'surface-light min-h-0 w-full overflow-y-auto overscroll-contain border bg-[color:var(--ground)] px-4 py-4 lg:px-6 lg:py-6',
            RULE,
          )}
        >
          <p className={cn('text-label uppercase', INK_DIM)}>Mission dossier</p>
          <p data-telemetry className={cn('pt-2 font-mono text-heading uppercase break-words', INK)}>
            {draft.missionName}
          </p>
          <p className={cn('max-w-[var(--measure)] pt-3 text-note', INK_DIM)}>
            {commissioned
              ? 'Commissioned. A receipt is on its way to the address you gave.'
              : 'Everything as commissioned. Nothing has been charged.'}
          </p>

          <dl className="pt-5">
            <SpecRow label="Coordinates" value={telemetryCoords(target.lat, target.lon)} mono />
            <SpecRow
              label="Acquisition"
              value={tasked ? 'New tasking' : 'Existing capture'}
            />
            {/* AN ARCHIVE ORDER IS NOT TASKED, so it has no tasking day
                and none is printed against it. The row used to say
                `Capture window / TUE 25 AUG` whatever the tier, which
                described a pass that an archive order never flies. */}
            {tasked ? (
              <>
                <SpecRow
                  label="Capture window"
                  value={captureWindow ? formatWindowDate(captureWindow.date) : 'Not selected'}
                  mono
                />
                <SpecRow
                  label="Commission by"
                  value={captureWindow ? formatWindowDate(captureWindow.commitBy) : '—'}
                  mono
                />
              </>
            ) : (
              <SpecRow
                label="Captured"
                value={draft.archive ? captureDate(draft.archive.capturedAt) : 'Most recent on file'}
                mono
              />
            )}
            <SpecRow label="Format" value={`${format.designation} / ${format.metric}`} />
            <SpecRow label="Finish" value={activeFrame === 'FRAMED' ? 'Framed' : 'Unframed'} />
            {draft.gift ? <SpecRow label="Prepared as" value="A gift" /> : null}
            {draft.missionCode ? (
              <SpecRow label="Reference" value={draft.missionCode} mono />
            ) : null}
          </dl>

          {tasked && captureWindow?.indicative ? (
            <p className={cn('pt-5 text-note', INK_DIM)}>
              The window above is indicative: orbital elements were not available when it was
              chosen, so it is not a propagated pass over your coordinates.
            </p>
          ) : null}

          <div className={cn('mt-5 flex items-baseline justify-between gap-6 border-t pt-4', RULE)}>
            <span className={cn('text-label uppercase', INK_DIM)}>
              {TIER_COPY[draft.tier].name}
              {commissioned ? '' : ' as configured'}
            </span>
            <span data-telemetry className={cn('text-heading tabular-nums', INK)}>
              {formatPrice(total, currency)} {currency}
            </span>
          </div>
        </div>

        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-px bottom-px h-8 bg-linear-to-t from-paper to-transparent lg:hidden"
        />
      </div>
    </MissionGround>
  );
}

/** Is a spacecraft flown for this tier, or is the frame already on file? */
export function isTasked(tier: TierId): boolean {
  return tier !== 'ARCHIVE';
}

/* ------------------------------------------------------------------ */
/* Which ground goes under the document                                */
/* ------------------------------------------------------------------ */

/**
 * Motion for a tasking, a still for a frame that already exists.
 *
 * The two tiers are two different acts, and the column says so without
 * asserting anything: a COMMISSION is a spacecraft in orbit, moving,
 * under a document for a frame that does not exist yet; an ARCHIVE is
 * the picture that already exists over these coordinates, because that
 * is the entire product.
 *
 * This function chooses. <MissionGround /> renders — the scrim, the
 * mount and the honesty note are identical either way, and identical to
 * every other section, because they are written once and not here.
 *
 * ZOOM 15 IS NOT A LOOK, IT IS A CACHE HIT. `/api/geocode/static` crops
 * with sharp and takes several seconds cold, and 15 is the last step of
 * the reveal on section 1 — so by the time anybody reaches Review the
 * browser already holds this exact URL and the ground appears with the
 * tier rather than eight seconds after it. Asking for 14 here made a
 * black plate on a cold cache.
 */
function dossierGround(
  tier: TierId,
  lat: number,
  lon: number,
): { clip: MissionClip } | { still: MissionStill } {
  if (isTasked(tier)) return { clip: 'zoom-logo' };
  return {
    still: {
      src: revealFrameUrl(lat, lon, 15),
      alt: 'Archive satellite imagery over the target coordinates.',
      // The archive crop is not geo-registered and never claims to be.
      note: 'Archive scene · cropped for preview, not geo-registered',
    },
  };
}
