'use client';

import { useMemo } from 'react';
import { clsx as cn } from 'clsx';
import { OrbitGlyph } from '@/components/satellites/OrbitGlyph';
import { INK, INK_DIM, RULE } from '@/components/purchase/fields';
import {
  CAPTURE_GSD_BASIS,
  CAPTURE_GSD_CM,
  PASS_ATTRIBUTION,
  PASS_MIN_ELEVATION_DEG,
} from '@/lib/mission-flow/config';
import { FieldRow, FieldTable, PanelGroup, PanelHead, PanelNote, PanelStack } from './Panel';
import {
  fixed,
  groupDigits,
  phaseOf,
  untilLabel,
  useLiveClock,
  useLiveLook,
  useSkyReading,
  utcStamp,
} from './PassGeometry';
import type { MissionTarget } from '@/lib/mission-flow/state';

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
export function FramingSection({ target }: { target: MissionTarget }) {
  const sky = useSkyReading(target.lat, target.lon);
  const seed = useMemo(() => new Date().toISOString(), []);
  const now = useLiveClock(seed);
  const crossing = sky.reading?.next ?? null;
  const { look } = useLiveLook(crossing, target.lat, target.lon, now);

  const lines = [
    {
      n: '01',
      text: crossing
        ? `A spacecraft crosses this sky. The next one clears the horizon in ${untilLabel(crossing.risesAt, now).toLowerCase()} and climbs to ${fixed(crossing.peakElevation, 0)}°.`
        : 'A spacecraft crosses this sky. It is not overhead now and it will not be for long when it is — a pass is minutes.',
    },
    {
      n: '02',
      text: `Near the top of that arc the sensor is tasked at ${CAPTURE_GSD_CM} cm per pixel.`,
    },
    {
      n: '03',
      text: 'The frame you place here is what it is pointed at. Your print carries the telemetry of that pass.',
    },
  ];

  return (
    <PanelStack>
      <PanelHead eyebrow="Capture · 02" title="Where the frame falls.">
        Position the capture footprint over the ground you want in the print.
      </PanelHead>

      <ol className="flex flex-col">
        {lines.map((line) => (
          <li key={line.n} className={cn('flex items-baseline gap-4 border-b py-3.5', RULE)}>
            <span
              data-telemetry
              className={cn('shrink-0 font-mono text-tele uppercase tabular-nums', INK_DIM)}
            >
              {line.n}
            </span>
            <span className={cn('max-w-[var(--measure)] text-body', INK)}>{line.text}</span>
          </li>
        ))}
      </ol>

      {crossing ? (
        <PanelGroup
          label="The pass those numbers came from"
          hint="Live"
          note={
            <>
              Height is what makes the difference to the frame. A pass low on the horizon sees a
              roof from the side, through several times the air; one near the top of the sky looks
              almost straight down — which is the same thing the resolution note below means by how
              far off nadir the spacecraft flies.
            </>
          }
        >
          {/* The glyph's ring is this spacecraft's real inclination and its
              marker is its real mean anomaly advanced to this second. It is
              an icon that is also a readout — the distinction
              `components/satellites/OrbitGlyph.tsx` draws, and the reason it
              is allowed to move at all. */}
          <div className="flex items-center gap-4 pb-4">
            <OrbitGlyph
              inclination={crossing.inclination}
              phase={phaseOf(crossing, now)}
              size={56}
              className={cn(
                'shrink-0',
                look && look.elevation >= PASS_MIN_ELEVATION_DEG
                  ? 'text-[color:var(--accent)]'
                  : INK_DIM,
              )}
            />
            <p className={cn('min-w-0 text-note', INK_DIM)}>
              {crossing.name}, {crossing.operator}
              {look ? `, ${groupDigits(look.rangeKm)} km away as you read this` : ''}.
            </p>
          </div>

          <FieldTable>
            <FieldRow
              label="Rises in"
              value={untilLabel(crossing.risesAt, now)}
              note={`${utcStamp(crossing.risesAt)} — when it clears your horizon.`}
            />
            <FieldRow
              label="Highest point"
              value={`${fixed(crossing.peakElevation, 0)}°`}
              note={`Above the horizon. ${PASS_MIN_ELEVATION_DEG}° is the floor for imaging.`}
            />
            <FieldRow
              label="Above the horizon"
              value={fixed(crossing.durationMin, 0)}
              unit="min"
              note="Horizon to horizon."
            />
            <FieldRow label="Ground sample ordered" value={String(CAPTURE_GSD_CM)} unit="cm/px" />
          </FieldTable>
        </PanelGroup>
      ) : null}

      <PanelNote>
        {CAPTURE_GSD_BASIS} {PASS_ATTRIBUTION}
      </PanelNote>
    </PanelStack>
  );
}
