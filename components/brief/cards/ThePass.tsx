import { IconCapture, IconOrbit, IconPassWindow } from '@/components/fui/icons';
import { stageIndex } from '@/lib/types';
import { formatWindowRange, stamp } from '@/components/mission/telemetry';
import type { BriefCardProps } from './types';
import { Body, Lead, Note, Row, Rows } from './ui';

/**
 * CARD 02 · THE PASS
 *
 * The geometry of the crossing that takes the frame.
 *
 * EVERY VALUE comes off `mission.orbit`, which is the tasking order as the
 * operator accepted it: altitude, sensor, inclination, ground track, look
 * azimuth and off-nadir angle. Nothing on this card is computed and nothing
 * is rounded — the orbit block is printed as the record holds it.
 *
 * WHEN. The card states the pass instant only where the record actually has
 * one: `capturedAt` once a frame is down, otherwise the scheduled window
 * from `windowOpensAt` / `windowClosesAt`, otherwise a plain statement that
 * passes are not scheduled yet. There is deliberately NO predicted next-pass
 * time and no countdown here. The file's own <CurrentStagePanel /> derives a
 * next crossing against a live clock, which is right for a panel that
 * refreshes every fifteen seconds; a briefing card is read once and put down,
 * and a time on it reads as a promise.
 *
 * THE MARKS follow the specification block exactly: the track is an orbit,
 * the capture is an instant, the window is a window. The altitude, the
 * inclination and the two angles carry none — a degree is not a type, and a
 * mark on every row is the flatness the icon set exists to break.
 */
export function ThePass({ mission, className }: BriefCardProps) {
  const o = mission.orbit;
  const windowRange = formatWindowRange(mission.windowOpensAt, mission.windowClosesAt);
  const acquired = stageIndex(mission.stage) >= stageIndex('IMAGE_ACQUIRED');
  /* The track is still a forecast while the pass is ahead of the mission.
     Read off the record's own stage, never off a clock, so the card renders
     identically on the server and after hydration. */
  const passAhead = mission.state !== 'CANCELLED' && !acquired;

  return (
    <Body className={className}>
      <Lead
        label="Orbit altitude"
        mono
        value={`${o.altitudeKm} km`}
        sub={
          <span data-telemetry className="file">
            {o.sensor}
          </span>
        }
      />

      <Rows className="mt-8">
        <Row label="Inclination" mono value={o.inclination} />
        <Row icon={<IconOrbit live={passAhead} />} label="Ground track" mono value={o.track} />
        <Row label="Look azimuth" mono value={`${o.azimuthDeg}°`} />
        <Row label="Off-nadir" mono value={`${o.offNadirDeg}°`} />

        {mission.capturedAt ? (
          <Row icon={<IconCapture />} label="Captured" mono value={stamp(mission.capturedAt)} />
        ) : windowRange ? (
          <Row
            icon={<IconPassWindow live={mission.stage === 'CAPTURE_WINDOW'} />}
            label="Capture window"
            mono
            value={windowRange}
          />
        ) : (
          <Row
            icon={<IconPassWindow />}
            label="Capture window"
            tone="dim"
            value="Not scheduled yet"
          />
        )}
      </Rows>

      <Note className="mt-7">
        Off-nadir is how far the look sits off the vertical. The satellite
        photographs down onto the roof, not obliquely into a window.
        {mission.capturedAt
          ? ' These are the angles the frame was taken at.'
          : ' These are the angles the collection was ordered at.'}
      </Note>
    </Body>
  );
}
