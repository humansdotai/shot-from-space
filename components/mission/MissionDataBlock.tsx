import { clsx as cn } from 'clsx';
import type { ReactNode } from 'react';
import { Grid12, StatusToken, type TokenTone } from '@/components/fui';
import {
  IconAntenna,
  IconArea,
  IconCalendar,
  IconCapture,
  IconClock,
  IconCrosshair,
  IconFacility,
  IconFrame,
  IconLink,
  IconMail,
  IconOrbit,
  IconParcel,
  IconPassWindow,
  IconPin,
  IconReceipt,
  IconResolution,
  IconSatellite,
  IconSheet,
} from '@/components/fui/icons';
import { missionShortLink } from '@/lib/codes';
import { formatPrice } from '@/lib/pricing';
import { STAGE_LABEL, stageIndex, type MissionDTO } from '@/lib/types';
import { formatCoordsHemisphere } from '@/lib/utils';
import { Redacted } from './Redacted';
import { operationsMetadata } from './redaction';
import {
  coordDp,
  datestamp,
  facilityCity,
  facilityCountry,
  formatWindowRange,
  stamp,
} from './telemetry';

/**
 * THE SPECIFICATION — an instrument block, not a list of nine rows.
 *
 * ==================================================================
 * WHAT WAS WRONG WITH IT
 * ==================================================================
 * Every value on this block used to be the same row: mono label left,
 * value right, a dotted lead between, a hairline under, everything at
 * one size and one weight. Thirty-odd of them. Nothing was more
 * important than anything else, so finding one fact meant reading all
 * of them — and that flatness, not the palette and not the faces, is
 * what made the page read as generated.
 *
 * Four things fix it and all four have to be present; any one of them
 * alone leaves the block looking exactly as it did.
 *
 * ------------------------------------------------------------------
 * 1 · HIERARCHY — three tiers, not one
 * ------------------------------------------------------------------
 * THE LEAD. Three values open the block at heading size, side by side
 * on their own rule: WHAT was shot, WHERE the mission has got to, and
 * WHEN the frame could be taken. Those are the three questions someone
 * opening a mission file is actually asking, and they are now readable
 * from across the room.
 *
 * THE KEY ROW. Each cluster below promotes the one value that decides
 * what that cluster is about — the format, the ground resolution, the
 * tracking number, the amount paid — to roughly twice the size of its
 * neighbours. Four of them, in six clusters: a cluster whose values are
 * genuinely peers (the address, the file's own references) gets none,
 * because inventing a headline for it would put the uniformity straight
 * back.
 *
 * THE ROW. Everything else steps back to the detail ramp and holds the
 * spine. Not every row is a headline.
 *
 * ------------------------------------------------------------------
 * 2 · GROUPING — clusters with real air between them
 * ------------------------------------------------------------------
 * Six clusters, each with a named head and a rule under it, separated
 * by 48–56px of nothing. Two rows merged into their neighbours on the
 * way: the metric and imperial sheet sizes are now the format's own
 * sub-reading rather than two more rows, and the capture window moved
 * up into the lead instead of sitting anonymously in `File`.
 *
 * ------------------------------------------------------------------
 * 3 · TYPE MARKS — on rows that have a type, and only those
 * ------------------------------------------------------------------
 * `components/fui/icons`. A coordinate, an instant, an orbit, a
 * resolution, a facility, a format and a parcel each get their mark, so
 * the eye can jump to a KIND of value without reading the label. The
 * marks are `aria-hidden`; the label is always written out, so nothing
 * is carried by the drawing alone.
 *
 * Rows with no type carry no mark and keep the gutter empty instead —
 * a handling code, a tasking reference, a callsign, a carrier name and
 * an inclination in degrees are strings and numbers, not types. Marking
 * them anyway would be the same uniformity in a new costume.
 *
 * TWO MARKS MAY MOVE, and only while the value under them does:
 *   · the capture window pulses while the mission is sitting inside an
 *     open window (stage CAPTURE_WINDOW);
 *   · the ground track turns while the pass is still ahead of the
 *     mission (before IMAGE_ACQUIRED).
 * Both gates are read off the mission record, never off a clock, so
 * they render identically on the server and the client and a moving
 * mark always means a moving value. On a delivered file — 32BF, say —
 * nothing on this block animates at all. Off entirely under
 * `prefers-reduced-motion`; see `components/fui/icons/Icon.tsx`.
 *
 * ------------------------------------------------------------------
 * 4 · STATUS AS A TOKEN
 * ------------------------------------------------------------------
 * The stage is a <StatusToken />, not a sentence and not another row.
 * The token is the shared primitive — the ground-following, readout-
 * scale sibling of <StatusChip /> — which is the right one here twice
 * over: this block sits on paper, where the chip's `signal` reaches only
 * 2.8:1, and a stage is a value inside a readout rather than a badge
 * announcing the page. It is sized up once, and only here, because in
 * the lead it stands level with a heading and a timestamp.
 *
 * ==================================================================
 * WHAT DID NOT CHANGE
 * ==================================================================
 * Every value is still read straight off the DTO or derived in
 * `./telemetry.ts` and `./redaction.ts`; nothing here computes, rounds
 * or invents a number. Monospace is still spent only on coordinates,
 * timestamps, mission codes, tracking numbers and figures — a carrier,
 * a format and a facility are words and are set as words. The four
 * <Redacted> bars are on exactly the four house-routing fields they
 * were on before: a handling code, a tasking desk reference, a downlink
 * station and an operator callsign. Nothing the owner of the file needs
 * is ever behind a bar.
 *
 * ==================================================================
 * AT 390
 * ==================================================================
 * A label column, a 16px mark and a value on one line do not fit in a
 * 326px content column without either truncating a coordinate or
 * squeezing the label to two words a line. So they do not share a line:
 * BELOW 768 EVERY ROW STACKS — mark and label on the first line, value
 * on the second, both flush left, the value with the full column to
 * itself. From 768 up the row becomes a real pair and the values line
 * up on a spine.
 *
 * This is the same rule `META_GRID` states for the file's meta rows,
 * for the same reason, and it is why the block needs no truncation, no
 * horizontal scroller and no hidden-at-mobile row anywhere.
 */

