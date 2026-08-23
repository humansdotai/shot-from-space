import { test, expect } from '@playwright/test';
import { STAGE_LABEL } from '@/lib/types';
import { db, missionRow } from '../support/db';

/**
 * SHARE GATING — /s/[code]?k=token
 *
 * A share link is the document someone was handed. It carries the timeline,
 * the frame and the city, and nothing that belongs to the buyer. A wrong key
 * or no key must produce the designed refusal, never a stack trace and never
 * a 500.
 *
 * Read-only: this file uses the seeded demo missions and writes nothing.
 */

test.afterAll(async () => {
  await db.$disconnect();
});

test('share: a valid key renders the file at city level with the mission code and its stage', async ({
  page,
}) => {
  const row = await missionRow('74KL');
  await page.goto(`/s/74KL?k=${encodeURIComponent(row.shareToken)}`);

  await expect(page.getByText('74KL').first()).toBeVisible();
  await expect(page.getByText(row.locationLabel).first()).toBeVisible();
  await expect(page.getByText(STAGE_LABEL.IMAGE_ACQUIRED).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start your own mission' })).toBeVisible();
});

test('share: the rendered page shows no street address, email, receipt number or amount', async ({
  page,
}) => {
  const row = await missionRow('32BF');
  await page.goto(`/s/32BF?k=${encodeURIComponent(row.shareToken)}`);
  await expect(page.getByText('32BF').first()).toBeVisible();

  const text = await page.locator('body').innerText();
  expect(text, 'street address').not.toContain(row.addressLine1);
  expect(text, 'street address line 2').not.toContain(row.addressLine2 ?? '__none__');
  expect(text, 'postal code').not.toContain(row.postalCode);
  expect(text, 'customer email').not.toContain(row.email);
  expect(text, 'receipt number').not.toContain(row.receiptNumber ?? '__none__');
  expect(text, 'amount paid').not.toContain('$420');
  expect(text, 'exact fix').not.toContain(row.lat.toFixed(4));
  expect(text, 'exact fix').not.toContain(row.lon.toFixed(4));
});

test('share: the coordinates shown are the rounded public fix, not the doorstep', async ({ page }) => {
  const row = await missionRow('32BF');
  await page.goto(`/s/32BF?k=${encodeURIComponent(row.shareToken)}`);
  const text = await page.locator('body').innerText();
  // 34.1017 → 34.10 (about 1.1 km, the same order as the capture footprint).
  expect(text).toContain(row.lat.toFixed(2));
  expect(text).not.toContain(row.lat.toFixed(4));
});

test('share: a shared file offers no owner controls — no receipt link and no comms', async ({
  page,
}) => {
  const row = await missionRow('32BF');
  await page.goto(`/s/32BF?k=${encodeURIComponent(row.shareToken)}`);
  await expect(page.getByRole('link', { name: /receipt/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Advance mission/i })).toHaveCount(0);
});

test('share: a wrong key renders the designed refusal, not a crash', async ({ page }) => {
  const response = await page.goto('/s/32BF?k=definitely-not-the-key');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Share key not recognised')).toBeVisible();
  await expect(page.getByText('File not accessible')).toBeVisible();
  // The refusal must not confirm anything about the file behind it.
  const text = await page.locator('body').innerText();
  expect(text).not.toContain('LOS ANGELES');
  expect(text).not.toContain('FINAL DELIVERABLE APPROACHING');
});

test('share: a missing key renders the designed refusal that explains the key', async ({ page }) => {
  const response = await page.goto('/s/32BF');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Share key missing')).toBeVisible();
  await expect(page.getByText(/the key is the part after \?k=/i)).toBeVisible();
});

test('share: an empty key is treated as a missing key, not as a match', async ({ page }) => {
  await page.goto('/s/32BF?k=');
  await expect(page.getByText('File not accessible')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('LOS ANGELES');
});

test('share: a malformed mission code refuses without a 500', async ({ page }) => {
  const response = await page.goto('/s/ABCD?k=whatever');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('File not accessible')).toBeVisible();
});

test("share: one mission's key does not open another mission", async ({ page }) => {
  const row = await missionRow('32BF');
  await page.goto(`/s/74KL?k=${encodeURIComponent(row.shareToken)}`);
  await expect(page.getByText('Share key not recognised')).toBeVisible();
});

test('share: an unknown but well-formed code refuses without revealing that it is unknown', async ({
  page,
}) => {
  const response = await page.goto('/s/99ZY?k=anything');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Share key not recognised')).toBeVisible();
});
