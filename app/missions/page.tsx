import type { Metadata } from 'next';
import { Band, Button, Container } from '@/components/fui';
import { ArchiveHero } from '@/components/discovery/ArchiveHero';
import { FleetTracker } from '@/components/satellites';
import { fetchFleetElements } from '@/lib/integrations/celestrak';
import { ArchiveIndex, type ArchiveEntry } from '@/components/discovery/ArchiveIndex';
import { FeaturedGrid } from '@/components/discovery/FeaturedGrid';
import { MissionLookup } from '@/components/discovery/MissionLookup';
import { PlateStrip } from '@/components/discovery/PlateStrip';
import { SpecList } from '@/components/discovery/SpecList';
import {
  archiveIndexMeta,
  archiveRegionFor,
  frameAlt,
  getExampleMissionBySlug,
  listExampleMissions,
  titleCase,
  type ExampleMission,
} from '@/lib/gallery';
import { acquisitionLabel, frameBySlug } from '@/lib/imagery';

export const metadata: Metadata = {
  title: 'Mission archive',
  description:
    'Reference frames from the public Landsat archive, filed the way every Shot from Space mission is filed: one plate, one mission sheet, one credit.',
  openGraph: {
    title: 'Mission archive — Shot from Space',
    description:
      'Reference frames from the public Landsat archive, composed exactly the way a customer frame is composed.',
    type: 'website',
  },
};

/**
 * The two frames the page itself carries, outside the index.
 *
 * The hero is deliberately NOT the most recent capture: that frame is
 * already the lead item of the index below, and a page should not open with
 * the same picture it leads with. Paris is a false-colour Landsat-5 product —
 * living vegetation returned as red — which is a different kind of frame
 * from anything in the mosaic underneath it.
 */
const HERO = frameBySlug('paris-fr');
const STRIP = frameBySlug('cape-town-za');

/**
 * The mosaic. Six frames chosen for what they show rather than for when they
 * were taken — a delta, a city on water, a desert edge, an estuary, a coast
 * and an oasis — so the block reads as a range of subjects and not as a
 * page of the same picture six times. The hero and the strip are excluded
 * because they are already on this page.
 */
const FEATURED_SLUGS = [
  'sao-paulo-br',
  'lisse-nl',
  'las-vegas-us',
  'london-uk',
  'rio-de-janeiro-br',
  'samarkand-uz',
] as const;

/**
 * /missions — THE ARCHIVE.
 *
 * Archetypes, top to bottom:
 *
 *   §5.2  hero          one full-bleed capture, the site bar over it   dark
 *   §5.3  featured grid six frames at mixed spans, no gutters          dark
 *   §5.6  news / index  a lead item and a dated list, ordered by the
 *                       capture timestamp, filtered and sorted in place  paper
 *   §5.2  plate strip   one capture at zero padding, as a breath       dark
 *   §5.5  feature       the lookup, for a customer who has a code      paper
 *
 * A server component end to end. The full list is rendered here and handed to
 * <ArchiveIndex /> as data, so the page is complete before any JavaScript
 * arrives; the client control only ever narrows what is already on screen.
 */
