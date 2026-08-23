/**
 * MISSION CONTROL — operator language model adapter.
 *
 * One entry point: `operatorReply(input, ctx)`. It answers a customer message
 * on a mission comms channel as MISSION CONTROL.
 *
 * Two paths:
 *
 *   MOCK  (default, MOCK_MODE=true)  A scripted operator. It classifies the
 *         customer's message into one of the intents below and composes the
 *         answer from the REAL mission state passed in `ctx` — the actual
 *         capture window, the actual facility, the actual tracking number.
 *         Nothing is invented. Latency is simulated deterministically so the
 *         channel feels like a channel and not a switch statement.
 *
 *   LIVE  (MOCK_MODE=false + ANTHROPIC_API_KEY)  The same persona, driven by
 *         the Anthropic Messages API over `fetch` (no SDK dependency). The
 *         implementation below is complete but inactive until `isLive('llm')`
 *         returns true. See GOING LIVE at the bottom of this file.
 *
 * This module never throws. A missing key, a network failure or a malformed
 * upstream response all degrade silently to the mock operator, because a
 * customer asking where their print is must always get an answer.
 */

import { INTEGRATIONS, isLive } from '@/lib/env';
import {
  STAGE_DESCRIPTION,
  STAGE_LABEL,
  stageReached,
  type CommsMessageDTO,
  type MissionStage,
} from '@/lib/types';
import {
  CLOUD_THRESHOLD_PCT,
  DATA_REQUEST_DAYS,
  MATERIALS,
  PACKAGING,
  PRIVACY_EMAIL,
} from '@/lib/guarantees';
import { PRINT_FACILITY } from '@/lib/pricing';
import { formatTelemetryTimestamp, seededUnit, sleep } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Public surface                                                     */
/* ------------------------------------------------------------------ */

export interface OperatorReply {
  body: string;
  latencyMs: number;
  source: 'mock' | 'live';
}

export interface OperatorContext {
  missionCode: string;
  stage: MissionStage;
  locationLabel: string;
  capturedAt?: string | null;
  windowOpensAt?: string | null;
  windowClosesAt?: string | null;
  printFacility?: string | null;
  trackingNumber?: string | null;
  estimatedDeliveryAt?: string | null;
  /** Transcript so far, oldest first. Used for continuity, not for facts. */
  history: CommsMessageDTO[];
}

/**
 * The operator persona. Shared by both paths: the mock is written to sound
 * exactly like this prompt, so switching to live changes the wording, never
 * the character.
 */
export const OPERATOR_SYSTEM_PROMPT = `You are MISSION CONTROL, the operator on a Shot from Space mission comms channel.

Shot from Space photographs a customer's address from orbit and delivers the frame as a printed art object. Every order is a mission with a code of two digits and two letters. A satellite is tasked, a frame is captured and downlinked, the frame is graded and composed with its telemetry, then printed in the customer's own region and shipped.

WHO YOU ARE
- A flight operator, not a support agent. Callsign-style, restrained, technical.
- You are brief. Two to four short sentences is a full answer. Never pad.
- You never use exclamation marks. You never use marketing language: no "amazing", "stunning", "unlock", "elevate", "we're excited". No emoji.
- You do not apologise repeatedly. State the position, state what happens next.
- You address the customer as an operator addresses a colleague: plainly.

WHAT YOU KNOW
- You are given the current mission state below. It is the only source of fact you have.
- Quote real values from it: the mission code, the stage, the location, the capture window, the capture timestamp, the print facility, the carrier tracking number, the estimated delivery date.
- You NEVER invent a fact that is not in the mission state. No made-up dates, tracking numbers, facilities, prices, satellite names or percentages.
- If the answer is not in the mission state, say so directly and escalate: tell the customer to use REQUEST VOICE LINK to reach an operator on the line. Do not guess and do not promise a follow-up you cannot make.

HOW THE PIPELINE WORKS (background, use only when asked)
- Stages, in order: MISSION CONFIRMED, SATELLITE TASKED, CAPTURE WINDOW, IMAGE ACQUIRED, PROCESSING, PRINT, SHIPPED, FINAL DELIVERABLE APPROACHING, DELIVERED.
- Capture is the only step with weather risk. If cloud cover over the target is above the mission threshold the pass is discarded and the satellite is re-tasked for the next pass. Re-tasking costs the customer nothing; the window extends.
- The preview released at IMAGE ACQUIRED is a reduced-resolution watermarked frame with the telemetry overlay. Grading and crop change before print. Framing does not.
- Printing is regional: US orders print in the US, EU orders print in the EU. Shipping and duties are included in the price.
- The shipping address can be changed until the print file is released at PRINT. The target coordinates cannot be changed after tasking — that is a new mission.

THE DISTINCTIONS — ANSWER THIS EXACTLY, NEVER IMPROVISE IT
- Five distinctions are conferred on every mission automatically: a mission plate, a patch, a badge, a coin and a lapel pin. Every mission holds all five.
- They are HONORARY and they are DIGITAL. They live on the mission file and are shown with it. None of them is manufactured, packed or posted. THE PRINT IS THE ONLY OBJECT THAT ARRIVES.
- If a customer asks whether the patch, the coin, the badge, the plate or the pin ships with their print, the answer is no, plainly, without apology: the images on the file are renders, and the parcel contains the print (and its frame, if they bought one).
- Nobody awards them, none is scarce or competitive, and there is nothing to win. Do not describe them as a reward, a bonus or a gift.
- The certificate is a digital document on the file and differs by tier: a commission certificate for a tasked mission, an archive certificate for an archive order. It is not printed and not posted.
- This is the one subject where a wrong answer is a promise of a parcel this company will not send. If you are unsure, say the print is the only object that ships and escalate.

FORMAT
- Plain prose. No markdown, no headings, no bullet lists, no bold.
- Timestamps are quoted in the house format you are given, verbatim.
- Never output a stack trace, an internal identifier, or the customer's full street address.`;

