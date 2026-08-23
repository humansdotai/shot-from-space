import Image from 'next/image';
import Link from 'next/link';

import { Band, Container } from '@/components/fui';
import { MosaicField } from '@/components/hero';
import { StyledPoster, type PosterSubject } from '@/components/poster';
import { frameAlt, getExampleMissionBySlug } from '@/lib/gallery';
import { CAPTURE_WINDOW_DAYS, REFUND_WINDOW_DAYS } from '@/lib/guarantees';
import { frameBySlug } from '@/lib/imagery';
import { cn } from '@/lib/utils';
import { MEASURE } from './geometry';
import { MissionEntry } from './MissionEntry';

/**
 * ==================================================================
 * 02 · HERO — the reference composition, carrying the funnel.
 * ==================================================================
 *
 * `section-middle.pdf` is one picture: a full-bleed aerial with no border of
 * its own, and the printed sheet lying on it, large and centred, the
 * photograph visible all round it. The poster is the subject; the picture is
 * the ground it lies on. Measured off the reference render at 1800 × 1011:
 *
 *   sheet          559 × 806 px — 31.1% of the page width
 *   sheet centre   x = 900 = the page's own centre, exactly
 *   air round it   34.5% of the width to the left AND to the right;
 *                  12.7% of the height above, 7.7% below
 *   picture        546 × 555 inside the sheet — 68.9% of its height, lower
 *                  edge at 0.696; the record is the remaining 30.4%
 *   mount margin   6px, 1.1% of the sheet's width, on three sides
 *
 * Those numbers were re-measured from the PDF for this band and they agree
 * with <MissionCarousel />'s to the pixel. THIS BAND DOES NOT INVENT A SECOND
 * VERSION OF THAT COMPOSITION. The sheet is <StyledPoster styleId="dossier"
 * formatId="F50" />, whose division `posterStyleRects()` returns as
 * 0.695 / 0.305 against the reference's 0.696 / 0.304 — one part in a
 * thousand — and the mount is the same stationary box that band 14 uses: a
 * `w-[var(--sheet)] aspect-[5/7]` div with every poster layer `absolute
 * inset-0` inside it, so both of its dimensions are definite before a poster
 * renders and nothing about the print can push the composition around.
 *
 * The two numbers the reference is NOT followed on are band 14's two, for
 * band 14's reasons: the sheet's outer aspect is 5:7 rather than the
 * reference's 0.694, because 5:7 is the 50 × 70 cm format this site sells and
 * one poster proportion across the whole page is worth more than 2.9% of
 * paper shape; and the 1.1% mount margin is a property of the print pipeline,
 * not of a band.
 *
 * ------------------------------------------------------------------
 * WHERE THE PICTURE COMES FROM
 * ------------------------------------------------------------------
 * The Landsat catalogue, and nothing else. `/imagery/aerial-pitch-2400.webp`
 * — the football pitch this page used to open on, one band lower — has no
 * recorded source (IMAGERY.md § UNRESOLVED PROVENANCE) and at roughly 5 cm
 * per pixel it resolves individual people, an order of magnitude finer than
 * the 30–75 cm this product actually sells. It is not on this page any more,
 * here or in the orbit-entry band, and nothing on the homepage references it.
 *
 * Which catalogue frame, and why, is argued at `GROUND_SLUG` below. Both the
 * ground and the sheet are that one frame at two crops, which is the
 * reference's own relationship — one place, seen wide, with the print of it
 * lying on the picture — and one download serves both.
 *
 * The sheet is captioned, and that caption is not decoration. A poster this
 * large at the top of the page would otherwise read as "this is what we make
 * of your address"; it is an archive frame at 30 m per pixel, so the label
 * says which mission, which sensor and which ground sample, and links the
 * public-domain credit the licence requires.
 *
 * ------------------------------------------------------------------
 * THE SHEET IS ON THE RIGHT, AND WHERE THE SPACING COMES FROM
 * ------------------------------------------------------------------
 * The owner asked for the print on the RIGHT of the screen rather than on the
 * page's centre line. That is one number to decide — the right-hand margin —
 * and it is derived here rather than chosen, because a margin picked by eye
 * is the thing that makes a composition look assembled.
 *
 * THE SHEET DOES NOT CHANGE SIZE, so the air cannot change either. The
 * reference is 31.06% sheet and 68.94% clear; the ladder below keeps the
 * sheet at 25.8–29.9% (the reference's 31.06% is a ceiling, see WHAT CHANGES
 * AT EACH WIDTH), so the clear width is fixed at 100% − `--sheet` whatever we
 * do with it. Moving the print right is therefore ONLY a decision about how
 * to re-split that one quantity, which the reference splits 50 / 50.
 *
 * THE SPLIT IS THE SHEET'S OWN. The composition contains exactly one
 * asymmetric division already, and the eye is reading it on the object in the
 * middle of the frame: the printed sheet is 0.696 picture over 0.304 record
 * (measured off `section-middle.pdf`, and `posterStyleRects()` returns
 * 0.695 / 0.305 for the style actually mounted). Re-splitting the clear width
 * in that ratio moves the print right without inventing a number, and it puts
 * the larger share on the side the copy is on:
 *
 *     left clear  = 0.696 × (100% − sheet)      the rail's side
 *     right clear = 0.304 × (100% − sheet)      the outer margin
 *
 * Written once, as `--air-r`, and measured from the VIEWPORT edge rather than
 * from the content column — the margin the eye reads is the one to the edge
 * of the screen. The grid pads itself by `--air-r` minus the column's own
 * gutter, `(100vw − 100%) / 2`, so the same expression holds at 1280 and 1440
 * (32px gutters) and at 1920 and 2400, where MEASURE caps the column and the
 * real gutter becomes 120px and 240px.
 *
 * What it comes out as, and what the rail becomes:
 *
 *   width   sheet   right clear        left clear   rail (col 1)
 *   1280    380     274  (21.4%)       626          554   (was 378)
 *   1440    430     307  (21.3%)       703          623   (was 425)
 *   1920    540     420  (21.9%)       960          792   (was 522)
 *   2400    620     541  (22.5%)      1239          951   (was 602)
 *
 * Right clear and left clear are measured from the viewport edges; the rail
 * is the measured width of the copy column. The `was` figures are the centred
 * grid's own arithmetic, `(container − sheet − 2 × gap) / 2`.
 *
 * The right margin lands at 21.3–22.5% of the page against the reference's
 * symmetric 34.5%, and the print's own centre moves from 50.0% to 63.8% of
 * the width at 1440. It is on the right and it is still a print lying on a
 * photograph — 307px of frame past its edge at 1440 — rather than a print
 * pinned to the screen edge, which is what a gutter-width margin would have
 * made it.
 *
 * ------------------------------------------------------------------
 * THE TENSION THIS BAND RESOLVES
 * ------------------------------------------------------------------
 * The hero also carries the funnel — clause, headline, the address field with
 * its `Your location` control, `Begin your mission`, the price microline and
 * the privacy line — and every one of those has to be inside the first
 * viewport at every width from 320 up (CONFIGURATOR.md §3.1). A large sheet
 * cannot push any of it below the fold.
 *
 * The 68.94% of clear width the reference leaves is what pays for that, and
 * moving the sheet right makes the payment larger rather than smaller:
 *
 *   >= 1280  the copy is a rail in the left clear and the sheet is the second
 *            cell of a `[1fr auto]` grid whose right padding is `--air-r`.
 *            The rail gains 176–349px over the centred version, which takes
 *            the headline from three lines to two at every width from 1280
 *            and lifts the whole funnel — measured at 1440, the privacy line
 *            ended at 730 with the sheet centred and ends at 648 now, 82px
 *            higher, on an 820px screen.
 *
 *   <  1280  a phone has no left margin to put a rail in, so the page is a
 *            column: clause, headline, field, button, microlines — and THEN
 *            the sheet, CENTRED on the same photograph, which continues
 *            behind and below it. It is centred and not right-aligned there
 *            on purpose: below 1280 this is not the reference composition at
 *            all but a stack, the copy above it is the full width of the
 *            column, and a 380px sheet pushed onto the column's right edge
 *            under full-width copy reads as fallen over rather than as
 *            placed. The offer is first and the object is the answer to it.
 *
 * The vertical air is derived from the sheet, never written twice: the
 * content column's padding at 1280 and up is `--sheet × 0.155`, which is
 * 11% of the sheet's own height — the reference's 12.7% / 7.7%, split evenly
 * because a screen's fold is not a page's trim.
 *
 * ------------------------------------------------------------------
 * WHAT CHANGES AT EACH WIDTH
 * ------------------------------------------------------------------
 *   320    clause hidden, headline at `text-display`, and the three
 *          microlines close from 12px to 8px — see THE FOLD below
 *   390    clause back, microline gaps back, headline still `text-display`
 *   768    headline at `text-hero`; field and button share a row; sheet 380
 *   1280   the rail moves into the LEFT CLEAR and the sheet moves right;
 *          sheet 380 (29.7% of width), right clear 274 (21.4%)
 *   1440   sheet 430 (29.9%), right clear 307 (21.3%)
 *   1920   sheet 540 (28.1%), right clear 420 (21.9%) — and the rail is now
 *          wide enough that <MissionEntry /> flips its own field and button
 *          into one row on its container query, which shortens the funnel
 *   2400   sheet 620 (25.8% — the viewport is only 1200 tall, so height
 *          binds before width does and the air is what is protected),
 *          right clear 541 (22.5%)
 *
 * Each of those is the largest sheet that still keeps its own plate label
 * inside the first viewport at that width's listed height; the reference's
 * 31.1% is the ceiling they are measured against, not a figure to overshoot
 * by cropping the object at the fold.
 *
 * ------------------------------------------------------------------
 * THE FOLD, AND WHAT IT COST
 * ------------------------------------------------------------------
 * 320 × 568 is the hard case: the announcement strip reserves the absolutely
 * positioned header and takes the first 113px, which leaves 455px for a
 * headline, a 56px field, a 52px button and three microlines. THREE things
 * give way there and only there:
 *
 *   the clause    dropped below 360
 *   the headline  `text-display` below 768 rather than `text-hero`
 *   the leading   8px instead of 12px between the three trailing microlines,
 *                 below 360 — the third is new this pass and it lives in
 *                 <MissionEntry />, under THE 320 CONCESSION, because the
 *                 lines belong to that control and not to this band
 *
 * The first two are existing roles from the type scale, not new sizes; the
 * third is one step down the same four-value vertical set the whole page uses
 * (geometry.ts). All three are bought back the moment there is room, and none
 * of them removes a word.
 *
 * The third was needed because the price line wraps to FOUR rendered lines at
 * 320 on this font stack rather than three, which put the privacy line at 569
 * on a 568px screen — one pixel out. That is a font-metric-dependent wrap, so
 * the gap is set for the worse of the two cases rather than for the one that
 * happened to be measured first. Measured after: 517–557. The full table at
 * all ten widths is in the report.
 *
 * `See a finished mission` is gone. The announcement strip DIRECTLY above
 * this band is a link to the same published mission; two links to one record
 * inside one screen is noise, and the 64px it took is 64px the privacy line
 * needed at 320.
 *
 * ------------------------------------------------------------------
 * LEGIBILITY
 * ------------------------------------------------------------------
 * White type over a photograph is a measurement, not an opinion, and the
 * measurement here is taken on the TEXT LINE — the rects a Range returns for
 * each text node — not on the element's padding box. That distinction is not
 * pedantry: measuring the padding box of a 44px link reports the ground
 * beside the words rather than behind them, and measuring with the
 * photograph hidden reports the wash against itself. Both mistakes were made
 * on the way to these numbers, and both said this band passed when it did
 * not.
 *
 * Three grounds, because the copy sits in three places:
 *
 *   < 1280   the copy is the whole column, so it carries its own flat plate
 *            — <RailGround />, positioned against the RAIL and not against
 *            the band. A wash written as a percentage of the band's height is
 *            a guess about where the copy ends, and at 768 that guess put the
 *            supporting sentence on open dune at 1.60 : 1.
 *   >= 1280  the copy is a rail in the left clear, so one horizontal wash
 *            carries all of it. The wash is `100% - var(--air-r)` wide, so it
 *            stops on the sheet's own right edge and the frame past the print
 *            is untouched; its plateau reaches 46.5–47.2% of the viewport,
 *            against a rail whose rightmost glyph is at 44.8% (1280), 44.2%
 *            (1440), 40.3% (1920) and 38.7% (2400).
 *
 *            THAT PLATEAU WAS WRONG BEFORE THIS PASS, and the note here said
 *            so incorrectly: it read "38% of the viewport" for a `via-38%`
 *            stop on an element `58%` as wide as the band, which is 22.0% of
 *            the viewport. The copy already overran it. Gradient stops are
 *            percentages of the gradient line, not of the screen.
 *   the label the sheet's plate label sits under the print, so the foot wash
 *            is what carries it: `h-[34%]` with the plateau at 70%, which is
 *            ~120px above the label at every width from 1280 up.
 *
 * Re-measured on the text line at all ten widths after the sheet moved
 * right, with the photograph and the mosaic composited and the glyphs painted
 * transparent so the sample is the ground and not the type: the worst single
 * pixel behind any line of this band's copy is 5.69 : 1 at 320, against the
 * 4.5 : 1 AA floor. Every width sits between 5.69 and 6.92. The full table is
 * in the report.
 *
 * The flat `bg-void/15` over everything is separate from all three: it is
 * what the white sheet is read against, and it is the same separation the
 * reference gets from a print lying in daylight.
 *
 * Nothing in the copy is set in `ink-faint`. Over a photograph the faint role
 * cannot be brought to 4.5:1 without a wash heavy enough to delete the
 * picture, so the microlines are `ink-dim` and separate by size instead.
 *
 * ------------------------------------------------------------------
 * THE INSTRUMENT STRIP
 * ------------------------------------------------------------------
 * Unchanged: four facts along the foot of the band on solid void, separated
 * from the picture by a single hairline, so their contrast is a fact rather
 * than a bet on what the sensor returned in that corner. Every number is one
 * the rest of the site is bound to — ground sample and capture window from
 * /how-it-works, the re-task and the refund from `lib/guarantees.ts`, which
 * /legal/terms is written against.
 */

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

