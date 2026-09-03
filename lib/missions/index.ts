/**
 * MISSIONS — the server-side mission API.
 *
 * Everything that reads or writes a mission goes through this module. Route
 * handlers, server components and the seed all call these functions; none of
 * them touch `prisma.mission` directly.
 *
 * Contract (CONTRACT.md §10):
 *   getMissionByCode(code, opts?)      → MissionDTO | null
 *   getMissionByShareToken(code, tok)  → MissionDTO | null
 *   listMissionsForUser(userId)        → MissionDTO[]
 *   listMissionsForEmail(email)        → MissionDTO[]
 *   createMission(input)               → MissionDTO
 *   markMissionPaid(code, payment)     → MissionDTO
 *   advanceMission(code, to?)          → MissionDTO
 *   cancelMission(code, opts?)         → MissionDTO
 *   toMissionDTO(row, opts?)           → MissionDTO
 */
import { nanoid } from 'nanoid';
import type { TierId } from '@/lib/mission-flow/config';
import { liveQuote } from '@/lib/pricing-live';
import { prisma } from '@/lib/db';
import { generateMissionCode, normalizeMissionCode } from '@/lib/codes';
import { getExampleMission } from '@/lib/gallery';
import {
  currencyForRegion,
  formatPrice,
  getFormat,
  regionForCountry,
} from '@/lib/pricing';
import { formatCoords } from '@/lib/utils';
import { sendEmail } from '@/lib/integrations/email';
import { MISSION_STAGES, STAGE_LABEL, stageIndex } from '@/lib/types';
import { REFUND_WINDOW_DAYS } from '@/lib/guarantees';
import type {
  Currency,
  FormatId,
  FrameOption,
  MissionDTO,
  MissionStage,
  MissionState,
  TargetAddress,
} from '@/lib/types';
import { missionTelemetry } from './telemetry';
import { pickFrameSlugForCoords } from './frames';
import { asState, toMissionDTO, type MissionRow, type ToMissionDTOOptions } from './dto';
import { sanitizeDedication } from './dedication';
import { MissionNotFoundError, MissionTransitionError, MissionValidationError } from './errors';
import { applyTransition, cancellationRefusal, nextStage, transitionPath } from './state';

export { toMissionDTO } from './dto';
export type { MissionRow, ToMissionDTOOptions } from './dto';
export {
  MISSION_TRANSITIONS,
  CANCELLATION_CLOSES_AT,
  canTransition,
  cancellationRefusal,
  withinCancellationWindow,
  nextStage,
  transitionPath,
  applyTransition,
} from './state';
export { DEDICATION_MAX_LENGTH, sanitizeDedication } from './dedication';
export {
  MissionNotFoundError,
  MissionTransitionError,
  MissionValidationError,
  isMissionError,
} from './errors';
export { missionTelemetry, missionCaptureWindow } from './telemetry';
export { pickFrameForCoords, pickFrameSlugForCoords, haversineKm } from './frames';

/** Always fetch events with a mission — the timeline is the product. */
const withEvents = { events: { orderBy: { at: 'asc' } } } as const;

/* ------------------------------------------------------------------ */
/* Labels                                                             */
/* ------------------------------------------------------------------ */

/**
 * The city-level label shown on every public surface.
 *   "LOS ANGELES, CA / US"   "PARIS / FR"   "BERLIN / DE"
 * A short admin area (a state or province code) is kept because it
 * disambiguates; a long one ("Île-de-France") is dropped because it makes the
 * label unreadable at telemetry size.
 */
export function locationLabelFor(address: {
  city: string;
  region?: string | null;
  countryCode: string;
}): string {
  const city = address.city.trim().toUpperCase();
  const cc = address.countryCode.trim().toUpperCase();
  const admin = (address.region ?? '').trim().toUpperCase();
  const keepAdmin = admin.length > 0 && admin.length <= 3;
  return keepAdmin ? `${city}, ${admin} / ${cc}` : `${city} / ${cc}`;
}

