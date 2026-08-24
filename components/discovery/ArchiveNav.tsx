import Image from 'next/image';
import Link from 'next/link';
import { frameAlt, titleCase, type ExampleMission } from '@/lib/gallery';
import { cn } from '@/lib/utils';

/**
 * PREVIOUS / NEXT through the archive, in capture order.
 *
 * Two full-bleed media panels butting each other at zero padding — the
 * featured-grid idea (SYSTEM-V3 §5.3) reduced to two tiles, each carrying one
 * eyebrow, one sub-heading and a line of telemetry. The archive wraps at both
 * ends, so it behaves like a reel rather than a dead-ended list.
 *
 * The pair splits at 768 rather than at 640: below that the two panels are
 * 195px wide each and the place names start breaking mid-word.
 */
const PANEL_H =
  'h-[300px] min-[768px]:h-[380px] min-[1280px]:h-[440px] min-[1440px]:h-[480px]' +
  ' min-[1920px]:h-[560px] min-[2400px]:h-[640px]';

export function ArchiveNav({
  prev,
  next,
  className,
}: {
  prev: ExampleMission | null;
  next: ExampleMission | null;
  className?: string;
}) {
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Archive navigation"
      className={cn('surface-dark grid grid-cols-1 min-[768px]:grid-cols-2', className)}
    >
      {prev ? <Panel mission={prev} direction="Previous file" align="left" /> : null}
      {next ? <Panel mission={next} direction="Next file" align="right" /> : null}
    </nav>
  );
}

function Panel({
  mission,
  direction,
  align,
}: {
  mission: ExampleMission;
  direction: string;
  align: 'left' | 'right';
}) {
  return (
    <Link
      href={`/missions/${mission.code}`}
      className={cn(
        'group relative block overflow-hidden focus-visible:outline-1 focus-visible:outline-offset-[-4px] focus-visible:outline-signal',
        PANEL_H,
      )}
    >
      <Image
        src={mission.src}
        alt={frameAlt(mission)}
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-cover transition-transform duration-[600ms] ease-house motion-reduce:transition-none group-hover:scale-[1.04]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-void/90 via-void/35 to-transparent transition-house motion-reduce:transition-none group-hover:opacity-90"
      />
      <div
        className={cn(
          'relative flex h-full flex-col justify-end p-6 min-[768px]:p-10 min-[1920px]:p-14',
          align === 'right' ? 'min-[768px]:items-end min-[768px]:text-right' : null,
        )}
      >
        <p className="flex items-center gap-3 text-label uppercase text-paper/70">
          {align === 'right' ? (
            <>
              {direction}
              <span
                aria-hidden
                className="inline-block transition-transform duration-house ease-house motion-reduce:transition-none group-hover:translate-x-1"
              >
                &rarr;
              </span>
            </>
          ) : (
            <>
              <span
                aria-hidden
                className="inline-block transition-transform duration-house ease-house motion-reduce:transition-none group-hover:-translate-x-1"
              >
                &larr;
              </span>
              {direction}
            </>
          )}
        </p>
        <h3 className="mt-4 max-w-[16ch] text-heading text-paper min-[1920px]:text-display">
          {titleCase(mission.city)}, {titleCase(mission.country)}
        </h3>
        <span
          data-telemetry
          className="mt-4 font-mono text-[0.75rem] uppercase tracking-[0.12em] text-paper/70"
        >
          {mission.code} — {mission.acquiredLabel}
        </span>
      </div>
    </Link>
  );
}
