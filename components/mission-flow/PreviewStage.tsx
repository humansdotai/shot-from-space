'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx as cn } from 'clsx';
import { INK, INK_DIM, INK_FAINT, RULE } from '@/components/purchase/fields';
import { getFormat } from '@/lib/pricing';
import { getPosterStyle } from '@/lib/poster/styles';
import type { Currency } from '@/lib/types';
import type { PreviewKind } from '@/lib/mission-flow/steps';
import { effectiveFrame } from '@/lib/mission-flow/config';
import type { MissionDraft } from '@/lib/mission-flow/state';
import { telemetryCoords } from '@/lib/mission-flow/entry';
import { RevealStage } from './S1Reveal';
import { FramingStage } from './FramingStage';
import { PosterStage } from './PosterStage';
import { MissionGround } from './MissionGround';
import { OrbitGlyph } from '@/components/satellites';
import { ageLabel, standbyPhase, useFleetStandby, useLiveClock } from './PassGeometry';
import { DossierDocument } from './S8Dossier';

/**
 * ==================================================================
 * THE PREVIEW COLUMN — the object, beside the controls that change it
 * ==================================================================
 *
 * ------------------------------------------------------------------
 * WHY THIS COLUMN IS ON PAPER
 * ------------------------------------------------------------------
 * It used to be void. A photograph bled to all four edges of a black
 * column with a 10px grey telemetry line laid over the bottom of it,
 * and nothing anywhere said what the buyer was looking at. The owner's
 * note was exact: *everything on the left is not easily to understand
 * for the user, maybe because is on black.*
 *
 * Two things were wrong and only one of them was the colour.
 *
 *   1. THE GROUND. Text set on a photograph has whatever contrast the
 *      photograph happens to give it — which for a light Sentinel-2
 *      scene is close to none. On `surface-light` every role is measured
 *      and fixed: 16.99 : 1 for the title, 7.04 : 1 for the sentence
 *      under it, 5.03 : 1 for the telemetry labels. Nothing depends on
 *      what the satellite saw that day.
 *
 *   2. THE HIERARCHY. There was none — one size of type, one weight,
 *      one tone, and no statement of what the object was. The column
 *      now has THREE levels and they are separated on four axes at once
 *      (size, family, case, ink), so the order is unmistakable:
 *
 *        ❶  the TITLE      display · sans · sentence case · `--ink`
 *                          One line. What this object is. The biggest
 *                          type on the surface.
 *        ❷  the SENTENCE   note · sans · sentence case · `--ink-dim`
 *                          One line. What it is FOR, or what it is not.
 *        ❸  the TELEMETRY  tele / tele-xs · mono · UPPERCASE · `--ink`
 *                          on the values, `--ink-faint` on the labels.
 *                          The figures. Read last, on purpose.
 *
 *      The kicker above the title is level ❸'s treatment used as an
 *      index, so the eye passes over it on the way in rather than
 *      stopping on it.
 *
 * WHICH LINE IS BIGGEST, AND WHY IT IS THIS ONE. The title, and it
 * answers the only question a first-time visitor has here: *what am I
 * looking at?* The panel on the right is set at the `heading` role and
 * asks a different question — *what do I decide?* Two columns, two
 * questions, one king each, and they never compete for the same one.
 *
 * ------------------------------------------------------------------
 * THE OBJECTS ARE NOT RECOLOURED
 * ------------------------------------------------------------------
 * The poster, the archive frame and the basemap are PHOTOGRAPHIC. They
 * keep their own values and sit ON the paper as objects, each inside a
 * hairline mount — which is what the printed composition in
 * `section-middle.pdf` does with the sheet itself. Tinting a photograph
 * to match a page is the one thing a print shop would never do.
 *
 * ------------------------------------------------------------------
 * WHY ARTEFACTS ARE HIDDEN RATHER THAN UNMOUNTED
 * ------------------------------------------------------------------
 * `poster` is the artefact of three different sections and the map holds
 * a pan and a zoom the buyer set by hand. Tearing either down on a tab
 * change and rebuilding it on the way back would throw away work the
 * buyer did — which is exactly the failure a configurator exists to
 * avoid. So an artefact is built the first time it is needed and then
 * kept, hidden with `hidden` (display: none) when another one is up.
 *
 * Nothing is built before it is needed: an unvisited kind is not in the
 * set, so the pass search and the map tiles are not fetched on arrival.
 * ==================================================================
 */
