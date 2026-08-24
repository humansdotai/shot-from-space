import { cn } from '@/lib/utils';

export type ChipState = 'done' | 'active' | 'pending' | 'alert';

const STATE: Record<ChipState, { dot: string; text: string; border: string }> = {
  done: { dot: 'bg-paper-faint', text: 'text-paper-dim', border: 'border-hairline' },
  active: { dot: 'bg-signal animate-signal-pulse', text: 'text-signal', border: 'border-signal/40' },
  pending: {
    dot: 'bg-transparent border border-paper-faint',
    text: 'text-paper-faint',
    border: 'border-hairline-soft',
  },
  alert: { dot: 'bg-signal', text: 'text-signal', border: 'border-signal/40' },
};

/**
 * Small status pill: dot + label. The only place the accent colour lives.
 *
 * The stadium is `--radius-pill` — one of the three components allowed to
 * break the system's 2px rule; see the radius block in app/globals.css for
 * the list and the reason. A status is a badge, not a surface.
 *
 * Dark ground only: the four states name `paper-*` and `signal` directly,
 * because every surface that carries a StatusChip is a dark one. For a
 * status inside a readout that may land on either half of the poster, use
 * <StatusToken> below, which follows the ground.
 */
export function StatusChip({
  label,
  state = 'pending',
  className,
}: {
  label: string;
  state?: ChipState;
  className?: string;
}) {
  const s = STATE[state];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-[var(--radius-pill)] border px-2.5 py-1 text-label uppercase leading-none',
        s.border,
        s.text,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Status token                                                        */
/* ------------------------------------------------------------------ */

/**
 * THE LIGHTER SIBLING — a status set as a TOKEN rather than as a sentence.
 *
 * READOUT D2, fourth point. `ROUTINE`, `NOMINAL`, `CLEAR`, `WITHIN
 * TOLERANCE` currently render as plain text inside readouts, which means
 * they weigh exactly as much as a coordinate, a timestamp and a file
 * format — and a reader scanning for "is anything wrong" has to read every
 * row to find out. A token is the fix: same string, given an edge and a
 * fill so the eye can pick the states out of a column of readings without
 * reading any of them.
 *
 * WHY NOT JUST <StatusChip>. Three reasons, and all three are why this is
 * a sibling rather than a prop:
 *
 *   · GROUND. StatusChip names `paper-*` and `signal`; the readouts it is
 *     wanted in sit on paper, where `signal` is 2.9:1. This one reads
 *     `--ink` / `--accent` / `--rule` and is correct on either half.
 *   · WEIGHT. A chip announces the file's own state and carries a dot to
 *     say so. A token is one value among nine and must not shout: no dot
 *     by default, tighter padding, a tint instead of a border.
 *   · DENSITY. A token sits INSIDE a row, in line with the value it
 *     replaces, so it is sized off the detail ramp (`.file-s`, 10px) and
 *     not off `--text-label`.
 *
 * The accent stays a STATE colour. `neutral` — which is most of them,
 * because `ROUTINE` and `NOMINAL` are the absence of news — is a 10% tint
 * of the ground's own ink and carries no colour at all. Only `live` and
 * `alert` reach for the accent, and even then it is the ink and the ring,
 * never the fill.
 *
 * Measured: neutral is 13.70:1 on paper and 13.92:1 on void; the accent
 * states are 4.70:1 and 6.00:1. All four clear AA at 10px.
 */
export type TokenTone = 'neutral' | 'live' | 'alert';

export function StatusToken({
  label,
  tone = 'neutral',
  className,
}: {
  /** The status itself — one or two words. Uppercased at the class. */
  label: string;
  /**
   * `neutral` for a status that is the absence of news. `live` for one
   * that is true right now and will change (pulsing dot). `alert` for one
   * that wants a decision (static dot).
   */
  tone?: TokenTone;
  className?: string;
}) {
  const accent = tone !== 'neutral';

  return (
    <span
      data-status={tone}
      className={cn(
        'file-s inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] px-2 py-1 leading-none uppercase',
        accent
          ? 'border border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] text-[color:var(--accent)]'
          : 'bg-[color:color-mix(in_srgb,var(--ink)_10%,transparent)] text-[color:var(--ink)]',
        className,
      )}
    >
      {accent ? (
        <span
          aria-hidden
          className={cn(
            'h-1 w-1 shrink-0 rounded-full bg-[color:var(--accent)]',
            tone === 'live' && 'animate-signal-pulse',
          )}
        />
      ) : null}
      {label}
    </span>
  );
}
