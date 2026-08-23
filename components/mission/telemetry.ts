/**
 * MISSION CONTROL — derivation layer.
 *
 * Pure functions that turn a MissionDTO into the values the file surfaces
 * render. No JSX, no fetching, no invented facts: everything here is either
 * read straight off the DTO or derived from it deterministically, so the same
 * mission always reads the same way on the owner view and the shared view.
 */

import {
  MISSION_STAGES,
  STAGE_DESCRIPTION,
  STAGE_LABEL,
  stageIndex,
  type MissionDTO,
  type MissionEventDTO,
  type MissionStage,
} from '@/lib/types';
import { formatTelemetryDate, formatTelemetryTimestamp } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Copy tables                                                        */
/* ------------------------------------------------------------------ */

/**
 * What a stage that has not been reached yet is waiting on. Shown under
 * pending rows in place of an ETA — the file never promises a date it does
 * not hold.
 */
export const STAGE_CONDITION: Record<MissionStage, string> = {
  MISSION_CONFIRMED: 'Opens when payment clears and the target is written to the tasking queue.',
  SATELLITE_TASKED: 'Opens when the constellation operator accepts the collection request.',
  CAPTURE_WINDOW: 'Opens when passes over the target are scheduled.',
  IMAGE_ACQUIRED: 'Opens on the first pass that clears the cloud threshold. Passes that do not clear it are re-tasked.',
  PROCESSING: 'Opens once the frame passes quality review.',
  PRINT: 'Opens when the print file is released to the production facility.',
  SHIPPED: 'Opens on the first carrier scan.',
  FINAL_APPROACH: 'Opens when the package enters the delivery run to your address.',
  DELIVERED: 'Closes the file on hand-off.',
};

/** One line for the stage a mission is sitting at right now. */
export const STAGE_SUMMARY: Record<MissionStage, string> = {
  MISSION_CONFIRMED: 'Coordinates locked. Tasking request queued with the operator.',
  SATELLITE_TASKED: 'Collection request accepted. Passes are being scheduled over the target.',
  CAPTURE_WINDOW: 'Window open. Holding for a pass with usable conditions.',
  IMAGE_ACQUIRED: 'Frame downlinked. Watermarked preview released to this file.',
  PROCESSING: 'Grade, composition and telemetry overlay in progress.',
  PRINT: 'On the press at the production facility.',
  SHIPPED: 'In transit. Tracking active.',
  FINAL_APPROACH: 'Out for delivery. The package is on its last leg.',
  DELIVERED: 'Delivered. Mission file closed.',
};

/* ------------------------------------------------------------------ */
/* Timeline                                                           */
/* ------------------------------------------------------------------ */

export type TimelineStatus = 'done' | 'active' | 'pending' | 'alert';

export interface TimelineRow {
  stage: MissionStage;
  label: string;
  description: string;
  condition: string;
  status: TimelineStatus;
  /** ISO timestamp of the stage event, when the stage has been reached. */
  at: string | null;
  /** NOTE entries logged while the mission sat at this stage. */
  notes: MissionEventDTO[];
}

/** First recorded event per stage, keyed by stage. */
function stageEvents(events: MissionEventDTO[]): Map<MissionStage, MissionEventDTO> {
  const map = new Map<MissionStage, MissionEventDTO>();
  for (const e of events) {
    if (e.stage === 'NOTE') continue;
    if (!map.has(e.stage)) map.set(e.stage, e);
  }
  return map;
}

/**
 * Builds the nine-row timeline. NOTE events are attached to the stage the
 * mission was sitting at when they were logged, so a re-tasking note appears
 * exactly where it happened.
 */
export function buildTimeline(mission: MissionDTO): TimelineRow[] {
  const ordered = [...mission.events].sort((a, b) => a.at.localeCompare(b.at));
  const events = stageEvents(ordered);
  const current = stageIndex(mission.stage);
  const cancelled = mission.state === 'CANCELLED';

  const notesByStage = new Map<MissionStage, MissionEventDTO[]>();
  let bucket: MissionStage = MISSION_STAGES[0];
  for (const e of ordered) {
    if (e.stage === 'NOTE') {
      const list = notesByStage.get(bucket) ?? [];
      list.push(e);
      notesByStage.set(bucket, list);
    } else {
      bucket = e.stage;
    }
  }

  return MISSION_STAGES.map((stage, i) => {
    const event = events.get(stage) ?? null;
    let status: TimelineStatus = i < current ? 'done' : i === current ? 'active' : 'pending';
    if (cancelled && i >= current) status = i === current ? 'alert' : 'pending';
    return {
      stage,
      label: STAGE_LABEL[stage],
      description: STAGE_DESCRIPTION[stage],
      condition: STAGE_CONDITION[stage],
      status,
      at: event?.at ?? null,
      notes: notesByStage.get(stage) ?? [],
    };
  });
}

/** Timestamp of the first recorded event for a stage, if it has happened. */
export function eventAt(mission: MissionDTO, stage: MissionStage): string | null {
  const hit = mission.events
    .filter((e) => e.stage === stage)
    .sort((a, b) => a.at.localeCompare(b.at))[0];
  return hit?.at ?? null;
}

/* ------------------------------------------------------------------ */
/* Pass prediction                                                    */
/* ------------------------------------------------------------------ */

const REVISIT_MS = 24 * 60 * 60 * 1000;

