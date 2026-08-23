/**
 * MISSION COMMS — transcript endpoints.
 *
 *   GET  /api/comms/[code]   → { messages: CommsMessageDTO[] }
 *   POST /api/comms/[code]   → { messages: CommsMessageDTO[] }   body: { body: string }
 *
 * The transcript lives in `CommsMessage` (prisma/schema.prisma). A mission with
 * an empty transcript is seeded with one stage-appropriate opening line from
 * MISSION CONTROL, so the channel is never a blank box.
 *
 * Every failure returns `{ error, detail? }` with mission-voice copy. Nothing
 * here can 500 because a key is missing: `operatorReply` degrades to the
 * scripted operator on its own.
 */

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getMissionByCode } from '@/lib/missions';
import { normalizeMissionCode } from '@/lib/codes';
import { operatorReply } from '@/lib/integrations/llm';
import { STAGE_LABEL, type CommsMessageDTO, type CommsRole, type MissionStage } from '@/lib/types';

export const dynamic = 'force-dynamic';

/* ------------------------------------------------------------------ */
/* Wire shapes                                                        */
/* ------------------------------------------------------------------ */

const sendSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

/** Rows the transcript reads. Shaped so the mapping below stays honest. */
interface CommsRow {
  id: string;
  role: string;
  body: string;
  at: Date;
}

function toDTO(row: CommsRow): CommsMessageDTO {
  return {
    id: row.id,
    role: (row.role as CommsRole) ?? 'SYSTEM',
    body: row.body,
    at: row.at.toISOString(),
  };
}

function fail(error: string, detail: string, status: number) {
  return Response.json({ error, detail }, { status });
}

const INVALID_CODE = () =>
  fail(
    'INVALID MISSION CODE',
    'A mission code is two digits followed by two letters, for example 32BF.',
    400,
  );

const NO_MISSION = () =>
  fail(
    'NO MISSION ON FILE',
    'Nothing is filed under that code. Check the code on your confirmation.',
    404,
  );

const CHANNEL_DOWN = () =>
  fail(
    'CHANNEL DOWN',
    'The comms channel could not be reached. The mission file itself is unaffected — try again in a moment.',
    503,
  );

/* ------------------------------------------------------------------ */
/* Opening lines                                                      */
/* ------------------------------------------------------------------ */

/**
 * The single message seeded into an empty transcript. Written per stage so the
 * operator opens on what the customer is actually waiting for.
 */
function openingLine(code: string, stage: MissionStage, locationLabel: string): string {
  const head = `Mission Control on station for ${code}. The file is at ${STAGE_LABEL[stage]}.`;

  switch (stage) {
    case 'MISSION_CONFIRMED':
      return `${head} The target over ${locationLabel} is locked and queued for tasking. Ask about the schedule, the print or the delivery.`;
    case 'SATELLITE_TASKED':
      return `${head} The collection request is accepted and a capture window is being allocated over ${locationLabel}. Ask about the pass, the print or the delivery.`;
    case 'CAPTURE_WINDOW':
      return `${head} The satellite is passing over ${locationLabel} and we are waiting on a frame that clears the cloud threshold. Ask about the pass, the weather or what happens next.`;
    case 'IMAGE_ACQUIRED':
      return `${head} The frame is down and the preview on this file is the downlinked exhibit. Ask about the preview, the grade or the print.`;
    case 'PROCESSING':
      return `${head} The frame is being graded and composed with its telemetry. Ask about the print, the format or the delivery.`;
    case 'PRINT':
      return `${head} The print file is with the production facility. Ask about the paper, the facility or the shipping.`;
    case 'SHIPPED':
      return `${head} The package is with the carrier and tracking is on this file. Ask about the tracking, the delivery date or the address.`;
    case 'FINAL_APPROACH':
      return `${head} The package is out for delivery to your address. Ask about the delivery, the handover or the print itself.`;
    case 'DELIVERED':
      return `${head} It is delivered and the file is closed. Ask about the digital file, hanging the print or a second mission.`;
  }
}

/* ------------------------------------------------------------------ */
/* Rate limit                                                         */
/* ------------------------------------------------------------------ */

/**
 * One transmission per second per mission, in memory. This is a demo-scale
 * guard against a held Enter key, not a security control — a real deployment
 * puts this in a shared store keyed by session as well as mission.
 */
const RATE_WINDOW_MS = 1000;

const rateStore: Map<string, number> = (() => {
  const g = globalThis as typeof globalThis & { __sfsCommsRate?: Map<string, number> };
  g.__sfsCommsRate ??= new Map();
  return g.__sfsCommsRate;
})();

function rateLimited(code: string): boolean {
  const now = Date.now();
  const last = rateStore.get(code) ?? 0;
  if (now - last < RATE_WINDOW_MS) return true;
  rateStore.set(code, now);
  return false;
}

/* ------------------------------------------------------------------ */
/* Shared load                                                        */
/* ------------------------------------------------------------------ */

/**
 * Resolves the mission twice on purpose: `getMissionByCode` gives the DTO the
 * operator reasons over, the prisma row gives the id the transcript is keyed
 * on. Returns null when either is missing.
 */
