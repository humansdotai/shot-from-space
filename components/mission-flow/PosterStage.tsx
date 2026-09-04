'use client';

import type { PosterSubject } from '@/components/poster/StyledPoster';
import { StyledPoster } from '@/components/poster/StyledPoster';
import type { PosterStyleId } from '@/lib/poster/styles';
import { useMemo } from 'react';
import { effectiveFrame } from '@/lib/mission-flow/config';
import { revealFrameUrl } from '@/lib/mission-flow/api';
import type { MissionDraft } from '@/lib/mission-flow/state';
import { PreviewObject } from './PreviewStage';

/**
 * THE PRINT, IN THE PREVIEW COLUMN.
 *
 * `components/poster/StyledPoster.tsx` is another build's component,
 * mounted here by import path. It renders the chosen COMPOSITION from
 * the same rectangles and the same `sheetCopy()` the print pipeline uses,
 * so what is beside the controls is what the file will be.
 *
 * ------------------------------------------------------------------
 * WHAT THE SHEET IS ALLOWED TO SAY BEFORE THE MISSION HAS FLOWN
 * ------------------------------------------------------------------
 * Nothing about the pass, because nothing about the pass is known. There
 * is no mission code until payment settles, no exposure instant until a
 * satellite has flown, and no off-nadir, altitude or GSD until it has
 * been assigned. `degraded` is the poster's own word for exactly that
 * state: `sheetCopy()` then dashes the frame centres, empties the
 * sequence, prints `ANOMALIES: RECORD UNAVAILABLE` and suppresses the
 * dedication rather than printing half a record. That is the honest
 * depiction, and it is the one used here.
 *
 * `orbit` is passed with empty strings and zeroes for the same reason.
 * On a degraded sheet every one of those fields is dashed before it is
 * read; the two that are not — the track and the sensor — fall back to
 * the poster's own `//ELIPSE 00°` and `TASKING PARTNER`, which is what
 * "not assigned yet" looks like in its vocabulary.
 *
 * <PreviewDisclosure /> in the panel says all of this in prose, on every
 * width, so the buyer is not left to infer it from a row of dashes.
 */

/** What the sheet prints where a mission reference will go, before there is one. */
export const NO_MISSION_CODE = '----';

/** Nominal telemetry for the sample sheet; the pass that flies overwrites every value. */
const SAMPLE_ORBIT = {
  inclination: 'SSO 97.4°',
  track: '//ELIPSE 33°',
  altitudeKm: 512,
  gsdM: 0.5,
  sensor: 'HR / OPTICAL',
  azimuthDeg: 104,
  offNadirDeg: 4.2,
  cloudPct: 6,
};

const SAMPLE_DEDICATION = 'SAMPLE RECORD. EVERY VALUE IS FILLED FROM THE PASS THAT TAKES YOUR FRAME.';

export function PosterStage({ draft }: { draft: MissionDraft }) {
  const target = draft.target;
  /* One sample instant per mount; the sheet's clock and date read from it. */
  const sampleInstant = useMemo(() => new Date().toISOString(), []);
  if (!target) return null;

  /* A SAMPLE RECORD, not a degraded plate. Before a capture exists the
     sheet used to print dashes and "HAS NO FRAME ON FILE" — which is what
     the buyer saw beside the price. It now shows the record as it will
     read: this target, a sample pass instant, nominal telemetry, and the
     buyer's own dedication when they wrote one. The values marked here are
     replaced by the pass that takes the frame. */
  const subject: PosterSubject = {
    missionCode: draft.missionCode ?? NO_MISSION_CODE,
    capturedAt: sampleInstant,
    lat: target.lat,
    lon: target.lon,
    locationLabel: locationLabelOf(draft),
    orbit: SAMPLE_ORBIT,
    coordDp: 4,
    degraded: false,
    dedication: draft.gift && draft.giftNote.trim() ? draft.giftNote.trim() : SAMPLE_DEDICATION,
  };

  return (
    <PreviewObject formatId={draft.formatId}>
      <StyledPoster
        styleId={draft.posterStyle as PosterStyleId}
        formatId={draft.formatId}
        /* The finish that will PRINT. LARGE FORMAT is defined as framed
           and overrides the Design tab's selection (`TIER_FORCED_FRAME`),
           and it is the framed price the panel foot charges — so the
           sheet beside the money is the framed sheet. */
        frame={effectiveFrame(draft.tier, draft.frame)}
        subject={subject}
        image={{
          src: revealFrameUrl(target.lat, target.lon, 17),
          unoptimized: true,
          sizes: '(min-width: 1024px) 40vw, 90vw',
        }}
        detail="print"
      />
    </PreviewObject>
  );
}

/**
 * `CITY / REGION / COUNTRY`, city level and no finer — the sheet prints a
 * site, not a doorstep. Built from the resolved postal record when there
 * is one; before the geocoder answers, the line the buyer typed is all
 * this flow has, and it is shown as given rather than guessed at.
 */
function locationLabelOf(draft: MissionDraft): string {
  const a = draft.target?.address;
  if (!a) return draft.target?.label ?? '';
  return [a.city, a.region, a.country].filter(Boolean).join(' / ');
}
