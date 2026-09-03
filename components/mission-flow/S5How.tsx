'use client';

import { useMemo } from 'react';
import { clsx as cn } from 'clsx';
import { INK, INK_DIM, RULE } from '@/components/purchase/fields';
import { CAPTURE_GSD_CM, PASS_ATTRIBUTION } from '@/lib/mission-flow/config';
import { PanelGroup, PanelHead, PanelNote, PanelStack } from './Panel';
import { fixed, untilLabel, useLiveClock, useSkyReading } from './PassGeometry';
import { AREA_KM_MAX, AREA_KM_MIN, type MissionTarget } from '@/lib/mission-flow/state';
import type { QuoteView } from '@/lib/pricing-model';

/**
 * SECTION 2 — FRAMING (was screen 5, `How it works`).
 *
 * ------------------------------------------------------------------
 * A NARRATION SCREEN BECOMES A SIDE NOTE ON A DECISION
 * ------------------------------------------------------------------
 * Screen 5 carried no decision at all: three lines and a `Continue`.
 * CONFIGURATOR.md is explicit that a screen of pure narration may fold
 * into an adjacent section, and this is the one it belongs to — the
 * three lines describe the capture, and this is the section where the
 * buyer positions the capture. The decision itself lives in the preview
 * column: the capture footprint on a basemap,
 * `components/frame/FrameOnMap.tsx`, mounted by <FramingStage />.
 * Everything in this panel exists to tell the buyer what they are
 * looking at while they use it.
 *
 * ------------------------------------------------------------------
 * THE THREE LINES NOW CARRY NUMBERS
 * ------------------------------------------------------------------
 * They used to read "A satellite passes over your coordinates" — true,
 * and indistinguishable from marketing, because nothing about it could
 * be checked. It now names the actual next crossing of these actual
 * coordinates: when it rises and how high it climbs, propagated by SGP4
 * in this browser from CelesTrak's published elements (see
 * `./PassGeometry.tsx`). A different address prints different numbers,
 * which is the difference between a fact and a slogan.
 *
 * WHY THE ELEVATION IS PRINTED AT ALL. It is the one figure that
 * connects the geometry to the picture the buyer is placing. A pass low
 * on the horizon looks at a roof from the side, through several times
 * the air; a high pass looks nearly straight down. That is also what
 * `CAPTURE_GSD_BASIS` means when it says the figure depends on how far
 * off nadir the spacecraft flies — so the two are said together rather
 * than in two different places.
 *
 * ------------------------------------------------------------------
 * THE RESOLUTION FIGURE
 * ------------------------------------------------------------------
 * `CAPTURE_GSD_CM` from the config, with `CAPTURE_GSD_BASIS` printed
 * beside it, always. What is contracted with the operator is a
 * resolution TIER; the exact ground sample distance depends on the
 * spacecraft assigned and how far off nadir it flies, and a product that
 * sells resolution does not get to quote a figure without saying where
 * it comes from.
 *
 * WHAT IS NOT REPEATED HERE. That the basemap is reference imagery, who
 * serves it, at what ground sample, and where the frame centre currently
 * sits: <FrameOnMap /> prints all four under the map, in more detail
 * than a panel note could, and saying it twice would make the second one
 * look like a different claim.
 */
export function FramingSection({
  target,
  areaKm,
  onAreaKm,
  priceLabel,
  quote = null,
}: {
  target: MissionTarget;
  /** Footprint, km per side. */
  areaKm: number;
  onAreaKm: (areaKm: number) => void;
  /** The live total for the current configuration, e.g. "Commission · €296.34". */
  priceLabel?: string;
  /** The live breakdown behind that total — imagery, print, margin. */
  quote?: QuoteView | null;
}) {
  const sky = useSkyReading(target.lat, target.lon);
  const seed = useMemo(() => new Date().toISOString(), []);
  const now = useLiveClock(seed);
  const crossing = sky.reading?.next ?? null;
  const px = Math.round((areaKm * 1000) / (CAPTURE_GSD_CM / 100));
  const km = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  return (
    <PanelStack>
      <PanelHead eyebrow="Capture · 02" title="Frame the ground.">
        Drag the map to place the footprint. Slide to choose how much ground the print covers.
      </PanelHead>

      <PanelGroup label="View" hint={`${km(areaKm)} × ${km(areaKm)} km`}>
        <input
          type="range"
          min={AREA_KM_MIN}
          max={AREA_KM_MAX}
          step={0.1}
          value={areaKm}
          aria-label="Footprint width in kilometres"
          aria-valuetext={`${km(areaKm)} kilometres`}
          onChange={(e) => onAreaKm(Number(e.target.value))}
          className="block w-full cursor-pointer accent-[color:var(--accent)]"
        />
        <div className={cn('mt-2 flex justify-between font-mono text-tele uppercase tabular-nums', INK_DIM)}>
          <span>{AREA_KM_MIN} km · a house and its street</span>
          <span>{AREA_KM_MAX} km · a district</span>
        </div>
        <p className={cn('mt-3 text-note', INK)}>
          ≈ {px.toLocaleString('en-GB')} px across at {CAPTURE_GSD_CM} cm per pixel
          {priceLabel ? ` · ${priceLabel}` : ''}
        </p>
        {quote ? (
          <dl className={cn('mt-3 border-t pt-3 text-note', RULE, INK_DIM)}>
            <div className="flex justify-between gap-4">
              <dt>Imagery</dt>
              <dd className="tabular-nums">{money(quote.imagery, quote.currency)}</dd>
            </div>
            <p className="pt-1">
              {quote.tier === 'ARCHIVE'
                ? `${quote.imageryNote}. A smaller frame costs less.`
                : `A new tasking is billed at a 25 km² minimum, so every frame up to ${AREA_KM_MAX} × ${AREA_KM_MAX} km costs the same.`}
            </p>
            <div className="flex justify-between gap-4 pt-2">
              <dt>Print</dt>
              <dd className="tabular-nums">{money(quote.print, quote.currency)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Margin · 10 %</dt>
              <dd className="tabular-nums">{money(quote.margin, quote.currency)}</dd>
            </div>
            <div className={cn('flex justify-between gap-4 border-t pt-2', RULE, INK)}>
              <dt>Total</dt>
              <dd className="tabular-nums">{money(quote.total, quote.currency)}</dd>
            </div>
          </dl>
        ) : null}
      </PanelGroup>

      {crossing ? (
        <p className={cn('border-t py-3.5 text-note', RULE, INK_DIM)}>
          Next pass: {crossing.name} ({crossing.operator}) clears the horizon in{' '}
          {untilLabel(crossing.risesAt, now).toLowerCase()} and climbs to{' '}
          {fixed(crossing.peakElevation, 0)}°.
        </p>
      ) : null}

      <PanelNote>{PASS_ATTRIBUTION}</PanelNote>
    </PanelStack>
  );
}

function money(v: number, currency: 'USD' | 'EUR'): string {
  return `${currency === 'USD' ? '$' : '€'}${v.toFixed(2)}`;
}
