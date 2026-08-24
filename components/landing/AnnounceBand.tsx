import Link from 'next/link';
import { Band, Container } from '@/components/fui';
import { Arrow } from './Arrow';
import { MEASURE } from './geometry';
import { EXAMPLE } from './example-mission';
import { cn } from '@/lib/utils';

/**
 * 01 · ANNOUNCEMENT — dark, full width, one line, one link (SYSTEM-V3 §5.1).
 *
 * The thinnest band on the page and the first thing under the lockup. It
 * carries exactly one true statement: the example mission is published in
 * full, before anyone has paid for one. That is the only kind of thing this
 * strip is allowed to say — there is no launch, no discount and no customer
 * count to put in it, and a strip with nothing true to carry is deleted
 * rather than filled.
 *
 * ------------------------------------------------------------------
 * WHY THIS STRIP IS AN OVERLAY AND NOT A BAND
 * ------------------------------------------------------------------
 * This file's own header note already said it: "the strip is chrome on
 * the hero, not a band before it." It was not built that way. It was an
 * opaque dark band in flow, reserving a hard-coded copy of the header's
 * height, and the effect of that was to push the hero photograph below
 * the fold of the bar — so the site bar, which is a translucent plate
 * over `backdrop-filter: blur(25px)`, had nothing behind it but a flat
 * near-black fill. A blur with a flat ground behind it is not a blur;
 * it is a 10% tint. The floating plate only earns its keep over
 * imagery, and the imagery was being held 130px below it.
 *
 * So the strip is now what the note always claimed: `position:
 * absolute` at the top of the document — the same anchoring
 * `SiteHeader` uses, resolved against the initial containing block, so
 * it needs no positioned ancestor and no wrapper in `app/page.tsx` —
 * transparent, sitting ON the hero, one row below the bar. The hero
 * photograph now starts at y = 0 and runs under both.
 *
 * Three consequences, all deliberate:
 *
 *   · `pointer-events: none` on the strip, `auto` on the link. The
 *     strip spans the full width of the picture and would otherwise
 *     eat every click on the top of the hero.
 *   · No `border-b`. A hairline across a photograph reads as damage to
 *     the photograph. The bar's own scrim is what separates the two.
 *   · THE LINE CARRIES ITS OWN GROUND, and hugs it. Measured on the
 *     text line at seven widths, a full-width announcement over this
 *     frame ran to 2.23 : 1 at 1280 and 2.38 : 1 at 1440 — the line
 *     starts on dark ocean and ends on sunlit farmland, and no wash
 *     weak enough to leave the photograph visible can carry it. So the
 *     link is `inline-flex`, it is only as wide as its own words, and
 *     it stands on 86% of void.
 *
 *     86% is the same measurement `HeroBand`'s rail ground is built on:
 *     `--ink` over a wash of 0.86 on the brightest ground a sensor can
 *     return — pure white — is 4.99 : 1, so the line holds against ANY
 *     frame rather than against this one. `backdrop-filter: blur(25px)`
 *     is the site bar's, unchanged: the strip is the bar's smaller
 *     sibling floating on the same picture, not a band drawn across it.
 *
 *     THE RADIUS IS 8px, AND IT IS DERIVED FROM THE BAR'S 12px.
 *     It was 3px, which was right when the bar was 3px too. The owner
 *     asked for round corners and the bar is now `border-radius: 12px`
 *     on a 70px plate (`app/globals.css → ROUND CORNERS`), so 3px here
 *     stopped being the sibling value and started being a mismatch —
 *     two plates on one photograph, one square-cornered, one round.
 *
 *     A SIBLING MATCHES THE PROPORTION, NOT THE NUMBER. The bar's
 *     radius is 17.1% of its short side (12 / 70). This strip measures
 *     44px tall at every width, so the same proportion is 7.54px, and
 *     the nearest whole pixel is 8 — 18.2% of the short side, one
 *     point rounder than the bar and half a pixel of arc away from it.
 *     Copying 12 across would have been 27% of a 44px object: the
 *     smaller plate visibly rounder than the larger one it hangs from,
 *     which is the fault this fixes rather than a version of it.
 *
 *     IF THE BAR'S RADIUS MOVES AGAIN, this one is 44/70 of it —
 *     0.629 × the bar, to the nearest pixel. That is the whole rule.
 *
 *     It knowingly departs from `--radius-action` (3px), which is what
 *     the design system gives a control and what this link would take
 *     anywhere else on the site. Here the strip is read as the bar's
 *     sibling before it is read as a link, and the two plates sitting
 *     15px apart on one picture is the stronger relationship.
 *
 * The top offset is `var(--site-bar-h)` — the bar's own published
 * height, from `app/globals.css → THE SITE BAR` — rather than a copy of
 * it. The copy is what went stale last time.
 *
 * ------------------------------------------------------------------
 * ONE LINE, AT EVERY WIDTH
 * ------------------------------------------------------------------
 * The line is written three times — shortest below 360, short to 1024, full
 * from 1024 — rather than being allowed to wrap or to truncate. A two-line
 * announcement strip is not an announcement strip, and a truncated one is
 * worse: it ends in an ellipsis where the record's name should be.
 *
 * Both switch points are measurements, not guesses: the full line needs an
 * 827px plate and the column is only 704px at 768, where it truncated —
 * `…read th…` in place of the record's name. It fits from 1024.
 *
 * The 360 variant is new and it is a measurement. Now that the line stands
 * on its own plate rather than on a full-width band, it has 256px of column
 * minus 28px of plate padding, a 12px gap and a 14px mark to live in — 202px
 * — and `Mission 32BF — read the file` needs about 230. All three say the
 * same true thing: the example mission is published, and this goes to it.
 */
