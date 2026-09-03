/**
 * /mission — flow state.
 *
 * One draft describes the whole purchase. It is held by <MissionFlow />
 * and mirrored into localStorage so a refresh, a closed tab or a
 * next-morning return all land the reader back where they were with
 * their answers intact.
 *
 * WHY localStorage AND NOT sessionStorage. This flow has no account and
 * no email before payment, so the browser is the only place a part-built
 * mission can live. sessionStorage would drop it the moment the tab
 * closed, which for a considered purchase is most of them.
 *
 * WHAT IS NOT IN HERE. "Why this place" (screen 2) is an analytics
 * property and nothing else: it is not stored, not sent with the order
 * and not printed. See `track.ts`.
 *
 * CORRUPT DATA. `loadDraft()` never throws and never returns a partly
 * valid object. Every field is checked against what it is allowed to be
 * and anything unrecognised falls back to the default, so a draft
 * written by an older build — or a hand-edited one — degrades to a
 * working flow rather than a blank screen.
 */

import type { FormatId, FrameOption, TargetAddress } from '@/lib/types';
import { DEFAULT_AREA_KM } from '@/lib/pricing-model';
import {
  DEFAULT_POSTER_STYLE_ID,
  isPosterStyleId,
  type PosterStyleId,
} from '@/lib/poster/styles';
import {
  DEFAULT_FORMAT_ID,
  DEFAULT_FRAME,
  DEFAULT_TIER,
  MISSION_NAME_MAX,
  STORAGE_KEY,
  TIER_IDS,
  defaultMissionName,
  type TierId,
} from './config';
import { isSectionId, type SectionId } from './steps';

/** The place the satellite is pointed at. */
export interface MissionTarget {
  /** What the reader typed or was sent, shown back to them verbatim. */
  label: string;
  lat: number;
  lon: number;
  /**
   * Postal detail, resolved from the coordinates by the geocode adapter
   * when the order is opened. Null until then — the flow works without it
   * and only the order route requires it.
   */
  address: TargetAddress | null;
}

/** A capture window the reader picked on screen 7. */
export interface ChosenWindow {
  /** ISO date, `YYYY-MM-DD`, of the tasking day. */
  date: string;
  /** ISO date the mission must be commissioned by to make that tasking. */
  commitBy: string;
  /** True when the window was derived from config rather than propagated. */
  indicative: boolean;
}

export interface MissionDraft {
  target: MissionTarget | null;
  /** Screen 3. A gift changes checkout and the confirmation, so it is state. */
  gift: boolean | null;
  /** Screen 4. */
  missionName: string;
  /** The Design section. */
  formatId: FormatId;
  frame: FrameOption;
  /** Capture footprint, km per side — the framing step's view slider. */
  areaKm: number;
  /**
   * How the sheet is divided between the picture and the record.
   * `lib/poster/styles.ts` is the catalogue and the only place the
   * compositions are declared; this holds the one that was chosen.
   */
  posterStyle: PosterStyleId;
  /**
   * THE BUYER'S EARLIEST ACCEPTABLE CAPTURE DATE, ISO `YYYY-MM-DD`.
   *
   * Null means "first available" — the mission flies on the next clear
   * pass, whenever that is, and that is the default because it is the
   * only mode this system can promise anything about.
   *
   * A DATE HERE IS A PREFERENCE AND NOT A COMMITMENT, and every surface
   * that reads it has to say so. Nothing about naming a date makes a
   * satellite arrive on it: the pass geometry is fixed by the orbit and
   * the sky decides the rest. All this does is choose which of the REAL
   * propagated windows the Window section opens on — see
   * `S7Windows.tsx`, which selects the first computed window falling on
   * or after this date and states plainly when none of them does.
   *
   * It is never used to compute a window, only to pick among windows the
   * propagator already returned.
   */
  earliest: string | null;
  /** Screen 7. */
  window: ChosenWindow | null;
  /** Screen 9. */
  tier: TierId;
  /** Set at checkout, and the only place an email is ever held. */
  receiptEmail: string;
  giftNote: string;
  /** Written once payment settles. Its presence is what makes screen 10 real. */
  missionCode: string | null;
  paidAt: string | null;
}

/** The view slider's range, km per side. 0.5 km is a house and its street; 5 km a district. */
export const AREA_KM_MIN = 0.5;
export const AREA_KM_MAX = 5;

export function clampAreaKm(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_AREA_KM;
  return Math.round(Math.min(AREA_KM_MAX, Math.max(AREA_KM_MIN, n)) * 10) / 10;
}

export const DEFAULT_DRAFT: MissionDraft = {
  target: null,
  gift: null,
  missionName: defaultMissionName(),
  formatId: DEFAULT_FORMAT_ID,
  frame: DEFAULT_FRAME,
  areaKm: DEFAULT_AREA_KM,
  posterStyle: DEFAULT_POSTER_STYLE_ID,
  earliest: null,
  window: null,
  tier: DEFAULT_TIER,
  receiptEmail: '',
  giftNote: '',
  missionCode: null,
  paidAt: null,
};

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const FORMAT_IDS: readonly FormatId[] = ['F30', 'F50', 'F70'];

export function isLatitude(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
}