async function loadMission(code: string) {
  const [mission, row] = await Promise.all([
    getMissionByCode(code),
    prisma.mission.findUnique({ where: { code }, select: { id: true } }),
  ]);
  if (!mission || !row) return null;
  return { mission, missionId: row.id };
}

async function readTranscript(missionId: string): Promise<CommsMessageDTO[]> {
  const rows = await prisma.commsMessage.findMany({
    where: { missionId },
    orderBy: { at: 'asc' },
    select: { id: true, role: true, body: true, at: true },
  });
  return rows.map(toDTO);
}

async function append(
  missionId: string,
  role: CommsRole,
  body: string,
): Promise<CommsMessageDTO> {
  const row = await prisma.commsMessage.create({
    data: { missionId, role, body },
    select: { id: true, role: true, body: true, at: true },
  });
  return toDTO(row);
}

/* ------------------------------------------------------------------ */
/* Seeding — exactly once per mission                                 */
/* ------------------------------------------------------------------ */

/**
 * THE DOUBLED GREETING. `read → if empty, append` is a check-then-act, and
 * two requests can sit inside it at the same time: both read an empty
 * transcript, both append, and the customer opens the channel to Mission
 * Control's opening line printed twice, one under the other, with the same
 * timestamp to the millisecond. It is not hypothetical — mission 56SL had
 * exactly that pair on file, written by the two GETs React fires for one
 * mount in development.
 *
 * Concurrent seeds for one mission now share a single promise, so only the
 * first does the write and every other caller awaits its result. Same scope
 * as the rate limiter above: in-process, demo-scale. A multi-instance
 * deployment wants a unique index on (missionId, role, body) for the opening
 * row, or the seed moved into mission creation where it belongs.
 */
const seedInFlight: Map<string, Promise<CommsMessageDTO[]>> = (() => {
  const g = globalThis as typeof globalThis & {
    __sfsCommsSeed?: Map<string, Promise<CommsMessageDTO[]>>;
  };
  g.__sfsCommsSeed ??= new Map();
  return g.__sfsCommsSeed;
})();

async function readOrSeed(
  missionId: string,
  code: string,
  stage: MissionStage,
  locationLabel: string,
): Promise<CommsMessageDTO[]> {
  const messages = await readTranscript(missionId);
  if (messages.length > 0) return messages;

  const pending = seedInFlight.get(missionId);
  if (pending) return pending;

  const seed = (async () => {
    // Re-read inside the guarded section: a seed may have landed between the
    // read above and the miss on the map.
    const current = await readTranscript(missionId);
    if (current.length > 0) return current;
    const opening = await append(missionId, 'OPERATOR', openingLine(code, stage, locationLabel));
    return [opening];
  })();

  seedInFlight.set(missionId, seed);
  try {
    return await seed;
  } finally {
    seedInFlight.delete(missionId);
  }
}

/* ------------------------------------------------------------------ */
/* GET — read the transcript, seeding it if empty                     */
/* ------------------------------------------------------------------ */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const code = normalizeMissionCode((await params).code ?? '');
  if (!code) return INVALID_CODE();

  try {
    const loaded = await loadMission(code);
    if (!loaded) return NO_MISSION();

    return Response.json({
      messages: await readOrSeed(
        loaded.missionId,
        code,
        loaded.mission.stage,
        loaded.mission.locationLabel,
      ),
    });
  } catch {
    return CHANNEL_DOWN();
  }
}

/* ------------------------------------------------------------------ */
/* POST — transmit, get the operator's reply back                     */
/* ------------------------------------------------------------------ */

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const code = normalizeMissionCode((await params).code ?? '');
  if (!code) return INVALID_CODE();

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return fail(
      'MALFORMED TRANSMISSION',
      'The message could not be read. Send it again.',
      400,
    );
  }

  const parsed = sendSchema.safeParse(payload);
  if (!parsed.success) {
    return fail(
      'TRANSMISSION REJECTED',
      'A transmission carries between one and one thousand characters. Shorten it and send again.',
      400,
    );
  }

  if (rateLimited(code)) {
    return fail(
      'CHANNEL SATURATED',
      'One transmission per second on this channel. Send that again.',
      429,
    );
  }

  try {
    const loaded = await loadMission(code);
    if (!loaded) return NO_MISSION();

    const { mission, missionId } = loaded;

    // Seed the opening line if this is the first thing ever sent, so the
    // transcript still reads as a channel that was already open. Shares the
    // guard above, so a first send racing a first load cannot double it.
    const history = await readOrSeed(missionId, code, mission.stage, mission.locationLabel);

    await append(missionId, 'CUSTOMER', parsed.data.body);

    const reply = await operatorReply(parsed.data.body, {
      missionCode: mission.code,
      stage: mission.stage,
      locationLabel: mission.locationLabel,
      capturedAt: mission.capturedAt,
      windowOpensAt: mission.windowOpensAt,
      windowClosesAt: mission.windowClosesAt,
      printFacility: mission.printFacility,
      trackingNumber: mission.trackingNumber,
      estimatedDeliveryAt: mission.estimatedDeliveryAt,
      history,
    });

    await append(missionId, 'OPERATOR', reply.body);

    return Response.json({ messages: await readTranscript(missionId) });
  } catch {
    return CHANNEL_DOWN();
  }
}