/** `SFS-2026-32BF` — stable, human-readable, printed on the receipt. */
export function receiptNumberFor(code: string, at: Date = new Date()): string {
  return `SFS-${at.getUTCFullYear()}-${code.toUpperCase()}`;
}

/* ------------------------------------------------------------------ */
/* Reads                                                              */
/* ------------------------------------------------------------------ */

async function findRowByCode(code: string): Promise<MissionRow | null> {
  const normalized = normalizeMissionCode(code);
  if (!normalized) return null;
  return prisma.mission.findUnique({ where: { code: normalized }, include: withEvents });
}

export async function getMissionByCode(
  code: string,
  opts: ToMissionDTOOptions = {},
): Promise<MissionDTO | null> {
  const row = await findRowByCode(code);
  return row ? toMissionDTO(row, opts) : null;
}

/** The raw row, for callers that need ownership checks or private columns. */
export async function getMissionRowByCode(code: string): Promise<MissionRow | null> {
  return findRowByCode(code);
}

/**
 * The read-only shared view. The token must match the mission's shareToken;
 * the returned DTO is always redacted — a shared link never leaks the street
 * address, the email, the amount or the receipt number.
 */
export async function getMissionByShareToken(
  code: string,
  token: string,
): Promise<MissionDTO | null> {
  const row = await findRowByCode(code);
  if (!row) return null;
  if (!token || row.shareToken !== token) return null;
  return toMissionDTO(row, { includePrivate: false });
}

export async function listMissionsForUser(userId: string): Promise<MissionDTO[]> {
  const rows = await prisma.mission.findMany({
    where: { userId },
    include: withEvents,
    orderBy: { createdAt: 'desc' },
  });
  // The owner's own list: private detail is theirs to see.
  return rows.map((r) => toMissionDTO(r, { includePrivate: true }));
}

export async function listMissionsForEmail(email: string): Promise<MissionDTO[]> {
  const rows = await prisma.mission.findMany({
    where: { email: email.trim().toLowerCase() },
    include: withEvents,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => toMissionDTO(r, { includePrivate: true }));
}

/**
 * The public gallery feed: seeded demo missions plus anything a customer has
 * opted into. Always redacted.
 */
export async function listPublicMissions(): Promise<MissionDTO[]> {
  const rows = await prisma.mission.findMany({
    where: { OR: [{ isDemo: true }, { isPublic: true }] },
    include: withEvents,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => toMissionDTO(r));
}

/** The share token for a mission the caller already owns. */
export async function getShareToken(code: string): Promise<string | null> {
  const normalized = normalizeMissionCode(code);
  if (!normalized) return null;
  const row = await prisma.mission.findUnique({
    where: { code: normalized },
    select: { shareToken: true },
  });
  return row?.shareToken ?? null;
}

/* ------------------------------------------------------------------ */
/* Create                                                             */
/* ------------------------------------------------------------------ */

export interface CreateMissionInput {
  email: string;
  address: TargetAddress;
  /**
   * Purchase-flow tier, when the order came from /mission.
   *
   * Present -> the amount is `tierPriceMinor(tier, format, frame, currency)`.
   * Absent  -> the catalogue price, which is what /start has always paid.
   *
   * THE AMOUNT ITSELF IS NEVER ACCEPTED FROM A CALLER. It is recomputed here
   * from the tier, the format, the finish and the currency, so a crafted
   * request cannot set its own price. Until this existed, /mission displayed
   * a tier price and this function silently charged the catalogue instead —
   * "Pay €79" recorded €170, and the customer saw both figures.
   */
  tier?: TierId | null;
  formatId: FormatId;
  frame: FrameOption;
  /** Buyer-selected billing currency. Absent → derived from the address. */
  currency?: Currency;
  /** Capture footprint in km per side. Defaults to 1.2 km — a house lot with
   *  enough surrounding street grid to read as a place. */
  areaKm?: number;
  /** Attach to an existing account, if one is signed in. */
  userId?: string | null;
  /** Opt into the public gallery. */
  isPublic?: boolean;
  /**
   * "What is this place?" — the dedication line printed on the mission sheet.
   * Optional: the question can be skipped and the sheet simply omits the
   * line. Free text, so it is sanitised through `sanitizeDedication` before
   * it is stored; anything left empty after that is stored as null rather
   * than as a blank string.
   */
  dedication?: string | null;
}

/**
 * Reserves an unused mission code. The unique index is the real guard, but a
 * real mission must also avoid the archive: `lib/gallery` derives permanent
 * codes for the public example missions from the imagery catalogue, and
 * `/missions/[code]` and `/m/[code]` share one code space. A collision would
 * make a customer's mission code resolve to a Landsat reference frame.
 */
async function reserveCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateMissionCode();
    if (getExampleMission(code)) continue;
    const clash = await prisma.mission.findUnique({ where: { code }, select: { id: true } });
    if (!clash) return code;
  }
  throw new MissionValidationError('Could not allocate a mission code. Try again.');
}

