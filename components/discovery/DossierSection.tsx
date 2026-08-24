import type { ReactNode } from 'react';
import { Band } from '@/components/fui';
import { cn } from '@/lib/utils';

/**
 * A FEATURE SECTION (SYSTEM-V3 §5.5).
 *
 * Media on one side, a text column on the other, and the side alternates
 * down the page. The section opts out of the content column (§1): the media
 * half runs to the edge of the window, which is what stops the dossier from
 * being a 1440px design stranded in the middle of a 2400px screen.
 *
 * ------------------------------------------------------------------------
 * WHAT CHANGES, AND WHERE
 * ------------------------------------------------------------------------
 *   390    stacked. Media on top at 4:3, writing underneath on the page
 *          gutter, so the reading order is picture then caption.
 *   768    stacked still, but the media opens to 16:9 — a half-height
 *          panel at this width would be a stripe.
 *   1280   the split appears: two equal halves, the media takes its side
 *          and its aspect ratio is dropped for the height of the writing.
 *   1920   the halves stop being equal — 7 to 5 — and WHICH half gets the
 *          seven follows what the media is. A photograph earns the wide
 *          side; an object centred on a panel does not, so a specification
 *          beside one gets the width instead and its columns stay columns
 *          rather than stretching into a two-item-per-line table.
 *   2400   same split, more air around the type.
 *
 * `ground` says what the media half IS. A `plate` is a photograph and brings
 * the dark ground with it. A `panel` is a physical object — a patch, a
 * printed sheet — photographed on white, so it stays on the paper and takes
 * the raised paper tint instead.
 */
export function DossierSection({
  media,
  side,
  ground = 'plate',
  children,
  className,
}: {
  /** Fills the media half. Give it `h-full w-full`. */
  media: ReactNode;
  /** Which side the media takes from 1280 up. */
  side: 'left' | 'right';
  ground?: 'plate' | 'panel';
  /** The text column. */
  children: ReactNode;
  className?: string;
}) {
  return (
    <Band tone="light" top="flush" bottom="flush" className={className}>
      <div
        className={cn(
          'grid grid-cols-1 min-[1280px]:grid-cols-2 min-[1280px]:items-stretch',
          // The seven goes to the media track for a plate and to the text
          // track for a panel; `order-2` moves the media, not the tracks.
          (side === 'left') === (ground === 'plate')
            ? 'min-[1920px]:grid-cols-[7fr_5fr]'
            : 'min-[1920px]:grid-cols-[5fr_7fr]',
        )}
      >
        <div
          className={cn(
            'relative w-full',
            side === 'right' ? 'min-[1280px]:order-2' : null,
            ground === 'plate'
              ? 'aspect-4/3 min-[768px]:aspect-16/9 min-[1280px]:aspect-auto min-[1280px]:h-full min-[1280px]:min-h-[600px] min-[1920px]:min-h-[720px] min-[2400px]:min-h-[820px]'
              : 'flex items-center justify-center bg-[var(--ground-raised)] px-[var(--gutter-shell)] py-16 min-[1280px]:px-16 min-[1280px]:py-20 min-[1920px]:px-24 min-[2400px]:px-32',
          )}
        >
          {media}
        </div>

        <div
          className={cn(
            'flex flex-col justify-center px-[var(--gutter-shell)] py-14',
            'min-[768px]:py-16',
            'min-[1280px]:px-14 min-[1280px]:py-20',
            'min-[1440px]:px-16',
            'min-[1920px]:px-24 min-[1920px]:py-24',
            'min-[2400px]:px-32 min-[2400px]:py-28',
          )}
        >
          {children}
        </div>
      </div>
    </Band>
  );
}
