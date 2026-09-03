import Image from 'next/image';

import { Band, Container } from '@/components/fui';
import { FleetCards } from '@/components/satellites';
import { fetchFleetElements } from '@/lib/integrations/celestrak';
import { BandHead } from './BandHead';
import { MEASURE } from './geometry';

/**
 * THE FLEET — dark. Eight real satellites, drawn from live elements.
 *
 * ------------------------------------------------------------------
 * WHAT THIS BAND IS FOR
 * ------------------------------------------------------------------
 * The owner's note on this build was that a visitor does not understand
 * they are commissioning a space mission. This is the band that settles
 * it, and it settles it with evidence rather than adjectives: eight real
 * spacecraft, their real published orbital elements, propagated in the
 * reader's own browser, each one drawn at its true inclination on a ring
 * scaled to its true altitude, with a sub-point that changes while the
 * page is open.
 *
 * It is deliberately the one band on this page whose content nobody
 * wrote. Every other band is composed copy; this one is a readout, and
 * the reader can check it against any tracker on the internet.
 *
 * ------------------------------------------------------------------
 * WHERE THE HARDWARE PICTURE IS, AND WHERE IT IS NOT
 * ------------------------------------------------------------------
 * The obvious version of this band is eight photographs of spacecraft.
 * It is not built that way, and the reason is worth keeping in the file:
 * those spacecraft belong to Maxar, Airbus, ISRO, Planet, NASA and ESA.
 * A render of one of them on a card in our shop presents another
 * company's hardware as ours. A drawing of the orbit is ours, is true,
 * and moves.
 *
 * ONE of the eight can be shown, and it is shown: <HardwarePlate />
 * below carries a real photograph of the real Landsat 9, taken by NASA
 * at Vandenberg on 16 August 2021 and released into the public domain.
 * The licence was checked against the Wikimedia Commons record for that
 * file rather than assumed — `Copyrighted = False`, `Restrictions` empty
 * — and the full audit of all eight spacecraft, with the operative
 * licence text for NASA, ESA, Maxar/Vantor, Airbus, Planet and ISRO, is
 * in IMAGERY.md § SPACECRAFT HARDWARE IMAGERY. The short version:
 *
 *   Landsat 9    NASA, public domain, a real photograph      SHIPPED
 *   Terra        NASA, public domain, an ARTIST'S RENDERING  not shipped
 *   Sentinel-2C  ESA Standard Licence — non-commercial       cannot
 *   Cartosat-3   ISRO policy is silent on commerce; the      cannot
 *                Commons licence tag is unreviewed
 *   WorldView-3  Vantor (Maxar) reserves all rights          cannot
 *   GeoEye-1     same; the only free images are of the       cannot
 *                Delta II on the pad, not the satellite
 *   Pléiades Neo Airbus: non-commercial, no redistribution   cannot
 *   SkySat-C11   Planet: CC BY-NC-SA, no hardware photo      cannot
 *
 * Terra's is not shipped because it is a drawing. This band's whole
 * argument is that its contents are evidence rather than illustration,
 * and putting an artist's impression beside a photograph, both captioned
 * "NASA, public domain", invites the reader to take the drawing for a
 * picture. It is recorded in IMAGERY.md as available if that judgement
 * is ever reversed.
 *
 * THE PHOTOGRAPH IS NOT ON A CARD, and that is a file-ownership fact
 * rather than a design one: the card interior and the record popup are
 * <FleetCards /> and <SatelliteRecord /> in `components/satellites`,
 * which this pass does not own. The asset and its credit string are
 * ready for whoever does.
 *
 * ------------------------------------------------------------------
 * THE CLAIM, AND ITS LIMIT
 * ------------------------------------------------------------------
 * "These are Earth-observation satellites in orbit, and this is where
 * they are." That is all this band may say. It is NOT the satellite
 * assigned to anybody's order — tasking is brokered at capture time
 * against the window, the cloud forecast and the resolution ordered, and
 * the spacecraft that flies a given mission is very often none of these
 * eight. A fleet grid sitting on a page that sells satellite tasking
 * implies that link, so the lede states its absence outright rather than
 * letting adjacency do the arguing. The same sentence appears again
 * inside every record, because a reader who opens one card has stopped
 * reading the band copy.
 *
 * ------------------------------------------------------------------
 * ITS RELATIONSHIP TO <GlobeBand />
 * ------------------------------------------------------------------
 * They are the same data at two altitudes of detail and they must not be
 * given the same headline. <GlobeBand /> is ONE wireframe Earth carrying all
 * eight objects at once — the answer to "is anything actually up there".
 * This band is the fleet ITEM BY ITEM: a card per spacecraft, its own orbit
 * figure, its own specification table, and a full record behind a click —
 * the answer to "what is each of them, and how finely does it see". Mounting
 * both is coherent in that order, globe then cards; mounting both under the
 * word "Overhead" is not, which is why this one is labelled `The fleet`.
 *
 * THE HEADLINE DELIBERATELY DOES NOT COUNT THE FLEET. <GlobeBand /> sits
 * immediately above and opens "Eight spacecraft, where they actually are."
 * Two consecutive bands opening on the same three words read as one band
 * repeated, however different their contents — and these two are genuinely
 * different questions: the globe answers WHERE they are, these cards answer
 * WHAT they are. Keeping them adjacent is right, because the pair is a
 * progression and they share a single Orbital elements fetch; echoing the count in
 * both headlines was not.
 *
 * ------------------------------------------------------------------
 * ONE REQUEST
 * ------------------------------------------------------------------
 * `fetchFleetElements()` is the shared adapter: one Orbital elements document
 * covering the whole fleet, cached three hours by `next.revalidate`, and
 * falling back to the bundled snapshot — saying so on screen — when the
 * live request does not complete. Because the cache key is the request
 * itself, a page carrying BOTH this band and <GlobeBand /> still makes one
 * round trip, not two. The cards never fetch. What makes them move is SGP4
 * running locally against that one fixed element set, once a second.
 *
 * This is an async server component mounted inside a synchronous one, so
 * the page itself does not become async and the other thirteen bands
 * still render the moment the request is in flight.
 */
