'use client';

import { useState } from 'react';
import { clsx as cn } from 'clsx';
import { Button, StatusToken } from '@/components/fui';
import { CURVE, INK, INK_DIM, RULE, SpecRow } from '@/components/purchase/fields';
import { getFormat } from '@/lib/pricing';
import {
  STAGE_DESCRIPTION,
  STAGE_LABEL,
  type FormatId,
  type FrameOption,
  type MissionStage,
} from '@/lib/types';
import { telemetryCoords } from '@/lib/mission-flow/entry';
import { effectiveFrame, type TierId } from '@/lib/mission-flow/config';
import type { ChosenWindow } from '@/lib/mission-flow/state';
import { downloadCertificate } from '@/lib/mission-flow/certificate';
import { PanelGroup, PanelHead, PanelNote } from './Panel';
import { formatWindowDate } from './S7Windows';
import { isTasked } from './S8Dossier';

/**
 * ==================================================================
 * SECTION 7 — CONFIRMATION (was screen 10)
 * ==================================================================
 *
 * Mission comms, not a receipt page. The mission has a name, a place and
 * a route through the pipeline it will actually travel.
 *
 * The configurator is CLOSED here: `sectionEnabled` opens no tab once a
 * mission code exists, `furthestLegalSection` clamps every history entry
 * forward to this section, and the rail is replaced by <ClosedRail />.
 * Browser Back from a paid mission would otherwise land on Review with a
 * live pay button, and pressing it opens a second order and charges
 * again. A hidden Back control is not a guard; that is.
 *
 * ------------------------------------------------------------------
 * TWO THINGS THIS SCREEN USED TO GET WRONG
 * ------------------------------------------------------------------
 * 1. IT SCHEDULED A MISSION NOBODY HAD SCHEDULED. The tracker marked a
 *    `Scheduled` stage DONE the moment a capture window had been picked,
 *    and a clock counted the seconds down to it. Neither was true. The
 *    chosen day is a REQUEST — it is the day the buyer asked to be
 *    included in — and the collection is not booked until the operator
 *    accepts it, which is exactly why `<SearchingForPass />` on the
 *    mission file prints "no capture window until the constellation
 *    accepts the collection" for a mission at MISSION_CONFIRMED. Two
 *    surfaces of the same product were saying opposite things about the
 *    same order.
 *
 *    So the stages here are now the REAL ones — `MISSION_STAGES`, with
 *    `STAGE_LABEL` and `STAGE_DESCRIPTION` from `lib/types.ts`, the same
 *    strings the state machine writes into the timeline — and exactly
 *    one of them is done, because exactly one of them has happened. The
 *    countdown is gone rather than relabelled: a ticking clock is a
 *    promise about an instant, and there is no instant to promise.
 *
 * 2. IT PROMISED EVERYONE A CERTIFICATE AND GAVE IT TO GIFT BUYERS. The
 *    Review section lists a commission certificate in what is included,
 *    for every order; the download button here was inside `gift ? … :
 *    null`. `downloadCertificate()` never needed a gift — it composes an
 *    A4 sheet in the browser from values every order has, and the gift
 *    note is one optional block inside it. The button is now offered to
 *    everybody, which is who the promise was made to.
 *
 * ------------------------------------------------------------------
 * THE ACCOUNT OFFER IS HERE AND NOWHERE EARLIER
 * ------------------------------------------------------------------
 * Nothing before this asked for an identity; this is the first moment
 * there is something to attach one to. It is the panel foot's action, so
 * it is the one visible button — and `Open the mission file` is a link,
 * not a purchase.
 */

/**
 * The stages this mission will travel, by tier.
 *
 * An ARCHIVE order is not tasked and no satellite is flown for it, so
 * `SATELLITE_TASKED`, `CAPTURE_WINDOW` and `IMAGE_ACQUIRED` are not part
 * of its route and are not drawn as pending steps it is waiting on. Both
 * lists are drawn from `MISSION_STAGES` and neither invents a stage.
 */
