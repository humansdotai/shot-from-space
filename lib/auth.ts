/**
 * SHOT FROM SPACE — passwordless access.
 *
 * There is no signup form and no password anywhere in this product. An order
 * is placed with an email address; the account is the email address. A
 * customer gets into their file by asking for a single-use link.
 *
 * Two records back this:
 *   MagicLinkToken — 32 random bytes, 15 minutes, single use.
 *   Session        — 32 random bytes, 30 days, referenced by an httpOnly
 *                    cookie named `sfs_session`. The token rotates on every
 *                    sign-in; signing out deletes the row, so a stolen cookie
 *                    dies with the session it points at.
 *
 * Adoption of prior orders is the important part: missions are created before
 * any user row exists. Both `createMagicLink` and `consumeMagicLink` relink
 * every `Mission` carrying that email to the user, so the first sign-in
 * inherits everything ordered before the account existed.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { MOCK_MODE, SITE_URL } from '@/lib/env';
import type { SessionUser } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

/** The one session cookie. httpOnly — no client script ever reads it. */
export const SESSION_COOKIE = 'sfs_session';

/** Sessions last 30 days. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Magic links last 15 minutes. */
export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

/** Where a signed-in customer lands when nothing better is requested. */
export const DEFAULT_REDIRECT = '/account';

/* ------------------------------------------------------------------ */
/* Primitives                                                         */
/* ------------------------------------------------------------------ */

/** URL-safe token from `bytes` of CSPRNG output. 32 bytes → 43 chars. */
function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  let binary = '';
  for (const b of buf) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Lowercase + trim. The email IS the account key, so it is normalised once. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Only same-origin paths survive. Anything absolute, protocol-relative or
 * otherwise foreign is discarded — a magic link must never be able to bounce
 * a signed-in customer onto another host.
 */
export function sanitizeRedirect(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('\\')) return null;
  return value;
}

/** Cookie descriptor shared by every place that writes the session cookie. */
export function sessionCookie(token: string, expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  };
}

/** Same descriptor, emptied — used to clear the cookie on sign-out. */
export function clearedSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Session                                                            */
/* ------------------------------------------------------------------ */

/**
 * Reads the session cookie and resolves the customer behind it.
 * Returns null for a missing, unknown or expired session — never throws, so
 * any surface can call it to decide what to render.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || !session.user) return null;

    if (session.expiresAt.getTime() <= Date.now()) {
      // Expired sessions are swept on read; nothing else needs a cron.
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      createdAt: session.user.createdAt.toISOString(),
    };
  } catch (error) {
    // Next signals "this route must render dynamically" by throwing from
    // cookies() during static generation. That is control flow, not a failure:
    // swallowing it lets a page be prerendered as permanently signed out.
    if (isDynamicUsageError(error)) throw error;
    console.error('[auth] getSessionUser failed', error);
    return null;
  }
}

/**
 * True for Next's DynamicServerError / bailout signals, which must propagate.
 * Matched structurally so no internal Next import is needed.
 */
function isDynamicUsageError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { digest?: unknown; message?: unknown; name?: unknown };
  if (typeof e.digest === 'string' && e.digest.startsWith('DYNAMIC_SERVER_USAGE')) return true;
  if (e.name === 'DynamicServerError') return true;
  return typeof e.message === 'string' && e.message.includes('Dynamic server usage');
}

/**
 * Server-Component guard. Redirects to the sign-in screen when there is no
 * session, carrying the route the customer was trying to reach.
 *
 * Next does not expose the current pathname to a Server Component, so callers
 * pass the route they are guarding. The default is the account index.
 */
export async function requireUser(next: string = DEFAULT_REDIRECT): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user) return user;
  const target = sanitizeRedirect(next) ?? DEFAULT_REDIRECT;
  redirect(`/auth/sign-in?next=${encodeURIComponent(target)}`);
}

/** Issues a fresh session row. The caller writes the cookie. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

/** Clears the current session: the row first, then the cookie. */
export async function signOut(): Promise<void> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) {
      await prisma.session.deleteMany({ where: { token } }).catch(() => undefined);
    }
    jar.set(clearedSessionCookie());
  } catch (error) {
    console.error('[auth] signOut failed', error);
  }
}

/* ------------------------------------------------------------------ */
/* Order adoption                                                     */
/* ------------------------------------------------------------------ */

