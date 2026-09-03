'use client';

import Image from 'next/image';
import { clsx as cn } from 'clsx';
import { BriefEntryCard } from '@/components/brief';
import { Container, Grid12, MetaPill } from '@/components/fui';
import { missionShortLink } from '@/lib/codes';
import { acquisitionLabel } from '@/lib/imagery';
import { pickFrameForCoords } from '@/lib/missions/frames';
import { MISSION_STAGES, STAGE_LABEL, stageIndex, type MissionDTO } from '@/lib/types';
import { formatCoords, formatTelemetryTimestamp } from '@/lib/utils';
import { ChromeMark } from './ChromeMark';
import { CopyControl } from './CopyControl';
import { BELOW_BAR } from './layout';
import { STAGE_SUMMARY, coordDp, facilityCity } from './telemetry';
import { Chip, FILE_LABEL, FILE_S, FileHead, MetaGroup, MetaRow, MissionRef } from './ui';

/**
 * THE MASTHEAD — the top sheet of the report, on a picture of the ground.
 *
 * Four things, in the order a flight report puts them: a classification strip
 * across the head of the sheet, the mission lockup, the one large display
 * line saying what the file is doing right now, and the meta row every
 * subsequent page is read against.
 *
 * THE STRIP IS NOT A SECRECY CLAIM. This company photographs houses from
 * orbit; it holds nothing classified and must never imply that it does. The
 * markings are the house's own routing scheme — which desk owns the file, who
 * it may be released to — and the meta row says so in as many words, because
 * a document language borrowed from declassified paperwork is only honest if
 * it is labelled as a borrowing.
 *
 * ==================================================================
 * THE PLATE, AND THE ONE THING IT MUST NOT SAY
 * ==================================================================
 * The masthead's ground is a wide crop of a satellite frame, full bleed,
 * composed in the language <MissionPlate /> and <ArchiveHero /> already
 * speak: the picture runs edge to edge and under the site bar, the copy sits
 * along its FOOT, and two scrims separate the two.
 *
 * WHICH FRAME. The one this mission is bound to. `lib/missions/state.ts`
 * binds a mission to a catalogue frame at IMAGE_ACQUIRED with
 * `pickFrameSlugForCoords(lat, lon)`, and `app/api/poster` falls back to the
 * same rule for a mission that has not got there yet — so calling
 * `pickFrameForCoords` here returns the mission's own frame at every stage of
 * its life, by the same deterministic rule, with no second source of truth
 * and nothing to drift.
 *
 * IT IS NOT THIS MISSION'S CAPTURE AND IT SAYS SO. These are public-domain
 * NASA / USGS Landsat products standing in for a capture that is tasked
 * commercially (see IMAGERY.md, and the source band on /missions/[code]).
 * Dropping one behind a mission's own masthead without a word would be the
 * file's first and worst lie, so the plate carries a credit naming the
 * sensor, the place and the acquisition date the source record actually
 * states, and the meta row below carries the sentence in full. The
 * mission's real frame — watermarked, released at IMAGE_ACQUIRED — is the
 * exhibit's job and stays the exhibit's job.
 *
 * ==================================================================
 * WHY EVERY STRING OVER IT STILL MEASURES
 * ==================================================================
 * Nothing is set over a photograph and hoped for, and nothing depends on how
 * tall a headline happens to wrap. The picture is its own element at its own
 * height (`--crop-h`), the ramp over it reaches SOLID void at 74% of that
 * height, and the identity block is pulled up by exactly the remaining 26%
 * (`--crop-tail`) — so the lockup, the title, the summary, the status chip
 * and the credit all sit visually inside the picture and measure against
 * `--color-void` itself, at exactly the ratios the file's dark bands have
 * always measured (16.99:1 paper, 7.54:1 dim, 6.0:1 signal). The photograph
 * is read in the 74% above, where the only string is <MetaPill />, which
 * carries its own opaque `--ink` fill.
 *
 * That matters most for the smallest type on the page. The file's telemetry
 * is 10–13px Typestar; there is no size margin at all to spend, so the
 * margin is bought with the scrim instead.
 *
 * THE TOP OF THE PLATE FADES FROM SOLID VOID. Not a taste decision:
 * <SearchingForPass /> mounts above this section and cancels the masthead's
 * bar clearance with a negative bottom margin, so before IMAGE_ACQUIRED the
 * plate's first ~90px sit UNDER that card's opaque void ground. Starting the
 * picture at full void makes that junction a fade rather than a cut, and
 * gives the floating site bar the same dark head to sit on when the card is
 * not there.
 */

