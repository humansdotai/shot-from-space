'use client';

import { clsx as cn } from 'clsx';
import { INK, INK_DIM, RULE, Segmented } from '@/components/purchase/fields';
import { PosterStylePicker, posterStyleNote } from '@/components/poster/PosterStylePicker';
import { FORMATS, formatPrice } from '@/lib/pricing';
import { PACKAGING } from '@/lib/guarantees';
import type { Currency, FormatId, FrameOption } from '@/lib/types';
import {
  COMPOSABLE_STYLE_IDS,
  POSTER_STYLE_IDS,
  type PosterStyleId,
} from '@/lib/poster/styles';
import { DEFAULT_TIER, TIER_COPY, tierPriceMinor } from '@/lib/mission-flow/config';
import { revealFrameUrl } from '@/lib/mission-flow/api';
import type { MissionDraft } from '@/lib/mission-flow/state';
import { PanelDisclosure, PanelGroup, PanelHead, PanelNote, PreviewDisclosure } from './Panel';
import { CardGroup, type CardOption } from './CardGroup';
import { NO_MISSION_CODE } from './PosterStage';

/**
 * SECTION 4 — DESIGN (was screen 6, `Configure the print`).
 *
 * Size and finish are the same act — what the object IS — so they were
 * always one screen. What has changed is that the preview they exist to
 * change is no longer a thumbnail between them: it is the whole left
 * column, at the format's real proportion, in its frame, and it changes
 * as the radio changes.
 *
 * ------------------------------------------------------------------
 * COMPOSITION FIRST, THEN SIZE, THEN FINISH
 * ------------------------------------------------------------------
 * <PosterStylePicker /> is another build's component, mounted by import
 * path. It sits above `Size` because how the sheet is divided is the
 * broadest of the three choices and progressive disclosure puts the
 * broadest first; the size and the finish then apply to a composition
 * the buyer has already seen.
 *
 * WHAT MAY BE OFFERED. `available={COMPOSABLE_STYLE_IDS}`, and that is
 * not a default — it is the gate `lib/poster/styles.ts` wrote for
 * surfaces that take money. Four compositions are declared; the print
 * pipeline (`lib/poster/layout.ts`) lays out one of them today, so one
 * is what can be ordered. Offering the other three here would be selling
 * a file this repository cannot produce. The note under the picker says
 * so plainly rather than leaving the buyer to wonder why a `Design` tab
 * has a single card.
 *
 * PRICE. Quoted live for the COMMISSION tier, which is the core product
 * and the tier the Review section opens on, and it is the same figure the
 * panel foot carries — `tierPriceMinor()`, once, in both places. Sizes
 * are priced in `lib/pricing.ts` and tiers in `lib/mission-flow/config.ts`,
 * and nothing is priced here.
 */
/**
 * Why the catalogue is wider than the offer. KEPT, SHORTENED: a buyer who
 * has heard the poster has four compositions and is shown one will ask,
 * and the honest answer is also the reassuring one — the others are not
 * withheld behind a price, they cannot yet be printed.
 */
function CompositionsNote() {
  if (COMPOSABLE_STYLE_IDS.length >= POSTER_STYLE_IDS.length) return null;
  return (
    <PanelNote className="pt-2">
      {POSTER_STYLE_IDS.length - COMPOSABLE_STYLE_IDS.length} further compositions are drawn but
      not yet printable, so only this one is sold.
    </PanelNote>
  );
}

