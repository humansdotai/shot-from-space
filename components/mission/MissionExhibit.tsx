import { clsx as cn } from 'clsx';
import { FramedPoster } from '@/components/artifact';
import Image from 'next/image';
import { Container, CreditBox, CropMarks, Grid12 } from '@/components/fui';
import { AmbientMosaic, MosaicField } from '@/components/hero';
import { getFormat } from '@/lib/pricing';
import { stageReached, type MissionDTO } from '@/lib/types';
import { EXHIBIT_PLATE, EXHIBIT_WALL } from './layout';
import { ORBIT_CLOCK_NOTE, SkyFigure } from './SkyFigure';
import { coordDp, deg, formatWindowRange, printAspect } from './telemetry';
import { FileHead } from './ui';

/**
 * THE EXHIBIT — the frame, filed. On the dark ground, because it is imagery.
 *
 * Three bands: the head, then the wall itself full-bleed so it butts against
 * its neighbours the way the poster mounts its picture, then the telemetry
 * rail. The print is mounted the way a print is mounted — nothing is drawn
 * across the picture; the credit, the tags and the readings all sit in the
 * rail beneath it.
 *
 * The wall inside those two dark bands is LIGHT — see the comment on it. A
 * framed print hangs on plaster, and the object's wall shadow is only a
 * shadow if there is something for it to darken.
 *
 * Before acquisition the same wall carries a designed awaiting state: the
 * exact frame the print will occupy, hanging as the object it will be, with
 * the mission's own sky running inside it. It is never an empty box — see
 * <AwaitingPlate /> at the foot of this file.
 *
 * ------------------------------------------------------------------
 * THE WALL, ONCE THERE IS A FRAME: THE SAME PICTURE, IN MONOCHROME
 * ------------------------------------------------------------------
 * The owner's note was "the satellite picture as a black-and-white
 * background". So the plaster carries the mission's OWN capture, rendered
 * `style=full-frame` — the photograph edge to edge, no record sheet —
 * desaturated, flattened and lifted until it sits at plaster value.
 *
 * THE GROUND IS TREATED; THE OBJECT IS NOT. The print in the frame is a
 * depiction of a colour product that a customer is paying for, and
 * desaturating it would be a picture of something we do not sell. Only the
 * wall is touched, and the rail beneath says so in words.
 *
 * The mural is the one image on this band that goes through the Next image
 * optimizer rather than `unoptimized`. The print is served at its display
 * size already; the mural is a heavy downscale of the same render, and
 * re-encoding it is worth about 2.5 MB. The optimizer fetches without the
 * reader's cookie, so it always composites the PUBLIC projection of the
 * plate — which is the correct release for a decorative ground.
 *
 * Density: the credit (capture time and coordinates) plus four readings —
 * six values around one image. Everything else is in the specification band.
 *
 * ------------------------------------------------------------------
 * THE TWO MOSAICS, AND WHICH ONE YIELDS
 * ------------------------------------------------------------------
 * The band carries the sampling raster at two completely different strengths
 * and NEVER both at once:
 *
 *   ON THE PLATE   <MosaicField>, at full strength, when there is no frame
 *                  yet. It is the picture being resolved, so it is the
 *                  subject: it cascades, it answers the pointer, and it is
 *                  the only thing moving on the band.
 *   ON THE BAND    <AmbientMosaic>, at roughly a fiftieth of that, once the
 *                  print is in and the plate has become a photograph. Pure
 *                  texture on the dark ground behind the head and the rail;
 *                  no cascade, no pointer, nothing to look at.
 *
 * The rule is one raster per band, and the ambient one is what yields: two
 * canvases in the same field of view is two things asking for the same
 * attention, and the loud one is the one carrying the meaning.
 */
