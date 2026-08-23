import { clsx as cn } from 'clsx';
import type { ComponentType, ReactNode } from 'react';
import {
  IconCapture,
  IconDocket,
  IconFacility,
  IconGrade,
  IconHandoff,
  IconParcel,
  IconPassWindow,
  IconPin,
  IconSatellite,
  type LiveIconProps,
} from '@/components/fui/icons';
import type { MissionEventDTO, MissionStage } from '@/lib/types';
import { formatTelemetryTimestamp } from '@/lib/utils';
import { StageClock, elapsedLabel } from './StageClock';
import type { TimelineRow } from './telemetry';
import { ACCENT, Chip, FILE, FILE_LABEL, FILE_S, INK, INK_DIM, INK_FAINT, RULE } from './ui';

/**
 * THE SEQUENCE OF EVENTS — nine stages, set as one document.
 *
 * ==================================================================
 * WHAT WAS WRONG WITH IT
 * ==================================================================
 * Nine stages used to take about 2,400px at 390 and 1,500px at 1440: every
 * row was a sans heading, a sans sentence and a mono timestamp, each on its
 * own line at reading leading. At that rhythm the sequence is not a record —
 * it is nine cards in a trench coat, and no reader ever sees more than two
 * of them at once, which is the one thing a timeline exists to give them.
 *
 * It is now one block. Three things did it, in order of how much they helped:
 *
 *   1. THE ROWS ARE SET AS ROWS. Padding is 10 → 12px, not 24 → 28, and the
 *      three parts of a row share a line from 1280 and share two lines from
 *      768. Nine stages close in roughly 620px at 390 and 420px at 1440.
 *   2. THE WHOLE COLUMN IS DETAIL TYPE. `.file` — the mission file's own
 *      11 → 13px ramp — carries the stage name, the sentence, the condition
 *      and the timestamp alike. app/globals.css names "sequence rows" as one
 *      of the three things that ramp exists for; this is that.
 *   3. THE HIERARCHY IS MARKED, NOT SIZED. The face ships one weight, so the
 *      stage name is separated from its sentence the way a printed form
 *      separates them — by case, tracking and ink — never by a second size.
 *
 * ==================================================================
 * THE FACE
 * ==================================================================
 * TYPESTAR OCR, which this file already ships and already sets its telemetry
 * in (lib/fonts.ts, and the detail ramp in app/globals.css). It is the
 * typewriter-lineage face we own: monospaced, single weight, 545/1000
 * x-height, an advance of 0.664em — it sets like something struck onto the
 * page rather than rendered onto it, which is the character the owner asked
 * for.
 *
 * IT IS DELIBERATELY NOT AMERICAN TYPEWRITER. That face is Apple's, shipped
 * with macOS and iOS, and it is not ours to serve — putting the file on our
 * origin is font piracy and naming it in a stack gets it on Apple hardware
 * and a fallback everywhere else, which is a timeline that reads as two
 * different documents depending on who opens it. We already own the right
 * face; see WAVE.md §1.2, which drew this exact line for NBInternationalPro.
 *
 * ==================================================================
 * THE MARKS
 * ==================================================================
 * One per stage, from components/fui/icons — the set that already names the
 * KIND of value on a row. Three of the nine did not exist and were added to
 * that set rather than started as a new one: <IconDocket> (the order, filed),
 * <IconGrade> (the frame being graded) and <IconHandoff> (that same docket,
 * signed off — the first and last marks of the sequence are a pair, because
 * the first and last stages are). Every mark is `aria-hidden`: the stage's name is written
 * beside it on every row, so the drawing is a way to find a row, never the
 * only way to read one.
 *
 * ==================================================================
 * WHAT MOVES
 * ==================================================================
 * One row. See <StageClock /> for the argument in full: the eight rows that
 * are a record are static marks, and the row the mission is actually sitting
 * on carries a clock at the real elapsed time in that stage. Nothing moves on
 * a closed file (DELIVERED) or a cancelled one, because on those nothing is
 * moving. `prefers-reduced-motion` parks the hands at the true reading.
 *
 * ==================================================================
 * THE COLUMN
 * ==================================================================
 *   390   three parts stacked — name, reading, sentence — against a rail.
 *   768   name and reading share the first line, the sentence takes the
 *         second at a readable measure. Splitting a 704px row three ways
 *         gives the sentence 270px, which is not a measure.
 *   1280  one line of three parts. There is finally width for it.
 *
 * On paper: history and specification belong to the light half of the file.
 */

