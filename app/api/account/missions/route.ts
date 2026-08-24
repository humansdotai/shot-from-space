/**
 * GET /api/account/missions  →  { missions: MissionDTO[] }
 *
 * Every mission on the signed-in customer's file. 401 when there is no
 * session — the client surface sends the customer to /auth/sign-in.
 */

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { listMissionsForUser } from '@/lib/missions';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: 'NO_SESSION', detail: 'This file requires an open session.' },
      { status: 401 },
    );
  }

  try {
    const missions = await listMissionsForUser(user.id);
    return NextResponse.json({ missions });
  } catch (error) {
    console.error('[account] mission list failed', error);
    return NextResponse.json(
      { error: 'FILE_UNREADABLE', detail: 'The mission index could not be read.' },
      { status: 500 },
    );
  }
}
