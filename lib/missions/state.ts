/**
 * THE MISSION STATE MACHINE.
 *
 * This file is the single source of truth for the timeline. Nothing else in
 * the product is allowed to write `Mission.state` or invent a stage label.
 *
 * Rules
 *   1. Progress is forward-only through MISSION_STAGES. You may not skip a
 *      stage and you may not go back. `CANCELLED` is reachable from anywhere
 *      except itself and is terminal.
 *   2. Every accepted transition writes exactly one MissionEvent, with a real
 *      timestamp, the canonical STAGE_LABEL, and a detail line that says
 *      something specific about THIS mission — never a generic string.
 *   3. Entering a stage has side effects (tasking, capture, print, shipment,
 *      email). They all run through lib/integrations/*, so they are mocked by
 *      default and never throw because a key is missing.
 *   4. An illegal transition throws MissionTransitionError. Callers map that
 *      to HTTP 409.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { MISSION_STAGES, STAGE_LABEL, stageIndex } from '@/lib/types';
import type { FormatId, FrameOption, MissionStage, MissionState, Region } from '@/lib/types';
import { getFormat, PRINT_FACILITY, formatPrice } from '@/lib/pricing';
import { CLOUD_THRESHOLD_PCT, materialLine } from '@/lib/guarantees';
import { formatCoords, formatTelemetryDate, formatTelemetryTimestamp } from '@/lib/utils';
import { requestTasking, fetchCapture } from '@/lib/integrations/skyfi';
import { refundPayment } from '@/lib/integrations/stripe';
import { printFileUrlFor } from '@/lib/print-file';
import { createPrintOrder, getOrderStatus, mockShipment } from '@/lib/integrations/gelato';
import { sendEmail, type MissionEmailData } from '@/lib/integrations/email';
import { pickFrameSlugForCoords } from './frames';
import { seededInt } from './telemetry';
import { MissionTransitionError } from './errors';
import { asState, resolveStage, type MissionRow } from './dto';

/* ------------------------------------------------------------------ */
/* Legal transitions                                                  */
/* ------------------------------------------------------------------ */

/**
 * Derived from MISSION_STAGES so the graph can never drift from the type.
 * Each stage may advance to exactly its successor, or be cancelled.
 */
export const MISSION_TRANSITIONS: Record<MissionState, readonly MissionState[]> =
  (() => {
    const map = {} as Record<MissionState, MissionState[]>;
    MISSION_STAGES.forEach((stage, i) => {
      const next = MISSION_STAGES[i + 1];
      map[stage] = next ? [next, 'CANCELLED'] : ['CANCELLED'];
    });
    map.CANCELLED = [];
    return map;
  })();

export function canTransition(from: MissionState, to: MissionState): boolean {
  return MISSION_TRANSITIONS[from].includes(to);
}

/* ------------------------------------------------------------------ */
/* The customer's cancellation window                                 */
/* ------------------------------------------------------------------ */

/**
 * The first stage at which a customer can no longer cancel.
 *
 * This is a commercial fact, not a UI preference: at SATELLITE_TASKED the
 * collection is booked with the constellation operator and the capture cost
 * is committed. /legal/terms says exactly this — "you may cancel for a full
 * refund at any point before the satellite is tasked … once the mission
 * reaches SATELLITE TASKED the capture cost is committed" — and the landing
 * page repeats it as one of the five guarantees.
 *
 * `MISSION_TRANSITIONS` still allows CANCELLED from anywhere, because
 * operations must be able to stop a mission that has gone wrong at any stage.
 * The window below is the CUSTOMER's right, enforced by `cancelMission` when
 * it is asked to, and never by the state graph.
 */
export const CANCELLATION_CLOSES_AT: MissionStage = 'SATELLITE_TASKED';

/** True while a mission is still the customer's to call off. */
export function withinCancellationWindow(state: MissionState): boolean {
  if (state === 'CANCELLED') return false;
  return stageIndex(state) < stageIndex(CANCELLATION_CLOSES_AT);
}

