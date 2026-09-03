/**
 * GET /api/admin/login?key=…   → sets the admin cookie, redirects to /admin
 * GET /api/admin/login?out=1   → clears it
 */
import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_COOKIE_TTL_S, adminCookieValue, adminEnabled, keyIsAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const url = req.nextUrl;
  const to = new URL('/admin', url.origin);
  if (url.searchParams.get('out') === '1') {
    const res = NextResponse.redirect(to);
    res.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  }
  if (!adminEnabled()) {
    return NextResponse.json({ error: 'ADMIN_DISABLED', detail: 'ADMIN_SECRET is not set.' }, { status: 404 });
  }
  const key = url.searchParams.get('key');
  if (!keyIsAdmin(key)) {
    to.searchParams.set('denied', '1');
    return NextResponse.redirect(to);
  }
  const res = NextResponse.redirect(to);
  res.cookies.set(ADMIN_COOKIE, adminCookieValue(), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    maxAge: ADMIN_COOKIE_TTL_S,
  });
  return res;
}