/**
 * The sheet's width, declared once per breakpoint. Everything else on the
 * band — the air above and below it, the height of the picture — is derived
 * from it in CSS, so the two can never drift.
 *
 * The ladder below 768 is band 14's exactly: under about 300px the poster's
 * own miniature type starts to collide, which is the floor, and at 320 a
 * `100vw - 3.5rem` sheet is 264px with 28px of photograph showing each side.
 */
/**
 * THE GROUND, AND THE SHEET LYING ON IT — one catalogue frame, two crops.
 *
 * `lisse-nl` is `Flower Power in the Netherlands`: a single Landsat 8 OLI
 * acquisition, near-natural colour, straight down. Three reasons it is this
 * frame and not another:
 *
 *   IT IS ONE ACQUIRED FRAME. The sheet prints `ONE FRAME WAS COLLECTED`
 *   over whatever picture it is given. `hero-los-angeles`, which this band
 *   used to mount, is a Landsat frame DRAPED OVER SRTM ELEVATION — two
 *   instruments, two dates, a visualisation rather than a capture
 *   (IMAGERY.md, `acquired.basis`). It is a fine hero picture and a false
 *   poster, and the poster is what this band is now for.
 *
 *   IT IS NADIR. The reference's ground is straight down; the LA frame is an
 *   oblique perspective, which is the one thing about the old hero that read
 *   as a landscape photograph rather than as a satellite pass.
 *
 *   IT IS THE BRIGHTEST FRAME IN THE CATALOGUE, and this band has to put a
 *   white sheet on it under a legibility wash. A dark frame under a wash is
 *   not a photograph any more.
 *
 * Its character is also the reference's: fields, water, roads and a few
 * buildings, seen from directly above. The sheet shows the same coast at a
 * tighter crop — one place, seen wide, with the print of it lying on the
 * picture — and one download serves both.
 */