/**
 * Why a cancellation was refused, in the customer's own terms, or null when
 * it is allowed. Written here rather than in the route so the reason cannot
 * drift from the rule that produced it.
 */
export function cancellationRefusal(state: MissionState): string | null {
  if (state === 'CANCELLED') {
    return 'This mission is already cancelled.';
  }
  if (withinCancellationWindow(state)) return null;
  const now = STAGE_LABEL[state as MissionStage];
  const reached =
    state === CANCELLATION_CLOSES_AT
      ? `This mission is at ${now}`
      : `This mission passed ${STAGE_LABEL[CANCELLATION_CLOSES_AT]} and is at ${now}`;
  return (
    `Cancellation closes when the satellite is tasked. ${reached}, so the capture ` +
    `cost is committed and the collection can no longer be called off. If the ` +
    `delivered print is damaged or misprinted we replace it — reach mission control ` +
    `through the comms channel on your mission file.`
  );
}

/** The stage a mission would move to next, or null at the end of the line. */
export function nextStage(from: MissionState): MissionStage | null {
  if (from === 'CANCELLED') return null;
  const i = stageIndex(from);
  return MISSION_STAGES[i + 1] ?? null;
}

/**
 * Expands "take this mission to X" into the ordered list of single-step
 * transitions required to get there. Used by the demo control so one call can
 * walk a mission from CAPTURE_WINDOW to DELIVERED, firing every side effect
 * on the way — the timeline must never contain holes.
 */
export function transitionPath(from: MissionState, to: MissionState): MissionState[] {
  if (to === 'CANCELLED') {
    if (from === 'CANCELLED') {
      throw new MissionTransitionError(from, to, 'Mission is already cancelled.');
    }
    return ['CANCELLED'];
  }
  if (from === 'CANCELLED') {
    throw new MissionTransitionError(from, to, 'A cancelled mission cannot be resumed.');
  }

  const fromIdx = stageIndex(from);
  const toIdx = stageIndex(to as MissionStage);
  if (toIdx <= fromIdx) {
    throw new MissionTransitionError(
      from,
      to,
      `Missions are forward-only. ${from} cannot return to ${to}.`,
    );
  }
  return MISSION_STAGES.slice(fromIdx + 1, toIdx + 1) as MissionState[];
}

/* ------------------------------------------------------------------ */
/* Side effects                                                       */
/* ------------------------------------------------------------------ */

interface StageEffect {
  /** Columns written alongside the state change. */
  data: Prisma.MissionUpdateInput;
  /** The MissionEvent detail line. Always specific to this mission. */
  detail: string;
  /**
   * Fired AFTER the write commits, so a mail failure can never roll back a
   * stage transition. Awaited, but swallows its own errors.
   */
  after?: (row: MissionRow) => Promise<void>;
}

function emailData(row: MissionRow): MissionEmailData {
  const f = getFormat(row.formatId as FormatId);
  return {
    code: row.code,
    locationLabel: row.locationLabel,
    lat: row.lat,
    lon: row.lon,
    formatLabel: `${f.metric} / ${row.frame}`,
    framed: row.frame === 'FRAMED',
    amountLabel: formatPrice(row.amountMinor, row.currency as 'USD' | 'EUR'),
    receiptNumber: row.receiptNumber,
    sensor: row.sensor,
    gsdM: row.gsdM,
    windowOpensAt: row.windowOpensAt,
    windowClosesAt: row.windowClosesAt,
    capturedAt: row.capturedAt,
    cloudPct: row.cloudPct,
    printFacility: row.printFacility,
    carrier: row.carrier,
    trackingNumber: row.trackingNumber,
    trackingUrl: row.trackingUrl,
    estimatedDeliveryAt: row.estimatedDeliveryAt,
  };
}

/**
 * Everything that happens when a mission ENTERS a stage.
 * Returns the columns to write and the event detail; the caller commits both
 * in one transaction.
 */