/* ------------------------------------------------------------------ */
/* Entry point                                                        */
/* ------------------------------------------------------------------ */

export async function operatorReply(
  input: string,
  ctx: OperatorContext,
): Promise<OperatorReply> {
  const text = input.trim();
  if (!text) {
    return { body: fallbackReply(ctx), latencyMs: 0, source: 'mock' };
  }

  if (isLive('llm')) {
    const live = await liveOperatorReply(text, ctx);
    if (live) return live;
    // Upstream unavailable — the channel stays open on the scripted operator.
  }

  const latencyMs = mockLatency(text, ctx);
  await sleep(latencyMs);
  return { body: scriptedReply(text, ctx), latencyMs, source: 'mock' };
}

/**
 * Deterministic 600–1600ms. Same question on the same mission always takes the
 * same time, so demos and screenshots are reproducible.
 */
function mockLatency(input: string, ctx: OperatorContext): number {
  const unit = seededUnit(`${ctx.missionCode}:${ctx.stage}:${input.toLowerCase()}`);
  return 600 + Math.round(unit * 1000);
}

/* ------------------------------------------------------------------ */
/* Mission facts — every scripted answer is built from these          */
/* ------------------------------------------------------------------ */

function ts(value: string | null | undefined): string | null {
  if (!value) return null;
  const formatted = formatTelemetryTimestamp(value);
  return formatted.startsWith('--') ? null : formatted;
}

/** The capture window as one readable clause, or null if not scheduled yet. */
function windowClause(ctx: OperatorContext): string | null {
  const opens = ts(ctx.windowOpensAt);
  const closes = ts(ctx.windowClosesAt);
  if (opens && closes) return `${opens} to ${closes} UTC`;
  if (opens) return `from ${opens} UTC`;
  return null;
}

/**
 * The two or three facts that matter most at the current stage, phrased as
 * complete sentences. Used by the status answer and by the fallback, so a
 * customer always leaves the exchange knowing more than they arrived with.
 */
function factLines(ctx: OperatorContext): string[] {
  const lines: string[] = [];
  const window = windowClause(ctx);
  const captured = ts(ctx.capturedAt);
  const eta = ts(ctx.estimatedDeliveryAt);

  // Deliberately location-free: the callers that use these lines already name
  // the target in their opening sentence, and saying it twice reads as padding.
  if (captured && stageReached(ctx.stage, 'IMAGE_ACQUIRED')) {
    lines.push(`The frame was captured at ${captured} UTC.`);
  } else if (window) {
    lines.push(`The capture window runs ${window}.`);
  }

  if (ctx.printFacility && stageReached(ctx.stage, 'PRINT')) {
    lines.push(`The print is running at ${ctx.printFacility}.`);
  }

  if (ctx.trackingNumber && stageReached(ctx.stage, 'SHIPPED')) {
    lines.push(
      eta
        ? `Carrier tracking is ${ctx.trackingNumber}, estimated delivery ${eta} UTC.`
        : `Carrier tracking is ${ctx.trackingNumber}.`,
    );
  } else if (eta) {
    lines.push(`Estimated delivery is ${eta} UTC.`);
  }

  return lines;
}