export function PreviewStage({
  active,
  draft,
  currency,
  onCentre,
}: {
  active: PreviewKind;
  draft: MissionDraft;
  currency: Currency;
  /** The framing tool's committed frame centre. */
  onCentre: (next: { lat: number; lon: number }) => void;
}) {
  // The kinds that have been asked for at least once, in the order they
  // were asked for. A ref, not state: adding to it must not cause the
  // render that is adding to it to be discarded.
  const seen = useRef<Set<PreviewKind>>(new Set());
  seen.current.add(active);
  const kinds = Array.from(seen.current);

  const target = draft.target;

  /* The print keeps the whole well on a phone; see the poster stage below. */
  const wide = useAtLeast(1024);

  return (
    <div className="surface-light relative h-full w-full bg-[color:var(--ground)]">
      {kinds.map((kind) => (
        <div key={kind} hidden={kind !== active} className="absolute inset-0 h-full w-full">
          {kind === 'reveal' ? (
            <Stage
              /* THE HEAD DESCRIBES WHAT IS ACTUALLY IN THE WELL. With
                 coordinates that is the archive descent. Without them it
                 is <PreviewWaiting />, whose ground is orbital footage —
                 and a head reading `Archive imagery of this ground` over
                 a spacecraft, before any ground has been named, states
                 two things that are not true at once. */
              kicker={target ? 'Reference frame' : 'Mission preview'}
              title={
                target ? 'Reference imagery of this ground.' : 'Nothing is measured yet.'
              }
              /* NOT "Undated reference". This stage does not hold the scene
                 record — <RevealStage /> fetches it — so it cannot know
                 whether the frame is dated. It was asserting UNDATED while the
                 record for these coordinates carried 31.07.1986, and both
                 claims were on screen at once. A component that does not have
                 a fact does not get to state it. */
              lead={
                target
                  ? 'For positioning only. Your mission returns a new frame of these coordinates.'
                  : 'Every figure on this page is measured from one set of coordinates. There are none yet.'
              }
              telemetry={
                target
                  ? [
                      {
                        label: 'Coordinates',
                        value: telemetryCoords(target.lat, target.lon),
                        span: 2 as const,
                      },
                      /* The acquisition date is deliberately ABSENT here.
                         It belongs to the scene record, which the frame's own
                         telemetry line prints from source — dated when the
                         record is dated, UNDATED when it is not. Repeating it
                         from a component that cannot read that record is how
                         the two ended up disagreeing on one screen. */
                    ]
                  : []
              }
            >
              {target ? (
                <Mount>
                  <RevealStage target={target} />
                </Mount>
              ) : (
                <PreviewWaiting>
                  Name a place in the panel and the descent runs here.
                </PreviewWaiting>
              )}
            </Stage>
          ) : null}

          {kind === 'map' ? (
            <Stage
              kicker="Capture framing"
              title={`The ${draft.areaKm} km your mission photographs.`}
              lead="Drag to move the ground under the frame."
              /* No telemetry row: <FrameOnMap /> prints the centre, the
                 ordered footprint and the live scale under the basemap
                 itself, where they update per frame. Saying it twice
                 would read as two different claims. */
            >
              {target ? (
                <FramingStage lat={target.lat} lon={target.lon} areaKm={draft.areaKm} onCentre={onCentre} />
              ) : (
                <PreviewWaiting>There is nothing to frame until a place is named.</PreviewWaiting>
              )}
            </Stage>
          ) : null}

          {kind === 'poster' ? (
            <Stage
              kicker="Print preview"
              title="Exactly what will print."
              lead="Your frame, the telemetry strip and the print credit, at the proportion of the size you pick."
              telemetry={[
                { label: 'Size', value: getFormat(draft.formatId).metric },
                {
                  label: 'Finish',
                  /* THE FINISH THAT WILL PRINT, which for LARGE FORMAT is
                     not the one the Design tab has selected: that tier is
                     defined as framed and `TIER_FORCED_FRAME` overrides
                     the choice, which is what the panel foot charges for.
                     This strip read UNFRAMED under a head promising
                     `Exactly what will print`, over a framed order. */
                  value: effectiveFrame(draft.tier, draft.frame) === 'FRAMED' ? 'FRAMED' : 'UNFRAMED',
                },
                { label: 'Composition', value: posterStyleName(draft) },
              ]}
            >
              {target ? (
                /* THE CLIP IS BEHIND THE PRINT ONLY WHERE THERE IS ROOM,
                   and the cut-off is a measurement rather than a taste.

                   This stage's promise is `Exactly what will print`. At 390
                   the preview column is 38svh — a ~115px well. <MissionGround />
                   spends 56px of that on the honesty note and the pause
                   control it must keep clear, and <PreviewObject /> caps the
                   sheet at `100cqh × ratio`, so with a clip behind it the
                   print fell from ~92px to ~51px tall: a thumbnail of the
                   object being bought, on the one stage where a buyer is
                   judging it. On a phone the object wins, always.

                   From 1024 the well is several hundred pixels and the print
                   keeps its full size, so the ground is the mission footage
                   the owner asked for. `wide` is false on the server and on
                   first paint, so the markup hydrates identically at every
                   width and the clip is never even fetched on a phone —
                   which is the device least able to afford it. */
                wide ? (
                  <MissionGround clip="zoom-logo">
                    <div className="relative z-10 flex h-full w-full items-center justify-center p-[6%]">
                      <PosterStage draft={draft} />
                    </div>
                  </MissionGround>
                ) : (
                  <PosterStage draft={draft} />
                )
              ) : (
                <PreviewWaiting>The print is composed once there are coordinates.</PreviewWaiting>
              )}
            </Stage>
          ) : null}

          {kind === 'dossier' ? (
            <Stage
              kicker="Commission dossier"
              title="Your commission, on paper."
              /* The same artefact serves Review and the Confirmation, and
                 the one thing the head must not get wrong is whether the
                 money has moved. It read `Nothing is charged until you
                 authorise it in the panel` over a settled payment. */
              lead={
                draft.missionCode
                  ? 'Every answer as you commissioned it. The mission is paid for and the record is on file.'
                  : 'Every answer as you configured it. Nothing is charged until you authorise it in the panel.'
              }
              telemetry={
                target
                  ? [
                      {
                        label: 'Coordinates',
                        value: telemetryCoords(target.lat, target.lon),
                        span: 2 as const,
                      },
                      { label: 'Capture', value: `${draft.areaKm} × ${draft.areaKm} KM` },
                    ]
                  : []
              }
            >
              {target ? (
                <Mount>
                  <DossierDocument draft={draft} currency={currency} />
                </Mount>
              ) : (
                <PreviewWaiting>The dossier is written from your answers.</PreviewWaiting>
              )}
            </Stage>
          ) : null}
        </div>
      ))}

      {/* ------------------------------------------------------------
          THE HEADER'S GROUND
          ------------------------------------------------------------
          <SiteHeader /> is `absolute` over every page, carries `.on-dark`
          and paints its own void gradient scrim, because it was designed
          to sit on a photograph. Flipping this column to paper takes that
          ground away: measured over #eeede8 the wordmark falls to 2.52 : 1
          and the nav to 1.80 : 1, both well under AA. A ground flip is not
          allowed to cost the header its contrast.

          So the header keeps a ground. This band is exactly the header's
          own row height at each step — the same five numbers the panel
          column pads by — so its lower edge lands on the panel's rail and
          the two columns share one horizontal. It is painted last and sits
          under the header (z-50) and over the stages.

          The alternative was to restyle <SiteHeader /> for this one
          surface, which is another build's file and would change the
          header on every page to fix one column.
          ------------------------------------------------------------ */}
      <div
        aria-hidden
        className={cn(
          // NAMED, so `/mission` can take it out on the stacked phone
          // shape. This band exists to keep the site bar legible where a
          // stage sits at the TOP OF THE VIEWPORT, which is true of every
          // stage in the split layout. Stacked, the stages are spread
          // down a scrolling document and none of them is under the
          // header, so the band stops being a scrim and becomes a black
          // bar ruled across the middle of the page.
          'preview-header-band',
          'pointer-events-none absolute inset-x-0 top-0 z-20 bg-void',
          /* The band that keeps <SiteHeader> legible over this paper column.
             Its height reads --site-bar-h, which the header itself publishes
             (70px, 90 above 1024). It used to hard-code 72/76/88/96, and when
             the header became the floating pill those numbers went stale: at
             1025-1279 the bar overran the tab rail's numerals by 14px. One
             source, so the two cannot drift again. */
          'h-[var(--site-bar-h)] xl2:h-28 xl3:h-[124px]',
        )}
      />
    </div>
  );
}

