'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { clsx as cn } from 'clsx';
import { RULE } from '@/components/purchase/fields';

/**
 * THE CONFIGURATOR SHELL.
 *
 * ------------------------------------------------------------------
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE
 * ------------------------------------------------------------------
 * The primary action is visible without scrolling, on every section, at
 * every width. CONFIGURATOR.md §3.1. Everything below is in service of
 * that and nothing here may be changed in a way that breaks it.
 *
 * It is enforced STRUCTURALLY rather than by pinning something over the
 * content: the shell is exactly one viewport tall and does not scroll,
 * the panel is a flex column inside it, the controls are the only part
 * that scrolls, and the foot is a sibling of the scroller. A foot that
 * is a sibling of a scroller cannot be scrolled away — there is no
 * `position: fixed`, no z-index race, and nothing to go wrong when a
 * mobile browser resizes the viewport under it.
 *
 * ------------------------------------------------------------------
 * THE TWO SHAPES
 * ------------------------------------------------------------------
 *   ≥ 1024   a persistent split. Preview 62–64%, panel 36–38%, both
 *            filling the viewport, panel scrolling internally.
 *   < 1024   ONE SCROLLING DOCUMENT. See `stacked` below.
 *
 * ------------------------------------------------------------------
 * THE PHONE SHAPE CHANGED, ON THE OWNER'S INSTRUCTION
 * ------------------------------------------------------------------
 * It used to be the second half of the rule above: preview pinned on top
 * at 38–46svh, an internally scrolling control region, and the price and
 * CTA held in the thumb zone. The owner replaced it:
 *
 *   "on mobile make the purchase payment as a scrollable page with all
 *    the elements on a page with not fixed buttones or components just
 *    like you have on mapiful.com … on mobile the purchase page should
 *    have white background and black text."
 *
 * So below 1024 there is now ONE ordinary document that scrolls, every
 * section stacked down it in order, nothing pinned and nothing sticky,
 * on paper with black type. The price and the primary action are the
 * last things in the document rather than a bar over it.
 *
 * THIS IS A DELIBERATE DEPARTURE FROM CONFIGURATOR.md §3.1, which says
 * the primary action must be visible without scrolling at every width.
 * That rule was written against a TABBED wizard, where an action below
 * the fold is an action a buyer never learns exists. A single linear
 * document is a different object: there is one path, the buyer travels
 * it, and the action sits at the end of it where the decisions finish —
 * which is why every long-form checkout in the category works this way.
 * The rule still holds in full at ≥ 1024, where the split makes the
 * panel a viewport of its own.
 *
 * Measured on the reference the owner named: mapiful.com's editor at
 * 390px is a 3819px document, i.e. one long scroll with every option
 * group stacked. Their tab rail and their ADD TO CART bar are `sticky`;
 * ours are not, because the instruction was explicit about that.
 *
 * The split starts at 1024 and not at 768 deliberately. At 768 a 38%
 * panel is 292px, which is narrower than the phone layout it replaced —
 * a split that makes the controls WORSE is not a split, it is a boast.
 *
 * ------------------------------------------------------------------
 * WHY THE PANEL HAS A TOP PADDING AT lg AND ABOVE
 * ------------------------------------------------------------------
 * <SiteHeader /> is `absolute` over the top of every page and its right
 * cluster — the nav and `Start a mission` — lands over the panel column
 * once the layout splits. The padding is exactly the header's own row
 * height at each step (76 / 88 / 96 / 112 / 124), so the rail begins
 * where the header ends and the two never overlap. Below lg the header
 * sits over the PREVIEW, which is a photograph and is where it is
 * designed to sit.
 *
 * The class name `mission-configurator` is not decoration: `/mission`
 * uses it in a `:has()` rule to take the site footer out of the document,
 * because a page that is exactly one viewport tall cannot also have a
 * footer under it without scrolling.
 */
