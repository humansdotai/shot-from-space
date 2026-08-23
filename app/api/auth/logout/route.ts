/**
 * POST /api/auth/logout  →  { ok: true }
 *
 * Deletes the session row and clears the cookie. Idempotent: signing out
 * without a session is a success.
 */

import { NextResponse } from 'next/server';
import { clearedSessionCookie, signOut } from '@/lib/auth';

export async function POST() {
  await signOut();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearedSessionCookie());
  return response;
}
