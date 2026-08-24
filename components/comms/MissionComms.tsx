'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HairlineFrame, Skeleton, StatusChip } from '@/components/fui';
import type { CommsMessageDTO, MissionStage } from '@/lib/types';
import { PUBLIC_MOCK_MODE } from '@/lib/env';
import { cn } from '@/lib/utils';
import { CommsButton } from './CommsButton';
import { CommsComposer } from './CommsComposer';
import { CommsTranscript, type TranscriptEntry } from './CommsTranscript';
import { VoiceLinkDialog } from './VoiceLinkDialog';
import { suggestionsFor } from './suggestions';

/**
 * MISSION COMMS — the whole channel in one mount.
 *
 *   <MissionComms missionCode="32BF" stage="CAPTURE_WINDOW" />
 *
 * Self-contained by contract: it loads its own transcript, sends its own
 * messages, and owns the voice link. Mission Control mounts exactly this.
 *
 * `readOnly` is the shared-view mode: transcript visible, composer and voice
 * control withheld, with one line saying so.
 *
 * ------------------------------------------------------------------------
 * THE SHAPE, AND WHY IT CHANGED
 * ------------------------------------------------------------------------
 * This used to be five stacked rails — status, log, SUGGESTED QUERIES,
 * composer, AUDIO ESCALATION — so the conversation ran with two full-width
 * blocks bolted under it and the thread was the smallest thing in its own
 * panel. It is now three:
 *
 *   HEADER    who is on station, and the voice control
 *   THREAD    the conversation (<CommsTranscript />), with the one-tap
 *             replies at the foot of it, on the customer's side, where a
 *             suggested reply actually belongs
 *   COMPOSER  the field, the transmit control, and one honest line about
 *             what is simulated
 *
 * THE VOICE CONTROL IS IN THE HEADER. It is the second way to reach the same
 * desk, so it belongs beside "operator on station" and not at the bottom of
 * a stack of rails under the thread — the place every messaging surface in
 * the world puts a call control. <VoiceLinkDialog /> and
 * `lib/integrations/voice.ts` (the ElevenLabs Conversational AI adapter) are
 * unchanged; this is a surfacing change, not a second integration.
 *
 * MOCK MODE IS STATED, NOT IMPLIED. The old channel said `SIM CHANNEL` in
 * 10px monospace at the top right, which is a code, not a disclosure. The
 * footnote under the composer says it in a sentence, covering both the
 * scripted operator and the fact that no microphone is opened. The dialog
 * repeats it at the point of use.
 */

interface CommsResponse {
  messages?: CommsMessageDTO[];
  error?: string;
  detail?: string;
}

const LOAD_ERROR = {
  error: 'CHANNEL DOWN',
  detail:
    'The comms channel could not be opened. The mission file itself is unaffected.',
};