/* ------------------------------------------------------------------ */
/* Ground-following ink                                                */
/* ------------------------------------------------------------------ */

const INK = 'text-[color:var(--ink)]';
const INK_DIM = 'text-[color:var(--ink-dim)]';
const ACCENT = 'text-[color:var(--accent)]';
const RULE = 'border-[color:var(--rule)]';

/**
 * The stage as a token tone. <StatusToken /> is the readout-scale,
 * ground-following sibling of <StatusChip /> and it is the right one
 * here twice over: this block is on paper, where the chip's `signal`
 * reaches only 2.8:1, and a stage sits INSIDE a readout rather than
 * announcing the page.
 *
 *   live     the mission is moving and this will change
 *   alert    cancelled — it wants a decision
 *   neutral  delivered — the file is closed and there is no news
 */
function stageTone(mission: MissionDTO): TokenTone {
  if (mission.state === 'CANCELLED') return 'alert';
  if (mission.stage === 'DELIVERED') return 'neutral';
  return 'live';
}

export function MissionDataBlock({
  mission,
  variant = 'owner',
  className,
}: {
  mission: MissionDTO;
  variant?: 'owner' | 'shared';
  className?: string;
}) {
  const priv = variant === 'owner' ? mission.private : undefined;
  const ops = operationsMetadata(mission.code);
  const windowRange = formatWindowRange(mission.windowOpensAt, mission.windowClosesAt);

  /* The two liveness gates. Both are read off the record's own stage,
     so the block is deterministic and hydrates identically. */
  const cancelled = mission.state === 'CANCELLED';
  const acquired = stageIndex(mission.stage) >= stageIndex('IMAGE_ACQUIRED');
  /** The window is open right now, by the file's own account. */
  const windowOpen = !cancelled && mission.stage === 'CAPTURE_WINDOW';
  /** The pass has not happened yet, so the track is a forecast. */
  const passAhead = !cancelled && !acquired;

  const tone = stageTone(mission);

  /* Three clusters across from 1280 and no further. A cluster is a
     label column and a value column; at four across the label column
     stops fitting `PRINT REGION` on one line, so the extra width at
     1920 goes to the gaps and the type rather than to a fourth. */
  const cell = 'col-span-12 md:col-span-6 xl:col-span-4';

  return (
    <div className={cn('flex flex-col', className)}>
      {/* ---------------------------------------------------------- */}
      {/* THE LEAD — target, stage, capture window                    */}
      {/* ---------------------------------------------------------- */}
      {/* Three across only from 1280. At 768 the column is 704px and three
          headline values in 215px each is not a lead, it is three cramped
          columns: the target takes the full width on its own line and the
          stage and the window pair off under it. */}
      <div
        className={cn(
          'grid grid-cols-1 gap-y-9 border-t pt-6 md:grid-cols-2 md:gap-x-[var(--grid-gap-x)] md:gap-y-8 xl:grid-cols-3 xl:gap-x-0 xl:gap-y-0 xl:pt-8',
          RULE,
        )}
      >
        <Lead
          icon={<IconCrosshair size={18} />}
          label="Target"
          className="md:col-span-2 xl:col-span-1 xl:pr-10"
          value={<span className={cn('text-heading tracking-[0.01em]', INK)}>{mission.locationLabel}</span>}
          sub={
            <span data-telemetry className={cn('file', INK)}>
              {formatCoordsHemisphere(mission.lat, mission.lon, coordDp(mission))}
            </span>
          }
        />

        <Lead
          label="Stage"
          className={cn('xl:border-l xl:pl-10', RULE)}
          value={
            <StatusToken
              label={cancelled ? 'Mission cancelled' : STAGE_LABEL[mission.stage]}
              tone={tone}
              /* The one token on the file allowed off the 10px detail
                 ramp: it is a LEAD value, level with a heading and a
                 timestamp, and at `.file-s` beside them it would read as
                 a footnote rather than as the file's state. */
              className="px-3 py-2 text-[0.75rem] xl2:text-[0.8125rem]"
            />
          }
        />

        <Lead
          icon={<IconPassWindow size={18} live={windowOpen} />}
          label="Capture window"
          className={cn('md:border-l md:pl-6 xl:pl-10', RULE)}
          value={
            windowRange ? (
              <span
                data-telemetry
                className={cn(
                  'file block break-words text-[1.0625rem] xl:text-[1.1875rem] xl2:text-[1.3125rem]',
                  INK,
                )}
              >
                {windowRange}
              </span>
            ) : (
              <span className={cn('text-heading', INK_DIM)}>Scheduling</span>
            )
          }
          sub={
            mission.capturedAt ? (
              <span data-telemetry className={cn('file', INK_DIM)}>
                Captured {stamp(mission.capturedAt)}
              </span>
            ) : null
          }
        />
      </div>

      {/* ---------------------------------------------------------- */}
      {/* THE CLUSTERS — three stacks, not six tiles                  */}
      {/* ---------------------------------------------------------- */}
      {/* Laid out as three COLUMNS rather than as six cells flowing
          through a grid. Auto-flow would put the ten-row pass telemetry
          cluster beside two short ones and then start the next cluster
          below all three, which opens a half-page of dead paper in the
          middle of the record. Stacking by hand also groups by subject:
          the object and its journey, then the pass, then the record and
          what was paid for it. */}
      <Grid12 className="mt-12 gap-y-12 xl:mt-14 xl:gap-y-14">
        <Stack className={cell}>
          {priv ? (
            <Cluster title="Delivery address">
              {/* One mark on the first line of the address. Line 2 and the
                  postal line are continuations of the same place, not
                  separate types, and marking each of them would say there
                  are three addresses here. */}
              <SpecRow icon={<IconPin />} label="Street" value={priv.address.line1} />
              {priv.address.line2 ? <SpecRow label="Line 2" value={priv.address.line2} /> : null}
              <SpecRow label="Postal" value={`${priv.address.postalCode} ${priv.address.city}`} />
            </Cluster>
          ) : null}

          <Cluster title="Deliverable">
            <KeyRow
              icon={<IconSheet size={18} />}
              label="Format"
              value={mission.format.designation}
              sub={`${mission.format.metric} · ${mission.format.imperial}`}
            />
            <SpecRow
              icon={<IconFrame />}
              label="Mount"
              value={mission.format.frame === 'FRAMED' ? 'Framed' : 'Unframed'}
            />
            <SpecRow label="Print region" value={mission.region} />
            <SpecRow
              icon={<IconFacility />}
              label="Facility"
              value={facilityCity(mission) ?? 'Pending release'}
            />
            <SpecRow label="Produced in" tone="dim" value={facilityCountry(mission)} />
            {priv ? (
              <SpecRow icon={<IconArea />} label="Capture area" value={`${priv.areaKm} km square`} />
            ) : null}
          </Cluster>

          <Cluster title="Fulfilment">
            {/* Two different nulls. On the owner's file a missing number
                means the carrier has not scanned the parcel yet. On a
                public or shared copy the number is withheld on purpose —
                it is a bearer token for the delivery address (see
                `toMissionDTO`) — so saying "Not issued" there would be
                false. Say which it is. */}
            <KeyRow
              icon={<IconParcel size={18} />}
              label="Tracking"
              mono={Boolean(mission.trackingNumber)}
              value={mission.trackingNumber ?? (priv ? 'Not issued' : 'Held with the owner')}
              sub={mission.carrier ?? 'Carrier not assigned'}
            />
            <SpecRow
              icon={<IconCalendar />}
              label="Estimated"
              mono
              tone="dim"
              value={datestamp(mission.estimatedDeliveryAt)}
            />
          </Cluster>
        </Stack>

        <Stack className={cell}>
          <Cluster title="Pass telemetry">
            {/* Resolution leads: it is the one number on this cluster that
                decides what the print will actually show. The four angles
                under it are readings of the same pass and take no marks —
                a degree is not a type. */}
            <KeyRow
              icon={<IconResolution size={18} />}
              label="Resolution"
              mono
              value={`${mission.orbit.gsdM} m`}
              sub="per pixel on the ground"
            />
            <SpecRow icon={<IconSatellite />} label="Sensor" value={mission.orbit.sensor} />
            <SpecRow icon={<IconOrbit live={passAhead} />} label="Track" mono value={mission.orbit.track} />
            <SpecRow label="Inclination" value={mission.orbit.inclination} />
            <SpecRow label="Altitude" mono value={`${mission.orbit.altitudeKm} km`} />
            <SpecRow label="Azimuth" mono value={`${mission.orbit.azimuthDeg}°`} />
            <SpecRow label="Off-nadir" mono value={`${mission.orbit.offNadirDeg}°`} />
            <SpecRow label="Cloud" mono value={`${mission.orbit.cloudPct}%`} />
            <SpecRow
              icon={<IconAntenna />}
              label="Downlink"
              mono
              tone="dim"
              value={<Redacted reason="downlink">{ops.downlink}</Redacted>}
            />
            <SpecRow
              label="Operator"
              tone="dim"
              value={<Redacted reason="callsign">{ops.callsign}</Redacted>}
            />
          </Cluster>
        </Stack>

        <Stack className={cell}>
          <Cluster title="File">
            {/* No key row. The mission code is already the file's identity
                in the masthead, and these five values are peers. */}
            <SpecRow label="Mission" mono value={mission.code} />
            <SpecRow
              icon={<IconLink />}
              label="Short link"
              mono
              tone="dim"
              value={mission.shortLink || missionShortLink(mission.code)}
            />
            <SpecRow icon={<IconClock />} label="Opened" mono tone="dim" value={stamp(mission.createdAt)} />
            <SpecRow icon={<IconCapture />} label="Captured" mono tone="dim" value={stamp(mission.capturedAt)} />
            <SpecRow
              label="Handling"
              mono
              tone="dim"
              value={<Redacted reason="handling">{ops.handling}</Redacted>}
            />
            <SpecRow
              label="Tasking ref"
              mono
              tone="dim"
              value={<Redacted reason="tasking">{ops.tasking}</Redacted>}
            />
          </Cluster>

          {priv ? (
            <Cluster title="Account">
              <KeyRow label="Paid" value={formatPrice(priv.amountMinor, priv.currency)} />
              <SpecRow icon={<IconMail />} label="Filed to" tone="dim" value={priv.email} />
              <SpecRow icon={<IconReceipt />} label="Receipt" mono tone="dim" value={priv.receiptNumber} />
              <SpecRow icon={<IconClock />} label="Settled" mono tone="dim" value={stamp(priv.paidAt)} />
            </Cluster>
          ) : null}
        </Stack>
      </Grid12>
    </div>
  );
}

