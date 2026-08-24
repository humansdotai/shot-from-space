/**
 * ==================================================================
 * /mission — THE ONE FILE THE OWNER EDITS
 * ==================================================================
 * Every tunable in the ten-screen purchase flow lives here. No price,
 * no resolution, no distance, no duration and no window rule is typed
 * anywhere else in `app/mission`, `components/mission-flow` or the rest
 * of `lib/mission-flow`. If a number on a screen is wrong, it is wrong
 * in exactly one place.
 *
 * The flow deliberately does NOT restate anything that already has a
 * single source of truth elsewhere in the repo:
 *   · print sizes and their catalogue prices  → `lib/pricing.ts`
 *   · the five guarantees and their wording   → `lib/guarantees.ts`
 *   · archive imagery and its acquisition dates → `lib/imagery.ts`
 *   · orbital elements and pass geometry      → `lib/satellites/*`
 * This file only carries what is specific to the purchase flow, plus
 * the small derivations that join those sources together.
 * ==================================================================
 */

import type { Currency, FormatId, FrameOption } from '@/lib/types';
import { currencyForRegion, priceMinor, regionForCountry } from '@/lib/pricing';

/* ==================================================================
 * 1. MONEY
 * ==================================================================
 * Three tiers. The number below is the price of that tier at the
 * REFERENCE FORMAT (see `SIZE_REFERENCE`). Choosing a larger print adds
 * the catalogue's own difference between that size and the reference
 * size — so there is exactly one place sizes are priced (`lib/pricing.ts`)
 * and exactly one place tiers are priced (here), and the two can never
 * drift apart.
 *
 * Worked example with the values as shipped:
 *   COMMISSION at 30 × 40 unframed = 189               (the reference)
 *   COMMISSION at 50 × 70 unframed = 189 + (260 − 170) = 279
 *   LARGE FORMAT at 50 × 70 framed = 349 + (390 − 240) = 499
 */

/** The tiers, in the order they are stacked on screen 9. */
export const TIER_IDS = ['ARCHIVE', 'COMMISSION', 'COMMISSION_LARGE_FORMAT'] as const;
export type TierId = (typeof TIER_IDS)[number];

/**
 * Tier price at the reference format, in MAJOR units, per currency.
 *
 * BOTH CURRENCIES ARE PLACEHOLDERS AND BOTH NEED SIGNING OFF. The currency a
 * customer is charged in is decided by the country of the target address
 * (`regionForCountry` -> `currencyForRegion` in lib/pricing.ts), exactly as
 * the catalogue does it — so a tier priced in one currency only would quote a
 * euro figure to a buyer whose card is debited in dollars. That is precisely
 * the defect this table exists to prevent: an audit caught the flow printing
 * "€189 EUR" to a US target while the order recorded $260.
 *
 * The USD column is set near the catalogue's own USD/EUR ratio (about 1.06 at
 * F30, 1.077 at F50 and F70). It is not a conversion and no rate is implied —
 * it is a price list, and it is yours to set.
 */
export const TIER_PRICE: Record<TierId, Record<Currency, number>> = {
  /** Most recent existing capture. Nothing is tasked; it ships immediately. */
  ARCHIVE: { EUR: 79, USD: 85 },
  /** New tasking. The core product. */
  COMMISSION: { EUR: 189, USD: 199 },
  /** New tasking, framed. The telemetry plate is a DIGITAL distinction on
   *  the file, not a second object in the box — see the tier body below. */
  COMMISSION_LARGE_FORMAT: { EUR: 349, USD: 369 },
};

/**
 * The "from" price advertised before a size is chosen. It must equal the
 * cheapest reachable configuration or the flow is quoting a price nobody
 * can buy — `assertConfig()` at the foot of this file checks that.
 */
export const PRICE_FROM = 79;

/**
 * The currency quoted before a country is known, and the currency the
 * homepage "from" price is denominated in.
 *
 * It is a FALLBACK, not the flow's currency. The real one comes from the
 * target's country through `currencyForTarget` below, which is the same
 * derivation `lib/missions/index.ts` uses to price the order — so the two
 * cannot disagree.
 */
export const CURRENCY: Currency = 'EUR';

/**
 * The currency a target will actually be charged in.
 *
 * `regionForCountry` -> `currencyForRegion` is exactly what the order route
 * does. Before the postal record is resolved there is no country, and the
 * flow quotes `CURRENCY`; the moment the address resolves, every screen
 * re-prices. An audit found the flow printing "€189 EUR" to a US target whose
 * order recorded $260, which is what this closes.
 */
export function currencyForTarget(countryCode?: string | null): Currency {
  return countryCode ? currencyForRegion(regionForCountry(countryCode)) : CURRENCY;
}

