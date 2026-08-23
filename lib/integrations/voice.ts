/**
 * MISSION CONTROL — voice link adapter.
 *
 * The voice link is the escalation path out of the text comms channel: an
 * audio line to a Mission Control operator with the mission file already open.
 *
 * Two paths:
 *
 *   MOCK  (default)  A full connection lifecycle with no audio. `requestVoiceLink`
 *         holds for the handshake and returns a LIVE session with a named
 *         operator persona chosen deterministically from the mission code, so
 *         the same mission always reaches the same operator. `endVoiceLink`
 *         closes it and reports the duration. No microphone is opened, no audio
 *         is streamed, and the UI says so.
 *
 *   LIVE  (MOCK_MODE=false + ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID)
 *         ElevenLabs Conversational AI. The server mints a signed WebSocket URL
 *         and hands it to the browser, which attaches its microphone to that
 *         socket. Implemented below, inactive until `isLive('elevenlabs')`.
 *
 * This module never throws. Anything that fails returns an UNAVAILABLE session
 * with copy the UI can render as-is.
 */

import { INTEGRATIONS, isLive } from '@/lib/env';
import type { MissionStage, VoiceLinkState } from '@/lib/types';
import { seededUnit, sleep } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Public surface                                                     */
/* ------------------------------------------------------------------ */

export interface VoiceSession {
  id: string;
  state: VoiceLinkState;
  /** Operator callsign shown on the call panel, e.g. "OPERATOR / K. RAND". */
  operator: string;
  /** ISO timestamp the line went LIVE, null until then. */
  startedAt: string | null;
  /** Written back to the comms transcript after the call. Null while live. */
  transcriptUrl: string | null;
  /** One line of mission-voice copy for the panel. Never an error object. */
  note: string;
  source: 'mock' | 'live';
}

/* ------------------------------------------------------------------ */
/* Session store                                                      */
/* ------------------------------------------------------------------ */

interface StoredSession extends VoiceSession {
  missionCode: string;
  /** Epoch ms the line went LIVE. */
  liveAt: number | null;
  endedAt: number | null;
  /**
   * Live path only: the signed WebSocket URL the browser attaches to. It is a
   * short-lived credential — it is handed to exactly one client and never
   * written to the transcript or logged.
   */
  signedUrl?: string;
}

/**
 * In-memory, module-scoped. Voice sessions are ephemeral by nature: a process
 * restart drops the line, which is the correct behaviour. Pinned to
 * globalThis so Next's dev HMR does not orphan live sessions.
 */
const store: Map<string, StoredSession> = (() => {
  const g = globalThis as typeof globalThis & { __sfsVoiceSessions?: Map<string, StoredSession> };
  g.__sfsVoiceSessions ??= new Map();
  return g.__sfsVoiceSessions;
})();

/* ------------------------------------------------------------------ */
/* Operator personas                                                  */
/* ------------------------------------------------------------------ */

/**
 * Callsigns, not names. Deterministic per mission so a customer who reconnects
 * gets the same operator, which is what makes it read as a real desk.
 */
const OPERATORS = [
  'OPERATOR / K. RAND',
  'OPERATOR / M. VOSS',
  'OPERATOR / D. HALDANE',
  'OPERATOR / S. ORTEGA',
  'OPERATOR / N. FAROUK',
  'OPERATOR / T. LINDQVIST',
] as const;

function operatorFor(missionCode: string): string {
  return OPERATORS[Math.floor(seededUnit(`voice:${missionCode}`) * OPERATORS.length) % OPERATORS.length];
}

/** ~1.5s handshake, varied deterministically so it is not metronomic. */
function handshakeMs(missionCode: string): number {
  return 1200 + Math.round(seededUnit(`handshake:${missionCode}`) * 600);
}

function sessionId(missionCode: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  return `VL-${missionCode}-${stamp}`;
}

/** Public view of a stored session — never leaks the signed URL. */
function toPublic(s: StoredSession): VoiceSession {
  return {
    id: s.id,
    state: s.state,
    operator: s.operator,
    startedAt: s.startedAt,
    transcriptUrl: s.transcriptUrl,
    note: s.note,
    source: s.source,
  };
}

function unavailable(missionCode: string, note: string): VoiceSession {
  return {
    id: sessionId(missionCode),
    state: 'UNAVAILABLE',
    operator: 'MISSION CONTROL',
    startedAt: null,
    transcriptUrl: null,
    note,
    source: 'mock',
  };
}

/** mm:ss for the note on an ended call. */
function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/* ------------------------------------------------------------------ */
/* Request                                                            */
/* ------------------------------------------------------------------ */

export async function requestVoiceLink(ctx: {
  missionCode: string;
  stage: MissionStage;
}): Promise<VoiceSession> {
  const { missionCode } = ctx;

  if (isLive('elevenlabs')) {
    const live = await openLiveVoiceLink(ctx);
    if (live) return live;
    return unavailable(
      missionCode,
      'The voice link is not answering. Keep the question on this channel and an operator picks it up here.',
    );
  }

  // --- MOCK: REQUESTING -> CONNECTING -> LIVE ------------------------
  const id = sessionId(missionCode);
  const operator = operatorFor(missionCode);

  const session: StoredSession = {
    id,
    missionCode,
    state: 'CONNECTING',
    operator,
    startedAt: null,
    transcriptUrl: null,
    note: 'Routing to a Mission Control desk.',
    source: 'mock',
    liveAt: null,
    endedAt: null,
  };
  store.set(id, session);

  // The handshake. The client renders REQUESTING the moment the control is
  // pressed and CONNECTING while this resolves, so all three states are seen.
  await sleep(handshakeMs(missionCode));

  session.state = 'LIVE';
  session.liveAt = Date.now();
  session.startedAt = new Date(session.liveAt).toISOString();
  session.note = `${operator} is on the line with mission ${missionCode} open.`;

  return toPublic(session);
}

