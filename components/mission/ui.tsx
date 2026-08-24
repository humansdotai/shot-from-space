'use client';

import { clsx as cn } from 'clsx';
import type { ReactNode } from 'react';
import { useValueFlash } from '@/components/interior/value-flash';
import { META_GRID, RULE_STACK } from './layout';

/**
 * MISSION FILE — the small vocabulary the file is written in.
 *
 * Two things make this its own kit rather than a re-use of the FUI
 * primitives. First, the file alternates ground: the header and the exhibit
 * sit on void, the timeline and the specification on paper, so every atom
 * here reads `--ink` / `--rule` / `--accent` and renders correctly on both.
 * Second, the monospace budget has been cut hard — the mono face is now spent
 * on coordinates, timestamps, mission codes and elapsed times and on nothing
 * else. Labels and headings are sans, which is what makes the file read as a
 * premium account area rather than a terminal.
 *
 * (`clsx`, not `cn`: tailwind-merge has no entry for this project's font-size
 * roles, so it treats `text-heading` as a text COLOUR and silently drops it
 * when a colour class is merged alongside. Joining is all this kit needs.)
 */

/* --- Ground-following ink and rules --------------------------------- */

export const INK = 'text-[color:var(--ink)]';
export const INK_DIM = 'text-[color:var(--ink-dim)]';
export const INK_FAINT = 'text-[color:var(--ink-faint)]';
export const ACCENT = 'text-[color:var(--accent)]';
export const RULE = 'border-[color:var(--rule)]';

/* ------------------------------------------------------------------ */
/* Section head                                                        */
/* ------------------------------------------------------------------ */

/**
 * The head of a band. A quiet uppercase label, the heading under it, and one
 * meta value opposite. No `01.` — the numbered spine is gone from this
 * product; a section is identified by what it is called.
 */
