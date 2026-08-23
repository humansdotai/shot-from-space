import type { ReactNode } from 'react';
import { Grid12 } from '@/components/fui';
import { cn } from '@/lib/utils';

/**
 * THE BAND HEAD — one geometry for every section opening on this page.
 *
 * Every band on the landing page opens the same way, at the same offsets, on
 * the same measure. That is the whole point of extracting it: a page reads as
 * composed when the eye can predict where the next heading will start, and it
 * reads as assembled when each section invents its own gap.
 *
 * The vertical set it moves on — 12 / 20 / 32 / 48 — and the page measure
 * are both documented in `./geometry.ts`.
 *
 * ------------------------------------------------------------------
 * THE MEASURE, AND THE RAIL
 * ------------------------------------------------------------------
 *   heading  ≤ 18ch, columns 1—6
 *   lede     columns 9—12; the column IS the measure, ~50 characters
 *   body     ≤ 38ch inside a grid column
 *
 * The head sits on the SAME 12-column grid as the content under it, so the
 * lede and the right-hand column of the band below start on one vertical
 * rail. Columns 9—12 is the rail every band on this page uses on its right,
 * and `<FeatureRow>` puts its text column on exactly the same one at
 * exactly the same breakpoint. Setting the lede flush-right instead leaves
 * it a hundred pixels off every column it is supposed to line up with, and
 * that single misalignment is most of what reads as amateur.
 *
 * The head goes two-up at 1280 and not before: at 768 a six-column heading
 * is about 340px wide, which is twelve characters of display type per line
 * and reads as a broken column rather than a headline.
 *
 * Baselines are aligned optically: `items-end` puts the lede's last line on
 * the heading's, and `pb-0.5` corrects for the display face sitting a hair
 * higher than the body face at these sizes.
 */
export function BandHead({
  label,
  title,
  lede,
  titleClassName,
  className,
}: {
  /** Short uppercase label. Never a number — `01.` reads as a template. */
  label: string;
  title: ReactNode;
  /** Optional paragraph, set beside the heading on a wide viewport. */
  lede?: ReactNode;
  /** Override the heading measure when a title needs a wider column. */
  titleClassName?: string;
  className?: string;
}) {
  return (
    <Grid12 className={cn('items-end gap-y-5', className)}>
      <div className="col-span-12 min-[1280px]:col-span-6">
        <p className="font-mono text-tele-s uppercase ink-faint">{label}</p>
        <h2 className={cn('mt-3 text-display ink', titleClassName ?? 'max-w-[18ch]')}>{title}</h2>
      </div>

      {lede ? (
        <p className="col-span-12 max-w-[46ch] text-body ink-dim min-[1280px]:col-span-4 min-[1280px]:col-start-9 min-[1280px]:max-w-none min-[1280px]:pb-0.5">
          {lede}
        </p>
      ) : null}
    </Grid12>
  );
}
