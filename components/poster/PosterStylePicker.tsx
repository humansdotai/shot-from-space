'use client';

import { useRef } from 'react';
import { CURVE, INK, INK_DIM, RULE } from '@/components/purchase/fields';
import {
  POSTER_STYLES,
  getPosterStyle,
  imageShareOf,
  type PosterStyleId,
} from '@/lib/poster/styles';
import type { FormatId, FrameOption } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StyledPoster, type PosterSubject } from './StyledPoster';

/**
 * ==================================================================
 * THE DESIGN CHOICE — how the buyer's print is composed.
 * ==================================================================
 *
 * Four compositions from `lib/poster/styles.ts`, each drawn as a miniature of
 * itself at the proportion of the format the buyer has actually chosen. The
 * thumbnails are not illustrations of the options: they are
 * <StyledPoster detail="thumb" />, the same component and the same geometry as
 * the big preview, so a card cannot show a division the print does not have.
 * Change the format from 30 × 40 to 70 × 100 and all four cards change shape.
 *
 * ------------------------------------------------------------------
 * SEMANTICS
 * ------------------------------------------------------------------
 * A real WAI-ARIA radio group, the same pattern
 * `components/mission-flow/CardGroup.tsx` implements and for the same reason:
 * these cards ARE the control. One tab stop for the whole group (roving
 * tabindex on the checked option, or the first when nothing is checked yet),
 * Left/Right/Up/Down to move, Home and End to the ends, Space or Enter to
 * select — a `<button>` fires `click` on both, so no key handler is needed
 * for the selection itself.
 *
 * Selection is a ground swap rather than a tint, so it survives being mounted
 * on a dark panel and on a paper one alike.
 *
 * ------------------------------------------------------------------
 * WHAT MAY BE OFFERED
 * ------------------------------------------------------------------
 * `available` restricts the group to a subset. A surface that must not take
 * money for a file the composer cannot yet lay out passes
 * `COMPOSABLE_STYLE_IDS` — see the honesty note at the head of
 * lib/poster/styles.ts. Passing nothing offers the whole catalogue, which is
 * correct for a design surface and wrong for a checkout that has not had that
 * conversation.
 */
export function PosterStylePicker({
  value,
  onChange,
  formatId,
  frame = 'UNFRAMED',
  subject,
  image,
  available,
  label = 'Poster style',
  className,
}: {
  value: PosterStyleId | null;
  onChange: (id: PosterStyleId) => void;
  /** The format the buyer chose. The thumbnails take its proportion. */
  formatId: FormatId;
  /** Only used to keep the miniature's caption honest — see `finish` below. */
  frame?: FrameOption;
  subject: PosterSubject;
  image: { src: string; unoptimized?: boolean };
  /** Subset of `POSTER_STYLE_IDS` to offer. Defaults to all of them. */
  available?: readonly PosterStyleId[];
  /** Names the group for assistive technology. */
  label?: string;
  className?: string;
}) {
  const options = available
    ? POSTER_STYLES.filter((s) => available.includes(s.id))
    : POSTER_STYLES;

  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Roving tabindex: the checked option is the tab stop, or the first one when
  // nothing is checked — never all of them and never none.
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );

  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length;
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid grid-cols-2 gap-3', className)}
    >
      {options.map((option, i) => {
        const checked = option.id === value;
        // Stated, not estimated: the share of the sheet the picture occupies,
        // computed off the same rectangles the miniature is drawn from.
        const share = Math.round(imageShareOf(option.id, formatId) * 100);

        return (
          <button
            key={option.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === activeIndex ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                move(i, -1);
              } else if (e.key === 'Home') {
                e.preventDefault();
                refs.current[0]?.focus();
              } else if (e.key === 'End') {
                e.preventDefault();
                refs.current[options.length - 1]?.focus();
              }
            }}
            className={cn(
              // `items-stretch` is not decoration: a <button> laid out as a
              // flex container is centre-aligned by the UA sheet, and the
              // miniature's children are all absolutely positioned, so it has
              // no intrinsic width to be centred at — it collapses to nothing.
              // min-h-44px is the floor; the card is far taller in practice.
              'group flex min-h-[44px] w-full flex-col items-stretch gap-3 border p-3 text-left transition-house',
              CURVE,
              checked
                ? 'border-[color:var(--ink)] bg-[color:var(--ink)]'
                : cn(
                    RULE,
                    'hover:border-[color:var(--rule-strong)] hover:bg-[color:color-mix(in_srgb,var(--ink)_5%,transparent)]',
                  ),
            )}
          >
            {/* The miniature. `aria-hidden` because everything it depicts is
                said in words underneath it — a screen reader gets the name,
                the division and the frame share, not "image". */}
            <span aria-hidden className="block w-full">
              <StyledPoster
                styleId={option.id}
                formatId={formatId}
                frame="UNFRAMED"
                detail="thumb"
                subject={subject}
                image={{ src: image.src, unoptimized: image.unoptimized, sizes: '200px' }}
                className="w-full"
              />
            </span>

            <span className="block min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span
                  /* The name wraps rather than truncating: at a 358 px panel
                     two-up, `Mounted plate` beside its designation does not
                     fit on one line, and a style called `Mounted ...` is a
                     style the buyer cannot tell apart from another. */
                  className={cn(
                    'min-w-0 text-action',
                    checked ? 'text-[color:var(--ground)]' : INK,
                  )}
                >
                  {option.name}
                </span>
                <span
                  data-telemetry
                  className={cn(
                    'shrink-0 font-mono text-tele-xs uppercase',
                    checked
                      ? 'text-[color:color-mix(in_srgb,var(--ground)_65%,var(--ink))]'
                      : 'ink-faint',
                  )}
                >
                  {option.designation}
                </span>
              </span>

              <span
                className={cn(
                  'mt-1 block text-note',
                  checked
                    ? 'text-[color:color-mix(in_srgb,var(--ground)_72%,var(--ink))]'
                    : INK_DIM,
                )}
              >
                {option.summary}
              </span>

              <span
                className={cn(
                  'mt-2 block font-mono text-tele-xs uppercase',
                  checked
                    ? 'text-[color:color-mix(in_srgb,var(--ground)_60%,var(--ink))]'
                    : 'ink-faint',
                )}
              >
                Frame <span data-telemetry>{share}%</span> of the sheet
                {frame === 'FRAMED' ? ' — framed' : null}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The note that belongs beside the group.
 *
 * Exported rather than rendered inside it, because the surface mounting the
 * picker owns its own copy rhythm — but the sentence itself is not the
 * surface's to write. It states the one thing a buyer could otherwise get
 * wrong: the style changes the artwork, never the product ordered, so the
 * price does not move with it.
 */
export function posterStyleNote(id: PosterStyleId): string {
  return getPosterStyle(id).note;
}
