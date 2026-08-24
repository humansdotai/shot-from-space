'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Band, Button, ButtonArrow, Container } from '@/components/fui';
import { StyledPoster, type PosterSubject } from '@/components/poster';
import { frameAlt, listExampleMissions, titleCase, type ExampleMission } from '@/lib/gallery';
import type { PosterStyleId } from '@/lib/poster/styles';
import type { FormatId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MEASURE } from './geometry';

/**
 * ==================================================================
 * THE MISSION CAROUSEL — one mount, thirteen files.
 * ==================================================================
 *
 * The composition is `section-middle.pdf`, measured: a full-bleed aerial with
 * no border of its own, and the printed sheet lying on it — frame above,
 * record below — centred on the picture. Measured off the reference render at
 * 1800 × 1011:
 *
 *   sheet          559 × 806 px, centre x = 900 = the page's own centre
 *   sheet width    31.1% of the page width
 *   picture        546 × 555, i.e. 68.9% of the sheet's height, and its
 *                  lower edge at 0.696; the record is the remaining 30.4%
 *   mount margin   6px, 1.1% of the sheet's width, on three sides
 *
 * That DIVISION is `dossier`: `posterStyleRects('dossier','F50')` returns a
 * picture of 0.695 against the reference's 0.696 and a record of 0.305
 * against its 0.304 — one part in a thousand. So the sheet here is not drawn,
 * it is <StyledPoster /> at the composition that already prints to it.
 *
 * The one number NOT taken from the reference is the sheet's outer aspect.
 * The reference sheet is 559 / 806 = 0.694, which is nearer 7:10 than 5:7;
 * this band is 5:7, because 5:7 is what <PosterPreview /> hangs, what
 * <OrbitEntryBand /> measures its strip against, and what the copy on this
 * site calls "the standard 50 × 70 format". A 2.9% difference in the shape of
 * the paper is worth less than one poster proportion across the whole page.
 * The reference's 1.1% mount margin round the picture is likewise not
 * reproduced: `dossier` bleeds, and the margin is a property of the print
 * pipeline, not of this band — it is not mine to change.
 *
 * ------------------------------------------------------------------
 * WHY THE MOUNT IS FIXED AND THE SLIDE IS NOT
 * ------------------------------------------------------------------
 * The whole effect is that the object does not move. Press next and the
 * photograph and the record change inside a mount that is exactly where it
 * was — the frame is furniture, the contents are the slide.
 *
 * Two things enforce that, and neither of them is a promise:
 *
 *   1. ONE FORMAT FOR EVERY SLIDE. `MOUNT_FORMAT` is fixed at F50, so
 *      `posterStyleRects()` returns identical rectangles on every slide.
 *      Each archive mission carries its OWN `formatId` — that is the format
 *      its dossier page composes at, and it is left alone there. This band is
 *      a display case: thirteen files shown at one size, the way a gallery
 *      hangs a series in one moulding. Nothing about the mission's record is
 *      altered by it; only the paper it is shown on.
 *   2. THE MOUNT IS A BOX, NOT A CONSEQUENCE. `<div class="w-[var(--sheet)]
 *      aspect-[5/7]">` owns the geometry and every poster layer is
 *      `absolute inset-0` inside it. Both of the box's dimensions are
 *      therefore definite before a poster renders, so no slide — and no
 *      future change to a style's aspect — can push the mount around.
 *
 * The two layers are also what makes the change a cross-dissolve rather than
 * a dip: the outgoing slide stays fully opaque underneath while the incoming
 * one fades in on top, then unmounts. Under `prefers-reduced-motion` the
 * global reduce block in app/globals.css collapses the transition to 0.001ms,
 * so the change is a cut — which is the requirement, and it costs nothing
 * here because there is no motion to replace, only a fade to remove.
 *
 * ------------------------------------------------------------------
 * WHERE THE CONTENT COMES FROM
 * ------------------------------------------------------------------
 * `listExampleMissions()` and nothing else. Thirteen real Landsat frames with
 * the coordinates, the orbit and the acquisition date their own source
 * records state (lib/imagery.ts § THE DATES ARE THE ATTRIBUTION). Nothing on
 * this band is written for it: the place name is `titleCase(m.city)`, the
 * date is `m.acquiredLabel` at the precision the record supports, the sheet's
 * every string comes from `sheetCopy()` through <StyledPoster />, and the
 * background aerial is the slide's own frame at a wider crop — the same
 * relationship the reference has between its picture and its poster.
 *
 * `capturedAt` is passed as `null`, deliberately. These are archive scenes
 * dated to the DAY and no finer; handing the sheet `…T00:00:00Z` would print
 * `00:00 UTC` on a print, which is a time of day nobody recorded. Null is the
 * pipeline's own answer to "no instant" — the capture stamp is dropped from
 * the picture and the record dashes the clock — and the true acquisition
 * date is printed beside the poster, where the precision can be honest.
 *
 * ------------------------------------------------------------------
 * LEGIBILITY, MEASURED
 * ------------------------------------------------------------------
 * White type sits over thirteen different photographs here, and "it looked
 * fine on the one I checked" is not a contrast measurement. What was actually
 * done: for every line of copy on this band, on every one of the thirteen
 * frames, at 390 and at 1440, the type was hidden and the composited ground
 * behind its own bounding box was screenshotted, then the contrast of that
 * line's computed colour against the ground was read off the pixels. The
 * worst result anywhere in that grid — 156 measurements — is
 *
 *   worst 95th-percentile ground   7.72 : 1   (folio, 11px, Cape Town, 390)
 *   worst SINGLE PIXEL             5.28 : 1   (folio, 11px, Samarkand, 1440)
 *
 * against the 4.5 : 1 AA floor for text this size. That is what set the wash
 * strengths below; they were opened up twice, from an opaque first pass that
 * cleared 15 : 1 and deleted the photograph, until the picture was as bright
 * as the numbers allowed.
 *
 * The corollary is the ink: everything in the rail is `paper`, not
 * `paper-dim`. `paper-dim` is a 7.5 : 1 ink on the void and a 1.2 : 1 ink on
 * a bright Landsat frame, and no wash brings it to AA without taking the
 * frame with it — so the rail separates by SIZE, which is the resolution
 * <OrbitEntryBand /> reached for the two microlines under its own field.
 */

