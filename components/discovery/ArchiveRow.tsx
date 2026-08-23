import Link from 'next/link';
import { titleCase } from '@/lib/gallery';
import { formatCoords } from '@/lib/utils';

/**
 * ONE DATED ENTRY in the archive index (SYSTEM-V3 §5.6).
 *
 * The list under the lead item. Every row is one link on one hairline: the
 * capture timestamp first, because the date is what this index is ordered
 * by, then the mission code, then the place, then where it is filed and —
 * from 1280, where there is room for it without crowding the place name —
 * the coordinates.
 *
 * The whole row is the target. At 390 it sets on two lines and the padding
 * carries it well past 44px; from 768 it is a single line on the 12-column
 * grid. `row-hover` bleeds the highlight past the text without moving the
 * row, and the place name takes its underline at the same time on the same
 * curve.
 */
export function ArchiveRow({
  code,
  city,
  region,
  acquiredLabel,
  acquiredDate,
  lat,
  lon,
}: {
  code: string;
  city: string;
  /** Sentence-case region name, e.g. `Americas`. */
  region: string;
  /** Already formatted; the archive never re-derives a date from a raw value. */
  acquiredLabel: string;
  acquiredDate: string | null;
  lat: number;
  lon: number;
}) {
  return (
    <li className="border-t rule-ground">
      <Link
        href={`/missions/${code}`}
        className="row-hover group grid grid-cols-[auto_1fr] items-baseline gap-x-5 gap-y-2 py-4 min-[768px]:grid-cols-12 min-[768px]:gap-x-[var(--gutter-shell)] min-[768px]:py-5 min-[1280px]:py-6 min-[1920px]:gap-x-12 min-[1920px]:py-7"
      >
        <time
          dateTime={acquiredDate ?? undefined}
          data-telemetry
          className="font-mono text-[0.75rem] leading-none tracking-[0.08em] ink-dim min-[768px]:col-span-2"
        >
          {acquiredLabel}
        </time>

        <span
          data-telemetry
          className="font-mono text-[0.75rem] leading-none tracking-[0.14em] ink min-[768px]:col-span-2"
        >
          {code}
        </span>

        <span className="col-span-2 text-body ink min-[768px]:col-span-5 min-[1280px]:col-span-4 min-[1920px]:text-heading">
          <span className="link-underline pb-0.5">{titleCase(city)}</span>
        </span>

        <span className="hidden text-label uppercase ink-dim min-[768px]:col-span-3 min-[768px]:block min-[1280px]:col-span-2">
          {region}
        </span>

        {/* Coordinates and the glyph share one cell so the row still totals
            twelve columns at every cut: 2 + 2 + 4 + 2 + 2. */}
        <span className="hidden items-baseline justify-end gap-4 min-[1280px]:col-span-2 min-[1280px]:flex">
          <span
            data-telemetry
            className="font-mono text-[0.75rem] leading-none tracking-[0.06em] ink-faint"
          >
            {formatCoords(lat, lon, 2)}
          </span>
          <span
            aria-hidden
            className="ink-dim transition-transform duration-house ease-house motion-reduce:transition-none group-hover:translate-x-1"
          >
            &rarr;
          </span>
        </span>
      </Link>
    </li>
  );
}