export function isLongitude(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;
}

/** Permissive on purpose: one @, a dot in the domain, no spaces. */
export function isEmail(value: string): boolean {
  const v = value.trim();
  if (v.length < 6 || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * An ISO date that is real, is not behind us, and is inside a horizon
 * anyone could mean. Used for `MissionDraft.earliest`, which arrives
 * from a URL a stranger can type.
 *
 * `2026-02-30` matches the shape and is not a date; `Date.parse` accepts
 * it and rolls it into March, so the round-trip check is what actually
 * rejects it. Today counts as valid — a buyer asking for "on or after
 * today" is asking for the next available pass, which is the default and
 * costs nothing to honour.
 */
export const EARLIEST_HORIZON_DAYS = 730;

export function isFutureIsoDate(v: unknown): v is string {
  if (!isIsoDate(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  // Rejects a well-shaped impossible date by checking it survives the trip.
  if (d.toISOString().slice(0, 10) !== v) return false;

  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = (d.getTime() - today) / 86_400_000;
  return days >= 0 && days <= EARLIEST_HORIZON_DAYS;
}

function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? Array.from(v).slice(0, max).join('') : '';
}

function reviveTarget(v: unknown): MissionTarget | null {
  if (typeof v !== 'object' || v === null) return null;
  const t = v as Record<string, unknown>;
  if (!isLatitude(t.lat) || !isLongitude(t.lon)) return null;
  const address =
    typeof t.address === 'object' && t.address !== null
      ? (t.address as TargetAddress)
      : null;
  return {
    label: cleanText(t.label, 200) || 'Target',
    lat: t.lat,
    lon: t.lon,
    // The address is only ever consumed by the order route, which
    // re-validates it in full. A malformed one costs a re-resolve, not a crash.
    address: address && typeof address.countryCode === 'string' ? address : null,
  };
}

function reviveWindow(v: unknown): ChosenWindow | null {
  if (typeof v !== 'object' || v === null) return null;
  const w = v as Record<string, unknown>;
  if (!isIsoDate(w.date) || !isIsoDate(w.commitBy)) return null;
  return { date: w.date, commitBy: w.commitBy, indicative: w.indicative === true };
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

export interface StoredFlow {
  draft: MissionDraft;
  /**
   * Which SECTION of the configurator the buyer had open. Clamped on
   * load — see `MissionFlow`.
   *
   * The key is still `step` because that is what is already in every
   * reader's localStorage and in the URL, and because `STORAGE_KEY` is
   * versioned in `config.ts`, which this build does not own. A draft
   * written by the ten-screen build holds one of the OLD screen ids here;
   * `isSectionId` rejects it and the buyer lands on the first section
   * with their answers intact, which is the documented degrade.
   */
  step: SectionId;
}

/**
 * Reads the stored flow. Returns null for "nothing usable", which covers
 * a first visit, a private-mode browser, a quota error, and a value that
 * is not JSON at all. Never throws.
 */
export function loadFlow(): StoredFlow | null {
  if (typeof window === 'undefined') return null;

  let parsed: unknown;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch {
    // Corrupt JSON, or storage that refuses to be read. Clear it so the
    // reader is not stuck failing to parse the same bytes on every visit.
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing further to do */
    }
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const root = parsed as Record<string, unknown>;
  const d = (typeof root.draft === 'object' && root.draft !== null ? root.draft : {}) as Record<
    string,
    unknown
  >;

  const draft: MissionDraft = {
    target: reviveTarget(d.target),
    gift: d.gift === true ? true : d.gift === false ? false : null,
    missionName: cleanText(d.missionName, MISSION_NAME_MAX) || DEFAULT_DRAFT.missionName,
    formatId: FORMAT_IDS.includes(d.formatId as FormatId)
      ? (d.formatId as FormatId)
      : DEFAULT_DRAFT.formatId,
    frame: d.frame === 'FRAMED' ? 'FRAMED' : 'UNFRAMED',
    areaKm: clampAreaKm(d.areaKm),
    posterStyle: isPosterStyleId(d.posterStyle) ? d.posterStyle : DEFAULT_DRAFT.posterStyle,
    // A stored preference that has since gone stale is dropped rather
    // than carried: a date in the past is not a preference any more, and
    // silently keeping it would have the Window section skip past
    // windows the buyer can actually have.
    earliest: isFutureIsoDate(d.earliest) ? (d.earliest as string) : null,
    window: reviveWindow(d.window),
    tier: TIER_IDS.includes(d.tier as TierId) ? (d.tier as TierId) : DEFAULT_DRAFT.tier,
    receiptEmail: cleanText(d.receiptEmail, 254),
    giftNote: cleanText(d.giftNote, 400),
    missionCode: typeof d.missionCode === 'string' && d.missionCode ? d.missionCode : null,
    paidAt: typeof d.paidAt === 'string' && d.paidAt ? d.paidAt : null,
  };

  return { draft, step: isSectionId(root.step) ? root.step : 'target' };
}

export function saveFlow(flow: StoredFlow): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(flow));
  } catch {
    /* Private mode or a full quota. The flow still works, it just will
       not survive a reload — which is better than refusing to continue. */
  }
}

export function clearFlow(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}
