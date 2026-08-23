'use client';

import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { clsx as cn } from 'clsx';
import { VideoPlate } from '@/components/hero/VideoPlate';
import { markFor, type Mark } from '@/components/fui/icons';
import { INK, INK_DIM, INK_FAINT, RULE } from '@/components/purchase/fields';
import { MISSION_CLIPS, type MissionClip } from './MissionGround';

/**
 * THE PANEL — the shared furniture every section of the configurator is
 * built from.
 *
 * ==================================================================
 * WHAT THIS FILE IS FOR
 * ==================================================================
 * The right-hand column of /mission was a stack of headlines and
 * paragraphs: a value with no label, a label with no rule, a card with
 * no hierarchy between its name, its price and its explanation. The
 * owner's words were "no proper labels, just simple text". This file is
 * the vocabulary that fixes that, once, so that no section has to
 * invent its own and no two sections can disagree.
 *
 * Six pieces, and nothing else is needed to build a section:
 *
 *   <PanelStack>    the vertical rhythm of a section
 *   <PanelHead>     eyebrow · title · standfirst · closing rule
 *   <PanelGroup>    a named, ruled block of controls
 *   <FieldTable>    the ruled label/value instrument table
 *   <StatGrid>      figures with their labels above them
 *   <PhaseBreak>    a clip between two phases (see the note on it)
 *
 * plus <PanelTag> for a state, <PanelNote> for small print and
 * <PreviewDisclosure> for the one disclosure the preview column owes
 * the reader.
 *
 * ==================================================================
 * FIVE KINDS OF THING, FIVE SHAPES — THE 2026-08 CORRECTION
 * ==================================================================
 * The owner's words: "use different cards or labels white and black
 * text to separate information — it is hard to visualise and easy to
 * see what it is". The measurement behind them: on the Target panel
 * `COORDINATES` (a row label) and `THE NEXT CROSSING OF YOUR SKY` (the
 * name of a whole block) were rendered in the SAME treatment — 10-11px
 * monospace, uppercase, `--ink-dim`, over a hairline. Two different
 * KINDS of information, drawn identically. A reader could not tell
 * where a block started, so the panel read as one grey column.
 *
 * The panel therefore carries exactly five shapes, and every piece of
 * the vocabulary is one of them:
 *
 *   HEADING   the sans title of <PanelHead />, and — the change — the
 *             label of a <PanelGroup />, which is now an INVERTED CHIP:
 *             solid `--ink` ground, `--ground` type. A filled white
 *             block is the one thing on a black panel that cannot be
 *             mistaken for a line of text, and it appears ONCE per
 *             block and nowhere else in the panel body.
 *   STATE     <PanelTag />, an OUTLINED chip: a border and no fill.
 *             `Optional`, `Live`, `3 / 28`, `7 day search`. Outline is
 *             deliberately the inverse of the heading's fill, so the
 *             two chips can sit on one line and still be two kinds.
 *   READING   a <FieldRow />: a dim label, a full-ink value, and a type
 *             MARK naming what kind of fact it is. See below.
 *   CONTROL   a <CardGroup /> option — bordered, hit-sized, and it
 *             inverts WHOLE when it is chosen. Inversion means the same
 *             thing at both scales: this one is named / this one is
 *             taken.
 *   SMALL PRINT  a <PanelNote />: sans, dim, and set behind a left
 *             hairline so an aside can never be read as a value.
 *
 * WHY INVERSION IS RATIONED. A white chip is the loudest thing the
 * panel can say. It is spent on the two moments that are worth it — the
 * name of a block, and the option the buyer has chosen — and on nothing
 * else. Three inversions would be a zebra and none of them would mean
 * anything.
 *
 * ==================================================================
 * THE TYPE MARKS, AND WHY THE CALLER DOES NOT PASS THEM
 * ==================================================================
 * A row's label already states the kind of fact it holds. `markFor()`
 * (`components/fui/icons/marks.tsx`) is the closed dictionary from that
 * label to the glyph for it, so a section gets its marks by naming its
 * rows correctly rather than by restating the same fact twice. An
 * explicit `icon` always wins; a label the dictionary does not know
 * gets NO mark, which is the icon set's own rule and is why the marks
 * still mean something.
 *
 * <FieldTable /> reserves the mark gutter only when at least one row in
 * it is marked, so an unmarked table keeps its full label column at
 * 320px instead of losing 22px to an empty column.
 *
 * ==================================================================
 * THE TYPE RULES, STATED ONCE
 * ==================================================================
 * A LABEL is monospace, uppercase, letterspaced, `--ink-dim` — the
 * house telemetry treatment. `text-tele` (11px) inside a <FieldRow />,
 * where it has to match its value exactly; `text-tele-s` (10px) where
 * it names a whole block (<PanelGroup />, <StatCell />) and is not
 * being read across a rule. The sign flip is the system's: tracking is
 * POSITIVE on small caps and NEGATIVE on display.
 *
 * A VALUE is monospace, uppercase, tabular, full `--ink`, set at the
 * SAME size as its label so the two sit on one line across the grid
 * gap. Colour, not size, is what separates them. A value that is prose
 * rather than a reading — an address, a sentence — takes `prose` and
 * is set in the sans note role instead.
 *
 * A UNIT is never inside the value string. It is a separate span in
 * `--ink-faint`, so `50 × 70` and `CM` are two different pieces of
 * information and the number stays scannable down a column.
 *
 * BODY COPY IS SANS. A paragraph of monospace is a bug — FUI rule 2.
 *
 * ==================================================================
 * WHY THE HEAD IS A HEADING AND NOT A DISPLAY LINE
 * ==================================================================
 * A section is a TAB, not a page: it is revealed, not travelled to. A
 * 40px display line in a 420px control column is a banner, not a
 * question, and it was one of the things pushing the button off the
 * fold. There is no arrival transition here either — animating a tab
 * would tell the buyer they had moved somewhere when the object beside
 * them has not changed.
 */

