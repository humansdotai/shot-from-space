'use client';

import { clsx as cn } from 'clsx';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LicensedSeal } from '@/components/site/LicensedSeal';
import { Container, Grid12 } from '@/components/fui';
import { MISSION_STAGES, type MissionDTO } from '@/lib/types';
import { CurrentStagePanel } from './CurrentStagePanel';
import { HonoursBlock } from './HonoursBlock';
import { MissionActions } from './MissionActions';
import { MissionDataBlock } from './MissionDataBlock';
import { MissionExhibit } from './MissionExhibit';
import { MissionMasthead } from './MissionMasthead';
import { MissionTimeline } from './MissionTimeline';
import { ConditionsPanel } from './ConditionsPanel';
import { OrbitPlot } from './OrbitPlot';
import { SearchingForPass } from './SearchingForPass';
import { buildTimeline } from './telemetry';
import { FileHead, INK_DIM } from './ui';

const POLL_MS = 15_000;

/**
 * THE MISSION FILE — a flight report, not a dashboard.
 *
 * One document, read top to bottom, alternating ground band by band the way
 * the poster does: the photograph and the instruments on void, the record and
 * the specification on paper. Nothing repeats its neighbour's ground and
 * nothing repeats its neighbour's padding.
 *
 *   masthead        dark    mark, lockup, classification strip, meta row
 *   timeline        paper   nine stages and their real timestamps
 *   instruments     dark    conditions over the target, the orbit plotted
 *   specification   paper   everything the file knows, incl. the bars
 *   exhibit         dark    the print, framed, full-bleed
 *   honours         paper   the five honorary distinctions held on the file
 *   comms           dark    <MissionComms />, mounted exactly as it ships
 *   actions         paper   share, receipt, reorder, and the demo control
 *
 * The shared view (`/s`) drops comms and the controls and closes on its own
 * invitation, which is written for the dark ground — so the alternation still
 * lands on a dark band at the bottom.
 *
 * The shell around this is a Server Component; this layer is a client
 * boundary for one reason — the file keeps itself current. While the tab is
 * open and the mission is not closed it re-reads the mission every fifteen
 * seconds and reconciles the result, so the timeline moves forward under the
 * reader. Both routes compose this one component.
 */