/** The composition's own name, for the telemetry row. */
function posterStyleName(draft: MissionDraft): string {
  try {
    return getPosterStyle(draft.posterStyle).name.toUpperCase();
  } catch {
    return '—';
  }
}

/* ------------------------------------------------------------------ */
/* THE STAGE                                                           */
/* ------------------------------------------------------------------ */

interface TelemetryCell {
  label: string;
  value: string;
  /**
   * Columns the cell takes on the three-column strip. A coordinate is
   * the only value here that cannot be shortened without changing what
   * it means — `0.1278…` has lost the hemisphere — so it is the only one
   * that ever asks for two.
   */
  span?: 1 | 2;
}

/**
 * One artefact, titled, on paper.
 *
 * THE TOP PADDING is not decoration: <SiteHeader /> is `absolute` over
 * every page and its right cluster — the nav and `Start a mission` —
 * lands on this column. The padding is the header's own row height at
 * each step, so the kicker begins where the header ends.
 *
 * THE WELL — the box the object sits in — declares `container-type:
 * size`, which publishes its own height as `cqh`. That is how a print
 * with a physical proportion is sized from the box it is ACTUALLY in
 * rather than from a viewport unit that knows nothing about the site
 * header, the mock-mode strip or this stage's own head. Guessing that
 * height is what used to crop the print.
 */
