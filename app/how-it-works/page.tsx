import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  Band,
  Button,
  Container,
  CropMarks,
  Grid12,
  ImagePlate,
  NumberedList,
  OrbitDiagram,
  TelemetryLabel,
  type NumberedItem,
} from '@/components/fui';
import { missionShortLink } from '@/lib/codes';
import { frameBySlug, type CatalogueFrame } from '@/lib/imagery';
import {
  CAPTURE_WINDOW_DAYS,
  CLOUD_THRESHOLD_PCT,
  MATERIALS,
  PACKAGING,
  REFUND_WINDOW_DAYS,
  guaranteeTerm,
} from '@/lib/guarantees';
import {
  PRICE_FROM,
  SIZE_REFERENCE,
  tierPriceMinor,
} from '@/lib/mission-flow/config';
import { FORMATS, PRINT_FACILITY, formatPrice, priceMinor } from '@/lib/pricing';
import { MISSION_STAGES, STAGE_DESCRIPTION, STAGE_LABEL } from '@/lib/types';
import { formatCoords } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Process',
  description:
    'Tasking and revisit windows, cloud and re-tasking at no cost, what ~50 cm ground sample distance resolves, composition and the telemetry overlay, regional printing, and Mission Control.',
};

/**
 * /how-it-works — THE PROCESS, EXPANDED.
 *
 * Built as the measured band sequence (reference/STRUCTURE.md), not as one
 * long prose column: a full-bleed opening plate, then padded content bands
 * alternating with flush capture plates that butt directly against their
 * neighbours. Padding is never uniform — every band declares its own rhythm.
 *
 * Server-rendered end to end. Nothing on this page needs JavaScript.
 */

const HERO = frameBySlug('london-uk')!;
const PLATE_TASKING = frameBySlug('berlin-de')!;
const PLATE_CLOUD = frameBySlug('cape-town-za')!;
const PLATE_RESOLUTION = frameBySlug('seattle-us')!;
const PLATE_COMPOSITION = frameBySlug('sao-paulo-br')!;
const PLATE_PRINT = frameBySlug('las-vegas-us')!;

/** The nine mission stages, straight from the shared state machine. */
const STAGE_ITEMS: NumberedItem[] = MISSION_STAGES.map((stage, i) => ({
  index: String(i + 1).padStart(2, '0'),
  title: STAGE_LABEL[stage],
  body: STAGE_DESCRIPTION[stage],
}));

const RESOLVES = [
  'The shape, colour and pitch of a roof',
  'Extensions, outbuildings and a garage',
  'The driveway, and parked cars as distinct rectangles',
  'A pool, a patio, a lawn, individual mature trees',
  'Lane markings on a wide road',
  'The street pattern your address sits inside',
];

const DOES_NOT_RESOLVE = [
  'Faces — a person is a mark two pixels across',
  'Number plates, house numbers, any text on the ground',
  'Windows, and anything on the other side of one',
  'Anything indoors, under a canopy or under a tree',
  'Building facades — the view is straight down, not oblique',
  'Anything captured obliquely from an aircraft or a drone',
];

/* ------------------------------------------------------------------ */
/* Local band shapes. These compose Band / Container / Grid12 only —   */
/* they introduce no visual pattern that is not already in the shell.  */
/* ------------------------------------------------------------------ */

