/**
 * SHOT FROM SPACE — shared domain types.
 * This file is the contract between every module. Treat it as append-only:
 * if you need a new field, add it here first, then use it.
 */

/* ------------------------------------------------------------------ */
/* Mission state machine                                              */
/* ------------------------------------------------------------------ */

/**
 * The ordered mission lifecycle. Index in MISSION_STAGES == progress.
 * A mission is always at exactly one stage; every stage transition is
 * recorded as a MissionEvent so the timeline can be rebuilt from history.
 */
export const MISSION_STAGES = [
  'MISSION_CONFIRMED',
  'SATELLITE_TASKED',
  'CAPTURE_WINDOW',
  'IMAGE_ACQUIRED',
  'PROCESSING',
  'PRINT',
  'SHIPPED',
  'FINAL_APPROACH',
  'DELIVERED',
] as const;

export type MissionStage = (typeof MISSION_STAGES)[number];

/** Non-linear states a mission can enter. Stored on Order.state. */
export type MissionState = MissionStage | 'CANCELLED';

/** Human-facing stage labels. Never invent new label strings elsewhere. */
export const STAGE_LABEL: Record<MissionStage, string> = {
  MISSION_CONFIRMED: 'MISSION CONFIRMED',
  SATELLITE_TASKED: 'SATELLITE TASKED',
  CAPTURE_WINDOW: 'CAPTURE WINDOW',
  IMAGE_ACQUIRED: 'IMAGE ACQUIRED',
  PROCESSING: 'PROCESSING',
  PRINT: 'PRINT',
  SHIPPED: 'SHIPPED',
  FINAL_APPROACH: 'FINAL DELIVERABLE APPROACHING',
  DELIVERED: 'DELIVERED',
};

/** One-line description shown under each stage in the timeline. */
export const STAGE_DESCRIPTION: Record<MissionStage, string> = {
  MISSION_CONFIRMED: 'Order received. Target coordinates locked and queued for tasking.',
  SATELLITE_TASKED: 'Collection request accepted by the constellation operator.',
  CAPTURE_WINDOW: 'Satellite passes scheduled over the target. Awaiting clear conditions.',
  IMAGE_ACQUIRED: 'Frame captured and downlinked. Preview released to this file.',
  PROCESSING: 'Colour grade, composition and telemetry overlay applied.',
  PRINT: 'Print file released to the production facility.',
  SHIPPED: 'Package handed to the carrier. Tracking active.',
  FINAL_APPROACH: 'Out for delivery. Final deliverable approaching your address.',
  DELIVERED: 'Delivered. Mission file closed.',
};

export function stageIndex(stage: MissionStage): number {
  return MISSION_STAGES.indexOf(stage);
}

/** True when `stage` has been reached or passed by a mission at `current`. */
export function stageReached(current: MissionStage, stage: MissionStage): boolean {
  return stageIndex(current) >= stageIndex(stage);
}

/* ------------------------------------------------------------------ */
/* Products                                                           */
/* ------------------------------------------------------------------ */

export type FormatId = 'F30' | 'F50' | 'F70';
export type FrameOption = 'FRAMED' | 'UNFRAMED';
export type Currency = 'USD' | 'EUR';
/** Print + fulfilment region. Decides which Gelato facility runs the job. */
export type Region = 'US' | 'EU';

export interface PrintFormat {
  id: FormatId;
  /** Metric label, e.g. "30 × 40 CM" */
  metric: string;
  /** Imperial label, e.g. '12 × 16 IN' */
  imperial: string;
  /** Short designation used in telemetry, e.g. "FMT-30" */
  designation: string;
  ratio: string;
  /** Price in minor units (cents) keyed by currency then frame option. */
  price: Record<Currency, Record<FrameOption, number>>;
  /** Editorial one-liner. */
  note: string;
}

/* ------------------------------------------------------------------ */
/* Geo                                                                */
/* ------------------------------------------------------------------ */