function Stage({
  kicker,
  title,
  lead,
  telemetry,
  children,
}: {
  kicker: string;
  title: string;
  lead: string;
  telemetry?: readonly TelemetryCell[];
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex h-full w-full flex-col overflow-hidden',
        // The top padding is the header band above plus the stage's own
        // breathing room, restated at each of the header's five heights.
        'px-4 pb-3 sm:px-6 lg:px-10 lg:pb-7 xl2:px-14',
        'pt-[84px] lg:pt-[92px] xl:pt-[106px] 2xl:pt-[112px] xl2:pt-[128px] xl3:pt-[144px]',
      )}
    >
      {/* ❶ + ❷ — the two lines that say what this is. */}
      <header className="shrink-0">
        <p className={cn('tele-s uppercase', INK_FAINT)}>{kicker}</p>
        <h2 className={cn('max-w-[26ch] pt-1.5 text-heading lg:max-w-[32ch] lg:text-display', INK)}>
          {title}
        </h2>
        {/* The sentence is held back below `lg`: on a phone the object
            gets the height, and the panel under it carries the same
            disclosure in full. */}
        <p className={cn('hidden max-w-[52ch] pt-2 text-note lg:block', INK_DIM)}>{lead}</p>
      </header>

      {/* The object. */}
      <div className="relative min-h-0 flex-1 pt-3 lg:pt-5 [container-type:size]">{children}</div>

      {/* ❸ — the figures, last and smallest.

          AND THE FIRST THING TO GO WHEN THERE IS NO ROOM FOR THE OBJECT.
          Below `lg` this column is `max(200px, 38svh)`. At 320 x 568 that
          is 200px, and the stage's own chrome — the header reserve, the
          title, this strip — measured 215 of it: the well came out 12px
          tall and the artefact rendered at ZERO height. The browser said
          so out loud (`Image with "fill" and a height value of 0`), and
          what a buyer saw was a title, three figures, and no picture.

          A stage whose object has no height is not a preview. So on a
          short phone the figures step aside for the thing they describe —
          and nothing is lost by it: `Coordinates` is a row of the Target
          panel's own table, `Size`/`Finish`/`Composition` are the three
          controls of the Design panel, and the dossier prints its
          coordinates on the sheet itself. Every value here is said again,
          in full, in the column that is scrolling beside it.

          The bound is the two narrow steps of the matrix and nothing
          else: 568 and 640 are caught, 844 and 932 are not, and `max-lg`
          keeps the desktop split — where this column is 700px+ tall —
          out of it entirely. */}
      {telemetry && telemetry.length > 0 ? (
        <div
          className={cn(
            'mt-2.5 grid shrink-0 grid-cols-3 gap-x-5 gap-y-2 border-t pt-2.5 lg:mt-5 lg:pt-3',
            'max-lg:[@media(max-height:700px)]:hidden',
            RULE,
          )}
        >
          {telemetry.map((cell) => (
            <div key={cell.label} className={cn('min-w-0', cell.span === 2 && 'col-span-2')}>
              <span className={cn('block tele-xs uppercase', INK_FAINT)}>{cell.label}</span>
              <span
                data-telemetry
                className={cn('mt-1 block truncate font-mono tele uppercase tabular-nums', INK)}
              >
                {cell.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The two ways an artefact sits in the well                           */
/* ------------------------------------------------------------------ */

/**
 * A FULL-BLEED PHOTOGRAPH, mounted. The archive frame has no physical
 * proportion to protect — it is a crop — so it takes the whole well and
 * a hairline holds it to the paper as an object rather than letting it
 * dissolve into the edge.
 */
/**
 * THE MOUNT — what makes a print on paper read as an OBJECT on paper.
 *
 * A single hairline was not enough and the measurement says so: scanning
 * across the print preview at 1440, the poster's own paper and the stage's
 * ground both read rgb(238,237,232) — CONTRAST 1.000, byte-identical, for
 * 600 px straight through the sheet. The print did not have a soft edge; it
 * had no edge. It dissolved into the page.
 *
 * That is what changed when this column went from void to paper. On void a
 * white sheet separates itself; on paper nothing does the work, and the
 * hairline alone is a 1.57:1 division doing a job that needs an object.
 *
 * So the print now sits on the paper the way a print sits on a desk:
 *
 *   · a CONTACT CAST — tight, offset down, no spread and no colour. This is
 *     the house's existing object language (`Artifact3D` for the small
 *     artifacts, `FramedPoster` for the framed print), reduced to the one
 *     case here: an unframed sheet lying flat, so the shadow is a contact
 *     shadow rather than a wall cast, and it is a shadow, never a glow.
 *   · a darker EDGE than the interior rule, because this boundary separates
 *     two surfaces of the same value and is the only thing that can.
 *
 * Both are non-text UI boundaries; WCAG 1.4.11 asks 3:1 of them, which the
 * edge now clears on its own, without the cast helping.
 */
/**
 * True only once mounted AND at or above `px`. False on the server and on
 * the first client paint, so server and client markup always agree and a
 * narrow device never mounts what it cannot use.
 */
function useAtLeast(px: number): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const q = window.matchMedia(`(min-width: ${px}px)`);
    const sync = () => setWide(q.matches);
    sync();
    q.addEventListener('change', sync);
    return () => q.removeEventListener('change', sync);
  }, [px]);
  return wide;
}

function Mount({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden',
        'border border-[color-mix(in_oklab,var(--ink)_38%,transparent)]',
        'shadow-[0_1px_2px_rgb(8_9_11/0.10),0_10px_24px_-12px_rgb(8_9_11/0.28)]',
      )}
    >
      {children}
    </div>
  );
}

/**
 * A CENTRED OBJECT — a print, a document. It has a physical proportion
 * and must not be cropped, so its width is capped by the height of the
 * WELL (`100cqh`, published by the stage) multiplied by the format's own
 * aspect ratio, and then again by the well's width.
 *
 * The 1.12 is headroom for a frame: <FramedPoster /> adds a moulding on
 * all four sides, so the framed object is slightly taller than the print
 * inside it. Sizing to the print alone crops the bottom rail.
 */
export function PreviewObject({
  formatId,
  children,
}: {
  formatId: MissionDraft['formatId'];
  children: ReactNode;
}) {
  const [w, h] = getFormat(formatId).ratio.split(':').map(Number);
  const ratio = w / h / 1.12;

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-full" style={{ maxWidth: `calc(100cqh * ${ratio.toFixed(4)})` }}>
        {children}
      </div>
    </div>
  );
}