/* ================================================================== */
/* Rhythm                                                             */
/* ================================================================== */

/**
 * The vertical rhythm of a section, in one place.
 *
 * Every section is a <PanelStack> of a <PanelHead> and some
 * <PanelGroup>s. The gap is a token, not a decision each section makes,
 * which is what stops six sections drifting into six different rhythms.
 */
export function PanelStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('flex flex-col gap-6 sm:gap-7 xl:gap-8', className)}>{children}</div>;
}

/* ================================================================== */
/* The two chips — a heading, and a state                             */
/* ================================================================== */

/**
 * THE INVERTED CHIP — a heading, and only a heading.
 *
 * Solid `--ink`, type in `--ground`. On the black panel that is a white
 * block with black letters in it; on paper it is the exact opposite,
 * because both ends read the ground indirection and neither names a
 * colour. That is what makes it safe to use in a component that renders
 * on both halves of this product.
 *
 * NOT EXPORTED, on purpose. Inversion is the loudest signal the panel
 * has and it is rationed to two places: the name of a <PanelGroup />,
 * here, and the whole of a chosen <CardGroup /> option. A section that
 * could reach for this would sprinkle it, and a panel with six white
 * chips on it says nothing at all.
 *
 * `mark` rides INSIDE the chip, in the same inverted ink, so a block
 * with a subject the dictionary knows carries it without the chip
 * changing shape — and a block without one is still a complete chip
 * rather than a chip with a hole in it.
 */
