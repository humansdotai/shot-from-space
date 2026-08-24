import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A page band — the structural unit of the shell.
 *
 * ------------------------------------------------------------------
 * RHYTHM
 * ------------------------------------------------------------------
 * Padding comes from five named values only — there is deliberately no
 * uniform section spacer, because uniform padding on every section is
 * the clearest template tell in the audit. Full-bleed bands sit at
 * `flush` and touch their neighbours.
 *
 *   flush  full-bleed media, butts against its neighbour. Always 0.
 *   tight  a band following a full-bleed one
 *   snug   closing padding under a dense band
 *   open   the standard padded content band
 *   footer the footer only
 *
 * The names are fixed; the numbers step with the viewport, because
 * vertical air is half of what makes a large display feel composed
 * rather than merely wide:
 *
 *      width   390   768   1280   1440   1920   2400
 *      tight    20    20     24     24     28     32
 *      snug     32    32     40     40     48     56
 *      open     48    56     64     72     88    104
 *      footer   56    56     64     72     88    104
 *
 * ------------------------------------------------------------------
 * COLUMN VS BLEED
 * ------------------------------------------------------------------
 * A Band is always full width. What it puts inside decides whether the
 * section is a column section or a bleed section, and the alternation
 * between the two is the page's rhythm:
 *
 *   <Band><Container>…            column, capped at 1376px forever
 *   <Band><Container size="flush"> full-bleed; owns its own inset via
 *                                  `.column-bleed` or `bleed-pad`
 *
 * From 1920 a column band may add `className="column-guides"` to draw
 * a hairline on each column edge, stating the margin instead of
 * leaving it as dead space. The Band is already `relative`, which is
 * all that utility needs.
 */
export type BandRhythm = 'flush' | 'tight' | 'snug' | 'open' | 'footer';

/**
 * The ground. The page alternates dark and light roughly half and half —
 * imagery and film in the dark, specification and proof on the paper —
 * which is the poster's construction applied to a scroll.
 *
 * `tone` sets `--ground` / `--ink` for everything inside, so buttons,
 * rules and secondary text invert with the band and not one at a time.
 * Omit it to inherit the enclosing ground.
 */
export type BandTone = 'dark' | 'light';

const TONE: Record<BandTone, string> = {
  dark: 'surface-dark',
  light: 'surface-light',
};

const PT: Record<BandRhythm, string> = {
  flush: 'pt-0',
  tight: 'pt-[var(--band-tight)]',
  snug: 'pt-[var(--band-snug)]',
  open: 'pt-[var(--band-open)]',
  footer: 'pt-[var(--band-footer)]',
};

const PB: Record<BandRhythm, string> = {
  flush: 'pb-0',
  tight: 'pb-[var(--band-tight)]',
  snug: 'pb-[var(--band-snug)]',
  open: 'pb-[var(--band-open)]',
  footer: 'pb-[var(--band-footer)]',
};

export function Band({
  children,
  top = 'open',
  bottom = 'open',
  tone,
  className,
  id,
  as: Tag = 'section',
}: {
  children: ReactNode;
  top?: BandRhythm;
  bottom?: BandRhythm;
  /** Sets the ground for everything inside. Omit to inherit. */
  tone?: BandTone;
  className?: string;
  id?: string;
  as?: 'section' | 'div' | 'article' | 'footer';
}) {
  return (
    <Tag
      id={id}
      className={cn(
        'relative w-full',
        tone ? TONE[tone] : undefined,
        PT[top],
        PB[bottom],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