export function AnnounceBand() {
  return (
    <Band
      top="flush"
      bottom="flush"
      className={cn(
        // `on-dark` rather than `tone="dark"`: the tone WITHOUT a ground,
        // because the ground here is the photograph.
        'on-dark pointer-events-none absolute inset-x-0 top-0 z-30',
        'pt-[var(--site-bar-h)]',
      )}
    >
      <Container className={MEASURE}>
        <Link
          href={EXAMPLE.href}
          className={cn(
            'group pointer-events-auto inline-flex w-fit max-w-full min-h-11 items-center gap-x-3',
            // Its own ground, hugging its own words. See the note above.
            // A BORDER, not an outline: `:focus-visible` in the base layer
            // paints an outline, and an outline utility here would win the
            // cascade and swallow the focus ring. Measured — it did.
            // 8px, not `--radius-action`. See THE RADIUS IS 8px above.
            'rounded-[8px] border px-3.5 py-2 backdrop-blur-[25px]',
            'border-[color-mix(in_srgb,var(--ink)_14%,transparent)]',
            'bg-[color-mix(in_srgb,var(--color-void)_86%,transparent)]',
            'transition-house hover:text-[color:var(--accent)]',
          )}
        >
          <span className="hidden font-mono text-tele-s uppercase ink-faint transition-house group-hover:text-[color:var(--accent)] min-[768px]:inline">
            Example mission
          </span>

          <span className="min-w-0 flex-1 truncate text-body ink transition-house group-hover:text-[color:var(--accent)]">
            <span className="min-[360px]:hidden">Read mission {EXAMPLE.code}</span>
            <span className="hidden min-[360px]:inline min-[1024px]:hidden">
              Mission {EXAMPLE.code} — read the file
            </span>
            <span className="hidden min-[1024px]:inline">
              Mission {EXAMPLE.code} is published in full — read the whole record before you
              commission one.
            </span>
          </span>

          <Arrow className="ink-faint transition-[color,transform] group-hover:text-[color:var(--accent)]" />
        </Link>
      </Container>
    </Band>
  );
}