/* ------------------------------------------------------------------ */
/* The mount                                                           */
/* ------------------------------------------------------------------ */

/** The reference's division: picture 0.695, record 0.305. */
const MOUNT_STYLE: PosterStyleId = 'dossier';
/** 5:7 — the 50 × 70 cm catalogue format. Fixed, so the mount cannot move. */
const MOUNT_FORMAT: FormatId = 'F50';
/** Written out because the box declares it in CSS as well as in the prop. */
const MOUNT_RATIO = '5 / 7';

/**
 * The sheet's width, once per breakpoint. Everything else on the band is
 * derived from it, so the two can never drift. Below ~300px the poster's own
 * miniature type starts to collide, which is the floor — the same floor
 * <OrbitEntryBand /> sets.
 */
const SHEET = [
  '[--sheet:min(100vw_-_3.5rem,300px)]',
  'min-[430px]:[--sheet:min(100vw_-_4rem,340px)]',
  'min-[768px]:[--sheet:360px]',
  'min-[1280px]:[--sheet:380px]',
  'min-[1440px]:[--sheet:400px]',
  'min-[1920px]:[--sheet:440px]',
  'min-[2400px]:[--sheet:480px]',
].join(' ');

/** What the browser should fetch for the sheet's picture at each width. */
const SHEET_SIZES =
  '(min-width: 2400px) 480px, (min-width: 1920px) 440px, (min-width: 1440px) 400px, (min-width: 1280px) 380px, (min-width: 768px) 360px, 100vw';

/**
 * The band's id, and the heading's — one literal rather than `useId()`.
 *
 * `useId` encodes the component's position in the tree, and in this repo's dev
 * server that position is not always the same on the server as on the client:
 * a stale RSC payload streams HTML whose ids the client render does not
 * reproduce, and React logs an attribute hydration mismatch on
 * `aria-labelledby`. (Same root cause as the suite's two self-named
 * `DEFECT … RSC payload` tests.) The band is mounted once per page — it is a
 * landing section, not a repeatable widget — so a literal is both correct and
 * immune.
 */
const BAND_ID = 'mission-carousel';
const HEADING_ID = 'mission-carousel-title';

/** A horizontal drag past this, and steeper than 2:1, is a slide change. */
const SWIPE_PX = 48;

/** `--duration-house`, the site's one transition length, in JS: the layer
 *  underneath is dropped once the fade over it is finished. */
const FADE_MS = 300;

/* ------------------------------------------------------------------ */
/* The band                                                            */
/* ------------------------------------------------------------------ */

