/**
 * THE PRINT FILE — how Gelato fetches what it prints.
 *
 * The composed print lives behind /api/print/{code}?t=… : full resolution,
 * no watermark, the real capture when one is on file. The token is an HMAC
 * of the code, so the URL is fetchable by the print API and by nobody who
 * only knows the code. An operator can replace the whole file with their own
 * (`Mission.printFileUrl`) — a "new version" — and that URL wins.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { SITE_URL } from '@/lib/env';

function secret(): string {
  return (
    process.env.PRINT_FILE_SECRET ||
    process.env.ADMIN_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET ||
    'shot-from-space-print-file'
  );
}

export function printToken(code: string): string {
  return createHmac('sha256', secret()).update(`print:${code.toUpperCase()}`).digest('hex').slice(0, 32);
}

export function printTokenValid(code: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const a = Buffer.from(printToken(code), 'utf8');
  const b = Buffer.from(token, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Absolute URL of the composed print for this mission. */
export function composedPrintFileUrl(code: string): string {
  return `${SITE_URL}/api/print/${code.toUpperCase()}?t=${printToken(code)}`;
}

/** The file Gelato is sent: the operator's replacement when set, else the composed print. */
export function printFileUrlFor(row: { code: string; printFileUrl?: string | null }): string {
  return row.printFileUrl?.trim() || composedPrintFileUrl(row.code);
}
