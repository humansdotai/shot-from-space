import type { ReactNode } from 'react';
import { clsx as cn } from 'clsx';

/**
 * Form atoms for the purchase flow.
 *
 * /start alternates ground — target and format/pricing/summary on paper, the
 * capture preview on void — so nothing here names a colour. Every atom reads
 * the `--ink` / `--rule` / `--accent` indirection set by `.surface-light` and
 * `.surface-dark`, which means one control renders correctly on both halves
 * of the page with no variant and no prop.
 *
 * Rules encoded here, once, so no screen can get them wrong:
 *  - every control is at least 48px tall (56px for the two text inputs);
 *  - every text input is 16px so iOS never zooms on focus;
 *  - the global focus ring is never removed, and the border goes to full ink
 *    with it so a focused field reads at a glance on either ground;
 *  - an invalid field is described by its message via aria-describedby;
 *  - one curve: `transition-house`.
 */

/* --- Ground-following ink and rules --------------------------------- */
/* Written as literal arbitrary values so Tailwind emits them and so the
   hover/focus variants below can be written literally too. */

export const INK = 'text-[color:var(--ink)]';
export const INK_DIM = 'text-[color:var(--ink-dim)]';
export const INK_FAINT = 'text-[color:var(--ink-faint)]';
export const ACCENT = 'text-[color:var(--accent)]';
export const RULE = 'border-[color:var(--rule)]';

/**
 * ONE CURVE.
 *
 * Every rounded surface in the purchase flow reads this and nothing else, so
 * the flow can never carry two radii at once. It points at the system token
 * rather than a literal, which is what keeps an input, a segmented control
 * and a <Button /> — whose radius is set in globals.css — on the same corner.
 * Changing the curve of the product is therefore one line in globals.css, not
 * a search across this directory.
 */
export const CURVE = 'rounded-[var(--radius-action)]';

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

/**
 * 56px tall, 16px type, 16px of lead-in. Generous on purpose: a cramped
 * field is the loudest template tell on a phone, and 16px is the threshold
 * below which iOS zooms the viewport on focus.
 */
export const INPUT_CLASS = cn(
  `block h-14 w-full ${CURVE} border bg-transparent px-4 text-[1rem] leading-none`,
  'border-[color:var(--rule)] text-[color:var(--ink)] placeholder:text-[color:var(--ink-faint)]',
  'transition-house hover:border-[color:var(--rule-strong)] focus:border-[color:var(--ink)]',
);

export function FieldLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3">
      <label htmlFor={htmlFor} className={cn('text-label uppercase', INK_DIM)}>
        {children}
      </label>
      {hint ? <span className={cn('text-label uppercase', INK_DIM)}>{hint}</span> : null}
    </div>
  );
}

/** Inline validation message. Mission voice, never an "Oops". */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className={cn('pt-3 text-body', ACCENT)}>
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Quiet action — a rule under a line of type                          */
/* ------------------------------------------------------------------ */

export const QUIET_BUTTON = cn(
  'inline-flex min-h-11 items-center text-action underline underline-offset-4',
  'text-[color:var(--ink-dim)] decoration-[color:var(--rule-strong)] transition-house',
  'hover:text-[color:var(--ink)] hover:decoration-[color:var(--ink)]',
  'disabled:text-[color:var(--ink-faint)] disabled:hover:decoration-[color:var(--rule)]',
);

/* ------------------------------------------------------------------ */
/* Segmented selector                                                  */
/* ------------------------------------------------------------------ */

/**
 * The only multi-choice control in the flow. Two or three positions, full
 * width, each ≥48px, set at the action role. Selection is a ground swap, not
 * a tint: the chosen cell takes the ink as its background and the ground as
 * its label, so it inverts correctly on paper and on void alike.
 */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  name,
}: {
  label: string;
  options: readonly { value: T; label: string; sub?: string }[];
  value: T;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex w-full overflow-hidden border', CURVE, RULE)}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            name={name}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex min-h-12 flex-1 flex-col items-center justify-center gap-1 px-2 py-3 text-action transition-house',
              i > 0 && cn('border-l', RULE),
              active
                ? 'bg-[color:var(--ink)] text-[color:var(--ground)]'
                : 'text-[color:var(--ink-dim)] hover:bg-[color:color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-[color:var(--ink)]',
            )}
          >
            <span>{o.label}</span>
            {o.sub ? (
              <span
                className={cn(
                  'text-label uppercase',
                  active
                    ? 'text-[color:color-mix(in_srgb,var(--ground)_72%,var(--ink))]'
                    : INK_DIM,
                )}
              >
                {o.sub}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Readouts                                                            */
/* ------------------------------------------------------------------ */

/**
 * A summary row: label left, value right, one hairline above. Values are set
 * in the sans action role — monospace on this page is reserved for the
 * coordinates and the running clock beside the capture frame.
 */
export function SpecRow({
  label,
  value,
  tone = 'strong',
  mono = false,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'strong' | 'dim';
  /** Set for coordinates and timestamps only. */
  mono?: boolean;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-6 border-t py-3', RULE)}>
      <dt className={cn('shrink-0 text-label uppercase', INK_DIM)}>{label}</dt>
      <dd
        data-telemetry
        className={cn(
          'min-w-0 text-right tabular-nums break-words',
          mono ? 'font-mono text-tele uppercase' : 'text-action',
          tone === 'dim' ? INK_DIM : INK,
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Designed error plate: an accent rule down the left edge, a label, a line of
 * copy in mission voice and an optional recovery action. The accent follows
 * the ground, so it never drops below contrast on paper.
 */
export function ErrorPlate({
  title,
  children,
  action,
}: {
  /** Sentence case — the label role uppercases it. */
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        CURVE,
        'border border-l-2 border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)]',
        'bg-[color:color-mix(in_srgb,var(--accent)_6%,transparent)] px-4 py-4',
      )}
    >
      <p className={cn('text-label uppercase', ACCENT)}>{title}</p>
      <p className={cn('pt-2 text-body', INK_DIM)}>{children}</p>
      {action ? <div className="pt-4">{action}</div> : null}
    </div>
  );
}
