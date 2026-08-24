/**
 * Row → MissionDTO.
 *
 * This is the only place a database row becomes something a client can see.
 * The redaction rule is absolute: the street address, the customer email, the
 * amount paid and the receipt number live under `private`, and `private` is
 * only ever populated when the caller explicitly asks for it AND has already
 * proved ownership. Public views (/missions, /s/[code]) never pass the flag.
 */
import type { Mission, MissionEvent } from '@prisma/client';
import { missionShortLink } from '@/lib/codes';
import { getFormat } from '@/lib/pricing';
import { sanitizeDedication } from './dedication';
import {
  MISSION_STAGES,
  stageIndex,
  type Currency,
  type FormatId,
  type FrameOption,
  type MissionDTO,
  type MissionEventDTO,
  type MissionStage,
  type MissionState,
  type OrbitData,
  type Region,
} from '@/lib/types';

export type MissionRow = Mission & { events?: MissionEvent[] };

/** Narrow an arbitrary stored string back onto the MissionStage union. */
export function asStage(value: string): MissionStage | null {
  return (MISSION_STAGES as readonly string[]).includes(value)
    ? (value as MissionStage)
    : null;
}

/** The stored state, narrowed. Anything unrecognised reads as MISSION_CONFIRMED. */
export function asState(value: string): MissionState {
  if (value === 'CANCELLED') return 'CANCELLED';
  return asStage(value) ?? 'MISSION_CONFIRMED';
}

/**
 * A cancelled mission still has a position on the timeline — the furthest
 * stage it actually reached — so the UI can show where it stopped.
 */
export function resolveStage(row: MissionRow): MissionStage {
  const direct = asStage(row.state);
  if (direct) return direct;

  let best: MissionStage = 'MISSION_CONFIRMED';
  for (const e of row.events ?? []) {
    const s = asStage(e.stage);
    if (s && stageIndex(s) > stageIndex(best)) best = s;
  }
  return best;
}

