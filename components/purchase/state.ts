/**
 * PURCHASE — flow state.
 *
 * One draft object describes the entire order. It is held by <StartFlow />
 * (the single stateful component in this flow) and mirrored into
 * sessionStorage so that a back-navigation from checkout restores the flow
 * exactly as it was left.
 *
 * Nothing here touches the network. Network shapes live in `api.ts`.
 */

import type {
  Currency,
  FormatId,
  FrameOption,
  Region,
  TargetAddress,
} from '@/lib/types';
import { currencyForRegion, getFormat, priceMinor, regionForCountry } from '@/lib/pricing';
import { DEDICATION_MAX_LENGTH } from '@/lib/missions/dedication';

/* ------------------------------------------------------------------ */
/* Capture area                                                        */
/* ------------------------------------------------------------------ */

/** Ground footprint of the capture, in kilometres square. */
export type AreaKm = 1 | 2 | 4;

export const AREA_OPTIONS: readonly AreaKm[] = [1, 2, 4] as const;

/**
 * Footprint → slippy-map zoom for `/api/geocode/static`.
 * A 1 km frame is roughly z15 at mid-latitudes; each doubling of the
 * footprint drops one zoom level.
 */
export const AREA_ZOOM: Record<AreaKm, number> = { 1: 15, 2: 14, 4: 13 };

/** Editorial note under each footprint option. */
export const AREA_NOTE: Record<AreaKm, string> = {
  1: 'Tight. Your roof, your street, the cars on it.',
  2: 'Standard. The block reads as a neighbourhood.',
  4: 'Wide. District scale, your address at the centre.',
};

/* ------------------------------------------------------------------ */
/* Draft                                                               */
/* ------------------------------------------------------------------ */

export interface StartDraft {
  address: TargetAddress | null;
  areaKm: AreaKm;
  formatId: FormatId;
  frame: FrameOption;
  /**
   * "What is this place?" — the line printed at the foot of the mission
   * sheet. Empty means the sheet carries no dedication, which is a real
   * answer and not a skipped question.
   */
  dedication: string;
  email: string;
}

/**
 * Defaults are chosen, not empty. FMT-50 unframed is the standard issue —
 * pre-selecting it removes two taps from the median purchase, and both the
 * format and the frame stay one tap away from being changed.
 */
export const DEFAULT_DRAFT: StartDraft = {
  address: null,
  areaKm: 2,
  formatId: 'F50',
  frame: 'UNFRAMED',
  dedication: '',
  email: '',
};

/* ------------------------------------------------------------------ */
/* Derived money                                                       */
/* ------------------------------------------------------------------ */

export interface Quote {
  region: Region;
  currency: Currency;
  itemMinor: number;
  totalMinor: number;
}

/**
 * Region, currency and price all follow the target address country.
 * Before a target is locked we quote in USD so the format rows are never
 * blank — the numbers re-render the moment a country is known.
 */
export function quoteFor(draft: StartDraft): Quote {
  const region: Region = draft.address ? regionForCountry(draft.address.countryCode) : 'US';
  const currency = currencyForRegion(region);
  const itemMinor = priceMinor(draft.formatId, draft.frame, currency);
  // Shipping and duties are inside the price. The total is the item.
  return { region, currency, itemMinor, totalMinor: itemMinor };
}

/**
 * City-level label for readouts: `LOS ANGELES / US`.
 * Kept short on purpose — it sits in a DataRow, which does not wrap.
 */
export function locationLabel(a: TargetAddress): string {
  return `${a.city} / ${a.countryCode}`.toUpperCase();
}

/** `FMT-50 / 50 × 70 CM` — format without the finish, for split readouts. */
export function formatShort(draft: StartDraft): string {
  const f = getFormat(draft.formatId);
  return `${f.designation} / ${f.metric}`;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/** Deliberately permissive: one @, a dot in the domain, no spaces. */
export function isEmail(value: string): boolean {
  const v = value.trim();
  if (v.length < 6 || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

export function isLatitude(v: number): boolean {
  return Number.isFinite(v) && v >= -90 && v <= 90;
}

export function isLongitude(v: number): boolean {
  return Number.isFinite(v) && v >= -180 && v <= 180;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

const DRAFT_KEY = 'sfs.start.draft.v1';
const CHECKOUT_KEY = 'sfs.checkout.snapshot.v1';

/**
 * What the mock checkout needs to render a summary without re-querying the
 * order. Written the moment /api/orders returns, read by /checkout/mock/[id].
 */
export interface CheckoutSnapshot {
  missionCode: string;
  email: string;
  locationLabel: string;
  /** `FMT-50 / 50 × 70 CM` */
  formatLabel: string;
  frame: FrameOption;
  areaKm: AreaKm;
  amountMinor: number;
  currency: Currency;
  region: Region;
  lat: number;
  lon: number;
  /**
   * Decimal places the fix above actually carries.
   *
   * The draft written at authorisation holds the address index's own 4 dp,
   * which is the default. The RECOVERY path — a reload that has lost the
   * draft and re-reads `/api/missions/[code]` — gets the PUBLIC projection,
   * which `lib/missions/dto.ts` has already rounded to PUBLIC_COORD_DP, and
   * printing that at 4 dp does not restore the digits: it pads them with
   * zeros, so the summary read `48.8600, 2.3600` for a target the record
   * holds at 48.8622, 2.3585. Print what the value carries, never more.
   */
  coordDp?: 2 | 4;
}

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Private-mode / quota / corrupt payload. The flow works without it.
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — non-fatal, the draft simply will not survive */
  }
}

export function loadDraft(): StartDraft | null {
  const d = readJson<Partial<StartDraft>>(DRAFT_KEY);
  if (!d) return null;
  const areaKm = AREA_OPTIONS.includes(d.areaKm as AreaKm) ? (d.areaKm as AreaKm) : DEFAULT_DRAFT.areaKm;
  const formatId = (['F30', 'F50', 'F70'] as const).includes(d.formatId as FormatId)
    ? (d.formatId as FormatId)
    : DEFAULT_DRAFT.formatId;
  const frame: FrameOption = d.frame === 'FRAMED' ? 'FRAMED' : 'UNFRAMED';
  return {
    address: d.address ?? null,
    areaKm,
    formatId,
    frame,
    // Trimmed to the cap the plate can set, so a draft saved by an older
    // build can never restore a line the sheet would have to cut.
    dedication:
      typeof d.dedication === 'string'
        ? Array.from(d.dedication).slice(0, DEDICATION_MAX_LENGTH).join('')
        : '',
    email: typeof d.email === 'string' ? d.email : '',
  };
}

export function saveDraft(draft: StartDraft): void {
  writeJson(DRAFT_KEY, draft);
}

export function loadCheckoutSnapshot(missionCode: string): CheckoutSnapshot | null {
  const s = readJson<CheckoutSnapshot>(CHECKOUT_KEY);
  if (!s || s.missionCode?.toUpperCase() !== missionCode.toUpperCase()) return null;
  return s;
}

export function saveCheckoutSnapshot(snapshot: CheckoutSnapshot): void {
  writeJson(CHECKOUT_KEY, snapshot);
}