export function MissionExhibit({
  mission,
  index,
}: {
  mission: MissionDTO;
  /** `[current, total]` — this section's position in the file. */
  index?: [number, number];
}) {
  const acquired = stageReached(mission.stage, 'IMAGE_ACQUIRED') && Boolean(mission.previewUrl);
  const framed = mission.format.frame === 'FRAMED';
  const ratio = getFormat(mission.format.id).ratio;
  const aspect = printAspect(ratio);
  const windowRange = formatWindowRange(mission.windowOpensAt, mission.windowClosesAt);
  /* The same render as the print, composed edge to edge instead of as a
     dossier: the photograph without the record sheet. Same route, same
     watermarking, same release rules. */
  const mural = acquired ? `${mission.previewUrl}?style=full-frame&w=1200` : null;

  const readings = acquired
    ? [
        { label: 'Sensor', value: mission.orbit.sensor },
        { label: 'Resolution', value: `${mission.orbit.gsdM} m per pixel` },
        { label: 'Off-nadir', value: deg(mission.orbit.offNadirDeg) },
        { label: 'Cloud at capture', value: `${mission.orbit.cloudPct}%` },
      ]
    : [
        { label: 'Target', value: mission.locationLabel },
        { label: 'Sensor', value: mission.orbit.sensor },
        { label: 'Resolution', value: `${mission.orbit.gsdM} m per pixel` },
        { label: 'Capture window', value: windowRange ?? 'Scheduling' },
      ];

  return (
    <section className="surface-dark relative isolate pt-[var(--band-open)]">
      {/* Ambient texture on the dark ground, behind everything and in front
          of nothing. `-z-10` inside the section's own stacking context puts
          it above the band's background and below every scrap of content,
          including the opaque wall — so it is only ever seen in the head and
          the rail. It is suppressed entirely while the plate is running its
          own raster; see the note at the top of this file. */}
      {acquired ? <AmbientMosaic className="-z-10" seed={seedFor(mission.code)} /> : null}

      <Container>
        <FileHead
          as="h2"
          eyebrow={acquired ? 'Exhibit A / watermarked preview' : 'Exhibit A / awaiting acquisition'}
          title="The frame"
          index={index}
          flush
        />
      </Container>

      {/* THE WALL. Full-bleed, flush against its neighbours — and LIGHT,
          which is the one thing on this band that is not negotiable.

          The framed print casts a wall shadow: dropped, spread and mostly
          penumbra, at 0.5 black. Hung on the void (`bg-deck/30` over
          `bg-void` computes to about #090a0d) that cast moves the ground by
          roughly three levels, so a physically correct shadow reads as no
          shadow at all — the frame looks pasted on and the shadow parallax
          during the tilt is lost. The fix belongs here and not in
          <FramedPoster />, whose geometry is measured against spec: a print
          hangs on a plaster wall, so the wall is plaster.

          `surface-light` rather than a bare background colour, because it
          also hands `--ink` / `--rule` to everything inside the wall, so the
          border resolves to the paper hairline instead of the dark one. The
          band around it stays on void: a lit wall inset in a dark room is the
          poster's own construction, and the head and the telemetry rail keep
          the imagery half of the page. */}
      <div
        className={cn(
          'surface-light relative isolate mt-[var(--band-snug)] flex w-full items-center justify-center overflow-hidden border-y border-[color:var(--rule)]',
          EXHIBIT_WALL,
        )}
      >
        {/* THE MONOCHROME WALL. The mission's own capture, edge to edge,
            desaturated and lifted until it is plaster the frame can hang on.

            The three filter terms are doing three separate jobs and the order
            matters: `grayscale` takes the colour off so nothing on the wall
            competes with the print, `contrast` flattens the range so the wall
            has no darks for the object's shadow to disappear into, and
            `brightness` lifts what is left to somewhere near paper. What
            survives is the SHAPE of the ground the mission photographed — a
            coastline, a grid of streets — at a value a wall could be painted.

            `opacity` finishes the composite against `--color-paper` behind it,
            and the radial wash puts a lighter patch under the frame so the
            object still sits in its own light.

            `scale-[1.3]` crops the outer eighth away, which is where the
            full-frame composition sets its corner marks — the lockup, the
            capture stamp and the mission code. On a wide wall `object-cover`
            already loses them; on a 390px one it does not, and a ghosted
            second lockup on the plaster reads as a mistake rather than as a
            wall. */}
        {mural ? (
          <div aria-hidden className="absolute inset-0 -z-10">
            <Image
              src={mural}
              alt=""
              fill
              quality={55}
              sizes="100vw"
              className="scale-[1.3] object-cover opacity-[0.36] [filter:grayscale(1)_contrast(0.5)_brightness(1.55)]"
            />
            <div className="absolute inset-0 bg-[radial-gradient(66%_78%_at_50%_48%,color-mix(in_srgb,var(--color-paper)_72%,transparent)_0%,color-mix(in_srgb,var(--color-paper)_26%,transparent)_56%,transparent_100%)]" />
          </div>
        ) : null}

        {acquired ? (
          /* The deliverable, presented as the object THIS mission ordered.
             A framed order hangs behind a brushed aluminium moulding, sized
             by the band's height so the frame fits inside it rather than
             overflowing by twice its face. An unframed order is a sheet, and
             it is shown as a sheet: putting a moulding round a print nobody
             bought a moulding for would contradict the specification band
             two screens up, which says `Mount / Unframed`. */
          framed ? (
            /* moulding="wood" is not a style choice. This is the one surface
               on the site that depicts a frame somebody has actually bought,
               and what `lib/integrations/gelato.ts` orders for a FRAMED line is
               `..._black_wood_w-12-mm_plexiglass_...`. The specification band
               two screens up reads "black wood, acrylic glazing" off the same
               constant. Rendering the aluminium presentation moulding here —
               which is what this call used to do — put a picture of a product
               nobody sells directly above the words describing the real one. */
            <FramedPoster
              src={mission.previewUrl as string}
              alt={`Watermarked satellite preview of ${mission.locationLabel}, mission ${mission.code}`}
              ratio={getFormat(mission.format.id).ratio}
              moulding="wood"
              fit="height"
              size="84%"
              priority
            />
          ) : (
            <div
              className={cn(
                'relative h-full max-h-full shadow-[0_2px_6px_rgb(8_9_11/0.12),0_18px_44px_rgb(8_9_11/0.14)]',
                EXHIBIT_PLATE,
              )}
              style={{ aspectRatio: aspect }}
            >
              <Image
                src={mission.previewUrl as string}
                alt={`Watermarked satellite preview of ${mission.locationLabel}, mission ${mission.code}`}
                fill
                unoptimized
                priority
                sizes="(min-width: 1280px) 55vw, (min-width: 768px) 70vw, 100vw"
                className="object-contain"
              />
              <CropMarks length={18} inset={12} tone="signal" />
            </div>
          )
        ) : /* THE OBJECT, BEFORE THERE IS A PRINT IN IT. A framed order is
               already a frame — the moulding is bought, the glazing is
               bought, the wall fixing is bought — so it hangs as the object
               it will be, with the plate inside it instead of a photograph.
               That is a truer picture of what the customer owns at this
               stage than a bare rectangle floating on a wall, and it is the
               same <FramedPoster /> geometry, the same wood moulding and the
               same spring-damped tilt the acquired frame gets. */
        framed ? (
          <FramedPoster ratio={ratio} moulding="wood" fit="height" size="84%">
            <AwaitingPlate mission={mission} windowRange={windowRange} />
          </FramedPoster>
        ) : (
          <div
            className={cn(
              'relative h-full max-h-full shadow-[0_2px_6px_rgb(8_9_11/0.12),0_18px_44px_rgb(8_9_11/0.14)]',
              EXHIBIT_PLATE,
            )}
            style={{ aspectRatio: aspect }}
          >
            <AwaitingPlate mission={mission} windowRange={windowRange} marks />
          </div>
        )}
      </div>

      {/* The rail: the credit, the file tags, four readings, one caption. */}
      <Container className="pt-[var(--band-snug)] pb-[var(--band-open)]">
        <Grid12>
          <div className="col-span-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <CreditBox
              timestamp={acquired ? mission.capturedAt ?? undefined : undefined}
              lat={mission.lat}
              lon={mission.lon}
              dp={coordDp(mission)}
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {['EXHIBIT A', mission.format.designation, acquired ? 'WATERMARKED' : 'PENDING'].map(
                (tag, i) => (
                  <span key={tag} className="flex items-center gap-3">
                    {i > 0 ? <span aria-hidden className="h-3 w-px bg-hairline" /> : null}
                    <span className="text-label uppercase text-paper-dim">{tag}</span>
                  </span>
                ),
              )}
            </div>
          </div>

          {readings.map((f) => (
            <div
              key={f.label}
              className="col-span-6 flex flex-col gap-2 border-t border-hairline pt-4 md:col-span-3 xl:col-span-2"
            >
              <span className="text-label uppercase text-paper-dim">{f.label}</span>
              <span className={cn('text-action text-paper')}>{f.value}</span>
            </div>
          ))}

          <p className="col-span-12 max-w-[var(--measure)] text-body text-paper-dim xl:col-span-4 xl:col-start-9">
            {acquired
              ? `A watermarked, low-resolution reference for the file. The wall behind it is the same capture in monochrome; the print keeps its colour, because colour is what prints. The deliverable is the printed object: ${mission.format.metric} / ${mission.format.imperial}, ${mission.format.frame === 'FRAMED' ? 'framed' : 'unframed'}, produced in ${mission.region === 'EU' ? 'Europe' : 'the United States'}.`
              : `Until the frame is down, the ${framed ? 'frame hangs empty and the plate' : 'plate'} holds the target and the sky over it. The preview is released to this file the moment it downlinks.`}
          </p>
        </Grid12>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The awaiting plate                                                 */
/* ------------------------------------------------------------------ */

/**
 * THE PLATE, BEFORE THE FRAME IS DOWN.
 *
 * This was the largest dead area in the product: an empty dark rectangle at
 * the exact proportions of the print, with three lines of type in the middle
 * of it and a skeleton shimmer passing over. A skeleton is what you show when
 * a value is a moment away and its shape is already known. Nothing about this
 * plate is a moment away — the satellite has not flown yet — so a loading
 * shimmer was making a promise the mission cannot keep.
 *
 * What is there instead is the frame being resolved. The sampling raster from
 * the hero runs at full strength inside the plate: cells sampling, settling,
 * and passing light to their neighbours in cascades. It is the same engine,
 * the same file, the same physics — the only thing that changes is what sits
 * under it. On the hero the raster reads a photograph and paints each cell
 * that cell's average; here there IS no photograph, so it falls back to its
 * own composition ramp over a ground the plate provides, and what shows is a
 * lattice of samples with a scatter of live cells burning in it. That is an
 * honest picture of the state: the grid is there, the sensor is there, the
 * frame is not.
 *
 * Nothing here is invented. No other mission's imagery is borrowed to fill
 * the space, no countdown is fabricated: the only values on the plate are the
 * two the file already knows, and the raster is geometry.
 *
 * The seed is the mission code, so a given file's plate is the same field on
 * every visit and on every machine, and two files side by side are not the
 * same picture.
 *
 * ------------------------------------------------------------------
 * AND ABOVE IT, THE MISSION ACTUALLY HAPPENING
 * ------------------------------------------------------------------
 * The raster says "there is a sensor and no frame yet". What it could not
 * say is that something is being flown on the reader's behalf right now, and
 * that was the owner's note: the exhibit needed "an animated satellite SVG
 * showing the mission is in process".
 *
 * <SkyFigure /> is that, and it is not an illustration. The markers are the
 * tracked fleet at `subPointAt()` positions solved from published CelesTrak
 * elements; the ring at the centre is this mission's own coordinates. It is
 * the SAME figure the band at the top of the file draws, at a third of the
 * size and without the tasked plane — the plane is a claim about geometry
 * and it is already made twice on this page, so the plate keeps only the
 * part that is a live position.
 *
 * `plane={false}` is therefore not a simplification, it is the density rule.
 *
 * ------------------------------------------------------------------
 * THE PLATE IS NOT THE PRINT, AND SAYS SO
 * ------------------------------------------------------------------
 * A drawing standing where a photograph will be could be read as "the poster
 * is an orbit diagram". The caption under it — kept verbatim — is what stops
 * that: "The plate fills on downlink, at the exact proportions of the print."
 *
 * Kept exactly as it was: the proportions of the print, the caption, and
 * `aria-busy` on the plate itself. The raster and the figure are both
 * `aria-hidden` with no pointer surface, so nothing above changes for a
 * reader who is not looking at them.
 *
 * The root is OPAQUE (`bg-void`), which is <FramedPoster />'s one condition
 * on a composed child: its specular layer is painted UNDER the print so the
 * highlight is occluded rather than masked, and a translucent plate would let
 * the moulding's travelling beam show through the picture.
 */
function AwaitingPlate({
  mission,
  windowRange,
  marks = false,
}: {
  mission: MissionDTO;
  windowRange: string | null;
  /** Crop marks. On a bare sheet, yes; inside a moulding, the rabbet is the
   *  edge and a second set of marks is one mark too many. */
  marks?: boolean;
}) {
  const o = mission.orbit;
  /* A cancelled mission is not being flown, so nothing on its plate may say
     that it is: no live figure, no "awaiting", no window. The frame still
     hangs — the file stays open for reference — but it hangs closed. */
  const cancelled = mission.state === 'CANCELLED';

  return (
    <div
      aria-busy="true"
      /* `on-dark` and not `surface-dark`: the ground is already painted by
         `bg-void` on this element, and what the plate needs from the scope is
         the INK — it hangs inside the wall, which is `surface-light`, so
         without this every `var(--ink)` inside the figure would resolve to
         void and draw black on black. The type below names its colours
         outright and was never affected, which is exactly why this was easy
         to miss. */
      className="on-dark relative isolate flex h-full w-full items-center justify-center overflow-hidden bg-void"
    >
      {/* The ground the raster is resolved against. The field paints in the
          void's own ink, so on flat void it would be invisible — it needs
          something a shade above itself to take light away from. A shallow
          wash from `deck-2` at the optical centre down to `void` at the
          edges is that something, and it is also the vignette a plate under
          a lamp would have. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(118%_96%_at_50%_36%,var(--color-deck-2)_0%,var(--color-deck)_44%,var(--color-void)_100%)]"
      />

      <MosaicField className="z-[1]" seed={seedFor(mission.code)} />

      {/* Legibility, above the field and below the words — the same order the
          hero uses. A cascade is allowed to run right through the caption;
          it is not allowed to make it harder to read. */}
      <div
        aria-hidden
        className="absolute inset-0 z-[2] bg-[radial-gradient(76%_58%_at_50%_50%,color-mix(in_srgb,var(--color-void)_92%,transparent)_0%,color-mix(in_srgb,var(--color-void)_66%,transparent)_58%,transparent_88%)]"
      />

      <div className="relative z-[3] flex w-full flex-col items-center justify-center gap-5 px-6 text-center">
        {cancelled ? null : (
          <SkyFigure
            lat={mission.lat}
            lon={mission.lon}
            inclination={o.inclination}
            track={o.track}
            altitudeKm={o.altitudeKm}
            azimuthDeg={o.azimuthDeg}
            offNadirDeg={o.offNadirDeg}
            detail="compact"
            className="h-[140px] w-[140px] sm:h-[176px] sm:w-[176px] xl:h-[216px] xl:w-[216px] xl2:h-[248px] xl2:w-[248px]"
          />
        )}

        <div className="flex flex-col items-center gap-2.5">
          <span className="text-label uppercase text-paper-dim">
            {cancelled ? 'Mission cancelled' : 'Awaiting acquisition'}
          </span>
          <span data-telemetry className="font-mono text-tele-s uppercase text-paper-dim">
            {cancelled
              ? 'No frame acquired'
              : windowRange
                ? `Window ${windowRange}`
                : 'Window being scheduled'}
          </span>
          <p className="max-w-[var(--measure-tight)] text-body text-paper-dim">
            {cancelled
              ? 'The mission closed before a pass cleared. The file stays open for reference.'
              : 'The plate fills on downlink, at the exact proportions of the print.'}
          </p>
          {/* The compression, stated wherever the figure is drawn. Set at
              `paper-dim` and not `paper-faint`: the raster is live under it
              and its brightest cell puts faint at 4.8:1, which clears AA by
              too little to leave to a cascade. Dim measures 7.2:1 against the
              same worst-case ground. */}
          {cancelled ? null : (
            <span data-telemetry className="font-mono text-tele-s uppercase text-paper-dim">
              Tracked fleet, live · {ORBIT_CLOCK_NOTE}
            </span>
          )}
        </div>
      </div>

      {marks ? <CropMarks length={18} inset={12} /> : null}
    </div>
  );
}

/**
 * A stable field seed from the mission code. The raster's geometry is
 * deterministic by design (see components/hero/mosaic.ts) — feeding it the
 * code keeps one file's plate identical on every visit and on both sides of
 * hydration, while two files still get different fields.
 */
function seedFor(code: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < code.length; i += 1) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

