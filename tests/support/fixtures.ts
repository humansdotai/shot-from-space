/**
 * Test fixtures shared by the unit and integration suites.
 *
 * `syntheticRow` is a full Mission row built in memory — no database, no
 * seed, nothing to clean up — so the redaction mapper can be tested against
 * values chosen to be unmistakable if they ever leak.
 */
import type { Mission, MissionEvent } from '@prisma/client';

export type Row = Mission & { events?: MissionEvent[] };

/** Values that must never appear on a public surface. Deliberately distinctive. */
export const SECRETS = {
  addressLine1: '6801 Hollywood Boulevard',
  addressLine2: 'Apartment 14C',
  email: 'qa-redaction-probe@shotfromspace.test',
  receiptNumber: 'SFS-2026-99ZZ',
  amountMinor: 42000,
  postalCode: '90028',
  lat: 34.101789,
  lon: -118.340612,
  /** The same fix at 4 dp, as it is written into event details. */
  latText: '34.1018',
  lonText: '-118.3406',
} as const;

const AT = new Date('2026-08-12T18:42:00.000Z');

export function syntheticEvent(over: Partial<MissionEvent> = {}): MissionEvent {
  return {
    id: 'evt_synthetic_1',
    missionId: 'msn_synthetic',
    stage: 'MISSION_CONFIRMED',
    label: 'MISSION CONFIRMED',
    detail:
      `Payment authorised. Target locked at ${SECRETS.latText}, ${SECRETS.lonText}. ` +
      `50 × 70 CM framed (FMT-50). Queued for tasking. Receipt ${SECRETS.receiptNumber}.`,
    at: AT,
    createdAt: AT,
    ...over,
  } as MissionEvent;
}

/**
 * A complete Mission row parked at FINAL_APPROACH, carrying every private
 * value in SECRETS. Override anything a test needs to vary.
 */
export function syntheticRow(over: Partial<Row> = {}): Row {
  const row = {
    id: 'msn_synthetic',
    code: '99ZZ',
    shareToken: 'tok_synthetic_share_key',

    state: 'FINAL_APPROACH',
    stateEnteredAt: AT,

    email: SECRETS.email,
    userId: 'usr_synthetic',

    addressLine1: SECRETS.addressLine1,
    addressLine2: SECRETS.addressLine2,
    city: 'Los Angeles',
    adminArea: 'CA',
    postalCode: SECRETS.postalCode,
    countryCode: 'US',
    country: 'United States',
    lat: SECRETS.lat,
    lon: SECRETS.lon,
    locationLabel: 'LOS ANGELES, CA / US',

    formatId: 'F50',
    frame: 'FRAMED',
    printRegion: 'US',
    amountMinor: SECRETS.amountMinor,
    currency: 'USD',
    areaKm: 2,

    stripeSessionId: 'cs_mock_99ZZ',
    stripePaymentIntentId: 'pi_mock_99ZZ',
    paidAt: AT,
    receiptNumber: SECRETS.receiptNumber,

    skyfiOrderId: 'sky_99ZZ',
    windowOpensAt: new Date('2026-08-07T09:40:00.000Z'),
    windowClosesAt: new Date('2026-08-18T09:40:00.000Z'),
    capturedAt: AT,
    imagerySlug: 'hero-los-angeles',
    previewUrl: '/api/poster/99ZZ',
    deliverableUrl: null,

    sensor: 'SKYFI-HR / OPTICAL',
    inclination: 'SSO 97.4°',
    track: '//ELIPSE 53°',
    altitudeKm: 514,
    gsdM: 0.54,
    azimuthDeg: 117,
    offNadirDeg: 1.3,
    cloudPct: 21,

    gelatoOrderId: 'gel_99ZZ',
    printFacility: 'US / RENO, NV',
    carrier: 'UPS',
    trackingNumber: '1Z1853297529863153',
    trackingUrl: 'https://www.ups.com/track?tracknum=1Z1853297529863153',
    estimatedDeliveryAt: new Date('2026-08-21T18:00:00.000Z'),

    isDemo: false,
    isPublic: false,

    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: AT,

    events: [syntheticEvent()],
  } as unknown as Row;

  return { ...row, ...over };
}
