'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CropMarks, StatusChip } from '@/components/fui';
import type { VoiceSession } from '@/lib/integrations/voice';
import type { VoiceLinkState } from '@/lib/types';
import { PUBLIC_MOCK_MODE } from '@/lib/env';
import { cn, seededUnit } from '@/lib/utils';
import { CommsButton } from './CommsButton';

/**
 * The voice link call panel. Bottom sheet on a phone, centred plate on desktop.
 *
 * It owns the whole session lifecycle: REQUESTING on mount, CONNECTING while
 * the handshake resolves, LIVE with a running timer and a level meter, then
 * ENDED with a duration. The meter is a monospace readout driven by the mocked
 * session state — there is no waveform library and no audio element anywhere in
 * this file.
 *
 * Dialog semantics: role="dialog", aria-modal, focus moved in on open, Tab
 * trapped inside, Esc closes, focus restored to the trigger on close.
 *
 * Form: a bottom sheet on a phone — full width, flush to the bottom edge, safe
 * area respected — and a centred 440px plate on desktop. One 1px rule, no
 * radius, no shadow. Readouts are monospace telemetry; everything the customer
 * reads or presses is shell UI in sentence case.
 */

const METER_CELLS = 20;
const METER_TICK_MS = 110;
const FILLED = '█';
const EMPTY = '░';

const STATE_LABEL: Record<VoiceLinkState, string> = {
  IDLE: 'STANDBY',
  REQUESTING: 'REQUESTING LINK',
  CONNECTING: 'ROUTING',
  LIVE: 'LINE OPEN',
  ENDED: 'LINE CLOSED',
  UNAVAILABLE: 'NO DESK ANSWERING',
};

const UNAVAILABLE_NOTE =
  'No desk answered. Keep the question on the text channel — an operator picks it up there.';

