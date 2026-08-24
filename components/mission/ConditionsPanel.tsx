import { clsx as cn } from 'clsx';
import type { ReactNode } from 'react';
import { StatusToken, type TokenTone } from '@/components/fui/StatusChip';
import {
  IconCloud,
  IconCompass,
  IconDroplet,
  IconEye,
  IconGauge,
  IconSun,
  IconThermometer,
  IconWind,
} from '@/components/fui/icons';
import {
  missionConditions,
  type MissionConditions,
} from '@/lib/missions/conditions';
import type { MissionDTO } from '@/lib/types';
import { formatTelemetryTimestamp } from '@/lib/utils';

/**
 * CONDITIONS — the meteorological block of the flight report.
 *
 * ==================================================================
 * WHAT WAS WRONG WITH IT
 * ==================================================================
 * Twelve cells in a lattice, every one of them a 9px label over an 11px
 * reading, every one the same size and the same weight. It looked
 * precise and it was unreadable: cloud cover and barometric pressure
 * were stated with identical emphasis, so answering the only question
 * anyone brings to this block — "could the satellite see the target?" —
 * meant reading all twelve.
 *
 * ==================================================================
 * WHAT IT IS NOW
 * ==================================================================
 * TWO LEAD READINGS AND TWO CLUSTERS.
 *
 * The two readings that decide whether a frame is possible are CLOUD
 * COVER and SUN ELEVATION, and they now open the block at display
 * scale, each with the graphic that restates it — the oktas bar and the
 * horizon dome, both kept exactly as they were drawn. Cloud carries the
 * sky state as a <StatusToken /> under it — the categorical reading as a
 * scannable token rather than as one more line of type; sun carries its
 * azimuth and the local solar clock as its own supporting line rather
 * than as two more cells.
 *
 * Everything else is genuinely secondary and now looks it, in two named
 * clusters with air between them: WIND AND SIGHT (what the air is doing
 * across the target) and AIR (what it is made of). Seven small rows
 * against two large readings, instead of twelve of nothing in
 * particular.
 *
 * TYPE MARKS come from `components/fui/icons`: cloud, sun, wind,
 * compass, eye, thermometer, droplet, gauge. They are `aria-hidden` and
 * every label is still written out, so the mark never carries meaning on
 * its own. One row deliberately has none — DEW POINT is a temperature,
 * the same type as the row above it, and giving it a second thermometer
 * would say it was a different kind of reading.
 *
 * NOTHING ON THIS BLOCK ANIMATES, and that is the point of the policy
 * rather than an omission: a conditions report is stated for one
 * instant — the capture, or a scheduled pass — and it does not move
 * while it is being read. The two marks on the file that do animate are
 * on `MissionDataBlock`, gated on the mission's own stage.
 *
 * ==================================================================
 * WHERE THE NUMBERS COME FROM — unchanged
 * ==================================================================
 * `lib/missions/conditions.ts` and its header, which is the authority.
 * In short: cloud cover is read straight off the mission record; the
 * sun's elevation, azimuth and the local solar clock are COMPUTED from
 * the capture timestamp and the target's coordinates with the NOAA solar
 * position algorithm; the six surface fields are derived demo data,
 * deterministic per mission code, awaiting a weather API keyed to the
 * capture time and place. Not one number is rounded, re-derived or
 * decorated here, and the footnote still states that distinction on the
 * block itself — a report that does not say which of its numbers were
 * measured is not a report.
 *
 * ==================================================================
 * AT 390
 * ==================================================================
 * The two leads stack and take the full 326px column each, so a large
 * reading is never squeezed into a half column. The clusters pair off at
 * 768 and all four blocks stand side by side from 1280. Cluster rows
 * follow the same rule the specification block follows: stacked below
 * 768, a label/value pair on a spine from 768 up.
 *
 * ==================================================================
 * WHY THIS FILE REPEATS A ROW COMPONENT
 * ==================================================================
 * `./ui` is `'use client'` and reaches `next/font` through `./layout`.
 * This panel is a pure server-renderable block and is kept that way, so
 * its three atoms are local. They are deliberately the same shape as the
 * specification block's — one readout idiom across the file — and the
 * shared parts that CAN cross the boundary (the icon set, the status
 * token) are imported rather than copied.
 */

/* Ground-following ink and rules. Written out rather than imported from
   `./ui`, for the reason in the header above. */
const INK = 'text-[color:var(--ink)]';
const INK_DIM = 'text-[color:var(--ink-dim)]';
const ACCENT = 'text-[color:var(--accent)]';
const RULE = 'border-[color:var(--rule)]';

export interface ConditionsPanelProps {
  mission: MissionDTO;
  /**
   * Pre-computed conditions. Pass them when the surrounding page has already
   * derived them (for a heading, say) so the maths runs once.
   */
  conditions?: MissionConditions;
  /**
   * Forecast the block for a specific instant instead of the mission's own
   * reference — the next predicted pass, while a capture window is open.
   * Ignored once the mission holds a real capture timestamp.
   */
  at?: string | Date | null;
  /** The provenance footnote. On by default; there is rarely a reason to drop it. */
  note?: boolean;
  className?: string;
}