/**
 * Creates an unpaid mission. The customer is charged next; `markMissionPaid`
 * is what actually opens the timeline with the MISSION_CONFIRMED event.
 */
export async function createMission(input: CreateMissionInput): Promise<MissionDTO> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) {
    throw new MissionValidationError('A valid email address is required.');
  }

  const address = input.address;
  if (!address?.countryCode || !Number.isFinite(address.lat) || !Number.isFinite(address.lon)) {
    throw new MissionValidationError('The target address is missing coordinates.');
  }

  // Print REGION follows the shipping address (US → Reno, EU → Eindhoven);
  // CURRENCY is the buyer's choice when they made one, otherwise the region's
  // default. The two are independent: a EUR buyer can still ship to the US.
  const region = regionForCountry(address.countryCode);
  const currency: Currency =
    input.currency === 'USD' || input.currency === 'EUR'
      ? input.currency
      : currencyForRegion(region);
  const format = getFormat(input.formatId);
  // THE CHARGE IS THE LIVE QUOTE: real SkyFi imagery for THIS target + real
  // Gelato print for this size/finish + 10 % (lib/pricing-live.ts). /start
  // has no tier and is a commission. Never a browser-supplied number.
  const tier: TierId = input.tier ?? 'COMMISSION';
  const quote = await liveQuote(tier, input.formatId, input.frame, currency, {
    areaKm: input.areaKm,
    lat: address.lat,
    lon: address.lon,
  });
  const amountMinor = quote.totalMinor;

  const code = await reserveCode();
  const telemetry = missionTelemetry(code);

  // Missions are keyed to an account by email. There is no signup form: the
  // account exists the moment an order does, and Agent 7's magic link is how
  // the customer proves they own it.
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
    select: { id: true },
  });

  const row = await prisma.mission.create({
    data: {
      code,
      shareToken: nanoid(24),
      state: 'MISSION_CONFIRMED',
      email,
      userId: input.userId ?? user.id,

      addressLine1: address.line1,
      addressLine2: address.line2 ?? null,
      city: address.city,
      adminArea: address.region ?? null,
      postalCode: address.postalCode,
      countryCode: address.countryCode.toUpperCase(),
      country: address.country,
      lat: address.lat,
      lon: address.lon,
      locationLabel: locationLabelFor(address),

      formatId: format.id,
      frame: input.frame,
      printRegion: region,
      amountMinor,
      currency,
      areaKm: input.areaKm ?? 1.2,
      dedication: sanitizeDedication(input.dedication),

      // Deterministic telemetry so the file reads the same on every visit.
      sensor: telemetry.sensor,
      inclination: telemetry.inclination,
      track: telemetry.track,
      altitudeKm: telemetry.altitudeKm,
      gsdM: telemetry.gsdM,
      azimuthDeg: telemetry.azimuthDeg,
      offNadirDeg: telemetry.offNadirDeg,
      cloudPct: telemetry.cloudPct,

      isPublic: input.isPublic ?? false,

      events: {
        create: [
          {
            stage: 'NOTE',
            label: 'ORDER RECEIVED',
            detail:
              `Target accepted: ${locationLabelFor(address)}. ` +
              `${tier} · ${format.metric} ${input.frame === 'FRAMED' ? 'framed' : 'unframed'}. ` +
              `Quote: imagery ${quote.imagery.toFixed(2)} + print ${quote.print.toFixed(2)} ` +
              `+ margin ${quote.margin.toFixed(2)} = ${quote.total.toFixed(2)} ${currency} ` +
              `(${quote.imageryNote}). Awaiting payment authorisation.`,
          },
        ],
      },
    },
    include: withEvents,
  });

  return toMissionDTO(row, { includePrivate: true });
}

