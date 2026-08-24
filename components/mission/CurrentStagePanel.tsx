'use client';

import { clsx as cn } from 'clsx';
import { Button, OrbitDiagram } from '@/components/fui';
import { MISSION_STAGES, stageIndex, type MissionDTO } from '@/lib/types';
import { formatCoords } from '@/lib/utils';
import {
  coordDp,
  datestamp,
  deg,
  eventAt,
  facilityCity,
  facilityCountry,
  formatWindowRange,
  nextPassAt,
  stamp,
} from './telemetry';
import { ACCENT, INK, INK_DIM, LiveValue, RULE } from './ui';

interface Reading {
  label: string;
  value: string;
  /** Coordinates, timestamps and elapsed times only. */
  mono?: boolean;
  /** Re-read on every poll — flashes when it moves. */
  live?: boolean;
  tone?: 'accent' | 'dim';
}

/**
 * THE ACTIVE STAGE READOUT — filed inside the current row of the timeline.
 *
 * Everything the mission is doing right now and nothing it did before: the
 * readings that belong to this stage, capped at six, with anything else left
 * to the specification band.
 *
 * It is the one genuinely live thing on the page. Readings marked `live` are
 * wrapped in <LiveValue />, which flashes them at the accent when the
 * fifteen-second poll brings back a different number — so a window opening or
 * a cloud forecast moving is something the reader sees happen rather than
 * something they have to notice.
 *
 * ------------------------------------------------------------------
 * WHY THIS PANEL IS BLACK, INSIDE A PAPER BAND
 * ------------------------------------------------------------------
 * It is an INSTRUMENT sitting inside a DOCUMENT. The timeline around it is
 * the record — nine stages and their timestamps, typeset on paper. This is
 * the live readout of the one stage that has not finished, and on the paper
 * ground it was a slightly greyer card in a column of slightly greyer cards:
 * nothing said "this one is moving".
 *
 * `surface-dark` is the whole change. It hands the panel void, paper ink and
 * the dark hairline, so every child — <Chip />, <LiveValue />, <Button />,
 * the rules — inverts by reading `--ground` / `--ink`, with no variant and no
 * second component. It is the exhibit's construction run the other way: that
 * band insets a lit wall in a dark room, this one insets an instrument in a
 * lit document.
 *
 * ------------------------------------------------------------------
 * "HAPPENING NOW" MOVED, AND THIS IS WHERE IT WENT
 * ------------------------------------------------------------------
 * The head used to read "Happening now". That phrase now belongs to the band
 * at the top of the file — <SearchingForPass />, the black screen carrying
 * the large live sky figure — and two "Happening now" headings on one page
 * were two claims to the same moment. This one says what it actually is: the
 * readout for the stage the mission is standing in.
 */