/* ================================================================== */
/* THE THREE TIERS                                                     */
/* ================================================================== */

/**
 * TIER 1 — a lead value. Label above, the value at heading scale, an
 * optional supporting reading under it.
 */
function Lead({
  icon,
  label,
  value,
  sub,
  className,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      <p className="file-s file-label flex items-center gap-2">
        {icon ?? null}
        {label}
      </p>
      <div className="mt-3.5 flex min-w-0 flex-col gap-1.5">
        <div className="min-w-0">{value}</div>
        {sub ? <div className="min-w-0">{sub}</div> : null}
      </div>
    </div>
  );
}

/**
 * One column of the record. Clusters inside it are separated by the same
 * measure that separates the columns from each other, so the block reads
 * as one rhythm whether it is one column at 390 or three at 1280.
 */
function Stack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-y-12 xl:gap-y-14', className)}>{children}</div>;
}

/** A named cluster of rows, on its own rule. */
function Cluster({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col', className)}>
      <h3 className="file-s file-label-strong">{title}</h3>
      <dl className={cn('mt-3 flex flex-col gap-y-3.5 border-t pt-3.5 md:gap-y-2.5 xl:gap-y-3', RULE)}>
        {children}
      </dl>
    </section>
  );
}

/**
 * TIER 2 — the value that decides what its cluster is about. Stated at
 * roughly twice the row scale, across both columns of the spine, with
 * its supporting reading folded in underneath rather than spent on a
 * row of its own.
 */