/**
 * The well before there is anything to show in it. Not a spinner and
 * not a skeleton of a thing that may never arrive — a stated reason, in
 * the same voice as the rest of the flow, inside a hairline that holds
 * the same shape the object will take.
 */
export function PreviewWaiting({ children }: { children: ReactNode }) {
  return (
    /* NO CLIP HERE, AND THAT IS THE POINT.
       ----------------------------------------------------------------
       This is what somebody arriving at a bare `/mission` meets: at 1440
       it is the left 62% of the first purchase screen. It used to be
       <MissionGround clip="zoom-logo" /> — full-bleed stock orbital
       footage with `STOCK ORBITAL FOOTAGE · NOT THE SPACECRAFT ASSIGNED
       TO THIS MISSION` set across the foot of it. That note is correct
       and it stays wherever the footage does; what it is not is a good
       first object, because it is a DISCLAIMER, it was the largest
       readable line on the screen, and the only reason it had to be
       there was the footage it was disclaiming.
       ----------------------------------------------------------------
       WAVE.md §1 names the alternative and it is already ours: live
       CelesTrak elements for eight real spacecraft, propagated in the
       browser. <FleetStandby /> below draws them at their real
       inclinations and at the real point in their revolution, and needs
       no disclaimer at all — nothing is claimed about them beyond being
       in orbit and being tracked here, which is what the line under them
       says. The ground goes back to paper and the object on it is
       measured rather than borrowed. */
    <Mount>
      <div className="flex h-full w-full items-center justify-center overflow-hidden bg-[color:var(--ground)] p-3 lg:p-5">
        {/* `max-h-full` is not decoration. At 320 the preview column is
            200px and the stage's chrome leaves the well 61px; a card with
            a fixed intrinsic height and `items-center` above it overflows
            in BOTH directions. Capped and scrollable, it degrades to a
            small window instead. */}
        <div
          className={cn(
            /* 26rem is the phone measure. At `lg` the fleet readout opens
               into two columns and eight satellite names — `Sentinel-2C`,
               `Pléiades Neo 3` — and at 26rem five of the eight truncated
               to an ellipsis. A name clipped to `WorldVie…` is not a
               readout, so the card takes the width its widest row needs. */
            'surface-light max-h-full w-full max-w-[26rem] overflow-y-auto overscroll-contain lg:max-w-[42rem]',
            'border bg-[color:var(--ground)] px-5 py-5 lg:px-6 lg:py-6',
            RULE,
          )}
        >
          <p className={cn('text-label uppercase', INK_DIM)}>Standing by</p>
          <p className={cn('max-w-[var(--measure)] pt-2 text-note', INK_DIM)}>{children}</p>
          <FleetStandby />
        </div>
      </div>
    </Mount>
  );
}

