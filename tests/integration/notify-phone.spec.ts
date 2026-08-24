import { test, expect } from '@playwright/test';
import { db, SEEDED_CODES } from '../support/db';

/**
 * THE POST-PURCHASE MOBILE NUMBER.
 *
 * Optional, given after payment, for one purpose: to say when a satellite
 * has been found for the mission.
 *
 * Two properties are defended here and they are not the same property.
 *
 *   1. THE ROUTE WRITES ONE FIELD AND ONLY WITH PROOF OF PURCHASE. A
 *      mission code is not a credential — it is printed on the sheet and
 *      sits in every shared link — so the code alone must never be enough.
 *
 *   2. THE NUMBER NEVER REACHES A PUBLIC SURFACE. This is the one that
 *      matters most, because the raw mission row currently reaches the
 *      RSC payload (see the two self-named `DEFECT … RSC payload` tests),
 *      so a column that exists on the row is a column in the page source
 *      — including on a shared link a stranger can open. The column is
 *      therefore omitted at the query. If someone "helpfully" adds it back
 *      to the reader, this fails.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3200';

/**
 * A SEEDED MISSION, NOT "THE NEWEST PAID ONE".
 *
 * This suite used to bind to `findFirst({ paidAt: { not: null } })`, which
 * passed in isolation and failed in a full run — the borrowed mission was
 * one another suite had created and then deleted in its own cleanup, so
 * by the time the wrong-email assertion ran the row was gone and the
 * "unchanged" check compared against undefined.
 *
 * `cleanup()` in tests/support/db.ts explicitly refuses to delete a
 * seeded demo mission, which makes one the only stable anchor here. 18QD
 * is the least referenced of the four across the suite.
 */
const CODE = '18QD' satisfies (typeof SEEDED_CODES)[number];

let code: string;
let email: string;
let shareToken: string;
let previous: string | null = null;

test.beforeAll(async () => {
  const mission = await db.mission.findUnique({ where: { code: CODE } });
  test.skip(!mission, `seeded mission ${CODE} is not in the dev database`);
  code = mission!.code;
  email = mission!.email;
  shareToken = mission!.shareToken;
  previous = mission!.notifyPhone ?? null;
});

test.afterAll(async () => {
  if (code) {
    await db.mission.update({
      where: { code },
      data: { notifyPhone: previous, notifyPhoneAt: previous ? new Date() : null },
    });
  }
  await db.$disconnect();
});

async function post(body: unknown) {
  const res = await fetch(`${BASE}/api/missions/${code}/notify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test('the number is stored against the mission', async () => {
  const res = await post({ phone: '+31 6 1234 5678', email });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ stored: true });

  const row = await db.mission.findUnique({ where: { code } });
  expect(row?.notifyPhone).toBe('+31 6 1234 5678');
  expect(row?.notifyPhoneAt).not.toBeNull();
});

test('an empty number withdraws consent', async () => {
  await post({ phone: '+31 6 1234 5678', email });
  const res = await post({ phone: '', email });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ stored: false });

  const row = await db.mission.findUnique({ where: { code } });
  expect(row?.notifyPhone).toBeNull();
  expect(row?.notifyPhoneAt).toBeNull();
});

test('the code alone is not enough — a wrong email refuses', async () => {
  await post({ phone: '+31 6 1234 5678', email });
  const res = await post({ phone: '+40 700 000 000', email: 'stranger@example.com' });

  // 404, not 403: a signed-out stranger must not learn that the code exists.
  expect(res.status).toBe(404);

  const row = await db.mission.findUnique({ where: { code } });
  expect(row?.notifyPhone, 'the stranger must not have overwritten it').toBe('+31 6 1234 5678');
});

test('nothing but the phone can be written through this route', async () => {
  const before = await db.mission.findUnique({ where: { code } });

  await post({
    phone: '+40 722 111 222',
    email,
    // Everything an attacker would rather change. There is history here:
    // a client-supplied value once decided what was charged.
    amountMinor: 1,
    currency: 'XXX',
    state: 'DELIVERED',
    email2: 'attacker@example.com',
    tier: 'ARCHIVE',
  });

  const after = await db.mission.findUnique({ where: { code } });
  expect(after?.amountMinor).toBe(before?.amountMinor);
  expect(after?.currency).toBe(before?.currency);
  expect(after?.state).toBe(before?.state);
  expect(after?.email).toBe(before?.email);
  expect(after?.notifyPhone).toBe('+40 722 111 222');
});

test('a number that is not a number is refused', async () => {
  for (const phone of ['not-a-number', '12', '<script>alert(1)</script>', '9'.repeat(40)]) {
    const res = await post({ phone, email });
    expect(res.status, `${phone} must be refused`).toBe(400);
  }
});

test('THE LEAK TEST — the number never appears on a public surface', async () => {
  const secret = '+40799887766';
  await db.mission.update({
    where: { code },
    data: { notifyPhone: secret, notifyPhoneAt: new Date() },
  });

  // Digits only: the served payload may escape or reformat the string.
  const digits = secret.replace(/\D/g, '');

  for (const url of [
    `/m/${code}`,
    `/s/${code}?k=${shareToken}`,
    `/api/missions/${code}`,
    '/api/missions',
  ]) {
    const text = await fetch(`${BASE}${url}`).then((r) => r.text());
    expect(text.includes(digits), `${url} must not carry the mobile number`).toBe(false);
    expect(text.includes('notifyPhone'), `${url} must not name the column`).toBe(false);
  }
});