export function SectionHead({
  label,
  title,
  meta,
  id,
  className,
}: {
  label: string;
  title: ReactNode;
  meta?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div id={id} className={cn('border-t pt-5', RULE, className)}>
      <p className="file-s file-label">{label}</p>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <h2 className={cn('text-heading', INK)}>{title}</h2>
        {meta ? (
          <span data-telemetry className="file-s file-label">
            {meta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Readout row                                                         */
/* ------------------------------------------------------------------ */

/**
 * Label left, value right, a dotted lead between them that shrinks before the
 * value does — a long value wraps under its own label instead of pushing the
 * row into a horizontal scroll at 390px.
 *
 * `mono` is opt-in and means the value is an instrument reading: a
 * coordinate, a timestamp, a mission code, an elapsed time. Everything else
 * is set in the sans action role.
 */
export function Row({
  label,
  value,
  tone = 'strong',
  mono = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'strong' | 'dim' | 'accent';
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline gap-3 py-2.5', className)}>
      <dt className="file-s file-label shrink-0">{label}</dt>
      <span
        aria-hidden
        className={cn('min-w-3 flex-1 shrink translate-y-[-3px] border-b border-dotted', RULE)}
      />
      <dd
        data-telemetry
        className={cn(
          'min-w-0 max-w-[68%] text-right break-words tabular-nums',
          mono ? 'file' : 'text-body',
          tone === 'accent' ? ACCENT : tone === 'dim' ? INK_DIM : INK,
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** A group of rows under a title. Used by the specification band. */
export function RowGroup({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col', className)}>
      <h3 className="file-s file-label">{title}</h3>
      <dl className={cn('mt-4 flex flex-col border-t pt-1', RULE)}>{children}</dl>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export type MissionChipState = 'done' | 'active' | 'pending' | 'alert';

/**
 * Status pill. The accent follows the ground — `--accent` is the darker
 * signal inside a light band, where the orange on its own only reaches 2.8:1
 * against paper.
 */
export function Chip({
  label,
  state = 'pending',
  className,
}: {
  label: string;
  state?: MissionChipState;
  className?: string;
}) {
  const live = state === 'active' || state === 'alert';
  return (
    <span
      className={cn(
        'file-s inline-flex items-center gap-2.5 rounded-[6px] border px-2.5 py-1.5 uppercase leading-none tracking-[0.1em]',
        live
          ? 'border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] text-[color:var(--accent)]'
          : state === 'done'
            ? cn(RULE, INK_DIM)
            : cn(RULE, INK_FAINT),
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          live
            ? cn('bg-[color:var(--accent)]', state === 'active' && 'animate-signal-pulse')
            : state === 'done'
              ? 'bg-[color:var(--ink-dim)]'
              : 'border border-[color:var(--ink-faint)]',
        )}
      />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Live values                                                         */
/* ------------------------------------------------------------------ */

/**
 * A reading that changes under the reader while the file polls.
 *
 * Built on `useValueFlash` from components/interior (MIT, vendored) — the
 * headless hook is kept exactly as authored and only the styled layer is
 * ours, which is the reskinning path that library is designed for. The
 * library's own styled component is not used: it flashes emerald and red,
 * and this product has one accent.
 *
 * The flash is a hairline that draws itself under the value and fades, plus
 * the value going to the accent for the hold. Nothing moves, nothing bounces,
 * and under reduced motion the CSS transition collapses to nothing while the
 * colour change still carries the message.
 */
export function LiveValue({
  value,
  mono = false,
  className,
}: {
  /** Rendered as text. Any change to it flashes. */
  value: string;
  mono?: boolean;
  className?: string;
}) {
  const { flashing } = useValueFlash(value, {
    hold: 1600,
    compare: (next, prev) => (next === prev ? 0 : 1),
  });

  return (
    <span
      data-telemetry
      className={cn(
        'relative inline-block tabular-nums transition-house',
        mono ? 'file' : 'text-body',
        flashing ? ACCENT : undefined,
        className,
      )}
    >
      {value}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 -bottom-1 h-px origin-right bg-[color:var(--accent)] transition-transform duration-house ease-house',
          flashing ? 'scale-x-100' : 'scale-x-0',
        )}
      />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

/**
 * The code's own ramp. Ductile has a cap-height of 875/1000 — nearly 20%
 * taller on the page than Inter at the same px — so the lockup is stated at
 * its own sizes rather than borrowing a text role, and it steps at the
 * system's own breakpoints rather than interpolating on `vw`.
 *
 *   sm   13 / 13 / 14 / 14 / 15 / 16   inline, in a rail or a tag
 *   md   17 / 18 / 20 / 20 / 22 / 24   the standing reference
 *   lg   26 / 32 / 38 / 40 / 46 / 52   the file's identity block
 */
const REF_SIZE = {
  sm: 'text-[0.8125rem] xl:text-[0.875rem] xl2:text-[0.9375rem] xl3:text-[1rem] tracking-[0.06em]',
  md: 'text-[1.0625rem] md:text-[1.125rem] xl:text-[1.25rem] xl2:text-[1.375rem] xl3:text-[1.5rem] tracking-[0.04em]',
  lg: 'text-[1.625rem] md:text-[2rem] xl:text-[2.375rem] 2xl:text-[2.5rem] xl2:text-[2.875rem] xl3:text-[3.25rem] tracking-[0.02em]',
} as const;

/**
 * `MISSION / 32BF`. Never a logo, always a record.
 *
 * The two halves are set in the two mission faces and that is the whole
 * idea of the lockup: the WORD is a label and takes Typestar at the detail
 * ramp's small size, the CODE is display and takes Ductile. A mission code is
 * read character by character, so it is the one string on the page that earns
 * a face of its own.
 *
 * Ductile is caps-only; `.mission-lockup` uppercases at the class, and the
 * code is uppercased again here because the value comes from the database.
 */
export function MissionRef({
  code,
  size = 'md',
  className,
}: {
  code: string;
  size?: keyof typeof REF_SIZE;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-baseline gap-2.5', className)}>
      <span className="file-s file-label shrink-0">MISSION /</span>
      <span data-telemetry className={cn('mission-lockup', REF_SIZE[size], INK)}>
        {code.toUpperCase()}
      </span>
    </span>
  );
}

/* ==================================================================== */
/* THE DOCUMENT SKELETON                                                 */
/* ==================================================================== */
/**
 * Seven pieces, one skeleton. Everything above this line is the file's
 * atoms — a row, a chip, a code — and everything below it is the page's
 * STRUCTURE: the shape the reference pages share, which is a document with
 * margins rather than a dashboard with cards.
 *
 * The shape, in order:
 *
 *   <FileHead>     a large display headline, top-left, with a great deal of
 *                  air under it before anything else starts
 *   <MetaRow>      a narrow column of small uppercase labels against a wider
 *                  column of running text, on a shared baseline
 *   <RuleRow>      stacked data rows separated by 1px rules — label above
 *                  value, value the plainer of the two
 *   <DocPanel>     printed or archived content: paper ground, dark ink, a cut
 *                  top-right corner
 *   <SectionTabs>  parallel views, on a full-width rule, the active one
 *                  underlined
 *   <IndexPair>    `01 / 04`, very small
 *   <BigNumeral>   the section number as a graphic element
 *
 * All seven read `--ink` / `--rule` / `--accent` rather than naming a colour,
 * so each of them renders on either half of the poster. All seven are set in
 * the two mission faces — Ductile for display, Typestar for detail — and none
 * of them sets a size in pixels: the sizes are tokens (`--text-file`,
 * `--text-mission-title`, `--file-head-air`, `--file-section-gap`) and they
 * step at 768 / 1280 / 1440 / 1920 / 2400.
 */

/* Detail-type class strings. Exported because the surrounding components use
   the same three sizes for their own strings and a second spelling of
   `file-s file-label` in four files is four places to get it wrong. */

/** 11px Typestar. Readings, running detail, sequence rows. Inherits ink. */
export const FILE = 'file';
/** 10px Typestar. Labels, column heads, tags. Inherits ink. */
export const FILE_S = 'file-s';
/** 9px Typestar. Index pairs and corner marks only — pinned to `--ink-dim`. */
export const FILE_XS = 'file-xs';
/** The label modifier: uppercase, extra tracking, `--ink-dim`. */
export const FILE_LABEL = 'file-label';

/* ------------------------------------------------------------------ */
/* File head                                                           */
/* ------------------------------------------------------------------ */

/**
 * THE HEADLINE BLOCK. One large display line, set top-left, and then
 * nothing — `--file-head-air` of nothing, 48px at 390 and 152px at 2400,
 * which is the largest gap on the page and is what makes the rest of it read
 * as a document.
 *
 * The headline is Ductile and therefore CAPS: `.mission-title` uppercases it
 * at the class, because the face has no lowercase and a stray lowercase
 * letter would fall through to Inter in the middle of the word.
 *
 * `eyebrow` is a short uppercase label above the line. `index` is an
 * `01 / 04` pair set opposite it at the top right, which is where the
 * reference pages put a position marker. Both are optional and the head is
 * correct without either.
 *
 * The air is a margin on the header, not a padding on what follows, so a
 * surface can drop the head and keep its own spacing by passing `flush`.
 */
export function FileHead({
  eyebrow,
  title,
  index,
  as: Tag = 'h1',
  flush = false,
  id,
  className,
}: {
  /** Short uppercase label above the line. 2–4 words. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** `[current, total]` — rendered as `01 / 04` at the top right. */
  index?: [number, number];
  as?: 'h1' | 'h2';
  /** Drop the head's own bottom air; the caller is spacing it. */
  flush?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <header
      id={id}
      className={cn('flex flex-col', !flush && 'mb-[var(--file-head-air)]', className)}
    >
      {eyebrow || index ? (
        <div className="flex items-start justify-between gap-6 pb-5">
          {eyebrow ? <p className={cn(FILE_S, FILE_LABEL)}>{eyebrow}</p> : <span />}
          {index ? <IndexPair index={index[0]} total={index[1]} /> : null}
        </div>
      ) : null}

      {/* The line cap is in `ch` so it holds as the title steps 28 → 78
          across six widths — but NOT at 390, where 16ch of Ductile is
          already wider than the whole column and the cap would do nothing
          except invite an overflow. Below 768 the column is the cap.

          16ch of Ductile is ~16.3em, which lands a two-line headline at
          768, 1280 and 1440 and hands the job to the 1376px column above
          that. It is wider than it looks written down: this face is 38%
          wider per character than the site grotesk. */}
      <Tag className={cn('mission-title max-w-full md:max-w-[16ch]', INK)}>{title}</Tag>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Meta row                                                            */
/* ------------------------------------------------------------------ */

/**
 * THE TWO-COLUMN META ROW. A narrow left column carrying a small uppercase
 * label of two or three words — which is expected to wrap to two lines and is
 * given the leading to do it — and a wider right column of running text
 * starting on the same baseline.
 *
 * Both columns are set SMALL. That is the whole effect: a pair of columns at
 * 10px and 11px reads as a document's marginalia, and the same pair at 13px
 * and 16px reads as a web page's feature list.
 *
 * At 390 the pair stacks, label over text, because a 8.5rem column against a
 * 6rem remainder is not a pair, it is a collision. From 768 it is a real
 * two-column row and the baselines line up.
 *
 * Stack several inside a <MetaGroup> to get a block of them on one grid.
 */
export function MetaRow({
  label,
  children,
  tone = 'dim',
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  /** Ink for the running column. `dim` is the document default. */
  tone?: 'strong' | 'dim';
  className?: string;
}) {
  return (
    <div className={cn(META_GRID, className)}>
      <p className={cn(FILE_S, FILE_LABEL, 'md:text-balance')}>{label}</p>
      <div className={cn(FILE, 'max-w-[var(--measure-wide)]', tone === 'strong' ? INK : INK_DIM)}>
        {children}
      </div>
    </div>
  );
}

/** A block of meta rows, ruled off from what precedes it. */
export function MetaGroup({
  children,
  ruled = true,
  className,
}: {
  children: ReactNode;
  /** A 1px rule above the block. On by default. */
  ruled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-[calc(var(--file-row-gap)*1.6)]',
        ruled && cn('border-t pt-6', RULE),
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ruled data row                                                      */
/* ------------------------------------------------------------------ */

/**
 * THE RULED DATA ROW. A 1px rule, the label under it, the value under that.
 * Not a dotted-leader table — `<Row />` above is the leader version and it
 * still exists for the surfaces that use it, but a leader is a price list and
 * this is a record.
 *
 * Label above value, and the value is the PLAINER of the two: the label is
 * uppercase, tracked and dim, the value is untracked and full ink. Typestar
 * ships one weight, so the difference is carried the way a printed form
 * carries it, by marking the label rather than by bolding the value. Set it
 * the other way round and the block reads as something to fill in.
 *
 * `mono` is the default here, unlike `<Row />` — everything in a ruled stack
 * is a reading. Pass `sans` for a value that is a phrase rather than a
 * figure.
 */
export function RuleRow({
  label,
  value,
  note,
  tone = 'strong',
  sans = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  /** An optional second line under the value, smaller and dimmer. */
  note?: ReactNode;
  tone?: 'strong' | 'dim' | 'accent';
  /** Set the value in the sans face — for a phrase, not a reading. */
  sans?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rule-row', className)}>
      <dt className={cn(FILE_S, FILE_LABEL)}>{label}</dt>
      <dd
        data-telemetry
        className={cn(
          'min-w-0 break-words',
          sans ? cn('text-body', INK) : FILE,
          tone === 'accent' ? ACCENT : tone === 'dim' ? INK_DIM : INK,
        )}
      >
        {value}
        {note ? <span className={cn('mt-1 block', FILE_XS)}>{note}</span> : null}
      </dd>
    </div>
  );
}

/**
 * A stack of ruled rows. Bounded top and bottom by the rows' own rules, so it
 * needs no border of its own and no box. Renders a `<dl>` because that is
 * what a stack of label/value pairs is.
 */
export function RuleStack({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn(RULE_STACK, className)}>{children}</dl>;
}

/* ------------------------------------------------------------------ */
/* Document panel                                                      */
/* ------------------------------------------------------------------ */

/**
 * THE DOCUMENT PANEL. Paper ground, dark ink, and a cut top-right corner —
 * the angled corner of a physical file. For printed or archived content: the
 * print record, the receipt, the declassified sheet.
 *
 * The corner is a `clip-path`, so the band behind the panel shows through the
 * cut rather than a fill being painted over it. That is what lets the panel
 * sit on a photograph and still read as a cut rather than as a triangle.
 *
 * It carries `.surface-light` as well as `.doc-panel`, which is what supplies
 * `--ground` / `--ink` / `--rule` to everything inside it — so a <RuleRow />
 * or a <Chip /> dropped in inverts with no prop.
 *
 * `title` and `tag` compose the panel's own head: the title at the left, a
 * small tag opposite it, and the pair padded clear of the cut so a long tag
 * can never run under the missing corner.
 */
export function DocPanel({
  title,
  tag,
  children,
  as: Tag = 'section',
  className,
}: {
  /** The panel's head, set as a small uppercase label. */
  title?: ReactNode;
  /** A file tag opposite the title — a code, a date, a state. */
  tag?: ReactNode;
  children: ReactNode;
  as?: 'section' | 'article' | 'div' | 'aside';
  className?: string;
}) {
  return (
    <Tag className={cn('doc-panel surface-light', className)}>
      {title || tag ? (
        <div
          className={cn(
            'doc-panel-clear mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b pb-3',
            RULE,
          )}
        >
          {title ? <h3 className={cn(FILE_S, 'file-label-strong')}>{title}</h3> : <span />}
          {tag ? (
            <span data-telemetry className={cn(FILE_S, FILE_LABEL)}>
              {tag}
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Section tabs                                                        */
/* ------------------------------------------------------------------ */

export type SectionTab = {
  id: string;
  label: string;
  /** Render the tab as a link. Without it the tab is a button. */
  href?: string;
};

/**
 * PARALLEL VIEWS. A horizontal row of labels on a full-width 1px rule, the
 * active one carrying its own 1px underline that sits on that rule. No pill,
 * no fill, no rounded background — the underline is the entire state, which
 * is what keeps a set of tabs looking like a document's contents rather than
 * a segmented control.
 *
 * Links and buttons both: pass `href` on the items for a routed set of views
 * (`?view=`), or `onSelect` for a set that switches in place. A row of links
 * renders `aria-current="page"`; a row of buttons renders a real `tablist`
 * with `aria-selected`, and the CSS keys off either.
 *
 * The row does not WRAP. Below 768 it scrolls horizontally instead, because a
 * wrapped row leaves the full-width rule under the last line and the active
 * underline floating in the middle of the block — which is exactly what four
 * two-word tabs do at 390px. The rail/row split in the CSS is what lets the
 * underline sit ON the rule while the row scrolls; see `.tab-rail`.
 *
 * Each tab is 44px tall, which is the touch target on every width. The
 * underline sits at the bottom of that box, so the padding buys the target
 * without moving the rule.
 */
export function SectionTabs({
  tabs,
  active,
  onSelect,
  label,
  className,
}: {
  tabs: readonly SectionTab[];
  /** `id` of the active tab. */
  active: string;
  /** Omit for a link row. */
  onSelect?: (id: string) => void;
  /** Accessible name for the row — what the views are views OF. */
  label: string;
  className?: string;
}) {
  const linked = tabs.every((t) => t.href);

  return (
    <div className={cn('tab-rail', className)}>
      <nav aria-label={label} className="tab-row" role={linked ? undefined : 'tablist'}>
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const content = (
            <span className={cn(FILE_S, 'uppercase tracking-[0.1em]')}>{tab.label}</span>
          );

          return tab.href ? (
            <a
              key={tab.id}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className="tab-item"
            >
              {content}
            </a>
          ) : (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect?.(tab.id)}
              className="tab-item"
            >
              {content}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Index pair                                                          */
/* ------------------------------------------------------------------ */

/**
 * `01 / 04`. A position marker, set at the smallest size on the page, with
 * the current number in full ink and the total behind it dimmed — so the pair
 * reads as one thing and the eye lands on the number that changes.
 *
 * Zero-padded to the width of the total, so `9 / 12` sets as `09 / 12` and a
 * column of them does not jitter.
 */
export function IndexPair({
  index,
  total,
  className,
}: {
  index: number;
  total: number;
  className?: string;
}) {
  const pad = String(total).length;
  const fmt = (n: number) => String(n).padStart(Math.max(2, pad), '0');

  return (
    <span
      data-telemetry
      aria-label={`${index} of ${total}`}
      className={cn(FILE_XS, 'inline-flex shrink-0 items-baseline gap-1', className)}
    >
      <span className={INK} aria-hidden>
        {fmt(index)}
      </span>
      <span aria-hidden>/</span>
      <span aria-hidden>{fmt(total)}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Big numeral                                                         */
/* ------------------------------------------------------------------ */

/**
 * The section number as a graphic element — a very large Ductile numeral set
 * beside the section it numbers, at 56px on a phone and 192px at 2400.
 *
 * It is FURNITURE. The numeral is `aria-hidden` and the number is repeated in
 * the section's own accessible name, because a screen reader announcing "zero
 * three" before every heading is noise. It is also dimmed by default: at that
 * size, full ink competes with the headline it is supposed to be numbering,
 * and the reference pages set theirs as a tint of the ground.
 *
 * This is the one place the product's `01.` eyebrow ban does not apply, and
 * the distinction is size: a 12px `01.` above a heading is a template, and a
 * 120px numeral beside one is a composition.
 */
export function BigNumeral({
  value,
  tone = 'faint',
  className,
}: {
  /** Rendered as given. Zero-pad at the call site if the set needs it. */
  value: number | string;
  tone?: 'faint' | 'dim' | 'strong' | 'accent';
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'numeral-graphic block select-none',
        tone === 'accent' ? ACCENT : tone === 'strong' ? INK : tone === 'dim' ? INK_DIM : INK_FAINT,
        className,
      )}
    >
      {value}
    </span>
  );
}