/* ------------------------------------------------------------------ */
/* End                                                                */
/* ------------------------------------------------------------------ */

export async function endVoiceLink(id: string): Promise<VoiceSession> {
  const session = store.get(id);

  if (!session) {
    // Nothing on file — an already-closed or process-restarted line. Report it
    // as ended rather than as an error: the customer hung up either way.
    return {
      id,
      state: 'ENDED',
      operator: 'MISSION CONTROL',
      startedAt: null,
      transcriptUrl: null,
      note: 'Line closed. No session was on file.',
      source: 'mock',
    };
  }

  if (session.source === 'live') {
    await closeLiveVoiceLink(session);
  }

  const endedAt = Date.now();
  const elapsed = session.liveAt ? endedAt - session.liveAt : 0;

  session.state = 'ENDED';
  session.endedAt = endedAt;
  session.signedUrl = undefined;
  session.note = session.liveAt
    ? `Line closed after ${duration(elapsed)}. A summary is written to this transcript.`
    : 'Line closed before the operator answered.';
  // The written-back summary lands on the mission comms transcript.
  session.transcriptUrl = `/m/${session.missionCode}#comms`;

  return toPublic(session);
}

/* ------------------------------------------------------------------ */
/* LIVE — ElevenLabs Conversational AI                                */
/* ------------------------------------------------------------------ */

/**
 * THE call that returns the signed URL.
 *
 *   GET https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id={AGENT_ID}
 *   header: xi-api-key: {ELEVENLABS_API_KEY}
 *   200  ->  { "signed_url": "wss://api.elevenlabs.io/v1/convai/conversation?..." }
 *
 * The signed URL is short-lived (minutes) and single-use. It MUST be minted
 * server-side: the API key never reaches the browser.
 */
const ELEVENLABS_SIGNED_URL_ENDPOINT =
  'https://api.elevenlabs.io/v1/convai/conversation/get-signed-url';
const LIVE_TIMEOUT_MS = 8_000;

interface SignedUrlResponse {
  signed_url?: string;
}

async function openLiveVoiceLink(ctx: {
  missionCode: string;
  stage: MissionStage;
}): Promise<VoiceSession | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);

  try {
    const url = `${ELEVENLABS_SIGNED_URL_ENDPOINT}?agent_id=${encodeURIComponent(
      INTEGRATIONS.elevenlabs.agentId,
    )}`;

    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'xi-api-key': INTEGRATIONS.elevenlabs.apiKey },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as SignedUrlResponse;
    if (!data.signed_url) return null;

    const id = sessionId(ctx.missionCode);
    const operator = operatorFor(ctx.missionCode);
    const session: StoredSession = {
      id,
      missionCode: ctx.missionCode,
      state: 'CONNECTING',
      operator,
      startedAt: null,
      transcriptUrl: null,
      note: 'Signed line issued. Attaching audio.',
      source: 'live',
      liveAt: null,
      endedAt: null,
      signedUrl: data.signed_url,
    };
    store.set(id, session);

    // ------------------------------------------------------------------
    // WHERE THE BROWSER SDK ATTACHES
    //
    // The route returns this session plus `signedUrl` (add it to the JSON in
    // app/api/comms/[code]/voice/route.ts when the live path is switched on —
    // it is deliberately withheld today). The client then opens the socket:
    //
    //   const conversation = await Conversation.startSession({
    //     signedUrl,                                  // from this function
    //     onConnect:      () => setState('LIVE'),
    //     onDisconnect:   () => setState('ENDED'),
    //     onModeChange:   ({ mode }) => setSpeaking(mode === 'speaking'),
    //     onError:        () => setState('UNAVAILABLE'),
    //   });
    //   conversation.setVolume({ volume: muted ? 0 : 1 });
    //   await conversation.endSession();
    //
    // That is `@elevenlabs/client` (or `@elevenlabs/react`'s `useConversation`).
    // It is NOT installed — CONTRACT.md §11 forbids adding packages during the
    // build. VoiceLinkDialog's `level`/`muted`/`elapsed` state is already shaped
    // to be driven by `onModeChange` and `setVolume`; swapping the mock level
    // generator for the SDK callbacks is the only client-side change.
    //
    // Dynamic-variable injection (so the agent knows the mission) goes on
    // `startSession` as `dynamicVariables: { mission_code, stage, ... }`, or on
    // the agent's server-side webhook. Mission facts must be injected the same
    // way llm.ts injects them: the agent is told the state and forbidden to
    // invent it.
    // ------------------------------------------------------------------

    session.state = 'LIVE';
    session.liveAt = Date.now();
    session.startedAt = new Date(session.liveAt).toISOString();
    session.note = `${operator} is on the line with mission ${ctx.missionCode} open.`;

    return toPublic(session);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Live teardown. The browser owns the socket, so ending it is a client call
 * (`conversation.endSession()`); this side only releases server state. If a
 * conversation-level DELETE is ever needed it goes here:
 *   DELETE https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}
 */
async function closeLiveVoiceLink(session: StoredSession): Promise<void> {
  session.signedUrl = undefined;
}

/* ------------------------------------------------------------------ *
 * GOING LIVE
 *
 * 1. Set MOCK_MODE=false.
 * 2. Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID.
 * 3. Install `@elevenlabs/client` and attach it in VoiceLinkDialog at the
 *    marker above.
 * 4. Return `signedUrl` from POST /api/comms/[code]/voice — it is withheld
 *    today because nothing in the browser can use it yet.
 *
 * Production also needs: an authorisation check on the route so a signed URL
 * is only minted for the mission's owner, and a concurrency cap per mission.
 * ------------------------------------------------------------------ */