export function ConditionsPanel({
  mission,
  conditions,
  at,
  note = true,
  className,
}: ConditionsPanelProps) {
  const c = conditions ?? missionConditions(mission, { at });
  const s = c.surface;

  const heading = c.measured ? 'Conditions at capture' : 'Conditions forecast';
  // What the instant IS, not what the numbers are. The footnote below says
  // which of them were measured — this line must not overclaim on its behalf.
  const basis =
    c.basis === 'CAPTURE'
      ? 'At capture'
      : c.basis === 'PLANNED_PASS'
        ? 'Scheduled pass'
        : 'At tasking';

  /* Overcast is the one sky state that threatens the collection, and it
     is the only one that takes the accent — exactly the rule this panel
     carried before, now expressed as a token tone instead of as a text
     colour on one cell. */
  const skyTone: TokenTone = c.sky === 'OVERCAST' ? 'alert' : 'neutral';

  return (
    <section aria-label={heading} className={cn('flex flex-col', className)}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-4">
        <h3 className="file-s file-label-strong">{heading}</h3>
        <p data-telemetry className="file-xs uppercase">
          {basis} · {formatTelemetryTimestamp(c.at)}
        </p>
      </header>

      <div className="grid grid-cols-12 gap-x-[var(--grid-gap-x)] gap-y-10 xl:gap-y-0">
        {/* ------------------------------------------------------- */}
        {/* LEAD 1 · CLOUD — the reading that decides the pass       */}
        {/* ------------------------------------------------------- */}
        <Lead
          icon={<IconCloud size={18} />}
          label="Cloud cover"
          className="col-span-12 md:col-span-6 xl:col-span-3 xl:pr-6"
          value={`${c.cloudPct} %`}
          graphic={<Oktas filled={c.oktas} />}
          token={<StatusToken label={c.sky} tone={skyTone} />}
        />

        {/* ------------------------------------------------------- */}
        {/* LEAD 2 · SUN — the other one                            */}
        {/* ------------------------------------------------------- */}
        <Lead
          icon={<IconSun size={18} />}
          label="Sun elevation"
          className={cn('col-span-12 md:col-span-6 xl:col-span-3 xl:border-l xl:pl-6', RULE)}
          value={c.sun.daylight ? `${c.sun.elevationDeg.toFixed(1)}°` : 'Below horizon'}
          tone={c.sun.daylight ? undefined : 'accent'}
          graphic={<SunGauge elevationDeg={c.sun.elevationDeg} />}
          sub={`Azimuth ${c.sun.azimuthDeg.toFixed(0)}° ${c.sun.compass} · solar time ${c.sun.solarTime}`}
        />

        {/* ------------------------------------------------------- */}
        {/* THE SUPPORTING CLUSTERS                                 */}
        {/* ------------------------------------------------------- */}
        <Cluster
          title="Wind and sight"
          className={cn('col-span-12 md:col-span-6 xl:col-span-3 xl:border-l xl:pl-6', RULE)}
        >
          <Reading icon={<IconWind />} label="Ground wind" value={`${s.windSpeedMs.toFixed(1)} m/s`} />
          <Reading icon={<IconCompass />} label="Wind from" value={`${s.windBearingDeg}° ${s.windCompass}`} />
          <Reading icon={<IconEye />} label="Visibility" value={`${s.visibilityKm.toFixed(1)} km`} />
        </Cluster>

        <Cluster
          title="Air"
          className={cn('col-span-12 md:col-span-6 xl:col-span-3 xl:border-l xl:pl-6', RULE)}
        >
          <Reading
            icon={<IconThermometer />}
            label="Air temperature"
            value={`${s.temperatureC.toFixed(1)} °C`}
          />
          {/* No mark: a dew point is a temperature, the same type as the
              row above. A second thermometer would claim otherwise. */}
          <Reading label="Dew point" value={`${s.dewPointC.toFixed(1)} °C`} />
          <Reading icon={<IconDroplet />} label="Humidity" value={`${s.humidityPct} %`} />
          <Reading icon={<IconGauge />} label="Pressure" value={`${s.pressureHpa} hPa`} />
        </Cluster>
      </div>

      {/* Both of these are PROSE — sentences with clauses, not readings — so
          they take `text-note` (sans, 13→16px) and sentence case rather than
          the uppercase detail ramp. Small type is not the same thing as a
          label: a label names a value, and neither of these does. */}
      <p className={cn('mt-9 max-w-[var(--measure)] text-note', INK_DIM)}>{c.skyNote}</p>

      {note ? (
        <p className={cn('mt-1.5 max-w-[var(--measure)] text-note', INK_DIM)}>
          Cloud cover is read from the mission record. Solar geometry is computed for the capture
          time and the target coordinates. The surface fields are modelled from latitude, season
          and local solar time, pending a weather API reading.
        </p>
      ) : null}
    </section>
  );
}

