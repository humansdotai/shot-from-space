'use client';

import type { PosterSubject } from '@/components/poster/StyledPoster';
import { StyledPoster } from '@/components/poster/StyledPoster';
import type { PosterStyleId } from '@/lib/poster/styles';
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

export function PosterStage({ draft }: { draft: MissionDraft }) {
  const target = draft.target;
  if (!target) return null;

  const subject: PosterSubject = {
    // A code is issued when the order opens. Until then the sheet says so.
    missionCode: draft.missionCode ?? NO_MISSION_CODE,
    capturedAt: null,
    lat: target.lat,
    lon: target.lon,
    locationLabel: locationLabelOf(draft),
    orbit: {
      inclination: '',
      track: '',
      altitudeKm: 0,
      gsdM: 0,
      sensor: '',
      azimuthDeg: 0,
      offNadirDeg: 0,
      cloudPct: 0,
    },
    coordDp: 4,
    // No frame on file, because the frame has not been taken.
    degraded: true,
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
