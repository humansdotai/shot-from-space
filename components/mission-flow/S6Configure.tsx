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
import { printPriceMinor } from '@/lib/mission-flow/config';
import { revealFrameUrl } from '@/lib/mission-flow/api';
import type { MissionDraft } from '@/lib/mission-flow/state';
import { PanelGroup, PanelHead, PanelNote, PreviewDisclosure } from './Panel';
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
  /* The PRINT's own price at the chosen finish — the mission total is in the panel foot. */
  const price = (id: FormatId) => formatPrice(printPriceMinor(id, frame, currency), currency);

  const sizeOptions: readonly CardOption<FormatId>[] = FORMATS.map((f) => ({
    value: f.id,
    label: `${f.metric} · ${f.imperial}`,
    note: f.note,
    aside: price(f.id),
  }));

  return (
    <div className="space-y-8">
      <PanelHead eyebrow="Capture" title="Configure the print.">
        Composition, size and finish. The preview is what prints.
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
          {COMPOSABLE_STYLE_IDS.length < POSTER_STYLE_IDS.length ? (
            <PanelNote className="pt-2">
              {POSTER_STYLE_IDS.length - COMPOSABLE_STYLE_IDS.length} further compositions are
              designed and drawn, and the print pipeline lays out only this one today. Only a
              composition that can actually be printed is offered for sale.
            </PanelNote>
          ) : null}
        </PanelGroup>
      ) : null}

      <PanelGroup label="Size" hint="Print price">
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


      <PreviewDisclosure />
    </div>
  );
}