/**
 * Next pass over the target during an open capture window.
 *
 * A sun-synchronous sensor crosses the same ground track at the same local
 * solar time on each revisit, so passes fall on a 24h cadence anchored to the
 * window opening. This walks that cadence forward from `now` and returns the
 * first crossing that still falls inside the window. Returns null once the
 * window holds no further passes.
 */
export function nextPassAt(mission: MissionDTO, now?: Date | null): string | null {
  if (!mission.windowOpensAt) return null;
  const opens = new Date(mission.windowOpensAt).getTime();
  const closes = mission.windowClosesAt ? new Date(mission.windowClosesAt).getTime() : opens + 7 * REVISIT_MS;
  if (Number.isNaN(opens) || Number.isNaN(closes)) return null;

  let t = opens;
  // Without a clock the first scheduled crossing is returned — callers pass
  // the server clock on first paint and the live clock after mount, so the
  // rendered markup is identical on both sides of hydration.
  const cutoff = now ? now.getTime() : opens;
  while (t < cutoff) t += REVISIT_MS;
  return t <= closes ? new Date(t).toISOString() : null;
}

/** `12.03.2026 — 19.03.2026`, or a single date when only one bound is known. */
export function formatWindowRange(opensAt: string | null, closesAt: string | null): string | null {
  if (!opensAt && !closesAt) return null;
  if (opensAt && closesAt) return `${formatTelemetryDate(opensAt)} — ${formatTelemetryDate(closesAt)}`;
  return formatTelemetryDate((opensAt ?? closesAt) as string);
}

/* ------------------------------------------------------------------ */
/* Fulfilment                                                         */
/* ------------------------------------------------------------------ */

const FACILITY_COUNTRY: Record<string, string> = {
  US: 'UNITED STATES',
  NL: 'NETHERLANDS',
  DE: 'GERMANY',
  GB: 'UNITED KINGDOM',
};

/**
 * Country of the print facility. `printFacility` reads `US / RENO, NV` or
 * `EU / EINDHOVEN, NL`; the trailing token is the country, the leading token
 * is the region. Falls back to the region when the label is not parseable.
 */
export function facilityCountry(mission: MissionDTO): string {
  const label = mission.printFacility;
  if (label) {
    const tail = label.split(',').pop()?.trim().toUpperCase() ?? '';
    if (FACILITY_COUNTRY[tail]) return FACILITY_COUNTRY[tail];
    const head = label.split('/')[0]?.trim().toUpperCase() ?? '';
    if (head === 'US') return FACILITY_COUNTRY.US;
  }
  return mission.region === 'EU' ? 'EUROPEAN UNION' : FACILITY_COUNTRY.US;
}

/** City of the print facility, e.g. `RENO, NV`. */
export function facilityCity(mission: MissionDTO): string | null {
  if (!mission.printFacility) return null;
  const parts = mission.printFacility.split('/');
  return parts.length > 1 ? parts.slice(1).join('/').trim().toUpperCase() : mission.printFacility;
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                               */
/* ------------------------------------------------------------------ */

/** `3:4` → `3 / 4` for a CSS aspect-ratio. Defaults to the 30×40 print ratio. */
export function printAspect(ratio: string | undefined): string {
  const m = ratio?.match(/^(\d+)\s*[:/]\s*(\d+)$/);
  return m ? `${m[1]} / ${m[2]}` : '3 / 4';
}

/** `21:34PM 02.10.2026`, or a struck field when the value is absent. */
export function stamp(iso: string | null | undefined): string {
  return iso ? formatTelemetryTimestamp(iso) : '——';
}

/** `02.10.2026`, or a struck field when the value is absent. */
export function datestamp(iso: string | null | undefined): string {
  return iso ? formatTelemetryDate(iso) : '——';
}

/**
 * HOW MANY DECIMAL PLACES A FIX MAY BE PRINTED WITH, on this view.
 *
 * PRECISION IS AN OWNERSHIP DECISION, NOT A FORMATTING ONE — the same rule
 * `components/brief/cards/WhereWeAreLooking.tsx` already applies, stated once
 * here so the masthead, the stage panel and the data block cannot drift apart
 * from it or from each other.
 *
 * `lib/missions/dto.ts` rounds a public projection to PUBLIC_COORD_DP (2)
 * before it ever reaches a component. Printing that rounded value through the
 * 4 dp default of `formatCoords` does not restore the missing digits — it
 * pads them with zeros, so a shared file read `34.1000, -118.3400`. That is
 * two defects in one line: it claims eleven-metre precision the view was
 * deliberately denied, and it puts a four-decimal coordinate on a public
 * surface, which is the exact string a privacy sweep greps for.
 *
 * `private` is the owner discriminator — it is the block stripped from every
 * public and shared view — so it is what decides this. NEVER widen it here:
 * a component may print fewer digits than the record holds, never more.
 */
export function coordDp(mission: MissionDTO): 2 | 4 {
  return mission.private ? 4 : 2;
}

/** Degrees with one decimal: `4.2°`. */
export function deg(value: number): string {
  return `${value.toFixed(1)}°`;
}

/**
 * The share token lives on the private DTO. It is read defensively so the
 * file still renders if the field is absent — the SHARE control simply does
 * not appear until a key has been issued.
 */
export function shareTokenOf(mission: MissionDTO): string | null {
  const m = mission as MissionDTO & {
    shareToken?: string | null;
    private?: { shareToken?: string | null };
  };
  return m.private?.shareToken ?? m.shareToken ?? null;
}
