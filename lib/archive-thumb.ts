/**
 * Thumbnails of historical scenes are served through the site, never from
 * the supplier's host directly. The proxy URL carries the upstream address
 * itself (base64url) plus an HMAC, so serving it needs no cache lookup and
 * nobody can turn the route into an open proxy.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

function secret(): string {
  return process.env.PRINT_FILE_SECRET || process.env.ADMIN_SECRET || process.env.STRIPE_WEBHOOK_SECRET || 'shot-from-space-thumb';
}

function sign(u: string): string {
  return createHmac('sha256', secret()).update(`thumb:${u}`).digest('hex').slice(0, 24);
}

export function thumbProxyPath(upstream: string): string {
  const u = Buffer.from(upstream, 'utf8').toString('base64url');
  return `/api/archives/thumb?u=${u}&s=${sign(u)}`;
}

export function thumbUpstream(u: string | null, s: string | null): string | null {
  if (!u || !s) return null;
  const expect = Buffer.from(sign(u), 'utf8');
  const got = Buffer.from(s, 'utf8');
  if (expect.length !== got.length || !timingSafeEqual(expect, got)) return null;
  const url = Buffer.from(u, 'base64url').toString('utf8');
  return /^https:\/\//.test(url) ? url : null;
}