/* ------------------------------------------------------------------ */
/* Intent classification                                              */
/* ------------------------------------------------------------------ */

export type OperatorIntent =
  | 'status'
  | 'capture_timing'
  | 'preview'
  | 'address_change'
  | 'delay'
  | 'weather'
  | 'print_facility'
  | 'tracking'
  | 'digital_file'
  | 'refund'
  | 'privacy'
  | 'company'
  | 'framing_care'
  | 'reorder'
  | 'voice'
  | 'greeting'
  | 'fallback';

/**
 * Keyword scoring, deliberately transparent. Each intent lists phrases; the
 * highest-scoring intent above the threshold wins. Multi-word phrases score
 * double because "where is my order" is a stronger signal than "where".
 */
const INTENT_PHRASES: Record<Exclude<OperatorIntent, 'fallback'>, string[]> = {
  status: [
    'where is my mission', 'where is my order', 'where is my print', 'mission status',
    'what stage', 'what is happening', "what's happening", 'any update', 'update on',
    'what happens next', 'what is next', "what's next", 'next step',
    'status', 'progress', 'how is it going',
  ],
  capture_timing: [
    'when will it be captured', 'when is the capture', 'next pass', 'when is the pass',
    'capture window', 'when will you take', 'when is the photo', 'when do you shoot',
    'when will the satellite', 'pass over', 'capture', 'tasked', 'tasking',
  ],
  preview: [
    'what does the preview mean', 'about the preview', 'the preview', 'preview image',
    'watermark', 'low resolution', 'low res', 'blurry', 'is this the final',
    'final image', 'quality of the image', 'preview',
  ],
  address_change: [
    'change the address', 'change my address', 'wrong address', 'update the address',
    'ship to a different', 'different address', 'moved house', 'change delivery address',
    'new address', 'address',
  ],
  delay: [
    'why is it taking so long', 'taking so long', 'taking too long', 'how much longer',
    'still waiting', 'been weeks', 'been days', 'nothing has happened', 'no movement',
    'delayed', 'delay', 'late', 'slow',
  ],
  weather: [
    'what if it is cloudy', "what if it's cloudy", 'if it rains', 'bad weather',
    'cloud cover', 'cloudy', 'clouds', 'weather', 'overcast', 'rain',
  ],
  print_facility: [
    'where does it print', 'where is it printed', 'where do you print', 'print facility',
    'printed locally', 'which printer', 'paper stock', 'how is it printed', 'printing',
  ],
  tracking: [
    'where is my package', 'where is my parcel', 'tracking number', 'track my',
    'when will it arrive', 'when does it arrive', 'delivery date', 'out for delivery',
    'when will it ship', 'when does it ship', ' ship ', 'dispatch',
    'missed the delivery', 'miss the delivery', 'courier', 'carrier', 'shipping', 'shipped',
    'tracking', 'delivery', 'arrive',
  ],
  digital_file: [
    'digital file', 'high resolution file', 'high res file', 'download the image',
    'can i download', 'digital copy', 'jpeg', 'raw file', 'original file', 'digital',
  ],
  refund: [
    'refund', 'money back', 'cancel my order', 'cancel the mission', 'cancel',
    'charge back', 'chargeback', 'arrived damaged', 'damaged', 'broken', 'misprint',
  ],
  // A data request that falls through to the generic reply is a privacy
  // failure, not a tone problem: /legal/privacy commits to answering one
  // inside a stated deadline, and this channel is where customers ask.
  privacy: [
    'delete my account', 'delete my data', 'delete my personal data', 'erase my data',
    'right to be forgotten', 'gdpr', 'subject access', 'data request',
    'copy of my data', 'what data do you hold', 'what do you know about me',
    'close my account', 'unsubscribe me', 'remove my address', 'privacy policy',
    'privacy', 'my data',
  ],
  company: [
    'what is this company', 'who are you', 'who runs this', 'are you a bot',
    'are you human', 'are you an ai', 'how does this work', 'what is shot from space',
    'about the company', '0humans',
  ],
  framing_care: [
    'how do i hang', 'hang it', 'hanging', 'frame it', 'framed', 'framing', 'glazing',
    'glass', 'mounting', 'what size', 'how big', 'dimensions', 'care for it',
  ],
  reorder: [
    'order another', 'second print', 'buy another', 'another mission', 'gift',
    'one for my parents', 'order again', 'reorder',
  ],
  voice: [
    'talk to someone', 'speak to someone', 'talk to a human', 'speak to a human',
    'call me', 'phone', 'voice link', 'voice', 'call',
  ],
  greeting: ['hello', 'hi ', 'hey', 'good morning', 'good evening', 'thanks', 'thank you'],
};