/**
 * THE CROP BAND — the picture's own element, and its own exact height.
 *
 * Two numbers per width, and they are one decision stated twice:
 *
 *   --crop-h     the band's total height. The picture fills it.
 *   --crop-tail  how much of that band, measured from its foot, the ramp has
 *                already carried to SOLID void. The identity block is pulled
 *                up by exactly this much and therefore sits on `--color-void`
 *                itself, whatever the copy's height turns out to be.
 *
 * The tail is 26% of the band at every width, which is where PLATE_RAMP
 * closes. Stating it as a token rather than deriving it in a calc is what
 * lets a reviewer check the pair against the gradient by eye.
 *
 * Visible picture, therefore: 266 / 310 / 348 / 370 / 414 / 459 px, against
 * the full width of the viewport. At 1440 that is a 3.9:1 crop; at 2400,
 * 5.2:1. Wide, at every width that has the room to be.
 */
const CROP = [
  '[--crop-h:360px] [--crop-tail:94px]',
  'min-[768px]:[--crop-h:420px] min-[768px]:[--crop-tail:110px]',
  'min-[1280px]:[--crop-h:470px] min-[1280px]:[--crop-tail:122px]',
  'min-[1440px]:[--crop-h:500px] min-[1440px]:[--crop-tail:130px]',
  'min-[1920px]:[--crop-h:560px] min-[1920px]:[--crop-tail:146px]',
  'min-[2400px]:[--crop-h:620px] min-[2400px]:[--crop-tail:160px]',
].join(' ');

/**
 * The legibility ramp, stated as a gradient rather than as Tailwind stops
 * because the numbers are the whole argument: 14% void at the head of the
 * band, deepening through 45% at its middle, and FULLY OPAQUE from 74% of
 * the band down. Everything typeset on this masthead is below that 74%, so
 * every string is measured against void and not against a photograph.
 */
const PLATE_RAMP =
  'linear-gradient(to bottom,' +
  ' color-mix(in srgb, var(--color-void) 14%, transparent) 0%,' +
  ' color-mix(in srgb, var(--color-void) 45%, transparent) 46%,' +
  ' var(--color-void) 74%,' +
  ' var(--color-void) 100%)';