export function MissionFile({
  mission: initialMission,
  variant = 'owner',
  isOwner = false,
  mockMode = false,
  pollUrl,
  siteOrigin,
  serverNow,
  shareToken,
  satellites,
  comms,
  cta,
}: {
  mission: MissionDTO;
  variant?: 'owner' | 'shared';
  isOwner?: boolean;
  mockMode?: boolean;
  /** Endpoint polled for fresh telemetry. Null disables polling. */
  pollUrl?: string | null;
  /** Server-known origin, used for copyable links until the client mounts. */
  siteOrigin: string;
  /** ISO clock read on the server, so the first paint predicts the same pass. */
  serverNow: string;
  /** Share key for the read-only link. Read on the server, owner views only. */
  shareToken?: string | null;
  /**
   * <FleetTracker /> rendered by the route, already carrying this mission's
   * target as its observer. Composed on the server because the CelesTrak
   * fetch belongs to the route, not to a client component.
   */
  satellites?: ReactNode;
  /** <MissionComms /> rendered by the route. Owner view only. */
  comms?: ReactNode;
  /** Closing call to action. Shared view only. */
  cta?: ReactNode;
}) {
  const mission = useLiveMission(initialMission, pollUrl ?? null);
  const now = useClientClock(serverNow);
  const origin = useOrigin(siteOrigin);

  const rows = buildTimeline(mission);
  const live = Boolean(pollUrl) && mission.stage !== 'DELIVERED';
  /* Still running: a closed or cancelled file has no elapsed time to report,
     so nothing on its timeline moves. <StageClock /> makes the argument. */
  const running = mission.stage !== 'DELIVERED' && mission.state !== 'CANCELLED';
  const shared = variant === 'shared';
  const reached = rows.filter((r) => r.status === 'done').length;

  /* The file's contents, in order, so every section head can state its own
     position in it. Built per variant because the shared view is genuinely a
     shorter document, and a `04 / 07` on a six-section page is a lie. */
  /* The sky section only exists when the route hands one in, so it is spliced
     rather than listed: a shared view with no tracker must not number its
     sections against a document that has one more than it does. */
  const sky = satellites ? ['sky'] : [];
  const sections: readonly string[] = shared
    ? ['timeline', 'instruments', 'record', 'exhibit', ...sky, 'honours', 'close']
    : ['timeline', 'instruments', 'record', 'exhibit', ...sky, 'honours', 'comms', 'actions'];
  const at = (id: string): [number, number] => [sections.indexOf(id) + 1, sections.length];

  return (
    <main>
      {/* D6 — the waiting moment. Renders nothing from IMAGE_ACQUIRED on. */}
      <SearchingForPass mission={mission} now={now} />

      <MissionMasthead
        mission={mission}
        variant={variant}
        fileLink={`${origin}/m/${mission.code}`}
        reached={reached}
      />

      {/* TIMELINE — paper. Nine stages, vertical at every width.

          Below 1280 the readout of the stage the mission is sitting on is
          filed inside that stage's row, where it belongs in the record. From
          1280 there is width for the two to stand side by side, so the column
          keeps the full grid and the readout takes a sticky rail beside it —
          the reader can scroll all nine stages without losing sight of what is
          happening now. Both are the same component at two widths; the one
          that is not in play is display:none, so it is out of the
          accessibility tree and never announced twice. */}
      <section className="surface-light pt-[var(--band-open)] pb-[var(--band-open)]">
        <Container>
          <FileHead
            as="h2"
            eyebrow="Sequence of events"
            title="Mission timeline"
            index={at('timeline')}
            flush
          />
          <p className={cn('mt-6 max-w-[var(--measure)] text-body', INK_DIM)}>
            {reached} of {MISSION_STAGES.length} stages complete. A stage that has been reached
            carries the time it was reached at; a stage still ahead carries the condition that
            opens it, and never a date this file does not hold.
          </p>

          <Grid12 className="mt-[var(--file-head-air)]">
            <div className="col-span-12 xl:col-span-8">
              <MissionTimeline
                rows={rows}
                now={now}
                running={running}
                detail={
                  <div className="xl:hidden">
                    <CurrentStagePanel mission={mission} now={now} live={live} orbit={false} />
                  </div>
                }
              />
            </div>

            <div className="col-span-12 hidden xl:col-span-3 xl:col-start-10 xl:block">
              <div className="sticky top-[var(--band-open)]">
                <CurrentStagePanel mission={mission} now={now} live={live} layout="rail" orbit={false} />
              </div>
            </div>
          </Grid12>
        </Container>
      </section>

      {/* INSTRUMENTATION — dark. The two readings that are about the sky
          rather than about the order: what the weather over the target is
          doing, and where the spacecraft is. Instruments belong on void for
          the same reason the exhibit does — they are drawn, not typeset. */}
      <section className="surface-dark pt-[var(--band-open)] pb-[var(--band-open)]">
        <Container>
          <FileHead
            as="h2"
            eyebrow="Instrumentation"
            title="Conditions and orbit"
            index={at('instruments')}
            flush
          />
          <p className={cn('mt-6 max-w-[var(--measure)] text-body', INK_DIM)}>
            The two live instruments on the file. Both read the same telemetry the timeline reads
            and neither predicts anything the record does not already hold.
          </p>

          {/* The lattice takes the whole column — it is built to close on a
              full row at 2, 3, 4 and 6 across, which only works at the
              column's own width. The plot sits under it with the note that
              says what it is and is not. */}
          <div className="mt-[var(--file-head-air)] flex flex-col gap-[var(--band-open)]">
            <ConditionsPanel mission={mission} />

            <Grid12 className="items-start">
              <div className="col-span-12 xl:col-span-6">
                <OrbitPlot mission={mission} />
              </div>
              <aside className="col-span-12 xl:col-span-4 xl:col-start-8">
                <p className={cn('max-w-[var(--measure)] text-body', INK_DIM)}>
                  Drawn from the pass telemetry this file holds — inclination, altitude,
                  off-nadir and look azimuth — and from nothing else. It is the geometry of the
                  pass, not a live position feed: the marker walks the plane at a reading pace,
                  and the marked point is the target under the track.
                </p>
              </aside>
            </Grid12>
          </div>
        </Container>
      </section>

      {/* SPECIFICATION — paper. Everything that does not belong beside the
          image, including the house handling metadata behind its bars. */}
      <section className="surface-light pt-[var(--band-snug)] pb-[var(--band-open)]">
        <Container>
          <FileHead
            as="h2"
            eyebrow="The record"
            title="Specification"
            index={at('record')}
            flush
          />
          <p className={cn('mt-6 max-w-[var(--measure)] text-body', INK_DIM)}>
            {shared
              ? 'The public projection of the file. The address, the receipt and the amount paid stay with its owner and are not carried on a shared link.'
              : 'Everything the file holds. Bars cover house routing metadata only — never your address, your receipt or anything else you are entitled to read at a glance.'}
          </p>
          <MissionDataBlock
            mission={mission}
            variant={variant}
            className="mt-[var(--file-head-air)]"
          />
        </Container>
      </section>

      {/* EXHIBIT — dark. Supplies its own bands and its own full-bleed wall. */}
      <MissionExhibit mission={mission} index={at('exhibit')} />

      {/* HONOURS — paper. The citation list belongs to the record half of the
          file, and the contact shadow these objects cast is authored for a
          light ground. */}
      {/* THE SKY — void. Real satellites over this mission's own target.

          It sits between the exhibit and the distinctions deliberately: the
          exhibit is the frame that came back, this is the sky it came from,
          and the distinctions are the marks left afterwards. Read top to
          bottom, that is the order the mission happened in.

          On VOID rather than paper, because it is the only section of the
          file whose subject is currently above the reader's head. */}
      {satellites ? (
        <section className="surface-dark pt-[var(--band-open)] pb-[var(--band-open)]">
          <Container>
            <FileHead
              as="h2"
              eyebrow="Overhead"
              title="The sky over this target"
              index={at('sky')}
              flush
            />
            <div className="mt-[var(--file-head-air)]">{satellites}</div>
          </Container>
        </section>
      ) : null}

      <section className="surface-light pt-[var(--band-open)] pb-[var(--band-open)]">
        <Container>
          <FileHead
            as="h2"
            eyebrow="Distinctions"
            /* NOT `Conferred on the mission`, and the reason is the FACE
               rather than the size: every <FileHead /> on this file is
               60px at 1440 and 28px at 390, and `MISSION TIMELINE` reads
               cleanly at exactly that size. `CONFERRED` does not — nine
               characters of closed round strokes (C O N F E R R E D) in
               a caps-only geometric (Ductile) is a wall with almost no
               silhouette to read along, and it wrapped to two lines at
               both widths. `DIGITAL ONLY` is twelve characters of open,
               distinct letterforms, sets on ONE line at 1440, and puts
               the owner's ruling — the distinctions are digital, not
               objects in the box — in the headline instead of only in
               the paragraph under it. */
            title="Digital only"
            index={at('honours')}
            flush
          />
          <HonoursBlock mission={mission} className="mt-[var(--file-head-air)]" />

          {/* The maker's seal closes the distinctions, which is the right
              place for it: it is the only mark on the page that is about the
              operation rather than about this mission. Right-aligned under
              the last citation, on the same paper the objects are cast onto —
              <Artifact3D /> authors its shadow for a light ground. */}
          {/* No `size`: the seal inherits <LicensedSeal />'s own responsive
              ramp. This mount used to override it with 76/88px, which put the
              wording ORIGINALLY LICENSED PRODUCT at a ~6px cap height — the
              exact illegibility the ramp exists to fix. An override here
              silently replaces every breakpoint at once, so the correct value
              is no override at all. */}
          <div className="mt-12 flex justify-end border-t rule-ground pt-8 xl:mt-14">
            <LicensedSeal />
          </div>
        </Container>
      </section>

      {/* COMMS — dark. <MissionComms /> is mounted exactly as it ships. */}
      {comms ? (
        <section className="surface-dark pt-[var(--band-open)] pb-[var(--band-open)]">
          <Container>
            <FileHead
              as="h2"
              eyebrow="Operator channel"
              title="Mission comms"
              index={at('comms')}
              flush
            />
            <Grid12 className="mt-[var(--file-head-air)]">
              <div className="col-span-12 xl:col-span-8">{comms}</div>
              <aside className="col-span-12 xl:col-span-3 xl:col-start-10">
                <p className={cn('max-w-[var(--measure)] text-body', INK_DIM)}>
                  The operator answers from this file only — it reads the same telemetry you are
                  reading. Ask about the window, the weather over the target, the format or the
                  delivery, or open a voice link.
                </p>
              </aside>
            </Grid12>
          </Container>
        </section>
      ) : null}

      {/* CLOSE — the owner's controls on paper, the shared view's invitation
          on void, because the block the shared route hands in is written for
          the dark ground. */}
      {shared ? (
        cta ? (
          <section className="surface-dark pt-[var(--band-open)] pb-[var(--band-open)]">
            <Container>
              <FileHead
                as="h2"
                eyebrow="Any address"
                title="Open a file"
                index={at('close')}
                flush
              />
              <div className="mt-[var(--file-head-air)]">{cta}</div>
            </Container>
          </section>
        ) : null
      ) : (
        <section className="surface-light pt-[var(--band-open)] pb-[var(--band-open)]">
          <Container>
            <FileHead
              as="h2"
              eyebrow="Owner only"
              title="File actions"
              index={at('actions')}
              flush
            />
            <MissionActions
              mission={mission}
              origin={origin}
              isOwner={isOwner}
              mockMode={mockMode}
              shareToken={shareToken}
              className="mt-[var(--file-head-air)]"
            />
          </Container>
        </section>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Hooks                                                              */
/* ------------------------------------------------------------------ */

/**
 * Keeps the mission current. Polls while the tab is visible and the mission
 * is still running; stops at DELIVERED and while the tab is hidden, and picks
 * up again the moment the tab comes back. A server re-render (the demo
 * advance control calls router.refresh()) always wins over polled state.
 */
function useLiveMission(initial: MissionDTO, url: string | null): MissionDTO {
  const [mission, setMission] = useState<MissionDTO>(initial);
  const lastPayload = useRef<string | null>(null);

  useEffect(() => {
    setMission(initial);
    lastPayload.current = null;
  }, [initial]);

  useEffect(() => {
    if (!url) return;
    if (mission.stage === 'DELIVERED') return;

    let cancelled = false;

    async function read() {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const res = await fetch(url as string, { cache: 'no-store' });
        if (!res.ok) return;
        const raw = await res.text();
        if (cancelled || raw === lastPayload.current) return;
        lastPayload.current = raw;
        const data = JSON.parse(raw) as { mission?: MissionDTO };
        if (!data.mission) return;
        setMission((prev) => reconcile(prev, data.mission as MissionDTO));
      } catch {
        // A missed poll is not an error state — the file keeps the last good
        // telemetry on screen and tries again on the next tick.
      }
    }

    const timer = setInterval(read, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void read();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [url, mission.stage]);

  return mission;
}

/**
 * The polled endpoint answers with the public projection. Private fields
 * already held by this file are kept, so a poll can never blank the owner's
 * address or receipt.
 */
function reconcile(prev: MissionDTO, next: MissionDTO): MissionDTO {
  return { ...next, private: next.private ?? prev.private };
}

/**
 * Wall clock. Seeded with the server's clock so the first client render
 * matches the server markup exactly, then kept live on a one-minute tick —
 * the next-pass prediction stays honest while the file is open.
 */
function useClientClock(serverNow: string): Date {
  const [now, setNow] = useState<Date>(() => new Date(serverNow));
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Real browser origin once mounted; the configured site URL before that. */
function useOrigin(fallback: string): string {
  const [origin, setOrigin] = useState(fallback);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  return origin;
}