export function DesignSection({
  draft,
  formatId,
  frame,
  onFormat,
  onFrame,
  onStyle,
  currency,
}: {
  /** Read for the style thumbnails, which depict the buyer's own mission. */
  draft: MissionDraft;
  formatId: FormatId;
  frame: FrameOption;
  onFormat: (id: FormatId) => void;
  onFrame: (f: FrameOption) => void;
  onStyle: (id: PosterStyleId) => void;
  /**
   * The currency this configuration will actually be CHARGED in, derived
   * from the target's country by `currencyForTarget`. Passed in rather than
   * read from a constant so the section cannot quote one currency while the
   * order records another — which it did, until an audit caught a US target
   * being shown "€189 EUR" and billed $260.
   */
  currency: Currency;
}) {
  const price = (id: FormatId) =>
    formatPrice(tierPriceMinor(DEFAULT_TIER, id, frame, currency), currency);

  const sizeOptions: readonly CardOption<FormatId>[] = FORMATS.map((f) => ({
    value: f.id,
    label: `${f.metric} · ${f.imperial}`,
    note: f.note,
    aside: price(f.id),
  }));

  return (
    <div className="space-y-8">
      {/* INSTRUCTIONAL COPY FOR A THING THE BUYER IS LOOKING AT. The old
          standfirst inventoried the preview — frame, telemetry strip,
          print credit, proportion — all of which are visible in the
          preview. What it could NOT be read off the picture is the one
          clause kept: that this is the composition that prints. */}
      <PanelHead eyebrow="Capture" title="Configure the print.">
        The preview above is the composition that prints.
      </PanelHead>

      {draft.target ? (
        <PanelGroup label="Composition">
          <PosterStylePicker
            value={draft.posterStyle}
            onChange={onStyle}
            formatId={formatId}
            frame={frame}
            available={COMPOSABLE_STYLE_IDS}
            label="Poster composition"
            subject={{
              missionCode: draft.missionCode ?? NO_MISSION_CODE,
              capturedAt: null,
              lat: draft.target.lat,
              lon: draft.target.lon,
              locationLabel: draft.target.address
                ? [draft.target.address.city, draft.target.address.region, draft.target.address.country]
                    .filter(Boolean)
                    .join(' / ')
                : draft.target.label,
              orbit: {
                inclination: '',
                track: '',
                altitudeKm: 0,
                gsdM: 0,
                sensor: '',
                azimuthDeg: 0,
                offNadirDeg: 0,
                cloudPct: 0,
              },
              coordDp: 4,
              degraded: true,
            }}
            image={{ src: revealFrameUrl(draft.target.lat, draft.target.lon, 17), unoptimized: true }}
          />
          {/* DEMOTED. `posterStyleNote()` is a forty-word essay on the
              composition the buyer has just tapped — and the card they
              tapped already carries its name, its one-line description
              and the share of the sheet the frame takes. A paragraph
              restating a selected card is the clearest case of detail
              that belongs on demand. The words are unchanged and still
              come from `lib/poster/styles.ts`. */}
          <PanelDisclosure className="pt-3" summary="About this composition">
            {posterStyleNote(draft.posterStyle)}
          </PanelDisclosure>
          <CompositionsNote />
        </PanelGroup>
      ) : null}

      <PanelGroup label="Size">
        <CardGroup label="Print size" options={sizeOptions} value={formatId} onSelect={onFormat} />
      </PanelGroup>

      <PanelGroup label="Finish">
        <Segmented<FrameOption>
          name="mission-frame"
          label="Finish"
          value={frame}
          onChange={onFrame}
          options={[
            { value: 'UNFRAMED', label: 'Unframed', sub: PACKAGING.unframedShort },
            { value: 'FRAMED', label: 'Framed', sub: PACKAGING.framedShort },
          ]}
        />
      </PanelGroup>

      <div className={cn('flex items-baseline justify-between gap-6 border-t pt-5', RULE)}>
        <span className={cn('text-label uppercase', INK_DIM)}>{TIER_COPY[DEFAULT_TIER].name}</span>
        <span className={cn('text-heading tabular-nums', INK)} data-telemetry>
          {formatPrice(tierPriceMinor(DEFAULT_TIER, formatId, frame, currency), currency)}{' '}
          {currency}
        </span>
      </div>

      {/* PRICE TRANSPARENCY, NOT A SECOND PRICE LIST. What the figure
          above is one of, and where the other two are chosen. The
          paragraph explaining what a commission IS belongs on the
          Review step, beside the cards that offer the alternative. */}
      <PanelNote>
        Priced as a commission. Review also offers the archive frame and the large format at this
        size.
      </PanelNote>

      <PreviewDisclosure />
    </div>
  );
}
