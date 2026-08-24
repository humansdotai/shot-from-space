import { test, expect, type APIRequestContext } from '@playwright/test';
import { MISSION_STAGES, STAGE_LABEL } from '@/lib/types';
import { cleanup, db, missionRow, testEmail } from '../support/db';
import { DESKTOP } from '../support/flow';

/**
 * MISSION CONTROL — /m/[code]
 *
 * Nine stages on every file, the exhibit released at IMAGE_ACQUIRED and not
 * before, and the mock-mode demo control stepping the state for real.
 *
 * The three read-only tests use the seeded dossier. The one that mutates
 * opens its own mission through the public API and deletes it afterwards —
 * the seeded missions are never advanced.
 */

test.afterAll(async () => {
  await db.$disconnect();
});

/** Opens and settles a mission through the same endpoints the browser uses. */
async function openPaidMission(request: APIRequestContext, email: string) {
  const created = await request.post('/api/orders', {
    data: {
      address: {
        line1: '6801 Hollywood Boulevard',
        city: 'Los Angeles',
        region: 'CA',
        postalCode: '90028',
        countryCode: 'US',
        country: 'United States',
        lat: 34.1017,
        lon: -118.3406,
      },
      formatId: 'F30',
      frame: 'UNFRAMED',
      email,
    },
  });
  expect(created.status()).toBe(201);
  const { missionCode } = await created.json();

  const settled = await request.post('/api/checkout/complete', { data: { missionCode } });
  expect(settled.status()).toBe(200);
  return missionCode as string;
}

test('mission control: all nine stages of the timeline render, in order, on every file', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/m/32BF');

  const timeline = page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3 }) });
  for (const stage of MISSION_STAGES) {
    await expect(
      page.getByRole('heading', { level: 3, name: STAGE_LABEL[stage], exact: true }),
      `${stage} must appear on the timeline`,
    ).toBeVisible();
  }
  expect(await timeline.count()).toBeGreaterThanOrEqual(9);

  // Order, not just presence: the labels appear top to bottom in stage order.
  const headings = await page.getByRole('heading', { level: 3 }).allInnerTexts();
  const positions = MISSION_STAGES.map((s) => headings.indexOf(STAGE_LABEL[s]));
  expect(positions.every((p) => p >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
});

test('mission control: a file before acquisition shows the awaiting state, not an empty frame', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  // 18QD is parked at CAPTURE_WINDOW — one stage short of IMAGE_ACQUIRED.
  await page.goto('/m/18QD');

  await expect(page.getByText('Exhibit A / awaiting acquisition')).toBeVisible();
  await expect(page.getByText('Awaiting acquisition', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Watermarked satellite preview/i })).toHaveCount(0);

  const { mission } = await (await page.request.get('/api/missions/18QD')).json();
  expect(mission.stage).toBe('CAPTURE_WINDOW');
  expect(mission.previewUrl).toBeNull();
});

test('mission control: the exhibit is released from IMAGE_ACQUIRED onward', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  // 74KL is exactly at IMAGE_ACQUIRED; 55RA is well past it.
  for (const code of ['74KL', '55RA']) {
    await page.goto(`/m/${code}`);
    await expect(page.getByText('Exhibit A / watermarked preview')).toBeVisible();
    await expect(
      page.getByRole('img', { name: new RegExp(`Watermarked satellite preview .* mission ${code}`, 'i') }),
    ).toBeVisible();

    const { mission } = await (await page.request.get(`/api/missions/${code}`)).json();
    expect(mission.previewUrl).toBeTruthy();
  }
});