/**
 * Attaches every unclaimed mission ordered with this address to the user.
 * Runs on link creation and again on consumption, so an order placed while
 * the link was in flight is still adopted.
 */
async function adoptMissions(userId: string, email: string): Promise<number> {
  try {
    const result = await prisma.mission.updateMany({
      where: { email, userId: null },
      data: { userId },
    });
    return result.count;
  } catch (error) {
    console.error('[auth] mission adoption failed', error);
    return 0;
  }
}

/** Finds or creates the user for an email. The only way a User is born. */
async function upsertUser(email: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });
}

/* ------------------------------------------------------------------ */
/* Magic link                                                         */
/* ------------------------------------------------------------------ */

/**
 * Mints a single-use sign-in link for `email`.
 *
 * Creates the account if it does not exist and adopts any prior orders, so a
 * customer who bought without an account signs in and finds their missions
 * already on file.
 */
export async function createMagicLink(
  email: string,
  redirectTo?: string,
): Promise<{ url: string }> {
  const address = normalizeEmail(email);
  const target = sanitizeRedirect(redirectTo) ?? null;

  const user = await upsertUser(address);
  await adoptMissions(user.id, address);

  const token = randomToken(32);
  await prisma.magicLinkToken.create({
    data: {
      token,
      email: address,
      userId: user.id,
      redirectTo: target,
      expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS),
    },
  });

  const url = `${SITE_URL.replace(/\/$/, '')}/api/auth/verify?token=${encodeURIComponent(token)}`;
  return { url };
}

/**
 * Burns a magic link and resolves who it belongs to.
 *
 * The consume is a conditional `updateMany` on `consumedAt: null`, so two
 * requests racing the same token produce exactly one winner — a link works
 * once and only once. Expired, unknown and already-used tokens all return
 * null; the caller shows one message for all three.
 */
export async function consumeMagicLink(
  token: string,
): Promise<{ userId: string; redirectTo: string | null } | null> {
  try {
    if (!token) return null;

    const row = await prisma.magicLinkToken.findUnique({ where: { token } });
    if (!row) return null;
    if (row.consumedAt) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;

    const claimed = await prisma.magicLinkToken.updateMany({
      where: { token, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) return null;

    const address = normalizeEmail(row.email);
    const user = row.userId
      ? ((await prisma.user.findUnique({ where: { id: row.userId } })) ?? (await upsertUser(address)))
      : await upsertUser(address);

    // Second pass: catch orders placed after the link was issued.
    await adoptMissions(user.id, address);

    return { userId: user.id, redirectTo: sanitizeRedirect(row.redirectTo) };
  } catch (error) {
    console.error('[auth] consumeMagicLink failed', error);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Delivery                                                           */
/* ------------------------------------------------------------------ */

/**
 * Hands the link to the email adapter (`@/lib/integrations/email`). Every
 * failure — adapter missing, key missing, provider down — is logged and
 * swallowed: a sign-in request never fails loudly, because the answer must
 * look identical for every address.
 *
 * In mock mode the adapter prints the whole mail to the console; this adds one
 * greppable line carrying just the URL.
 */
export async function sendMagicLinkEmail(email: string, url: string): Promise<boolean> {
  if (MOCK_MODE) {
    console.log(`[auth] MAGIC LINK ${email} → ${url}`);
  }
  try {
    const { sendEmail } = await import('@/lib/integrations/email');
    await sendEmail({
      to: email,
      template: 'magic_link',
      data: { url, expiresInMinutes: Math.round(MAGIC_LINK_TTL_MS / 60000) },
    });
    return true;
  } catch (error) {
    console.error('[auth] magic link email not sent', error);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Rate limiting                                                      */
/* ------------------------------------------------------------------ */

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/**
 * In-memory sliding window, keyed by email: 3 links per 10 minutes.
 * Process-local by design — this is a single-node simulation. A real
 * deployment moves this to the same store that backs sessions.
 */
const attempts = new Map<string, number[]>();

export function rateLimitMagicLink(email: string): { ok: boolean; retryAfterSeconds: number } {
  const key = normalizeEmail(email);
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - recent[0])) / 1000);
    attempts.set(key, recent);
    return { ok: false, retryAfterSeconds };
  }

  recent.push(now);
  attempts.set(key, recent);
  return { ok: true, retryAfterSeconds: 0 };
}