export function orbitFromRow(row: MissionRow): OrbitData {
  return {
    sensor: row.sensor,
    inclination: row.inclination,
    track: row.track,
    altitudeKm: row.altitudeKm,
    gsdM: row.gsdM,
    azimuthDeg: row.azimuthDeg,
    offNadirDeg: row.offNadirDeg,
    cloudPct: row.cloudPct,
  };
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/**
 * Coordinate precision on a public surface.
 *
 * Four decimal places is ~11 m — that is not "near the address", it IS the
 * address, and it reverse-geocodes straight back to the street the redaction
 * above exists to withhold. Two decimal places is ~1.1 km, which is the same
 * order as the 1.2 km capture footprint the customer bought, so the public
 * file still says truthfully where the frame was taken without handing over
 * a doorstep. Owner views (`includePrivate`) keep the exact fix.
 */
const PUBLIC_COORD_DP = 2;
const roundTo = (n: number, dp: number) => Number(n.toFixed(dp));

/**
 * A Stripe object id, as a source fragment: a known prefix, an optional
 * `test_`/`live_` mode, then the opaque body. See `redactDetail`.
 */
const STRIPE_ID = '(?:cs|pi|ch|re|in|sub|cus|seti|py|txn)_(?:test_|live_)?[A-Za-z0-9]{10,}';

/**
 * The stage narrative is written for the owner and then shown to the public
 * on /missions and /s/[code]. Four things it must not carry across that
 * line: the receipt number (it is `private.receiptNumber` two fields up),
 * the exact fix (see PUBLIC_COORD_DP), the carrier tracking number (see the
 * field-level note in `toMissionDTO`) and the payment processor's own
 * identifiers. Scrubbing here rather than at each writer means a new event
 * string cannot reintroduce the leak by forgetting.
 */
function redactDetail(detail: string | null): string | null {
  if (!detail) return detail;
  return detail
    // "Receipt SFS-2026-32BF." / "Receipt: SFS-2026-32BF"
    .replace(/\s*Receipt:?\s+[A-Z]{2,4}-\d{4}-[A-Z0-9]{3,6}\.?/gi, '')
    /*
     * "Payment authorised (cs_test_a1b2c3…)." — `markMissionPaid` writes the
     * Stripe Checkout Session id into the MISSION_CONFIRMED detail, and that
     * detail is rendered on /missions and on every /s/[code] share link.
     *
     * A session id is not a public fact about a mission. It addresses the
     * Stripe object that carries the customer's email, the billing name and
     * the amount, so anyone holding it plus any leaked API key reads all
     * three; it also confirms which processor account took the payment. The
     * parenthesised id is removed whole — including the brackets and the
     * space in front of them — so "Payment authorised." still reads as a
     * finished sentence rather than an empty pair of brackets.
     *
     * Covers every Stripe id shape that could plausibly be written into a
     * narrative: cs_ (session), pi_ (payment intent), ch_ (charge), re_
     * (refund), in_ (invoice), sub_, cus_, seti_, py_, txn_.
     */
    .replace(new RegExp(`\\s*\\(\\s*${STRIPE_ID}\\s*\\)`, 'g'), '')
    // …and the same id written bare, without brackets, by a future writer.
    // The shape is deliberately narrow — prefix, optional mode, then ten or
    // more alphanumerics with no further underscore — so it cannot swallow
    // the provider order ids that legitimately appear in these narratives
    // ("sky_tsk_32BF_9f2c1a", "gel_ord_32BF_4d81be").
    .replace(new RegExp(`\\s*\\b${STRIPE_ID}\\b`, 'g'), '')
    // "Tracking 1Z1853297529863153." — the parcel number is a key to the
    // delivery address on the carrier's own site, so it never appears on a
    // surface that is withholding that address. Carrier NAME is fine and
    // stays: "Handed to UPS" tells the reader the true shape of the stage.
    .replace(/\s*Tracking:?\s+[A-Z0-9]{8,}\.?/gi, '')
    // "34.1017, -118.3406" → "34.10, -118.34"
    .replace(
      /(-?\d{1,3})\.(\d{3,})\s*,\s*(-?\d{1,3})\.(\d{3,})/g,
      (_m, a: string, af: string, b: string, bf: string) =>
        `${a}.${af.slice(0, PUBLIC_COORD_DP)}, ${b}.${bf.slice(0, PUBLIC_COORD_DP)}`,
    )
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function toEventDTO(e: MissionEvent, redact: boolean): MissionEventDTO {
  return {
    id: e.id,
    stage: (asStage(e.stage) ?? 'NOTE') as MissionStage | 'NOTE',
    label: e.label,
    detail: redact ? redactDetail(e.detail) : e.detail,
    at: e.at.toISOString(),
  };
}

export interface ToMissionDTOOptions {
  /** Owner/authenticated views only. Adds address, email, amount, receipt. */
  includePrivate?: boolean;
}

/**
 * The single mapper. Every surface in the product renders this shape.
 */
export function toMissionDTO(row: MissionRow, opts: ToMissionDTOOptions = {}): MissionDTO {
  const stage = resolveStage(row);
  const state = asState(row.state);
  const format = getFormat(row.formatId as FormatId);
  const reached = (s: MissionStage) => stageIndex(stage) >= stageIndex(s);
  const publicView = !opts.includePrivate;

  const events = (row.events ?? [])
    .slice()
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((e) => toEventDTO(e, publicView));

  const dto: MissionDTO = {
    code: row.code,
    shortLink: missionShortLink(row.code),
    state,
    stage,
    locationLabel: row.locationLabel,
    countryCode: row.countryCode,
    // Public surfaces get a city-level fix; the owner gets the real one.
    lat: publicView ? roundTo(row.lat, PUBLIC_COORD_DP) : row.lat,
    lon: publicView ? roundTo(row.lon, PUBLIC_COORD_DP) : row.lon,
    capturedAt: iso(row.capturedAt),
    windowOpensAt: iso(row.windowOpensAt),
    windowClosesAt: iso(row.windowClosesAt),
    orbit: orbitFromRow(row),
    format: {
      id: format.id,
      metric: format.metric,
      imperial: format.imperial,
      designation: format.designation,
      frame: row.frame as FrameOption,
    },
    region: row.printRegion as Region,
    // The facility is only meaningful once the job has been released to it.
    printFacility: reached('PRINT') ? row.printFacility : null,
    carrier: reached('SHIPPED') ? row.carrier : null,
    /**
     * The carrier NAME is public; the parcel NUMBER is not.
     *
     * A tracking number is a bearer token for the delivery address: pasted
     * into the carrier's own tracker it returns the destination town and
     * postcode, the delivery status and often a "left with / signed by"
     * line — which is precisely what `private.address` and PUBLIC_COORD_DP
     * exist to withhold. /s/[code] states in its own copy that "the
     * address, the receipt and the amount paid stay with its owner"; a
     * shareable link carrying the parcel number contradicts that promise.
     *
     * So it is gated on ownership as well as on stage. Public views keep
     * the carrier and the estimated date, which is what the reader of a
     * shared file legitimately wants to know.
     */
    trackingNumber: reached('SHIPPED') && opts.includePrivate ? row.trackingNumber : null,
    trackingUrl: reached('SHIPPED') && opts.includePrivate ? row.trackingUrl : null,
    estimatedDeliveryAt: iso(row.estimatedDeliveryAt),
    // Contract: the preview exists from IMAGE_ACQUIRED, never before.
    previewUrl: reached('IMAGE_ACQUIRED') ? (row.previewUrl ?? `/api/poster/${row.code}`) : null,
    deliverableUrl: reached('DELIVERED')
      ? (row.deliverableUrl ?? `/api/poster/${row.code}?variant=full`)
      : null,
    events,
    createdAt: row.createdAt.toISOString(),
  };

  if (opts.includePrivate) {
    dto.private = {
      email: row.email,
      address: {
        line1: row.addressLine1,
        line2: row.addressLine2 ?? undefined,
        city: row.city,
        region: row.adminArea ?? undefined,
        postalCode: row.postalCode,
        countryCode: row.countryCode,
        country: row.country,
        lat: row.lat,
        lon: row.lon,
      },
      amountMinor: row.amountMinor,
      currency: row.currency as Currency,
      receiptNumber: row.receiptNumber ?? '',
      paidAt: iso(row.paidAt),
      areaKm: row.areaKm,
      // Re-sanitised on the way out as well as on the way in: rows predating
      // the field, a hand-edited database and a future importer all reach
      // this mapper, and the plate composer downstream of it renders into
      // XML that a control character would invalidate outright.
      dedication: sanitizeDedication(row.dedication),
    };
  }

  return dto;
}
