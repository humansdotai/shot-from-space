/**
 * ADMIN — operations access and the orders board's data.
 *
 * There is no admin role in the schema and no email delivery for magic
 * links in this deployment, so operations sign in with ONE secret:
 * `ADMIN_SECRET` (env). `/api/admin/login?key=…` sets an httpOnly cookie
 * holding the secret's SHA-256; every admin route compares it in constant
 * time. Unset secret ⇒ admin is closed entirely.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { missionShortLink } from '@/lib/codes';
import type { Currency, FormatId, FrameOption, MissionState } from '@/lib/types';

export const ADMIN_COOKIE = 'sfs_admin';
export const ADMIN_COOKIE_TTL_S = 30 * 24 * 60 * 60;

function secret(): string | null {
  const s = process.env.ADMIN_SECRET?.trim();
  return s && s.length >= 12 ? s : null;
}

export function adminEnabled(): boolean {
  return secret() !== null;
}

function digest(v: string): Buffer {
  return createHash('sha256').update(v).digest();
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/** True when `key` is the admin secret. Constant-time. */
export function keyIsAdmin(key: string | null | undefined): boolean {
  const s = secret();
  if (!s || !key) return false;
  return safeEqual(digest(key), digest(s));
}

/** The cookie value for a valid secret — its digest, never the secret. */
export function adminCookieValue(): string {
  const s = secret();
  return s ? digest(s).toString('hex') : '';
}

/** True when the request carries the admin cookie. */
export async function isAdminRequest(): Promise<boolean> {
  const s = secret();
  if (!s) return false;
  const jar = await cookies();
  const v = jar.get(ADMIN_COOKIE)?.value;
  if (!v) return false;
  return safeEqual(Buffer.from(v, 'utf8'), Buffer.from(digest(s).toString('hex'), 'utf8'));
}

/* ------------------------------------------------------------------ */
/* The board                                                           */
/* ------------------------------------------------------------------ */
export type AdminStatus = 'UNPAID' | 'CANCELLED' | 'AWAITING_APPROVAL' | MissionState;

export interface AdminMission {
  code: string;
  createdAt: string;
  email: string;
  locationLabel: string;
  address: string;
  lat: number;
  lon: number;
  tier: string;
  formatId: FormatId;
  frame: FrameOption;
  areaKm: number;
  amountMinor: number;
  currency: Currency;
  paidAt: string | null;
  state: MissionState;
  status: AdminStatus;
  stripePaymentIntentId: string | null;
  skyfiOrderId: string | null;
  gelatoOrderId: string | null;
  trackingUrl: string | null;
  isDemo: boolean;
  ownerLink: string;
  proofUrl: string;
  lastEvent: { label: string; detail: string | null; at: string } | null;
  quoteNote: string | null;
}

export async function listMissionsForAdmin(limit = 300): Promise<AdminMission[]> {
  const rows = await prisma.mission.findMany({
    include: { events: { orderBy: { at: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => {
    const state = r.state as MissionState;
    const received = r.events.find((e) => e.label === 'ORDER RECEIVED');
    const tier = received?.detail?.match(/\b(ARCHIVE|COMMISSION_LARGE_FORMAT|COMMISSION)\b/)?.[1] ?? 'COMMISSION';
    const last = r.events[r.events.length - 1] ?? null;
    const status: AdminStatus =
      state === 'CANCELLED'
        ? 'CANCELLED'
        : !r.paidAt
          ? 'UNPAID'
          : state === 'PROCESSING'
            ? 'AWAITING_APPROVAL'
            : state;
    return {
      code: r.code,
      createdAt: r.createdAt.toISOString(),
      email: r.email,
      locationLabel: r.locationLabel,
      address: [r.addressLine1, r.addressLine2, r.postalCode, r.city, r.country].filter(Boolean).join(', '),
      lat: r.lat,
      lon: r.lon,
      tier,
      formatId: r.formatId as FormatId,
      frame: r.frame as FrameOption,
      areaKm: r.areaKm,
      amountMinor: r.amountMinor,
      currency: r.currency as Currency,
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      state,
      status,
      stripePaymentIntentId: r.stripePaymentIntentId,
      skyfiOrderId: r.skyfiOrderId,
      gelatoOrderId: r.gelatoOrderId,
      trackingUrl: r.trackingUrl,
      isDemo: r.isDemo,
      ownerLink: `https://${missionShortLink(r.code, r.shareToken)}`,
      proofUrl: `/api/poster/${r.code}?variant=print`,
      lastEvent: last ? { label: last.label, detail: last.detail, at: last.at.toISOString() } : null,
      quoteNote: received?.detail?.match(/Quote: (.*?)\. Awaiting/)?.[1] ?? null,
    };
  });
}
