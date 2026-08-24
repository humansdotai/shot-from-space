import { test, expect } from '@playwright/test';
import { BASE_URL } from '../../playwright.config';
import { SEEDED_CODES, SEEDED_OWNER_EMAIL, cleanup, db, testEmail } from '../support/db';
import { DESKTOP } from '../support/flow';

/**
 * The app builds absolute links from NEXT_PUBLIC_SITE_URL, which is pinned to
 * :3000 in .env while the dev server runs on :3200 — see the DEFECT test at
 * the foot of this file. Every link followed here is re-homed onto the origin
 * under test so the rest of the suite measures auth and not that mismatch.
 */
function onOriginUnderTest(href: string): string {
  const url = new URL(href, BASE_URL);
  const base = new URL(BASE_URL);
  url.protocol = base.protocol;
  url.host = base.host;
  return url.toString();
}

/**
 * MAGIC-LINK ACCESS.
 *
 * There is no password. Requesting a link in mock mode returns it on the
 * response and the sign-in screen renders it; following it opens a session
 * and lands on the account file.
 *
 * The magic-link endpoint rate-limits to three requests per address per ten
 * minutes, so exactly one test here uses the seeded owner's address and the
 * rest use throwaway accounts they delete afterwards.
 */

test.afterAll(async () => {
  await db.$disconnect();
});

/** Requests a link on the sign-in screen and returns the dev link it renders. */
async function requestDevLink(page: import('@playwright/test').Page, email: string) {
  await page.goto('/auth/sign-in');
  await page.locator('#email').fill(email);

  const issued = page.waitForResponse(
    (r) => r.url().includes('/api/auth/magic-link') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Send the link' }).click();
  const res = await issued;
  expect(res.status(), 'the link must be issued').toBe(200);

  await expect(page.getByText('Mock mode / no mail provider')).toBeVisible();
  const link = page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ });
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  expect(href, 'the mock block must render a real verify link').toBeTruthy();
  return href!;
}

test('magic link: requesting a link renders it in mock mode, and following it opens the account file with the four seeded missions', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);

  const href = await requestDevLink(page, SEEDED_OWNER_EMAIL);
  expect(href).toContain('/api/auth/verify?token=');

  await page.goto(onOriginUnderTest(href));
  await page.waitForURL('**/account');

  await expect(page.getByRole('heading', { name: SEEDED_OWNER_EMAIL })).toBeVisible();

  // All four seeded missions are on the file, each linking to its own receipt.
  for (const code of SEEDED_CODES) {
    await expect(
      page.getByRole('link', { name: `Open the receipt for mission ${code}` }),
      `${code} must be listed on the account file`,
    ).toBeVisible();
  }
  await expect(page.getByRole('link', { name: /^Open the receipt for mission/ })).toHaveCount(4);

  // The account readout counts them and sums what was commissioned.
  await expect(page.getByText('Missions').first()).toBeVisible();
  await expect(page.getByText('04', { exact: true })).toBeVisible();

  // 55RA is delivered, so it files under Delivered and not under Active.
  await expect(page.getByRole('heading', { name: 'Delivered' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Active missions' })).toBeVisible();

  // And the session really is a session: sign out and the file closes.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/account'));
  await page.goto('/account');
  await page.waitForURL(/\/auth\/sign-in/);
});

test('magic link: a token can only be spent once — replaying it lands on the expired notice', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  const email = testEmail('replay');

  try {
    const href = onOriginUnderTest(await requestDevLink(page, email));

    await page.goto(href);
    await page.waitForURL('**/account');

    await page.context().clearCookies();
    await page.goto(href);
    await page.waitForURL(/\/auth\/sign-in\?error=expired/);
  } finally {
    await cleanup({ emails: [email] });
  }
});

test('magic link: an unknown token is refused without revealing anything', async ({ page }) => {
  await page.goto('/api/auth/verify?token=not-a-real-token');
  await page.waitForURL(/\/auth\/sign-in\?error=expired/);
  await expect(page.locator('body')).not.toContainText('not-a-real-token');
});

test('magic link: the endpoint answers identically for an address that has no account', async ({
  request,
}) => {
  const email = testEmail('unknown-account');
  try {
    const res = await request.post('/api/auth/magic-link', { data: { email } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.devLink).toContain('/api/auth/verify?token=');
  } finally {
    await cleanup({ emails: [email] });
  }
});

test('magic link: a malformed address is refused with a 400 and no link', async ({ request }) => {
  const res = await request.post('/api/auth/magic-link', { data: { email: 'nope' } });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('INVALID_EMAIL');
  expect(body.devLink).toBeUndefined();
});

test('account: is not readable without a session', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/account');
  await page.waitForURL(/\/auth\/sign-in/);
  await expect(page.locator('#email')).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* DEFECT — issued links point at a different origin than the app.     */
/* ------------------------------------------------------------------ */

/**
 * `lib/env.ts` builds every absolute link from NEXT_PUBLIC_SITE_URL, and
 * `.env` pins that to http://localhost:3000 while this app is served from
 * :3200 — a different project entirely. So the magic link a customer is given
 * points somewhere else, and so do the "Track the mission" links in the mock
 * mail log and the share link offered on mission control.
 *
 * One line of .env fixes it; this test goes green when it is fixed.
 *
 * Reproduce:
 *   curl -s -X POST http://localhost:3200/api/auth/magic-link \
 *     -H 'content-type: application/json' -d '{"email":"a@b.co"}'
 *   → {"ok":true,"devLink":"http://localhost:3000/api/auth/verify?token=…"}
 */
test('DEFECT — an issued magic link points at the origin the app is served from', async ({
  request,
}) => {
  const email = testEmail('origin');
  try {
    const res = await request.post('/api/auth/magic-link', { data: { email } });
    const { devLink } = await res.json();
    expect(new URL(devLink).origin).toBe(new URL(BASE_URL).origin);
  } finally {
    await cleanup({ emails: [email] });
  }
});
