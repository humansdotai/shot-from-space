import { test, expect } from '@playwright/test';
import {
  advanceMission,
  cancelMission,
  createMission,
  getMissionByCode,
  getMissionRowByCode,
  markMissionPaid,
} from '@/lib/missions';
import { MissionTransitionError, MissionValidationError } from '@/lib/missions/errors';
import { MISSION_STAGES, STAGE_LABEL } from '@/lib/types';
import type { MissionStage, TargetAddress } from '@/lib/types';
import { cleanup, db, seededFingerprint, testEmail } from '../support/db';

/**
 * THE STATE MACHINE, AGAINST THE REAL DATABASE.
 *
 * Every mission here is created by the test and deleted by the test. The
 * seeded demo dossier is read-only: `seededFingerprint` proves this file did
 * not touch it.
 */


const LA: TargetAddress = {
  line1: '6801 Hollywood Boulevard',
  city: 'Los Angeles',
  region: 'CA',
  postalCode: '90028',
  countryCode: 'US',
  country: 'United States',
  lat: 34.101789,
  lon: -118.340612,
};

/** Opens a paid mission and registers its cleanup. */
async function openMission(t: typeof test, tag: string, address: TargetAddress = LA) {
  const email = testEmail(tag);
  const created = await createMission({ email, address, formatId: 'F50', frame: 'UNFRAMED' });
  const code = created.code;
  return { code, email, created };
}

let fingerprintBefore: string;

test.beforeAll(async () => {
  fingerprintBefore = await seededFingerprint();
});

test.afterAll(async () => {
  expect(
    await seededFingerprint(),
    'the seeded demo dossier must be byte-identical after this file runs',
  ).toBe(fingerprintBefore);
  await db.$disconnect();
});

/* ------------------------------------------------------------------ */

test('createMission: opens an unpaid mission at MISSION_CONFIRMED with one ORDER RECEIVED note', async () => {
  const { code, email } = await openMission(test, 'create');
  try {
    const row = await getMissionRowByCode(code);
    expect(row).not.toBeNull();
    expect(row!.state).toBe('MISSION_CONFIRMED');
    expect(row!.paidAt).toBeNull();
    expect(row!.receiptNumber).toBeNull();
    expect(row!.events).toHaveLength(1);
    expect(row!.events![0].stage).toBe('NOTE');
    expect(row!.events![0].label).toBe('ORDER RECEIVED');
  } finally {
    await cleanup({ codes: [code], emails: [email] });
  }
});

test('createMission: never mints a code that belongs to an archive example mission', async () => {
  // Force the first draw to land on a real archive code. `generateMissionCode`
  // reads exactly four bytes from crypto.getRandomValues, so the code it
  // returns can be dictated byte by byte — which is the only way to exercise
  // the collision guard deterministically.
  const { getExampleMission, listExampleMissions } = await import('@/lib/gallery');
  const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const target = listExampleMissions()[0].code;
  const forced = Uint8Array.from([
    Number(target[0]),
    Number(target[1]),
    LETTERS.indexOf(target[2]),
    LETTERS.indexOf(target[3]),
  ]);

  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  let firstCall = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis.crypto as any).getRandomValues = (arr: Uint8Array) => {
    if (firstCall && arr.length === 4) {
      firstCall = false;
      arr.set(forced);
      return arr;
    }
    return real(arr);
  };

  let code = '';
  let email = '';
  try {
    const opened = await openMission(test, 'archive-collision');
    code = opened.code;
    email = opened.email;
    expect(code, `the mint handed out the archive code ${target}`).not.toBe(target);
    expect(getExampleMission(code)).toBeUndefined();
    // The archive entry is still the archive entry.
    expect(getExampleMission(target)?.code).toBe(target);
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.crypto as any).getRandomValues = real;
    if (code) await cleanup({ codes: [code], emails: [email] });
  }
});