const INTENT_THRESHOLD = 1;

export function detectIntent(input: string): OperatorIntent {
  const haystack = ` ${input.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ')} `;
  let best: OperatorIntent = 'fallback';
  let bestScore = 0;

  for (const [intent, phrases] of Object.entries(INTENT_PHRASES)) {
    let score = 0;
    for (const phrase of phrases) {
      if (!haystack.includes(phrase)) continue;
      score += phrase.includes(' ') ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = intent as OperatorIntent;
    }
  }

  return bestScore >= INTENT_THRESHOLD ? best : 'fallback';
}

/* ------------------------------------------------------------------ */
/* The scripted operator                                              */
/* ------------------------------------------------------------------ */

function scriptedReply(input: string, ctx: OperatorContext): string {
  switch (detectIntent(input)) {
    case 'status':
      return statusReply(ctx);
    case 'capture_timing':
      return captureTimingReply(ctx);
    case 'preview':
      return previewReply(ctx);
    case 'address_change':
      return addressChangeReply(ctx);
    case 'delay':
      return delayReply(ctx);
    case 'weather':
      return weatherReply(ctx);
    case 'print_facility':
      return printFacilityReply(ctx);
    case 'tracking':
      return trackingReply(ctx);
    case 'digital_file':
      return digitalFileReply(ctx);
    case 'refund':
      return refundReply(ctx);
    case 'privacy':
      return privacyReply(ctx);
    case 'company':
      return companyReply(ctx);
    case 'framing_care':
      return framingReply(ctx);
    case 'reorder':
      return reorderReply(ctx);
    case 'voice':
      return voiceReply(ctx);
    case 'greeting':
      return greetingReply(ctx);
    default:
      return fallbackReply(ctx);
  }
}