export function VoiceLinkDialog({
  missionCode,
  onClose,
}: {
  missionCode: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<VoiceLinkState>('REQUESTING');
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [note, setNote] = useState<string>('Opening a line to a Mission Control desk.');
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const panelRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<VoiceSession | null>(null);
  const liveRef = useRef(false);

  sessionRef.current = session;
  liveRef.current = state === 'LIVE';

  /* --- Connection ------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    // REQUESTING is visible for a beat before CONNECTING, so the three states
    // read as a sequence rather than a flicker.
    const toConnecting = window.setTimeout(() => {
      if (!cancelled) setState((s) => (s === 'REQUESTING' ? 'CONNECTING' : s));
    }, 420);

    (async () => {
      try {
        const res = await fetch(`/api/comms/${missionCode}/voice`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'request' }),
        });
        const data: { session?: VoiceSession; detail?: string } = await res.json();
        if (cancelled) return;

        if (!res.ok || !data.session) {
          setState('UNAVAILABLE');
          setNote(data.detail ?? UNAVAILABLE_NOTE);
          return;
        }
        setSession(data.session);
        setState(data.session.state);
        setNote(data.session.note);
      } catch {
        if (cancelled) return;
        setState('UNAVAILABLE');
        setNote(UNAVAILABLE_NOTE);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(toConnecting);
    };
  }, [missionCode]);

  /* --- Call timer -------------------------------------------------- */

  useEffect(() => {
    if (state !== 'LIVE' || !session?.startedAt) return;
    const startedAt = new Date(session.startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [state, session?.startedAt]);

  /* --- End --------------------------------------------------------- */

  const endLink = useCallback(async () => {
    const current = sessionRef.current;
    setState('ENDED');
    if (!current) return;
    try {
      const res = await fetch(`/api/comms/${missionCode}/voice`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'end', sessionId: current.id }),
      });
      const data: { session?: VoiceSession } = await res.json();
      if (data.session) {
        setSession(data.session);
        setNote(data.session.note);
      }
    } catch {
      setNote('Line closed.');
    }
  }, [missionCode]);

  const close = useCallback(() => {
    if (liveRef.current) void endLink();
    onClose();
  }, [endLink, onClose]);

  // The dialog re-renders whenever the meter or the timer ticks, and `onClose`
  // is a fresh closure from the parent each time. Holding `close` in a ref lets
  // the focus-trap effect below run exactly once — otherwise its cleanup would
  // restore focus to the trigger mid-call.
  const closeRef = useRef(close);
  closeRef.current = close;

  // Hanging up by navigating away still releases the session server-side.
  useEffect(() => {
    return () => {
      const current = sessionRef.current;
      if (!liveRef.current || !current) return;
      void fetch(`/api/comms/${missionCode}/voice`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'end', sessionId: current.id }),
        keepalive: true,
      }).catch(() => {});
    };
  }, [missionCode]);

  /* --- Dialog behaviour -------------------------------------------- */

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('[data-autofocus]')?.focus();

    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panel?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  /* --- Render ------------------------------------------------------ */

  const connecting = state === 'REQUESTING' || state === 'CONNECTING';
  const operator = session?.operator ?? 'MISSION CONTROL';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-void/90 sm:items-center sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-link-title"
        className="relative w-full border-t border-hairline bg-void pb-[env(safe-area-inset-bottom)] sm:max-w-[440px] sm:border sm:pb-0"
      >
        <CropMarks length={10} inset={-1} />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3 sm:px-5">
          <h2 id="voice-link-title" className="font-mono text-tele-s uppercase text-paper">
            VOICE LINK / {missionCode}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close the voice link panel"
            className="-mr-1 flex h-11 w-11 items-center justify-center font-mono text-[0.875rem] text-paper-faint transition-colors hover:text-paper"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <div className="flex flex-col gap-5 px-4 py-5 sm:px-5">
          {/* Status + timer */}
          <div className="flex items-center justify-between gap-3">
            <StatusChip
              label={STATE_LABEL[state]}
              state={
                state === 'LIVE'
                  ? 'active'
                  : state === 'UNAVAILABLE'
                    ? 'alert'
                    : state === 'ENDED'
                      ? 'done'
                      : 'pending'
              }
            />
            <span
              data-telemetry
              className={cn(
                'font-mono text-tele-s uppercase tabular-nums',
                state === 'LIVE' ? 'text-paper' : 'text-paper-faint',
              )}
            >
              {formatDuration(elapsed)}
            </span>
          </div>

          {/* Operator callsign */}
          <div>
            <p className="text-label uppercase text-paper-faint">On station</p>
            <p className="mt-2 font-mono text-[0.9375rem] uppercase leading-[1.3] tracking-[0.1em] text-paper">
              {connecting ? 'ROUTING TO A DESK' : operator}
            </p>
          </div>

          {/* Level meter */}
          <LevelMeter
            sessionId={session?.id ?? missionCode}
            active={state === 'LIVE' && !muted}
          />

          {/* Note */}
          <p
            className={cn(
              'max-w-[46ch] text-body',
              state === 'UNAVAILABLE' ? 'fui-error px-4 py-3 text-paper' : 'text-paper-dim',
            )}
          >
            {note}
          </p>

          {/* §A2. Two clauses joined by "while", with a passive verb
              phrase in the second — a sentence, not a status label. */}
          {PUBLIC_MOCK_MODE ? (
            <p className="border-t border-hairline pt-4 text-note text-paper-faint">
              Audio simulated — no microphone is opened while mock mode is on.
            </p>
          ) : null}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 border-t border-hairline px-4 py-4 sm:px-5">
          {state === 'ENDED' || state === 'UNAVAILABLE' ? (
            <CommsButton data-autofocus variant="primary" className="flex-1" onClick={onClose}>
              Close
            </CommsButton>
          ) : (
            <>
              <CommsButton
                className="flex-1"
                disabled={state !== 'LIVE'}
                aria-pressed={muted}
                onClick={() => setMuted((m) => !m)}
              >
                {muted ? 'Unmute' : 'Mute'}
              </CommsButton>
              <CommsButton
                data-autofocus
                variant="primary"
                className="flex-1"
                onClick={() => void endLink()}
              >
                End link
              </CommsButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Level meter                                                        */
/* ------------------------------------------------------------------ */

/**
 * A monospace level readout, not a waveform. The level is generated
 * deterministically from the session id and a frame counter, with a slow
 * envelope over a fast carrier so it reads as speech rather than noise.
 * Muting parks it at zero; reduced motion parks it at a static level.
 */
function LevelMeter({ sessionId, active }: { sessionId: string; active: boolean }) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLevel(0.4);
      return;
    }
    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      const envelope = seededUnit(`${sessionId}:env:${Math.floor(frame / 9)}`);
      const carrier = seededUnit(`${sessionId}:car:${frame}`);
      setLevel(Math.min(1, 0.12 + envelope * 0.55 + carrier * 0.4));
    }, METER_TICK_MS);
    return () => window.clearInterval(id);
  }, [sessionId, active]);

  const filled = Math.round(level * METER_CELLS);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-tele-s uppercase text-paper-faint">INBOUND AUDIO</span>
        <span
          data-telemetry
          className="font-mono text-tele-s uppercase tabular-nums text-paper-faint"
        >
          {String(Math.round(level * 100)).padStart(3, '0')}%
        </span>
      </div>
      <p
        aria-hidden
        className="mt-2 overflow-hidden font-mono text-[0.8125rem] leading-none tracking-[0.12em] whitespace-nowrap"
      >
        {Array.from({ length: METER_CELLS }).map((_, i) => (
          <span
            key={i}
            className={
              i < filled
                ? i > METER_CELLS - 5
                  ? 'text-signal'
                  : 'text-paper'
                : 'text-paper-faint/40'
            }
          >
            {i < filled ? FILLED : EMPTY}
          </span>
        ))}
      </p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