test('createMission: refuses an address with no coordinates and an email with no @', async () => {
  await expect(
    createMission({
      email: testEmail('bad-address'),
      address: { ...LA, lat: Number.NaN },
      formatId: 'F50',
      frame: 'UNFRAMED',
    }),
  ).rejects.toBeInstanceOf(MissionValidationError);

  await expect(
    createMission({ email: 'not-an-email', address: LA, formatId: 'F50', frame: 'UNFRAMED' }),
  ).rejects.toBeInstanceOf(MissionValidationError);
});

test('markMissionPaid: settles once, writes a receipt, and is idempotent on a second call', async () => {
  const { code, email } = await openMission(test, 'paid');
  try {
    const first = await markMissionPaid(code, { stripeSessionId: 'cs_test_1' });
    expect(first.private!.paidAt).not.toBeNull();
    expect(first.private!.receiptNumber).toMatch(/^SFS-\d{4}-[0-9]{2}[A-HJ-NP-Z]{2}$/);
    expect(first.private!.receiptNumber.endsWith(code)).toBe(true);

    const confirmedEvents = first.events.filter((e) => e.stage === 'MISSION_CONFIRMED');
    expect(confirmedEvents).toHaveLength(1);

    const second = await markMissionPaid(code, { stripeSessionId: 'cs_test_2' });
    expect(second.private!.paidAt).toBe(first.private!.paidAt);
    expect(second.private!.receiptNumber).toBe(first.private!.receiptNumber);
    expect(second.events.filter((e) => e.stage === 'MISSION_CONFIRMED')).toHaveLength(1);

    const row = await getMissionRowByCode(code);
    expect(row!.stripeSessionId).toBe('cs_test_1');
  } finally {
    await cleanup({ codes: [code], emails: [email] });
  }
});

test('advanceMission: with no target takes exactly one step forward', async () => {
  const { code, email } = await openMission(test, 'one-step');
  try {
    await markMissionPaid(code);
    const after = await advanceMission(code);
    expect(after.stage).toBe('SATELLITE_TASKED');
    expect(after.state).toBe('SATELLITE_TASKED');
  } finally {
    await cleanup({ codes: [code], emails: [email] });
  }
});

test('advanceMission: walking to a distant stage writes an event for every intermediate stage, in order, with no hole', async () => {
  const { code, email } = await openMission(test, 'walk');
  try {
    await markMissionPaid(code);
    const dto = await advanceMission(code, 'DELIVERED');

    expect(dto.stage).toBe('DELIVERED');
    expect(dto.state).toBe('DELIVERED');

    const stageEvents = dto.events.filter((e) => e.stage !== 'NOTE');
    // Nine stages, nine events: MISSION_CONFIRMED from settlement plus the
    // eight the walk fired.
    expect(stageEvents.map((e) => e.stage)).toEqual([...MISSION_STAGES]);

    for (const e of stageEvents) {
      const stage = e.stage as MissionStage;
      expect(e.label, `${stage} label`).toBe(STAGE_LABEL[stage]);
      expect(e.detail, `${stage} detail`).toBeTruthy();
      expect((e.detail ?? '').length, `${stage} detail length`).toBeGreaterThan(20);
    }

    // The timeline is monotonic in time as well as in stage order.
    const times = stageEvents.map((e) => new Date(e.at).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i], `event ${i} is not after event ${i - 1}`).toBeGreaterThanOrEqual(times[i - 1]);
    }

    // Every stage's side effects actually landed on the row.
    const row = await getMissionRowByCode(code);
    expect(row!.skyfiOrderId, 'SATELLITE_TASKED must book a collection').toBeTruthy();
    expect(row!.windowOpensAt).not.toBeNull();
    expect(row!.windowClosesAt).not.toBeNull();
    expect(row!.capturedAt, 'IMAGE_ACQUIRED must stamp a capture time').not.toBeNull();
    expect(row!.imagerySlug).toBeTruthy();
    expect(row!.gelatoOrderId, 'PRINT must open a production order').toBeTruthy();
    expect(row!.printFacility).toBe('US / RENO, NV');
    expect(row!.carrier, 'SHIPPED must attach a carrier').toBeTruthy();
    expect(row!.trackingNumber).toBeTruthy();
    expect(row!.deliverableUrl, 'DELIVERED must release the deliverable').toBeTruthy();
  } finally {
    await cleanup({ codes: [code], emails: [email] });
  }
});