/**
 * THE TRACKED FLEET, WHILE THERE IS NOTHING TO MEASURE OVER.
 *
 * One glyph per spacecraft, each ring rotated by that satellite's REAL
 * inclination and each marker at the REAL point in its revolution,
 * advanced on the browser's clock from the mean anomaly at the element
 * epoch. It moves because the satellites move — the distinction
 * `components/satellites/OrbitGlyph.tsx` draws, and the only kind of
 * motion this surface allows in an icon.
 *
 * WHAT THE LINE UNDER IT IS ALLOWED TO SAY, and says: how many spacecraft
 * this site tracks, where the elements came from, and how old the
 * freshest one is. Not which one flies anything — nothing has been
 * ordered and no spacecraft has been assigned, and this is the screen
 * where a reader has not even named a place yet.
 *
 * It renders nothing at all until the elements are in. A skeleton of a
 * readout that may never arrive is the thing this flow refuses everywhere
 * else, and the sentence above it already says what is being waited for.
 */
function FleetStandby() {
  const reading = useFleetStandby();
  const now = useLiveClock(useRef(new Date().toISOString()).current);

  if (!reading) return null;

  return (
    <div className={cn('mt-3 border-t pt-2.5 lg:mt-4 lg:pt-3.5', RULE)}>
      {/* ------------------------------------------------------------
          THE READOUT IS A `lg` READOUT. THE READING IS EVERY WIDTH'S.

          At `lg` this card sits in a well several hundred pixels tall, so
          the fleet opens into the readout that space is worth: the glyph
          beside the name it belongs to, the operator under it, and the
          inclination its ring is actually drawn at.

          Below `lg` it does not. Measured at 390 the well is 129px and
          this card needs 171 to carry the label, the instruction, eight
          glyphs and the reading — so the strip was CUT, mid-glyph, with
          the line under it out of view, which reads as broken rather than
          as tight. Tried at 22px with the spacing closed up: 143. There
          is no version of the strip that fits.

          So on a phone the card keeps the two things that have to be
          there — what is being waited for, and the live reading that says
          the elements are real and how old they are — and the eight
          glyphs wait for a column that can hold them. That reading is
          itself new here: this screen previously carried no live fact at
          all, only stock footage and the note disclaiming it.
          ------------------------------------------------------------ */}
      <ul className="hidden lg:grid lg:grid-cols-2 lg:gap-x-8">
        {reading.satellites.map((sat) => (
          <li
            key={sat.noradId}
            className={cn('flex items-center gap-3 border-b py-2.5', RULE)}
          >
            <OrbitGlyph
              inclination={sat.inclination}
              phase={standbyPhase(sat, now)}
              size={34}
              className={cn('shrink-0', INK_DIM)}
            />
            <span className="min-w-0 flex-1">
              <span className={cn('block truncate text-note', INK)}>{sat.name}</span>
              <span
                data-telemetry
                className={cn('block truncate font-mono text-tele-xs uppercase', INK_FAINT)}
              >
                {sat.operator}
              </span>
            </span>
            <span
              data-telemetry
              className={cn('shrink-0 font-mono text-tele-xs uppercase tabular-nums', INK_FAINT)}
            >
              {sat.inclination.toFixed(1)}°
            </span>
          </li>
        ))}
      </ul>

      <p
        data-telemetry
        className={cn('font-mono text-tele-xs uppercase tabular-nums lg:pt-3', INK_FAINT)}
      >
        {reading.satellites.length} spacecraft tracked · elements{' '}
        {reading.source === 'live' ? 'live' : 'from the bundled snapshot'} ·{' '}
        {ageLabel(reading.freshestAgeHours)} old
      </p>
    </div>
  );
}