/** A flush capture plate: zero padding, butting against its neighbours. */
function PlateBand({
  frame,
  alt,
  height = 'h-[320px] sm:h-[520px]',
  priority = false,
}: {
  frame: CatalogueFrame;
  alt: string;
  height?: string;
  priority?: boolean;
}) {
  return (
    <Band top="flush" bottom="flush">
      <div className={`relative w-full overflow-hidden ${height}`}>
        <Image
          src={frame.src}
          alt={alt}
          fill
          sizes="100vw"
          priority={priority}
          className="object-cover"
        />
        {/* Legibility scrim under the telemetry rail — functional, not decorative. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-void/75 to-transparent"
        />
        <CropMarks length={14} inset={16} />
        <Container className="pointer-events-none relative flex h-full items-start justify-between gap-6 pt-6">
          <span className="font-mono text-tele-s uppercase text-paper/70">
            {frame.city} · {frame.country}
          </span>
          <span data-telemetry className="font-mono text-tele-s uppercase text-paper/70">
            {formatCoords(frame.lat, frame.lon)}
          </span>
        </Container>
      </div>
    </Band>
  );
}

/** Label / value rows on a hairline stack — the spec column of a band. */
function SpecRows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl>
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-baseline justify-between gap-6 border-t border-hairline py-3"
        >
          <dt className="text-label uppercase text-paper-faint">{r.label}</dt>
          <dd className="text-action tabular-nums text-paper">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The price line, and the two terms under it.
 *
 * ------------------------------------------------------------------
 * WHY THERE ARE TWO NUMBERS
 * ------------------------------------------------------------------
 * This line used to read "Missions from €79" — and it sat directly above
 * this page's own format table, whose cheapest row is €170. Both figures
 * were true and the pair was not: they are the entry prices of two
 * DIFFERENT funnels. €79 buys the archive tier through /mission (the most
 * recent existing capture, nothing tasked); €170 is the cheapest new
 * commission in the catalogue this page documents.
 *
 * A reader cannot see that distinction, so the line now states it. Naming
 * what each number buys is the only way to print both without one of them
 * reading as a bait price.
 *
 * Neither number is typed, and BOTH now come from the funnel this page's
 * buttons open — `/mission`. `PRICE_FROM` is that flow's entry price and
 * `commissionFromMinor` is `tierPriceMinor()` at the reference size, which
 * is the same function `app/api/orders/route.ts` prices the order with. So
 * the two figures on this line are two configurations a reader can actually
 * reach and be charged for.
 *
 * It used to take the second number from `FORMATS`, the print catalogue —
 * EUR 170 at 30 x 40 unframed. That is `/start`'s price list, and `/mission`
 * cannot charge it at any size or finish: it prices by tier and adds the
 * catalogue's size DIFFERENCE on top. Once these buttons opened `/mission`,
 * quoting EUR 170 beside them was quoting a price the checkout would not
 * honour — CONFIGURATOR.md §3.2, the defect that once shipped a EUR 79
 * button recording EUR 170.
 *
 * The two promises are the exact `short` forms in lib/guarantees.ts — the
 * same strings /legal/terms is written from. Paraphrasing either is how this
 * site once ended up making fourteen promises it had not agreed to.
 *
 * HANDOVER: the price TABLE in section 06 below is still the catalogue, and
 * its own button still opens `/start` for that reason. Two price lists for
 * one product is the open decision recorded in INTEGRATIONS.md §10; unify
 * them and this page carries one number and one destination throughout.
 */
const commissionFromMinor = tierPriceMinor(
  'COMMISSION',
  SIZE_REFERENCE.formatId,
  SIZE_REFERENCE.frame,
  'EUR',
);

function PriceTerms({ className }: { className?: string }) {
  return (
    <p className={`max-w-[56ch] text-note text-paper/75 ${className ?? ''}`}>
      Archive frames from €{PRICE_FROM} · commissions from{' '}
      {formatPrice(commissionFromMinor, 'EUR')} · {guaranteeTerm('retask').short} ·{' '}
      {guaranteeTerm('refund').short}
    </p>
  );
}

/** The eyebrow / display / body head of a content band. */
function BandHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <>
      <p className="text-label uppercase text-paper-faint">{eyebrow}</p>
      <h2 className="mt-5 max-w-[22ch] text-display text-paper">{title}</h2>
      {children}
    </>
  );
}

export default function HowItWorksPage() {
  return (
    <main>
      {/* ---- 01 · OPENING PLATE — full-bleed, flush both sides ---- */}
      <Band top="flush" bottom="flush" className="isolate overflow-hidden">
        <div className="relative min-h-[76svh] w-full sm:min-h-[620px]">
          <Image
            src={HERO.src}
            alt={`Satellite capture of the ${HERO.city} estuary, ${HERO.country}`}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-void via-void/50 to-void/30"
          />

          {/*
            THE HEADER'S OWN GROUND, and the reason it is a second scrim
            rather than a stronger top stop on the one above.

            The site header floats over this picture. Measured on the TEXT
            LINE — `Range.getClientRects()` over the glyphs, photograph
            present, brightest pixel behind them — its nav links read
            4.30:1 at 1280 and 1440 ("Missions", over rgb(60,58,54)) and
            4.42:1 for "Account". AA wants 4.5 for 12px type, so both
            failed, and they failed only here: the same header over the
            landing page's hero passes at all ten widths.

            The gradient above ends at `to-void/30` at the top, which is the
            right value for the picture and too little for a 12px label. This
            strip covers exactly the header's own height (`--site-bar-h`,
            70 / 90) plus a little air, so it darkens what is behind the
            chrome and nothing that is behind the photograph's own copy.

            Re-measured after: "Missions" 5.65:1 and "Account" 5.83:1 at 1280,
            5.65 and 5.87 at 1440.
          */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-[calc(var(--site-bar-h)_+_24px)] bg-gradient-to-b from-void/85 via-void/45 to-transparent"
          />

          {/*
            THE RAIL SITS UNDER THE HEADER, and it has to be told where that
            is rather than guessing.

            `top-14` — 56px — was written before the header became a floating
            pill. Measured: at 320 / 360 / 390 / 430 / 768 / 1024 the pill is
            FULL WIDTH and 70px tall, so this rail's box (y 56 → 84) was
            drawn underneath an opaque backdrop-blurred plate and could not
            be read at all; at 390 it had also wrapped to two lines, of which
            only the second was ever visible. Above 1024 the pill is a
            centred capsule and the rail clears it horizontally, which is why
            the fault was invisible on a desktop screenshot.

            `--site-bar-h` is the one number the header publishes for exactly
            this (70 / 90); every other file that reserves the bar reads it.
            Above the header's own 1024 breakpoint the rail keeps its
            original line, because there it is beside the capsule and not
            under it.

            The gap tightens below 430 for the same measurement: at 390 the
            two labels plus a 24px gap came to 326px in a 326px column, which
            is what forced the wrap.
          */}
          <div className="absolute inset-x-0 top-[calc(var(--site-bar-h)_+_12px)] z-10 min-[1025px]:top-14">
            <Container className="flex items-start justify-between gap-3 min-[430px]:gap-6">
              <span className="font-mono text-tele-s uppercase text-paper/70">
                Operations file // process
              </span>
              <span data-telemetry className="font-mono text-tele-s uppercase text-paper/70">
                {HERO.orbit.sensor}
              </span>
            </Container>
          </div>

          <Container className="relative z-10 flex min-h-[76svh] flex-col justify-end pb-8 sm:min-h-[620px] sm:pb-10">
            <p className="text-label uppercase text-paper/70">The process, in full</p>
            <h1 className="mt-5 max-w-[24ch] text-display text-paper">
              What tasking a satellite actually involves.
            </h1>
            <p className="mt-6 max-w-[54ch] text-body text-paper/75">
              The short version is on the front page. This is the long one: how a target is
              filed and when it can be revisited, what happens when the sky is in the way,
              what half a metre per pixel does and does not show, and what you hold at the
              end of it.
            </p>

            {/*
              THE ACTION, ON THE FIRST SCREEN.

              This page explains a purchase, so it is a selling surface, and a
              selling surface whose only control is 7,000px down the scroll is
              the defect CONFIGURATOR.md §3.1 exists to stop. It was: before
              this, the first control on the page was `Start mission` in the
              closing band, at y=7,007 on a 1280 screen and y=10,912 on a 320
              one. The price sits with it, because a control without a number
              beside it is the surprise §3.2 is about.
            */}
            <div className="mt-8">
              <Button href="/mission" variant="primary" size="lg">
                Start a mission
              </Button>
            </div>
            <PriceTerms className="mt-5" />
          </Container>
        </div>
      </Band>

      {/* ---- 02 · TASKING AND REVISIT ---- */}
      <Band top="tight" bottom="snug">
        <Container>
          <Grid12>
            <div className="col-span-12 lg:col-span-6">
              <BandHead eyebrow="01 / Tasking and revisit" title="A target is a coordinate pair and an area.">
                <p className="mt-5 max-w-[48ch] text-body text-paper-dim">
                  A mission begins with an address. It is resolved to decimal degrees and a
                  capture area of roughly a square kilometre is drawn around it — enough to
                  hold the building, the street it stands on and the ground around it. An
                  isolated roof is not a photograph worth hanging; the context is what makes
                  it one.
                </p>
                <p className="mt-4 max-w-[48ch] text-body text-paper-dim">
                  Those coordinates go to the constellation operator as a collection request.
                  Imaging satellites fly in sun-synchronous orbit: they cross a given latitude
                  at close to the same local solar time on every pass, which is why captures
                  of the same place share the same quality of light.
                </p>
                <p className="mt-4 max-w-[48ch] text-body text-paper-dim">
                  Revisit interval depends on the constellation and on your latitude —
                  typically one to three days for a specific target, more often towards the
                  poles, less often near the equator. A collection request is not a promise of
                  a frame tomorrow. The satellite has to be in position, the target has to
                  fall inside its off-nadir limit, and the sky has to cooperate.
                </p>
              </BandHead>
            </div>

            <div className="col-span-12 lg:col-span-5 lg:col-start-8">
              <SpecRows
                rows={[
                  { label: 'Coordinate precision', value: '4 decimal places' },
                  { label: 'Capture area', value: '≈ 1 km²' },
                  { label: 'Orbit', value: 'Sun-synchronous, 98.2°' },
                  { label: 'Revisit interval', value: '1 — 3 days' },
                  { label: 'Off-nadir limit', value: '≤ 25°' },
                ]}
              />
              <div className="mt-8 flex items-start gap-6">
                <OrbitDiagram
                  track={HERO.orbit.track}
                  inclination={HERO.orbit.inclination}
                  altitudeKm={HERO.orbit.altitudeKm}
                  size={148}
                />
                <p className="max-w-[30ch] text-body text-paper-dim">
                  Pass geometry for the frame above: track, inclination and altitude, drawn
                  from the same telemetry that is printed on the sheet.
                </p>
              </div>
            </div>
          </Grid12>
        </Container>
      </Band>

      <PlateBand
        frame={PLATE_TASKING}
        alt={`Satellite capture of ${PLATE_TASKING.city} and the surrounding ${PLATE_TASKING.admin} region`}
      />

      {/* ---- 03 · CLOUD AND RE-TASKING ---- */}
      <Band top="open" bottom="open">
        <Container>
          <Grid12>
            <div className="col-span-12 lg:col-span-6">
              <BandHead
                eyebrow="02 / When cloud blocks a pass"
                title="A blocked pass is re-tasked at no cost."
              >
                <p className="mt-5 max-w-[48ch] text-body text-paper-dim">
                  Optical satellites cannot see through cloud. A scheduled pass with cloud
                  over the target returns an unusable frame, and over most of the world that
                  happens regularly. It is the normal condition of the work, not a failure of
                  it.
                </p>
                <p className="mt-4 max-w-[48ch] text-body text-paper-dim">
                  When a pass is blocked, the mission is re-tasked for the next window
                  automatically. There is no charge for the re-task and nothing for you to do.
                  The attempt is written into your mission file with its cloud percentage, and
                  the mission moves on. We would rather hold a mission open than deliver a
                  photograph of a cloud.
                </p>
                <p className="mt-4 max-w-[48ch] text-body text-paper-dim">
                  Capture windows normally close within fourteen days. Northern winters,
                  monsoon seasons and permanently overcast coastlines take longer, and if your
                  target is one of them, Mission Control says so in the file rather than
                  letting it go quiet. A mission that cannot be captured within{' '}
                  {REFUND_WINDOW_DAYS} days is closed and refunded in full without you having
                  to ask.
                </p>
              </BandHead>
            </div>

            <div className="col-span-12 lg:col-span-5 lg:col-start-8">
              <SpecRows
                rows={[
                  {
                    label: 'Capture window',
                    value: `${CAPTURE_WINDOW_DAYS.min} — ${CAPTURE_WINDOW_DAYS.max} days`,
                  },
                  { label: 'Cloud threshold', value: `≤ ${CLOUD_THRESHOLD_PCT}% over target` },
                  { label: 'Re-task on cloud', value: 'No cost' },
                  { label: 'Attempts logged', value: 'Every pass' },
                  { label: 'Full refund after', value: `${REFUND_WINDOW_DAYS} days` },
                ]}
              />
            </div>
          </Grid12>
        </Container>
      </Band>

      <PlateBand
        frame={PLATE_CLOUD}
        alt={`Satellite capture of ${PLATE_CLOUD.city} and the surrounding coastline`}
        height="h-[280px] sm:h-[420px]"
      />

      {/* ---- 04 · RESOLUTION — inverted ground ---- */}
      <Band top="open" bottom="open" className="bg-paper text-void">
        <Container>
          <Grid12>
            <div className="col-span-12 lg:col-span-5">
              <p className="text-label uppercase text-void-dim">03 / Resolution</p>
              <h2 className="mt-5 max-w-[20ch] text-display text-void">
                One pixel covers about half a metre of ground.
              </h2>
              <p className="mt-5 max-w-[44ch] text-body text-void/70">
                Captures are ordered at approximately 50 cm ground sample distance. Your
                street reads as your street and your house reads as your house. Everything
                below is a consequence of that number, not a policy we chose afterwards.
              </p>
              <p className="mt-4 max-w-[44ch] text-body text-void/70">
                The view is near-nadir: straight down at roofs and ground. This is a portrait
                of a place, not surveillance of the people in it.
              </p>
            </div>

            <div className="col-span-12 sm:col-span-6 lg:col-span-3 lg:col-start-7">
              <p className="text-label uppercase text-void-dim">Resolves</p>
              <ul className="mt-4">
                {RESOLVES.map((line) => (
                  <li key={line} className="border-t border-void/15 py-3 text-body text-void/80">
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="col-span-12 sm:col-span-6 lg:col-span-3 lg:col-start-10">
              <p className="text-label uppercase text-void-dim">Does not resolve</p>
              <ul className="mt-4">
                {DOES_NOT_RESOLVE.map((line) => (
                  <li key={line} className="border-t border-void/15 py-3 text-body text-void/80">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </Grid12>
        </Container>
      </Band>

      <PlateBand
        frame={PLATE_RESOLUTION}
        alt={`Satellite capture of ${PLATE_RESOLUTION.city}, ${PLATE_RESOLUTION.admin}`}
        height="h-[300px] sm:h-[480px]"
      />

      {/* ---- The honest note about the example frames ---- */}
      <Band top="tight" bottom="snug">
        <Container>
          <Grid12>
            <div className="col-span-12 border-t border-hairline pt-4 lg:col-span-7">
              <TelemetryLabel tone="faint" size="xs" as="p">
                Note on the example frames
              </TelemetryLabel>
              <p className="mt-3 max-w-[62ch] text-body text-paper-dim">
                Every example frame on this site is a public-domain Landsat product at
                roughly 30 m per pixel — a city at a glance. They are here to demonstrate
                composition and print, not capture resolution. A tasked mission is captured
                at roughly sixty times finer detail than anything shown on this page.
              </p>
            </div>
            <div className="col-span-12 self-end lg:col-span-4 lg:col-start-9">
              <Link
                href="/legal/imagery"
                className="inline-flex min-h-11 items-center border border-hairline px-5 text-action text-paper transition-colors hover:border-paper"
              >
                Imagery credits
              </Link>
            </div>
          </Grid12>
        </Container>
      </Band>

      {/* ---- 05 · COMPOSITION ---- */}
      <Band top="open" bottom="open">
        <Container>
          <Grid12>
            <div className="col-span-12 lg:col-span-5">
              <BandHead
                eyebrow="04 / Composition"
                title="The frame carries its own record."
              >
                <p className="mt-5 max-w-[44ch] text-body text-paper-dim">
                  The downlinked frame is graded for print. A raw satellite product is flatter
                  and colder than anything you would want on a wall; grading returns the
                  ground to the colour it had on the day it was photographed, and no further.
                </p>
                <p className="mt-4 max-w-[44ch] text-body text-paper-dim">
                  Then the capture is set into the print layout. The layout is identical for
                  every mission and is not configurable, which is deliberate. Coordinates in
                  decimal degrees, the capture timestamp, the sensor and orbit track, the
                  mission code and the print credit are laid on the sheet in fixed positions.
                </p>
                <p className="mt-4 max-w-[44ch] text-body text-paper-dim">
                  Each print reads as one file out of an archive rather than a one-off poster,
                  and two prints of two different addresses hang together.
                </p>
              </BandHead>
            </div>

            <div className="col-span-12 lg:col-span-6 lg:col-start-7">
              <ImagePlate
                src={PLATE_COMPOSITION.src}
                alt={`Satellite capture of ${PLATE_COMPOSITION.city}, ${PLATE_COMPOSITION.country}`}
                width={PLATE_COMPOSITION.width}
                height={PLATE_COMPOSITION.height}
                aspect="7 / 5"
                lat={PLATE_COMPOSITION.lat}
                lon={PLATE_COMPOSITION.lon}
                capturedAt={PLATE_COMPOSITION.acquired.date ?? undefined}
                tags={['FMT-70', '7:10']}
                credit
                creditAlign="left"
                sizes="(min-width: 1024px) 50vw, 100vw"
                caption="The credit box and the capture record are printed with the frame. Nothing on the sheet is decorative."
              />
            </div>
          </Grid12>
        </Container>
      </Band>

      {/* ---- 06 · PRINT AND SHIPPING ---- */}
      <Band top="open" bottom="open">
        <Container>
          <Grid12>
            <div className="col-span-12 lg:col-span-6">
              <BandHead
                eyebrow="05 / Print and shipping"
                title="Printed in your region, not shipped across the world."
              >
                <p className="mt-5 max-w-[48ch] text-body text-paper-dim">
                  The print file is released to the production facility nearest the delivery
                  address — {PRINT_FACILITY.US} for orders in the United States,{' '}
                  {PRINT_FACILITY.EU} for orders in the European Union, the United Kingdom and
                  Switzerland. Short transit, no customs surprises, and the print spends days
                  in a box rather than weeks.
                </p>
                {/* Materials read from lib/guarantees.ts, which describes what
                    lib/integrations/gelato.ts actually orders. This paragraph
                    used to promise pigment ink on museum-grade cotton glazed
                    with anti-glare acrylic — none of which is in the
                    fulfilment catalogue. */}
                <p className="mt-4 max-w-[48ch] text-body text-paper-dim">
                  Unframed prints are {MATERIALS.paperUnframed}, and ship{' '}
                  {PACKAGING.unframedPhrase}. Framed prints are {MATERIALS.paperFramed} in a{' '}
                  {MATERIALS.frameLower} frame with {MATERIALS.glazing} glazing, and ship{' '}
                  {PACKAGING.framedPhrase}. The price shown is the price paid: shipping and
                  any import duties are already in it.
                </p>
                <p className="mt-4 max-w-[48ch] text-body text-paper-dim">
                  Production and delivery take a few days once the capture is approved. The
                  variable in a mission is the capture window, never the printing.
                </p>
              </BandHead>
            </div>

            <div className="col-span-12 lg:col-span-5 lg:col-start-8">
              <SpecRows
                rows={FORMATS.flatMap((f) => [
                  {
                    label: `${f.metric} · unframed`,
                    value: `${formatPrice(priceMinor(f.id, 'UNFRAMED', 'USD'), 'USD')} / ${formatPrice(
                      priceMinor(f.id, 'UNFRAMED', 'EUR'),
                      'EUR',
                    )}`,
                  },
                  {
                    label: `${f.metric} · framed`,
                    value: `${formatPrice(priceMinor(f.id, 'FRAMED', 'USD'), 'USD')} / ${formatPrice(
                      priceMinor(f.id, 'FRAMED', 'EUR'),
                      'EUR',
                    )}`,
                  },
                ]).concat([{ label: 'Shipping and duties', value: 'Included' }])}
              />

              {/* The second of the page's three controls, directly under the
                  only full price table on the site. This is the point in the
                  scroll where a reader has just learned what it costs.

                  IT IS THE ONE CONTROL ON THIS PAGE STILL OPENING `/start`,
                  and that is deliberate. The table beside it is `lib/pricing`,
                  the print catalogue — EUR 170 at 30 x 40 unframed.
                  `/mission` prices by tier and adds the catalogue's size
                  difference on top, so the cheapest thing it can charge for
                  that sheet is EUR 79 as an archive frame or EUR 189 as a
                  commission; EUR 170 is unreachable there. Sending a reader
                  from a price table to a checkout that charges other numbers
                  is CONFIGURATOR.md §3.2's defect, so this button stays on
                  the funnel whose prices the table publishes. Unify the two
                  price lists (INTEGRATIONS.md §10) and this href becomes
                  `/mission` with no other change. */}
              <div className="mt-8">
                <Button href="/start" variant="primary" size="lg">
                  Start a mission
                </Button>
              </div>
            </div>
          </Grid12>
        </Container>
      </Band>

      <PlateBand
        frame={PLATE_PRINT}
        alt={`Satellite capture of ${PLATE_PRINT.city} against the hard edge of the desert`}
        height="h-[280px] sm:h-[420px]"
      />

      {/* ---- 07 · MISSION CONTROL ---- */}
      <Band top="open" bottom="open">
        <Container>
          <Grid12>
            <div className="col-span-12 lg:col-span-5">
              <BandHead eyebrow="06 / Mission control" title="Every order opens a file.">
                <p className="mt-5 max-w-[44ch] text-body text-paper-dim">
                  Each mission gets a code — two digits and two letters — and a file at{' '}
                  {missionShortLink('32BF')}. From the moment payment clears, that file is the
                  mission: the stage it is in, the tasking record, the capture window, the
                  preview frame the moment it is downlinked, and the print and shipping
                  records.
                </p>
                <p className="mt-4 max-w-[44ch] text-body text-paper-dim">
                  You can talk to the mission from that page. Mission Control answers questions
                  about your specific capture in writing, and can be put on a voice link if you
                  would rather ask out loud. Every file also carries a read-only share link, so
                  you can send someone the mission without handing over your address or your
                  order.
                </p>
                <p className="mt-4 max-w-[44ch] text-body text-paper-dim">
                  Nine stages, in order, each one timestamped as it happens:
                </p>
              </BandHead>
            </div>

            <div className="col-span-12 lg:col-span-6 lg:col-start-7">
              <NumberedList items={STAGE_ITEMS} />
            </div>
          </Grid12>
        </Container>
      </Band>

      {/* ---- 08 · ACTION ---- */}
      <Band top="snug" bottom="open" className="border-t border-hairline">
        <Container>
          <Grid12 className="items-end">
            <div className="col-span-12 lg:col-span-7">
              <p className="text-label uppercase text-paper-faint">Start here</p>
              <h2 className="mt-5 max-w-[20ch] text-display text-paper">
                One address is all a mission needs to start.
              </h2>
              <PriceTerms className="mt-5" />
            </div>
            {/* <Button> rather than the hand-rolled anchors that used to be
                here: it is the site's one control, and two controls that look
                nearly alike but are built differently drift apart. */}
            <div className="col-span-12 mt-8 flex flex-wrap items-center gap-3 lg:col-span-4 lg:col-start-9 lg:mt-0 lg:justify-end">
              <Button href="/mission" variant="primary" size="lg">
                Start a mission
              </Button>
              <Button href="/missions" variant="secondary" size="lg">
                Mission archive
              </Button>
            </div>
          </Grid12>
        </Container>
      </Band>
    </main>
  );
}
