import { IconCalendar, IconPassWindow } from '@/components/fui/icons';
import { datestamp, eventAt, formatWindowRange, stamp } from '@/components/mission/telemetry';
import { guaranteeTerm } from '@/lib/guarantees';
import {
  MISSION_STAGES,
  STAGE_DESCRIPTION,
  STAGE_LABEL,
  stageIndex,
  type MissionDTO,
  type MissionStage,
} from '@/lib/types';
import type { BriefCardProps } from './types';
import { Body, Lead, Note, Row, Rows } from './ui';

/**
 * CARD 05 · NEXT STEPS
 *
 * Where the mission is, and every stage still ahead of it.
 *
 * EVERY VALUE:
 *   position     `stageIndex(mission.stage)` against `MISSION_STAGES`
 *   stage names  `STAGE_LABEL` — never a label string written here
 *   meanings     `STAGE_DESCRIPTION` — never a paraphrase of one
 *   reached at   the mission's own event for the stage it is sitting on
 *   times ahead  ONLY where the record holds one, see `stageTime()`
 *
 * THE DATE RULE. A stage ahead of the mission carries a time only when the
 * record genuinely has one for it: the capture window from `windowOpensAt` /
 * `windowClosesAt`, and the delivery estimate from `estimatedDeliveryAt`.
 * Every other stage carries no time, because the file does not hold one and
 * a plausible date is worse than no date — the reader would plan around it.
 * The foot of the card says that outright rather than leaving the gaps to be
 * read as an oversight.
 *
 * TWO CLOSED STATES. A delivered mission has no stages ahead, so the card
 * stops being a schedule and becomes the one thing still open: the window in
 * which a damaged or misprinted print can be reported, read from
 * `lib/guarantees.ts`. A cancelled mission says so and schedules nothing.
 */

/** A time the record actually holds for a stage still ahead. Null otherwise. */
function stageTime(mission: MissionDTO, stage: MissionStage): { label: string; value: string } | null {
  if (stage === 'CAPTURE_WINDOW') {
    const range = formatWindowRange(mission.windowOpensAt, mission.windowClosesAt);
    return range ? { label: 'Scheduled', value: range } : null;
  }
  /* The estimate is a DELIVERY estimate. It belongs to the delivered stage
     and to no other — hanging it on SHIPPED or FINAL_APPROACH would state a
     date for an event the carrier has not given us one for. */
  if (stage === 'DELIVERED' && mission.estimatedDeliveryAt) {
    return { label: 'Estimated', value: datestamp(mission.estimatedDeliveryAt) };
  }
  return null;
}

export function NextSteps({ mission, className }: BriefCardProps) {
  const cancelled = mission.state === 'CANCELLED';
  const index = stageIndex(mission.stage);
  const remaining = cancelled ? [] : MISSION_STAGES.slice(index + 1);
  const reachedAt = eventAt(mission, mission.stage);

  /* Named, not bare. The deck's own footer carries a `05 / 06` position in
     the SET of cards; an unlabelled `08 / 09` at the top of this one would
     read as a second, contradictory version of it. */
  const position = `Stage ${String(index + 1).padStart(2, '0')} / ${String(MISSION_STAGES.length).padStart(2, '0')}`;

  return (
    <Body className={className}>
      <Lead
        label={cancelled ? 'Stopped at' : 'Now'}
        aside={position}
        value={STAGE_LABEL[mission.stage]}
        sub={
          <span className="block max-w-[var(--measure)] text-note">
            {STAGE_DESCRIPTION[mission.stage]}
            {reachedAt ? ` Reached ${stamp(reachedAt)}.` : ''}
          </span>
        }
      />

      {cancelled ? (
        <Note className="mt-7">
          The mission was cancelled and nothing further is scheduled. The file stays open for
          reference, with everything it recorded before it closed.
        </Note>
      ) : remaining.length > 0 ? (
        <>
          <ol className="mt-8 flex flex-col gap-y-5 border-t border-[color:var(--rule)] pt-4">
            {remaining.map((stage) => {
              const time = stageTime(mission, stage);
              return (
                <li key={stage} className="flex flex-col gap-y-1">
                  <p className="file-s file-label-strong">{STAGE_LABEL[stage]}</p>
                  <p className="max-w-[var(--measure)] text-note text-[color:var(--ink-dim)]">
                    {STAGE_DESCRIPTION[stage]}
                  </p>
                  {time ? (
                    <p
                      data-telemetry
                      className="file mt-1 flex items-center gap-2 text-[color:var(--ink)]"
                    >
                      {stage === 'CAPTURE_WINDOW' ? (
                        <IconPassWindow live={mission.stage === 'CAPTURE_WINDOW'} />
                      ) : (
                        <IconCalendar />
                      )}
                      {time.label} {time.value}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>

          <Note className="mt-7">
            A stage with no time against it has no date on the record yet. The file adds one the
            moment it has it, and never before.
          </Note>
        </>
      ) : (
        <>
          <Rows className="mt-8">
            <Row
              icon={<IconCalendar />}
              label="Still open"
              value={guaranteeTerm('replace').short}
            />
          </Rows>
          <Note className="mt-7">
            The file is closed and nothing further is scheduled. The deliverable is yours.
          </Note>
        </>
      )}
    </Body>
  );
}