const GROUND_SLUG = 'lisse-nl';

/**
 * THE RIGHT-HAND MARGIN, in one expression.
 *
 * `--air-r` is the clear width between the sheet's right edge and the
 * VIEWPORT's right edge — 0.304 of everything the sheet does not occupy. The
 * 0.304 is not a taste: it is the record's share of the printed sheet, the
 * one asymmetric division this composition already contains. See the head of
 * this file. It is declared beside `--sheet` because it is a function of
 * `--sheet` and of nothing else, so the two can never drift.
 *
 * Only from 1280. Below that the sheet is centred under the copy and there is
 * no margin to derive.
 */
const AIR_RIGHT = 'min-[1280px]:[--air-r:calc(0.304_*_(100vw_-_var(--sheet)))]';

const SHEET = [
  '[--sheet:min(100vw_-_3.5rem,300px)]',
  'min-[430px]:[--sheet:min(100vw_-_4rem,340px)]',
  'min-[768px]:[--sheet:380px]',
  'min-[1280px]:[--sheet:380px]',
  'min-[1440px]:[--sheet:430px]',
  'min-[1920px]:[--sheet:540px]',
  'min-[2400px]:[--sheet:620px]',
].join(' ');

/** What the browser should fetch for the sheet's picture at each width. */
const SHEET_SIZES =
  '(min-width: 2400px) 620px, (min-width: 1920px) 540px, (min-width: 1440px) 430px, (min-width: 1280px) 380px, (min-width: 768px) 380px, 100vw';

