import { test, expect } from '@playwright/test';
import { STAGE_LABEL } from '@/lib/types';
import { cleanup, db, testEmail } from '../support/db';
import {
  DESKTOP,
  PHONE,
  advanceTo,
  authorise,
  changeFromSummary,
  chooseDedication,
  chooseFormat,
  chooseFrame,
  goBack,
  lockTarget,
  payMockCheckout,
  waitForCapturePreview,
} from '../support/flow';

/**
 * THE MONEY PATH, END TO END.
 *
 * begin → address → suggestion → capture preview → dedication → brief →
 * size → finish → email → authorise → mock checkout → /m/{code} with a real
 * mission behind it.
 *
 * Every mission this file opens is deleted in the same test. The seeded demo
 * dossier is never touched.
 */

test.afterAll(async () => {
  await db.$disconnect();
});

for (const [name, viewport] of [
  ['390', PHONE],
  ['1280', DESKTOP],
] as const) {
  test(`purchase at ${name}: a US address is bought end to end and lands on a real mission file`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const email = testEmail(`buy-${name}`);
    let code = '';

    try {
      await page.goto('/start');

      await lockTarget(page, '6801 Hollywood Boulevard');
      await waitForCapturePreview(page);

      await chooseDedication(page, 'The house on the hill');
      await chooseFormat(page, '50 × 70 CM');
      await chooseFrame(page, 'Framed');

      // The figure on the control is the figure that is charged.
      await expect(page.locator('#authorise-submit')).toContainText('$420');

      // IDENTITY LAST. Nothing before this screen asked who anyone is, and
      // this screen asks once: the email is the only field on the page.
      await expect(page.locator('input')).toHaveCount(1);
      await expect(page.locator('input')).toHaveAttribute('id', 'authorise-email');

      code = await authorise(page, email);
      expect(code).toMatch(/^[0-9]{2}[A-HJ-NP-Z]{2}$/);

      // The checkout screen shows the same money, with shipping and duties in it.
      await expect(page.getByText('Due now')).toBeVisible();
      await expect(page.getByRole('button', { name: /^Pay \$420\b/ })).toBeVisible();
      await expect(page.getByText('Shipping', { exact: true }).first()).toBeVisible();
      // Duties, not "Duties and VAT": /legal/terms and lib/pricing.ts promise
      // shipping and import duties, and VAT was promised on this screen alone.
      await expect(page.getByText('Duties', { exact: true })).toBeVisible();

      await payMockCheckout(page);

      expect(new URL(page.url()).pathname).toBe(`/m/${code}`);
      await expect(page.getByText(code, { exact: false }).first()).toBeVisible();
      await expect(page.getByText(STAGE_LABEL.MISSION_CONFIRMED).first()).toBeVisible();

      // The record behind the page, not just the page.
      const row = await db.mission.findUniqueOrThrow({ where: { code } });
      expect(row.email).toBe(email);
      expect(row.state).toBe('MISSION_CONFIRMED');
      expect(row.paidAt).not.toBeNull();
      expect(row.receiptNumber).toBe(`SFS-${new Date().getUTCFullYear()}-${code}`);
      expect(row.amountMinor).toBe(42000);
      expect(row.currency).toBe('USD');
      expect(row.printRegion).toBe('US');
      expect(row.formatId).toBe('F50');
      expect(row.frame).toBe('FRAMED');
      expect(row.addressLine1).toBe('6801 Hollywood Boulevard');
      // The dedication screen is not decoration: the answer is on the record.
      expect(row.dedication).toBe('The house on the hill');
    } finally {
      await cleanup({ codes: code ? [code] : [], emails: [email] });
    }
  });
}

test('purchase: the authorise control refuses an empty email and says why, without opening a mission', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/start');
  await lockTarget(page, '6801 Hollywood Boulevard');
  await advanceTo(page, 'authorise');

  let ordersCalled = false;
  page.on('request', (r) => {
    if (r.url().includes('/api/orders')) ordersCalled = true;
  });

  await page.locator('#authorise-submit').click();
  await expect(page.locator('#authorise-email-err')).toContainText(/email is required/i);
  expect(ordersCalled, 'no mission may be opened without an email').toBe(false);

  await page.locator('#authorise-email').fill('not-an-email');
  await page.locator('#authorise-submit').click();
  await expect(page.locator('#authorise-email-err')).toContainText(/will not accept mail/i);
  expect(ordersCalled).toBe(false);
});

test('purchase: a step past the target cannot be opened without one', async ({ page }) => {
  await page.setViewportSize(DESKTOP);

  // Hand-typed deep links land on the target screen rather than an empty
  // brief, and the URL is corrected to say so.
  for (const step of ['brief', 'format', 'authorise']) {
    await page.goto(`/start?step=${step}`);
    await expect(page).toHaveURL(/\/start\?step=target$/);
    await expect(page.locator('#target-address')).toBeVisible();
    await expect(page.locator('#authorise-submit')).toHaveCount(0);
  }
});

test('purchase: the sequence keeps its place and its target across a reload', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/start');
  await lockTarget(page, '6801 Hollywood Boulevard');
  await chooseDedication(page, 'Where we grew up');
  await advanceTo(page, 'authorise');

  await page.reload();

  await expect(page).toHaveURL(/\/start\?step=authorise$/);
  await expect(page.getByText('6801 HOLLYWOOD BOULEVARD, LOS ANGELES, US')).toBeVisible();
  await expect(page.getByText('Where we grew up')).toBeVisible();
  await expect(page.locator('input')).toHaveCount(1);
});

test('purchase: Back returns to the previous screen with the answer still on it', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/start');
  await lockTarget(page, '6801 Hollywood Boulevard');
  await chooseFormat(page, '70 × 100 CM');
  await chooseFrame(page, 'Framed');

  await goBack(page);
  await expect(page).toHaveURL(/step=finish$/);
  await expect(page.getByRole('radio', { name: /^Framed/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  await goBack(page);
  await expect(page).toHaveURL(/step=format$/);
  await expect(page.getByRole('radio', { name: /70 × 100 CM/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('purchase: changing the finish re-prices every size before anything is charged', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/start');
  await lockTarget(page, '6801 Hollywood Boulevard');

  const group = page.getByRole('radiogroup', { name: 'Print format' });

  // Unframed is the draft's default, so the first pass through the size
  // screen quotes the unframed price — and states the framed price under
  // each row.
  await advanceTo(page, 'format');
  await expect(group.getByRole('radio').nth(0)).toContainText('$180');
  await expect(group.getByRole('radio').nth(1)).toContainText('$280');
  await expect(group.getByRole('radio').nth(2)).toContainText('$420');
  await expect(group.getByRole('radio').nth(2)).toContainText('Framed $640');

  await chooseFormat(page, '50 × 70 CM');
  await chooseFrame(page, 'Framed');

  // Back to the size screen from the summary: every row now quotes framed.
  await changeFromSummary(page, 'print');
  await expect(group.getByRole('radio').nth(0)).toContainText('$260');
  await expect(group.getByRole('radio').nth(1)).toContainText('$420');
  await expect(group.getByRole('radio').nth(2)).toContainText('$640');
});
