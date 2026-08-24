import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Band, Container, OrbitDiagram } from '@/components/fui';
import { ArchiveNav } from '@/components/discovery/ArchiveNav';
import { CapturePanel } from '@/components/discovery/CapturePanel';
import { ConversionBand } from '@/components/discovery/ConversionBand';
import { DeliverablePreview } from '@/components/discovery/DeliverablePreview';
import { DossierSection } from '@/components/discovery/DossierSection';
import { MissionArtifact } from '@/components/discovery/MissionArtifact';
import { MissionPlate } from '@/components/discovery/MissionPlate';
import { SheetMark } from '@/components/discovery/SheetMark';
import { SpecList } from '@/components/discovery/SpecList';
import { ProviderBar } from '@/components/site/ProviderBar';
import {
  archiveNeighbours,
  frameAlt,
  getExampleMission,
  listExampleMissions,
  titleCase,
} from '@/lib/gallery';
import { getFormat } from '@/lib/pricing';
import { formatCoords, formatCoordsHemisphere } from '@/lib/utils';

type Params = { code: string };

/** Display magnification of the detail plate. The readout states it. */
const DETAIL_MAG = 1.75;

/** Every example mission is prerendered. Unknown codes fall through to 404. */
export function generateStaticParams(): Params[] {
  return listExampleMissions().map((m) => ({ code: m.code }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { code } = await params;
  const mission = getExampleMission(code);

  if (!mission) {
    return {
      title: 'File not found',
      description: 'No file in the reference archive matches that mission code.',
      robots: { index: false },
    };
  }

  const place = `${titleCase(mission.city)}, ${titleCase(mission.country)}`;
  const title = `MISSION ${mission.code} — ${place}`;

  return {
    title,
    description: mission.summary,
    alternates: { canonical: `/missions/${mission.code}` },
    openGraph: {
      title: `${title} — Shot from Space`,
      description: mission.summary,
      type: 'article',
      url: `/missions/${mission.code}`,
      images: [
        {
          url: mission.src,
          width: mission.width,
          height: mission.height,
          alt: frameAlt(mission),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: mission.summary,
      images: [mission.src],
    },
  };
}

/**
 * /missions/[code] — THE MISSION DOSSIER.
 *
 * Archetypes, top to bottom:
 *
 *   §5.2  hero              the capture, full bleed, the site bar over it
 *   §5.5  feature           observation — media right, the written record
 *                           and one orbit schematic on the paper
 *   §5.5  feature           telemetry — media left (the mission patch on a
 *                           raised paper panel), the as-flown specification
 *   §5.5  feature           deliverable — media right (the composed poster
 *                           straight out of /api/poster), how it prints
 *   §5.6  index band        source, credit and the provider bar
 *   §5.3  featured pair     previous and next, two plates butting
 *   §5.5  feature           the conversion close, with the coin
 *
 * The media side alternates all the way down, and the ground alternates with
 * the content rather than with the section: photographs take the void,
 * writing and specification take the paper.
 *
 * Entirely static — the archive is compile-time data.
 */
export default async function MissionDossierPage({ params }: { params: Promise<Params> }) {
  const { code } = await params;
  const mission = getExampleMission(code);
  if (!mission) notFound();

  const { prev, next } = archiveNeighbours(mission.code);
  const format = getFormat(mission.formatId);
  const { orbit } = mission;
  const place = titleCase(mission.city);

  return (
    <main>
      {/* §5.2 — the plate, full bleed, the only place the mission code and
          the place name are set large. */}
      <MissionPlate mission={mission} />

      {/* §5.5 — OBSERVATION. Media right: the same capture read closer, on
          its own dark ground inside a paper band. */}
      <DossierSection
        side="right"
        ground="plate"
        media={
          <CapturePanel
            className="h-full w-full"
            src={mission.src}
            alt={`Magnified detail from the ${place} capture, centre of frame.`}
            magnify={DETAIL_MAG}
            label="Frame detail"
            meta={`MAG ×${DETAIL_MAG.toFixed(2)} — ${orbit.gsdM} M GSD`}
            sizes="(min-width: 1280px) 100vw, 175vw"
          />
        }
      >
        <p className="text-label uppercase ink-dim">Observation</p>
        <h2 className="mt-6 max-w-[18ch] text-display ink">What the pass recorded.</h2>
        <p className="mt-7 max-w-[58ch] text-body ink-dim min-[1920px]:mt-9">{mission.summary}</p>

        {/* Exactly one orbit schematic per viewport. It animates: the marker
            travels the track it is drawn on. */}
        <OrbitDiagram
          className="mt-10 min-[1920px]:mt-12"
          animated
          track={orbit.track}
          inclination={orbit.inclination}
          altitudeKm={orbit.altitudeKm}
          size={132}
        />
      </DossierSection>

      {/* §5.5 — TELEMETRY. Media left: the mission patch, a real object
          photographed on white, so it stays on the paper half. */}
      <DossierSection
        side="left"
        ground="panel"
        media={
          <MissionArtifact
            className="w-full min-[1920px]:max-w-[380px]"
            src="/brand/mission-patch.png"
            alt="A render of an embroidered mission patch, square on, its stitched edge catching the light."
            label="Mission patch"
            detail="Conferred on every mission and held on its file. Honorary and digital: nothing beyond the print is manufactured or posted."
            sizes="(min-width: 1280px) 24vw, 60vw"
          />
        }
      >
        <p className="text-label uppercase ink-dim">Telemetry</p>
        <h2 className="mt-6 max-w-[16ch] text-display ink">As flown.</h2>
        <p className="mt-7 max-w-[52ch] text-body ink-dim">
          The pass that produced the frame above, as it was recorded: where the sensor was,
          what it was pointed at and what the sky was doing at the moment of capture.
        </p>
        <SpecList
          className="mt-10 min-[1920px]:mt-12"
          columns={3}
          items={[
            { label: 'Coordinates', value: formatCoords(mission.lat, mission.lon), mono: true },
            {
              label: 'Position',
              value: formatCoordsHemisphere(mission.lat, mission.lon, 2),
              mono: true,
            },
            { label: 'City', value: place },
            { label: 'Admin area', value: titleCase(mission.admin) },
            { label: 'Country', value: titleCase(mission.country) },
            {
              label: 'Captured',
              value: mission.acquiredLabel,
              mono: true,
            },
            { label: 'Sensor', value: orbit.sensor },
            { label: 'Altitude', value: `${orbit.altitudeKm} km` },
            { label: 'Ground sample', value: `${orbit.gsdM} m` },
            { label: 'Pass azimuth', value: `${orbit.azimuthDeg}°` },
            { label: 'Off-nadir', value: `${orbit.offNadirDeg}°` },
            {
              label: 'Cloud cover',
              value: `${orbit.cloudPct}%`,
              signal: orbit.cloudPct > 15,
            },
          ]}
        />
      </DossierSection>

      {/* §5.5 — DELIVERABLE. Media right: the composed plate for this file,
          rendered by /api/poster, so it changes when the composer changes. */}
      <DossierSection
        side="right"
        ground="panel"
        media={
          <DeliverablePreview
            className="w-full max-w-[460px] min-[1920px]:max-w-[560px]"
            code={mission.code}
            slug={mission.slug}
            ratio={format.ratio}
            framed
            detail="Composed by the same pipeline that produces the print file: the capture above, the mission sheet below. Shown watermarked, at preview resolution, in a display mount."
          />
        }
      >
        <p className="text-label uppercase ink-dim">Deliverable</p>
        <h2 className="mt-6 max-w-[16ch] text-display ink">How it would be printed.</h2>
        <p className="mt-7 max-w-[52ch] text-body ink-dim">{format.note}</p>
        <SpecList
          className="mt-10 min-[1920px]:mt-12"
          columns={2}
          items={[
            { label: 'Format', value: format.metric },
            { label: 'Imperial', value: format.imperial },
            { label: 'Ratio', value: format.ratio },
            { label: 'Finish', value: titleCase(mission.frame) },
            { label: 'Print facility', value: mission.printFacility },
          ]}
        />
      </DossierSection>

      {/* PAPER — source, credit, and who the imagery is actually bought from.
          Back in the content column: this is a record, not a feature. */}
      <Band top="open" bottom="open" tone="light">
        <Container>
          {/* Public-domain attribution. Rendering this is a licensing
              requirement, not a footnote we are free to drop. */}
          <div className="grid grid-cols-1 items-start gap-10 min-[1280px]:grid-cols-12 min-[1280px]:gap-x-[var(--gutter-shell)] min-[1920px]:gap-x-20">
            <div className="min-[1280px]:col-span-5 min-[1920px]:col-span-4">
              <p className="text-label uppercase ink-dim">Source</p>
              <p className="mt-6 max-w-[48ch] text-body ink-dim">
                This reference frame is a public-domain NASA / USGS Landsat product. It stands in
                for a customer capture, which is tasked commercially and delivered at higher
                resolution.
              </p>
            </div>
            <dl className="flex flex-col gap-6 min-[1280px]:col-span-6 min-[1280px]:col-start-7 min-[1920px]:col-span-7 min-[1920px]:col-start-6 min-[1920px]:flex-row min-[1920px]:gap-16">
              <div className="flex flex-col gap-2 min-[1920px]:flex-1">
                <dt className="text-label uppercase ink-dim">Credit</dt>
                <dd className="text-body break-words ink">{mission.credit}</dd>
              </div>
              <div className="flex flex-col gap-2 min-[1920px]:flex-1">
                <dt className="text-label uppercase ink-dim">Source</dt>
                <dd className="break-all">
                  <a
                    href={mission.source}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link-underline inline-flex min-h-11 items-center text-body ink min-[1280px]:min-h-0"
                  >
                    {mission.source}
                  </a>
                </dd>
              </div>
            </dl>
          </div>

          {/* Who actually takes the picture, said accurately. Type, not
              trademarks — the reasoning is in the component. */}
          <ProviderBar className="mt-14 min-[1280px]:mt-16" />

          {/* The mark closes the paper section the way it closes the paper
              half of the poster: bottom right, solid, its own shadow. */}
          <SheetMark className="mt-14 min-[1280px]:mt-16" />
        </Container>
      </Band>

      {/* §5.3 — previous and next, two plates butting each other. */}
      <ArchiveNav prev={prev} next={next} />

      <ConversionBand />
    </main>
  );
}