/* ------------------------------------------------------------------ */
/* Payment                                                            */
/* ------------------------------------------------------------------ */

export interface MissionPayment {
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  /** Overrides the catalogue price if the processor reports something else. */
  amountMinor?: number | null;
  currency?: Currency | null;
  paidAt?: Date;
}

/**
 * Settles a mission. Idempotent: a Stripe webhook and the mock checkout can
 * both land, and the second one is a no-op that still returns the DTO.
 */
export async function markMissionPaid(
  missionCode: string,
  payment: MissionPayment = {},
): Promise<MissionDTO> {
  const row = await findRowByCode(missionCode);
  if (!row) throw new MissionNotFoundError(missionCode);

  if (row.paidAt) {
    // Already settled. Record nothing, invent nothing.
    return toMissionDTO(row, { includePrivate: true });
  }

  const at = payment.paidAt ?? new Date();
  const paid = await prisma.mission.update({
    where: { id: row.id },
    data: {
      paidAt: at,
      receiptNumber: row.receiptNumber ?? receiptNumberFor(row.code, at),
      stripeSessionId: payment.stripeSessionId ?? row.stripeSessionId,
      stripePaymentIntentId: payment.stripePaymentIntentId ?? row.stripePaymentIntentId,
      amountMinor: payment.amountMinor ?? row.amountMinor,
      currency: payment.currency ?? row.currency,
    },
    include: withEvents,
  });

  // Opening the timeline is a stage entry like any other, so it runs through
  // the state machine's side effects (this is what sends the confirmation
  // email). The mission is already AT MISSION_CONFIRMED, so the event is
  // written directly rather than transitioned into.
  const format = getFormat(paid.formatId as FormatId);

  await prisma.missionEvent.create({
    data: {
      missionId: paid.id,
      stage: 'MISSION_CONFIRMED',
      label: STAGE_LABEL.MISSION_CONFIRMED,
      detail:
        `Payment authorised${payment.stripeSessionId ? ` (${payment.stripeSessionId})` : ''}. ` +
        `Target locked at ${formatCoords(paid.lat, paid.lon)}. ` +
        `${format.metric} ${paid.frame === 'FRAMED' ? 'framed' : 'unframed'} (${format.designation}). ` +
        `Queued for tasking. Receipt ${paid.receiptNumber}.`,
      at,
    },
  });

  await sendEmail({
    to: paid.email,
    missionId: paid.id,
    template: 'order_confirmed',
    data: {
      code: paid.code,
      locationLabel: paid.locationLabel,
      lat: paid.lat,
      lon: paid.lon,
      formatLabel: `${format.metric} / ${paid.frame}`,
      amountLabel: formatPrice(paid.amountMinor, paid.currency as Currency),
      receiptNumber: paid.receiptNumber,
    },
  });

  const fresh = await prisma.mission.findUniqueOrThrow({
    where: { id: paid.id },
    include: withEvents,
  });
  return toMissionDTO(fresh, { includePrivate: true });
}