export async function FleetBand() {
  const fleet = await fetchFleetElements();
  // Nothing to open means the headline must not say "open one". Measured with
  // the adapter forced to return no elements, this band printed that
  // invitation over an empty grid; <FleetCards /> now says why the grid is
  // empty and this says the same thing in the heading.
  const drawn = fleet.elements.length;

  // The server's instant seeds the client clock, so the first client render
  // is byte-identical to this markup and hydration is silent.
  const serverNow = new Date().toISOString();

  return (
    <Band tone="dark" top="open" bottom="open">
      <Container className={MEASURE}>
        <BandHead
          label="The fleet"
          title={
            drawn > 0
              ? 'Open one and read its whole record.'
              : 'The records are not readable right now.'
          }
          lede={
            drawn > 0
              ? `A card each, drawn from live orbital elements propagated in your browser.
                 These are not the satellites assigned to your mission — tasking is brokered at
                 capture time and the spacecraft is very often none of these. They are what is
                 up there, and where.`
              : `Every figure on these cards is an SGP4 propagation of a published element set.
                 The element sets did not reach the page, so there are no cards: nothing here is
                 filled in from memory when the source is unavailable.`
          }
        />

        <FleetCards
          className="mt-12"
          elements={fleet.elements}
          source={fleet.source}
          serverNow={serverNow}
        />

        <HardwarePlate />
      </Container>
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* The one spacecraft that can be photographed here                    */
/* ------------------------------------------------------------------ */

/**
 * THE HARDWARE PLATE — one real photograph, and the reason there is only one.
 *
 * IT SITS UNDER THE GRID, NOT OVER IT. The band's heading is `Open one and
 * read its whole record`, which is an instruction pointing at the cards; a
 * photograph between that sentence and the thing it points at makes the
 * reader hunt for the record. It sits under the whole of <FleetCards />,
 * including the provenance line that component prints for the element sets,
 * so the reading order is: the instrument, where its numbers came from, then
 * the one piece of hardware we are allowed to photograph and why it is one.
 * Two provenance statements in a row, which is what this band is.
 *
 * EVERY CLAIM IN THE CAPTION IS FROM THE SOURCE RECORD. The date, the place
 * and the moment are NASA's own caption for the frame ("Inside the Integrated
 * Processing Facility at Vandenberg Space Force Base in California, the
 * Landsat 9 spacecraft is moved into position for encapsulation on Aug. 16,
 * 2021"). Nothing is inferred and nothing is dressed up: it is not "before
 * launch" (it launched on 27 September, six weeks later), and it is not
 * "the satellite that takes your picture", which the band lede has already
 * denied twice and which this caption denies again — a reader who scrolls to
 * a photograph has stopped reading the lede.
 *
 * THE CREDIT IS A LICENCE CONDITION, NOT A COURTESY, and it cannot ride on
 * `/legal/imagery`: that page enumerates `lib/imagery.ts`, the Landsat EARTH
 * frames, and this file is not in it. So the credit is on the plate, it names
 * the photographer NASA names, and it links the Commons record the licence
 * was read from.
 *
 * NO NASA INSIGNIA IS IN THE FRAME. That was checked at full resolution
 * before the asset was cut, because NASA's media guidelines put the insignia,
 * the logotype and the identifiers outside the public-domain grant even
 * where the photograph is inside it.
 *
 * THE FILE. `public/spacecraft/landsat-9-encapsulation-1000.jpg` — the 4000 ×
 * 6000 original resized to 1000 × 1500, progressive mozjpeg q82, no crop, no
 * grade, 271 KB. Same processing discipline as the Landsat catalogue, and
 * recorded in IMAGERY.md with it.
 */
function HardwarePlate() {
  return (
    <figure className="m-0 mt-16 grid gap-8 border-t rule-ground pt-10 min-[768px]:grid-cols-[300px_minmax(0,1fr)] min-[768px]:gap-10 min-[1280px]:grid-cols-[340px_minmax(0,1fr)] min-[1280px]:gap-12 min-[1920px]:grid-cols-[400px_minmax(0,1fr)]">
      {/* 2:3 is the frame's own proportion. The box holds the geometry so the
          picture cannot move the column, and `object-cover` on an exact 2:3
          box crops nothing. */}
      <div className="relative aspect-[2/3] w-full max-w-[340px] overflow-hidden border rule-ground bg-deck min-[768px]:max-w-none">
        <Image
          src="/spacecraft/landsat-9-encapsulation-1000.jpg"
          alt="The Landsat 9 spacecraft standing inside a cleanroom, wrapped in silver and gold thermal blanketing, with one half of its launch fairing open beside it and two technicians in white coveralls at its base."
          fill
          sizes="(min-width: 1920px) 400px, (min-width: 1280px) 340px, (min-width: 768px) 300px, 100vw"
          className="object-cover"
        />
      </div>

      <figcaption className="min-w-0">
        <p className="font-mono text-tele-s uppercase ink-faint">
          One of the eight, photographed
        </p>

        <p className="mt-5 max-w-[62ch] text-body ink">
          Landsat 9, inside the Integrated Processing Facility at Vandenberg Space Force Base on
          16 August 2021, being moved into position for encapsulation — the last hours it was
          ever visible.
        </p>

        <p className="mt-5 max-w-[62ch] text-body ink-dim">
          It is the only one of these eight spacecraft we can put a photograph of on this page.
          NASA releases its own photography into the public domain, and Landsat is also the
          archive every example frame on this site is printed from. The other seven are
          photographed by Maxar, Airbus, ISRO, Planet and ESA, all of whom reserve the rights to
          those pictures, so their cards carry the live orbit instead — which is ours, which is
          true, and which moves. It is not the satellite assigned to any mission: none of these
          are.
        </p>

        <dl className="mt-8 grid max-w-[46ch] grid-cols-[0.85fr_1fr]">
          <PlateRow label="Spacecraft" value="Landsat 9 · NASA / USGS" />
          <PlateRow label="Photographed" value="16 AUG 2021 · Vandenberg SFB" telemetry />
          <PlateRow label="Photographer" value="NASA / Randy Beaudoin" />
          <PlateRow label="Licence" value="Public domain — no rights reserved" last />
        </dl>

        {/* A standalone line rather than a link inside prose, so it takes the
            44px target rather than the inline exemption. */}
        <a
          href="https://commons.wikimedia.org/wiki/File:Landsat_9_Encapsulation_(KSC-20210816-PH-RNB01_0090).jpg"
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 inline-flex min-h-11 items-center text-label uppercase ink-dim underline decoration-[color:var(--rule-strong)] underline-offset-4 transition-house hover:ink hover:decoration-current"
        >
          The source record this licence was read from
        </a>
      </figcaption>
    </figure>
  );
}

/** One ruled row. <FleetCards />'s foot-table anatomy, at the band's scale. */
function PlateRow({
  label,
  value,
  telemetry = false,
  last = false,
}: {
  label: string;
  value: string;
  telemetry?: boolean;
  last?: boolean;
}) {
  const cell = last ? 'py-2' : 'border-b rule-ground py-2';
  return (
    <>
      <dt className={`${cell} font-mono text-tele-xs uppercase ink-faint`}>{label}</dt>
      <dd
        data-telemetry={telemetry ? '' : undefined}
        className={`${cell} font-mono text-tele-xs uppercase ink`}
      >
        {value}
      </dd>
    </>
  );
}