function PanelChip({ mark: MarkGlyph, live, children }: { mark?: Mark | null; live?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        // `min-w-0`, NOT `shrink-0`. `THE PASS THOSE NUMBERS CAME FROM`
        // is 269px of chip at 320, against a 280px content column: a chip
        // that refuses to shrink puts a sideways scrollbar inside the one
        // region that scrolls vertically. It shrinks and wraps its own
        // text instead, which costs one 14px line on the two narrowest
        // widths and nothing anywhere else.
        'inline-flex min-w-0 items-center gap-1.5 bg-[color:var(--ink)] px-2 py-1',
        'font-mono text-tele-s uppercase break-words text-[color:var(--ground)]',
      )}
    >
      {MarkGlyph ? <MarkGlyph size={12} live={live} /> : null}
      {children}
    </span>
  );
}

/**
 * THE OUTLINED CHIP — a state, a count, or a liveness.
 *
 * `Optional`. `Live`. `12 / 28`. `7 day search`. Every one of them is a
 * fact ABOUT a block rather than a part of it, and every one of them
 * used to be a bare dim word floating at the right end of a rule, where
 * it read as a fourth kind of label nobody could place.
 *
 * A border and no fill is the deliberate inverse of the heading chip:
 * put the two on one line — which is exactly where <PanelGroup /> puts
 * them — and no one has to be told which is the name and which is the
 * state.
 *
 * `live` is the only tone that takes the accent, and the accent in this
 * system means one thing: something is happening now. It also lights a
 * small square, so liveness is never carried by hue alone.
 */
export function PanelTag({
  children,
  tone = 'quiet',
  className,
}: {
  children: ReactNode;
  /** `live` for a reading that is moving as it is read. */
  tone?: 'quiet' | 'live';
  className?: string;
}) {
  const live = tone === 'live';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 border px-1.5 py-[0.1875rem]',
        'font-mono text-tele-xs uppercase',
        // MEASURED, NOT PICKED. The outline is the ONLY thing that says
        // this chip is a state rather than a name, so it is held at 3:1
        // against the panel's own ground (WCAG 1.4.11's floor for a
        // meaningful graphic). `--rule-strong` measured 2.87:1 on
        // `--ground-raised` and the accent at 55% measured 2.43:1 —
        // both under. `--ink-faint` is 4.88:1 and the accent at 70% is
        // 3.31:1, and both are still a step quieter than the type they
        // enclose, which is the relationship the chip needs.
        live
          ? 'border-[color:color-mix(in_srgb,var(--accent)_70%,transparent)] text-[color:var(--accent)]'
          : cn('border-[color:var(--ink-faint)]', INK_DIM),
        className,
      )}
    >
      {live ? <span aria-hidden className="size-[4px] bg-[color:var(--accent)]" /> : null}
      {children}
    </span>
  );
}

/* ================================================================== */
/* The head of a section                                              */
/* ================================================================== */

/**
 * What is being decided, and at most one line under it. Every section
 * opens the same way, so the eye lands in the same place each time and
 * only the question changes.
 *
 * ANATOMY, top to bottom:
 *   · a 5px accent square and the eyebrow — the phase, in the label role
 *   · the question, in the heading role, with an optional telemetry
 *     value on the right (the mission name, a count, a state)
 *   · one line of standfirst, capped at the tight measure
 *   · a closing hairline, which is what makes the gap to the body a
 *     CONSTANT rather than something each section eyeballs
 *
 * The square is the accent, and the accent is only ever used for
 * live/active state. A section head is by definition the active phase,
 * which is the one place it is earned.
 */
