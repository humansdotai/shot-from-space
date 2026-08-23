/* Imported from the module rather than from the fui barrel: this card is
   a pure, server-renderable block and the barrel reaches client-only
   modules. Same reason <ConditionsPanel /> does it. */
import { StatusToken, type TokenTone } from '@/components/fui/StatusChip';
import {
  IconCloud,
  IconCompass,
  IconEye,
  IconSun,
  IconThermometer,
  IconWind,
} from '@/components/fui/icons';
import { missionConditions } from '@/lib/missions/conditions';
import { formatTelemetryTimestamp } from '@/lib/utils';
import type { BriefCardProps } from './types';
import { Body, Lead, Note, Row, Rows } from './ui';

/**
 * The card's own subject line, for the deck's `BriefCard.title`.
 *
 * It is a fact about the record and not a style choice: `measured` is true
 * only when the mission holds a real capture timestamp, so a card headed
 * "at capture" is never sitting over a forecast.
 */
export function conditionsCardTitle(mission: BriefCardProps['mission']): string {
  return missionConditions(mission).measured ? 'Conditions at capture' : 'Conditions forecast';
}

/**
 * CARD 03 · CONDITIONS
 *
 * The sky over the target at the instant the block is stated for.
 *
 * EVERY VALUE comes out of `missionConditions()` and is printed exactly as
 * that module returns it — same figures, same units, same number of decimal
 * places as `components/mission/ConditionsPanel`. Nothing here re-derives,
 * re-rounds or decorates a reading, because the panel and this card are read
 * within a minute of each other and a card that rounded differently would be
 * a contradiction the reader can see.
 *
 * WHAT IS ACTUALLY TRUE HERE, from `lib/missions/conditions.ts`:
 *   · cloud cover and sky state — read off the mission record;
 *   · sun elevation, azimuth and the local solar clock — computed with the
 *     NOAA solar position algorithm from the capture time and the target's
 *     coordinates;
 *   · visibility, ground wind and air temperature — modelled from latitude,
 *     season and local solar time, pending a weather API reading.
 * The note at the foot says so. A conditions card that does not state which
 * of its numbers were measured is decoration, and this one is the reason the
 * three are separated rather than blended.
 *
 * THE BASIS is never guessed. `CAPTURE` means the frame exists and these are
 * the conditions it was taken under; `PLANNED_PASS` and `TASKING` mean the
 * block is stated for a scheduled instant, and the head says which.
 */
export function Conditions({ mission, className }: BriefCardProps) {
  const c = missionConditions(mission);
  const s = c.surface;

  // What the instant IS. The provenance note below says which readings were
  // measured; this line must not overclaim on its behalf.
  const basis =
    c.basis === 'CAPTURE' ? 'At capture' : c.basis === 'PLANNED_PASS' ? 'Scheduled pass' : 'At tasking';

  /* Overcast is the one sky state that threatens the collection, and it is
     the only one that takes the accent — the same rule the file's conditions
     panel applies. */
  const skyTone: TokenTone = c.sky === 'OVERCAST' ? 'alert' : 'neutral';

  return (
    <Body className={className}>
      {/* The instant the whole block is stated for, before anything is read
          off it. A conditions block with no stated instant is decoration. */}
      <p data-telemetry className="file-xs uppercase">
        {basis} · {formatTelemetryTimestamp(c.at)}
      </p>

      <Lead
        className="mt-6"
        icon={<IconCloud size={18} />}
        label="Cloud cover"
        mono
        value={`${c.cloudPct} %`}
        token={<StatusToken label={c.sky} tone={skyTone} />}
      />

      <Rows className="mt-8">
        <Row
          icon={<IconSun />}
          label="Sun elevation"
          mono={c.sun.daylight}
          tone={c.sun.daylight ? undefined : 'accent'}
          value={c.sun.daylight ? `${c.sun.elevationDeg.toFixed(1)}°` : 'Below horizon'}
        />
        <Row
          icon={<IconCompass />}
          label="Sun azimuth"
          mono
          value={`${c.sun.azimuthDeg.toFixed(0)}° ${c.sun.compass} · solar time ${c.sun.solarTime}`}
        />
        <Row icon={<IconEye />} label="Visibility" mono value={`${s.visibilityKm.toFixed(1)} km`} />
        <Row
          icon={<IconWind />}
          label="Ground wind"
          mono
          value={`${s.windSpeedMs.toFixed(1)} m/s from ${s.windBearingDeg}° ${s.windCompass}`}
        />
        <Row
          icon={<IconThermometer />}
          label="Air temperature"
          mono
          value={`${s.temperatureC.toFixed(1)} °C`}
        />
      </Rows>

      <Note className="mt-7">{c.skyNote}</Note>
      <Note className="mt-1.5">
        Cloud is read from the mission record. Solar geometry is computed for the capture time
        and the target coordinates. The surface fields are modelled from latitude, season and
        local solar time, pending a weather API reading.
      </Note>
    </Body>
  );
}
