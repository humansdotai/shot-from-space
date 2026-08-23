import { clsx as cn } from 'clsx';
import type { ReactNode } from 'react';

/**
 * THE CARD ATOMS — six of them, and no more.
 *
 * A brief card is one subject read in about ten seconds: a head that names
 * the subject, ONE lead value at the heading role, a few supporting rows, and
 * at most one sentence of prose. These atoms are the whole vocabulary, so a
 * card cannot quietly grow into the specification block.
 *
 * EVERY TYPE ROLE HERE SITS ONE STEP DOWN FROM WHERE IT STARTED. The lead was
 * three hard-typed sizes above the card's own title; it is the `heading` role
 * now, and the deck has taken the title to `body`. Labels stay on the detail
 * ramp at `file-s`, which is already its floor. The result is a quieter card
 * with more air in it and the same hierarchy — question, then answer, then
 * the rows that qualify the answer.
 *
 * They are deliberately the same idiom as `components/mission/ConditionsPanel`
 * and `components/mission/MissionDataBlock` — marked label, value on a spine,
 * detail ramp for readouts, sans for prose — because a reader who opens the
 * brief and then scrolls the file should not have to learn a second readout.
 *
 * TYPE MARKS come from `components/fui/icons` and go on rows whose value has
 * a KIND: a coordinate, an instant, a cloud fraction, a facility, a parcel.
 * A degree, an inclination string and a stage name are not types and take no
 * mark; the gutter is held open so the labels keep one left edge.
 *
 * AT 390 every row stacks — mark and label on the first line, value on the
 * second — and pairs onto a spine from 768. The same rule the file's rows
 * follow, for the same reason: a label column, a 16px mark and a coordinate
 * do not share a 326px line without truncating one of them.
 */

const INK = 'text-[color:var(--ink)]';
const INK_DIM = 'text-[color:var(--ink-dim)]';
const ACCENT = 'text-[color:var(--accent)]';
const RULE = 'border-[color:var(--rule)]';

/* ------------------------------------------------------------------ */
/* The body                                                           */
/* ------------------------------------------------------------------ */

/**
 * A card's body. A column and nothing else — no fill, no border, no radius,
 * no shadow and NO HEADING: <BriefDeck /> renders the card's <h3> from the
 * `title` on its `BriefCard` entry, and a second heading here would give the
 * card two. Sub-headings inside a body therefore start at <h4>.
 */
export function Body({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col', className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* The lead                                                           */
/* ------------------------------------------------------------------ */

/**
 * THE ONE VALUE THAT MATTERS on this card, at the heading role.
 *
 * `mono` decides the face and it is not a style preference: a reading — a
 * distance, a percentage, a size, a coordinate — is set in the detail face
 * with tabular figures, and a NAME — a place, a stage — is set in the sans
 * because it is a word rather than a figure.
 *
 * `aside` takes a position readout (`04 / 09`) and nothing else.
 */
export function Lead({
  icon,
  label,
  value,
  aside,
  sub,
  token,
  mono = false,
  tone,
  className,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  /** A readout that qualifies the lead — a position in a sequence. */
  aside?: string;
  sub?: ReactNode;
  token?: ReactNode;
  /** True for a reading, false for a name. */
  mono?: boolean;
  tone?: 'accent' | 'dim';
  className?: string;
}) {
  const ink = tone === 'accent' ? ACCENT : tone === 'dim' ? INK_DIM : INK;

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="file-s file-label flex items-center gap-2">
          {icon}
          {label}
        </p>
        {aside ? (
          <p data-telemetry className="file-s file-label">
            {aside}
          </p>
        ) : null}
      </div>

      {/* ONE STEP DOWN THE RAMP. This was three hard-typed sizes —
          26 / 30 / 34px — sitting above a card title set at `heading`.
          It is now the `heading` role itself (20 / 22 / 24 / 26 / 28) and
          the deck has taken its title down to `body`, so the two keep the
          order they always had — the subject of the card is the question,
          this is the answer, and the answer stays the larger of the two at
          every width — while the whole card got quieter and the air around
          it got bigger. It also stops inventing sizes: there is no
          `text-[1.625rem]` in the type ramp and there never was. */}
      {mono ? (
        <p data-telemetry className={cn('file mt-4 text-heading leading-none', ink)}>
          {value}
        </p>
      ) : (
        /* A NAME, at the same scale as a reading, in the sans — because it
           is a word rather than a figure. */
        <p className={cn('mt-4 text-heading leading-tight tracking-[-0.015em]', ink)}>
          {value}
        </p>
      )}

      {token ? <div className="mt-4">{token}</div> : null}
      {/* No face here: a readout sub sets its own `.file`, a prose sub its
          own `text-note`. See KeyRow on the specification block. */}
      {sub ? <div className={cn('mt-3', INK_DIM)}>{sub}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rows                                                               */
/* ------------------------------------------------------------------ */

/** A ruled stack of supporting rows. Bounded by its own rows' rules. */
export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl className={cn('flex flex-col gap-y-4 border-t pt-5 md:gap-y-3.5', RULE, className)}>
      {children}
    </dl>
  );
}

/**
 * A SUPPORTING ROW. Stacked below 768, a label/value pair on a spine from
 * 768 up. `mono` marks the value as a reading rather than as words — a
 * coordinate, a timestamp, a figure — and is the only thing that decides
 * the face.
 */
export function Row({
  icon,
  label,
  value,
  mono = false,
  tone,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  mono?: boolean;
  tone?: 'dim' | 'accent';
}) {
  const ink = tone === 'accent' ? ACCENT : tone === 'dim' ? INK_DIM : INK;

  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-0.5 md:grid-cols-[9.5rem_minmax(0,1fr)] md:items-baseline xl2:grid-cols-[10.5rem_minmax(0,1fr)]">
      {/* A BLOCK dt, not a flex one — the same construction the
          specification block's row uses and for the same reason.
          `items-baseline` on the grid takes each child's FIRST baseline,
          and a flex container's baseline is its first item's, which for
          the empty gutter on an unmarked row is the box's bottom edge and
          drops that label half a line below its value. Keeping the label
          in normal flow and hanging the mark on it as an inline box means
          every row, marked or not, sits on the same text baseline — and
          the gutter stays OPEN on the unmarked ones so an absent mark
          reads as deliberate rather than as a misalignment. */}
      <dt className="file-s file-label">
        <span aria-hidden className="mr-2 inline-block w-4 align-[-0.45em]">
          {icon}
        </span>
        {label}
      </dt>
      <dd
        {...(mono ? { 'data-telemetry': '' } : {})}
        className={cn('min-w-0 break-words', mono ? 'file' : 'text-note', ink)}
      >
        {value}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lists and prose                                                    */
/* ------------------------------------------------------------------ */

/**
 * A named list of plain statements. Used once, on the resolution card, where
 * the honest answer is two lists rather than a value. The rows have no marks
 * because a sentence has no type.
 */
export function List({
  title,
  items,
  tone,
  className,
}: {
  title: string;
  items: readonly string[];
  tone?: 'dim';
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      <h4 className="file-s file-label-strong">{title}</h4>
      <ul className={cn('mt-3 flex flex-col gap-y-2 border-t pt-3.5', RULE)}>
        {items.map((item) => (
          <li key={item} className={cn('text-note', tone === 'dim' ? INK_DIM : INK)}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The one sentence a card is allowed. Sans, at the note size, on the reading
 * measure — prose, not a label, and never a second readout in disguise.
 */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('max-w-[var(--measure)] text-note', INK_DIM, className)}>{children}</p>
  );
}