export interface GeoSuggestion {
  id: string;
  /** Full single-line address as shown in the autocomplete list. */
  label: string;
  /** Street line only. */
  line1: string;
  city: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  country: string;
  lat: number;
  lon: number;
}

export interface TargetAddress {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  country: string;
  lat: number;
  lon: number;
}

/* ------------------------------------------------------------------ */
/* Mission (API shape returned to every client surface)               */
/* ------------------------------------------------------------------ */

export interface MissionEventDTO {
  id: string;
  stage: MissionStage | 'NOTE';
  label: string;
  detail?: string | null;
  /** ISO 8601 UTC. Render with formatTelemetryTimestamp(). */
  at: string;
}

export interface OrbitData {
  /** e.g. "SSO 97.4°" */
  inclination: string;
  /** e.g. "//ELIPSE 33°" — used by the OrbitDiagram primitive. */
  track: string;
  /** Altitude in km. */
  altitudeKm: number;
  /** Ground sample distance in metres. */
  gsdM: number;
  /** Constellation / sensor designation, e.g. "SKYFI-HR / OPTICAL". */
  sensor: string;
  /** Pass azimuth in degrees. */
  azimuthDeg: number;
  /** Off-nadir angle in degrees. */
  offNadirDeg: number;
  /** Cloud cover percentage at capture (or forecast). */
  cloudPct: number;
}

export interface MissionDTO {
  /** 2 digits + 2 letters, e.g. "32BF". Always uppercase. */
  code: string;
  /** Short link, e.g. "shot.space/M32BF" */
  shortLink: string;
  state: MissionState;
  stage: MissionStage;
  /** City-level location only — never the full street address on public views. */
  locationLabel: string;
  countryCode: string;
  lat: number;
  lon: number;
  /** ISO timestamp of the capture, null until IMAGE_ACQUIRED. */
  capturedAt: string | null;
  /** Capture window as ISO timestamps. */
  windowOpensAt: string | null;
  windowClosesAt: string | null;
  orbit: OrbitData;
  format: {
    id: FormatId;
    metric: string;
    imperial: string;
    designation: string;
    frame: FrameOption;
  };
  region: Region;
  /** e.g. "US / RENO, NV" or "EU / EINDHOVEN, NL" — null before PRINT. */
  printFacility: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDeliveryAt: string | null;
  /** Watermarked preview, available from IMAGE_ACQUIRED. */
  previewUrl: string | null;
  /** Full-resolution deliverable, available from DELIVERED. */
  deliverableUrl: string | null;
  events: MissionEventDTO[];
  createdAt: string;
  /** Present only on owner/authenticated views. */
  private?: {
    email: string;
    address: TargetAddress;
    amountMinor: number;
    currency: Currency;
    receiptNumber: string;
    /** ISO timestamp of settlement, null while the payment is unconfirmed. */
    paidAt: string | null;
    /** Capture footprint the customer selected, in km. */
    areaKm: number;
    /**
     * "What is this place?", in the customer's own words — the line printed
     * on the mission sheet. Personal, so it lives here and not on the public
     * projection: a shared file says where the frame was taken, never why it
     * mattered. Null when the question was skipped.
     * Written and read only through lib/missions/dedication.ts.
     */
    dedication: string | null;
  };
}

/* ------------------------------------------------------------------ */
/* Comms                                                              */
/* ------------------------------------------------------------------ */

export type CommsRole = 'OPERATOR' | 'CUSTOMER' | 'SYSTEM';

export interface CommsMessageDTO {
  id: string;
  role: CommsRole;
  body: string;
  at: string;
}

export type VoiceLinkState =
  | 'IDLE'
  | 'REQUESTING'
  | 'CONNECTING'
  | 'LIVE'
  | 'ENDED'
  | 'UNAVAILABLE';

/* ------------------------------------------------------------------ */
/* Account                                                            */
/* ------------------------------------------------------------------ */

export interface SessionUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface ApiError {
  error: string;
  detail?: string;
}
