/**
 * ==================================================================
 * INTEGRATIONS BARREL
 * ==================================================================
 * Every external service sits behind an adapter in this directory. Each one
 * exports a narrow interface, a `mock` implementation and a `live`
 * implementation guarded by `isLive(...)` from @/lib/env.
 *
 * Rules that hold for all of them:
 *   1. MOCK_MODE=true by default — a fresh clone runs with no keys.
 *   2. An adapter NEVER throws because a key is missing. It falls back to the
 *      mock and logs. A missing key is a configuration state, not an error.
 *   3. Mock data is deterministic (seeded by mission code or query) so the
 *      demo is stable across restarts, reseeds and screenshots.
 *   4. Mock latency is realistic, so loading states are exercised.
 *
 * NOT re-exported here: lib/integrations/llm.ts and lib/integrations/voice.ts.
 * Those belong to Agent 6 (MISSION COMMS) and are imported directly by
 * components/comms/** and app/api/comms/**.
 * ==================================================================
 */

export * as stripe from './stripe';
export * as skyfi from './skyfi';
export * as gelato from './gelato';
export * as email from './email';
export * as geocode from './geocode';

// Flat re-exports for the calls used most often across the server.
export { createCheckoutSession, verifyWebhook as verifyStripeWebhook } from './stripe';
export {
  requestTasking,
  getTaskingStatus,
  fetchCapture,
  verifyWebhook as verifySkyfiWebhook,
} from './skyfi';
export {
  createPrintOrder,
  getOrderStatus as getPrintOrderStatus,
  verifyWebhook as verifyGelatoWebhook,
} from './gelato';
export { sendEmail, renderEmail } from './email';
export { autocomplete as geocodeAutocomplete, reverse as geocodeReverse } from './geocode';

export type { CheckoutSession, CreateCheckoutSessionInput, StripeWebhookEvent } from './stripe';
export type {
  TaskingRequest,
  TaskingResult,
  CaptureResult,
  TaskingStatus,
  SkyfiWebhookEvent,
} from './skyfi';
export type {
  CreatePrintOrderInput,
  PrintOrderResult,
  PrintOrderStatus,
  GelatoWebhookEvent,
} from './gelato';
export type { EmailTemplate, SendEmailInput, MissionEmailData } from './email';
export type { GeocodeAdapter } from './geocode';