/**
 * The format/finish pair whose catalogue price is already inside each
 * tier price above. Everything larger costs the catalogue difference.
 */
export const SIZE_REFERENCE: { formatId: FormatId; frame: FrameOption } = {
  formatId: 'F30',
  frame: 'UNFRAMED',
};

/** The size and finish screen 6 opens on. */
export const DEFAULT_FORMAT_ID: FormatId = 'F50';
export const DEFAULT_FRAME: FrameOption = 'UNFRAMED';

/** The tier pre-selected on screen 9, and the one screen 6 quotes against. */
export const DEFAULT_TIER: TierId = 'COMMISSION';

/**
 * The tier the flow marks as its recommendation. One only, and it must be
 * `DEFAULT_TIER` — see below.
 *
 * IT USED TO BE CALLED `MOST_POPULAR_TIER` AND THE CARD SAID `Most popular`.
 * Nothing has ever shipped from this system: there is no order history, no
 * unit count and no basis of any kind for a popularity claim, so that badge
 * was a fabrication — printed on the payment screen, beside the price, which
 * is the worst place on the site to invent social proof. This repository
 * already had the rule written down; `components/landing/PricingBand.tsx`
 * carries it verbatim: *"There is no badge on any format. Nothing has sold,
 * so 'most popular' would be a fabrication, and a recommendation the
 * catalogue cannot support is worse than no recommendation."* The landing
 * page obeyed it and the checkout did not.
 *
 * `Recommended` is a claim the system CAN support, because it is a fact
 * about this software rather than about other buyers: it is the tier the
 * flow pre-selects, the tier the Design tab quotes against, and the tier
 * `assertConfig()` below holds to `DEFAULT_TIER`. It says "this is the one
 * we put in front of you", which is exactly what is true.
 */
export const RECOMMENDED_TIER: TierId = 'COMMISSION';

/** The word on that card. A recommendation, never a popularity claim. */
export const RECOMMENDED_TAG = 'Recommended';

/**
 * The finish a tier forces, if it forces one. LARGE FORMAT is defined as
 * framed, so choosing it overrides whatever screen 6 selected — and the
 * screen says so rather than silently re-pricing.
 */
export const TIER_FORCED_FRAME: Partial<Record<TierId, FrameOption>> = {
  COMMISSION_LARGE_FORMAT: 'FRAMED',
};

/** Tier copy. Terse: one line of what it is, one line of what it costs you. */
export const TIER_COPY: Record<TierId, { name: string; kicker: string; body: string }> = {
  ARCHIVE: {
    name: 'Archive',
    kicker: 'Instant',
    body: 'The most recent existing capture over your coordinates. Nothing is tasked, so nothing is waited for.',
  },
  COMMISSION: {
    name: 'Commission',
    kicker: 'New tasking',
    body: 'A satellite is tasked to fly your coordinates and return a frame that did not exist before you asked.',
  },
  COMMISSION_LARGE_FORMAT: {
    name: 'Commission large format',
    kicker: 'Framed',
    /* NOT "delivered with the telemetry plate". The plate is one of the five
     digital distinctions: it is conferred on the file and shown with it, and
     nothing beyond the print is manufactured or posted. "Delivered with" is an
     explicit shipping claim and it is the exact construction that made this
     site promise a parcel it was never going to send. */
    body: 'The same new tasking, framed. Its telemetry plate is conferred on the file.',
  },
};

/**
 * Price of one configuration, in EUR minor units (cents).
 * tier price + the catalogue difference between the chosen size and the
 * reference size, taken at the same finish so framing is never counted twice.
 */
/**
 * What a configuration costs, in minor units of `currency`.
 *
 * THIS IS THE ONLY PRICING FUNCTION THE FLOW MAY USE, ON THE CLIENT AND ON
 * THE SERVER. `app/api/orders/route.ts` calls it to price the order and the
 * offer screen calls it to print the button, so the figure a customer reads
 * and the figure their card is debited are the same number by construction,
 * not by two implementations agreeing. They used to disagree: the screen
 * priced by tier and the order priced from the catalogue, so "Pay €79"
 * recorded €170 — a 115% overcharge visible to the customer in their own
 * receipt email.
 *
 * THE SUPPLEMENT IS TAKEN AGAINST THE REFERENCE'S OWN FINISH. It used to be
 * taken at whatever finish was chosen, which cancelled itself out at the
 * reference size: framing a 30 x 40 print came out free, when the catalogue
 * charges 70 for it.
 */
export function tierPriceMinor(
  tier: TierId,
  formatId: FormatId,
  frame: FrameOption,
  currency: Currency,
): number {
  const base = TIER_PRICE[tier][currency] * 100;
  const supplement =
    priceMinor(formatId, frame, currency) -
    priceMinor(SIZE_REFERENCE.formatId, SIZE_REFERENCE.frame, currency);
  return base + supplement;
}

