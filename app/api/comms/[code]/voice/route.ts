/**
 * MISSION COMMS — voice link control.
 *
 *   POST /api/comms/[code]/voice   body: { action: 'request' | 'end', sessionId?: string }
 *                                  → { session: VoiceSession }
 *
 * `request` holds for the connection handshake and resolves LIVE.
 * `end` closes the line and reports the duration in the session note.
 *
 * The signed WebSocket URL minted on the live path is deliberately NOT returned:
 * nothing in the browser can consume it until the ElevenLabs client is
 * installed. See lib/integrations/voice.ts.
 */

import { z } from 'zod';
import { getMissionByCode } from '@/lib/missions';
import { normalizeMissionCode } from '@/lib/codes';
import { endVoiceLink, requestVoiceLink } from '@/lib/integrations/voice';

export const dynamic = 'force-dynamic';

const controlSchema = z.object({
  action: z.enum(['request', 'end']),
  sessionId: z.string().min(1).max(120).optional(),
});

function fail(error: string, detail: string, status: number) {
  return Response.json({ error, detail }, { status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const code = normalizeMissionCode((await params).code ?? '');
  if (!code) {
    return fail(
      'INVALID MISSION CODE',
      'A mission code is two digits followed by two letters, for example 32BF.',
      400,
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return fail('MALFORMED REQUEST', 'The voice link control could not be read.', 400);
  }

  const parsed = controlSchema.safeParse(payload);
  if (!parsed.success) {
    return fail(
      'UNKNOWN CONTROL',
      'The voice link accepts REQUEST and END only.',
      400,
    );
  }

  try {
    if (parsed.data.action === 'end') {
      if (!parsed.data.sessionId) {
        return fail(
          'NO SESSION ON FILE',
          'Ending a line needs the session it belongs to.',
          400,
        );
      }
      const ended = await endVoiceLink(parsed.data.sessionId);
      return Response.json({ session: ended, state: ended.state });
    }

    const mission = await getMissionByCode(code);
    if (!mission) {
      return fail(
        'NO MISSION ON FILE',
        'Nothing is filed under that code. Check the code on your confirmation.',
        404,
      );
    }

    const session = await requestVoiceLink({
      missionCode: mission.code,
      stage: mission.stage,
    });
    // `state` is mirrored at the top level to match the API table in
    // CONTRACT.md §6; `session` is the full record the call panel renders.
    return Response.json({ session, state: session.state });
  } catch {
    // requestVoiceLink and endVoiceLink already degrade internally; this is the
    // last guard so a missing key can never surface as a 500.
    return fail(
      'VOICE LINK UNAVAILABLE',
      'No desk answered. Keep the question on the text channel and an operator picks it up there.',
      503,
    );
  }
}
