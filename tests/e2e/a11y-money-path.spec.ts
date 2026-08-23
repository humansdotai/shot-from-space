import { test, expect, type Page } from '@playwright/test';
import { cleanup, db, testEmail } from '../support/db';
import {
  MIN_INPUT_FONT_PX,
  MIN_TAP_PX,
  horizontalOverflow,
  inputFontSizes,
  overflowingElements,
  tapTargets,
} from '../support/a11y';
import {
  PHONE,
  advanceTo,
  authorise,
  lockTarget,
  waitForCapturePreview,
} from '../support/flow';

/**
 * ACCESSIBILITY SMOKE — the money path at 390.
 *
 * Not a full audit. Three failures that stop a phone purchase outright:
 * a control too small to hit, a field small enough to make iOS zoom the page
 * on focus, and a layout that scrolls sideways.
 */

test.afterAll(async () => {
  await db.$disconnect();
});

async function assertNoSmallTapTargets(page: Page, where: string) {
  const small = (await tapTargets(page)).filter(
    (t) => t.height < MIN_TAP_PX || t.width < MIN_TAP_PX,
  );
  expect(
    small.map((t) => `${t.label} — ${t.width}×${t.height}`),
    `${where}: every tap target must be at least ${MIN_TAP_PX}×${MIN_TAP_PX} CSS px`,
  ).toEqual([]);
}

async function assertNoZoomingInputs(page: Page, where: string) {
  const small = (await inputFontSizes(page)).filter((f) => f.px < MIN_INPUT_FONT_PX);
  expect(
    small.map((f) => `${f.label} — ${f.px}px`),
    `${where}: a field under ${MIN_INPUT_FONT_PX}px makes iOS zoom the page on focus`,
  ).toEqual([]);
}

async function assertNoHorizontalOverflow(page: Page, where: string) {
  const overflow = await horizontalOverflow(page);
  if (overflow > 0) {
    // Name the offenders so the failure says what broke, not just that it did.
    expect(await overflowingElements(page), `${where}: page scrolls ${overflow}px sideways`).toEqual(
      [],
    );
  }
  expect(overflow, `${where}: the page must not scroll sideways at 390`).toBe(0);
}

test('a11y at 390: /start opens and asks for a target', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/start');

  await assertNoHorizontalOverflow(page, '/start (open)');
  await assertNoSmallTapTargets(page, '/start (open)');

  await advanceTo(page, 'target');
  await expect(page.locator('#target-address')).toBeVisible();

  await assertNoHorizontalOverflow(page, '/start (target)');
  await assertNoZoomingInputs(page, '/start (target)');
  await assertNoSmallTapTargets(page, '/start (target)');
});

/**
 * Every screen the briefing puts up between a locked target and the money.
 * Each one is a whole screen now rather than a block on a page, so each one
 * is measured rather than the page they used to share.
 */
test('a11y at 390: every screen of the briefing from the frame to the charge', async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto('/start');
  await lockTarget(page, '6801 Hollywood Boulevard');
  await waitForCapturePreview(page);

  for (const step of ['aim', 'why', 'brief', 'format', 'finish', 'authorise'] as const) {
    await advanceTo(page, step);
    await assertNoHorizontalOverflow(page, `/start (${step})`);
    await assertNoZoomingInputs(page, `/start (${step})`);
    await assertNoSmallTapTargets(page, `/start (${step})`);
  }

  await expect(page.locator('#authorise-submit')).toBeVisible();
  // The email is the only field in the whole sequence, and it is on the last
  // screen of it.
  await expect(page.locator('input')).toHaveCount(1);
});

test('a11y at 390: the address suggestion list is hittable', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/start');
  await advanceTo(page, 'target');

  const field = page.locator('#target-address');
  for (let attempt = 0; ; attempt++) {
    await field.fill('');
    await field.fill('221B Baker Street');
    try {
      await expect(page.getByRole('option').first()).toBeVisible({ timeout: 8_000 });
      break;
    } catch (err) {
      if (attempt >= 2) throw err;
    }
  }

  const rows = await page.getByRole('option').all();
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    const box = await row.boundingBox();
    expect(box!.height, 'a suggestion row must be at least 44px tall').toBeGreaterThanOrEqual(
      MIN_TAP_PX,
    );
  }
  await assertNoHorizontalOverflow(page, '/start (suggestions)');
});

/** Opens a mission and parks the browser on its mock checkout screen. */
async function reachMockCheckout(page: Page, tag: string) {
  const email = testEmail(tag);
  await page.goto('/start');
  await lockTarget(page, '6801 Hollywood Boulevard');
  const code = await authorise(page, email);
  await expect(page.getByRole('button', { name: /^Pay / })).toBeVisible();
  return { code, email };
}

test('a11y at 390: the mock checkout screen has no small tap target and no zooming field', async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  let opened: { code: string; email: string } | null = null;
  try {
    opened = await reachMockCheckout(page, 'a11y-checkout');
    await assertNoZoomingInputs(page, '/checkout/mock');
    await assertNoSmallTapTargets(page, '/checkout/mock');
  } finally {
    await cleanup({ codes: opened ? [opened.code] : [], emails: opened ? [opened.email] : [] });
  }
});

/**
 * DEFECT — the mock checkout screen scrolls 82px sideways at 390.
 *
 * The drawn card fields in `MockCheckout`'s payment column are the cause. The
 * card-number placeholder `•••• •••• •••• ••••` is set with
 * `tracking-[0.2em]` and cannot wrap, and `DeadField`'s wrapper carries
 * neither `min-w-0` nor `overflow-hidden`, so its min-content width (~440px)
 * becomes a floor for the grid cell and pushes the whole page past the
 * viewport. Everything else on the page then sits 82px wide of the screen.
 *
 * This is the screen where the charge is confirmed, so a horizontal scroll
 * here is a phone conversion problem, not a cosmetic one.
 *
 * Reproduce: buy at 390, and on /checkout/mock/{code} evaluate
 *   document.documentElement.scrollWidth - document.documentElement.clientWidth
 *   → 82
 */
test('DEFECT — the mock checkout screen does not scroll sideways at 390', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let opened: { code: string; email: string } | null = null;
  try {
    opened = await reachMockCheckout(page, 'a11y-overflow');
    await assertNoHorizontalOverflow(page, '/checkout/mock');
  } finally {
    await cleanup({ codes: opened ? [opened.code] : [], emails: opened ? [opened.email] : [] });
  }
});

test('a11y at 390: mission control, the page the purchase lands on', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/m/32BF');
  await expect(page.getByText('32BF').first()).toBeVisible();

  await assertNoHorizontalOverflow(page, '/m/32BF');
  await assertNoZoomingInputs(page, '/m/32BF');
  await assertNoSmallTapTargets(page, '/m/32BF');
});

test('a11y at 390: the sign-in screen', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/auth/sign-in');
  await expect(page.locator('#email')).toBeVisible();

  await assertNoHorizontalOverflow(page, '/auth/sign-in');
  await assertNoZoomingInputs(page, '/auth/sign-in');
  await assertNoSmallTapTargets(page, '/auth/sign-in');
});