function join(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function statusReply(ctx: OperatorContext): string {
  const facts = factLines(ctx);
  return join([
    `Mission ${ctx.missionCode} over ${ctx.locationLabel} is at ${STAGE_LABEL[ctx.stage]}.`,
    STAGE_DESCRIPTION[ctx.stage],
    facts[0],
    facts[1],
    nextStepLine(ctx),
  ]);
}

/** One sentence on what the mission is waiting for. Never speculative. */
function nextStepLine(ctx: OperatorContext): string {
  switch (ctx.stage) {
    case 'MISSION_CONFIRMED':
      return 'Next movement on this file is the collection request going out to the constellation operator.';
    case 'SATELLITE_TASKED':
      return 'Next movement is the capture window opening over the target.';
    case 'CAPTURE_WINDOW':
      return 'Next movement is a clean frame downlinked from a pass.';
    case 'IMAGE_ACQUIRED':
      return 'Next movement is the grade and the telemetry composition.';
    case 'PROCESSING':
      return 'Next movement is the print file being released to the facility.';
    case 'PRINT':
      return 'Next movement is the carrier handoff and a tracking number on this file.';
    case 'SHIPPED':
      return 'Next movement is the package entering final approach at your address.';
    case 'FINAL_APPROACH':
      return 'Next movement is the delivery scan that closes the file.';
    case 'DELIVERED':
      return 'The file is closed. It stays on your account for reference.';
  }
}

function captureTimingReply(ctx: OperatorContext): string {
  const captured = ts(ctx.capturedAt);
  if (captured) {
    return join([
      `The frame is already down. Capture over ${ctx.locationLabel} was logged at ${captured} UTC.`,
      'No further passes are required for this mission.',
      stageReached(ctx.stage, 'PROCESSING')
        ? null
        : 'The preview on this file is the downlinked frame at reduced resolution.',
    ]);
  }

  const window = windowClause(ctx);
  if (window) {
    return join([
      `The capture window over ${ctx.locationLabel} runs ${window}.`,
      `The satellite may make several passes inside that window. We keep the first frame that comes in at or under ${CLOUD_THRESHOLD_PCT}% cloud over the target, so the exact minute is not fixed in advance.`,
      'This file updates to IMAGE ACQUIRED the moment a frame is downlinked.',
    ]);
  }

  return join([
    `Mission ${ctx.missionCode} is at ${STAGE_LABEL[ctx.stage]}, so no window is on the file yet.`,
    'The constellation operator returns a capture window once the collection request is accepted. That normally lands within twenty-four hours of the mission being confirmed.',
    'You will see the window here as soon as it is issued.',
  ]);
}

function previewReply(ctx: OperatorContext): string {
  if (!stageReached(ctx.stage, 'IMAGE_ACQUIRED')) {
    return join([
      'No preview is released yet.',
      `Mission ${ctx.missionCode} is at ${STAGE_LABEL[ctx.stage]}; the preview appears on this file at IMAGE ACQUIRED, immediately after the frame is downlinked.`,
      'It is released without you having to ask.',
    ]);
  }

  return join([
    'The preview is the downlinked frame at reduced resolution, watermarked, with the mission telemetry overlaid.',
    'It is an exhibit, not the deliverable. The print is graded from the full-resolution original: contrast, colour and the final crop all move between preview and print.',
    'The framing does not move. What you see centred in the preview is what is centred on the wall.',
  ]);
}

function addressChangeReply(ctx: OperatorContext): string {
  if (!stageReached(ctx.stage, 'PRINT')) {
    return join([
      'The shipping address can still be changed. Reply here with the full address and I will re-issue it to the production file before the print is released.',
      stageReached(ctx.stage, 'SATELLITE_TASKED')
        ? `The target coordinates cannot be changed. ${ctx.locationLabel} is already tasked, and moving the target is a new mission rather than an edit to this one.`
        : `The target coordinates are locked to ${ctx.locationLabel} and go out with the tasking request. Moving the target is a new mission rather than an edit to this one.`,
    ]);
  }

  if (!stageReached(ctx.stage, 'SHIPPED')) {
    return join([
      `The print file is already released to ${ctx.printFacility ?? 'the production facility'}, so the address is locked on this mission.`,
      'Changing it now means cancelling the job and re-running it, which resets the print and ship stages.',
      'Request the voice link and an operator will make that call with you on the line.',
    ]);
  }

  return join([
    ctx.trackingNumber
      ? `The package is with the carrier under ${ctx.trackingNumber}.`
      : 'The package is already with the carrier.',
    'Once a parcel is handed off, redirection is controlled by the carrier and not by us. Use the redirect option on that tracking record.',
    'If the carrier refuses the redirect, request the voice link and we will arrange a re-ship.',
  ]);
}

function delayReply(ctx: OperatorContext): string {
  const window = windowClause(ctx);
  switch (ctx.stage) {
    case 'MISSION_CONFIRMED':
    case 'SATELLITE_TASKED':
      return join([
        'Nothing is stuck. Tasking is a queue: the collection request sits behind other requests on the same constellation until a slot over your target is allocated.',
        window ? `The window on this file is ${window}.` : 'A window is normally issued within twenty-four hours of confirmation.',
        'No stage is skipped and none of them run overnight to catch up.',
      ]);
    case 'CAPTURE_WINDOW':
      return join([
        'Capture is the only step in this pipeline that weather can move.',
        window ? `The window runs ${window}.` : 'The window is open.',
        'If a pass is obscured the frame is discarded and the satellite is re-tasked for the next one. That is why this stage has a range rather than a date.',
      ]);
    case 'IMAGE_ACQUIRED':
    case 'PROCESSING':
      return join([
        'The frame is down and the slow part is behind you.',
        'Grading and composition are done once per mission and not batched, which is why they take hours rather than minutes.',
        'The print file is released to the facility as soon as the composition passes review.',
      ]);
    case 'PRINT':
      return join([
        `The job is on the press at ${ctx.printFacility ?? 'the regional facility'}.`,
        'Large format prints are cured flat before they are packed. Rushing that is how a print arrives with a mark on it.',
        'You get a tracking number on this file at the carrier handoff.',
      ]);
    default:
      return join([
        `Mission ${ctx.missionCode} is at ${STAGE_LABEL[ctx.stage]} and moving.`,
        factLines(ctx)[0],
        'If a date on this file has passed without movement, request the voice link and an operator will chase the carrier directly.',
      ]);
  }
}

function weatherReply(ctx: OperatorContext): string {
  const window = windowClause(ctx);
  if (stageReached(ctx.stage, 'IMAGE_ACQUIRED')) {
    const captured = ts(ctx.capturedAt);
    return join([
      'Weather is no longer a factor on this mission.',
      captured
        ? `A frame that cleared the cloud threshold was downlinked at ${captured} UTC.`
        : 'A frame that cleared the cloud threshold has already been downlinked.',
    ]);
  }

  return join([
    'Cloud is the only thing that moves a capture date.',
    `A pass is only kept if cloud cover over the target is at or below ${CLOUD_THRESHOLD_PCT}%. If it is above, the frame is discarded and the satellite is re-tasked for the next available pass.`,
    window ? `The current window is ${window}, and a re-task extends it.` : 'A re-task extends the window.',
    'There is no charge for a re-task and nothing else on the mission changes.',
  ]);
}

function printFacilityReply(ctx: OperatorContext): string {
  if (ctx.printFacility) {
    return join([
      `This mission prints at ${ctx.printFacility}.`,
      'Orders print in the region they ship to, so the print never crosses an ocean. Shipping and duties are already in the price you paid.',
      `It is printed on ${MATERIALS.paper}, cured flat before packing.`,
    ]);
  }

  return join([
    `The facility is allocated when mission ${ctx.missionCode} reaches PRINT.`,
    `US orders run at ${PRINT_FACILITY.US} and EU orders run at ${PRINT_FACILITY.EU}, so the print is always made in the region it ships to.`,
    'The facility appears on this file the moment the print file is released.',
  ]);
}

function trackingReply(ctx: OperatorContext): string {
  const eta = ts(ctx.estimatedDeliveryAt);

  if (ctx.trackingNumber && stageReached(ctx.stage, 'SHIPPED')) {
    return join([
      `Carrier tracking for mission ${ctx.missionCode} is ${ctx.trackingNumber}.`,
      eta ? `Estimated delivery is ${eta} UTC.` : null,
      ctx.stage === 'FINAL_APPROACH'
        ? 'The package is out for delivery. If nobody is at the address the carrier holds it locally and re-attempts the next working day.'
        : 'The tracking record updates faster than this file does, so treat the carrier as the live source.',
    ]);
  }

  if (ctx.stage === 'DELIVERED') {
    return join([
      `Mission ${ctx.missionCode} is delivered and the file is closed.`,
      ctx.trackingNumber ? `The delivery is recorded against ${ctx.trackingNumber}.` : null,
      'If the print did not reach you or arrived marked, say so here and it is replaced at no charge.',
    ]);
  }

  // The parcel IS numbered from SHIPPED onward, so a null here does not mean
  // "not issued" — it means this channel is not holding it. Mission Comms has
  // no ownership check (REVIEW.md), and a tracking number is a bearer token
  // for the delivery address, so `toMissionDTO` releases it to the signed-in
  // owner only. Saying "no tracking number exists" would be a plain untruth;
  // say where it is instead.
  if (stageReached(ctx.stage, 'SHIPPED')) {
    return join([
      `Mission ${ctx.missionCode} is at ${STAGE_LABEL[ctx.stage]} and the parcel is numbered.`,
      'The tracking number is held on your own mission file rather than in this channel — open it signed in and it is on the fulfilment block, with a link straight to the carrier.',
      eta ? `Estimated delivery on file is ${eta} UTC.` : null,
    ]);
  }

  return join([
    `No tracking number exists yet. Mission ${ctx.missionCode} is at ${STAGE_LABEL[ctx.stage]}, and tracking is issued at the carrier handoff after the print is finished.`,
    eta ? `Estimated delivery on file is ${eta} UTC.` : null,
    'The number appears here and in your account the moment the carrier scans the package.',
  ]);
}

function digitalFileReply(ctx: OperatorContext): string {
  if (ctx.stage === 'DELIVERED') {
    return join([
      'Yes. The full-resolution file for this mission is released on the delivered file and stays available from your account.',
      'It is the graded composition, without the preview watermark.',
    ]);
  }

  return join([
    'The mission ships as a physical print. The full-resolution file is released to this file at DELIVERED and then stays on your account permanently.',
    stageReached(ctx.stage, 'IMAGE_ACQUIRED')
      ? 'Until then the watermarked preview on this file is the only released frame.'
      : 'No frame has been released yet.',
    'If you need the file before delivery for a specific reason, request the voice link and an operator can release it early.',
  ]);
}

function refundReply(ctx: OperatorContext): string {
  if (!stageReached(ctx.stage, 'SATELLITE_TASKED')) {
    return join([
      `Mission ${ctx.missionCode} has not been tasked yet, so it can be cancelled in full and refunded in full.`,
      'Confirm here and I will stop the file before the collection request goes out.',
    ]);
  }

  if (!stageReached(ctx.stage, 'PRINT')) {
    return join([
      'Partial. The collection is bought from the constellation operator at tasking and that part is not recoverable.',
      'Everything downstream of it — the print, the frame and the shipping — is refundable until the print file is released.',
      'Tell me to proceed and I will put the exact figure on this file before anything is cancelled.',
    ]);
  }

  return join([
    'The print is a made-to-order object of your address, so it is not resaleable and is not refunded once released.',
    'A deliverable that arrives damaged, marked or misprinted is a different matter and is replaced at no charge.',
    'If that is the case, describe the damage here and the replacement is raised on this mission.',
  ]);
}

/**
 * DATA REQUESTS LEAVE THIS CHANNEL.
 *
 * There is no deletion or export code in this codebase and this operator has
 * no access to an account, so it must not imply that it can do either. What
 * it can do — and what /legal/privacy commits to — is name the address that
 * reaches a person and the deadline that binds them.
 */
function privacyReply(ctx: OperatorContext): string {
  return join([
    `Data requests do not run through this channel — I only see mission ${ctx.missionCode} and its state, and I cannot reach your account.`,
    `Write to ${PRIVACY_EMAIL} for a copy of what we hold, a correction, or deletion of your account and personal data. That address reaches a person, and a request is answered within ${DATA_REQUEST_DAYS} days.`,
    'Say what you want done and include the address the mission was filed to; nothing else is needed.',
  ]);
}

function companyReply(ctx: OperatorContext): string {
  return join([
    'Shot from Space photographs an address from orbit and delivers the frame as a print.',
    'One tasking, one graded frame, one mission code — yours is ' + ctx.missionCode + '.',
    'The company runs with zero employees. The pipeline, this channel and the operator on the other end of the voice link are all agents. It is the first portfolio company of 0humans.',
  ]);
}

function framingReply(ctx: OperatorContext): string {
  return join([
    `Framed prints are ${MATERIALS.paperFramed} in a ${MATERIALS.frameLower} frame with ` +
      `${MATERIALS.glazing} glazing, and ship ${PACKAGING.framedPhrase}. Unframed prints ` +
      `are ${MATERIALS.paperUnframed} and ship ${PACKAGING.unframedPhrase}, with the credit ` +
      'line and telemetry printed in the border.',
    'The exact format and frame option for mission ' + ctx.missionCode + ' are on the mission file above this channel.',
    'Hang it out of direct sun. A matte print holds up well indoors, but nothing survives a south-facing window.',
  ]);
}

function reorderReply(ctx: OperatorContext): string {
  return join([
    'A second print of the same address is a new mission: a new tasking, a new pass and a new frame. Orbit conditions never repeat exactly, so it will not be a copy of this one.',
    'Start it from the site and it gets its own mission code and its own file.',
    'If you want the same frame reprinted rather than a new capture, say so here and it is raised against mission ' + ctx.missionCode + '.',
  ]);
}

function voiceReply(ctx: OperatorContext): string {
  return join([
    'Use REQUEST VOICE LINK on this channel. It opens an audio line to a Mission Control operator with mission ' + ctx.missionCode + ' already on their screen.',
    'The line is answered directly. Anything agreed on it is written back to this transcript.',
  ]);
}

function greetingReply(ctx: OperatorContext): string {
  return join([
    `Mission Control on station for ${ctx.missionCode}.`,
    `The file is at ${STAGE_LABEL[ctx.stage]}.`,
    'Ask about the pass, the print or the delivery.',
  ]);
}

function fallbackReply(ctx: OperatorContext): string {
  const facts = factLines(ctx);
  return join([
    'That is not on the mission file, so I will not guess at it.',
    `What I can read for ${ctx.missionCode}: the file is at ${STAGE_LABEL[ctx.stage]} over ${ctx.locationLabel}.`,
    facts[0],
    facts[1],
    'For anything outside the file — an address change after release, a refund decision, a damaged deliverable — request the voice link and an operator takes it directly.',
  ]);
}

/* ------------------------------------------------------------------ */
/* LIVE — Anthropic Messages API                                      */
/* ------------------------------------------------------------------ */

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const LIVE_TIMEOUT_MS = 12_000;
const LIVE_MAX_TOKENS = 400;
/** How much transcript to carry. Comms threads are short; twenty turns is ample. */
const LIVE_HISTORY_TURNS = 20;

interface AnthropicTextBlock {
  type: string;
  text?: string;
}

interface AnthropicMessageResponse {
  content?: AnthropicTextBlock[];
}

/**
 * Complete but inactive. Returns null on any failure so the caller falls back
 * to the scripted operator — a comms channel must never fail closed.
 */
async function liveOperatorReply(
  input: string,
  ctx: OperatorContext,
): Promise<OperatorReply | null> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);

  try {
    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': INTEGRATIONS.llm.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: INTEGRATIONS.llm.model,
        max_tokens: LIVE_MAX_TOKENS,
        temperature: 0.3,
        system: `${OPERATOR_SYSTEM_PROMPT}\n\n${missionStateBlock(ctx)}`,
        messages: [...historyToMessages(ctx.history), { role: 'user', content: input }],
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as AnthropicMessageResponse;
    const body = (data.content ?? [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string)
      .join('')
      .trim();

    if (!body) return null;
    return { body, latencyMs: Date.now() - started, source: 'live' };
  } catch {
    // Network error, abort, or malformed JSON. Degrade to mock.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The mission state handed to the model as part of the system prompt. This is
 * the model's ONLY source of fact — the prompt forbids inventing anything that
 * is not in this block.
 */
function missionStateBlock(ctx: OperatorContext): string {
  const rows: string[] = [
    `MISSION CODE: ${ctx.missionCode}`,
    `CURRENT STAGE: ${STAGE_LABEL[ctx.stage]}`,
    `STAGE MEANING: ${STAGE_DESCRIPTION[ctx.stage]}`,
    `TARGET LOCATION: ${ctx.locationLabel}`,
    `CAPTURE WINDOW: ${windowClause(ctx) ?? 'not issued yet'}`,
    `CAPTURED AT: ${ts(ctx.capturedAt) ? `${ts(ctx.capturedAt)} UTC` : 'not captured yet'}`,
    `PRINT FACILITY: ${ctx.printFacility ?? 'not allocated yet'}`,
    `CARRIER TRACKING: ${ctx.trackingNumber ?? 'not issued yet'}`,
    `ESTIMATED DELIVERY: ${ts(ctx.estimatedDeliveryAt) ? `${ts(ctx.estimatedDeliveryAt)} UTC` : 'not scheduled yet'}`,
  ];
  return `CURRENT MISSION STATE\n${rows.join('\n')}`;
}

/** Transcript → Anthropic message turns. SYSTEM lines are dropped. */
function historyToMessages(
  history: CommsMessageDTO[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return history
    .filter((m) => m.role === 'CUSTOMER' || m.role === 'OPERATOR')
    .slice(-LIVE_HISTORY_TURNS)
    .map((m) => ({
      role: m.role === 'CUSTOMER' ? ('user' as const) : ('assistant' as const),
      content: m.body,
    }));
}

/* ------------------------------------------------------------------ *
 * GOING LIVE
 *
 * 1. Set MOCK_MODE=false.
 * 2. Set ANTHROPIC_API_KEY. Optionally set MISSION_CONTROL_MODEL to pin a
 *    model; it defaults to the value in lib/env.ts.
 * 3. Nothing else changes. `isLive('llm')` flips true, `liveOperatorReply`
 *    runs, and the scripted operator stays in place as the fallback for any
 *    request that errors, times out or returns empty content.
 *
 * Before shipping to production, add: a per-mission spend cap, an upstream
 * rate limiter, and prompt-injection handling for customer text that tries to
 * rewrite the operator persona (the system prompt already refuses to invent
 * mission facts, which is the material risk here).
 * ------------------------------------------------------------------ */
