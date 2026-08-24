import { test, expect } from '@playwright/test';
import { cleanup, db, testEmail } from '../support/db';
import {
  DESKTOP,
  PHONE,
  advanceTo,
  authorise,
  chooseFormat,
  chooseFrame,
  goBack,
  lockTarget,
} from '../support/flow';

/**
 * REGION PRICING IN THE BROWSER.
 *
 * The country of the target address decides the currency, the facility and
 * the number charged. Nothing here is inferred from the browser locale.
 */

test.afterAll(async () => {
  await db.$disconnect();
});

test('region pricing: a UK address prices in EUR and names the Netherlands facility', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/start');
  await lockTarget(page, '221B Baker Street');
  await advanceTo(page, 'format');

  await expect(page.getByText('Printed in EU / EINDHOVEN, NL')).toBeVisible();
  await expect(page.getByText('Printed in the Netherlands. Shipping and duties included.')).toBeVisible();

  const formats = page.getByRole('radiogroup', { name: 'Print format' });
  await expect(formats.getByRole('radio').nth(0)).toContainText('€170');
  await expect(formats.getByRole('radio').nth(1)).toContainText('€260');
  await expect(formats.getByRole('radio').nth(2)).toContainText('€390');
  // Not a single dollar figure anywhere on a European order.
  await expect(page.locator('body')).not.toContainText('$');

  await chooseFormat(page, '70 × 100 CM');
  await chooseFrame(page, 'Unframed');
  await expect(page.locator('#authorise-submit')).toContainText('€390');
  await expect(page.getByText('€390 EUR').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('$');
});

test('region pricing: a US address prices in USD and names the Nevada facility', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/start');
  await lockTarget(page, '6801 Hollywood Boulevard');
  await advanceTo(page, 'format');

  await expect(page.getByText('Printed in US / RENO, NV')).toBeVisible();
  await expect(page.getByText('Printed in Nevada. Shipping and duties included.')).toBeVisible();

  const formats = page.getByRole('radiogroup', { name: 'Print format' });
  await expect(formats.getByRole('radio').nth(0)).toContainText('$180');
  await expect(formats.getByRole('radio').nth(1)).toContainText('$280');
  await expect(formats.getByRole('radio').nth(2)).toContainText('$420');

  await chooseFormat(page, '70 × 100 CM');
  await chooseFrame(page, 'Unframed');
  await expect(page.locator('#authorise-submit')).toContainText('$420');
  await expect(page.locator('body')).not.toContainText('€');
});

test('region pricing: re-targeting from the US to the UK re-prices the whole flow in place', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/start');

  await lockTarget(page, '6801 Hollywood Boulevard');
  await advanceTo(page, 'format');
  await expect(page.getByText('Printed in US / RENO, NV')).toBeVisible();

  // Back to the target screen, which comes up pre-filled with the address
  // that is already locked, and re-aim at another country.
  for (let i = 0; i < 4; i++) await goBack(page);
  await expect(page.locator('#target-address')).toHaveValue(/Hollywood/i);

  await lockTarget(page, '221B Baker Street');
  await advanceTo(page, 'format');

  await expect(page.getByText('Printed in EU / EINDHOVEN, NL')).toBeVisible();
  await expect(page.getByText('Printed in US / RENO, NV')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('$');
});

test('region pricing at 390: a UK purchase is charged in EUR and recorded against the EU facility', async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  const email = testEmail('uk-e2e');
  let code = '';

  try {
    await page.goto('/start');
    await lockTarget(page, '221B Baker Street');
    await chooseFormat(page, '70 × 100 CM');
    await chooseFrame(page, 'Unframed');
    await expect(page.locator('#authorise-submit')).toContainText('€390');

    code = await authorise(page, email);
    await expect(page.getByRole('button', { name: /^Pay €390\b/ })).toBeVisible();

    const row = await db.mission.findUniqueOrThrow({ where: { code } });
    expect(row.currency).toBe('EUR');
    expect(row.amountMinor).toBe(39000);
    expect(row.printRegion).toBe('EU');
    expect(row.countryCode).toBe('GB');
    expect(row.locationLabel).toBe('LONDON / GB');
  } finally {
    await cleanup({ codes: code ? [code] : [], emails: [email] });
  }
});
