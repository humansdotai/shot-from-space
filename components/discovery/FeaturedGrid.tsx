import { MediaCard } from '@/components/fui';
import { frameAlt, titleCase, type ExampleMission } from '@/lib/gallery';
import { cn } from '@/lib/utils';

/**
 * THE FEATURED GRID (SYSTEM-V3 §5.3).
 *
 * Six frames at mixed spans with NO gutter between them — one mosaic block
 * that runs the full width of the page rather than a card grid sitting in the
 * content column. Every tile is a <MediaCard>, so the hover is the one the
 * system already owns: the frame holds still, the photograph scales inside
 * it, the scrim deepens and the telemetry line arrives under the place name.
 *
 * ------------------------------------------------------------------------
 * HOW THE MOSAIC IS BUILT
 * ------------------------------------------------------------------------
 * Fixed row height (`--tile`) plus column and row spans, so the tiles
 * interlock instead of each one carrying its own aspect ratio. Passing
 * `aspect="auto"` and stretching the card to `h-full` hands the geometry to
 * the grid: the frame is whatever the cell is, and the cell is a decision.
 *
 * The arrangement is re-cut three times, and each cut is a different picture:
 *
 *   390   two columns. Lead 2×2, four half tiles, one wide closer.
 *   768   twelve columns. Lead 8 wide × 2 rows, a stacked pair beside it,
 *         three squares underneath.
 *   1920  twelve columns, flatter and wider — 5 + 4 + 3 across the top, then
 *         two half-width tiles. At this width the 768 cut would have made the
 *         lead a 1300px-wide letterbox, which is the failure SYSTEM-V3 §2
 *         is about.
 *
 * `--tile` steps at all five breakpoints (150 / 176 / 210 / 240 / 268 / 300),
 * so the tiles gain height as the page widens instead of only stretching.
 */

/** Column and row spans per tile, cut at 390, at 768 and again at 1920. */
const SPANS = [
  'col-span-2 row-span-2 min-[768px]:col-span-8 min-[768px]:row-span-2 min-[1920px]:col-span-5',
  'col-span-1 row-span-1 min-[768px]:col-span-4 min-[1920px]:col-span-4 min-[1920px]:row-span-2',
  'col-span-1 row-span-1 min-[768px]:col-span-4 min-[1920px]:col-span-3',
  'col-span-1 row-span-1 min-[768px]:col-span-4 min-[768px]:row-span-2 min-[1920px]:col-span-3 min-[1920px]:row-span-1',
  'col-span-1 row-span-1 min-[768px]:col-span-4 min-[768px]:row-span-2 min-[1920px]:col-span-6',
  'col-span-2 row-span-1 min-[768px]:col-span-4 min-[768px]:row-span-2 min-[1920px]:col-span-6',
] as const;

/** What each tile is asked to download, per cut. */
const SIZES = [
  '(min-width: 1920px) 42vw, (min-width: 768px) 67vw, 100vw',
  '(min-width: 1920px) 34vw, (min-width: 768px) 34vw, 50vw',
  '(min-width: 1920px) 25vw, (min-width: 768px) 34vw, 50vw',
  '(min-width: 1920px) 25vw, (min-width: 768px) 34vw, 50vw',
  '(min-width: 1920px) 50vw, (min-width: 768px) 34vw, 50vw',
  '(min-width: 1920px) 50vw, (min-width: 768px) 34vw, 100vw',
] as const;

const TILE =
  '[--tile:150px] min-[768px]:[--tile:176px] min-[1280px]:[--tile:210px]' +
  ' min-[1440px]:[--tile:240px] min-[1920px]:[--tile:268px] min-[2400px]:[--tile:300px]';

export function FeaturedGrid({
  missions,
  className,
}: {
  /** Six frames. Fewer still tile; more are ignored by the span table. */
  missions: ExampleMission[];
  className?: string;
}) {
  const tiles = missions.slice(0, SPANS.length);
  if (tiles.length === 0) return null;

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-0 auto-rows-[var(--tile)] min-[768px]:grid-cols-12',
        // The tiles are links. In landscape on a notched device the outermost
        // ones put their city name and coordinate line under the sensor
        // housing; this inset stops them at the safe area. No-op without a
        // cutout, so the grid stays edge to edge everywhere else.
        'safe-pad-x',
        TILE,
        className,
      )}
    >
      {tiles.map((m, i) => (
        <MediaCard
          key={m.code}
          href={`/missions/${m.code}`}
          src={m.src}
          alt={frameAlt(m)}
          title={titleCase(m.city)}
          subtitle={`${m.code} — ${m.acquiredLabel}`}
          aspect="auto"
          priority={i === 0}
          sizes={SIZES[i]}
          className={cn('h-full rounded-none', SPANS[i])}
        />
      ))}
    </div>
  );
}