/* ================================================================== */
/* THE THREE ATOMS                                                     */
/* ================================================================== */

/**
 * A LEAD READING. Marked label, the number at display scale, the graphic
 * that restates it, and then either a status token or a supporting line.
 * The graphic sits under the number rather than beside it so it lines up
 * on the same left edge at every width.
 */
function Lead({
  icon,
  label,
  value,
  graphic,
  token,
  sub,
  tone,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  graphic?: ReactNode;
  token?: ReactNode;
  sub?: string;
  tone?: 'accent';
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      <p className="file-s file-label flex items-center gap-2">
        {icon}
        {label}
      </p>
      <p
        data-telemetry
        className={cn(
          'file mt-3 text-[1.625rem] leading-none xl:text-[1.875rem] xl2:text-[2.125rem]',
          tone === 'accent' ? ACCENT : INK,
        )}
      >
        {value}
      </p>
      {graphic ? <div className="mt-3">{graphic}</div> : null}
      {token ? <div className="mt-3.5">{token}</div> : null}
      {sub ? (
        <p data-telemetry className={cn('mt-3 file', INK_DIM)}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/** A named cluster of small readings, on its own rule. */
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
      <h4 className="file-s file-label-strong">{title}</h4>
      <dl className={cn('mt-3 flex flex-col gap-y-3.5 border-t pt-3.5 md:gap-y-2.5 xl:gap-y-3', RULE)}>
        {children}
      </dl>
    </section>
  );
}

/**
 * A SUPPORTING READING. Stacked below 768, a label/value pair on a spine
 * from 768 up — the same idiom the specification block uses. The mark's
 * 16px gutter is held open on the row that has no type, so the labels
 * keep one left edge.
 *
 * The label column steps twice, at 1920 and 2400, because the detail ramp
 * gains a point at each: `AIR TEMPERATURE` is the widest label in the
 * block and a column sized for 10px caps breaks it in two at 12px.
 */
function Reading({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-0.5 md:grid-cols-[9rem_minmax(0,1fr)] md:items-baseline xl2:grid-cols-[10rem_minmax(0,1fr)] xl3:grid-cols-[10.75rem_minmax(0,1fr)]">
      {/* A BLOCK dt — see the note on the specification block's row for
          why this is not a flex container. */}
      <dt className="file-s file-label">
        <span aria-hidden className="mr-2 inline-block w-4 align-[-0.45em]">
          {icon}
        </span>
        {label}
      </dt>
      <dd data-telemetry className={cn('file min-w-0 uppercase', INK)}>
        {value}
      </dd>
    </div>
  );
}

/* ================================================================== */
/* THE TWO GRAPHICS — unchanged                                        */
/* ================================================================== */

/**
 * Cloud cover in eighths, the way a surface observation writes it: eight
 * cells, the covered ones filled. It is the same number as the percentage
 * above it in a form that can be read without reading — which is the only
 * reason a graphic earns space inside a data cell.
 */
function Oktas({ filled }: { filled: number }) {
  return (
    <span aria-hidden className="flex h-[9px] w-full max-w-[132px] gap-[2px]">
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-full flex-1 border',
            RULE,
            i < filled ? 'bg-[color:var(--ink-dim)]' : 'bg-transparent',
          )}
        />
      ))}
    </span>
  );
}

/**
 * Sun elevation against the horizon: a quarter-dome from horizon to zenith
 * with the sun sitting on it. Static and deterministic — the angle is the
 * only variable and it is already rounded to one decimal upstream. Below the
 * horizon the dot drops under the rule rather than clamping to it, so a night
 * pass is visibly a night pass.
 */
function SunGauge({ elevationDeg }: { elevationDeg: number }) {
  const W = 72;
  const H = 26;
  const baseY = 21;
  const cx = 36;
  const rx = 30;
  const ry = 15;
  // The dome runs horizon → zenith → horizon. Elevation walks the ascending
  // limb: 0° at the left horizon, 90° at the apex.
  const angle = (Math.max(-15, Math.min(90, elevationDeg)) / 90) * (Math.PI / 2);
  const x = Math.round((cx - rx * Math.cos(angle)) * 1000) / 1000;
  const y = Math.round((baseY - ry * Math.sin(angle)) * 1000) / 1000;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-[38px] w-[105px]"
      aria-hidden
      fill="none"
    >
      {/* horizon */}
      <line
        x1="0"
        y1={baseY}
        x2={W}
        y2={baseY}
        stroke="var(--rule)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {/* the dome the sun runs along */}
      <path
        d={`M ${cx - rx},${baseY} A ${rx},${ry} 0 0 1 ${cx + rx},${baseY}`}
        stroke="var(--rule)"
        strokeWidth="1"
        strokeDasharray="1 3"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={x} cy={y} r="2.6" fill="var(--accent)" />
    </svg>
  );
}
