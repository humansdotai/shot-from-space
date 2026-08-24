'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStreamingText } from '@/components/interior/streaming-text';
import type { CommsMessageDTO, CommsRole } from '@/lib/types';
import { cn, formatTelemetryDate } from '@/lib/utils';

/**
 * THE THREAD. A conversation, not a log.
 *
 * ------------------------------------------------------------------------
 * WHAT WAS WRONG WITH THE LOG
 * ------------------------------------------------------------------------
 * Every entry was full width, every entry was separated by the same 1px
 * rule, and the speaker tag sat at the same weight and the same distance
 * from the body on both sides. Two people talking looked exactly like a
 * printer spooling filed transmissions: to find out who said something you
 * had to read a label. The owner's note was "this is hard to read — make it
 * more like a chat interface", and he was right.
 *
 * ------------------------------------------------------------------------
 * THE FOUR MOVES, AND THE ONE THING THAT DID NOT CHANGE
 * ------------------------------------------------------------------------
 * 1. SIDES. The operator runs down the left edge behind a 2px accent rule —
 *    the live element on the channel, the same accent the status chip uses.
 *    The customer's own words sit right, inside a `deck-2` block on a
 *    hairline. One side is the channel speaking; the other is what you put
 *    on it. You can tell them apart with the page out of focus.
 * 2. GROUPING. Consecutive turns by one speaker are one group. Only the
 *    first carries a name and a time; the rest are 8px apart, and a new
 *    speaker starts 28px down. That gap is what makes it read as turns.
 * 3. MEASURE. 54ch for the operator, 46ch for the customer. The log ran to
 *    68ch of body at full panel width, which is a document measure.
 * 4. TIMESTAMPS ARE SUBORDINATE. `text-tele-xs` faint, beside the name on
 *    the group head only, never on its own row. The house still reads the
 *    time in its own format; it just stops shouting it once per line.
 *
 * NOT CHANGED, deliberately: no bubbles, no radius, no avatars, no emoji,
 * no tinted "sent" green. The body is still set in the shell's body role,
 * names and times are still uppercase monospace telemetry, and the accent
 * is still only ever on the live side.
 *
 * ------------------------------------------------------------------------
 * THE DOUBLED OPENING LINE
 * ------------------------------------------------------------------------
 * The channel opened with Mission Control's greeting printed twice, one
 * under the other. The cause is server-side — two concurrent first loads
 * both found an empty transcript and both seeded it, which is fixed in
 * app/api/comms/[code]/route.ts — but transcripts written before that fix
 * still carry the duplicate row. `collapse()` below drops a message that
 * repeats the one directly above it verbatim from the same speaker, so a
 * transcript already holding the doubled greeting reads correctly. A
 * customer sending the same sentence twice on purpose is separated by an
 * operator reply and is never collapsed.
 */

const SPEAKER: Record<CommsRole, string> = {
  OPERATOR: 'MISSION CONTROL',
  CUSTOMER: 'YOU',
  SYSTEM: 'SYSTEM',
};

export interface TranscriptEntry extends CommsMessageDTO {
  /** Optimistically appended, not yet acknowledged by the server. */
  pending?: boolean;
}

/** Drops a verbatim repeat of the line directly above it. See the note above. */
function collapse(entries: TranscriptEntry[]): TranscriptEntry[] {
  return entries.filter((entry, i) => {
    const prev = entries[i - 1];
    return !prev || prev.role !== entry.role || prev.body !== entry.body;
  });
}

/* ------------------------------------------------------------------ */
/* Time                                                               */
/* ------------------------------------------------------------------ */

/**
 * `14:58 UTC`. The house `formatTelemetryTimestamp` returns
 * `14:58PM 23.08.2026`, which is correct for a data row on the file and
 * wrong twice over on a message: the date repeats on every single line, and
 * it is 19 characters, so on a phone the time is wider than half the
 * customer's own message block. It also reads `14:58PM`, a 24-hour clock
 * carrying a meridiem.
 *
 * The date has not been dropped — it has been promoted to a day divider
 * across the thread, which is where a conversation puts it and which costs
 * one line per day instead of one field per message.
 */
