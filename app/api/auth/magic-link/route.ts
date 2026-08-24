/**
 * POST /api/auth/magic-link
 *
 * Body: { email, redirectTo? }  →  { ok: true, devLink? }
 *
 * The response is identical whether or not the address is on file: this
 * endpoint never reveals that an account exists. In mock mode the link comes
 * back as `devLink` so the product is reviewable without a mailbox.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createMagicLink, rateLimitMagicLink, sendMagicLinkEmail } from '@/lib/auth';
import { MOCK_MODE } from '@/lib/env';

const BodySchema = z.object({
  email: z
    .string()
    .max(320)
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.email()),
  redirectTo: z.string().max(512).optional(),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'MALFORMED_REQUEST', detail: 'Request body was not readable JSON.' },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_EMAIL', detail: 'That address is not a valid email address.' },
      { status: 400 },
    );
  }

  const { email, redirectTo } = parsed.data;

  const limit = rateLimitMagicLink(email);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: 'RATE_LIMITED',
        detail: 'Three links have already been sent to this address. Wait before requesting another.',
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const { url } = await createMagicLink(email, redirectTo);
    await sendMagicLinkEmail(email, url);
    return NextResponse.json({ ok: true, ...(MOCK_MODE ? { devLink: url } : {}) });
  } catch (error) {
    // A failure here is ours, not the customer's — but the shape of the
    // answer stays the same so nothing is inferable from it.
    console.error('[auth] magic link request failed', error);
    return NextResponse.json(
      { error: 'LINK_NOT_ISSUED', detail: 'The link could not be issued. Try again.' },
      { status: 500 },
    );
  }
}