export function PanelHead({
  title,
  eyebrow,
  children,
  aside,
  rule = true,
}: {
  title: string;
  /** The phase or the object, in the label role. Two or three words. */
  eyebrow?: ReactNode;
  /** One line. If it takes two, the section is carrying two decisions. */
  children?: ReactNode;
  /** A telemetry value on the right of the title — a name, a count.
      Rendered as a <PanelTag />: it is a state, not a subtitle. */
  aside?: ReactNode;
  /** The closing hairline. Off only where the body opens with its own. */
  rule?: boolean;
}) {
  return (
    <header className="flex flex-col">
      {eyebrow ? (
        <p className="flex items-center gap-2.5 pb-3 sm:pb-3.5">
          <span aria-hidden className="size-[5px] shrink-0 bg-[color:var(--accent)]" />
          <span className={cn('font-mono text-tele uppercase', INK_DIM)}>{eyebrow}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5">
        <h2 className={cn('max-w-[22ch] text-heading', INK)}>{title}</h2>
        {/* A STATE, NOT A CAPTION. The mission name, a count, a phase:
            whatever is here is a fact about the section rather than a
            second half of its title, so it takes the outlined chip and
            stops reading as a stray line of dim type beside a heading. */}
        {aside ? (
          <span data-telemetry>
            <PanelTag>{aside}</PanelTag>
          </span>
        ) : null}
      </div>

      {children ? (
        <p className={cn('max-w-[var(--measure-tight)] pt-2.5 text-body sm:pt-3', INK_DIM)}>{children}</p>
      ) : null}

      {rule ? (
        <span aria-hidden className={cn('mt-4 block border-t sm:mt-5', RULE)} />
      ) : null}
    </header>
  );
}

/* ================================================================== */
/* A named block of controls                                          */
/* ================================================================== */

/**
 * A named block inside a section: a chip, a rule and a state.
 *
 * Sections that re-house more than one of the old screens use it to
 * keep each original question legible as its own question — `Why this
 * place?` did not stop being a question when it stopped being a page.
 *
 * ANATOMY, one line:
 *
 *   ▮ COMPOSITION ─────────────────────────────────── ( OPTIONAL )
 *
 * The label is the INVERTED CHIP — see the head of this file for why
 * that, and why nothing else in the panel body may be inverted. The
 * hairline runs from the chip to the state at the far end, so a block
 * header is a seam across the column rather than a dim word above a
 * rule that looked exactly like every row label under it.
 *
 * `hint` is the right-hand state: `Optional`, `Required`, `3 of 8`,
 * `Live`. It is rendered as a <PanelTag />, and the word `Live` selects
 * the live tone by itself so the four sections that pass it do not each
 * have to know that. `note` is the small print UNDER the controls, in
 * sentence case, where a disclosure belongs.
 */
export function PanelGroup({
  label,
  hint,
  hintTone = 'quiet',
  icon,
  note,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  /** `live` for a block whose readings are moving as they are read. */
  hintTone?: 'quiet' | 'live';
  /**
   * Override the dictionary. `null` suppresses the mark outright for a
   * block whose name happens to collide with a known subject.
   */
  icon?: Mark | null;
  /** Small print under the controls — a disclosure, a source, a caveat. */
  note?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  // `Live` is the one hint that is a liveness rather than a count, and it
  // is passed as a word by four different sections. Reading it here means
  // none of them has to know about tones.
  const live =
    hintTone === 'live' || (typeof hint === 'string' && hint.trim().toLowerCase() === 'live');
  const mark = icon === undefined ? markFor(label) : icon;

  return (
    <section className={cn('flex flex-col', className)}>
      {/* THE BLOCK HEADER — chip, rule, state.
          The hairline no longer runs UNDER the label; it runs THROUGH
          the line, out of the chip and across to the state at the far
          end. That is what turns a heading into a visible seam in the
          column: the eye reads white block · rule · state and knows a
          new block has started without reading a word of it. Measured,
          it is a pixel or three SHORTER than the ruled-underneath
          version it replaces (22px against 23 at `sm` and below, 25
          above), which on a 291px phone scroller is the direction chrome
          is allowed to move in.

          It does not wrap. Wrapping put the connecting hairline on a
          line of its own under a long chip, where it read as a stray
          rule rather than as the seam it is; the chip is the only thing
          in the row that gives. */}
      <div className="flex items-center gap-x-3">
        {/* The chip is inside the heading rather than being it, so the
            <h3> stays a real heading in the accessibility tree. A
            `display: contents` wrapper would have been one element
            fewer and is exactly the pattern that drops a heading out of
            that tree on the browsers that still ship the old bug. */}
        <h3 className="flex min-w-0">
          <PanelChip mark={mark} live={live}>
            {label}
          </PanelChip>
        </h3>
        <span aria-hidden className={cn('h-px min-w-4 flex-1 border-t', RULE)} />
        {hint ? <PanelTag tone={live ? 'live' : 'quiet'}>{hint}</PanelTag> : null}
      </div>

      <div className="pt-3.5 sm:pt-4">{children}</div>

      {note ? <PanelNote className="pt-3">{note}</PanelNote> : null}
    </section>
  );
}

/**
 * A small-print line under a block. The role exists so that a disclosure —
 * what the imagery is, where a date came from, what is simulated — is set
 * as sentence-case prose rather than shouted in the label role.
 */
export function PanelNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('max-w-[var(--measure-wide)] text-note', INK_DIM, className)}>
      {/* THE LEFT HAIRLINE IS THE WHOLE POINT. A disclosure set as plain
          dim sans is the same shape as the standfirst above it and as
          any prose value in the table beside it, so a reader has to READ
          it to find out it is small print. A rule down its left edge
          says so before a word is read, and costs zero vertical pixels —
          which on a phone panel is the only kind of chrome that may be
          added at all. It is on an inner span so a caller's `pt-*`
          still spaces the block without stretching the rule up into it. */}
      {/* `--rule-strong` and not `--rule`: every other hairline on the
          panel is a gridline between two things, and this one is a
          MARKER on one thing. It is measured at 2.87:1 against the
          panel ground — under 3:1, and deliberately so, because it is
          decorative redundancy rather than a component boundary or a
          meaningful graphic: the note's own type role and position say
          the same thing, and a rule loud enough to pass 1.4.11 would be
          shouting an aside. */}
      <span className={cn('block border-l border-[color:var(--rule-strong)] pl-3')}>{children}</span>
    </p>
  );
}