function clock(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '--:-- UTC';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** UTC calendar day, for deciding where a day divider goes. */
function dayKey(at: string): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function CommsTranscript({
  entries,
  composing,
  /** Rendered at the foot of the thread, inside the scroller but outside the
   *  live region — the one-tap replies belong at the end of the conversation,
   *  and interactive controls do not belong inside `role="log"`. */
  footer,
  className,
}: {
  entries: TranscriptEntry[];
  /** True while the operator's reply is in flight. */
  composing: boolean;
  footer?: ReactNode;
  className?: string;
}) {
  const thread = collapse(entries);

  // Only the newest operator line streams, and only once: polling re-renders
  // the same transcript every 15s and a message must not retype itself.
  const newestOperatorId =
    [...thread].reverse().find((e) => e.role === 'OPERATOR' && !e.pending)?.id ?? null;
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * FOLLOW THE THREAD BY SCROLLING THIS PANEL, NEVER THE DOCUMENT.
   *
   * `scrollIntoView` — even with `block: 'nearest'` — walks every scrollable
   * ancestor, so on first mount it dragged the whole page down to the comms
   * section: opening a mission jumped past the timeline. Setting `scrollTop`
   * on the container touches nothing outside it.
   *
   * A one-shot effect keyed on the message count is not enough. The newest
   * operator reply types itself in, so the content keeps growing for a second
   * or two after that effect has run: the thread settled with the last line
   * cut in half and the suggested replies at the foot never came into view at
   * all. A ResizeObserver on the content follows every one of those frames.
   *
   * It follows only while the reader is already at the foot (within 64px):
   * scrolling up to re-read something must not be yanked back down.
   */
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = listRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;

    let pinned = true;
    const follow = () => {
      if (pinned) scroller.scrollTop = scroller.scrollHeight;
    };
    const onScroll = () => {
      pinned = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 64;
    };

    follow();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(follow);
    observer.observe(content);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, []);

  let previousDay = '';

  return (
    <div
      ref={listRef}
      className={cn(
        'overflow-y-auto overscroll-contain px-4 py-6 sm:px-6',
        'max-h-[52svh] min-h-[15rem] sm:max-h-[27rem]',
        className,
      )}
    >
      <div ref={contentRef}>
        <ol
          role="log"
          aria-live="polite"
          aria-label="Mission comms transcript"
          className="flex flex-col"
        >
          {thread.map((entry, i) => {
            const day = dayKey(entry.at);
            const newDay = day !== previousDay;
            previousDay = day;
            return (
              <Turn
                key={entry.id}
                entry={entry}
                head={newDay || thread[i - 1]?.role !== entry.role}
                day={newDay ? formatTelemetryDate(entry.at) : null}
                streamId={newestOperatorId}
              />
            );
          })}
        </ol>

        {composing ? <ComposingIndicator /> : null}
        {footer}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One turn                                                           */
/* ------------------------------------------------------------------ */

function Turn({
  entry,
  head,
  day,
  streamId,
}: {
  entry: TranscriptEntry;
  /** First turn of a run by this speaker — the one that carries the name. */
  head: boolean;
  /** Set on the first turn of a calendar day; renders a divider above it. */
  day: string | null;
  streamId: string | null;
}) {
  const stamp = entry.pending ? 'SENDING' : clock(entry.at);
  // A turn opening a new day already has the divider's own air above it, so
  // it does not also take the between-speakers gap.
  const gap = day ? 'mt-4' : head ? 'mt-7 first:mt-0' : 'mt-2';

  const body =
    entry.role === 'SYSTEM' ? (
      <Marker>{entry.body}</Marker>
    ) : entry.role === 'CUSTOMER' ? (
      <li
        className={cn(
          // `w-fit` so a three-word message is a three-word block rather than
          // a full-width one pushed right by its own padding.
          'ml-auto w-fit max-w-[46ch] border border-hairline bg-deck-2 px-4 py-3',
          gap,
          entry.pending && 'opacity-60',
        )}
      >
        {head ? (
          <p className="mb-1.5 flex items-baseline justify-end gap-3">
            {/* One step brighter than the operator's stamp, because this
                one sits on the tinted block: `paper-faint` on `deck-2` is
                4.57:1, which clears AA but only just, and this is 9px type. */}
            <Stamp value={stamp} dim />
            <span className="font-mono text-tele-s uppercase text-paper-dim">
              {SPEAKER.CUSTOMER}
            </span>
          </p>
        ) : null}
        <p className="break-words whitespace-pre-wrap text-body text-paper">{entry.body}</p>
      </li>
    ) : (
      <li className={cn('max-w-[54ch] border-l-2 border-signal/40 pl-4 sm:pl-5', gap)}>
        {head ? (
          <p className="mb-1.5 flex items-baseline gap-3">
            <span className="font-mono text-tele-s uppercase text-signal">
              {SPEAKER.OPERATOR}
            </span>
            <Stamp value={stamp} />
          </p>
        ) : null}
        <p className="break-words whitespace-pre-wrap text-body text-paper">
          {entry.id === streamId ? <OperatorBody body={entry.body} /> : entry.body}
        </p>
      </li>
    );

  if (!day) return body;
  return (
    <>
      <Marker>{day}</Marker>
      {body}
    </>
  );
}

/**
 * A line across the whole thread: the day a run of messages belongs to, or a
 * system note, which is neither side of the conversation. Rules to the edges
 * so it reads as a break in the exchange rather than as a turn in it.
 */
function Marker({ children }: { children: ReactNode }) {
  return (
    <li className="mt-7 flex items-center gap-3 first:mt-0">
      <span aria-hidden className="h-px flex-1 bg-hairline-soft" />
      <span className="font-mono text-tele-xs uppercase break-words text-paper-faint">
        {children}
      </span>
      <span aria-hidden className="h-px flex-1 bg-hairline-soft" />
    </li>
  );
}

/** The time, subordinate: 9px monospace, tertiary ink, never on its own row. */
function Stamp({ value, dim = false }: { value: string; dim?: boolean }) {
  return (
    <span
      data-telemetry
      className={cn(
        'shrink-0 font-mono text-tele-xs uppercase tabular-nums',
        dim ? 'text-paper-dim' : 'text-paper-faint',
      )}
    >
      {value}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* OPERATOR IS COMPOSING                                              */
/* ------------------------------------------------------------------ */

/**
 * Three monospace cells that fill and empty left to right. Not bouncing dots —
 * this is a channel indicator, the same visual language as the level meter on
 * the voice link. It sits on the operator's side, behind the operator's rule,
 * because that is who is typing.
 */
const COMPOSING_FRAMES = ['█░░', '██░', '███', '░██', '░░█', '░░░'] as const;

function ComposingIndicator() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    // Reduced motion gets a static three-cell stamp rather than nothing at all.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFrame(2);
      return;
    }
    const id = window.setInterval(
      () => setFrame((f) => (f + 1) % COMPOSING_FRAMES.length),
      260,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="mt-7 flex max-w-[54ch] items-center gap-3 border-l-2 border-signal/40 pl-4 sm:pl-5">
      <span
        aria-hidden
        className="font-mono text-[0.75rem] leading-none tracking-[0.3em] text-signal"
      >
        {COMPOSING_FRAMES[frame]}
      </span>
      <span className="font-mono text-tele-s uppercase text-paper-faint">
        MISSION CONTROL IS TYPING
      </span>
    </div>
  );
}

/**
 * The operator's newest reply arrives progressively rather than as a block —
 * a transmission being received, not a paragraph appearing. Streaming is
 * word-paced by `useStreamingText` (vendored from interior[.]dev, MIT) and it
 * honours prefers-reduced-motion internally, resolving to the full text at
 * once. `streamedOnce` guards against a poll re-typing a message the reader
 * has already seen.
 */
function OperatorBody({ body }: { body: string }) {
  const streamedOnce = useRef(false);
  const [replay] = useState(() => !streamedOnce.current);
  const { visible, status } = useStreamingText({
    text: body,
    tokensPerSecond: 26,
    autoStart: replay,
  });
  useEffect(() => {
    if (status === 'done') streamedOnce.current = true;
  }, [status]);
  return <>{replay ? visible : body}</>;
}
