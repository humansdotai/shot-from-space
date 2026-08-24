import Image from 'next/image';
import Link from 'next/link';
import { cn, formatCoords, formatTelemetryTimestamp } from '@/lib/utils';
import { CropMarks } from './CropMarks';
import { FileTags } from './FileTags';
import { MissionCode } from './MissionCode';
import { StatusChip, type ChipState } from './StatusChip';

/**
 * A mission, filed. Image plate on top, telemetry block beneath.
 * Used by the discovery gallery and anywhere a mission is listed.
 */
export function DossierCard({
  code,
  src,
  alt,
  locationLabel,
  capturedAt,
  lat,
  lon,
  tags = [],
  href,
  status,
  statusState = 'done',
  aspect = '4 / 3',
  priority = false,
  sizes = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
  className,
}: {
  code: string;
  src: string;
  alt: string;
  locationLabel: string;
  capturedAt: string;
  lat: number;
  lon: number;
  tags?: string[];
  href?: string;
  status?: string;
  statusState?: ChipState;
  aspect?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const body = (
    <article
      className={cn(
        'group relative flex h-full flex-col border border-hairline bg-deck/40 transition-colors duration-300',
        href ? 'hover:border-paper-faint' : null,
        className,
      )}
    >
      <div className="relative overflow-hidden bg-void" style={{ aspectRatio: aspect }}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
        />
        <CropMarks length={12} inset={8} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-linear-to-t from-void/80 via-void/25 to-transparent p-3">
          <span data-telemetry className="font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-paper/80">
            {formatCoords(lat, lon)}
          </span>
          {status ? <StatusChip label={status} state={statusState} /> : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 border-t border-hairline p-3 sm:p-4">
        <div className="flex items-baseline justify-between gap-3">
          <MissionCode code={code} size="sm" />
          <span
            data-telemetry
            className="font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-paper-faint"
          >
            {formatTelemetryTimestamp(capturedAt)}
          </span>
        </div>
        <p className="text-label uppercase text-paper">
          {locationLabel}
        </p>
        {tags.length ? <FileTags tags={tags} className="mt-auto pt-1" /> : null}
      </div>
    </article>
  );

  if (href) {
    // `--focus-ring`, not `outline-signal`: the ring has to darken to
    // `--color-signal-ink` inside a light band, where #ff4d1c is
    // 2.83:1 against paper and fails the 3:1 non-text minimum.
    return (
      <Link
        href={href}
        className="block h-full focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
      >
        {body}
      </Link>
    );
  }
  return body;
}
