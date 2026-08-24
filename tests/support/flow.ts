/**
 * Browser helpers for the purchase flow.
 *
 * /start is a sequence of single-decision screens rather than one scrolling
 * page, so these helpers know the sequence: each one makes sure the screen it
 * needs is on the wall, answers it, and leaves the browser on whatever screen
 * that answer opened. The step is read off the URL, which is where the flow
 * keeps it.
 *
 * Everything here waits on a condition — a network response, an element
 * reaching a state, a URL matching. Nothing sleeps.
 */
import { expect, type Page } from '@playwright/test';

export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1280, height: 900 };

/** Mission codes as they appear in a URL. */
export const CODE_IN_URL = /\/m\/([0-9]{2}[A-HJ-NP-Z]{2})$/;

/** The briefing, in order. Mirrors components/purchase/steps.ts. */
export const STEPS = [
  'open',
  'target',
  'aim',
  'why',
  'brief',
  'format',
  'finish',
  'authorise',
] as const;

export type Step = (typeof STEPS)[number];

/** Which screen is on the wall, taken from `?step=`. */
export function stepOf(page: Page): Step {
  const value = new URL(page.url()).searchParams.get('step');
  return (STEPS as readonly string[]).includes(value ?? '') ? (value as Step) : 'open';
}

export async function expectStep(page: Page, step: Step): Promise<void> {
  await expect
    .poll(() => stepOf(page), { message: `expected the ${step} screen` })
    .toBe(step);
}

/**
 * Answers the screen that is up with its default answer and waits for the
 * next one. The target screen is the one exception: it needs an address, so
 * `lockTarget` owns it.
 */
async function answerCurrent(page: Page): Promise<void> {
  const from = stepOf(page);
  switch (from) {
    case 'open':
      await page.getByRole('button', { name: 'Begin' }).click();
      break;
    case 'target':
      throw new Error('the target screen needs an address — call lockTarget first');
    case 'aim':
      await page.locator('#aim-confirm').click();
      break;
    case 'why':
      await page.getByRole('button', { name: 'Leave it off the sheet' }).click();
      break;
    case 'brief':
      await page.locator('#brief-continue').click();
      break;
    case 'format':
      // The standard issue, which is the draft's own default.
      await page.getByRole('radio', { name: /50 × 70 CM/ }).click();
      break;
    case 'finish':
      await page.getByRole('radio', { name: /^Unframed/ }).click();
      break;
    case 'authorise':
      throw new Error('the authorise screen is the end of the sequence');
  }
  await expect.poll(() => stepOf(page)).not.toBe(from);
}

/** Walks the sequence forward, on defaults, until `step` is on the wall. */
export async function advanceTo(page: Page, step: Step): Promise<void> {
  const target = STEPS.indexOf(step);
  for (let guard = 0; STEPS.indexOf(stepOf(page)) < target; guard++) {
    if (guard > STEPS.length) throw new Error(`stuck before the ${step} screen`);
    await answerCurrent(page);
  }
  await expectStep(page, step);
}

/**
 * Types an address, waits for the index to answer, and locks the first match.
 * Locking advances the sequence to the aim screen. Returns the label of the
 * suggestion that was taken.
 */
export async function lockTarget(page: Page, query: string): Promise<string> {
  await advanceTo(page, 'target');

  const field = page.locator('#target-address');
  await expect(field).toBeVisible();

  const options = page.getByRole('option');

  /* The dev server recompiles on every edit, and a request that lands mid
     compile comes back 500 — the field then shows "Address index
     unreachable". Retyping re-fires the debounced query, so the helper
     re-asks rather than failing on a transient. It waits on the list
     appearing, never on a clock. */
  for (let attempt = 0; ; attempt++) {
    await field.fill('');
    await field.fill(query);
    try {
      await expect(options.first()).toBeVisible({ timeout: 8_000 });
      break;
    } catch (err) {
      if (attempt >= 2) throw err;
    }
  }

  const label = (await options.first().innerText()).trim();
  await options.first().click();

  // The target is locked when the sequence has moved on to the frame.
  await expectStep(page, 'aim');
  return label;
}

/** Waits for the capture preview tile to actually arrive. */
export async function waitForCapturePreview(page: Page): Promise<void> {
  const frame = page.getByRole('img', { name: /Simulated satellite capture of/i });
  await expect(frame).toBeVisible();
  await expect
    .poll(async () => frame.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), {
      message: 'the capture tile never finished loading',
    })
    .toBe(true);
}

/** Sets the dedication line printed on the mission sheet. */
export async function chooseDedication(page: Page, line: string): Promise<void> {
  await advanceTo(page, 'why');
  await page.getByRole('radio', { name: 'Something else' }).click();
  await page.locator('#dedication').fill(line);
  await page.locator('#dedication-submit').click();
  await expect.poll(() => stepOf(page)).not.toBe('why');
}

/** Picks a print format by its metric label, e.g. "30 × 40 CM". */
export async function chooseFormat(page: Page, metric: string): Promise<void> {
  await advanceTo(page, 'format');
  await page.getByRole('radio', { name: new RegExp(metric) }).click();
  await expect.poll(() => stepOf(page)).not.toBe('format');
}

/** Picks the finish. */
export async function chooseFrame(page: Page, finish: 'Framed' | 'Unframed'): Promise<void> {
  await advanceTo(page, 'finish');
  await page.getByRole('radio', { name: new RegExp(`^${finish}\\b`) }).click();
  await expect.poll(() => stepOf(page)).not.toBe('finish');
}

/** The Back control in the step chrome, one screen at a time. */
export async function goBack(page: Page): Promise<void> {
  const from = stepOf(page);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect.poll(() => stepOf(page)).not.toBe(from);
}

/**
 * The quiet change affordance on the authorise screen, which sends the reader
 * back to the screen a line was decided on.
 */
export async function changeFromSummary(
  page: Page,
  line: 'target' | 'footprint' | 'dedication' | 'print' | 'finish',
): Promise<void> {
  await expectStep(page, 'authorise');
  await page.getByRole('button', { name: `Change the ${line}` }).click();
}

/**
 * Fills the email and authorises, walking any screens still between the
 * browser and the end of the sequence. Resolves with the mission code taken
 * from the checkout URL.
 */
export async function authorise(page: Page, email: string): Promise<string> {
  await advanceTo(page, 'authorise');
  await page.locator('#authorise-email').fill(email);
  const created = page.waitForResponse(
    (r) => r.url().includes('/api/orders') && r.request().method() === 'POST',
  );
  await page.locator('#authorise-submit').click();
  const res = await created;
  expect(res.status(), 'POST /api/orders must open a mission').toBe(201);
  const body = (await res.json()) as { missionCode: string };
  await page.waitForURL(new RegExp(`/checkout/mock/${body.missionCode}$`, 'i'));
  return body.missionCode;
}

/** Presses PAY on the mock checkout and waits for mission control. */
export async function payMockCheckout(page: Page): Promise<void> {
  const settled = page.waitForResponse(
    (r) => r.url().includes('/api/checkout/complete') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /^Pay / }).click();
  const res = await settled;
  expect(res.status(), 'POST /api/checkout/complete must settle the mission').toBe(200);
  await page.waitForURL(CODE_IN_URL);
}
