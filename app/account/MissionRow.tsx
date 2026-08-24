import { clsx as cn } from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { CropMarks, Grid12 } from '@/components/fui';
import { Chip, type MissionChipState } from '@/components/mission';
import { missionPath } from '@/lib/codes';
import { formatPrice } from '@/lib/pricing';
import { formatTelemetryDate } from '@/lib/utils';
import { STAGE_LABEL, type MissionDTO } from '@/lib/types';

/** Delivered files rest; cancelled files raise a flag; everything else is live. */
export function chipStateFor(mission: MissionDTO): MissionChipState {
  if (mission.state === 'CANCELLED') return 'alert';
  if (mission.stage === 'DELIVERED') return 'done';
  return 'active';
}

export function chipLabelFor(mission: MissionDTO): string {
  return mission.state === 'CANCELLED' ? 'Cancelled' : STAGE_LABEL[mission.stage];
}

/**
 * The mission thumbnail. Before a frame is downlinked there is no photograph,
 * so the slot renders as a hatched, crop-marked plate on the void ground —
 * a placeholder in the dossier language, never an empty grey box.
 */
export function MissionThumb({
  mission,
  className,
  sizes = '110px',
}: {
  mission: MissionDTO;
  className?: string;
  sizes?: string;
}) {
  return (
    <div
      className={cn(
        'relative aspect-[4/5] w-full overflow-hidden rounded-[6px] bg-void',
        className,
      )}
    >
      {mission.previewUrl ? (
        <Image
          src={mission.previewUrl}
          alt={`Satellite frame for mission ${mission.code}, ${mission.locationLabel}`}
          fill
          unoptimized
          sizes={sizes}
          className="object-cover transition-transform duration-house ease-house group-hover:scale-[1.04]"
        />
      ) : (
        <div className="fui-hatch relative flex h-full w-full items-center justify-center">
          <CropMarks length={8} inset={2} />
          <span className="text-center text-label uppercase leading-[1.4] text-paper-dim">
            No
            <br />
            frame
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * One line of the account index.
 *
 * A row, not a card: the file is a list of records, and a row is a larger,
 * faster target on a phone than a tile. The whole line opens the receipt and
 * the whole line lights up on hover — including the frame, which comes
 * forward slightly. The hover is earned: the entire row is a link. Live
 * missions carry one extra link into Mission Control; delivered ones do not
 * need it.
 *
 * THE ROW AT FIVE WIDTHS. At 390 it is a small stack: frame and identity on
 * one line, status under them, then the four readings two-up. At 768 it
 * becomes two lines — frame, identity and status across the first, the
 * readings across the second — which is the shape that stops a nine-word
 * stage label wrapping inside a pill. From 1280 there is room for all six
 * parts on one line and it flattens to a true index row. Above 1440 nothing
 * changes: the row is already at its measure, and the extra width is
 * margin.
 */
export function MissionRow({ mission }: { mission: MissionDTO }) {
  const amount = mission.private
    ? formatPrice(mission.private.amountMinor, mission.private.currency)
    : null;
  const live = mission.stage !== 'DELIVERED' && mission.state !== 'CANCELLED';

  return (
    <li className="border-b border-[color:var(--rule)]">
      <div className="group relative -mx-3 rounded-[6px] px-3 transition-house hover:bg-[color:color-mix(in_srgb,var(--ink)_4%,transparent)]">
        <Link
          href={`/account/missions/${mission.code}`}
          className="absolute inset-0 z-10 rounded-[6px]"
          aria-label={`Open the receipt for mission ${mission.code}`}
        />

        <Grid12 className="items-center py-5 xl:py-6">
          {/* Frame */}
          <div className="col-span-3 md:col-span-2 xl:col-span-1">
            <MissionThumb mission={mission} />
          </div>

          {/* Identity and city-level location */}
          <div className="col-span-9 min-w-0 md:col-span-5 xl:col-span-3">
            <span
              data-telemetry
              className="font-mono text-[0.8125rem] uppercase tracking-[0.08em] text-[color:var(--ink)]"
            >
              {mission.code}
            </span>
            <p className="mt-2 max-w-[28ch] text-action text-[color:var(--ink)]">
              {mission.locationLabel}
            </p>
          </div>

          {/* Status. Full width on a phone so a long stage label never wraps
              inside a 160px pill. */}
          <div className="col-span-12 min-w-0 md:col-span-5 md:flex md:justify-end xl:col-span-3 xl:block">
            <Chip label={chipLabelFor(mission)} state={chipStateFor(mission)} />
          </div>

          {/* Ordered */}
          <div className="col-span-6 md:col-span-3 md:col-start-3 xl:col-span-2 xl:col-start-auto">
            <p className="text-label uppercase text-[color:var(--ink-dim)]">Ordered</p>
            <p
              data-telemetry
              className="mt-2 font-mono text-tele-s uppercase text-[color:var(--ink-dim)]"
            >
              {formatTelemetryDate(mission.createdAt)}
            </p>
          </div>

          {/* Format */}
          <div className="col-span-6 md:col-span-3 xl:col-span-1">
            <p className="text-label uppercase text-[color:var(--ink-dim)]">Format</p>
            <p className="mt-2 text-body text-[color:var(--ink-dim)]">
              {mission.format.designation}
            </p>
          </div>

          {/* Amount, and the one secondary target on the line */}
          <div className="col-span-12 flex min-w-0 flex-wrap items-baseline justify-between gap-x-6 gap-y-1 md:col-span-4 md:flex-col md:items-end md:justify-start xl:col-span-2">
            <p data-telemetry className="text-action tabular-nums text-[color:var(--ink)]">
              {amount ?? '—'}
            </p>
            {live ? (
              <Link
                href={missionPath(mission.code)}
                className="link-underline relative z-20 inline-flex min-h-11 items-center text-action text-[color:var(--ink-dim)] transition-house hover:text-[color:var(--ink)] md:mt-1"
              >
                Mission control
              </Link>
            ) : null}
          </div>
        </Grid12>
      </div>
    </li>
  );
}
