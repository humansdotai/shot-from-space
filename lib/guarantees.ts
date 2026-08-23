/**
 * ==================================================================
 * THE PROMISES — one source of truth for every number and material
 * claim the product makes.
 * ==================================================================
 * WHY THIS FILE EXISTS
 *   A QA pass found fourteen factual contradictions across the site:
 *   the same promise written with two different numbers, materials in
 *   the marketing copy that the fulfilment adapter does not order, and
 *   packaging described one way in an email and another on a product
 *   page. Every one of them was a value typed twice.
 *
 *   So no number or material claim below may be re-typed anywhere.
 *   /legal/terms, the landing guarantees, the purchase flow, the
 *   transactional emails, the Mission Control operator and the SkyFi
 *   and Gelato adapters all read from here. If a value is wrong it is
 *   wrong in exactly one place, and it cannot drift back apart.
 *
 * THE RULE FOR THE GUARANTEES
 *   `/legal/terms` is the contract. `label` and `short` are the same
 *   promise with words removed — never a stronger one. If you shorten
 *   a line, drop a qualifier from the END of the sentence, and never
 *   drop a word that narrows the promise ("usable", "before tasking",
 *   "within thirty days"). A short form that promises more than the
 *   contract is a misrepresentation, not a wording preference.
 *
 * OPEN — NEEDS THE OWNER'S CONFIRMATION
 *   · CLOUD_THRESHOLD_PCT is published to the customer AND sent to
 *     SkyFi. It is set to the value that is safest for the buyer. It
 *     has a real cost: a tighter threshold re-tasks more often.
 *   · The material strings describe what lib/integrations/gelato.ts
 *     actually orders. They have NOT been checked against a live
 *     Gelato catalogue response — see the note on that file.
 * ==================================================================
 */

/* ------------------------------------------------------------------ */
/* Numbers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Maximum cloud cover over the target, in percent, that we will accept on a
 * delivered frame. Anything above it fails the frame and the pass is
 * re-tasked at our cost.
 *
 * This is BOTH a published guarantee and the `maxCloudCoveragePercent` sent
 * with the SkyFi tasking order, which is why it lives here rather than in
 * either place. Changing it changes the contract.
 */
export const CLOUD_THRESHOLD_PCT = 10;

/** Prose form of the threshold, for sentences that spell numbers out. */
export const CLOUD_THRESHOLD_WORD = 'ten';

/**
 * If no usable frame is acquired within this many days of the mission being
 * CONFIRMED (not of tasking — tasking is later, and the earlier start is the
 * one that favours the customer), the mission is closed and refunded.
 */
export const REFUND_WINDOW_DAYS = 60;

/** Days from delivery in which a damaged or misprinted print may be reported. */
export const DAMAGE_REPORT_DAYS = 30;

/** The collection window quoted to the customer, in days. */
export const CAPTURE_WINDOW_DAYS = { min: 7, max: 14 } as const;

/** Days a subject-access, correction or deletion request is answered within. */
export const DATA_REQUEST_DAYS = 30;

/** Where a data request is actually read. Mission Comms is not a privacy desk. */
export const PRIVACY_EMAIL = 'privacy@shotfromspace.com';

/* ------------------------------------------------------------------ */
/* Materials — what lib/integrations/gelato.ts orders                  */
/* ------------------------------------------------------------------ */

/**
 * These strings must describe the Gelato product UIDs in
 * `GELATO_PRODUCT_UID`, and nothing more.
 *
 * Unframed: `..._pt_200-gsm-uncoated-white_...`
 * Framed:   `..._black_wood_w-12-mm_plexiglass_..._200-gsm-matt`
 *
 * The words "cotton", "museum-grade", "archival" and "anti-glare" used to
 * appear in the customer copy. None of them is in the catalogue. They have
 * been removed rather than softened: a paper claim is a claim about an
 * object the buyer will hold and can check.
 */
export const MATERIALS = {
  /** Unframed sheet. */
  paperUnframed: '200 gsm uncoated, matte',
  /** The sheet inside a frame — Gelato mounts the framed variants on matt. */
  paperFramed: '200 gsm matt',
  /** Shown where one line has to cover both variants. */
  paper: '200 gsm, matte',
  frame: 'Black wood',
  frameLower: 'black wood',
  glazing: 'acrylic (plexiglass)',
  /** One-line spec for a framed order. */
  framedSpec: 'black wood frame with acrylic glazing',
} as const;

/**
 * Packaging. Three different descriptions used to reach the same customer —
 * "in a tube" on the format picker, "flat in a rigid case" on the process
 * page and "flat in a rigid sleeve" in the shipping email.
 *
 * Flat wins: it is what the fulfilment adapter orders (`flat_product_…`), it
 * is what the state machine and the seed already record, and it is the better
 * outcome for the buyer — nobody wants to flatten a rolled print. A tube is
 * never promised anywhere now.
 */
