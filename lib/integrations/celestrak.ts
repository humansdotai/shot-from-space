import { FLEET_IDS } from '@/lib/satellites/fleet';
import SNAPSHOT from '@/lib/satellites/snapshot.json';

/**
 * CELESTRAK — live orbital elements for the tracked fleet.
 *
 * The one integration on this site that is NOT mocked, and the reason is that
 * it has nothing to mock: CelesTrak publishes general perturbations element
 * sets over plain HTTPS, free, with no account, no key and no quota to
 * negotiate. `MOCK_MODE` exists so a fresh clone runs without anyone's
 * credentials; this endpoint already meets that bar, so gating it behind the
 * mock switch would substitute invented orbits for real ones on a page whose
 * entire claim is that the numbers are real.
 *
 * https://celestrak.org/NORAD/elements/ — data by Dr T.S. Kelso.
 *
 * ------------------------------------------------------------------------
 * CACHING, AND WHY IT IS NOT OPTIONAL
 * ------------------------------------------------------------------------
 * CelesTrak is run on donated bandwidth and asks that clients not re-request
 * the same element set more often than it changes. Element sets for these
 * objects are refreshed a few times a day at most, so:
 *
 *   · ONE request covers the whole fleet. The Earth Resources group is a
 *     single document containing every satellite in `lib/satellites/fleet.ts`,
 *     so eight satellites cost one round trip, not eight.
 *   · `next.revalidate` holds it for three hours. Propagation is what makes
 *     the readout move, not re-fetching: SGP4 runs against a fixed element
 *     set and produces a new position every frame. A page that ticks once a
 *     second still only touches CelesTrak eight times a day.
 *
 * ------------------------------------------------------------------------
 * FAILURE
 * ------------------------------------------------------------------------
 * A build machine with no network, a CelesTrak outage, or a request slower
 * than the timeout all resolve to the bundled snapshot rather than an error
 * page — and `source` says `snapshot` when they do. That flag is carried all
 * the way to the readout, which prints the element epoch and its age either
 * way, so a visitor can always see how old the orbit being drawn is. Silently
 * serving month-old elements as though they were live is the failure mode
 * this design exists to prevent.
 */

/** The subset of the OMM/GP record SGP4 and the readouts actually use. */
export type GpElement = {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  NORAD_CAT_ID: number;
  /** UTC, no zone suffix, e.g. `2026-08-21T12:47:44.736288`. */
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
};

export type FleetElements = {
  /** `live` came from CelesTrak this revalidation window; `snapshot` did not. */
  source: 'live' | 'snapshot';
  /** ISO instant the set was obtained. For a snapshot, when it was captured. */
  obtainedAt: string;
  elements: GpElement[];
};

const GROUP_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=resource&FORMAT=json';

/** Three hours. See the caching note above. */
const REVALIDATE_SECONDS = 10_800;

/**
 * Six seconds. Long enough for a healthy round trip on a cold cache, short
 * enough that a CelesTrak outage during a static build costs seconds rather
 * than stalling every prerendered mission page in turn.
 */
const TIMEOUT_MS = 6_000;

function snapshot(): FleetElements {
  return {
    source: 'snapshot',
    obtainedAt: SNAPSHOT.obtainedAt,
    elements: SNAPSHOT.elements as GpElement[],
  };
}

/** Structural check. A 200 carrying an HTML error page must not reach SGP4. */
function isUsable(value: unknown): value is GpElement {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.NORAD_CAT_ID === 'number' &&
    typeof r.EPOCH === 'string' &&
    typeof r.MEAN_MOTION === 'number' &&
    typeof r.INCLINATION === 'number'
  );
}

/**
 * Live elements for every satellite in FLEET, or the bundled snapshot.
 *
 * Never throws and never returns an empty fleet: every caller is a page that
 * has to render.
 */
export async function fetchFleetElements(): Promise<FleetElements> {
  try {
    const response = await fetch(GROUP_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
      headers: {
        // CelesTrak asks that automated clients identify themselves so an
        // abusive one can be told apart from a polite one.
        'User-Agent': 'shotfromspace.com (+https://shotfromspace.com) orbital readout',
      },
    });

    if (!response.ok) return snapshot();

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return snapshot();

    const wanted = new Set(FLEET_IDS);
    const elements = payload.filter(isUsable).filter((e) => wanted.has(e.NORAD_CAT_ID));

    // A partial answer is still an answer — one decommissioned object should
    // not drop the page to a snapshot — but an empty one means the document
    // was not what we think it is.
    if (elements.length === 0) return snapshot();

    return { source: 'live', obtainedAt: new Date().toISOString(), elements };
  } catch {
    // Offline, DNS failure, timeout, malformed JSON. All the same outcome.
    return snapshot();
  }
}
