/**
 * ==================================================================
 * SEED — the demo dossier
 * ==================================================================
 * Four missions, each parked at a different stage so every screen in the
 * product is reviewable the moment `npm run dev` finishes:
 *
 *   32BF  FINAL_APPROACH   Los Angeles, US   hero-los-angeles
 *   74KL  IMAGE_ACQUIRED   Paris, EU         paris-fr
 *   18QD  CAPTURE_WINDOW   Berlin, EU        berlin-de
 *   55RA  DELIVERED        Seattle, US       seattle-us
 *
 * All four belong to operator@shotfromspace.com.
 *
 * IDEMPOTENT. Run it as often as you like: missions are upserted by code, and
 * their events, comms and mail logs are rebuilt from scratch each time. It
 * never duplicates and never leaves half a timeline behind.
 *
 * Timestamps are relative to "now" so the demo always reads correctly — 32BF
 * is out for delivery TODAY, 18QD is inside an open capture window, 55RA closed
 * three weeks ago. Everything else (telemetry, tracking numbers, order ids) is
 * deterministic, seeded by the mission code, so it is identical on every run.
 * ==================================================================
 */
import { PrismaClient } from '@prisma/client';
import { PRINT_FACILITY, currencyForRegion, getFormat, priceMinor, regionForCountry } from '../lib/pricing';
import { missionCaptureCloudPct, missionTelemetry } from '../lib/missions/telemetry';
import { CLOUD_THRESHOLD_PCT, materialLine } from '../lib/guarantees';
import { mockShipment } from '../lib/integrations/gelato';
import { formatCoords, formatTelemetryDate, formatTelemetryTimestamp } from '../lib/utils';
import { STAGE_LABEL } from '../lib/types';
import type { Currency, FormatId, FrameOption, MissionStage, Region } from '../lib/types';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'operator@shotfromspace.com';
const DAY = 86_400_000;
const NOW = new Date();