/** The finish actually used for a tier — the forced one, or the chosen one. */
export function effectiveFrame(tier: TierId, chosen: FrameOption): FrameOption {
  return TIER_FORCED_FRAME[tier] ?? chosen;
}

/* ==================================================================
 * 2. THE CAPTURE — the one resolution figure the flow prints
 * ==================================================================
 * Screen 5 says "sensor captures at [X] cm per pixel". X is here.
 *
 * WHAT THIS NUMBER IS. `lib/integrations/skyfi.ts` orders the
 * `VERY HIGH` resolution tier for a residential rooftop. The tier is
 * what is contracted; the exact ground sample distance depends on the
 * spacecraft the operator assigns at tasking time and on how far off
 * nadir it is when it flies. 50 cm is the figure the transactional
 * email already defaults to (`lib/integrations/email.ts`), so it is
 * used here rather than a second, different number.
 *
 * It is printed WITH `CAPTURE_GSD_BASIS` beside it. A resolution claim
 * on a product that sells resolution never stands on its own.
 */
export const CAPTURE_GSD_CM = 50;
export const CAPTURE_GSD_BASIS =
  'The very-high-resolution tier is what is ordered. The exact figure depends on the spacecraft assigned at tasking and how far off nadir it flies.';

/* ==================================================================
 * 3. PASS WINDOWS — screen 7
 * ==================================================================
 * Windows are COMPUTED, not written: `lib/integrations/celestrak.ts`
 * supplies published elements for the tracked fleet and
 * `lib/satellites/propagate.ts` runs SGP4 over the buyer's coordinates.
 * The parameters of that search are here.
 */

/** How many capture windows to offer. Two or three; more is a timetable. */
export const PASS_WINDOW_COUNT = 3;

/**
 * Degrees above the horizon a satellite must clear to count as a pass.
 * Ten degrees is the usual floor: below it the slant range is long and
 * the atmosphere is thick, and nobody images through it.
 */
export const PASS_MIN_ELEVATION_DEG = 10;

/**
 * How far ahead to search, in hours. Seven days: long enough that
 * `TASKING_LEAD_DAYS` can be subtracted from the earliest windows and
 * `PASS_WINDOW_COUNT` still remain, short enough that the propagation
 * finishes inside one request.
 */
export const PASS_SEARCH_HOURS = 168;

/** SGP4 sweep granularity, seconds. Finer costs time and buys nothing here. */
export const PASS_STEP_SECONDS = 120;

/**
 * The window is a DAY, not an instant: several passes on one date are one
 * opportunity to the buyer. Windows are therefore grouped by calendar day.
 */

/**
 * Days between commissioning and the tasking a mission can still make.
 * Screen 7 prints "Commission by [window date − this] to be included in
 * the [window date] tasking."
 */
export const TASKING_LEAD_DAYS = 2;

/**
 * FALLBACK. If CelesTrak is unreachable AND the bundled snapshot cannot
 * be propagated, windows are derived from these offsets instead — and
 * every screen that shows them says they are indicative.
 */
export const INDICATIVE_WINDOW_OFFSET_DAYS = [3, 6, 10];
export const INDICATIVE_NOTICE =
  'Indicative windows. Orbital elements were not available, so these dates are derived from typical revisit spacing rather than propagated over your coordinates.';

/**
 * What is NEVER claimed on screen 7. The tracked fleet is real and the
 * geometry is real; the spacecraft that flies a given mission is chosen
 * by the operator at tasking time and is not one of these by default.
 */
export const PASS_ATTRIBUTION =
  'Windows are propagated from published elements for the fleet this site tracks. The spacecraft assigned to a mission is chosen by the operator at tasking and is not named here.';

/* ==================================================================
 * 4. THE REVEAL — screen 1
 * ==================================================================
 * MOCK MODE. There is no keyed map provider. `/api/geocode/static`
 * renders the preview by cropping the nearest public-domain archive
 * scene from `lib/imagery.ts`; it is not geo-registered to an address.
 * The reveal zooms through real requests to that endpoint, and screen 1
 * states what the frame actually is.
 */

/**
 * Zoom levels the reveal steps through, orbit → street.
 *
 * The last one is capped at 15 on purpose. `/api/geocode/static` crops a
 * fixed-size archive scene, so past about z15 there are no more pixels to
 * find and the frame simply goes soft — a blur is not a closer look.
 */
export const REVEAL_ZOOM_STEPS = [11, 13, 15];

/** Milliseconds each zoom step holds before the next is shown. */
export const REVEAL_STEP_MS = 900;

