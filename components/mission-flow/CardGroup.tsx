'use client';

import { useRef, type ReactNode } from 'react';
import { clsx as cn } from 'clsx';
import { markFor, type Mark } from '@/components/fui/icons';
import { CURVE, INK, INK_DIM, RULE } from '@/components/purchase/fields';

/**
 * One option in a <CardGroup />.
 *
 * The four slots exist so that a card has a REAL HIERARCHY rather than a
 * paragraph of text with a number on the end of it:
 *
 *   tag        a single marker above everything — `Most popular`
 *   icon       WHAT KIND of thing it is — a type mark beside the name
 *   label      WHAT IT IS. The largest thing on the card. Sans, 500.
 *   note       WHY it is that. Sentence case, dim, one or two lines.
 *   aside      WHAT IT COSTS, or what it measures. Labelled by
 *              `asideLabel`, right column, tabular, never wrapping.
 *   specs      the readings, ruled, under a divider — the same
 *              label/value anatomy <FieldTable /> uses, so a card and a
 *              readout are visibly the same system.
 *
 * `asideLabel` is what turns `€279` from a floating number into a
 * labelled field. Pass it whenever the aside is not self-evident.
 */
export interface CardOption<T extends string> {
  value: T;
  label: string;
  /** One or two lines under the label. Sentence case. */
  note?: ReactNode;
  /** A value on the right: a price, a size, a date. */
  aside?: ReactNode;
  /** Names the aside. `Price`, `From`, `Commit by`. Two words at most. */
  asideLabel?: string;
  /** A single short marker above the label, e.g. `Most popular`. */
  tag?: string;
  /** Ruled readings inside the card, under a divider. Three at most. */
  specs?: readonly { label: string; value: ReactNode; icon?: Mark | null }[];
  /**
   * A type mark beside the option's name — what KIND of thing this
   * option is, where two options in a group are different kinds and not
   * merely different values. `Archive` is an existing frame, `Commission`
   * is a frame that will be taken: one mark each says that before the
   * paragraph under it does. Left off, the option's label is looked up
   * in the dictionary; `null` suppresses it.
   */
  icon?: Mark | null;
  /** An option that exists but cannot be taken, with the reason. */
  disabled?: boolean;
}

/**
 * THE CHOICE CONTROL — the only multi-choice card control in this flow.
 *
 * ==================================================================
 * ANATOMY
 * ==================================================================
 *   ┌──────────────────────────────────────────────┐
 *   │ ▢   MOST POPULAR                       PRICE │
 *   │     Commission                          €279 │
 *   │     A new frame, tasked over your…           │
 *   │     ──────────────────────────────────────── │
 *   │     LEAD TIME  14–21 D    RESOLUTION  50 CM  │
 *   └──────────────────────────────────────────────┘
 *
 * Three columns: the selection mark, the option, the labelled aside.
 * The mark is a square rather than a disc because every other state
 * mark in this system is a square, and because a bare border tint is
 * not a state — a control that is chosen has to show it without
 * relying on colour alone (WCAG 1.4.1).
 *
 * SELECTION is a ground swap AND a filled mark, not a tint: the chosen
 * card takes the ink as its background and the ground as its type, so
 * it inverts correctly on the dark panel and on paper alike.
 *
 * HOVER takes the border to FULL INK, washes the ground 6% and half
 * fills the selection mark. It used to lift the border to
 * `--rule-strong` and nothing else, which against a `--rule` border is
 * a 12% change in a hairline: on a black panel a buyer could not tell a
 * card apart from a heading, and could not tell that either was
 * something to press. The hover state now previews the SELECTED state —
 * the mark starts filling and the border reaches the colour it will
 * have — so what the pointer is offering is legible before the tap.
 * FOCUS is the global `:focus-visible` ring — 2px of the accent, offset
 * 2px, never removed. Both are switched off under
 * `prefers-reduced-motion` only in their transition, never in their
 * appearance: a hover you cannot see is not a reduced motion, it is a
 * missing affordance.
 *
 * SEMANTICS. A real `radiogroup`: one tab stop for the whole group,
 * arrow keys move between options, Home and End jump to the ends, and
 * Space or Enter selects. That is the WAI-ARIA radio group pattern
 * rather than an approximation of it, which matters here because these
 * cards ARE the form.
 *
 * A tap is the answer: `onSelect` both records the choice and, where
 * the section wires it that way, advances — so there is no Next button
 * on a group that is a choice. Typing has no such moment of commitment,
 * which is why the text sections keep one.
 */