export function MissionCarousel({ className }: { className?: string }) {
  const missions = listExampleMissions();
  const count = missions.length;

  const [index, setIndex] = useState(0);
  /**
   * The slide being dissolved OUT. Held at full opacity beneath the incoming
   * one until the fade is over, then dropped — which is what makes the change
   * a cross-dissolve with no dip to the ground between the two.
   */
  const [under, setUnder] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  /* Written against `index` rather than inside a `setIndex` updater on
     purpose: an updater must be pure, and React calls it twice under Strict
     Mode — which would deal the outgoing layer and the announcement twice. */
  const go = useCallback(
    (next: number) => {
      const wrapped = ((next % count) + count) % count;
      if (wrapped === index) return;
      const m = missions[wrapped];
      setUnder(index);
      setIndex(wrapped);
      setAnnouncement(
        `Mission ${wrapped + 1} of ${count}. ${titleCase(m.city)}, ${titleCase(m.country)}.`,
      );
    },
    [count, index, missions],
  );

  /* The outgoing layer is dropped once the incoming one has finished. */
  useEffect(() => {
    if (under === null) return;
    const timer = window.setTimeout(() => setUnder(null), FADE_MS + 60);
    return () => window.clearTimeout(timer);
  }, [under, index]);

  /**
   * Arrow keys, scoped to the region rather than to the document: a landing
   * page must not swallow the arrow keys a reader is using to scroll it. The
   * region itself is focusable, so the keys work before Tab has reached the
   * controls, and they work from the controls because the event bubbles.
   */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(index - 1);
      }
    },
    [go, index],
  );

  const mission = missions[index];
  if (!mission) return null;

  return (
    <Band
      id={BAND_ID}
      tone="dark"
      top="open"
      bottom="open"
      className={cn('isolate overflow-hidden', SHEET, className)}
    >
      {/* ---------- The photograph, edge to edge and with no border ------- */}
      <div aria-hidden className="absolute inset-0">
        {under !== null ? <Aerial mission={missions[under]} /> : null}
        <Aerial key={mission.slug} mission={mission} incoming={under !== null} />

        {/* ---------- The scrims ----------------------------------------
            Every strength below is a measurement rather than a taste — see
            § LEGIBILITY, MEASURED at the head of this file for how they were
            arrived at. There are two regimes, because the copy sits in two
            different places:

              < 1280  the copy is the top block and the foot block of one
                      column, so the washes run across the full width and the
                      picture is read in the middle band — which is where the
                      sheet is.
              >= 1280 the copy is a rail in the left margin and the picture is
                      wide, so one left wash carries all of it and the whole
                      right two-thirds of the frame stays open.

            The flat 20% over everything is separate from both: it is what
            the white sheet is read against, and it is the same separation the
            reference gets from a print lying in daylight. */}
        <div className="absolute inset-0 bg-void/20" />

        {/* Below 1280 the copy is a top block and a foot block, so each wash
            holds a PLATEAU over the depth its block actually occupies and
            then falls away fast. A plain two-stop wash cannot do both jobs —
            opaque across 200px of type and gone 100px later — and the version
            that was opaque enough for the foot rail took the photograph with
            it at the top of the band. */}
        <div className="absolute inset-x-0 top-0 h-[28%] bg-linear-to-b from-void from-8% via-void/84 via-56% to-transparent min-[1280px]:hidden" />
        <div className="absolute inset-x-0 bottom-0 h-[36%] bg-linear-to-t from-void from-8% via-void/84 via-60% to-transparent min-[1280px]:hidden" />

        {/* From 1280 the copy is a rail in the left margin, so one horizontal
            wash carries all of it and the right two thirds of the frame — the
            part the sheet is lying on — stays open. */}
        <div className="absolute inset-y-0 left-0 hidden w-[54%] bg-linear-to-r from-void from-6% via-void/80 via-42% to-transparent min-[1280px]:block" />

        {/* And the two edges, so a bright frame does not butt straight into
            the void of the band above or below it. Only from 1280: below
            that the two washes above already close both ends. */}
        <div className="absolute inset-x-0 top-0 hidden h-[16%] bg-linear-to-b from-void/70 to-transparent min-[1280px]:block" />
        <div className="absolute inset-x-0 bottom-0 hidden h-[20%] bg-linear-to-t from-void/85 to-transparent min-[1280px]:block" />
      </div>

      <Container className={cn('relative', MEASURE)}>
        <div
          role="group"
          aria-roledescription="carousel"
          aria-labelledby={HEADING_ID}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onTouchStart={(e) => {
            const t = e.changedTouches[0];
            touchRef.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const start = touchRef.current;
            touchRef.current = null;
            if (!start) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - start.x;
            const dy = t.clientY - start.y;
            if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 2) return;
            go(dx < 0 ? index + 1 : index - 1);
          }}
          className={cn(
            /* The focus ring is the shell's own (`:focus-visible` in
               globals.css); only its offset is widened, because the region's
               edge is the picture. */
            'rounded-[var(--radius-action)] focus-visible:outline-offset-4',
            /* From 1280 the rail sits in the left margin of the picture and
               the sheet is centred on the band — the reference's own
               placement. Below it the page is a column: place, object,
               controls, in that order. */
            'min-[1280px]:grid min-[1280px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
            /* Two content rows, and `content-center` centres the PAIR of them
               against the mount rather than pushing one to each end of it.
               The place and the controls are one rail, read top to bottom;
               spread to the corners of a 560px sheet they were two unrelated
               fragments with a hole between them. */
            'min-[1280px]:grid-rows-[auto_auto] min-[1280px]:content-center min-[1280px]:gap-x-10',
          )}
        >
          {/* ---------- The place, top left ------------------------------ */}
          <div className="min-[1280px]:col-start-1 min-[1280px]:row-start-1 min-[1280px]:self-end">
            {/* EVERY LINE IN THIS RAIL IS SET IN `paper`, AND THAT IS THE
                MEASUREMENT TALKING. `paper-dim` is a 7.5:1 ink on the void
                and a 1.2:1 ink on a bright Landsat frame; bringing it to AA
                over a photograph needs a wash heavy enough to delete the
                photograph. So the rail separates by SIZE and not by value —
                the same resolution <OrbitEntryBand /> reached for the two
                microlines under its field. */}
            <p className="font-mono text-tele-s uppercase text-paper">
              Mission archive
              <span className="mx-2 opacity-60">/</span>
              <span data-telemetry>{mission.code}</span>
            </p>

            <h2
              id={HEADING_ID}
              className="mt-3 max-w-[14ch] text-display text-paper min-[768px]:text-hero"
            >
              {titleCase(mission.city)}
            </h2>

            <p className="mt-3 font-mono text-tele-s uppercase text-paper">
              {titleCase(mission.admin)}
              <span className="mx-2 opacity-60">/</span>
              {titleCase(mission.country)}
            </p>

            <p
              /* TWO LINES ARE RESERVED, AND THAT IS WHAT KEEPS THE MOUNT
                 STILL BELOW 1280. There the sheet is in flow underneath this
                 block, so a line of file metadata that wraps on one mission
                 and not on the next moves the sheet by a line — measured at
                 320 / 360 / 390, where `LANDSAT-8 / OLI · 30 m per pixel`
                 takes two lines and `LANDSAT · 30 m per pixel` takes one.
                 3.1em is exactly two lines of `text-note` (1.55 line-height),
                 which is the tallest this line renders anywhere in the
                 archive. From 1280 the sheet is centred in its own column and
                 nothing above it can push it, so the reservation is dropped
                 rather than left as dead paper. */
              className="mt-5 min-h-[3.1em] max-w-[46ch] text-note text-paper min-[1280px]:min-h-0"
            >
              <span data-telemetry>{mission.acquiredLabel}</span>
              <span className="mx-2 opacity-60">·</span>
              {mission.orbit.sensor} · {mission.orbit.gsdM} m per pixel
            </p>
          </div>

          {/* ---------- The mount ---------------------------------------
              The box, not the poster, holds the geometry: both dimensions
              are definite here, so no slide can move it. */}
          <div className="mt-10 flex justify-center min-[1280px]:col-start-2 min-[1280px]:row-span-2 min-[1280px]:row-start-1 min-[1280px]:mt-0 min-[1280px]:items-center">
            <div
              data-mount
              className="relative w-[var(--sheet)] bg-paper"
              style={{ aspectRatio: MOUNT_RATIO }}
            >
              {under !== null ? <Sheet mission={missions[under]} /> : null}
              <Sheet key={mission.slug} mission={mission} incoming={under !== null} />
            </div>
          </div>

          {/* ---------- The controls ------------------------------------- */}
          <div className="mt-8 min-[1280px]:col-start-1 min-[1280px]:row-start-2 min-[1280px]:mt-10 min-[1280px]:self-start">
            {/* The folio is its own line rather than the middle of the
                control row: two 44px controls and a readout do not fit
                between the gutters at 320, and a row that wraps is a row
                that has already failed at the width it was drawn for. */}
            <p className="font-mono text-tele uppercase text-paper" aria-hidden>
              <span data-telemetry>{pad(index + 1)}</span>
              <span className="mx-1 opacity-60">/</span>
              <span data-telemetry className="opacity-60">
                {pad(count)}
              </span>
            </p>

            <div className="mt-4 flex items-center gap-3">
              <Step direction="prev" onClick={() => go(index - 1)} />
              <Step direction="next" onClick={() => go(index + 1)} />
            </div>

            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {announcement}
            </p>

            <div className="mt-6">
              <Button href="/mission" size="lg" tone="dark" trailing={<ButtonArrow />}>
                Start your mission
              </Button>
            </div>

            {/* The licence, on the surface that uses the frame rather than
                only in the footer. NASA / USGS Landsat products are public
                domain; the per-frame source record is one link away. */}
            <p className="mt-6 font-mono text-tele-s uppercase text-paper">
              <Link
                href="/legal/imagery"
                /* A standalone line, not a link inside a sentence, so it is
                   given the 44px target the rest of the rail has rather than
                   taking the inline-prose exemption. */
                className="inline-flex min-h-11 items-center underline decoration-paper/45 underline-offset-4 transition-house hover:decoration-current"
              >
                NASA / USGS Landsat — public domain
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* The two layers                                                      */
/* ------------------------------------------------------------------ */