/* ------------------------------------------------------------------ */
/* The marks                                                          */
/* ------------------------------------------------------------------ */

/**
 * Stage → mark. Closed by the nine stages and by nothing else.
 *
 * The near neighbours are kept apart on purpose, the way the icon set keeps
 * <IconCrosshair> and <IconPin> apart: PRINT is the FACILITY the job was
 * released to, SHIPPED is the parcel in transit, FINAL_APPROACH is the
 * address it is approaching, DELIVERED is the sheet signed for it.
 * Four consecutive stages, four different facts, four different drawings.
 */
const STAGE_MARK: Record<MissionStage, ComponentType<LiveIconProps>> = {
  MISSION_CONFIRMED: IconDocket,
  SATELLITE_TASKED: IconSatellite,
  CAPTURE_WINDOW: IconPassWindow,
  IMAGE_ACQUIRED: IconCapture,
  PROCESSING: IconGrade,
  PRINT: IconFacility,
  SHIPPED: IconParcel,
  FINAL_APPROACH: IconPin,
  DELIVERED: IconHandoff,
};

/**
 * The two marks in the set that may animate, and the only stage each of them
 * is allowed to animate ON. <IconPassWindow> pulses while a capture window is
 * genuinely open; nothing else in the set has a moving value behind it here.
 */
const MARK_MAY_ANIMATE: Partial<Record<MissionStage, true>> = {
  CAPTURE_WINDOW: true,
};

/* ------------------------------------------------------------------ */
/* The column                                                         */
/* ------------------------------------------------------------------ */

export function MissionTimeline({
  rows,
  now,
  running = false,
  detail,
  className,
}: {
  rows: TimelineRow[];
  /**
   * The file's clock — the server's on first paint, the live one after
   * mount. Read only to date the stage the mission is sitting on; passing it
   * rather than reading it here is what keeps hydration byte-identical.
   */
  now?: Date;
  /**
   * The mission is still running: not delivered, not cancelled. The clock on
   * the active row appears only when this is true, because a closed file has
   * no elapsed time to report.
   */
  running?: boolean;
  /**
   * The richest block on the page, filed into the active stage's row. Passed
   * only below 1280 — from there the file stands it beside the column
   * instead, so it stays in view as the reader scrolls the nine stages.
   */
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <ol className={cn('border-t', RULE, className)}>
      {rows.map((row) => (
        <TimelineEntry key={row.stage} row={row} now={now} running={running} detail={detail} />
      ))}
    </ol>
  );
}