/** Records the checkout session id on a mission before the customer pays. */
export async function attachCheckoutSession(
  missionCode: string,
  sessionId: string,
): Promise<void> {
  const normalized = normalizeMissionCode(missionCode);
  if (!normalized) return;
  await prisma.mission.update({
    where: { code: normalized },
    data: { stripeSessionId: sessionId },
  });
}

/* ------------------------------------------------------------------ */
/* Advance                                                            */
/* ------------------------------------------------------------------ */

/**
 * Moves a mission forward. With no target it takes exactly one step; with a
 * target it walks every intermediate stage in order so the timeline is never
 * left with a hole and every side effect fires.
 *
 * This is the demo control behind POST /api/dev/advance, and it is also what a
 * real webhook handler calls when a provider reports progress.
 */
export interface AdvanceMissionOptions {
  /**
   * THE PRINT APPROVAL GATE. Nothing automatic — not the SkyFi webhook, not
   * the sweep, not a dev control — may carry a mission into PRINT, because
   * that transition places the real Gelato order. The pipeline stops at
   * PROCESSING (the composed final version) and waits for a person on
   * /admin to approve it; only that route passes `approvePrint: true`.
   */
  approvePrint?: boolean;
}

export async function advanceMission(
  code: string,
  to?: MissionStage | MissionState,
  opts: AdvanceMissionOptions = {},
): Promise<MissionDTO> {
  const row = await findRowByCode(code);
  if (!row) throw new MissionNotFoundError(code);

  const from = asState(row.state);
  const target = to ?? nextStage(from);

  if (!target) {
    throw new MissionValidationError(
      from === 'CANCELLED'
        ? 'Mission is cancelled. There is nothing to advance.'
        : 'Mission is already DELIVERED. There is nothing to advance.',
    );
  }

  let path = transitionPath(from, target);
  let held = false;
  if (!opts.approvePrint) {
    const gate = path.indexOf('PRINT');
    if (gate >= 0) {
      path = path.slice(0, gate);
      held = true;
    }
  }

  let current: MissionRow = row;
  for (const step of path) {
    current = await applyTransition(current, step);
  }

  if (held && asState(current.state) === 'PROCESSING') {
    const events = current.events ?? [];
    const last = events[events.length - 1];
    if (!last || last.label !== 'AWAITING PRINT APPROVAL') {
      await prisma.missionEvent.create({
        data: {
          missionId: current.id,
          stage: 'NOTE',
          label: 'AWAITING PRINT APPROVAL',
          detail:
            'Final composition ready. The print order is placed only after a mission operator approves the final version.',
        },
      });
      current = (await findRowByCode(current.code)) ?? current;
    }
  }

  return toMissionDTO(current, { includePrivate: true });
}

export interface CancelMissionOptions {
  /**
   * Hold the cancellation to the CUSTOMER's window — before the satellite is
   * tasked. Off by default, because operations must be able to stop a mission
   * that has gone wrong at any stage, and the demo control walks missions
   * into CANCELLED from everywhere to prove the timeline handles it.
   *
   * Every route a customer can reach passes `true`.
   */
  enforceCancellationWindow?: boolean;
}

/**
 * Cancels a mission: writes the CANCELLED transition and its event, and sends
 * the cancellation notice (both through `applyTransition`, so the write and
 * the event land in one transaction and the mail is post-commit).
 *
 * With `enforceCancellationWindow` it refuses — with the reason in plain
 * words — once the collection has been booked with the operator.
 */