const TASKED_ROUTE: readonly MissionStage[] = [
  'MISSION_CONFIRMED',
  'SATELLITE_TASKED',
  'CAPTURE_WINDOW',
  'IMAGE_ACQUIRED',
  'PRINT',
  'SHIPPED',
];

const ARCHIVE_ROUTE: readonly MissionStage[] = [
  'MISSION_CONFIRMED',
  'PROCESSING',
  'PRINT',
  'SHIPPED',
];

export function ConfirmationSection({
  missionCode,
  missionName,
  lat,
  lon,
  formatId,
  frame,
  tier,
  window: captureWindow,
  gift,
  giftNote,
  paidAt,
}: {
  missionCode: string;
  missionName: string;
  lat: number;
  lon: number;
  formatId: FormatId;
  frame: FrameOption;
  /** Decides the route below, and whether a tasking day means anything. */
  tier: TierId;
  window: ChosenWindow | null;
  gift: boolean | null;
  giftNote: string;
  paidAt: string | null;
}) {
  const format = getFormat(formatId);
  /* THE FINISH THAT WAS CHARGED, NOT THE ONE THAT WAS CLICKED.
     LARGE FORMAT is defined as framed and `TIER_FORCED_FRAME` overrides
     whatever the Design tab had selected — the order route prices and
     records `effectiveFrame(tier, frame)`, and the panel foot charged
     for it. This screen was printing `draft.frame`, so a mission
     recorded and paid for as FRAMED read `Finish / Unframed` on the
     receipt, and the certificate under it said the same. One
     derivation, the same one the money used. */
  const activeFrame = effectiveFrame(tier, frame);
  const coords = telemetryCoords(lat, lon);
  const shareLine = `Mission ${missionName} commissioned · ${coords}`;
  const tasked = isTasked(tier);
  const route = tasked ? TASKED_ROUTE : ARCHIVE_ROUTE;

  const [shared, setShared] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<string | null>(null);

  const share = async () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: missionName, text: shareLine });
        setShared('Shared.');
        return;
      }
      await navigator.clipboard.writeText(shareLine);
      setShared('Copied to the clipboard.');
    } catch {
      setShared('Sharing was not available. The card above can be copied by hand.');
    }
  };

  return (
    <div className="space-y-8">
      <PanelHead eyebrow="Confirmation" title="The mission is commissioned.">
        A receipt is on its way to the address you gave. Nothing else is needed from you.
      </PanelHead>

      {/* The share card — the object the share button hands over. */}
      <div className={cn('border p-5', CURVE, RULE)}>
        <p className={cn('text-label uppercase', INK_DIM)}>Mission</p>
        <p data-telemetry className={cn('pt-3 font-mono text-heading uppercase break-words', INK)}>
          {missionName}
        </p>
        <p
          data-telemetry
          className={cn('pt-2 font-mono text-tele uppercase tabular-nums', INK_DIM)}
        >
          {coords}
        </p>
        <p className="flex items-baseline gap-2 pt-5 font-mono uppercase">
          <span className={cn('text-tele-s', INK_DIM)}>Mission</span>
          <span className={cn('text-tele-s', INK_DIM)}>/</span>
          <span data-telemetry className={cn('text-tele', INK)}>
            {missionCode.toUpperCase()}
          </span>
        </p>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="md" onClick={share}>
            Share the mission
          </Button>
          {/* Offered to every buyer, because it is listed in what is
              included for every buyer. See the note at the top. */}
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              const ok = downloadCertificate({
                missionName,
                missionCode,
                coordinates: coords,
                windowLabel:
                  tasked && captureWindow ? formatWindowDate(captureWindow.date) : null,
                commissionedLabel: paidAt ? formatWindowDate(paidAt.slice(0, 10)) : '—',
                formatLabel: `${format.metric}, ${activeFrame === 'FRAMED' ? 'framed' : 'unframed'}`,
                giftNote: gift ? giftNote : '',
                /* An ARCHIVE order is not a commission of a new frame,
                   and the certificate must not say it is. See the note
                   in `lib/mission-flow/certificate.ts`. */
                tasked,
              });
              setCertificate(
                ok
                  ? 'Certificate downloaded. Open it and print to A4.'
                  : 'The download was refused by the browser.',
              );
            }}
          >
            Download the certificate
          </Button>
        </div>
        <p aria-live="polite" className={cn('pt-3 text-note', INK_DIM)}>
          {shared ?? certificate ?? ''}
        </p>
      </div>

      {/* THE TASKING DAY, AS A REQUEST. No clock: see the note at the top
          of this file. A countdown states an instant, and no instant has
          been booked by anybody yet. */}
      <PanelGroup label={tasked ? 'Requested tasking day' : 'Acquisition'}>
        <p data-telemetry className={cn('font-mono text-heading uppercase tabular-nums', INK)}>
          {tasked
            ? captureWindow
              ? formatWindowDate(captureWindow.date)
              : 'NOT REQUESTED'
            : 'ALREADY ON FILE'}
        </p>
        <PanelNote className="pt-3">
          {tasked ? (
            <>
              Requested on this device, not booked. The collection is filed with the operator
              after the order is received, and the window they accept is what appears on the
              mission file.
              {captureWindow?.indicative
                ? ' This day was indicative — it was not propagated over your coordinates.'
                : ''}
            </>
          ) : (
            <>
              An archive order is not tasked. The frame over your coordinates already exists, so
              nothing is scheduled and nothing is waited for.
            </>
          )}
        </PanelNote>
      </PanelGroup>

      <PanelGroup label="Mission state">
        <ol>
          {route.map((stage, i) => {
            /* EXACTLY ONE STAGE IS DONE, and it is the one that has
               actually happened: the money settled. Nothing below it is
               animated forward to look like progress. */
            const done = i === 0;
            return (
              <li key={stage} className={cn('border-t py-3', RULE)}>
                <div className="flex items-center justify-between gap-4">
                  <span
                    data-telemetry
                    className={cn('font-mono text-tele uppercase', done ? INK : INK_DIM)}
                  >
                    {STAGE_LABEL[stage]}
                  </span>
                  {done ? (
                    <StatusToken label="Done" />
                  ) : (
                    // A pending row is the absence of news, so it gets no
                    // token — only a value. <StatusToken> follows the ground.
                    <span
                      data-telemetry
                      className={cn(
                        'shrink-0 font-mono text-tele-s uppercase',
                        'text-[color:var(--ink-faint)]',
                      )}
                    >
                      Pending
                    </span>
                  )}
                </div>
                <p className={cn('max-w-[var(--measure)] pt-1.5 text-note', INK_DIM)}>
                  {STAGE_DESCRIPTION[stage]}
                </p>
              </li>
            );
          })}
        </ol>
        <PanelNote className="pt-4">
          These are the stages the mission file records. Each one moves when the operator
          reports it; nothing on this page moves one forward on its own.
        </PanelNote>
      </PanelGroup>

      <dl>
        <SpecRow label="Format" value={`${format.designation} / ${format.metric}`} />
        <SpecRow label="Finish" value={activeFrame === 'FRAMED' ? 'Framed' : 'Unframed'} />
        <SpecRow label="Reference" value={missionCode} mono />
      </dl>

      <div className={cn('border-t pt-6', RULE)}>
        <p className={cn('text-label uppercase', INK_DIM)}>Follow it</p>
        <p className={cn('max-w-[var(--measure)] pt-3 text-body', INK_DIM)}>
          An account keeps every mission in one place and lets you message the desk. It is
          optional, and it is offered now rather than before you paid.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-5">
          <Button
            variant="secondary"
            size="md"
            href={`/auth/sign-in?next=${encodeURIComponent(`/m/${missionCode}`)}`}
          >
            Create an account
          </Button>
        </div>
      </div>
    </div>
  );
}