/** 5:7 — the 50 × 70 cm catalogue format. Fixed, so the mount cannot move. */
const MOUNT_RATIO = '5 / 7';

/**
 * Facts, not slogans — and every number comes from lib/guarantees.ts, which
 * /legal/terms is also written against. The refund row must keep "usable":
 * "No frame at 60 days" promises more than the contract does.
 */
const INSTRUMENT = [
  { label: 'Ground sample', value: '≈ 0.50 m / px' },
  {
    label: 'Capture window',
    value: `${CAPTURE_WINDOW_DAYS.min} — ${CAPTURE_WINDOW_DAYS.max} days`,
  },
  { label: 'Cloud-blocked pass', value: 'Re-tasked free' },
  { label: `No usable frame at ${REFUND_WINDOW_DAYS} days`, value: 'Refunded in full' },
];

/**
 * THE COPY'S OWN GROUND, BELOW 1280.
 *
 * Two layers, positioned against the RAIL rather than against the band:
 *
 *   the plate   `-top-24 bottom-0`, flat `void/86`, bled to both screen
 *               edges. It starts 96px above the rail, which is more than the
 *               band's own top padding at every width, so its upper edge is
 *               clipped by the Band and there is no seam to see — it simply
 *               continues the announcement strip's void.
 *   the fade    the 96px directly under the rail, `void/86` to transparent,
 *               so the ground releases the photograph instead of ending on a
 *               line.
 *
 * 86% is a measurement, not a taste. `ink-dim` is rgb(154,160,166), and over
 * a wash of `a` on the brightest ground a sensor can return — pure white —
 * the contrast is 4.99 : 1 at a = 0.86 and 4.14 : 1 at a = 0.80. So 0.86 is
 * the floor that holds against ANY frame, not just this one, which is what a
 * band whose picture may be swapped needs.
 *
 * `-z-10`: the Band's content sits in one `relative z-10` wrapper, so a
 * negative z inside it paints under every static child of that wrapper and
 * still over the photograph, which is a plane below. No extra stacking
 * context, no wrapper element, and the copy stays exactly where it was.
 */
