'use client';

import { clsx as cn } from 'clsx';
import { useState, type ReactNode } from 'react';
import { REDACTION_REASON, type RedactionReason } from './redaction';

/**
 * REDACTED — a bar of ink over a value, lifted on contact.
 *
 * The mission file is set as a released document, and this is the released
 * document's one unmistakable gesture: a solid bar where a value should be,
 * which wipes away to the right when you touch it. Under the bar the real
 * text is always there — in the layout, in the DOM, and in the accessibility
 * tree. Nothing is ever removed, only covered.
 *
 * WHAT MAY GO BEHIND A BAR is decided in `./redaction.ts`, not here. Short
 * version: house-internal operational metadata only. Never an address, an
 * email, a price, a tracking number or anything else the owner of the file
 * is entitled to read at a glance.
 *
 * ── No layout shift, by construction ───────────────────────────────────
 * The real text is the only thing in flow. It is rendered at full size and
 * full weight whether the bar is down or lifted, and it never changes: the
 * control's box is the text's box. The bar is `position: absolute` over that
 * box, so it occupies no space at any point in the animation, and the wipe
 * is a `clip-path` on the bar alone — nothing under it moves, resizes or
 * reflows. Measure the element before, during and after: same rect.
 *
 * ── Accessibility ─────────────────────────────────────────────────────
 * - The value is the control's content, so it is also its accessible name.
 *   A screen reader reads `SFS/H-4471-KM`, redacted or not; the effect is
 *   invisible to it and cannot lock anyone out.
 * - The bar is `aria-hidden` — it is ink, not information.
 * - It is a real `<button>`: in the tab order, operable with Enter and
 *   Space, and carrying the site focus ring. Focus alone lifts the bar, so
 *   a keyboard user sees what a mouse user sees.
 * - `title` names the reason ("Internal handling code") so the kind of value
 *   is knowable before the reveal, and is exposed as a description.
 * - Under `prefers-reduced-motion` the wipe is removed and the bar cuts
 *   straight to lifted. In print the bar is not rendered at all.
 * - `forced-colors` keeps the bar as a solid `CanvasText` slab rather than
 *   dropping out and leaving the text apparently unredacted.
 *
 * ── Input ─────────────────────────────────────────────────────────────
 * Hover and focus lift the bar while they last. A click or tap latches it —
 * which is the whole story on touch, where there is no hover: first tap
 * declassifies, second tap seals it again.
 */

/**
 * Scoped stylesheet. React 19 hoists this into the head and dedupes it by
 * `href`, so N bars on a page still ship one copy of these rules. It lives
 * here rather than in `app/globals.css` because the redaction language is
 * this component's and nothing else consumes it.
 *
 * Grounds: the file alternates, so the bar reads `--ink` / `--ground` rather
 * than naming a colour. On void it is a charcoal slab with a hairline edge
 * (a white-out bar on a dark band shouts); on paper it is near-solid ink,
 * which is what a redaction actually looks like.
 */
const REDACTION_CSS = `
.sfs-redact {
  position: relative;
  display: inline-block;
  max-width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  letter-spacing: inherit;
  text-align: inherit;
  vertical-align: baseline;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  /* 4px of margin on an atomic inline box extends the line box without
     moving the baseline, so the readout row it sits in grows from 36px to
     44px and the value stays exactly where the dotted leader put it. That
     is what buys the 14px of expander below: 4 + 10 + 10 + 4 = 28px between
     two stacked values, which two ±14px hit areas meet across without ever
     overlapping. */
  margin-block: 4px;
}
/* A line of 11px Typestar is a 16px tap target — half a thumb. This grows
   the hit area into the readout row's own padding and into the margin
   above, past 44px, without shifting a single glyph: it is absolute, so it
   costs no layout, and two stacked bars still cannot overlap. */
.sfs-redact::after {
  content: '';
  position: absolute;
  inset: -15px -8px;
}
.sfs-redact__text {
  position: relative;
}
.sfs-redact__bar {
  position: absolute;
  /* Over the text's box, not beside it: no space taken, no reflow. The
     0.1em bleed is ink overshooting the glyphs, the way a marker does. */
  inset: 0.04em -0.1em;
  pointer-events: none;
  border-radius: 1.5px;
  /* Ink, not fill: a fine vertical grain from the roller, a horizontal
     tooth from the paper, and a little more density along the top edge.
     The two weights are per-ground — the same alpha that is barely there
     on near-black ink turns into a screen door on the charcoal slab. */
  --redact-grain: 6%;
  --redact-tooth: 4%;
  background-color: color-mix(in srgb, var(--ink) 26%, var(--ground));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 34%, var(--ground));
  background-image:
    repeating-linear-gradient(
      90deg,
      color-mix(in srgb, var(--ground) var(--redact-grain), transparent) 0 1px,
      transparent 1px 4px
    ),
    repeating-linear-gradient(
      0deg,
      color-mix(in srgb, var(--ground) var(--redact-tooth), transparent) 0 1px,
      transparent 1px 3px
    ),
    linear-gradient(180deg, color-mix(in srgb, var(--ground) 10%, transparent), transparent 55%);
  clip-path: inset(0 0 0 0);
  transition: clip-path 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
.surface-light .sfs-redact__bar,
.on-light .sfs-redact__bar {
  --redact-grain: 10%;
  --redact-tooth: 7%;
  background-color: color-mix(in srgb, var(--ink) 94%, var(--ground));
  box-shadow: none;
}
/* The wipe: the bar retracts to the right, uncovering the value in reading
   order. One curve, one duration, the house transition. */
.sfs-redact:hover .sfs-redact__bar,
.sfs-redact:focus-visible .sfs-redact__bar,
.sfs-redact[data-revealed='true'] .sfs-redact__bar {
  clip-path: inset(0 0 0 100%);
}
@media (prefers-reduced-motion: reduce) {
  .sfs-redact__bar {
    transition: none;
  }
}
@media (forced-colors: active) {
  .sfs-redact__bar {
    background-color: CanvasText;
    background-image: none;
    forced-color-adjust: none;
  }
}
@media print {
  .sfs-redact__bar {
    display: none;
  }
}
`;

export function Redacted({
  children,
  reason = 'handling',
  className,
}: {
  /**
   * The real value. Keep it to text — it is the control's accessible name,
   * and the bar is sized from its box.
   */
  children: ReactNode;
  /** What is under the bar. Names the tooltip; defaults to a handling code. */
  reason?: RedactionReason;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <>
      <style href="sfs-redaction" precedence="medium">
        {REDACTION_CSS}
      </style>
      <button
        type="button"
        // Not `aria-pressed`: the value is in the accessible name at all
        // times, so there is no hidden state to report and announcing
        // "not pressed" on every field would only suggest one.
        title={REDACTION_REASON[reason]}
        data-reason={reason}
        data-revealed={revealed ? 'true' : 'false'}
        onClick={() => setRevealed((v) => !v)}
        className={cn('sfs-redact', className)}
      >
        <span className="sfs-redact__text">{children}</span>
        <span aria-hidden className="sfs-redact__bar" />
      </button>
    </>
  );
}
