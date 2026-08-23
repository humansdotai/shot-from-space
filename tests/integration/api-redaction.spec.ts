import { test, expect, request as pwRequest } from '@playwright/test';
import { getMissionByCode, getMissionByShareToken, listMissionsForEmail } from '@/lib/missions';
import { BASE_URL } from '../../playwright.config';
import { SEEDED_CODES, SEEDED_OWNER_EMAIL, db, seededFingerprint } from '../support/db';
import { collectKeys, findLeaks, findPreciseDecimals } from '../support/redaction';

/**
 * REDACTION ON THE WIRE.
 *
 * The unit suite proves the mapper redacts. This proves the two surfaces that
 * anyone on the internet can reach — GET /api/missions/[code] and the shared
 * view behind ?k= — actually go through it, for every seeded mission, using
 * that mission's REAL private values read straight from the row.
 *
 * Read-only. Nothing in this file writes.
 */


let fingerprintBefore: string;

test.beforeAll(async () => {
  fingerprintBefore = await seededFingerprint();
});

test.afterAll(async () => {
  expect(await seededFingerprint(), 'this file must not mutate the seeded dossier').toBe(
    fingerprintBefore,
  );
  await db.$disconnect();
});

/** The private values of one seeded mission, straight from the row. */
async function secretsFor(code: string) {
  const row = await db.mission.findUniqueOrThrow({ where: { code } });
  return {
    row,
    /** Every string that must not appear on a public surface. */
    forbidden: [
      row.addressLine1,
      row.addressLine2 ?? '',
      row.postalCode,
      row.email,
      row.receiptNumber ?? '',
      String(row.amountMinor),
      row.lat.toFixed(4),
      row.lon.toFixed(4),
      row.stripePaymentIntentId ?? '',
    ].filter((v) => v.length > 3),
  };
}

const PRIVATE_KEY_NAMES = [
  'private',
  'email',
  'addressLine1',
  'postalCode',
  'amountMinor',
  'receiptNumber',
  'paidAt',
  'shareToken',
];

for (const code of SEEDED_CODES) {
  test(`public API: GET /api/missions/${code} carries no address, email, amount or receipt`, async ({
    request,
  }) => {
    const { row, forbidden } = await secretsFor(code);
    const res = await request.get(`/api/missions/${code}`);
    expect(res.status()).toBe(200);
    const { mission } = await res.json();

    expect(mission.private).toBeUndefined();
    for (const key of PRIVATE_KEY_NAMES) {
      expect([...collectKeys(mission)], `public key "${key}"`).not.toContain(key);
    }
    for (const secret of forbidden) {
      expect(findLeaks(mission, secret), `leaked ${JSON.stringify(secret)}`).toEqual([]);
    }
    expect(mission.code).toBe(code);
    expect(mission.locationLabel).toBe(row.locationLabel);
  });

  test(`public API: GET /api/missions/${code} rounds the coordinates to 2 dp everywhere`, async ({
    request,
  }) => {
    const { row } = await secretsFor(code);
    const res = await request.get(`/api/missions/${code}`);
    const { mission } = await res.json();

    expect(mission.lat).toBe(Number(row.lat.toFixed(2)));
    expect(mission.lon).toBe(Number(row.lon.toFixed(2)));
    expect(mission.lat).not.toBe(row.lat);
    expect(findPreciseDecimals(mission)).toEqual([]);
  });

  test(`shared view: GET /api/missions/${code}/share with the real key is city-level and carries no private field`, async ({
    request,
  }) => {
    const { row, forbidden } = await secretsFor(code);
    const res = await request.get(
      `/api/missions/${code}/share?k=${encodeURIComponent(row.shareToken)}`,
    );
    expect(res.status()).toBe(200);
    const { mission } = await res.json();

    expect(mission.private).toBeUndefined();
    for (const secret of forbidden) {
      expect(findLeaks(mission, secret), `leaked ${JSON.stringify(secret)}`).toEqual([]);
    }
    expect(mission.lat).toBe(Number(row.lat.toFixed(2)));
    expect(mission.lon).toBe(Number(row.lon.toFixed(2)));
    expect(findPreciseDecimals(mission)).toEqual([]);
  });
}

test('shared view: a wrong key is a 404 that does not confirm the mission exists', async ({
  request,
}) => {
  const res = await request.get('/api/missions/32BF/share?k=not-the-key');
  expect(res.status()).toBe(404);
  const body = await res.json();
  expect(JSON.stringify(body)).not.toContain('Hollywood');
  expect(body.error).toBe('MISSION_NOT_FOUND');
});

test('shared view: a missing key is refused before any lookup happens', async ({ request }) => {
  const res = await request.get('/api/missions/32BF/share');
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('MISSING_KEY');
});

test('shared view: one mission key never opens another mission', async ({ request }) => {
  const a = await db.mission.findUniqueOrThrow({ where: { code: '32BF' } });
  const res = await request.get(`/api/missions/74KL/share?k=${encodeURIComponent(a.shareToken)}`);
  expect(res.status()).toBe(404);
});

