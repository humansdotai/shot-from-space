import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * THE META PILL — a stamped label, affixed to the file.
 *
 * READOUT D1. What this replaces was four mono strings floating between
 * two hairlines: `MISSION FILE · SHOT.SPACE/M03HA · HANDLING — ROUTINE ·
 * RELEASE — FILE HOLDER`. Nothing held them together, so they read as
 * filler — four fragments the eye skips on its way to the headline.
 *
 * A pill fixes that by being an OBJECT rather than a gap. Three things do
 * the work and all three are load-bearing:
 *
 *   1. IT IS FILLED. The strip stops being type on the page and becomes a
 *      label stuck to it. That is the entire difference between marginalia
 *      and furniture.
 *   2. THE ENDS ARE ROUND. `--radius-pill`, the system's one deliberate
 *      break from 2px — see the radius block in app/globals.css for the
 *      list of components allowed to use it. A stadium reads as a thing
 *      that was cut out and applied; a 2px rectangle reads as another
 *      panel.
 *   3. THE SEGMENTS ARE DIVIDED, NOT SPACED. A 1px rule at 25% between
 *      each pair is what makes four readings one label. Space between
 *      them is what made them four labels.
 *
 * ------------------------------------------------------------------
 * IT INVERTS. It carries no colour of its own.
 * ------------------------------------------------------------------
 * The fill is `--ink` and the text is `--ground` — the exact inverse of
 * whatever band it is dropped into. On the masthead (void) that resolves
 * to a paper pill with dark ink, which is what D1 asks for; inside a
 * `.surface-light` band it resolves to a dark pill with paper ink, which
 * is the same object seen against the other half of the poster. Both ends
 * of that swap are the system's maximum contrast pair (16.99:1), so the
 * label can never land somewhere it fails.
 *
 * No accent anywhere. The accent is a state colour and this is not a
 * state — a file's handling code is true whether or not anything is
 * happening. Status lives in <StatusToken>.
 *
 * ------------------------------------------------------------------
 * AT 390 IT SCROLLS. It does not wrap and it does not drop segments.
 * ------------------------------------------------------------------
 * Three or four segments cannot sit on a 326px line, and the two
 * alternatives are both worse:
 *
 *   · WRAPPING kills the shape. `border-radius: 999px` on a two-line box
 *     is a 64px-tall lozenge with 32px ends — it stops reading as a
 *     stamped label and starts reading as a bubble, and the dividers end
 *     up separating rows rather than segments.
 *   · DROPPING BY PRIORITY loses the release marking on every phone,
 *     which is the one line on the strip that tells a visitor whether
 *     they are holding the file or a share key. It is not decoration.
 *
 * So the pill keeps its single line and the RAIL around it scrolls,
 * exactly as `.tab-row` does below 768 — the same decision, already made
 * once in this system, for the same reason. Below 768 the rail bleeds to
 * the viewport edge with the house escape idiom (`-mx-[var(--gutter-shell)]`
 * plus matching padding), so the pill visibly runs off the screen rather
 * than being clipped at the column edge, which is what tells the reader
 * it continues. From 768 it fits and the scroller never engages.
 *
 * It cannot overflow: the rail is `overflow-x: auto` at every width.
 */

export type MetaSegment = {
  /** The marking's name. Rendered uppercase, dimmed against the fill. */
  label: string;
  /** The reading. Omitted for a segment that is only a name. */
  value?: ReactNode;
  /** Renders the value as a link. */
  href?: string;
};

export function MetaPill({
  segments,
  label,
  className,
}: {
  /** In reading order. Left to right, first is the most identifying. */
  segments: readonly MetaSegment[];
  /** Accessible name for the strip — what these markings are markings OF. */
  label?: string;
  className?: string;
}) {
  if (segments.length === 0) return null;

  return (
    <div
      className={cn(
        /* The scroller. Bleeds to the viewport edge below 768 so a pill
           that continues past the fold looks like it continues; back
           inside the column from 768, where it fits.

           `py-1 -my-1` is head-room for a focus ring: `overflow-x: auto`
           makes this a scroll container on BOTH axes, and without the
           padding a 2px ring at 3px offset would be cut off the top and
           bottom of a linked segment. */
        '-mx-[var(--gutter-shell)] overflow-x-auto px-[var(--gutter-shell)] py-1',
        '-my-1 [overscroll-behavior-x:contain]',
        'md:mx-0 md:px-0',
        /* The rail is an affordance, not a scrollbar. */
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      <dl
        aria-label={label}
        className={cn(
          'file-s inline-flex w-max items-stretch rounded-[var(--radius-pill)]',
          'bg-[color:var(--ink)] text-[color:var(--ground)] uppercase',
        )}
      >
        {segments.map((segment, i) => (
          <Fragment key={segment.label}>
            {i > 0 ? (
              /* The divider. `currentColor` at 25% — the pill's own ink,
                 not a named rule, so it inverts with everything else. */
              <span aria-hidden className="my-2 w-px shrink-0 bg-current opacity-25" />
            ) : null}
            <Segment {...segment} />
          </Fragment>
        ))}
      </dl>
    </div>
  );
}

/**
 * One marking. Name then reading, on one line, never wrapping — the pill
 * scrolls instead.
 *
 * The name is `currentColor` at 70%, which measures 7.21:1 on the paper
 * pill and 8.45:1 on the dark one. Both clear AA at 10px several times
 * over, and the 30% is enough separation that the eye lands on the
 * reading first. The reading itself is the full 16.99:1.
 */
function Segment({ label, value, href }: MetaSegment) {
  const reading =
    href !== undefined ? (
      <a
        href={href}
        className={cn(
          'inline-block -my-2 py-2 underline-offset-4 transition-house',
          'hover:underline focus-visible:underline',
          /* The ring is the pill's own ink. `--focus-ring` follows the
             BAND, so inside an inverted object it would draw the dark
             band's signal orange onto paper at 2.9:1. */
          'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-current',
        )}
      >
        {value}
      </a>
    ) : (
      value
    );

  return (
    <div
      className={cn(
        'flex shrink-0 items-baseline gap-2 py-2 whitespace-nowrap',
        /* 14px between segments, 20px inside the round ends — a stadium
           needs the extra or the first glyph sits on the curve. */
        'px-3.5 first:pl-5 last:pr-5',
      )}
    >
      <dt className="tracking-[0.1em] opacity-70">{label}</dt>
      {value !== undefined ? (
        <dd data-telemetry className="tracking-[0.08em] tabular-nums">
          {reading}
        </dd>
      ) : null}
    </div>
  );
}