export function CurrentStagePanel({
  mission,
  now,
  live,
  layout = 'filed',
  orbit = true,
}: {
  mission: MissionDTO;
  /** Current clock — server clock on first paint, live after mount. */
  now: Date;
  /** True while the file is polling for telemetry. */
  live: boolean;
  /**
   * Where the panel is standing.
   *
   * `filed` is the panel inside the active timeline row, below 1280: it has
   * the width of the whole column, so the orbit sits beside the readings and
   * the readings run two-up.
   *
   * `rail` is the panel beside the timeline from 1280: roughly a third of the
   * column, so the orbit sits above the readings and the readings run one-up.
   * Same content, same order, different width — not a second component.
   */
  layout?: 'filed' | 'rail';
  /**
   * Draw the small orbit garnish. Off when the surrounding page already
   * carries an <OrbitPlot />, which states the same thing as an instrument
   * and is explicit that it replaces this one: two orbits on one screen are
   * two claims about where the satellite is.
   */
  orbit?: boolean;
}) {
  const rail = layout === 'rail';
  const i = stageIndex(mission.stage);
  const items = stageRows(mission, now);
  const showOrbit = orbit && i < stageIndex('IMAGE_ACQUIRED');
  const closing = mission.stage === 'FINAL_APPROACH' || mission.stage === 'DELIVERED';
  const tracking =
    mission.trackingUrl && (mission.stage === 'SHIPPED' || mission.stage === 'FINAL_APPROACH');

  return (
    <aside
      aria-label="Current stage readout"
      className={cn('surface-dark rounded-[12px] border p-5 sm:p-6', RULE)}
    >
      <div className={cn('flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b pb-4', RULE)}>
        <h4 className={cn('text-label uppercase', INK_DIM)}>This stage</h4>
        <span data-telemetry className={cn('font-mono text-tele-s uppercase', INK_DIM)}>
          STAGE {String(i + 1).padStart(2, '0')} / {String(MISSION_STAGES.length).padStart(2, '0')}
        </span>
      </div>

      <div
        className={cn(
          'mt-6 flex flex-col gap-7',
          rail ? 'items-start' : 'sm:flex-row sm:items-start sm:gap-8',
        )}
      >
        {showOrbit ? (
          <OrbitDiagram
            track={mission.orbit.track}
            inclination={mission.orbit.inclination}
            altitudeKm={mission.orbit.altitudeKm}
            size={rail ? 116 : 132}
            animated={mission.stage === 'CAPTURE_WINDOW'}
            className="shrink-0"
          />
        ) : null}

        {items.length ? (
          <dl
            className={cn(
              'grid w-full flex-1 gap-x-8 gap-y-5',
              rail
                ? 'grid-cols-1'
                : showOrbit
                  ? 'grid-cols-1 lg:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2',
            )}
          >
            {items.map((item) => (
              <div key={item.label} className="flex min-w-0 flex-col gap-1.5">
                <dt className={cn('text-label uppercase', INK_DIM)}>{item.label}</dt>
                <dd
                  className={cn(
                    'min-w-0 break-words',
                    item.tone === 'accent' ? ACCENT : item.tone === 'dim' ? INK_DIM : INK,
                  )}
                >
                  {item.live ? (
                    <LiveValue value={item.value} mono={item.mono} />
                  ) : (
                    <span
                      data-telemetry
                      className={cn(
                        'tabular-nums',
                        item.mono ? 'font-mono text-tele uppercase' : 'text-action',
                      )}
                    >
                      {item.value}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      {tracking ? (
        <Button
          variant="secondary"
          size="md"
          href={mission.trackingUrl as string}
          className="mt-7"
        >
          Open carrier tracking
        </Button>
      ) : null}

      {closing ? (
        <p className={cn('mt-7 max-w-[var(--measure)] border-t pt-5 text-body', RULE, INK_DIM)}>
          {mission.stage === 'FINAL_APPROACH'
            ? `Inside the package: one frame of ${mission.locationLabel}, captured from orbit and printed at ${facilityCity(mission) ?? 'the production facility'}. Take it out flat and lift the print by its edges. The file closes on hand-off.`
            : 'Hand-off confirmed. The file stays open for reference — the deliverable is yours.'}
        </p>
      ) : null}

      {live ? (
        <div className={cn('mt-6 flex items-center gap-2.5 border-t pt-4', RULE)}>
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)] animate-signal-pulse"
          />
          <span className={cn('text-label uppercase', INK_DIM)}>
            Telemetry live — refreshed every 15 seconds
          </span>
        </div>
      ) : null}
    </aside>
  );
}

/**
 * The readings that matter at the stage the mission is at. Kept to six or
 * fewer — anything else belongs in the specification band.
 */
function stageRows(mission: MissionDTO, now: Date): Reading[] {
  const o = mission.orbit;
  const windowRange = formatWindowRange(mission.windowOpensAt, mission.windowClosesAt);
  /* At SHIPPED and beyond the parcel HAS a number, so a null here is the
     redaction in `toMissionDTO` rather than a carrier that has not scanned:
     the number is a bearer token for the delivery address and is owner-only.
     `private` is the owner discriminator — it is the block that is stripped
     from every public and shared view. */
  const withheld = !mission.private;
  const trackingValue = (pending: string) =>
    mission.trackingNumber ?? (withheld ? 'Held with the owner' : pending);

  switch (mission.stage) {
    case 'MISSION_CONFIRMED':
      return [
        { label: 'Target', value: mission.locationLabel },
        {
          label: 'Coordinates',
          value: formatCoords(mission.lat, mission.lon, coordDp(mission)),
          mono: true,
        },
        { label: 'Sensor', value: o.sensor },
        { label: 'Resolution', value: `${o.gsdM} m per pixel` },
        { label: 'Queued', value: stamp(mission.createdAt), mono: true, tone: 'dim' },
      ];

    case 'SATELLITE_TASKED':
      return [
        { label: 'Sensor', value: o.sensor },
        { label: 'Inclination', value: o.inclination },
        { label: 'Altitude', value: `${o.altitudeKm} km` },
        { label: 'Resolution', value: `${o.gsdM} m per pixel` },
        ...(windowRange
          ? [{ label: 'Capture window', value: windowRange, mono: true, live: true, tone: 'accent' as const }]
          : []),
      ];

    case 'CAPTURE_WINDOW': {
      const next = nextPassAt(mission, now);
      return [
        { label: 'Capture window', value: windowRange ?? 'Scheduling', mono: Boolean(windowRange) },
        {
          label: 'Next pass',
          value: next ? stamp(next) : 'Window closing',
          mono: Boolean(next),
          live: true,
          tone: 'accent',
        },
        { label: 'Azimuth', value: `${o.azimuthDeg}°` },
        { label: 'Off-nadir', value: deg(o.offNadirDeg) },
        { label: 'Cloud forecast', value: `${o.cloudPct}%`, live: true },
        { label: 'Resolution', value: `${o.gsdM} m per pixel` },
      ];
    }

    case 'IMAGE_ACQUIRED':
      return [
        { label: 'Captured', value: stamp(mission.capturedAt), mono: true, live: true, tone: 'accent' },
        { label: 'Cloud at capture', value: `${o.cloudPct}%` },
        { label: 'Off-nadir', value: deg(o.offNadirDeg) },
        { label: 'Sensor', value: o.sensor },
        { label: 'Resolution', value: `${o.gsdM} m per pixel` },
      ];

    case 'PROCESSING':
      return [
        { label: 'Source frame', value: stamp(mission.capturedAt), mono: true, tone: 'dim' },
        { label: 'Format', value: `${mission.format.metric} / ${mission.format.imperial}` },
        { label: 'Mount', value: mission.format.frame === 'FRAMED' ? 'Framed' : 'Unframed' },
        { label: 'Print region', value: mission.region },
      ];

    case 'PRINT':
      return [
        { label: 'Facility', value: facilityCity(mission) ?? 'Assigned' },
        { label: 'Country', value: facilityCountry(mission), tone: 'accent' },
        { label: 'Format', value: `${mission.format.metric} / ${mission.format.imperial}` },
        { label: 'Mount', value: mission.format.frame === 'FRAMED' ? 'Framed' : 'Unframed' },
      ];

    case 'SHIPPED':
      return [
        { label: 'Carrier', value: mission.carrier ?? 'Assigned' },
        {
          label: 'Tracking',
          value: trackingValue('Pending scan'),
          mono: Boolean(mission.trackingNumber),
          live: true,
          tone: 'accent',
        },
        { label: 'Destination', value: mission.locationLabel },
        ...(mission.estimatedDeliveryAt
          ? [
              {
                label: 'Estimated',
                value: datestamp(mission.estimatedDeliveryAt),
                mono: true,
                tone: 'dim' as const,
              },
            ]
          : []),
      ];

    case 'FINAL_APPROACH':
      return [
        {
          label: 'Estimated delivery',
          value: mission.estimatedDeliveryAt ? stamp(mission.estimatedDeliveryAt) : 'Today',
          mono: Boolean(mission.estimatedDeliveryAt),
          live: true,
          tone: 'accent',
        },
        { label: 'Carrier', value: mission.carrier ?? 'In network' },
        {
          label: 'Tracking',
          value: trackingValue('Active'),
          mono: Boolean(mission.trackingNumber),
        },
        { label: 'Destination', value: mission.locationLabel },
      ];

    case 'DELIVERED':
      return [
        {
          label: 'Delivered',
          value: stamp(eventAt(mission, 'DELIVERED') ?? mission.estimatedDeliveryAt),
          mono: true,
          tone: 'dim',
        },
        { label: 'Carrier', value: mission.carrier ?? 'Closed' },
        { label: 'Format', value: `${mission.format.metric} / ${mission.format.imperial}` },
        { label: 'Captured', value: stamp(mission.capturedAt), mono: true, tone: 'dim' },
      ];

    default:
      return [];
  }
}
