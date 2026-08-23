import { MediaCard } from '@/components/fui';
import { frameBySlug, type CatalogueFrame } from '@/lib/imagery';
import { getExampleMissionBySlug, titleCase } from '@/lib/gallery';

/**
 * THE FEATURED MOSAIC — mixed spans, no gutters, one block (SYSTEM-V3 §5.3).
 *
 * Ten real capture frames, tiled edge to edge with nothing between them.
 * The absence of a gutter is the archetype: with gaps this is a card grid
 * and reads as a listing; without them the tiles fuse into a single block
 * of photography with a lit frame under the pointer, and the page has a
 * picture in it rather than a set of thumbnails.
 *
 * Every tile is a real Landsat frame from `lib/imagery`, titled with the
 * place it shows, subtitled with the coordinates it was taken at, and
 * linked to that frame's own mission file in the archive. Nothing here is
 * decorative and nothing is a stock crop.
 *
 * ------------------------------------------------------------------
 * HOW THE MOSAIC IS BUILT
 * ------------------------------------------------------------------
 * A fixed column count and a fixed row height per breakpoint, with each
 * tile declaring a column span and a row span. The five arrangements are
 * solved so that the spans fill their grid EXACTLY — no holes, no ragged
 * last row — under plain sparse auto-placement, which is why no tile needs
 * an explicit `col-start` and why `grid-auto-flow: dense` is not used: dense
 * packing re-orders the pictures, and the order of these frames is the
 * order they read in.
 *
 *   cols · rows · tiles       what fills
 *   ------------------------------------------------------------------
 *   < 768    2 cols, 6 rows,  8 tiles   one full-width lead, then pairs
 *   768      4 cols, 5 rows,  8 tiles   a 2×2 lead, pairs, one full band
 *   1280     6 cols, 5 rows,  8 tiles   a 3×2 lead, a 2×2 second anchor
 *   1920     8 cols, 4 rows,  8 tiles   two anchors, two five-wide bands
 *   2400    10 cols, 4 rows, 10 tiles   two more frames come in, so the
 *                                       block stays a mosaic instead of
 *                                       ten enormous rectangles
 *
 * The row height steps with the breakpoint too (168 → 256px), so a tile's
 * proportion is roughly held rather than being stretched flat on a wide
 * screen.
 */

interface Tile {
  slug: string;
  /** Column and row spans across the five arrangements. */
  spans: string;
  sizes: string;
}

const TILES: Tile[] = [
  {
    // The lead. 2×2 on a phone, and the widest anchor at every step above.
    slug: 'las-vegas-us',
    spans:
      'col-span-2 row-span-2 min-[1280px]:col-span-3 min-[1920px]:col-span-4 min-[2400px]:col-span-5',
    sizes: '(min-width: 1280px) 50vw, 100vw',
  },
  {
    slug: 'lisse-nl',
    spans:
      'col-span-1 min-[768px]:col-span-2 min-[1280px]:col-span-3 min-[1920px]:col-span-2 min-[2400px]:col-span-3',
    sizes: '(min-width: 1280px) 34vw, (min-width: 768px) 50vw, 50vw',
  },
  {
    slug: 'rio-de-janeiro-br',
    spans:
      'col-span-1 min-[768px]:col-span-2 min-[1280px]:col-span-3 min-[1920px]:col-span-2',
    sizes: '(min-width: 1280px) 34vw, (min-width: 768px) 50vw, 50vw',
  },
  {
    slug: 'cape-town-za',
    spans:
      'col-span-2 min-[1280px]:col-span-2 min-[1280px]:row-span-2 min-[1920px]:row-span-1 min-[2400px]:col-span-3',
    sizes: '(min-width: 1280px) 34vw, (min-width: 768px) 50vw, 100vw',
  },
  {
    slug: 'paris-fr',
    spans: 'col-span-1 min-[768px]:col-span-2 min-[1280px]:col-span-4 min-[1920px]:col-span-2',
    sizes: '(min-width: 1280px) 50vw, (min-width: 768px) 50vw, 50vw',
  },
  {
    // The second anchor: it takes a 2-row span only from 1920, where the
    // grid is short enough to need one.
    slug: 'london-uk',
    spans:
      'col-span-1 min-[768px]:col-span-2 min-[1920px]:col-span-3 min-[1920px]:row-span-2 min-[2400px]:col-span-4',
    sizes: '(min-width: 1920px) 40vw, (min-width: 768px) 34vw, 50vw',
  },
  {
    slug: 'berlin-de',
    spans: 'col-span-1 min-[768px]:col-span-2 min-[1920px]:col-span-5 min-[2400px]:col-span-3',
    sizes: '(min-width: 1920px) 60vw, (min-width: 768px) 34vw, 50vw',
  },
  {
    slug: 'sao-paulo-br',
    spans:
      'col-span-1 min-[768px]:col-span-4 min-[1280px]:col-span-6 min-[1920px]:col-span-5 min-[2400px]:col-span-3',
    sizes: '(min-width: 768px) 100vw, 50vw',
  },
  {
    // 2400 only — the two frames that keep the widest arrangement a mosaic.
    slug: 'buenos-aires-ar',
    spans: 'hidden min-[2400px]:block min-[2400px]:col-span-3',
    sizes: '30vw',
  },
  {
    slug: 'samarkand-uz',
    spans: 'hidden min-[2400px]:block min-[2400px]:col-span-3',
    sizes: '30vw',
  },
];

/** `36.17N 115.14W` — short enough to survive one line on the smallest tile. */
function shortCoords(frame: CatalogueFrame): string {
  const ns = frame.lat >= 0 ? 'N' : 'S';
  const ew = frame.lon >= 0 ? 'E' : 'W';
  return `${Math.abs(frame.lat).toFixed(2)}${ns} ${Math.abs(frame.lon).toFixed(2)}${ew}`;
}

export function FeaturedMosaic() {
  return (
    <div
      className={[
        'grid w-full gap-0',
        // See FeaturedGrid: interactive tile labels must clear the display
        // cutout in landscape. Zero on a device without one.
        'safe-pad-x',
        // Row height per breakpoint — the mosaic's only vertical measure.
        '[--tile:10.5rem] [grid-auto-rows:var(--tile)]',
        'min-[768px]:[--tile:11.5rem]',
        'min-[1280px]:[--tile:13rem]',
        'min-[1920px]:[--tile:14.5rem]',
        'min-[2400px]:[--tile:16rem]',
        // Column count per breakpoint.
        'grid-cols-2',
        'min-[768px]:grid-cols-4',
        'min-[1280px]:grid-cols-6',
        'min-[1920px]:grid-cols-8',
        'min-[2400px]:grid-cols-10',
      ].join(' ')}
    >
      {TILES.map((tile) => {
        const frame = frameBySlug(tile.slug);
        const mission = getExampleMissionBySlug(tile.slug);
        if (!frame || !mission) return null;

        return (
          <div key={tile.slug} className={tile.spans}>
            <MediaCard
              href={`/missions/${mission.code}`}
              src={frame.src}
              alt={`Satellite capture of ${titleCase(frame.city)}, ${titleCase(frame.country)}, recorded from orbit`}
              title={titleCase(frame.city)}
              subtitle={shortCoords(frame)}
              // The frame is the grid cell, not a ratio: `auto` lets the row
              // span decide the height and `h-full` fills it.
              aspect="auto"
              sizes={tile.sizes}
              className="h-full rounded-none"
            />
          </div>
        );
      })}
    </div>
  );
}