/** Pixel size requested from `/api/geocode/static`. Square. */
export const REVEAL_PX = 900;

/**
 * How close the nearest catalogue scene must be for its acquisition date
 * to be quoted as the archive date over the buyer's coordinates. Beyond
 * this the frame is a stand-in and screen 1 says the imagery is undated,
 * because there is no dated archive tile for that place.
 */
export const ARCHIVE_MATCH_RADIUS_KM = 60;

/** Said on screen 1 in every case. It is the plain truth about the frame. */
export const REVEAL_SOURCE_NOTICE =
  'Mock mode: no keyed tile provider is configured. The frame shown is a public-domain archive scene, cropped for preview and not geo-registered to your address.';

/* ==================================================================
 * 5. FAMOUS COORDINATES — one line, when the target is somewhere known
 * ==================================================================
 * Add a row and it appears in the telemetry line on screen 1. `radiusKm`
 * is how close the target has to be before the nod is earned.
 */
export const LANDMARKS: readonly {
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
  note: string;
}[] = [
  {
    name: 'Baikonur Cosmodrome',
    lat: 45.965,
    lon: 63.305,
    radiusKm: 40,
    note: 'Baikonur. Every crewed flight since 1961 left from inside this frame.',
  },
  {
    name: 'Cape Canaveral',
    lat: 28.4889,
    lon: -80.5778,
    radiusKm: 40,
    note: 'Cape Canaveral. The pads are on the shoreline, bottom right of the cape.',
  },
];

/* ==================================================================
 * 6. THE MISSION NAME — screen 4
 * ==================================================================
 */

/** `MISSION [LASTNAME]-001`, or `MISSION 001` when no name is known. */
export const MISSION_NAME_PREFIX = 'MISSION';
export const MISSION_NAME_SEQUENCE = '001';
export const MISSION_NAME_MAX = 40;

/**
 * NOTE FOR THE OWNER. There is no source of a surname in this flow: no
 * account, no email and no name is collected before payment, which is
 * the point of it. So the prefilled value is `MISSION 001` in practice.
 * `defaultMissionName()` takes a surname the moment one exists — pass a
 * signed-in user's name into it and the prefill becomes
 * `MISSION [LASTNAME]-001` with no other change.
 */
export function defaultMissionName(lastName?: string | null): string {
  const clean = (lastName ?? '')
    .trim()
    .replace(/[^\p{L}\p{N}\s'-]/gu, '')
    .trim()
    .toUpperCase();
  return clean
    ? `${MISSION_NAME_PREFIX} ${clean}-${MISSION_NAME_SEQUENCE}`
    : `${MISSION_NAME_PREFIX} ${MISSION_NAME_SEQUENCE}`;
}

/* ==================================================================
 * 7. TIMINGS
 * ==================================================================
 */

/** How long screen 4 holds `Mission registered.` before advancing. */
export const REGISTERED_HOLD_MS = 1100;

/** Key the flow's draft is stored under. Bump the suffix to invalidate. */
export const STORAGE_KEY = 'sfs.mission.flow.v1';

/* ==================================================================
 * 8. SELF-CHECK
 * ==================================================================
 * Cheap invariants, run once at import. They catch the two edits most
 * likely to go wrong: advertising a "from" price no configuration can
 * reach, and pointing the popular tag at a tier that does not exist.
 */
export function assertConfig(): void {
  const cheapest = Math.min(
    ...TIER_IDS.map((t) =>
      tierPriceMinor(t, SIZE_REFERENCE.formatId, effectiveFrame(t, SIZE_REFERENCE.frame), 'EUR'),
    ),
  );
  if (cheapest !== PRICE_FROM * 100) {
    throw new Error(
      `mission-flow config: PRICE_FROM is ${PRICE_FROM} but the cheapest configuration is ${cheapest / 100}.`,
    );
  }
  if (!TIER_IDS.includes(RECOMMENDED_TIER)) {
    throw new Error('mission-flow config: RECOMMENDED_TIER is not a tier.');
  }
  /* The tag says "this is the one we put in front of you". If it were ever
     pinned to a tier the flow does NOT pre-select, it would stop being a
     statement about this software and become a claim with nothing behind
     it — which is the failure the rename exists to close. */
  if (RECOMMENDED_TIER !== DEFAULT_TIER) {
    throw new Error(
      'mission-flow config: RECOMMENDED_TIER must be DEFAULT_TIER — the tag means "the tier this flow selects for you", and nothing else is provable.',
    );
  }
  if (!TIER_IDS.includes(DEFAULT_TIER)) {
    throw new Error('mission-flow config: DEFAULT_TIER is not a tier.');
  }
}

assertConfig();