export default async function MissionsPage() {
  // One CelesTrak request, cached three hours, shared by every visitor. The
  // readout below moves once a second regardless — propagation is local.
  const fleet = await fetchFleetElements();
  const serverNow = new Date().toISOString();

  const meta = archiveIndexMeta();

  // Flatten on the server: alt text and region are resolved here so the client
  // control never has to import the imagery catalogue.
  const entries: ArchiveEntry[] = listExampleMissions().map((m) => ({
    code: m.code,
    src: m.src,
    alt: frameAlt(m),
    locationLabel: m.locationLabel,
    city: m.city,
    country: m.country,
    summary: m.summary,
    acquiredLabel: m.acquiredLabel,
    acquiredDate: m.acquired.date,
    lat: m.lat,
    lon: m.lon,
    tags: m.tags,
    classification: m.classification,
    region: archiveRegionFor(m.countryCode),
  }));

  const featured = FEATURED_SLUGS.map(getExampleMissionBySlug).filter(
    (m): m is ExampleMission => Boolean(m),
  );

  const fileCount = String(meta.count).padStart(2, '0');

  return (
    <main>
      {HERO ? (
        <ArchiveHero
          src={HERO.src}
          alt="Paris in false colour, the Bois de Boulogne and the Bois de Vincennes reading as two dark red lobes either side of the city, with the Seine crossing from southeast to northwest."
          eyebrow="Mission archive"
          title="Every mission ends as a file."
          body="Reference frames from the public Landsat archive, composed exactly the way a customer frame is composed — the same plate, the same mission sheet, the same credit."
          lat={HERO.lat}
          lon={HERO.lon}
          target={`${HERO.city} · ${HERO.admin}`}
          meta={`${fileCount} files on record`}
        />
      ) : null}

      {/* DARK — the featured grid, butted straight onto the hero so the two
          read as one block of picture before the writing starts. The header
          keeps the content column; the mosaic runs full-bleed under it. */}
      <Band top="open" bottom="flush" tone="dark">
        <Container>
          <div className="flex flex-col gap-6 min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between min-[768px]:gap-12">
            <div>
              <p className="text-label uppercase ink-dim">Selected frames</p>
              <h2 className="mt-5 max-w-[22ch] text-display ink min-[1920px]:max-w-[28ch]">
                Six places, six passes, one archive.
              </h2>
            </div>
            <p className="max-w-[44ch] text-body ink-dim min-[768px]:text-right">
              Open any of them and the whole file opens with it: the capture, the observation,
              the pass geometry and the print it would become.
            </p>
          </div>
        </Container>

        <FeaturedGrid missions={featured} className="mt-10 min-[1280px]:mt-14" />
      </Band>

      {/* DARK — THE FLEET. Real satellites, real elements, propagated live.
          It sits directly under the archive because the two answer the same
          question from opposite ends: the archive is what a pass produced,
          this is the passes happening while you read.

          The standfirst carries the disclaimer rather than a footnote. A
          tracker on a page that sells satellite tasking implies these are
          the satellites doing the tasking, and they are not — so the second
          sentence says so before the cards get a chance to imply it. */}
      <Band top="open" bottom="open" tone="dark">
        <Container>
          <div className="flex flex-col gap-6 min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between min-[768px]:gap-12">
            <div>
              <p className="text-label uppercase ink-dim">Overhead now</p>
              <h2 className="mt-5 max-w-[22ch] text-display ink min-[1920px]:max-w-[28ch]">
                Eight imaging satellites, and where they are this second.
              </h2>
            </div>
            <p className="max-w-[46ch] text-body ink-dim min-[768px]:text-right">
              Live orbital elements, propagated in your browser. These are not the satellites
              assigned to your mission — tasking is brokered at capture time and the spacecraft
              is very often none of these. They are simply what is up there, and where.
            </p>
          </div>

          <FleetTracker
            className="mt-10 min-[1280px]:mt-14"
            elements={fleet.elements}
            source={fleet.source}
            serverNow={serverNow}
          />
        </Container>
      </Band>

      {/* PAPER — the index. The words that introduce it and the specification
          of what it holds sit above the list, on one ground. */}
      <Band top="open" bottom="open" tone="light">
        <Container>
          <div className="grid grid-cols-1 items-start gap-12 min-[1280px]:grid-cols-12 min-[1280px]:gap-x-[var(--gutter-shell)] min-[1920px]:gap-x-20">
            <div className="min-[1280px]:col-span-6 min-[1920px]:col-span-5">
              <p className="text-label uppercase ink-dim">Archive index</p>
              <h2 className="mt-6 max-w-[18ch] text-display ink">
                Open one and you are reading the whole file.
              </h2>
              <p className="mt-6 max-w-[56ch] text-body ink-dim">
                Coordinates, sensor, pass geometry, cloud cover at capture, the written
                observation and the source it came from. Every file is composed the way a
                customer&rsquo;s own frame is composed. The only thing missing is your address.
              </p>
            </div>

            <SpecList
              className="min-[1280px]:col-span-5 min-[1280px]:col-start-8 min-[1920px]:col-span-6 min-[1920px]:col-start-7"
              columns={2}
              items={[
                { label: 'Files on record', value: fileCount },
                { label: 'Countries', value: String(meta.countries).padStart(2, '0') },
                { label: 'Resolution', value: `${meta.gsdM} m GSD` },
                {
                  label: 'Capture window',
                  value: `${meta.earliest ?? '—'} — ${meta.latest ?? '—'}`,
                  mono: true,
                },
                { label: 'Source', value: 'NASA / USGS Landsat' },
                { label: 'Classification', value: 'Declassified' },
              ]}
            />
          </div>

          <div className="mt-14 min-[1280px]:mt-20 min-[1920px]:mt-24">
            <ArchiveIndex entries={entries} />
          </div>
        </Container>
      </Band>

      {/* DARK — one plate at zero padding, between two paper bands. */}
      {STRIP ? (
        <PlateStrip
          src={STRIP.src}
          alt="The Cape Peninsula reaching south from Table Mountain, with False Bay to the east."
          label={`${titleCase(STRIP.city)} — filed under Africa`}
          meta={acquisitionLabel(STRIP.acquired)}
        />
      ) : null}

      {/* PAPER — how a customer reaches their own live file. */}
      <Band top="open" bottom="open" tone="light">
        <Container>
          <div className="grid grid-cols-1 items-start gap-12 min-[1280px]:grid-cols-12 min-[1280px]:gap-x-[var(--gutter-shell)] min-[1920px]:gap-x-20">
            <div className="min-[1280px]:col-span-6 min-[1920px]:col-span-5">
              <p className="text-label uppercase ink-dim">Mission lookup</p>
              <h2 className="mt-6 max-w-[16ch] text-display ink">Open a live mission file.</h2>
              <p className="mt-6 max-w-[52ch] text-body ink-dim">
                A running mission has its own file, updated as the satellite is tasked, the frame
                is acquired and the print ships.
              </p>
              <MissionLookup className="mt-10" />
            </div>

            <div className="flex flex-col items-start gap-7 border-t pt-9 rule-ground min-[1280px]:col-span-4 min-[1280px]:col-start-9 min-[1280px]:border-t-0 min-[1280px]:pt-0 min-[1920px]:col-span-4 min-[1920px]:col-start-9">
              <p className="max-w-[40ch] text-body ink-dim">
                No code yet. A mission starts with an address and ends with a framed photograph
                of it, taken from orbit.
              </p>
              <Button href="/mission" variant="secondary" size="lg">
                Start a mission
              </Button>
            </div>
          </div>
        </Container>
      </Band>
    </main>
  );
}
