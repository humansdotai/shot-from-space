import { test, expect } from '@playwright/test';
import { horizontalOverflow } from '../support/a11y';
import { PHONE } from '../support/flow';

/**
 * THE PHONE SHAPE OF /mission — stepped pages, one floating control.
 *
 * This shape has been through two owner instructions and the second
 * refined the first. Both are recorded because the second only makes
 * sense against the first.
 *
 *   1. "on mobile make the purchase payment as a scrollable page with
 *       all the elements on a page with not fixed buttones or components
 *       just like you have on mapiful.com … white background and black
 *       text."
 *
 *   2. "for purchase BREAK IN STEPS ON MOBILE BUT EVERY STEP SHOULD BE A
 *       SCROLLABLE PAGE WITH ONLY FLOAT BUTTON IS CONTINUE/NEXT/BUY AND
 *       SOME INFO"
 *
 * So the current shape is: one STEP at a time, each step an ordinary
 * scrolling page — stage, head and controls all in the document — and
 * exactly ONE floating element, carrying the action and the price. The
 * paper ground and black type from the first instruction survive.
 *
 * What (2) reversed from (1) is only the stacking: all six sections down
 * one 15,000px page became one section per page. What it reversed from
 * the ORIGINAL panel shape is the pinning of everything else — the stage
 * and the controls scroll now, where they used to share one viewport.
 *
 * These tests are the record. The counts matter: "exactly one floating
 * element" is the instruction, and both zero and two are wrong.
 */

const TARGET = '/mission?address=Lisse%2C%20NL&lat=52.2583&lon=4.5569';

test('mobile /mission: each step is a scrolling page', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(TARGET);
  await page.waitForSelector('.mission-configurator-stacked');

  const metrics = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    viewport: window.innerHeight,
    htmlOverflow: getComputedStyle(document.documentElement).overflow,
  }));

  // A document, not a viewport-sized shell with an inner scroller.
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.viewport * 2);
  expect(metrics.htmlOverflow).not.toBe('hidden');
});

test('mobile /mission: exactly one floating element, and it is the action', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(TARGET);
  await page.waitForSelector('.mission-configurator-stacked');

  // Scoped to <main>: the site bar outside it IS fixed, deliberately and
  // on the owner's separate instruction. This is about the purchase
  // surface itself.
  const pinned = await page.evaluate(() =>
    [...document.querySelectorAll('main *')]
      .filter((el) => {
        const p = getComputedStyle(el).position;
        return p === 'fixed' || p === 'sticky';
      })
      .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)),
  );

  expect(pinned, 'the action bar is the only floating thing').toHaveLength(1);
  // …and it carries the button AND the info beside it.
  expect(pinned[0]).toMatch(/continue|pay|next/i);
  expect(pinned[0], 'the bar carries the price beside the button').toMatch(/[€$]\s?\d/);
});

test('mobile /mission: the floating action never covers a control', async ({ page }) => {
  await page.setViewportSize(PHONE);

  for (const step of ['target', 'framing', 'mission', 'design', 'window', 'review']) {
    await page.goto(`${TARGET}&step=${step}`);
    await page.waitForSelector('.mission-configurator-stacked');
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);

    const covered = await page.evaluate(() => {
      const bar = document.querySelector('main .fixed')!;
      const box = bar.getBoundingClientRect();
      return [...document.querySelectorAll('main button, main input, main a[href]')]
        .filter((el) => !bar.contains(el))
        .map((el) => ({ t: (el.textContent ?? '').trim().slice(0, 30), r: el.getBoundingClientRect() }))
        .filter((o) => o.r.height > 0 && o.r.top < window.innerHeight && o.r.bottom > box.top + 2)
        .map((o) => o.t);
    });

    // Fixed furniture is out of flow. Without the spacer that reserves
    // its height, the last control of every step sits under the bar.
    expect(covered, `${step}: nothing may sit under the action bar`).toEqual([]);
  }
});

test('mobile /mission: one step at a time, and a way back', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(TARGET);
  await page.waitForSelector('.mission-configurator-stacked');

  // BY ID, not by `h2`: the section bodies carry their own headings, so a
  // descendant-h2 selector counts those too.
  const heads = await page.locator('main [id^="stacked-head-"]').allInnerTexts();
  expect(heads, 'one section is rendered, not all of them').toHaveLength(1);

  // The step is named and counted, in the document rather than floating.
  const main = (await page.locator('main').innerText()).toUpperCase();
  expect(main).toMatch(/STEP\s*1\s*\/\s*6/);

  // Step one has nowhere to go back to; a later step does.
  expect(await page.getByRole('button', { name: /^back to/i }).count()).toBe(0);
  await page.goto(`${TARGET}&step=mission`);
  await page.waitForSelector('.mission-configurator-stacked');
  await expect(page.getByRole('button', { name: /^back to/i }).first()).toBeVisible();

  expect(await horizontalOverflow(page), 'no sideways scroll at 390').toBe(0);
});

test('mobile /mission: paper ground, black type', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(TARGET);
  const shell = page.locator('.mission-configurator-stacked');
  await shell.waitFor();

  const { bg, ink } = await shell.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, ink: s.color };
  });

  const luminance = (css: string) => {
    const [r, g, b] = (css.match(/[\d.]+/g) ?? ['0', '0', '0']).map(Number);
    const lin = (c: number) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };

  expect(luminance(bg), `ground should be light, got ${bg}`).toBeGreaterThan(0.7);
  expect(luminance(ink), `type should be dark, got ${ink}`).toBeLessThan(0.1);
});

test('desktop /mission keeps the pinned split — CONFIGURATOR.md §3.1', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.goto(TARGET);
  await page.waitForSelector('.mission-configurator');

  const state = await page.evaluate(() => ({
    stacked: document
      .querySelector('.mission-configurator')!
      .classList.contains('mission-configurator-stacked'),
    htmlOverflow: getComputedStyle(document.documentElement).overflow,
  }));

  expect(state.stacked, 'the split must survive at 1440').toBe(false);
  expect(state.htmlOverflow).toBe('hidden');

  // The rule the phone now departs from still holds here: the primary
  // action is inside the viewport with no scrolling.
  const cta = page.locator('[data-panel-foot] button, [data-panel-foot] a').last();
  const box = await cta.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(820);
});