/** A back-dated timestamp: `ago(9, 18, 42)` = nine days ago at 18:42 UTC. */
function ago(days: number, hour: number, minute: number): Date {
  const d = new Date(NOW.getTime() - days * DAY);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

/** A forward-dated timestamp, for windows that are still open. */
function ahead(days: number, hour: number, minute: number): Date {
  return ago(-days, hour, minute);
}

/* ------------------------------------------------------------------ */
/* Mission specifications                                             */
/* ------------------------------------------------------------------ */

interface SeedEventSpec {
  stage: MissionStage | 'NOTE';
  label?: string;
  detail: string;
  at: Date;
}

interface SeedMissionSpec {
  code: string;
  shareToken: string;
  state: MissionStage;
  imagerySlug: string;

  addressLine1: string;
  addressLine2?: string;
  city: string;
  adminArea?: string;
  postalCode: string;
  countryCode: string;
  country: string;
  lat: number;
  lon: number;
  locationLabel: string;

  formatId: FormatId;
  frame: FrameOption;

  paidAt: Date;
  createdAt: Date;

  skyfiOrderId?: string;
  windowOpensAt?: Date;
  windowClosesAt?: Date;
  capturedAt?: Date;

  gelatoOrderId?: string;
  estimatedDeliveryAt?: Date;

  events: (ctx: SeedContext) => SeedEventSpec[];
  comms?: Array<{ role: 'OPERATOR' | 'CUSTOMER' | 'SYSTEM'; body: string; at: Date }>;
}

/** Everything derived from a spec, handed to the event builder. */
interface SeedContext {
  code: string;
  region: Region;
  currency: Currency;
  amountMinor: number;
  format: ReturnType<typeof getFormat>;
  frame: FrameOption;
  telemetry: ReturnType<typeof missionTelemetry>;
  facility: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  locationLabel: string;
  lat: number;
  lon: number;
  receiptNumber: string;
}

/* ------------------------------------------------------------------ */
/* 32BF — FINAL_APPROACH — Los Angeles, US                            */
/* ------------------------------------------------------------------ */

const M_32BF: SeedMissionSpec = {
  code: '32BF',
  shareToken: 'sh_32BF_7bK2mQ9xTuVr4LpZa1',
  state: 'FINAL_APPROACH',
  imagerySlug: 'hero-los-angeles',

  addressLine1: '6801 Hollywood Boulevard',
  addressLine2: 'Apt 4B',
  city: 'Los Angeles',
  adminArea: 'CA',
  postalCode: '90028',
  countryCode: 'US',
  country: 'United States',
  lat: 34.1017,
  lon: -118.3406,
  locationLabel: 'LOS ANGELES, CA / US',

  formatId: 'F50',
  frame: 'FRAMED',

  createdAt: ago(21, 16, 8),
  paidAt: ago(21, 16, 11),

  skyfiOrderId: 'sky_tsk_32BF_9f2c1a',
  windowOpensAt: ago(14, 9, 40),
  windowClosesAt: ago(3, 9, 40),
  capturedAt: ago(9, 18, 42),

  gelatoOrderId: 'gel_ord_32BF_4d81be',
  estimatedDeliveryAt: ago(0, 18, 0),

  events: (c) => [
    {
      stage: 'NOTE',
      label: 'ORDER RECEIVED',
      detail: `Target accepted: ${c.locationLabel}. ${c.format.metric} framed. Awaiting payment authorisation.`,
      at: ago(21, 16, 8),
    },
    {
      stage: 'MISSION_CONFIRMED',
      detail:
        `Payment authorised. Target locked at ${formatCoords(c.lat, c.lon)}. ` +
        `${c.format.metric} framed (${c.format.designation}). Queued for tasking. Receipt ${c.receiptNumber}.`,
      at: ago(21, 16, 11),
    },
    {
      stage: 'SATELLITE_TASKED',
      detail:
        `Collection order sky_tsk_32BF_9f2c1a accepted. 5 passes scheduled over the target between ` +
        `${formatTelemetryDate(ago(14, 9, 40))} and ${formatTelemetryDate(ago(3, 9, 40))}. ` +
        `${c.telemetry.sensor} at ${c.telemetry.gsdM} m GSD, ${c.telemetry.inclination}, off-nadir ${c.telemetry.offNadirDeg}°.`,
      at: ago(19, 11, 24),
    },
    {
      stage: 'CAPTURE_WINDOW',
      detail:
        `Window open: ${formatTelemetryDate(ago(14, 9, 40))} → ${formatTelemetryDate(ago(3, 9, 40))}. ` +
        `5 passes available over ${c.locationLabel}. Cloud forecast ${c.telemetry.cloudPct}%. ` +
        `The first pass under the ${CLOUD_THRESHOLD_PCT}% threshold is taken.`,
      at: ago(14, 9, 40),
    },
    {
      stage: 'IMAGE_ACQUIRED',
      detail:
        `Frame down at ${formatTelemetryTimestamp(ago(9, 18, 42))}. Cloud ${missionCaptureCloudPct(c.code)}%, off-nadir ${c.telemetry.offNadirDeg}°, ` +
        `${c.telemetry.gsdM} m GSD on ${c.telemetry.sensor}. Watermarked preview released to this file.`,
      at: ago(9, 18, 42),
    },
    {
      stage: 'PROCESSING',
      detail:
        `Colour grade locked. Composed to ${c.format.metric} (${c.format.ratio}, ${c.format.designation}). ` +
        `Telemetry overlay applied: ${formatCoords(c.lat, c.lon)}, capture timestamp, ` +
        `orbit block ${c.telemetry.track} / ${c.telemetry.inclination}.`,
      at: ago(8, 10, 5),
    },
    {
      stage: 'PRINT',
      detail:
        `Print file released to ${c.facility}. Production order gel_ord_32BF_4d81be. ` +
        materialLine(c.format.metric, true),
      at: ago(7, 14, 30),
    },
    {
      stage: 'SHIPPED',
      detail:
        `Handed to ${c.carrier} at ${c.facility}. Tracking ${c.trackingNumber}. ` +
        `Estimated delivery ${formatTelemetryDate(ago(0, 18, 0))}.`,
      at: ago(4, 21, 15),
    },
    {
      stage: 'FINAL_APPROACH',
      detail:
        `Out for delivery with ${c.carrier}. Tracking ${c.trackingNumber}. ` +
        `Final deliverable approaching ${c.locationLabel} today, ${formatTelemetryDate(ago(0, 18, 0))}.`,
      at: ago(0, 6, 20),
    },
  ],

  comms: [
    {
      role: 'CUSTOMER',
      body: 'The preview looks tighter than I expected. Is the whole block in the print or just the roof?',
      at: ago(9, 19, 10),
    },
    {
      role: 'OPERATOR',
      body:
        'The composed print covers 1.2 km on a side, centred on the target. Your building sits at the centre with roughly six blocks of street grid around it. The preview crops harder than the final file.',
      at: ago(9, 19, 14),
    },
    {
      role: 'CUSTOMER',
      body: 'Understood. Any chance of a second capture on a clearer day?',
      at: ago(8, 9, 2),
    },
    {
      role: 'OPERATOR',
      body:
        'Cloud came in at 3% on this pass, which is as clean as the window offered. A re-task would restart the collection and add roughly two weeks. My recommendation is to keep this frame.',
      at: ago(8, 9, 6),
    },
    {
      role: 'SYSTEM',
      body: 'Print file released to US / RENO, NV. Format 50 × 70 CM, framed.',
      at: ago(7, 14, 30),
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 74KL — IMAGE_ACQUIRED — Paris, EU                                  */
/* ------------------------------------------------------------------ */

const M_74KL: SeedMissionSpec = {
  code: '74KL',
  shareToken: 'sh_74KL_Qz3nR8vJdHm5YcWt2e',
  state: 'IMAGE_ACQUIRED',
  imagerySlug: 'paris-fr',

  addressLine1: '62 Rue des Archives',
  city: 'Paris',
  adminArea: 'Île-de-France',
  postalCode: '75003',
  countryCode: 'FR',
  country: 'France',
  lat: 48.8622,
  lon: 2.3585,
  locationLabel: 'PARIS / FR',

  formatId: 'F70',
  frame: 'UNFRAMED',

  createdAt: ago(12, 8, 47),
  paidAt: ago(12, 8, 49),

  skyfiOrderId: 'sky_tsk_74KL_2b7e40',
  windowOpensAt: ago(6, 10, 12),
  windowClosesAt: ahead(3, 10, 12),
  capturedAt: ago(1, 10, 51),

  events: (c) => [
    {
      stage: 'NOTE',
      label: 'ORDER RECEIVED',
      detail: `Target accepted: ${c.locationLabel}. ${c.format.metric} unframed. Awaiting payment authorisation.`,
      at: ago(12, 8, 47),
    },
    {
      stage: 'MISSION_CONFIRMED',
      detail:
        `Payment authorised. Target locked at ${formatCoords(c.lat, c.lon)}. ` +
        `${c.format.metric} unframed (${c.format.designation}). Queued for tasking. Receipt ${c.receiptNumber}.`,
      at: ago(12, 8, 49),
    },
    {
      stage: 'SATELLITE_TASKED',
      detail:
        `Collection order sky_tsk_74KL_2b7e40 accepted. 4 passes scheduled over the target between ` +
        `${formatTelemetryDate(ago(6, 10, 12))} and ${formatTelemetryDate(ahead(3, 10, 12))}. ` +
        `${c.telemetry.sensor} at ${c.telemetry.gsdM} m GSD, ${c.telemetry.inclination}, off-nadir ${c.telemetry.offNadirDeg}°.`,
      at: ago(10, 13, 2),
    },
    {
      stage: 'CAPTURE_WINDOW',
      detail:
        `Window open: ${formatTelemetryDate(ago(6, 10, 12))} → ${formatTelemetryDate(ahead(3, 10, 12))}. ` +
        `4 passes available over ${c.locationLabel}. Cloud forecast ${c.telemetry.cloudPct}%. ` +
        `The first pass under the ${CLOUD_THRESHOLD_PCT}% threshold is taken.`,
      at: ago(6, 10, 12),
    },
    {
      stage: 'IMAGE_ACQUIRED',
      detail:
        `Frame down at ${formatTelemetryTimestamp(ago(1, 10, 51))}. Cloud ${missionCaptureCloudPct(c.code)}%, off-nadir ${c.telemetry.offNadirDeg}°, ` +
        `${c.telemetry.gsdM} m GSD on ${c.telemetry.sensor}. Watermarked preview released to this file.`,
      at: ago(1, 10, 51),
    },
  ],

  comms: [
    {
      role: 'CUSTOMER',
      body: 'How long until this is printed? It is a gift and I need it by the end of the month.',
      at: ago(1, 11, 20),
    },
    {
      role: 'OPERATOR',
      body:
        'Processing takes a day. The print is released to Eindhoven the day after, and EU transit is three to five days. You are inside your date with a week to spare.',
      at: ago(1, 11, 23),
    },
    {
      role: 'CUSTOMER',
      body: 'Good. Can I see the frame before it goes to print?',
      at: ago(1, 11, 30),
    },
    {
      role: 'OPERATOR',
      body:
        'The watermarked preview on this file is the frame. The print file is the same capture at full resolution with the telemetry overlay composed in. Nothing about the image changes between here and the press.',
      at: ago(1, 11, 34),
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 18QD — CAPTURE_WINDOW — Berlin, EU                                 */
/* ------------------------------------------------------------------ */

const M_18QD: SeedMissionSpec = {
  code: '18QD',
  shareToken: 'sh_18QD_Lv6pT1sXkNb9GjEu3r',
  state: 'CAPTURE_WINDOW',
  imagerySlug: 'berlin-de',

  addressLine1: 'Oranienstraße 45',
  city: 'Berlin',
  adminArea: 'Berlin',
  postalCode: '10969',
  countryCode: 'DE',
  country: 'Germany',
  lat: 52.5027,
  lon: 13.4193,
  locationLabel: 'BERLIN / DE',

  formatId: 'F30',
  frame: 'FRAMED',

  createdAt: ago(8, 19, 33),
  paidAt: ago(8, 19, 35),

  skyfiOrderId: 'sky_tsk_18QD_6a03df',
  windowOpensAt: ago(2, 9, 58),
  windowClosesAt: ahead(9, 9, 58),

  events: (c) => [
    {
      stage: 'NOTE',
      label: 'ORDER RECEIVED',
      detail: `Target accepted: ${c.locationLabel}. ${c.format.metric} framed. Awaiting payment authorisation.`,
      at: ago(8, 19, 33),
    },
    {
      stage: 'MISSION_CONFIRMED',
      detail:
        `Payment authorised. Target locked at ${formatCoords(c.lat, c.lon)}. ` +
        `${c.format.metric} framed (${c.format.designation}). Queued for tasking. Receipt ${c.receiptNumber}.`,
      at: ago(8, 19, 35),
    },
    {
      stage: 'SATELLITE_TASKED',
      detail:
        `Collection order sky_tsk_18QD_6a03df accepted. 6 passes scheduled over the target between ` +
        `${formatTelemetryDate(ago(2, 9, 58))} and ${formatTelemetryDate(ahead(9, 9, 58))}. ` +
        `${c.telemetry.sensor} at ${c.telemetry.gsdM} m GSD, ${c.telemetry.inclination}, off-nadir ${c.telemetry.offNadirDeg}°.`,
      at: ago(6, 12, 41),
    },
    {
      stage: 'CAPTURE_WINDOW',
      detail:
        `Window open: ${formatTelemetryDate(ago(2, 9, 58))} → ${formatTelemetryDate(ahead(9, 9, 58))}. ` +
        `6 passes available over ${c.locationLabel}. Cloud forecast ${c.telemetry.cloudPct}%. ` +
        `The first pass under the ${CLOUD_THRESHOLD_PCT}% threshold is taken.`,
      at: ago(2, 9, 58),
    },
    {
      stage: 'NOTE',
      label: 'PASS RE-TASKED',
      detail:
        `Pass 2 aborted at 09:58 — cloud measured 71% over the target, well above the ${CLOUD_THRESHOLD_PCT}% threshold. ` +
        'The collection has been re-tasked to the next descending node. Four passes remain in the window and no ' +
        'additional charge applies: re-tasking for weather is included in the mission.',
      at: ago(1, 10, 4),
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 55RA — DELIVERED — Seattle, US                                     */
/* ------------------------------------------------------------------ */

const M_55RA: SeedMissionSpec = {
  code: '55RA',
  shareToken: 'sh_55RA_Fw4hC7yBqPd2ZnKx8s',
  state: 'DELIVERED',
  imagerySlug: 'seattle-us',

  addressLine1: '400 Broad Street',
  city: 'Seattle',
  adminArea: 'WA',
  postalCode: '98109',
  countryCode: 'US',
  country: 'United States',
  lat: 47.6205,
  lon: -122.3493,
  locationLabel: 'SEATTLE, WA / US',

  formatId: 'F50',
  frame: 'UNFRAMED',

  createdAt: ago(38, 15, 2),
  paidAt: ago(38, 15, 4),

  skyfiOrderId: 'sky_tsk_55RA_8c15aa',
  windowOpensAt: ago(31, 19, 3),
  windowClosesAt: ago(20, 19, 3),
  capturedAt: ago(27, 19, 3),

  gelatoOrderId: 'gel_ord_55RA_71e2cd',
  estimatedDeliveryAt: ago(19, 15, 40),

  events: (c) => [
    {
      stage: 'NOTE',
      label: 'ORDER RECEIVED',
      detail: `Target accepted: ${c.locationLabel}. ${c.format.metric} unframed. Awaiting payment authorisation.`,
      at: ago(38, 15, 2),
    },
    {
      stage: 'MISSION_CONFIRMED',
      detail:
        `Payment authorised. Target locked at ${formatCoords(c.lat, c.lon)}. ` +
        `${c.format.metric} unframed (${c.format.designation}). Queued for tasking. Receipt ${c.receiptNumber}.`,
      at: ago(38, 15, 4),
    },
    {
      stage: 'SATELLITE_TASKED',
      detail:
        `Collection order sky_tsk_55RA_8c15aa accepted. 5 passes scheduled over the target between ` +
        `${formatTelemetryDate(ago(31, 19, 3))} and ${formatTelemetryDate(ago(20, 19, 3))}. ` +
        `${c.telemetry.sensor} at ${c.telemetry.gsdM} m GSD, ${c.telemetry.inclination}, off-nadir ${c.telemetry.offNadirDeg}°.`,
      at: ago(36, 8, 19),
    },
    {
      stage: 'CAPTURE_WINDOW',
      detail:
        `Window open: ${formatTelemetryDate(ago(31, 19, 3))} → ${formatTelemetryDate(ago(20, 19, 3))}. ` +
        `5 passes available over ${c.locationLabel}. Cloud forecast ${c.telemetry.cloudPct}%. ` +
        `The first pass under the ${CLOUD_THRESHOLD_PCT}% threshold is taken.`,
      at: ago(31, 19, 3),
    },
    {
      stage: 'IMAGE_ACQUIRED',
      detail:
        `Frame down at ${formatTelemetryTimestamp(ago(27, 19, 3))}. Cloud ${missionCaptureCloudPct(c.code)}%, off-nadir ${c.telemetry.offNadirDeg}°, ` +
        `${c.telemetry.gsdM} m GSD on ${c.telemetry.sensor}. Watermarked preview released to this file.`,
      at: ago(27, 19, 3),
    },
    {
      stage: 'PROCESSING',
      detail:
        `Colour grade locked. Composed to ${c.format.metric} (${c.format.ratio}, ${c.format.designation}). ` +
        `Telemetry overlay applied: ${formatCoords(c.lat, c.lon)}, capture timestamp, ` +
        `orbit block ${c.telemetry.track} / ${c.telemetry.inclination}.`,
      at: ago(26, 11, 46),
    },
    {
      stage: 'PRINT',
      detail:
        `Print file released to ${c.facility}. Production order gel_ord_55RA_71e2cd. ` +
        materialLine(c.format.metric, false),
      at: ago(25, 9, 12),
    },
    {
      stage: 'SHIPPED',
      detail:
        `Handed to ${c.carrier} at ${c.facility}. Tracking ${c.trackingNumber}. ` +
        `Estimated delivery ${formatTelemetryDate(ago(19, 15, 40))}.`,
      at: ago(22, 17, 55),
    },
    {
      stage: 'FINAL_APPROACH',
      detail:
        `Out for delivery with ${c.carrier}. Tracking ${c.trackingNumber}. ` +
        `Final deliverable approaching ${c.locationLabel} today, ${formatTelemetryDate(ago(19, 15, 40))}.`,
      at: ago(19, 7, 5),
    },
    {
      stage: 'DELIVERED',
      detail:
        `Delivered ${formatTelemetryTimestamp(ago(19, 15, 40))} by ${c.carrier}. ` +
        `Full-resolution deliverable released to this file. Mission closed.`,
      at: ago(19, 15, 40),
    },
  ],
};

const MISSIONS: SeedMissionSpec[] = [M_32BF, M_74KL, M_18QD, M_55RA];

/* ------------------------------------------------------------------ */
/* Writer                                                             */
/* ------------------------------------------------------------------ */

/** Stages at or past X — used to decide which columns a mission carries. */
const ORDER: MissionStage[] = [
  'MISSION_CONFIRMED',
  'SATELLITE_TASKED',
  'CAPTURE_WINDOW',
  'IMAGE_ACQUIRED',
  'PROCESSING',
  'PRINT',
  'SHIPPED',
  'FINAL_APPROACH',
  'DELIVERED',
];
const reached = (state: MissionStage, stage: MissionStage) =>
  ORDER.indexOf(state) >= ORDER.indexOf(stage);

async function seedMission(spec: SeedMissionSpec, userId: string) {
  const region = regionForCountry(spec.countryCode);
  const currency = currencyForRegion(region);
  const format = getFormat(spec.formatId);
  const amountMinor = priceMinor(spec.formatId, spec.frame, currency);
  const telemetry = missionTelemetry(spec.code);
  const shipment = mockShipment(spec.code, region);
  const facility = PRINT_FACILITY[region];
  const receiptNumber = `SFS-${spec.paidAt.getUTCFullYear()}-${spec.code}`;

  const ctx: SeedContext = {
    code: spec.code,
    region,
    currency,
    amountMinor,
    format,
    frame: spec.frame,
    telemetry,
    facility,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl,
    locationLabel: spec.locationLabel,
    lat: spec.lat,
    lon: spec.lon,
    receiptNumber,
  };

  const data = {
    state: spec.state,
    stateEnteredAt: spec.events(ctx).at(-1)?.at ?? spec.paidAt,

    email: DEMO_EMAIL,
    userId,

    addressLine1: spec.addressLine1,
    addressLine2: spec.addressLine2 ?? null,
    city: spec.city,
    adminArea: spec.adminArea ?? null,
    postalCode: spec.postalCode,
    countryCode: spec.countryCode,
    country: spec.country,
    lat: spec.lat,
    lon: spec.lon,
    locationLabel: spec.locationLabel,

    formatId: spec.formatId,
    frame: spec.frame,
    printRegion: region,
    amountMinor,
    currency,
    areaKm: 1.2,

    stripeSessionId: `cs_seed_${spec.code}`,
    stripePaymentIntentId: `pi_seed_${spec.code}`,
    paidAt: spec.paidAt,
    receiptNumber,

    skyfiOrderId: spec.skyfiOrderId ?? null,
    windowOpensAt: spec.windowOpensAt ?? null,
    windowClosesAt: spec.windowClosesAt ?? null,
    capturedAt: spec.capturedAt ?? null,
    imagerySlug: spec.imagerySlug,
    previewUrl: reached(spec.state, 'IMAGE_ACQUIRED') ? `/api/poster/${spec.code}` : null,
    deliverableUrl: reached(spec.state, 'DELIVERED')
      ? `/api/poster/${spec.code}?variant=full`
      : null,

    sensor: telemetry.sensor,
    inclination: telemetry.inclination,
    track: telemetry.track,
    altitudeKm: telemetry.altitudeKm,
    gsdM: telemetry.gsdM,
    azimuthDeg: telemetry.azimuthDeg,
    offNadirDeg: telemetry.offNadirDeg,
    // Before capture this is the forecast; once a frame is accepted it is the
    // measured value, which by the published guarantee clears the threshold.
    // 55RA used to be seeded as accepted at 14% on a site promising that 10%
    // fails the frame.
    cloudPct: reached(spec.state, 'IMAGE_ACQUIRED')
      ? missionCaptureCloudPct(spec.code)
      : telemetry.cloudPct,

    gelatoOrderId: reached(spec.state, 'PRINT') ? (spec.gelatoOrderId ?? null) : null,
    printFacility: reached(spec.state, 'PRINT') ? facility : null,
    carrier: reached(spec.state, 'SHIPPED') ? shipment.carrier : null,
    trackingNumber: reached(spec.state, 'SHIPPED') ? shipment.trackingNumber : null,
    trackingUrl: reached(spec.state, 'SHIPPED') ? shipment.trackingUrl : null,
    estimatedDeliveryAt: spec.estimatedDeliveryAt ?? null,

    isDemo: true,
    isPublic: true,
    createdAt: spec.createdAt,
  };

  // Upsert by code: re-running the seed updates in place, never duplicates.
  const mission = await prisma.mission.upsert({
    where: { code: spec.code },
    update: data,
    create: { code: spec.code, shareToken: spec.shareToken, ...data },
  });

  // The timeline is rebuilt from scratch so a reseed cannot leave stale or
  // doubled events behind.
  await prisma.missionEvent.deleteMany({ where: { missionId: mission.id } });
  for (const e of spec.events(ctx)) {
    await prisma.missionEvent.create({
      data: {
        missionId: mission.id,
        stage: e.stage,
        label: e.label ?? STAGE_LABEL[e.stage as MissionStage],
        detail: e.detail,
        at: e.at,
        createdAt: e.at,
      },
    });
  }

  await prisma.commsMessage.deleteMany({ where: { missionId: mission.id } });
  for (const m of spec.comms ?? []) {
    await prisma.commsMessage.create({
      data: { missionId: mission.id, role: m.role, body: m.body, at: m.at },
    });
  }

  // Mail logs are regenerated by the running app; clear the seeded mission's
  // history so repeated seeds do not pile up.
  await prisma.emailLog.deleteMany({ where: { missionId: mission.id } });

  const price = `${currency} ${(amountMinor / 100).toFixed(0)}`;
  console.log(
    `  ${spec.code}  ${spec.state.padEnd(16)} ${spec.locationLabel.padEnd(20)} ` +
      `${format.designation} ${spec.frame.padEnd(9)} ${region}  ${price.padEnd(8)} ` +
      `${spec.events(ctx).length} events`,
  );
}

async function main() {
  console.log('\nSHOT FROM SPACE — seeding the demo dossier');
  console.log('─'.repeat(78));

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL },
  });
  console.log(`  demo account: ${user.email}`);
  console.log('─'.repeat(78));

  for (const spec of MISSIONS) {
    await seedMission(spec, user.id);
  }

  const [missions, events, comms] = await Promise.all([
    prisma.mission.count(),
    prisma.missionEvent.count(),
    prisma.commsMessage.count(),
  ]);

  console.log('─'.repeat(78));
  console.log(`  ${missions} missions, ${events} events, ${comms} comms messages`);
  console.log('  demo controls: POST /api/dev/advance { code, to? }\n');
}

main()
  .catch((err) => {
    console.error('\nSEED FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