test('mission control: the mock-mode advance control steps the mission one stage and writes its event', async ({
  page,
  request,
}) => {
  await page.setViewportSize(DESKTOP);
  const email = testEmail('advance');
  let code = '';

  try {
    code = await openPaidMission(request, email);
    await page.goto(`/m/${code}`);

    const control = page.getByRole('region', { name: 'Simulation control' });
    await expect(control).toBeVisible();
    await expect(control).toContainText(STAGE_LABEL.MISSION_CONFIRMED);
    await expect(control).toContainText(STAGE_LABEL.SATELLITE_TASKED);

    const advanced = page.waitForResponse(
      (r) => r.url().includes('/api/dev/advance') && r.request().method() === 'POST',
    );
    await control.getByRole('button', { name: 'Advance mission' }).click();
    expect((await advanced).status()).toBe(200);

    // The control re-reads the server, so the next stage is now the one after.
    await expect(control).toContainText(STAGE_LABEL.CAPTURE_WINDOW);
    await expect(
      page.getByRole('heading', { level: 3, name: STAGE_LABEL.SATELLITE_TASKED, exact: true }),
    ).toBeVisible();

    // And the record moved, with a real event behind it.
    const row = await missionRow(code);
    expect(row.state).toBe('SATELLITE_TASKED');
    expect(row.skyfiOrderId).toBeTruthy();

    const { mission } = await (await request.get(`/api/missions/${code}`)).json();
    expect(mission.stage).toBe('SATELLITE_TASKED');
    const tasked = mission.events.find((e: { stage: string }) => e.stage === 'SATELLITE_TASKED');
    expect(tasked, 'SATELLITE_TASKED must have written its own event').toBeTruthy();
    expect(tasked.label).toBe(STAGE_LABEL.SATELLITE_TASKED);
    expect(tasked.detail).toContain('Collection order');
  } finally {
    await cleanup({ codes: code ? [code] : [], emails: [email] });
  }
});

test('mission control: a delivered file offers nothing further to advance', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/m/55RA');
  const control = page.getByRole('region', { name: 'Simulation control' });
  await expect(control).toBeVisible();
  await expect(control.getByRole('button', { name: 'File closed' })).toBeDisabled();
  await expect(control).toContainText('None — mission delivered');
});

test('mission control: an unknown mission code renders the designed not-found page, not a crash', async ({
  page,
}) => {
  await page.goto('/m/99ZY');
  await expect(page.getByText(/not found/i).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Unhandled');
});

/**
 * DEFECT — /m/[code] and /account/missions/[code] answer 200 for a mission
 * that does not exist. Both routes have a `loading.tsx`, so Next flushes the
 * streaming shell (and its 200) before the server component reaches
 * `notFound()`; the status can no longer be changed. `/missions/[code]`, which
 * has no loading boundary, returns 404 correctly — that is the control case
 * below, and it is what makes this a bug rather than a framework limit.
 *
 * The consequence is that a mistyped or expired mission link is indexable and
 * looks healthy to any uptime check.
 *
 * Reproduce:
 *   curl -s -o /dev/null -w '%{http_code}' http://localhost:3200/m/99ZY       → 200
 *   curl -s -o /dev/null -w '%{http_code}' http://localhost:3200/missions/ZZZZ → 404
 */
test('DEFECT — an unknown mission file answers 404, the way an unknown archive sheet does', async ({
  page,
}) => {
  const control = await page.goto('/missions/ZZZZ');
  expect(control?.status(), 'the archive route is the control case').toBe(404);

  const mission = await page.goto('/m/99ZY');
  expect(mission?.status()).toBe(404);
});

test('mission control: a visitor who is not the owner sees no private fields on the page', async ({
  page,
}) => {
  await page.context().clearCookies();
  const row = await missionRow('32BF');
  await page.goto('/m/32BF');
  await expect(page.getByText('32BF').first()).toBeVisible();

  const text = await page.locator('body').innerText();
  expect(text, 'street address').not.toContain(row.addressLine1);
  expect(text, 'customer email').not.toContain(row.email);
  expect(text, 'receipt number').not.toContain(row.receiptNumber ?? '__none__');
  expect(text, 'exact fix').not.toContain(row.lat.toFixed(4));
});