export const PACKAGING = {
  /** Format-picker sub-label. */
  unframedShort: 'Ships flat',
  /** Bare phrase, so a caller supplies its own verb and number agreement. */
  unframedPhrase: 'flat in a rigid sleeve',
  framedPhrase: 'assembled behind the glazing, ready to hang',
  /** Singular verb forms, for "the print …". */
  unframed: 'ships flat in a rigid sleeve',
  unframedSentence: 'The print ships flat in a rigid sleeve. Handle the surface by the edges.',
  framedShort: 'Ready to hang',
  framed: 'ships assembled behind its glazing, ready to hang',
  framedSentence:
    'The frame ships assembled behind its glazing, ready to hang. Cut the tape rather than pulling the corners apart.',
} as const;

/** The packaging sentence for one order. Used by email and by the operator. */
export function packagingSentence(framed: boolean): string {
  return framed ? PACKAGING.framedSentence : PACKAGING.unframedSentence;
}

/**
 * The one-line material record for a produced order — the string the mission
 * timeline and the seeded events both print.
 */
export function materialLine(sizeLabel: string, framed: boolean): string {
  return framed
    ? `${sizeLabel} on ${MATERIALS.paperFramed}, ${MATERIALS.framedSpec}.`
    : `${sizeLabel} on ${MATERIALS.paperUnframed}, unframed, ${PACKAGING.unframed}.`;
}

/* ------------------------------------------------------------------ */
/* The five guarantees                                                 */
/* ------------------------------------------------------------------ */

export type GuaranteeKey = 'refund' | 'retask' | 'replace' | 'shipping' | 'cancel';

export interface GuaranteeTerm {
  key: GuaranteeKey;
  /** The full promise, as a line. Matches /legal/terms. */
  label: string;
  /** The same promise at button scale — the label with words removed. */
  short: string;
  /** The argument under the label. Also matches /legal/terms. */
  detail: string;
}

export const GUARANTEE_TERMS: GuaranteeTerm[] = [
  {
    key: 'refund',
    label: `Full refund if no usable frame is acquired within ${REFUND_WINDOW_DAYS} days`,
    // "usable" is load-bearing: without it this promises a refund whenever no
    // frame at all arrives, which is a wider promise than the contract makes.
    short: `Full refund if no usable frame in ${REFUND_WINDOW_DAYS} days`,
    detail:
      `${REFUND_WINDOW_DAYS} days from the mission being confirmed, if the satellite has not ` +
      'returned a frame we would print, the mission is closed and refunded in full. You do ' +
      'not have to ask, and you do not have to argue it.',
  },
  {
    key: 'retask',
    label: 'Cloud-blocked passes are re-tasked at no cost',
    short: 'Cloud-blocked passes re-tasked free',
    detail:
      `Cloud above ${CLOUD_THRESHOLD_WORD} percent over the target fails the frame. The next ` +
      'pass is booked at our expense, as many times as the weather takes.',
  },
  {
    key: 'replace',
    label: `Damaged or misprinted deliveries are replaced within ${DAMAGE_REPORT_DAYS} days`,
    short: `Damage or misprint replaced within ${DAMAGE_REPORT_DAYS} days`,
    detail:
      'If the print arrives damaged in transit or wrong on the paper, a replacement is ' +
      `produced and shipped without a return argument. Report it within ${DAMAGE_REPORT_DAYS} ` +
      'days of delivery through Mission Comms on your mission page.',
  },
  {
    key: 'shipping',
    label: 'Shipping and duties are included in the price shown',
    short: 'Shipping and duties included',
    detail:
      'The number on the format is the number charged. There is no second invoice waiting at ' +
      'the door.',
  },
  {
    key: 'cancel',
    label: 'Cancel free before the satellite is tasked',
    short: 'Cancel free before tasking',
    // There is no self-serve cancel control in the mission file today, so this
    // says what actually happens: you ask, and we cancel. Do not restore the
    // "cancel it from your mission file" wording until the control exists.
    detail:
      'Until the order is filed with the operator — in practice, a few hours — you can cancel ' +
      'and be refunded without giving a reason. Ask through Mission Comms on your mission ' +
      'page and we cancel it.',
  },
];

/** Lookup, for a surface that needs one term rather than the set. */
export function guaranteeTerm(key: GuaranteeKey): GuaranteeTerm {
  const t = GUARANTEE_TERMS.find((g) => g.key === key);
  if (!t) throw new Error(`Unknown guarantee: ${key}`);
  return t;
}
