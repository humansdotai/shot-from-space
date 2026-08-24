import { test, expect } from '@playwright/test';
import { horizontalOverflow } from '../support/a11y';
import { PHONE } from '../support/flow';

/**
 * THE PHONE SHAPE OF /mission — one scrolling document.
 *
 * The owner replaced the pinned-panel configurator on phones with a
 * single scrolling page:
 *
 *   "on mobile make the purchase payment as a scrollable page with all
 *    the elements on a page with not fixed buttones or components just
 *    like you have on mapiful.com … on mobile the purchase page should
 *    have white background and black text."
 *
 * That is a deliberate departure from CONFIGURATOR.md §3.1 — which still
 * governs at ≥ 1024 — so it is the kind of decision that gets silently
 * undone by the next person who reads §3.1 and "fixes" the phone. These
 * tests are the record of the instruction.
 *
 * They assert the four things the instruction actually asked for, and
 * one it did not: that the ≥ 1024 split is untouched.
 */

const TARGET = '/mission?address=Lisse%2C%20NL&lat=52.2583&lon=4.5569';

test('mobile /mission: the page scrolls as one document', async ({ page }) => {
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

test('mobile /mission: nothing is fixed or sticky', async ({ page }) => {
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
      .map((el) => `${el.tagName}.${String(el.className).slice(0, 40)}`),
  );

  expect(pinned, 'no pinned furniture on the phone purchase page').toEqual([]);
});

test('mobile /mission: every section is on the page at once', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(TARGET);
  await page.waitForSelector('.mission-configurator-stacked');

  // BY ID, not by `h2`. The section bodies carry their own headings
  // ("Whose mission is this?"), so a descendant-h2 selector counts those
  // too and the number it returns is not the number of sections.
  const heads = await page.locator('main [id^="stacked-head-"]').allInnerTexts();

  // Six configuring sections. Confirmation is not among them: it is the
  // receipt, and it replaces the document once the mission is paid for.
  expect(heads).toHaveLength(6);
  expect(heads.join(' ')).toMatch(/TARGET[\s\S]*FRAMING[\s\S]*MISSION[\s\S]*DESIGN[\s\S]*WINDOW[\s\S]*REVIEW/i);

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
