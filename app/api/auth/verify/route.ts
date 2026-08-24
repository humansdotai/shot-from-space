/**
 * GET /api/auth/verify?token=…
 *
 * Burns the magic link, opens a session and sends the customer on. Every
 * failure mode — no token, unknown token, expired, already used — lands on
 * the sign-in screen with `?error=expired`. A raw error is never rendered.
 */

import { NextResponse } from 'next/server';
import { consumeMagicLink, createSession, sessionCookie, DEFAULT_REDIRECT } from '@/lib/auth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';

  const failed = NextResponse.redirect(new URL('/auth/sign-in?error=expired', request.url));

  if (!token) return failed;

  const result = await consumeMagicLink(token);
  if (!result) return failed;

  try {
    const { token: sessionToken, expiresAt } = await createSession(result.userId);
    const destination = new URL(result.redirectTo ?? DEFAULT_REDIRECT, request.url);
    const response = NextResponse.redirect(destination);
    response.cookies.set(sessionCookie(sessionToken, expiresAt));
    return response;
  } catch (error) {
    console.error('[auth] session could not be opened', error);
    return failed;
  }
}