export function MissionComms({
  missionCode,
  stage,
  readOnly = false,
  className,
}: {
  missionCode: string;
  stage: MissionStage;
  readOnly?: boolean;
  className?: string;
}) {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [fault, setFault] = useState<{ error: string; detail: string } | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const tempId = useRef(0);

  /* --- Load the transcript ----------------------------------------- */

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/comms/${missionCode}`, { cache: 'no-store' });
        const data: CommsResponse = await res.json();
        if (cancelled) return;

        if (!res.ok || !data.messages) {
          setFault({ error: data.error ?? LOAD_ERROR.error, detail: data.detail ?? LOAD_ERROR.detail });
        } else {
          setEntries(data.messages);
          setFault(null);
        }
      } catch {
        if (!cancelled) setFault(LOAD_ERROR);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [missionCode, reloadKey]);

  /* --- Transmit ----------------------------------------------------- */

  const send = useCallback(
    async (body: string) => {
      if (sending) return;
      setFault(null);
      setSending(true);

      // Optimistic: the customer's line is on the log before the request lands.
      tempId.current += 1;
      const optimistic: TranscriptEntry = {
        id: `pending-${tempId.current}`,
        role: 'CUSTOMER',
        body,
        at: new Date().toISOString(),
        pending: true,
      };
      setEntries((prev) => [...prev, optimistic]);

      try {
        const res = await fetch(`/api/comms/${missionCode}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body }),
        });
        const data: CommsResponse = await res.json();

        if (!res.ok || !data.messages) {
          // Drop the optimistic line; the message never reached the channel.
          setEntries((prev) => prev.filter((e) => e.id !== optimistic.id));
          setFault({
            error: data.error ?? 'TRANSMISSION FAILED',
            detail: data.detail ?? 'The message did not reach Mission Control. Send it again.',
          });
          return;
        }
        setEntries(data.messages);
      } catch {
        setEntries((prev) => prev.filter((e) => e.id !== optimistic.id));
        setFault({
          error: 'TRANSMISSION FAILED',
          detail: 'The message did not reach Mission Control. Send it again.',
        });
      } finally {
        setSending(false);
      }
    },
    [missionCode, sending],
  );

  /* --- Render -------------------------------------------------------- */

  const suggestions = suggestionsFor(stage);
  // Offered while the thread is short and the last word was the operator's —
  // a suggested reply under your own last message is a prompt to repeat
  // yourself, not a shortcut.
  const showSuggestions =
    !readOnly &&
    !loading &&
    !sending &&
    entries.length < 12 &&
    entries.at(-1)?.role !== 'CUSTOMER';

  return (
    <>
      <HairlineFrame
        as="section"
        label="MISSION COMMS"
        tag={readOnly ? 'READ ONLY' : `MISSION / ${missionCode}`}
        className={cn('bg-void', className)}
        innerClassName="flex flex-col"
      >
        {/* Channel header — who is on station, and the second way to reach
            them. `flex-wrap` so 320 stacks the control under the chip rather
            than crushing either of them. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-hairline px-4 py-3 sm:px-6">
          <StatusChip
            label={readOnly ? 'CHANNEL CLOSED' : 'OPERATOR ON STATION'}
            state={readOnly ? 'pending' : 'active'}
          />
          {readOnly ? (
            <span className="font-mono text-tele-s uppercase text-paper-dim">
              {PUBLIC_MOCK_MODE ? 'SIM CHANNEL' : 'SECURE'}
            </span>
          ) : (
            <CommsButton
              size="sm"
              onClick={() => setVoiceOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={voiceOpen}
            >
              <span aria-hidden className="mr-2.5 font-mono text-signal">
                (( ))
              </span>
              Voice link
            </CommsButton>
          )}
        </div>

        {loading ? (
          <div className="px-4 py-6 sm:px-6">
            <Skeleton lines={3} label="OPENING CHANNEL" />
          </div>
        ) : (
          <CommsTranscript
            entries={entries}
            composing={sending}
            footer={
              showSuggestions ? (
                <div className="mt-8 flex flex-col items-end gap-2.5">
                  <p className="font-mono text-tele-xs uppercase text-paper-faint">
                    SUGGESTED REPLY
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    {suggestions.map((query) => (
                      <button
                        key={query}
                        type="button"
                        onClick={() => void send(query)}
                        className="inline-flex min-h-11 items-center border border-hairline px-4 text-left text-action text-paper-dim transition-house hover:border-paper hover:text-paper"
                      >
                        {query}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null
            }
          />
        )}

        {fault ? (
          <div className="fui-error mx-4 mb-4 px-4 py-4 sm:mx-6" role="alert">
            <p className="font-mono text-tele-s uppercase text-signal">{fault.error}</p>
            <p className="mt-2 max-w-[62ch] text-body text-paper-dim">{fault.detail}</p>
            {entries.length === 0 ? (
              <div className="mt-4">
                <CommsButton onClick={() => setReloadKey((k) => k + 1)}>Retry</CommsButton>
              </div>
            ) : null}
          </div>
        ) : null}

        {readOnly ? (
          <p className="max-w-[62ch] border-t border-hairline px-4 py-5 text-body text-paper-dim sm:px-6">
            This transcript is read-only. Comms with Mission Control are open to the
            mission owner from their own file.
          </p>
        ) : (
          <CommsComposer
            onSend={(body) => void send(body)}
            sending={sending}
            note={
              PUBLIC_MOCK_MODE
                ? 'Simulated channel — the operator is scripted and no microphone is opened while mock mode is on.'
                : null
            }
          />
        )}
      </HairlineFrame>

      {voiceOpen ? (
        <VoiceLinkDialog missionCode={missionCode} onClose={() => setVoiceOpen(false)} />
      ) : null}
    </>
  );
}
