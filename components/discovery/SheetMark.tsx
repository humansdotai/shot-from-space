import Image from 'next/image';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/**
 * THE CHROME MARK, ON THE PAPER.
 *
 * The same object that closes the poster's mission sheet, closing the light
 * band that reproduces it. Solid and fully opaque — it is a thing sitting on
 * the page, not a watermark behind it — hung bottom-right with real padding
 * off the edge, and nothing is ever set over it.
 *
 * ------------------------------------------------------------------------
 * TWO NUMBERS THAT HAVE TO MATCH lib/poster/compose.ts
 * ------------------------------------------------------------------------
 * 1. The artwork's canvas is not the mark. `mark-3d.png` is 900 × 702; the
 *    chrome object inside it measures 856 × 578 and the remaining 124 px at
 *    the foot is a faint ambient shadow baked into the render. So `--mark`
 *    is the height of the OBJECT, the element is sized to the canvas
 *    (object ÷ 0.8234), and the difference is pulled back out of the layout
 *    with a negative margin — otherwise the mark reads as under-sized and
 *    the "padding" below it is 21% empty pixels rather than a decision.
 *
 * 2. The drop shadow is proportional to the object's height, not a fixed
 *    offset, so it scales with the mark at every breakpoint:
 *
 *      spec at 440 × 298 →  X 0 · Y 52 · blur 14 · spread 0
 *      Y     52 / 298 = 0.1745 of the height
 *      blur  14 / 298 = 0.0470 of the height
 *
 *    `drop-shadow()` reads a CSS blur radius exactly as `box-shadow` does, so
 *    this is the same shadow the raster composer builds with a Gaussian at
 *    half that sigma. Soft, neutral ink, never coloured and never a glow.
 */

/** Object height ÷ canvas height, measured off the asset's alpha channel. */
const CANVAS = 0.8234;

export function SheetMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('flex justify-end', className)}
      style={
        {
          // The object's rendered height. Everything else is derived from it.
          '--mark': 'clamp(4.5rem, 3.6rem + 3.7vw, 6.75rem)',
        } as CSSProperties
      }
    >
      <Image
        src="/brand/mark-3d.png"
        alt=""
        width={900}
        height={702}
        sizes="(min-width: 1024px) 160px, 112px"
        className="w-auto"
        style={{
          height: `calc(var(--mark) / ${CANVAS})`,
          marginBottom: `calc(var(--mark) * ${(CANVAS - 1).toFixed(4)})`,
          filter:
            'drop-shadow(0 calc(var(--mark) * 0.1745) calc(var(--mark) * 0.047)' +
            ' rgb(8 9 11 / 0.32))',
        }}
      />
    </div>
  );
}