/* ================================================================== */
/* The instrument table                                               */
/* ================================================================== */

/**
 * THE RULED LABEL/VALUE TABLE — the anatomy the whole panel is built to
 * carry, and the piece the owner was asking for.
 *
 * A real <dl>. The grid is on the list and the cells are its direct
 * children, so every label in the table shares one column edge and
 * every rule runs unbroken across both columns — which is what makes a
 * stack of readings look like an instrument rather than a paragraph
 * with colons in it.
 *
 * MEASURED FROM THE REFERENCE, not guessed: the clone's spec table is a
 * `0.75fr / 1fr` grid with a hairline under every cell, both columns
 * set at one monospace size, and no gap between the rows. Ours is the
 * same grid with a floor on the label column so a long label cannot
 * squeeze the value to nothing at 320px, and with the value column left
 * aligned — a value pinned to the right edge of a 460px panel is a
 * value the eye has to travel to.
 *
 * `dense` halves the row padding for a long reference table; the
 * default is the comfortable rhythm for the six-to-ten-row readouts the
 * sections actually carry.
 */
export function FieldTable({
  children,
  caption,
  dense = false,
  className,
}: {
  /** <FieldRow />s, and nothing else. */
  children: ReactNode;
  /** One line under the table — a source, a caveat, an as-of. */
  caption?: ReactNode;
  dense?: boolean;
  className?: string;
}) {
  // THE MARK GUTTER IS EARNED, NOT ASSUMED. A table whose labels name no
  // type — and there are several — would otherwise give up 22px of a
  // label column that is only 88px wide at 320, and `ABOVE THE HORIZON`
  // would wrap where it currently does not. So the column is opened only
  // if something is going to stand in it.
  const gutter = hasMark(children) ? '1.375rem' : '0rem';

  return (
    <div className={className}>
      <dl
        className={cn('grid grid-cols-[minmax(5.5rem,0.75fr)_minmax(0,1fr)] border-t', RULE)}
        style={{
          ['--field-pad' as string]: dense ? '0.3125rem' : '0.5rem',
          ['--field-mark' as string]: gutter,
        }}
      >
        {children}
      </dl>
      {caption ? <PanelNote className="pt-2.5">{caption}</PanelNote> : null}
    </div>
  );
}