/**
 * The band's ground: the slide's own frame, cropped wide. `object-cover` on a
 * band this shallow takes a different part of the scene than the 5:7 window
 * in the sheet does, which is the relationship the reference has — the same
 * place, seen wider, with the print lying on it.
 *
 * `incoming` is the cross-dissolve: `starting:opacity-0` gives the layer a
 * starting style the moment it is inserted, and the transition carries it to
 * 1 over the layer still sitting underneath. Not set on the first render,
 * where there is nothing to dissolve from and a fade would just be a delay.
 */
function Aerial({ mission, incoming = false }: { mission: ExampleMission; incoming?: boolean }) {
  return (
    <Image
      src={mission.src}
      alt=""
      fill
      sizes="100vw"
      className={cn(
        'object-cover object-center',
        incoming && 'opacity-100 transition-opacity duration-house ease-house starting:opacity-0',
      )}
    />
  );
}

/**
 * The printed sheet. Every layer is `absolute inset-0` in the mount, so the
 * poster's own `aspect-ratio` is never what decides the box — see the note on
 * the mount above.
 */
function Sheet({ mission, incoming = false }: { mission: ExampleMission; incoming?: boolean }) {
  const subject: PosterSubject = {
    missionCode: mission.code,
    /* Dated to the day by its source record and no finer. See the file note. */
    capturedAt: null,
    lat: mission.lat,
    lon: mission.lon,
    locationLabel: mission.locationLabel,
    orbit: mission.orbit,
    /* Public view: ~1.1 km, the same fix every other reader of this frame
       gets. The 4 dp form is the owner's, on their own print. */
    coordDp: 2,
  };

  return (
    <StyledPoster
      styleId={MOUNT_STYLE}
      formatId={MOUNT_FORMAT}
      frame="UNFRAMED"
      subject={subject}
      image={{ src: mission.src, alt: frameAlt(mission), sizes: SHEET_SIZES }}
      detail="print"
      className={cn(
        'absolute inset-0',
        incoming && 'opacity-100 transition-opacity duration-house ease-house starting:opacity-0',
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* The controls                                                        */
/* ------------------------------------------------------------------ */

/**
 * Back / next. Labelled, not icon-only — <Button /> carries a glyph beside a
 * word and never instead of one — and `size="md"` is the system's 44px
 * control, which is the touch minimum without a pseudo-element trick.
 *
 * The words are `Back` and `Next`, the deck's own pair (components/brief),
 * and each accessible name contains its visible label so WCAG 2.5.3 holds.
 */
function Step({ direction, onClick }: { direction: 'prev' | 'next'; onClick: () => void }) {
  const next = direction === 'next';
  return (
    <Button
      variant="secondary"
      size="md"
      tone="dark"
      onClick={onClick}
      aria-label={next ? 'Next mission' : 'Back to the previous mission'}
      leading={next ? undefined : <BackArrow />}
      trailing={next ? <ButtonArrow /> : undefined}
    >
      {next ? 'Next' : 'Back'}
    </Button>
  );
}

/**
 * The back-pointing counterpart to <ButtonArrow /> (components/fui/Button).
 * Its mirror image, literally: the same 14 × 10 box, the same 1.25 stroke,
 * the same non-scaling hairline and the same one-step move on hover, so the
 * pair of controls reads as one control drawn twice rather than as an arrow
 * beside a chevron someone else chose.
 */
function BackArrow() {
  return (
    <svg
      width="14"
      height="10"
      viewBox="0 0 14 10"
      fill="none"
      aria-hidden
      focusable="false"
      className="shrink-0 transition-transform duration-house ease-house group-hover:-translate-x-0.5"
    >
      <path
        d="M14 5H2M5.5 1.5 2 5l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** `3` → `03`. The archive's own folio form. */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