test('advanceMission: a backward target is rejected and leaves the mission where it was', async () => {
  const { code, email } = await openMission(test, 'backward');
  try {
    await markMissionPaid(code);
    await advanceMission(code, 'PROCESSING');

    await expect(advanceMission(code, 'CAPTURE_WINDOW')).rejects.toBeInstanceOf(
      MissionTransitionError,
    );
    await expect(advanceMission(code, 'MISSION_CONFIRMED')).rejects.toBeInstanceOf(
      MissionTransitionError,
    );

    const after = await getMissionByCode(code);
    expect(after!.stage).toBe('PROCESSING');
    expect(after!.events.filter((e) => e.stage !== 'NOTE')).toHaveLength(5);
  } finally {
    await cleanup({ codes: [code], emails: [email] });
  }
});

test('advanceMission: a delivered mission cannot be advanced again', async () => {
  const { code, email } = await openMission(test, 'past-end');
  try {
    await markMissionPaid(code);
    await advanceMission(code, 'DELIVERED');
    await expect(advanceMission(code)).rejects.toBeInstanceOf(MissionValidationError);
    await expect(advanceMission(code)).rejects.toThrow(/already DELIVERED/i);
  } finally {
    await cleanup({ codes: [code], emails: [email] });
  }
});

test('advanceMission: an unknown code is a MissionNotFoundError, not a crash', async () => {
  await expect(advanceMission('99ZY')).rejects.toThrow(/not found/i);
});

test('cancelMission: is reachable from mid-flight, is terminal, and keeps the stage it stopped at', async () => {
  const { code, email } = await openMission(test, 'cancel');
  try {
    await markMissionPaid(code);
    await advanceMission(code, 'CAPTURE_WINDOW');

    const cancelled = await cancelMission(code);
    expect(cancelled.state).toBe('CANCELLED');
    expect(cancelled.stage).toBe('CAPTURE_WINDOW');
    expect(cancelled.events.at(-1)!.label).toBe('MISSION CANCELLED');

    await expect(cancelMission(code)).rejects.toBeInstanceOf(MissionTransitionError);
    await expect(advanceMission(code, 'IMAGE_ACQUIRED')).rejects.toBeInstanceOf(
      MissionTransitionError,
    );
  } finally {
    await cleanup({ codes: [code], emails: [email] });
  }
});

test('pricing on the record: a UK target is stored in EUR and routed to the EU facility', async () => {
  const email = testEmail('uk-price');
  const uk: TargetAddress = {
    line1: '221B Baker Street',
    city: 'London',
    region: 'England',
    postalCode: 'W1U 6SG',
    countryCode: 'GB',
    country: 'United Kingdom',
    lat: 51.5238,
    lon: -0.1586,
  };
  const created = await createMission({ email, address: uk, formatId: 'F70', frame: 'FRAMED' });
  try {
    expect(created.region).toBe('EU');
    expect(created.private!.currency).toBe('EUR');
    expect(created.private!.amountMinor).toBe(59000);
    expect(created.locationLabel).toBe('LONDON / GB');
    await markMissionPaid(created.code);
    await advanceMission(created.code, 'PRINT');
    const row = await getMissionRowByCode(created.code);
    expect(row!.printFacility).toBe('EU / EINDHOVEN, NL');
  } finally {
    await cleanup({ codes: [created.code], emails: [email] });
  }
});

test('pricing on the record: a US target is stored in USD and routed to the US facility', async () => {
  const email = testEmail('us-price');
  const created = await createMission({ email, address: LA, formatId: 'F30', frame: 'UNFRAMED' });
  try {
    expect(created.region).toBe('US');
    expect(created.private!.currency).toBe('USD');
    expect(created.private!.amountMinor).toBe(18000);
    expect(created.locationLabel).toBe('LOS ANGELES, CA / US');
  } finally {
    await cleanup({ codes: [created.code], emails: [email] });
  }
});
