import Image from 'next/image';
import Link from 'next/link';
import { titleCase } from '@/lib/gallery';
import { cn, formatCoords } from '@/lib/utils';

/**
 * THE LEAD ITEM of the archive index (SYSTEM-V3 §5.6).
 *
 * A news index opens with one entry set large and continues as a dated list.
 * This is that entry: the plate at size, the written record beside it, and
 * the same capture timestamp the rows below are ordered by.
 *
 * It is always the head of the CURRENT list, so it changes with the filter
 * and with the sort — the caption above it says which of the two put it
 * there rather than leaving the reader to infer it.
 *
 * The photograph keeps the dark ground on a paper band, which is the rule
 * the whole site is built on: pictures in the void, writing on the paper.
 */
export function ArchiveLead({
  code,
  src,
  alt,
  city,
  country,
  region,
  summary,
  acquiredLabel,
  lat,
  lon,
  caption,
  className,
}: {
  code: string;
  src: string;
  alt: string;
  city: string;
  country: string;
  /** Sentence-case region name, e.g. `Europe`. */
  region: string;
  summary: string;
  acquiredLabel: string;
  lat: number;
  lon: number;
  /** Why this file is at the head of the list. */
  caption: string;
  className?: string;
}) {
  return (
    <Link
      href={`/missions/${code}`}
      className={cn(
        'group grid grid-cols-1 items-start gap-8',
        'min-[768px]:grid-cols-12 min-[768px]:gap-x-[var(--gutter-shell)]',
        'min-[1280px]:gap-x-14 min-[1920px]:gap-x-20',
        className,
      )}
    >
      {/* The plate. The frame never resizes; the photograph moves inside it. */}
      <div
        className={cn(
          'surface-dark relative aspect-4/3 w-full overflow-hidden',
          'min-[768px]:col-span-7 min-[768px]:aspect-3/2',
          'min-[1280px]:col-span-8 min-[1280px]:aspect-16/10',
          'min-[1920px]:col-span-7 min-[1920px]:aspect-3/2',
        )}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="(min-width: 1280px) 62vw, (min-width: 768px) 58vw, 100vw"
          className="object-cover transition-transform duration-[600ms] ease-house motion-reduce:transition-none group-hover:scale-[1.03] group-focus-visible:scale-[1.03]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-void/80 to-transparent opacity-0 transition-house group-hover:opacity-100 group-focus-visible:opacity-100"
        />
        <span
          aria-hidden
          data-telemetry
          className="pointer-events-none absolute bottom-4 left-4 font-mono text-[0.6875rem] leading-none tracking-[0.08em] text-paper opacity-0 transition-house group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {formatCoords(lat, lon)}
        </span>
      </div>

      {/* The record. */}
      <div className="min-[768px]:col-span-5 min-[1280px]:col-span-4 min-[1920px]:col-span-5">
        <p className="text-label uppercase ink-dim">{caption}</p>

        <div className="mt-5 flex items-baseline gap-4">
          <span
            data-telemetry
            className="font-mono text-[0.8125rem] leading-none tracking-[0.14em] ink"
          >
            {code}
          </span>
          <span
            data-telemetry
            className="font-mono text-[0.75rem] leading-none tracking-[0.08em] ink-dim"
          >
            {acquiredLabel}
          </span>
        </div>

        <h3 className="mt-5 max-w-[16ch] text-heading ink min-[1280px]:text-display">
          <span className="link-underline pb-1">
            {titleCase(city)}, {titleCase(country)}
          </span>
        </h3>

        <p className="mt-5 max-w-[52ch] text-body ink-dim min-[1920px]:mt-7">{summary}</p>

        <p className="mt-6 flex items-center gap-3 text-action ink min-[1920px]:mt-8">
          <span className="link-underline pb-0.5">Open the file</span>
          <span
            aria-hidden
            className="inline-block transition-transform duration-house ease-house motion-reduce:transition-none group-hover:translate-x-1"
          >
            &rarr;
          </span>
        </p>

        <p className="mt-6 text-label uppercase ink-faint">Filed under {region}</p>
      </div>
    </Link>
  );
}
