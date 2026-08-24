import { test, expect } from '@playwright/test';
import { toMissionDTO } from '@/lib/missions/dto';
import { SECRETS, syntheticEvent, syntheticRow } from '../support/fixtures';
import { collectKeys, findLeaks, findPreciseDecimals } from '../support/redaction';

/**
 * DTO REDACTION — the highest-value test in this suite.
 *
 * `toMissionDTO` is the only place a database row becomes something a client
 * can see. Public and shared surfaces call it without `includePrivate`; the
 * owner's own views call it with. Everything below asserts on the returned
 * object rather than on rendered markup, because a value that reaches the DTO
 * is leaked whether or not today's components happen to print it.
 */

const PRIVATE_KEYS = [
  'email',
  'addressLine1',
  'addressLine2',
  'postalCode',
  'amountMinor',
  'receiptNumber',
  'paidAt',
  'stripeSessionId',
  'stripePaymentIntentId',
];

test('redaction: the public DTO carries no `private` block at all', () => {
  const dto = toMissionDTO(syntheticRow());
  expect(dto.private).toBeUndefined();
  expect(Object.keys(dto)).not.toContain('private');
});

test('redaction: the public DTO carries no street address, anywhere in the object graph', () => {
  const dto = toMissionDTO(syntheticRow());
  expect(findLeaks(dto, SECRETS.addressLine1)).toEqual([]);
  expect(findLeaks(dto, SECRETS.addressLine2)).toEqual([]);
  expect(findLeaks(dto, SECRETS.postalCode)).toEqual([]);
  expect(findLeaks(dto, 'Hollywood')).toEqual([]);
});

test('redaction: the public DTO carries no customer email, anywhere in the object graph', () => {
  const dto = toMissionDTO(syntheticRow());
  expect(findLeaks(dto, SECRETS.email)).toEqual([]);
  expect(findLeaks(dto, 'qa-redaction-probe')).toEqual([]);
  expect(findLeaks(dto, '@shotfromspace.test')).toEqual([]);
});

test('redaction: the public DTO carries no amount paid, anywhere in the object graph', () => {
  const dto = toMissionDTO(syntheticRow());
  expect(findLeaks(dto, String(SECRETS.amountMinor))).toEqual([]);
  expect(findLeaks(dto, '$420')).toEqual([]);
  expect(findLeaks(dto, '420.00')).toEqual([]);
});

test('redaction: the public DTO carries no receipt number, including inside event details', () => {
  const dto = toMissionDTO(syntheticRow());
  expect(findLeaks(dto, SECRETS.receiptNumber)).toEqual([]);
  expect(findLeaks(dto, 'SFS-2026')).toEqual([]);
  // The seeded event detail ends "… Receipt SFS-2026-99ZZ." — the whole
  // phrase is scrubbed, not just the number.
  expect(dto.events[0].detail).not.toMatch(/receipt/i);
});

test('redaction: no private field NAME survives onto the public DTO', () => {
  const keys = collectKeys(toMissionDTO(syntheticRow()));
  for (const forbidden of PRIVATE_KEYS) {
    expect([...keys], `public DTO must not expose key "${forbidden}"`).not.toContain(forbidden);
  }
});

/* ------------------------------------------------------------------ */
/* Coordinate precision                                                */
/* ------------------------------------------------------------------ */