export function MissionMasthead({
  mission,
  variant,
  fileLink,
  reached,
}: {
  mission: MissionDTO;
  variant: 'owner' | 'shared';
  fileLink: string;
  /** Stages complete, for the stage-position reading. */
  reached: number;
}) {
  const shared = variant === 'shared';
  const cancelled = mission.state === 'CANCELLED';
  const shortLink = mission.shortLink || missionShortLink(mission.code);
  const facility = facilityCity(mission);
  const position = stageIndex(mission.stage) + 1;

  const frame = pickFrameForCoords(mission.lat, mission.lon);
  const frameCredit = `${frame.orbit.sensor} · ${frame.city}, ${frame.country} · ${acquisitionLabel(frame.acquired)}`;

  return (
    <section className={cn('surface-dark relative isolate', CROP)}>
      {/* THE CROP — the picture, full bleed, at its own height. */}
      <div className="relative h-[var(--crop-h)] w-full overflow-hidden">
        <Image
          src={frame.src}
          alt={`Satellite frame of ${frame.city}, ${frame.country} — the archive frame this mission file is filed against.`}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />

        {/* Legibility scrims — functional, never a decorative wash. */}
        <div aria-hidden className="absolute inset-0 z-[2] bg-void/12" />
        <div aria-hidden className="absolute inset-0 z-[2]" style={{ backgroundImage: PLATE_RAMP }} />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 z-[2] h-40 bg-linear-to-b from-void via-void/55 to-transparent md:h-56"
        />

        {/* READOUT D1 — the strip is a stamped label, not four mono
            fragments floating between two hairlines. <MetaPill /> owns the
            shape, the inversion and the 390 behaviour, and its opaque `--ink`
            fill is why it is the one string allowed to sit high on the
            picture rather than in the ramp's foot. */}
        <Container className={cn('relative z-10', BELOW_BAR)}>
          <MetaPill
            label="Mission file markings"
            segments={[
              { label: 'Mission file', value: shortLink },
              { label: 'Handling', value: 'Routine' },
              { label: 'Release', value: shared ? 'Share key' : 'File holder' },
            ]}
          />
        </Container>
      </div>

      {/* THE IDENTITY — pulled up into the band's solid-void tail, so it
          reads as the foot of the picture and measures as void. */}
      <Container className="relative z-10 -mt-[var(--crop-tail)] pb-[var(--band-snug)]">
        <Grid12>
          {/* Seven columns from 1280, EIGHT from 1920. The content column
              stops growing at 1440 (`--column-max`), but `--text-mission-title`
              does not — it steps to 70 and then 78 — so a seven-column span
              that holds FINAL DELIVERABLE APPROACHING at 1440 breaks the word
              in half at 2400. The headline's measure has to widen with the
              headline. */}
          <div className="col-span-12 xl:col-span-7 xl2:col-span-8">
            <MissionRef code={mission.code} size="lg" />
            {mission.missionName ? (
              <p className="mt-3 font-mono text-tele uppercase tracking-wider text-paper-dim">
                {mission.missionName}
              </p>
            ) : null}

            <FileHead
              flush
              className="mt-6"
              title={cancelled ? 'Mission cancelled' : STAGE_LABEL[mission.stage]}
            />

            <p className="mt-6 max-w-[var(--measure)] text-body text-paper-dim">
              {cancelled
                ? 'This mission was cancelled. The file stays open for reference, with everything it recorded before it closed.'
                : STAGE_SUMMARY[mission.stage]}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Chip
                label={cancelled ? 'Mission cancelled' : STAGE_LABEL[mission.stage]}
                state={cancelled ? 'alert' : 'active'}
              />
              {!shared ? (
                <CopyControl
                  value={fileLink}
                  label="Copy link"
                  copiedLabel="Link copied"
                  ariaLabel="Copy the link to this mission file"
                  variant="ghost"
                />
              ) : null}
            </div>

            {/* THE MISSION BRIEF (BRIEF-DECK §A). It is `position: fixed` at
                the bottom right of the VIEWPORT, so it takes no space here
                and it is mounted here only for its place in the tab order —
                straight after the file's identity, which is where a reader
                meets it. It stands itself down over the file's own controls
                at the foot of the page; see <BriefEntryCard />. */}
            <BriefEntryCard mission={mission} variant={variant} />
          </div>

          {/* The crest, and the credit the picture owes its source.

              The crest is decorative — `alt=""` rather than a name, because
              the file is already identified by its lockup and its heading and
              the wordmark is already in the site bar above it. Below 768 it
              is not drawn at all: the photograph now carries the masthead on
              a phone, and two objects at the head of a 390px column is one
              too many.

              The credit is NOT decorative and is drawn at every width. */}
          <div className="col-span-12 mt-8 flex flex-col gap-6 md:col-span-6 md:col-start-7 md:mt-0 md:items-end xl:col-span-4 xl:col-start-9 xl2:col-span-3 xl2:col-start-10">
            <ChromeMark
              role="masthead"
              size="md"
              ground="dark"
              alt=""
              priority
              className="hidden md:block"
            />
            <div className="md:text-right">
              <p className={cn(FILE_S, FILE_LABEL, 'text-paper-dim')}>
                Archive frame — not this capture
              </p>
              <p data-telemetry className={cn(FILE_S, 'mt-1.5 uppercase text-paper-dim')}>
                {frameCredit}
              </p>
            </div>
          </div>
        </Grid12>
      </Container>

      {/* THE RECORD, on void — the meta row every later band is read
          against. Off the picture entirely: eight rows of 10–13px Typestar
          is the densest type on the file and it is not set over anything. */}
      <Container className="pt-[var(--band-snug)] pb-[var(--band-open)]">
        <MetaGroup>
          <MetaRow label="Target">{mission.locationLabel}</MetaRow>
          <MetaRow label="Coordinates">
            {formatCoords(mission.lat, mission.lon, coordDp(mission))}
          </MetaRow>
          <MetaRow label="Deliverable">
            {mission.format.metric} / {mission.format.frame === 'FRAMED' ? 'Framed' : 'Unframed'} /{' '}
            {mission.format.designation}
          </MetaRow>
          <MetaRow label="Print region">
            {facility ? `${mission.region} / ${facility}` : `${mission.region} / facility pending`}
          </MetaRow>
          <MetaRow label="Stage">
            {String(position).padStart(2, '0')} / {String(MISSION_STAGES.length).padStart(2, '0')}{' '}
            — {STAGE_LABEL[mission.stage]} · {reached} complete
          </MetaRow>
          <MetaRow label="File opened">{formatTelemetryTimestamp(mission.createdAt)}</MetaRow>
          <MetaRow label="Header frame">
            {frame.city}, {frame.country} — {frame.orbit.sensor}, acquired{' '}
            {acquisitionLabel(frame.acquired)}. A public-domain NASA / USGS Landsat product and the
            nearest catalogue frame to this target. It stands in for this mission&rsquo;s capture and
            is not it; the capture is released to the exhibit below at IMAGE ACQUIRED.
          </MetaRow>
          <MetaRow label="Handling">
            The markings on this file are the house scheme for routing a print job. Nothing here is
            classified, and nothing is withheld from the account the mission was filed to.
          </MetaRow>
          <MetaRow label="This document">
            {shared
              ? 'A read-only copy of a live mission file. The timeline, the instruments, the exhibit and the public record update as the mission runs; the address, the receipt and the operator channel stay with its owner.'
              : 'Every stage of this mission is filed here as it happens, with the telemetry it happened under. The file refreshes itself while it is open and closes on delivery.'}
          </MetaRow>
        </MetaGroup>
      </Container>
    </section>
  );
}