async function enterStage(row: MissionRow, stage: MissionStage, at: Date): Promise<StageEffect> {
  const code = row.code;
  const format = getFormat(row.formatId as FormatId);
  const frame = row.frame as FrameOption;
  const region = row.printRegion as Region;

  switch (stage) {
    /* -------------------------------------------------------------- */
    case 'MISSION_CONFIRMED': {
      return {
        data: {},
        detail:
          `Payment authorised. Target locked at ${formatCoords(row.lat, row.lon)}. ` +
          `${format.metric} ${frame === 'FRAMED' ? 'framed' : 'unframed'} ` +
          `(${format.designation}). Queued for tasking.`,
        after: async (updated) => {
          await sendEmail({
            to: updated.email,
            missionId: updated.id,
            template: 'order_confirmed',
            data: emailData(updated),
          });
        },
      };
    }

    /* -------------------------------------------------------------- */
    case 'SATELLITE_TASKED': {
      // The collection is booked with the constellation operator.
      const tasking = await requestTasking({
        lat: row.lat,
        lon: row.lon,
        areaKm: row.areaKm,
        missionCode: code,
      });

      const opens = new Date(tasking.windowOpensAt);
      const closes = new Date(tasking.windowClosesAt);

      return {
        data: {
          skyfiOrderId: tasking.orderId,
          windowOpensAt: opens,
          windowClosesAt: closes,
          sensor: tasking.sensor,
          gsdM: tasking.gsdM,
          azimuthDeg: tasking.azimuthDeg,
          offNadirDeg: tasking.offNadirDeg,
          inclination: tasking.inclination,
          track: tasking.track,
          altitudeKm: tasking.altitudeKm,
          cloudPct: tasking.cloudPct,
        },
        detail:
          `Collection order ${tasking.orderId} accepted. ${tasking.passes} passes scheduled ` +
          `over the target between ${formatTelemetryDate(opens)} and ${formatTelemetryDate(closes)}. ` +
          `${tasking.sensor} at ${tasking.gsdM} m GSD, ${tasking.inclination}, off-nadir ${tasking.offNadirDeg}°.`,
      };
    }

    /* -------------------------------------------------------------- */
    case 'CAPTURE_WINDOW': {
      // No external call — the window was booked at tasking. This stage is
      // the honest admission that we are waiting for weather.
      const passes = seededInt(`passes:${code}`, 3, 7);
      const opens = row.windowOpensAt;
      const closes = row.windowClosesAt;
      const span =
        opens && closes
          ? `${formatTelemetryDate(opens)} → ${formatTelemetryDate(closes)}`
          : 'pending operator confirmation';

      return {
        data: {},
        detail:
          `Window open: ${span}. ${passes} passes available over ${row.locationLabel}. ` +
          `Cloud forecast ${row.cloudPct}%. The first pass under the ${CLOUD_THRESHOLD_PCT}% threshold is taken.`,
      };
    }

    /* -------------------------------------------------------------- */
    case 'IMAGE_ACQUIRED': {
      // Pull the capture metadata from the operator, then bind the mission to
      // a catalogue frame. In live mode the frame comes from the downlinked
      // asset instead and imagerySlug becomes decorative.
      const capture = row.skyfiOrderId ? await fetchCapture(row.skyfiOrderId).catch(() => null) : null;
      const capturedAt = at;
      const cloudPct = capture?.cloudPct ?? row.cloudPct;
      const slug = pickFrameSlugForCoords(row.lat, row.lon);

      return {
        data: {
          capturedAt,
          imagerySlug: slug,
          previewUrl: `/api/poster/${code}`,
          // The delivered asset itself (live: SkyFi's signed download URL).
          // This is what the print composes from and what an operator
          // downloads from /admin; the catalogue slug is only the stand-in.
          captureAssetUrl: capture?.assetUrl && /^https?:\/\//.test(capture.assetUrl) ? capture.assetUrl : null,
          cloudPct,
        },
        detail:
          `Frame down at ${formatTelemetryTimestamp(capturedAt)}. ` +
          `Cloud ${cloudPct}%, off-nadir ${row.offNadirDeg}°, ${row.gsdM} m GSD on ${row.sensor}. ` +
          `Watermarked preview released to this file.`,
        after: async (updated) => {
          await sendEmail({
            to: updated.email,
            missionId: updated.id,
            template: 'image_acquired',
            data: emailData(updated),
          });
        },
      };
    }

    /* -------------------------------------------------------------- */
    case 'PROCESSING': {
      // Nothing external. Agent 9's pipeline composes the print file; this
      // stage records what was done to the frame.
      return {
        data: {},
        detail:
          `Colour grade locked. Composed to ${format.metric} (${format.ratio}, ${format.designation}). ` +
          `Telemetry overlay applied: ${formatCoords(row.lat, row.lon)}, ` +
          `capture timestamp, orbit block ${row.track} / ${row.inclination}.`,
      };
    }

    /* -------------------------------------------------------------- */
    case 'PRINT': {
      // Region routing happens inside the adapter: US → Reno, EU → Eindhoven.
      const order = await createPrintOrder({
        missionCode: code,
        formatId: row.formatId as FormatId,
        frame,
        region,
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
        // The production asset: the operator's replacement file when one was
        // supplied on /admin, else the composed, unwatermarked print behind
        // its signed URL (lib/print-file.ts). Absolute, so Gelato can fetch it.
        fileUrl: printFileUrlFor(row),
        email: row.email,
      });

      return {
        data: {
          gelatoOrderId: order.orderId,
          printFacility: order.facility ?? PRINT_FACILITY[region],
        },
        detail:
          `Print file released to ${order.facility}. Production order ${order.orderId}. ` +
          materialLine(format.metric, frame === 'FRAMED'),
      };
    }

    /* -------------------------------------------------------------- */
    case 'SHIPPED': {
      // Ask the print provider for the shipment; fall back to a deterministic
      // region-correct carrier if the provider has not attached one yet.
      const status = row.gelatoOrderId
        ? await getOrderStatus(row.gelatoOrderId).catch(() => null)
        : null;

      const regionCorrect = status?.facility === PRINT_FACILITY[region];
      const fallback = mockShipment(code, region);

      const carrier = (regionCorrect && status?.carrier) || fallback.carrier;
      const trackingNumber = (regionCorrect && status?.trackingNumber) || fallback.trackingNumber;
      const trackingUrl = (regionCorrect && status?.trackingUrl) || fallback.trackingUrl;

      const eta =
        status?.estimatedDeliveryAt && regionCorrect
          ? new Date(status.estimatedDeliveryAt)
          : new Date(at.getTime() + seededInt(`transit:${code}`, 3, 7) * 86_400_000);
      eta.setUTCHours(17, 0, 0, 0);

      return {
        data: {
          carrier,
          trackingNumber,
          trackingUrl,
          estimatedDeliveryAt: eta,
          printFacility: row.printFacility ?? PRINT_FACILITY[region],
        },
        detail:
          `Handed to ${carrier} at ${row.printFacility ?? PRINT_FACILITY[region]}. ` +
          `Tracking ${trackingNumber}. Estimated delivery ${formatTelemetryDate(eta)}.`,
      };
    }

    /* -------------------------------------------------------------- */
    case 'FINAL_APPROACH': {
      // Out for delivery: the ETA collapses to today.
      const today = new Date(at);
      today.setUTCHours(18, 0, 0, 0);

      return {
        data: { estimatedDeliveryAt: today },
        detail:
          `Out for delivery with ${row.carrier ?? 'the carrier'}. ` +
          `Tracking ${row.trackingNumber ?? '—'}. ` +
          `Final deliverable approaching ${row.locationLabel} today, ${formatTelemetryDate(today)}.`,
      };
    }

    /* -------------------------------------------------------------- */
    case 'DELIVERED': {
      return {
        data: {
          deliverableUrl: `/api/poster/${code}?variant=full`,
          estimatedDeliveryAt: row.estimatedDeliveryAt ?? at,
        },
        detail:
          `Delivered ${formatTelemetryTimestamp(at)} by ${row.carrier ?? 'the carrier'}. ` +
          `Full-resolution deliverable released to this file. Mission closed.`,
      };
    }
  }
}