/**
 * Does any row in this table carry a type mark?
 *
 * It reads the children's props rather than a prop on the table, so a
 * caller cannot get the two out of step — a table that says it has marks
 * and has none reserves an empty column, and one that says it has none
 * and has some hangs its glyphs over the edge. Fragments are walked
 * because `<>{a}{b}</>` is one child to `Children.forEach` and would
 * otherwise hide every row inside it.
 */
function hasMark(children: ReactNode): boolean {
  let found = false;
  Children.forEach(children, (child) => {
    if (found || !isValidElement(child)) return;
    const props = child.props as { icon?: Mark | null; label?: unknown; children?: ReactNode };
    if (child.type === Fragment) {
      if (hasMark(props.children)) found = true;
      return;
    }
    if (props.icon) found = true;
    else if (props.icon === undefined && markFor(props.label)) found = true;
  });
  return found;
}

/**
 * One reading. Label left, value right, one hairline under both.
 *
 * `unit` is a separate span on purpose — see the type rules at the top
 * of this file. `note` is a second line under the value for the one
 * thing a reading sometimes needs: where it came from, or that it is
 * indicative rather than measured.
 *
 * `prose` sets the value in the sans note role for values that are
 * sentences or addresses rather than readings. Everything else is
 * monospace, uppercase and tabular.
 *
 * THE TYPE MARK sits in the label's gutter and is `aria-hidden`: the
 * written label is beside it and says the same thing, so the mark is
 * the fast path for the eye and never the only carrier of the meaning.
 * It comes from the dictionary unless the caller overrides it.
 */
export function FieldRow({
  label,
  value,
  unit,
  note,
  icon,
  live = false,
  prose = false,
  tone = 'strong',
}: {
  label: ReactNode;
  value: ReactNode;
  /** `CM`, `KM`, `EUR`, `M/PX`. Never baked into `value`. */
  unit?: ReactNode;
  /** A second line under the value. Sentence case. */
  note?: ReactNode;
  /**
   * The type mark. Left off, the label is looked up in the dictionary;
   * `null` suppresses the mark for a row whose label collides with a
   * known type but whose value is not one.
   */
  icon?: Mark | null;
  /** The value is moving as it is read. Only the two live marks use it. */
  live?: boolean;
  /** Addresses and sentences. Sets the value in sans, mixed case. */
  prose?: boolean;
  /** `dim` for a value that is not yet known, or is a default. */
  tone?: 'strong' | 'dim' | 'accent';
}) {
  const cell = cn('border-b py-[var(--field-pad,0.5rem)]', RULE);
  const MarkGlyph = icon === undefined ? markFor(label) : icon;

  return (
    <>
      <dt className={cn(cell, 'pr-4')}>
        {/* `flex`, and the gutter is a fixed width rather than a gap, so
            the label text of every row in the table starts on ONE
            vertical edge whether or not that row is marked. The mark is
            12px against an 11px label: a type mark that is bigger than
            the word it qualifies has stopped qualifying it.
            `items-start` and not `items-center`, because a label that
            wraps to two lines must keep its mark on the first. */}
        <span className="flex items-start">
          {MarkGlyph ? (
            <span
              aria-hidden
              className={cn('shrink-0 pt-[0.15rem]', INK_FAINT)}
              /* The fallback is the full gutter, not zero: a <FieldRow />
                 rendered outside a <FieldTable /> has no gutter variable
                 and a zero-width box would lay its glyph over the label. */
              style={{ width: 'var(--field-mark, 1.375rem)' }}
            >
              <MarkGlyph size={12} live={live} />
            </span>
          ) : (
            <span aria-hidden className="shrink-0" style={{ width: 'var(--field-mark, 0rem)' }} />
          )}
          <span className={cn('min-w-0 font-mono text-tele uppercase', INK_DIM)}>{label}</span>
        </span>
      </dt>
      <dd className={cn(cell, 'min-w-0')}>
        <span
          data-telemetry
          className={cn(
            'block break-words',
            prose ? 'text-note' : 'font-mono text-tele uppercase',
            tone === 'dim'
              ? 'text-[color:var(--ink-faint)]'
              : tone === 'accent'
                ? 'text-[color:var(--accent)]'
                : INK,
          )}
        >
          {value}
          {unit ? (
            <span
              className={cn('pl-1.5 font-mono text-tele-s uppercase', 'text-[color:var(--ink-faint)]')}
            >
              {unit}
            </span>
          ) : null}
        </span>
        {note ? <span className={cn('block pt-1 text-note', INK_DIM)}>{note}</span> : null}
      </dd>
    </>
  );
}