function KeyRow({
  icon,
  label,
  value,
  sub,
  mono = false,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 pb-1">
      <dt className="file-s file-label flex items-center gap-1.5">
        {icon ?? null}
        {label}
      </dt>
      <dd className="min-w-0">
        <span
          data-telemetry
          className={cn(
            'block break-words',
            mono
              ? 'file text-[1.0625rem] xl:text-[1.1875rem] xl2:text-[1.3125rem]'
              : 'text-[1.0625rem] leading-tight tracking-[-0.005em] xl:text-[1.1875rem] xl2:text-[1.3125rem]',
            INK,
          )}
        >
          {value}
        </span>
        {sub ? <span className={cn('mt-1 block text-note', INK_DIM)}>{sub}</span> : null}
      </dd>
    </div>
  );
}

/**
 * TIER 3 — a supporting row.
 *
 * Below 768 it stacks; from 768 the label and the value are a pair on a
 * fixed spine. The mark sits in a 16px gutter that is held OPEN on rows
 * that have no type, so the labels stay on one left edge and an unmarked
 * row reads as a deliberate absence rather than as a misalignment.
 *
 * No dotted lead and no rule under the row: those were the two devices
 * that made thirty values look like one value repeated.
 *
 * The label column is stated in rem and it steps once, at 2400: the
 * detail ramp grows a point at 1920 and another at 2400, and a column
 * sized for 10px caps puts `PRINT REGION` on two lines at 12px.
 */
function SpecRow({
  icon,
  label,
  value,
  tone = 'strong',
  mono = false,
}: {
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  tone?: 'strong' | 'dim' | 'accent';
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-0.5 md:grid-cols-[7.75rem_minmax(0,1fr)] md:items-baseline xl:grid-cols-[8.25rem_minmax(0,1fr)] xl3:grid-cols-[9rem_minmax(0,1fr)]">
      {/* A BLOCK dt, not a flex one. `items-baseline` on the grid takes
          each child's FIRST baseline, and a flex container's baseline is
          its first item's — which for the empty gutter on an unmarked row
          is the box's bottom edge, dropping that label half a line below
          its value. Keeping the label in normal flow and hanging the mark
          on it as an inline box means every row, marked or not, aligns on
          the same text baseline. */}
      <dt className="file-s file-label">
        <span aria-hidden className="mr-2 inline-block w-4 align-[-0.45em]">
          {icon}
        </span>
        {label}
      </dt>
      <dd
        data-telemetry
        className={cn(
          'min-w-0 break-words',
          mono ? 'file' : 'text-note',
          tone === 'accent' ? ACCENT : tone === 'dim' ? INK_DIM : INK,
        )}
      >
        {value}
      </dd>
    </div>
  );
}