/**
 * Cancellation is not a stage, so it gets its own effect.
 *
 * The notice goes out from here rather than from the route, for the same
 * reason every other stage email does: a mission that reaches CANCELLED has
 * to tell its owner, whoever moved it — the customer's own cancel route, an
 * operator, or the demo control. `after` runs post-commit and swallows its
 * errors, so a mail failure can never roll back the transition.
 */
async function cancelEffect(row: MissionRow, at: Date): Promise<StageEffect> {
  const stoppedAt = resolveStage(row);

  // THE REFUND IS PART OF THE CANCELLATION, not a follow-up somebody
  // remembers. /legal/terms promises the money back without being asked, so
  // the call happens here and its outcome is written into the timeline —
  // including when it fails, which is the case that used to be invisible.
  // `refundPayment` never throws; a Stripe outage must not block a
  // cancellation the customer is entitled to.
  const refund = row.paidAt
    ? await refundPayment({
        missionCode: row.code,
        paymentIntentId: row.stripePaymentIntentId,
        reason: 'cancelled',
      })
    : null;

  return {
    data: {},
    detail:
      `Mission cancelled ${formatTelemetryTimestamp(at)} at stage ` +
      `${STAGE_LABEL[stoppedAt]}. No further collection will be attempted.` +
      (refund ? ` ${refund.detail}` : ''),
    after: async (updated) => {
      await sendEmail({
        to: updated.email,
        missionId: updated.id,
        template: 'mission_cancelled',
        // `updated.state` is CANCELLED by now, so the stage the mission
        // actually stopped at is read off the row as it was before the write.
        data: {
          ...emailData(updated),
          stageLabel: STAGE_LABEL[stoppedAt],
          cancelledBeforeTasking: withinCancellationWindow(stoppedAt),
          refundStatus: refund?.status ?? 'NOT_CHARGED',
        },
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Commit                                                             */
/* ------------------------------------------------------------------ */

const withEvents = { events: { orderBy: { at: 'asc' } } } as const;

/**
 * Applies ONE transition: validates it, runs the side effects, writes the
 * mission row and its MissionEvent in a single transaction, then fires the
 * post-commit work (email).
 */
export async function applyTransition(
  row: MissionRow,
  to: MissionState,
  at: Date = new Date(),
): Promise<MissionRow> {
  const from = asState(row.state);
  if (!canTransition(from, to)) {
    throw new MissionTransitionError(from, to);
  }

  const effect =
    to === 'CANCELLED'
      ? await cancelEffect(row, at)
      : await enterStage(row, to as MissionStage, at);

  const label = to === 'CANCELLED' ? 'MISSION CANCELLED' : STAGE_LABEL[to as MissionStage];

  const updated = await prisma.$transaction(async (tx) => {
    await tx.mission.update({
      where: { id: row.id },
      data: { ...effect.data, state: to, stateEnteredAt: at },
    });
    await tx.missionEvent.create({
      data: {
        missionId: row.id,
        stage: to,
        label,
        detail: effect.detail,
        at,
      },
    });
    return tx.mission.findUniqueOrThrow({ where: { id: row.id }, include: withEvents });
  });

  if (effect.after) {
    try {
      await effect.after(updated);
    } catch (err) {
      // Post-commit work is best-effort by design.
      console.error(`[mission ${row.code}] post-transition work failed:`, (err as Error).message);
    }
  }

  return updated;
}
