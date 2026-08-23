/**
 * Accessibility smoke checks for the money path, measured in the browser.
 *
 * Three rules, all of them things that make a phone purchase fail rather
 * than merely look wrong:
 *   · 44 CSS px minimum on anything you have to hit
 *   · 16px minimum on anything you have to type into (below it iOS zooms the
 *     page on focus and the layout is never recovered)
 *   · nothing wider than the viewport
 */
import type { Page } from '@playwright/test';

export interface TapTarget {
  label: string;
  width: number;
  height: number;
}

/** The minimum comfortable hit area, in CSS pixels. */
export const MIN_TAP_PX = 44;
/** Below this an iOS browser zooms the page when the field takes focus. */
export const MIN_INPUT_FONT_PX = 16;

/**
 * Every visible control that is a discrete target, with its rendered box.
 *
 * Inline links inside prose are excluded deliberately: they are words in a
 * sentence, not targets, and WCAG 2.5.8 exempts a control whose activation is
 * available inline in a block of text. Everything a purchase actually depends
 * on — buttons, radios, options, fields, and links set as blocks — is in.
 */
export async function tapTargets(page: Page): Promise<TapTarget[]> {
  return page.evaluate(() => {
    const SELECTOR =
      'button, input, select, textarea, [role="radio"], [role="option"], [role="button"], a[href]';
    const out: Array<{ label: string; width: number; height: number }> = [];

    /**
     * The rendered box, widened by any absolutely-positioned ::before /
     * ::after that hangs outside it. Several controls in this product are
     * small glyphs whose hit area is deliberately grown by a pseudo-element
     * (see `.sfs-redact::after`), and a rect-only measurement would call
     * those failures when a thumb lands on them perfectly well.
     */
    const hitBox = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      let { top, right, bottom, left } = rect;

      for (const pseudo of ['::before', '::after']) {
        const style = window.getComputedStyle(el, pseudo);
        if (!style.content || style.content === 'none') continue;
        if (style.position !== 'absolute') continue;
        if (style.pointerEvents === 'none') continue;

        const px = (v: string) => (v.endsWith('px') ? Number.parseFloat(v) : Number.NaN);
        const t = px(style.top);
        const r = px(style.right);
        const b = px(style.bottom);
        const l = px(style.left);
        if (Number.isFinite(t)) top = Math.min(top, rect.top + t);
        if (Number.isFinite(b)) bottom = Math.max(bottom, rect.bottom - b);
        if (Number.isFinite(l)) left = Math.min(left, rect.left + l);
        if (Number.isFinite(r)) right = Math.max(right, rect.right - r);
      }
      return { width: right - left, height: bottom - top };
    };

    for (const el of Array.from(document.querySelectorAll<HTMLElement>(SELECTOR))) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') continue;
      // Screen-reader-only affordances have no visual box to hit.
      if (el.closest('.sr-only')) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      // Inline links in running text are words, not targets: WCAG 2.5.8
      // exempts a control whose activation is available inline in a sentence.
      if (el.tagName === 'A' && style.display.startsWith('inline') && el.closest('p, li, dd')) {
        continue;
      }

      const text = (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);

      const box = hitBox(el);
      out.push({
        label: `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}> ${text}`,
        width: Math.round(box.width * 10) / 10,
        height: Math.round(box.height * 10) / 10,
      });
    }
    return out;
  });
}

/** Every visible text-entry field with the font size it renders at. */
export async function inputFontSizes(page: Page): Promise<Array<{ label: string; px: number }>> {
  return page.evaluate(() => {
    const fields = Array.from(
      document.querySelectorAll<HTMLElement>('input, textarea, select'),
    ).filter((el) => {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const type = (el as HTMLInputElement).type;
      return !['hidden', 'checkbox', 'radio', 'submit', 'button', 'range'].includes(type);
    });

    return fields.map((el) => ({
      label: `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}>`,
      px: Number.parseFloat(window.getComputedStyle(el).fontSize),
    }));
  });
}

/** How far the document scrolls sideways past the viewport, in CSS pixels. */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, Math.max(doc.scrollWidth, document.body.scrollWidth) - doc.clientWidth);
  });
}

/** The elements that are actually wider than the viewport, for a useful failure. */
export async function overflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > limit + 1 || rect.left < -1) {
        const style = window.getComputedStyle(el);
        // An element that scrolls inside its own box is allowed to be wide.
        if (style.overflowX === 'auto' || style.overflowX === 'scroll') continue;
        if (el.closest('[style*="overflow"], .overflow-x-auto, .overflow-hidden')) continue;
        out.push(
          `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} class="${el.className.toString().slice(0, 60)}"> ` +
            `left=${Math.round(rect.left)} right=${Math.round(rect.right)} limit=${limit}`,
        );
      }
    }
    return out.slice(0, 12);
  });
}