test('shared view: getMissionByShareToken returns null for an empty or mismatched token', async () => {
  const row = await db.mission.findUniqueOrThrow({ where: { code: '32BF' } });
  expect(await getMissionByShareToken('32BF', '')).toBeNull();
  expect(await getMissionByShareToken('32BF', `${row.shareToken}x`)).toBeNull();
  expect(await getMissionByShareToken('74KL', row.shareToken)).toBeNull();
  expect((await getMissionByShareToken('32BF', row.shareToken))?.code).toBe('32BF');
});

test('public API: a malformed mission code is a 400 and an unknown one a 404 — never a crash', async ({
  request,
}) => {
  const bad = await request.get('/api/missions/ABCD');
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error).toBe('INVALID_CODE');

  const missing = await request.get('/api/missions/99ZY');
  expect(missing.status()).toBe(404);
  expect((await missing.json()).error).toBe('MISSION_NOT_FOUND');
});

test('owner path: listMissionsForEmail keeps full precision and every private field for the demo owner', async () => {
  const missions = await listMissionsForEmail(SEEDED_OWNER_EMAIL);
  expect(missions.map((m) => m.code).sort()).toEqual([...SEEDED_CODES].sort());

  for (const mission of missions) {
    const row = await db.mission.findUniqueOrThrow({ where: { code: mission.code } });
    expect(mission.private, `${mission.code} owner view`).toBeDefined();
    expect(mission.private!.email).toBe(row.email);
    expect(mission.private!.address.line1).toBe(row.addressLine1);
    expect(mission.private!.address.postalCode).toBe(row.postalCode);
    expect(mission.private!.amountMinor).toBe(row.amountMinor);
    expect(mission.private!.receiptNumber).toBe(row.receiptNumber ?? '');
    // Full precision, both on the mission and inside the address.
    expect(mission.lat).toBe(row.lat);
    expect(mission.lon).toBe(row.lon);
    expect(mission.private!.address.lat).toBe(row.lat);
  }
});

test('owner path: the same row read without includePrivate is redacted — the flag is the only difference', async () => {
  for (const code of SEEDED_CODES) {
    const row = await db.mission.findUniqueOrThrow({ where: { code } });
    const publicView = await getMissionByCode(code);
    const ownerView = await getMissionByCode(code, { includePrivate: true });
    expect(publicView!.private).toBeUndefined();
    expect(ownerView!.private).toBeDefined();
    expect(publicView!.lat).toBe(Number(row.lat.toFixed(2)));
    expect(ownerView!.lat).toBe(row.lat);
  }
});

test('shared HTML page: a valid key renders the file, a wrong key renders the designed refusal', async () => {
  const row = await db.mission.findUniqueOrThrow({ where: { code: '32BF' } });
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
  try {
    const good = await ctx.get(`/s/32BF?k=${encodeURIComponent(row.shareToken)}`);
    expect(good.status()).toBe(200);
    expect(await good.text()).toContain('32BF');

    const bad = await ctx.get('/s/32BF?k=wrong');
    expect(bad.status()).toBe(200);
    expect(await bad.text()).toContain('Share key not recognised');

    const missing = await ctx.get('/s/32BF');
    expect(missing.status()).toBe(200);
    expect(await missing.text()).toContain('Share key missing');

    const badCode = await ctx.get('/s/ABCD?k=wrong');
    expect(badCode.status()).toBe(200);
    expect(await badCode.text()).toContain('File not accessible');
  } finally {
    await ctx.dispose();
  }
});

/* ------------------------------------------------------------------ */
/* DEFECT — the served HTML carries the whole unredacted Mission row.  */
/* ------------------------------------------------------------------ */

/**
 * The DTO is clean (every test above). The HTML is not: the RSC flight
 * payload embedded in the page carries the raw Prisma row that
 * `getMissionByShareToken` / `getMissionByCode` awaited — street address,
 * email, receipt number, amount paid and the 4 dp fix — as React's async
 * debug info, right beside absolute paths into `.next/server/chunks`.
 *
 * That debug channel is emitted while NODE_ENV is not production, so a
 * production build is expected to strip it. It is left failing anyway,
 * because the review, the demo and every share link handed round before
 * launch run on this dev server, and on this dev server "view source" on a
 * public URL returns the customer's doorstep.
 *
 * Reproduce:
 *   curl -s 'http://localhost:3200/s/32BF?k=<token>' | grep -c Hollywood
 *   curl -s 'http://localhost:3200/m/32BF'           | grep -c Hollywood
 */
for (const path of ['/m/32BF', '/s/32BF?k=SHARE_TOKEN']) {
  test(`DEFECT — served HTML for ${path} embeds the unredacted mission row in the RSC payload`, async () => {
    const row = await db.mission.findUniqueOrThrow({ where: { code: '32BF' } });
    const url = path.replace('SHARE_TOKEN', encodeURIComponent(row.shareToken));
    const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
    try {
      const html = await (await ctx.get(url)).text();
      expect(html, 'street address must not reach the wire').not.toContain(row.addressLine1);
      expect(html, 'customer email must not reach the wire').not.toContain(row.email);
      expect(html, 'receipt number must not reach the wire').not.toContain(row.receiptNumber ?? '__none__');
      expect(html, 'the 4 dp fix must not reach the wire').not.toContain(row.lat.toFixed(4));
      expect(html, 'the amount paid must not reach the wire').not.toContain(`"amountMinor\\":${row.amountMinor}`);
    } finally {
      await ctx.dispose();
    }
  });
}