function TimelineEntry({
  row,
  now,
  running,
  detail,
}: {
  row: TimelineRow;
  now?: Date;
  running: boolean;
  detail?: ReactNode;
}) {
  const live = row.status === 'active';
  const pending = row.status === 'pending';
  const alert = row.status === 'alert';
  const Mark = STAGE_MARK[row.stage];

  /* The clock is earned twice over: the mission has to still be running, and
     the stage has to carry the instant it was actually reached. A stage with
     no recorded event has no elapsed time, and this file never prints a
     reading it cannot derive. */
  const elapsedMs =
    live && running && row.at && now ? now.getTime() - new Date(row.at).getTime() : null;

  const markTone = live || alert ? ACCENT : pending ? INK_FAINT : INK_DIM;

  return (
    <li className={cn('relative border-b', RULE, live && 'bg-[color:var(--ground-raised)]')}>
      {/* THE RAIL. One hairline down the mark column, from the list's top
          rule to its bottom one, so nine rows read as one sequence rather
          than as nine ruled boxes. Each mark sits on the row's own ground and
          punches its own hole in the rail — which is why the ground is named
          here rather than left transparent. */}
      <span aria-hidden className="absolute top-0 bottom-0 left-2 w-px bg-[color:var(--rule)]" />

      <div className="relative flex gap-x-3 py-2.5 xl:py-3">
        <span
          className={cn(
            'mt-px flex h-4 w-4 shrink-0 items-center justify-center',
            live ? 'bg-[color:var(--ground-raised)]' : 'bg-[color:var(--ground)]',
            markTone,
          )}
        >
          <Mark size={14} live={live && running && Boolean(MARK_MAY_ANIMATE[row.stage])} />
        </span>

        <div
          className={cn(
            'grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-1',
            'md:grid-cols-[minmax(0,1fr)_auto]',
            'xl:grid-cols-[minmax(0,13.5rem)_minmax(0,1fr)_auto] xl:items-baseline xl:gap-y-0',
          )}
        >
          {/* The stage's name. Uppercase, tracked, full ink — the label
              treatment, because in a struck record the name of a field is
              marked and its value is left plain. */}
          <h3
            className={cn(
              FILE,
              'uppercase tracking-[0.09em]',
              live || alert ? ACCENT : pending ? INK_DIM : INK,
            )}
          >
            {row.label}
          </h3>

          {/* The reading. Beside the name from 768, its own part of the line
              from 1280. */}
          <div
            className={cn(
              'flex flex-col items-start gap-1',
              'md:items-end md:text-right',
              'xl:col-start-3 xl:row-start-1',
            )}
          >
            {row.at ? (
              <span data-telemetry className={cn(FILE, live ? ACCENT : INK_DIM)}>
                {formatTelemetryTimestamp(row.at)}
              </span>
            ) : alert ? (
              <Chip label="Held" state="alert" />
            ) : live ? (
              <Chip label="Active" state="active" />
            ) : (
              <span aria-hidden className={cn(FILE, INK_FAINT)}>
                — — . — —
              </span>
            )}

            {/* THE ONE MOVING THING ON THE PAGE. The reading is written out
                beside the hands, so the clock is a second rendering of it and
                never the only one. */}
            {elapsedMs !== null ? (
              <span className={cn(FILE, ACCENT, 'inline-flex items-center gap-1.5')}>
                <StageClock elapsedMs={elapsedMs} size={14} />
                <span data-telemetry>IN STAGE {elapsedLabel(elapsedMs)}</span>
              </span>
            ) : null}
          </div>

          {/* What happened, or what it is waiting on. */}
          <div
            className={cn(
              'md:col-span-2 md:row-start-2',
              'xl:col-span-1 xl:col-start-2 xl:row-start-1',
            )}
          >
            <p className={cn(FILE, 'max-w-[var(--measure-wide)]', pending ? INK_FAINT : INK_DIM)}>
              {pending ? row.condition : row.description}
            </p>
            {row.notes.map((note) => (
              <TimelineNote key={note.id} note={note} />
            ))}
          </div>

          {/* Below 1280 the current stage carries the richest detail on the
              page, filed in place at the description's own indent. */}
          {/* The air is on the CHILD, not on this wrapper. Above 1280 the
              file hands the panel in already wrapped in `xl:hidden`, and a
              padding on the wrapper would leave 16px of nothing in the middle
              of the live row at exactly the width where the panel is not
              there. */}
          {live && detail ? (
            <div className="md:col-span-2 md:row-start-3 xl:col-span-3 xl:col-start-1 [&>*]:pt-4">
              {detail}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** A NOTE event — a re-tasking, a hold, an operator entry — filed in place. */
function TimelineNote({ note }: { note: MissionEventDTO }) {
  return (
    <div className="mt-2.5 border-l-2 border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] pl-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className={cn(FILE_S, FILE_LABEL, ACCENT)}>Log entry</span>
        <span data-telemetry className={cn(FILE_S, INK_FAINT)}>
          {formatTelemetryTimestamp(note.at)}
        </span>
      </div>
      <p className={cn(FILE, 'mt-1 max-w-[var(--measure-wide)] uppercase tracking-[0.08em]', INK)}>
        {note.label}
      </p>
      {note.detail ? (
        <p className={cn(FILE, 'mt-1 max-w-[var(--measure-wide)]', INK_DIM)}>{note.detail}</p>
      ) : null}
    </div>
  );
}