export function CardGroup<T extends string>({
  label,
  options,
  value,
  onSelect,
  columns = 1,
}: {
  /** Names the group for assistive technology. Usually the group's question. */
  label: string;
  options: readonly CardOption<T>[];
  value: T | null;
  onSelect: (value: T) => void;
  /** Two-up from `sm` when the options are short. */
  columns?: 1 | 2;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectable = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  // Roving tabindex: the checked option is the tab stop, or the first
  // selectable one when nothing is checked — never all of them, never none.
  const checkedIndex = options.findIndex((o) => o.value === value);
  const activeIndex = checkedIndex >= 0 ? checkedIndex : (selectable[0] ?? 0);

  const move = (from: number, delta: number) => {
    if (selectable.length === 0) return;
    const at = selectable.indexOf(from);
    const next =
      selectable[
        ((((at === -1 ? 0 : at) + delta) % selectable.length) + selectable.length) %
          selectable.length
      ];
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid gap-2', columns === 2 && 'sm:grid-cols-2')}
    >
      {options.map((option, i) => {
        const checked = option.value === value;
        const off = Boolean(option.disabled);

        /* On a chosen card the ground and the ink have swapped, so every
           tone inside it is expressed against `--ground`. Mixing toward
           `--ink` rather than using a flat opacity keeps the dim tones
           legible on both grounds. */
        const dim = checked
          ? 'text-[color:color-mix(in_srgb,var(--ground)_72%,var(--ink))]'
          : INK_DIM;
        const faint = checked
          ? 'text-[color:color-mix(in_srgb,var(--ground)_58%,var(--ink))]'
          : 'text-[color:var(--ink-faint)]';
        const hairline = checked
          ? 'border-[color:color-mix(in_srgb,var(--ground)_35%,transparent)]'
          : RULE;

        // Same rule as every other mark in the product: the dictionary
        // decides unless the caller overrode it, and an option whose name
        // is not a kind of thing gets nothing.
        const OptionMark = option.icon === undefined ? markFor(option.label) : option.icon;

        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={off || undefined}
            tabIndex={i === activeIndex ? 0 : -1}
            onClick={() => {
              if (!off) onSelect(option.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                move(i, -1);
              } else if (e.key === 'Home') {
                e.preventDefault();
                refs.current[selectable[0] ?? 0]?.focus();
              } else if (e.key === 'End') {
                e.preventDefault();
                refs.current[selectable[selectable.length - 1] ?? 0]?.focus();
              }
            }}
            className={cn(
              'group grid min-h-14 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start',
              'gap-x-3.5 border px-4 py-3 text-left transition-house',
              CURVE,
              checked
                ? 'border-[color:var(--ink)] bg-[color:var(--ink)]'
                : off
                  ? cn(RULE, 'cursor-not-allowed opacity-55')
                  : cn(
                      RULE,
                      'hover:border-[color:var(--ink)]',
                      'hover:bg-[color:color-mix(in_srgb,var(--ink)_6%,transparent)]',
                    ),
            )}
          >
            {/* --- The mark -------------------------------------------- */}
            <span
              aria-hidden
              className={cn(
                'mt-[0.3rem] flex size-3 shrink-0 items-center justify-center border transition-house',
                checked
                  ? 'border-[color:var(--ground)] bg-[color:var(--ground)]'
                  : cn(
                      'border-[color:var(--rule-strong)]',
                      !off && 'group-hover:border-[color:var(--ink)]',
                    ),
              )}
            >
              {/* The hover fill. A square inside the square, at half the
                  edge: the same shape the checked state reaches, caught
                  half way there. Nothing at rest, so an untouched group
                  shows six empty marks and not six half-chosen ones. */}
              {!checked && !off ? (
                <span className="size-1.5 scale-0 bg-[color:var(--ink)] transition-house group-hover:scale-100" />
              ) : null}
            </span>

            {/* --- The option ------------------------------------------ */}
            <span className="min-w-0">
              {option.tag ? (
                <span
                  className={cn(
                    'mb-1.5 inline-block border px-1.5 py-0.5 font-mono text-tele-xs uppercase',
                    checked
                      ? 'border-[color:color-mix(in_srgb,var(--ground)_45%,transparent)] text-[color:var(--ground)]'
                      // 70%, matching <PanelTag />: one accent outline
                      // strength on the panel, and 3.31:1 against the
                      // ground rather than the 2.43:1 that 45% measured.
                      : 'border-[color:color-mix(in_srgb,var(--accent)_70%,transparent)] text-[color:var(--accent)]',
                  )}
                >
                  {option.tag}
                </span>
              ) : null}

              <span
                className={cn(
                  'flex items-center gap-2 text-action',
                  checked ? 'text-[color:var(--ground)]' : INK,
                )}
              >
                {OptionMark ? (
                  <span
                    aria-hidden
                    className={cn('shrink-0 transition-house', checked ? 'text-[color:var(--ground)]' : faint)}
                  >
                    <OptionMark size={16} />
                  </span>
                ) : null}
                <span className="min-w-0">{option.label}</span>
              </span>

              {option.note ? (
                <span className={cn('block pt-1 text-note', dim)}>{option.note}</span>
              ) : null}

              {option.specs && option.specs.length > 0 ? (
                <span
                  className={cn(
                    'mt-2.5 grid grid-cols-[minmax(4.5rem,auto)_minmax(0,1fr)] border-t',
                    hairline,
                  )}
                >
                  {option.specs.map((spec) => {
                    const SpecMark = spec.icon === undefined ? markFor(spec.label) : spec.icon;
                    return (
                    <span key={spec.label} className="contents">
                      <span className={cn('border-b py-1 pr-3', hairline)}>
                        <span className={cn('flex items-center gap-1.5 font-mono text-tele-s uppercase', faint)}>
                          {SpecMark ? <SpecMark size={11} /> : null}
                          {spec.label}
                        </span>
                      </span>
                      <span className={cn('min-w-0 border-b py-1', hairline)}>
                        <span
                          data-telemetry
                          className={cn(
                            'block font-mono text-tele-s uppercase break-words',
                            checked ? 'text-[color:var(--ground)]' : INK,
                          )}
                        >
                          {spec.value}
                        </span>
                      </span>
                    </span>
                    );
                  })}
                </span>
              ) : null}
            </span>

            {/* --- The labelled aside ---------------------------------- */}
            {option.aside ? (
              <span className="flex shrink-0 flex-col items-end gap-1 text-right">
                {option.asideLabel ? (
                  <span className={cn('font-mono text-tele-xs uppercase', faint)}>
                    {option.asideLabel}
                  </span>
                ) : null}
                <span
                  data-telemetry
                  className={cn(
                    'text-action tabular-nums whitespace-nowrap',
                    checked ? 'text-[color:var(--ground)]' : INK,
                  )}
                >
                  {option.aside}
                </span>
              </span>
            ) : (
              <span aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}