export function Configurator({
  sectionKey,
  preview,
  previewKind,
  rail,
  foot,
  children,
  stacked = false,
}: {
  /**
   * Which section is open. Only used to put the panel back to the top
   * when it changes: the scroller is ONE element that outlives every tab
   * change, so without this a buyer who scrolled to the foot of Review
   * and then opened Confirmation would land in the middle of it. The old
   * sequence did the same thing with `window.scrollTo` on every screen,
   * and for the same reason.
   */
  sectionKey: string;
  /** The artefact — the reveal frame, the map, the poster, the dossier. */
  preview: ReactNode;
  /** Which artefact is up. Only the map asks for more of a phone screen. */
  previewKind: string;
  /** The tabs. */
  rail: ReactNode;
  /** Price and primary action. Rendered inside the panel, below the scroller. */
  foot: ReactNode;
  /** The active section's controls. */
  children: ReactNode;
  /**
   * Below 1024. One scrolling document, nothing pinned, paper ground —
   * see THE PHONE SHAPE above. When true `preview`, `rail` and `foot`
   * are IGNORED here: the caller has already placed them in `children`,
   * in reading order, because in a linear document their position is
   * part of the content rather than part of the frame.
   */
  stacked?: boolean;
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // The stacked document has no scroller of its own — it IS the
    // document — and it must not be scrolled to the top when the section
    // changes, because on that shape the section changes as a RESULT of
    // the buyer scrolling.
    if (stacked) return;
    const el = scroller.current;
    if (el) el.scrollTop = 0;
  }, [sectionKey, stacked]);

  if (stacked) {
    return (
      <div
        className={cn(
          // The class the `:has()` rule in `app/mission/page.tsx` looks
          // for. It is still here, and that rule is now scoped to
          // `min-width: 1024px` — a document that scrolls must keep its
          // footer and must not have `overflow: hidden` put on it.
          'mission-configurator mission-configurator-stacked',
          // PAPER, AND BLACK TYPE. `surface-light` flips every token —
          // ground, ink, rules, accent — so every control inside inherits
          // the inversion without a single one of them being told about
          // it. This is the same mechanism <PreviewStage /> already uses
          // for the object column at every width.
          'surface-light w-full bg-[color:var(--ground)] text-[color:var(--ink)]',
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'mission-configurator surface-dark relative flex w-full flex-col overflow-hidden',
        // `h-full` inside the flex column `/mission` makes of the
        // document; `100dvh` is the floor for any other host.
        'h-[100dvh] max-h-full',
        'lg:flex-row',
      )}
    >
      {/* --- The object -------------------------------------------- */}
      <div
        data-preview={previewKind}
        className={cn(
          // THE PAPER HALF. The object column is `surface-light` from
          // the inside (see <PreviewStage />); the ground is stated here
          // too so a tab change never flashes void behind the paper.
          'relative w-full shrink-0 overflow-hidden bg-paper',
          /* 38svh, not 56. At 320x568 the shell is 497px once the MOCK MODE strip
             takes its 71, and the reserve below has to hold the rail, the
             scrolling controls AND the pinned price + CTA. At 56svh the
             scroller collapsed to 0-34px: the CTA rule passed, the price and
             button were visible, and not one option control in any section
             could be reached by a pointer. A flow nobody can answer is worse
             than one whose button is below the fold.
             This is a phone-only correction; `lg:` below overrides both. */
          'h-[38svh] min-h-[200px]',
          // THE MAP IS A TOOL, NOT A PICTURE. <FrameOnMap /> carries its
          // own attribution, a telemetry row and a reference note under
          // the basemap — roughly 170px of them — so at the standard
          // allowance the map itself is a strip and the note is cut
          // mid-sentence. It gets the top of the phone's allowance.
          'data-[preview=map]:h-[46svh]',
          // …and never enough of it to squeeze the rail and the foot. The
          // primary action is not negotiable against a preview: 13rem is
          // the rail, a readable stub of controls, and the foot. It was
          // 14rem; the preview column now carries a title and a telemetry
          // strip that a buyer has to be able to read, and the CTA table
          // is re-measured at 320 / 390 / 768 / 1280 / 1440 / 1920 —
          // every one of them passes at scrollY 0.
          'max-h-[calc(100%-19rem)]',
          'lg:h-full lg:max-h-none lg:min-h-0 lg:w-[62%] xl2:w-[64%]',
          'lg:data-[preview=map]:h-full lg:data-[preview=map]:max-h-none',
        )}
      >
        {preview}
      </div>

      {/* --- The controls ------------------------------------------ */}
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col border-t bg-[color:var(--ground-raised)]',
          'lg:border-l lg:border-t-0',
          RULE,
        )}
      >
        <div
          className={cn(
            'shrink-0',
            /* THE HEADER RESERVE IS A `lg` RESERVE, AND ONLY A `lg` ONE.
               <SiteHeader /> is `absolute` at the top of the document, so it
               lands on the panel column only once the layout SPLITS and the
               panel reaches y = 0. Below `lg` the panel starts under the
               preview — measured, at 320/360/390/430/768 the header's box and
               the panel's box do not intersect at all — and the padding was
               70px of dead space at the top of every phone panel, taken
               straight off the only scrolling region on the surface. At
               320 x 568 that was 70 of the scroller's 151 usable pixels:
               nearly half of the space a buyer answers the flow in, reserved
               for something that is not there. The note above this component
               already said the padding was "at lg and above"; the class did
               not say it. */
            'lg:pt-[var(--site-bar-h)] xl2:pt-28 xl3:pt-[124px]',
          )}
        >
          {rail}
        </div>

        {/* The ONLY scrolling region on the page. */}
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="px-5 py-6 sm:px-6 xl:px-8 xl:py-8 xl2:px-10">{children}</div>
        </div>

        <div className={cn('shrink-0 border-t', RULE)}>{foot}</div>
      </div>
    </div>
  );
}