/* ================================================================== */
/* Figures                                                            */
/* ================================================================== */

/**
 * Two to four figures across, each with its label ABOVE it and a
 * hairline above that — the reference's stat cell, which is the right
 * shape when the values are short and the comparison is sideways
 * rather than down a column. Use <FieldTable /> when there are more
 * than four, or when the labels are long.
 */
export function StatGrid({
  columns = 2,
  children,
  className,
}: {
  columns?: 2 | 3 | 4;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-x-5 gap-y-4',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-2 sm:grid-cols-3',
        columns === 4 && 'grid-cols-2 sm:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** One figure inside a <StatGrid />. */
export function StatCell({
  label,
  value,
  unit,
  note,
  icon,
  live = false,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  note?: ReactNode;
  /** The type mark. Dictionary by default; `null` suppresses it. */
  icon?: Mark | null;
  /** The figure is moving as it is read. */
  live?: boolean;
}) {
  const MarkGlyph = icon === undefined ? markFor(label) : icon;
  return (
    <div className={cn('flex flex-col gap-2 border-t pt-2.5', RULE)}>
      <span className={cn('flex items-center gap-1.5 font-mono text-tele-s uppercase', INK_DIM)}>
        {MarkGlyph ? (
          <span aria-hidden className={cn('shrink-0', INK_FAINT)}>
            <MarkGlyph size={12} live={live} />
          </span>
        ) : null}
        {label}
      </span>
      <span data-telemetry className={cn('text-body tabular-nums', INK)}>
        {value}
        {unit ? (
          <span className={cn('pl-1.5 font-mono text-tele-s uppercase', 'text-[color:var(--ink-faint)]')}>
            {unit}
          </span>
        ) : null}
      </span>
      {note ? <span className={cn('text-note', INK_DIM)}>{note}</span> : null}
    </div>
  );
}

/* ================================================================== */
/* Motion between phases                                              */
/* ================================================================== */

/**
 * THE CLIPS THAT MAY APPEAR IN THE PANEL, AND THE TWO THAT MAY NOT.
 *
 * There used to be a second safe-set table here, with its own copy of
 * the two allowed paths and its own alt strings. Two tables of the same
 * fact is exactly how a treatment drifts, so there is now ONE:
 * `MISSION_CLIPS` in `MissionGround.tsx`, which is also what the preview
 * column's grounds read. Its header carries the reasoning — briefly,
 * `result.mp4` has a burned-in `MISSION 32BF` and a capture timestamp
 * and `orbit.mp4` has `MISSION B324`, and inside a purchase flow either
 * reads as THIS buyer's own record. The union type is the enforcement,
 * not a comment.
 *
 * The honesty note travels with the clip from that same table, so a
 * panel break cannot show footage without saying what it is not — see
 * the note under the plate below.
 */
export type PhaseClip = MissionClip;

/**
 * A CLIP BETWEEN TWO PHASES.
 *
 * The owner asked for the films to be used "as bits between cards", and
 * this is the only shape that can be: a ruled break inside the scroller,
 * carrying one short clip, a phase label burned on the plate and one
 * line of caption under it.
 *
 * WHAT IT IS NOT ALLOWED TO DO, and does not:
 *   · it never delays anything — the panel below it is already rendered
 *     and the primary action is a sibling of the scroller, not of this;
 *   · it never advances anything — there is no `onEnded`, no timer and
 *     no state on this component at all;
 *   · it never plays unbidden — <VideoPlate /> gates on an
 *     IntersectionObserver, refuses to play under
 *     `prefers-reduced-motion` (the poster frame is what you get), and
 *     shows a real PAUSE/PLAY control on any coarse pointer or after
 *     an autoplay refusal (iOS Low Power Mode). WCAG 2.2.2.
 *
 * Aspect is 11 / 5 on the desktop split and 3 / 1 on a phone — the
 * supplied clips are 9 / 16 portrait, so a panel-width plate at their
 * native ratio would be 700px tall and would be a page, not a break.
 *
 * Use it ONCE in a section, at most. It is punctuation.
 */
export function PhaseBreak({
  clip = 'zoom-logo',
  label,
  caption,
  className,
}: {
  clip?: PhaseClip;
  /** Burned on the plate, top left. Two words: `In orbit`, `Sighting`. */
  label?: string;
  /** One sentence under the plate. Never a paragraph. */
  caption?: string;
  className?: string;
}) {
  const source = MISSION_CLIPS[clip];
  return (
    <div
      className={cn(
        'border-t pt-5',
        // The crop is narrower on a phone than on the desktop split, and
        // it has to be: below `lg` the preview column already owns
        // 46svh and the scroller that is left is around 270px. A break
        // taller than a third of that is not punctuation, it is the
        // section. The ratio is a custom property because
        // <VideoPlate />'s `aspect` lands in an inline style, which
        // cannot carry a media query.
        '[--phase-aspect:3/1] sm:[--phase-aspect:11/5]',
        RULE,
        className,
      )}
    >
      <VideoPlate
        src={source.src}
        poster={source.poster}
        alt={source.alt}
        label={label}
        caption={caption}
        aspect="var(--phase-aspect)"
        rounded={false}
        className="w-full"
      />

      {/* THE NOTE RIDES WITH THE CLIP HERE TOO. A satellite moving inside
          a purchase flow argues, without a word, that this is the
          spacecraft flying the mission. It is not, and the caption above
          is the section's own prose — it cannot be relied on to say so.
          So the disclaimer comes from the clip's record, not from the
          caller, and appears whatever the caller wrote. */}
      <p className={cn('pt-2 font-mono text-tele-xs uppercase', INK_FAINT)}>{source.note}</p>
    </div>
  );
}

/* ================================================================== */
/* The one disclosure the preview owes the reader                     */
/* ================================================================== */

/**
 * WHAT THE POSTER IN THE PREVIEW COLUMN ACTUALLY IS.
 *
 * The print preview is a true composition of what will print — the
 * format's real proportion, the telemetry strip, the print credit — but
 * the PICTURE inside it is the archive stand-in from the reveal, and
 * several cells cannot be filled until the pass has flown. That has to
 * be said, on every width, wherever the poster is shown.
 *
 * It is said HERE, in the panel, rather than under the artefact. Below
 * `lg` the preview column is 46svh: a four-line disclosure under a
 * portrait print there costs a third of the object's height and gets
 * the print cropped, which is a worse outcome for both. In the panel it
 * is full width, at the note role, and it scrolls with the controls it
 * belongs to.
 */
export function PreviewDisclosure() {
  return (
    <PanelNote>
      The print beside these controls is a preview composition. The picture in it is the archive
      stand-in from the reveal; the frame that prints is the one your mission captures. Values
      marked after capture are filled from the pass that takes it.
    </PanelNote>
  );
}