function RailGround() {
  return (
    <div aria-hidden className="pointer-events-none min-[1280px]:hidden">
      <div className="absolute -top-24 bottom-0 left-[calc(50%_-_50vw)] -z-10 w-screen bg-void/86" />
      <div className="absolute top-full left-[calc(50%_-_50vw)] -z-10 h-24 w-screen bg-linear-to-b from-void/86 to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The band                                                            */
/* ------------------------------------------------------------------ */

export function HeroBand() {
  /* The archive mission for the very frame this band is lying on. */
  const mission = getExampleMissionBySlug(GROUND_SLUG);
  const ground = frameBySlug(GROUND_SLUG);

  const subject: PosterSubject | null = mission
    ? {
        missionCode: mission.code,
        /* Dated to the day by its source record and no finer. Handing the
           sheet `…T00:00:00Z` would print a time of day nobody recorded, so
           the stamp is dropped and the record dashes the clock. */
        capturedAt: null,
        lat: mission.lat,
        lon: mission.lon,
        locationLabel: mission.locationLabel,
        orbit: mission.orbit,
        /* ~1.1 km — the same fix every other reader of this frame gets. */
        coordDp: 2,
      }
    : null;

  if (!ground) return null;

  return (
    <Band
      tone="dark"
      top="flush"
      bottom="flush"
      /* THE OPENING RESERVE.
         `top="flush"` is still correct for the PICTURE: the frame runs to
         y = 0 and passes under the site bar, which is the whole reason
         that bar is a translucent plate over `backdrop-filter: blur(25px)`
         — over a flat fill the blur has nothing to sample and degrades to
         a 10% tint.
         The COPY cannot start there. `--site-open-h` is the bar plus the
         announcement strip overlaid beneath it (`AnnounceBand`), stated
         once in `app/globals.css` so neither file carries a copy of the
         other's height. The photograph is unaffected: its layer is
         `absolute inset-0`, which resolves against this Band's PADDING
         box, so the reserve moves the words and not the picture. */
      className={cn('isolate overflow-hidden pt-[var(--site-open-h)]', SHEET, AIR_RIGHT)}
    >
      {/* ---------- The photograph, edge to edge and with no border ------- */}
      <div aria-hidden className="absolute inset-0 z-0">
        <Image
          src={ground.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
          /* The raster samples this element directly — no second download. */
          data-mosaic-source=""
        />

        {/* The sensor's own sampling raster, which lights up and cascades
            where it is touched. `pointer-events: none` always, one static
            frame under `prefers-reduced-motion`, and it is drawn UNDER the
            washes below so a cascade running behind the headline cannot
            interfere with the type. */}
        <MosaicField className="z-[1]" />

        {/* ---------- The washes ----------------------------------------
            Band 14's, and the strengths are measurements — see § LEGIBILITY
            at the head of this file. */}
        <div className="absolute inset-0 z-[2] bg-void/15" />

        {/* From 1280 the copy is a rail in the left clear, so one horizontal
            wash carries all of it and the frame past the print stays open.

            ITS WIDTH IS THE LAYOUT'S, NOT A FRACTION PICKED BY EYE. `100% -
            var(--air-r)` is the band minus the right-hand margin, so the wash
            ends on the sheet's own right edge at every width: 78.6% at 1280,
            78.7% at 1440, 78.1% at 1920, 77.5% at 2400. Everything past the
            print — the 21.3–22.5% of frame the print is placed against — is
            untouched photograph.

            THE PLATEAU WAS SHORT, AND IT WAS SHORT BECAUSE OF A UNIT.
            Gradient stops are percentages of the GRADIENT LINE, which is the
            element, not the viewport. The previous stop list ran the 84%
            plateau to `38%` of an element that was itself `58%` of the band —
            22.0% of the viewport, not the 38% the note beside it claimed, and
            the copy already ran past it. Measured on the text line at 1440,
            the supporting sentence sat at 2.68 : 1 against a 4.5 floor.
            `via-60%` is now measured against where the copy actually ends: the
            rail's rightmost glyph is at 44.8% of the viewport at 1280, 44.2%
            at 1440, 40.3% at 1920 and 38.7% at 2400, and 60% of this element
            is 47.2 / 47.2 / 46.9 / 46.5%. Every string clears the plateau at
            every width, with the smallest margin 1.7% of the viewport.

            BELOW 1280 THERE IS NO BAND-PROPORTIONAL WASH AT ALL, and that is
            a correction rather than an omission. A wash written as a
            percentage of the band's height is a guess about where the copy
            ends, and the guess was wrong: at 768 the supporting sentence sat
            where a 50%-tall wash had already faded to a third of its
            strength, on open dune, at 1.60 : 1. The copy carries its own
            ground now — see <RailGround /> — so the two cannot disagree. */}
        <div className="absolute inset-y-0 left-0 z-[2] hidden bg-linear-to-r from-void/94 from-3% via-void/84 via-60% to-transparent min-[1280px]:block min-[1280px]:w-[calc(100%_-_var(--air-r))]" />

        {/* And the two edges, so a bright frame does not butt straight into
            the void of the announcement strip above or the instrument strip
            below. The foot one is also what the sheet's plate label is read
            against: its plateau reaches 70% of its own height, which is
            ~120px above the label at every width from 1280 up. */}
        <div className="absolute inset-x-0 top-0 z-[2] h-[12%] bg-linear-to-b from-void/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 z-[2] h-[34%] bg-linear-to-t from-void from-4% via-void/84 via-70% to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-[560px] flex-col min-[768px]:min-h-[640px]">
        <Container
          className={cn(
            'flex flex-1 flex-col justify-center pt-6 pb-10',
            'min-[768px]:pt-16',
            /* 11% of the sheet's own height above it and below it — the
               reference's air, derived from `--sheet` so it can never drift
               from the object it frames. */
            /* 1280 is the shortest desktop on the list — 800px — and it is
               also where the rail is narrowest and the headline runs to four
               lines. It gets less air above the sheet than the rest, because
               the fold outranks the reference here and nowhere else. */
            'min-[1280px]:pt-[calc(var(--sheet)_*_0.13)] min-[1280px]:pb-[calc(var(--sheet)_*_0.12)]',
            'min-[1440px]:pt-[calc(var(--sheet)_*_0.19)]',
            MEASURE,
          )}
        >
          <div
            className={cn(
              /* THE PLACEMENT. Two cells — the rail, then the sheet — and the
                 sheet's distance from the screen's right edge is stated as
                 padding rather than as a third track, so there is exactly one
                 number in this layout and it is `--air-r`.

                 `(100vw - 100%) / 2` is the column's own gutter, computed
                 rather than named: `--gutter-shell` is 32px at every
                 breakpoint, but MEASURE re-caps this Container at 1680 and
                 1920, so above 1440 the real gutter is 120px and 240px and a
                 named token would be wrong there. 100% is the grid's
                 containing block — the content column — so the subtraction
                 turns a viewport-relative margin into a column-relative one
                 at every width without a table. */
              'min-[1280px]:grid min-[1280px]:grid-cols-[minmax(0,1fr)_auto]',
              'min-[1280px]:pr-[calc(var(--air-r)_-_(100vw_-_100%)/2)]',
              /* `items-start`, not `items-center`: the rail is taller than the
                 sheet at every width from 1280, so centring it hangs the
                 clause above the sheet's top edge and drops the privacy line
                 40px nearer the fold for nothing. Aligned to the top, the
                 clause sits on the sheet's own top edge — which is a line the
                 composition already has — and the whole funnel moves up. */
              'min-[1280px]:items-start min-[1280px]:gap-x-10 min-[1440px]:gap-x-12',
            )}
          >
            {/* ---------- The rail ------------------------------------- */}
            <div className="relative min-[1280px]:col-start-1 min-[1280px]:row-start-1">
              <RailGround />
              {/* Dropped below 360 and there only: at 320 the announcement
                  strip has already taken 113 of 568px and the privacy line
                  needs the 26px this costs. */}
              <p className="hidden font-mono text-tele-s uppercase ink min-[360px]:block">
                On-demand access to orbit
              </p>

              {/* `text-display` below 768 is the other thing that gives way
                  for the fold — an existing role from the scale, not a new
                  size, and `text-hero` returns the moment there is room. */}
              <h1 className="mt-3 max-w-[16ch] text-display ink min-[360px]:mt-5 min-[768px]:text-hero min-[1920px]:max-w-[18ch]">
                Point a satellite at any address on Earth.
              </h1>

              <MissionEntry className="mt-6 min-[768px]:mt-8" inputId="hero-address" />

              {/* The supporting sentence follows the entry at every width.
                  Reading order in the DOM is the visual order, and the
                  sentence reads as the caption the entry turns it into. */}
              {/* "AS A PRINT" IS LOAD-BEARING, and it is here because of a
                  measurement rather than a preference. At 1440 the sheet
                  beside this column says what arrives; at 390 the sheet is
                  about 640px below the fold, so for most visitors these
                  three sentences are the entire description of the product
                  and "comes back to you" does not separate a printed object
                  from a JPEG, a PDF or a login. Three words, no new claim —
                  the print is what `lib/pricing` charges for and what
                  `lib/integrations/gelato.ts` posts. */}
              {/* ONE SENTENCE, NOT THREE. The clause that closed this
                  paragraph — "with the record of how it was taken" — is
                  the subject of an entire band further down the page
                  (`RecordBand`, which prints a real mission's record in
                  full), and it was buying a third line in the first
                  viewport to preview something the page goes on to prove.
                  "AS A PRINT" STAYS, and it stays for the measurement in
                  the note above: at 390 the sheet beside this column is
                  about 640px below the fold, so this sentence is the only
                  thing separating a printed object from a JPEG. */}
              <p className="mt-8 max-w-[52ch] text-body ink-dim">
                Name the target. A camera in orbit is tasked to photograph it on its next clear
                pass, and the frame comes back to you as a print.
              </p>
            </div>

            {/* ---------- The sheet ------------------------------------
                The box, not the poster, holds the geometry: both dimensions
                are definite here, so no print can move it. */}
            {subject && mission ? (
              <figure className="m-0 mt-12 flex flex-col items-center min-[1280px]:col-start-2 min-[1280px]:row-start-1 min-[1280px]:mt-0">
                <div
                  data-mount
                  className="relative w-[var(--sheet)] bg-paper"
                  style={{ aspectRatio: MOUNT_RATIO }}
                >
                  <StyledPoster
                    styleId="dossier"
                    formatId="F50"
                    frame="UNFRAMED"
                    subject={subject}
                    image={{
                      src: mission.src,
                      alt: frameAlt(mission),
                      sizes: SHEET_SIZES,
                    }}
                    detail="print"
                    className="absolute inset-0"
                  />
                </div>

                {/* The plate label. It is here because a sheet this large at
                    the top of the page would otherwise read as a picture of
                    the reader's own address; this is an archive frame at 30 m
                    per pixel and the label says so. */}
                <figcaption className="mt-3 flex w-[var(--sheet)] flex-wrap items-center justify-between gap-x-4 font-mono text-tele-s uppercase text-paper">
                  <span>
                    Example print
                    <span className="mx-2 opacity-60">/</span>
                    <span data-telemetry>{mission.code}</span>
                    <span className="mx-2 opacity-60">·</span>
                    {mission.orbit.gsdM} m per pixel
                  </span>
                  <Link
                    href="/legal/imagery"
                    /* A standalone line rather than a link inside prose, so
                       it takes the 44px target rather than the inline
                       exemption. */
                    className="inline-flex min-h-11 items-center underline decoration-paper/45 underline-offset-4 transition-house hover:decoration-current"
                  >
                    NASA / USGS — public domain
                  </Link>
                </figcaption>
              </figure>
            ) : null}
          </div>
        </Container>

        {/* The instrument strip. Solid ground under the picture. */}
        <div className="relative bg-void">
          <Container className={MEASURE}>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-t rule-ground py-5 min-[768px]:grid-cols-4">
              {INSTRUMENT.map((fact) => (
                <div key={fact.label} className="flex flex-col gap-2">
                  <dt className="font-mono text-tele-xs uppercase ink-faint">{fact.label}</dt>
                  <dd data-telemetry className="font-mono text-tele uppercase ink">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Container>
        </div>
      </div>
    </Band>
  );
}