export async function cancelMission(
  code: string,
  opts: CancelMissionOptions = {},
): Promise<MissionDTO> {
  const row = await findRowByCode(code);
  if (!row) throw new MissionNotFoundError(code);

  const from = asState(row.state);
  if (opts.enforceCancellationWindow) {
    const refusal = cancellationRefusal(from);
    if (refusal) throw new MissionTransitionError(from, 'CANCELLED', refusal);
  }

  const updated = await applyTransition(row, 'CANCELLED');
  return toMissionDTO(updated, { includePrivate: true });
}

/* ------------------------------------------------------------------ */
/* The sixty-day refund                                                */
/* ------------------------------------------------------------------ */

export interface RefundSweepResult {
  /** Missions closed and refunded by this run. */
  closed: string[];
  /** Missions that are due a refund but whose refund did not complete. */
  failed: string[];
  /** How many paid, un-captured missions were inspected. */
  inspected: number;
}

/**
 * THE SIXTY-DAY GUARANTEE, AS CODE.
 *
 * /legal/terms: "If no usable frame is acquired within sixty days of the
 * mission being confirmed, the mission is closed and refunded in full. You do
 * not need to ask." That sentence had nothing behind it — no timer, no job,
 * no refund call anywhere in the codebase. This is the job.
 *
 * A mission qualifies when it is paid, is not cancelled, has never reached
 * IMAGE_ACQUIRED (so no frame was delivered), and was confirmed more than
 * REFUND_WINDOW_DAYS ago. Cancelling it runs `cancelEffect`, which places the
 * refund and sends the notice, so this function does not duplicate either.
 *
 * `enforceCancellationWindow` is deliberately NOT passed: these missions are
 * long past tasking, and the whole point of the guarantee is that we close
 * them anyway.
 *
 * SCHEDULING — the owner must wire this to a timer. It is idempotent and safe
 * to run as often as you like: a mission it has already closed is CANCELLED
 * and no longer matches. Run it daily.
 */
export async function closeUnfulfilledMissions(
  now: Date = new Date(),
): Promise<RefundSweepResult> {
  const cutoff = new Date(now.getTime() - REFUND_WINDOW_DAYS * 86_400_000);

  // "Confirmed" is when the money was taken — `paidAt` — which is the start
  // the terms name and the one that favours the customer. Stages at or past
  // IMAGE_ACQUIRED have a frame, so they are out of scope whatever their age.
  const capturedStages = MISSION_STAGES.slice(stageIndex('IMAGE_ACQUIRED'));

  const rows = await prisma.mission.findMany({
    where: {
      paidAt: { not: null, lt: cutoff },
      state: { notIn: [...capturedStages, 'CANCELLED'] },
    },
    include: { events: { orderBy: { at: 'asc' } } },
  });

  const closed: string[] = [];
  const failed: string[] = [];

  for (const row of rows) {
    try {
      const updated = await applyTransition(row as MissionRow, 'CANCELLED', now);
      // `cancelEffect` writes the refund outcome into the event detail, so a
      // refund that Stripe refused is visible on the file rather than lost.
      const events = updated.events ?? [];
      const detail = events[events.length - 1]?.detail ?? '';
      if (detail.includes('could not be placed') || detail.includes('refused')) {
        failed.push(row.code);
      } else {
        closed.push(row.code);
      }
    } catch (err) {
      console.error(`[missions] 60-day close failed for ${row.code}:`, (err as Error).message);
      failed.push(row.code);
    }
  }

  return { closed, failed, inspected: rows.length };
}

/* ------------------------------------------------------------------ */
/* Imagery                                                            */
/* ------------------------------------------------------------------ */

/**
 * The catalogue slug backing a mission's imagery. Falls back to the
 * coordinate-derived pick so a poster can always be rendered, even for a
 * mission that has not reached IMAGE_ACQUIRED (Agent 9 uses this).
 */
export async function getMissionImagerySlug(code: string): Promise<string | null> {
  const row = await findRowByCode(code);
  if (!row) return null;
  return row.imagerySlug ?? pickFrameSlugForCoords(row.lat, row.lon);
}