test('redaction: public coordinates are rounded to 2 dp — about a kilometre, not a doorstep', () => {
  const dto = toMissionDTO(syntheticRow());
  expect(dto.lat).toBe(34.1);
  expect(dto.lon).toBe(-118.34);
  // 4 dp is ~11 m and reverse-geocodes back to the street.
  expect(String(dto.lat).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
  expect(String(dto.lon).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
});

test('redaction: the exact fix does not survive inside an event detail either', () => {
  const dto = toMissionDTO(syntheticRow());
  expect(findLeaks(dto, SECRETS.latText)).toEqual([]);
  expect(findLeaks(dto, SECRETS.lonText)).toEqual([]);
  expect(dto.events[0].detail).toContain('34.10, -118.34');
});

test('redaction: no value anywhere on the public DTO is written to more than 2 decimal places', () => {
  const dto = toMissionDTO(
    syntheticRow({
      events: [
        syntheticEvent(),
        syntheticEvent({
          id: 'evt_synthetic_2',
          stage: 'PROCESSING',
          label: 'PROCESSING',
          detail: `Telemetry overlay applied: ${SECRETS.latText}, ${SECRETS.lonText}, capture timestamp.`,
        }),
      ],
    }),
  );
  expect(findPreciseDecimals(dto)).toEqual([]);
});

test('redaction: rounding is arithmetic, not truncation, in both hemispheres', () => {
  const north = toMissionDTO(syntheticRow({ lat: 12.3456789, lon: 98.7654321 }));
  expect(north.lat).toBe(12.35);
  expect(north.lon).toBe(98.77);
  const south = toMissionDTO(syntheticRow({ lat: -12.3456789, lon: -98.7654321 }));
  expect(south.lat).toBe(-12.35);
  expect(south.lon).toBe(-98.77);
});

/* ------------------------------------------------------------------ */
/* The owner's own view keeps everything                               */
/* ------------------------------------------------------------------ */

test('owner view: the private block carries the address, email, amount, receipt and paid timestamp', () => {
  const dto = toMissionDTO(syntheticRow(), { includePrivate: true });
  expect(dto.private).toBeDefined();
  expect(dto.private!.email).toBe(SECRETS.email);
  expect(dto.private!.address.line1).toBe(SECRETS.addressLine1);
  expect(dto.private!.address.line2).toBe(SECRETS.addressLine2);
  expect(dto.private!.address.postalCode).toBe(SECRETS.postalCode);
  expect(dto.private!.amountMinor).toBe(SECRETS.amountMinor);
  expect(dto.private!.currency).toBe('USD');
  expect(dto.private!.receiptNumber).toBe(SECRETS.receiptNumber);
  expect(dto.private!.paidAt).toBe('2026-08-12T18:42:00.000Z');
  expect(dto.private!.areaKm).toBe(2);
});

test('owner view: coordinates keep full precision, on the mission and inside the address', () => {
  const dto = toMissionDTO(syntheticRow(), { includePrivate: true });
  expect(dto.lat).toBe(SECRETS.lat);
  expect(dto.lon).toBe(SECRETS.lon);
  expect(dto.private!.address.lat).toBe(SECRETS.lat);
  expect(dto.private!.address.lon).toBe(SECRETS.lon);
});

test('owner view: event details are NOT scrubbed — the owner reads their own receipt and fix', () => {
  const dto = toMissionDTO(syntheticRow(), { includePrivate: true });
  expect(dto.events[0].detail).toContain(SECRETS.receiptNumber);
  expect(dto.events[0].detail).toContain(SECRETS.latText);
});

test('owner view: a receipt number with no value on the row renders as an empty string, never null', () => {
  const dto = toMissionDTO(syntheticRow({ receiptNumber: null }), { includePrivate: true });
  expect(dto.private!.receiptNumber).toBe('');
});

/* ------------------------------------------------------------------ */
/* Stage-gated fields — the public file must not run ahead of the work */
/* ------------------------------------------------------------------ */

test('stage gating: the preview appears at IMAGE_ACQUIRED and never before', () => {
  const before = toMissionDTO(syntheticRow({ state: 'CAPTURE_WINDOW', events: [] }));
  expect(before.previewUrl).toBeNull();
  const at = toMissionDTO(syntheticRow({ state: 'IMAGE_ACQUIRED', events: [] }));
  expect(at.previewUrl).toBe('/api/poster/99ZZ');
});

test('stage gating: the full-resolution deliverable appears only at DELIVERED', () => {
  expect(toMissionDTO(syntheticRow({ state: 'SHIPPED', events: [] })).deliverableUrl).toBeNull();
  expect(
    toMissionDTO(syntheticRow({ state: 'DELIVERED', events: [] })).deliverableUrl,
  ).toBe('/api/poster/99ZZ?variant=full');
});

test('stage gating: the print facility is withheld until the job is released to it', () => {
  expect(toMissionDTO(syntheticRow({ state: 'PROCESSING', events: [] })).printFacility).toBeNull();
  expect(toMissionDTO(syntheticRow({ state: 'PRINT', events: [] })).printFacility).toBe('US / RENO, NV');
});

test('stage gating: carrier and tracking are withheld until the parcel is handed over', () => {
  const before = toMissionDTO(syntheticRow({ state: 'PRINT', events: [] }), {
    includePrivate: true,
  });
  expect(before.carrier).toBeNull();
  expect(before.trackingNumber).toBeNull();
  expect(before.trackingUrl).toBeNull();
  const after = toMissionDTO(syntheticRow({ state: 'SHIPPED', events: [] }), {
    includePrivate: true,
  });
  expect(after.carrier).toBe('UPS');
  expect(after.trackingNumber).toBe('1Z1853297529863153');
});

/**
 * The tracking number is a bearer token for the delivery address: pasted into
 * the carrier's tracker it returns the destination town, postcode and delivery
 * status. /s/[code] promises in its own copy that the address stays with the
 * owner, so the parcel number is gated on ownership as well as on stage. The
 * carrier NAME stays public — it is not a key to anything.
 */
test('redaction: a public view gets the carrier but never the parcel number', () => {
  const pub = toMissionDTO(syntheticRow({ state: 'SHIPPED', events: [] }));
  expect(pub.carrier).toBe('UPS');
  expect(pub.trackingNumber).toBeNull();
  expect(pub.trackingUrl).toBeNull();
});

test('redaction: the parcel number does not walk out through the event narrative', () => {
  const row = syntheticRow({
    state: 'SHIPPED',
    events: [
      syntheticEvent({
        id: 'evt_synthetic_ship',
        stage: 'SHIPPED',
        label: 'SHIPPED',
        detail:
          'Handed to UPS at US / RENO, NV. Tracking 1Z1853297529863153. ' +
          'Estimated delivery 21.08.2026.',
      }),
    ],
  });
  const pub = toMissionDTO(row);
  const detail = pub.events[0]?.detail ?? '';
  expect(detail).not.toContain('1Z1853297529863153');
  expect(detail).toContain('Handed to UPS');

  const owner = toMissionDTO(row, { includePrivate: true });
  expect(owner.events[0]?.detail ?? '').toContain('1Z1853297529863153');
});

/* ------------------------------------------------------------------ */
/* Shape                                                               */
/* ------------------------------------------------------------------ */

test('DTO: a cancelled mission still reports the furthest stage it reached, rebuilt from its events', () => {
  const dto = toMissionDTO(
    syntheticRow({
      state: 'CANCELLED',
      events: [
        syntheticEvent({ id: 'e1', stage: 'MISSION_CONFIRMED' }),
        syntheticEvent({ id: 'e2', stage: 'SATELLITE_TASKED', label: 'SATELLITE TASKED' }),
        syntheticEvent({ id: 'e3', stage: 'CAPTURE_WINDOW', label: 'CAPTURE WINDOW' }),
        syntheticEvent({ id: 'e4', stage: 'CANCELLED', label: 'MISSION CANCELLED' }),
      ],
    }),
  );
  expect(dto.state).toBe('CANCELLED');
  expect(dto.stage).toBe('CAPTURE_WINDOW');
});

test('DTO: events come back in chronological order regardless of the order the row supplied them', () => {
  const t = (iso: string) => new Date(iso);
  const dto = toMissionDTO(
    syntheticRow({
      events: [
        syntheticEvent({ id: 'c', at: t('2026-08-03T00:00:00.000Z') }),
        syntheticEvent({ id: 'a', at: t('2026-08-01T00:00:00.000Z') }),
        syntheticEvent({ id: 'b', at: t('2026-08-02T00:00:00.000Z') }),
      ],
    }),
  );
  expect(dto.events.map((e) => e.id)).toEqual(['a', 'b', 'c']);
});

test('DTO: a non-stage event is reported as a NOTE rather than an invented stage', () => {
  const dto = toMissionDTO(
    syntheticRow({ events: [syntheticEvent({ stage: 'NOTE', label: 'ORDER RECEIVED' })] }),
  );
  expect(dto.events[0].stage).toBe('NOTE');
});

test('DTO: the short link and location label are city-level public identity, and are present', () => {
  const dto = toMissionDTO(syntheticRow());
  expect(dto.code).toBe('99ZZ');
  expect(dto.shortLink).toBe('shot.space/M99ZZ');
  expect(dto.locationLabel).toBe('LOS ANGELES, CA / US');
  expect(dto.countryCode).toBe('US');
});
