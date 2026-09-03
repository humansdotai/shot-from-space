/**
 * ==================================================================
 * EMAIL ADAPTER — transactional mission mail
 * ==================================================================
 * WHAT IT DOES
 *   Renders and sends the transactional emails the product needs:
 *     order_confirmed  → fired when payment clears (MISSION_CONFIRMED)
 *     image_acquired   → fired when the frame is downlinked (IMAGE_ACQUIRED)
 *     shipped          → fired when the carrier scans the package (SHIPPED)
 *     magic_link       → fired by lib/auth.ts for passwordless sign-in
 *
 * WHAT IS MOCKED
 *   Nothing leaves the machine. `mock.send` prints a clean, readable block to
 *   the server console and writes an EmailLog row so the whole mail history is
 *   reviewable from the database (and from the account screen) with no keys.
 *
 * WHAT THE LIVE PATH NEEDS
 *   RESEND_API_KEY  — resend.com → API keys
 *   EMAIL_FROM      — a verified sending identity on a verified domain
 *   MOCK_MODE=false
 *   The live sender POSTs https://api.resend.com/emails (no SDK, plain fetch).
 *   Both bodies are already produced here, so going live is a transport swap:
 *   the copy, the subjects and the EmailLog row are identical either way.
 * ==================================================================
 */
import { INTEGRATIONS, SITE_URL, isLive } from '@/lib/env';
import { prisma } from '@/lib/db';
import { missionShortLink } from '@/lib/codes';
import { packagingSentence } from '@/lib/guarantees';
import { formatTelemetryTimestamp, formatTelemetryDate, formatCoords, sleep } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type EmailTemplate =
  | 'order_confirmed'
  | 'image_acquired'
  | 'shipped'
  | 'mission_cancelled'
  | 'magic_link';

/** Everything a mission-scoped email may need. Fields are optional because
 *  each template only reads the telemetry that exists at its stage. */
export interface MissionEmailData {
  code: string;
  locationLabel: string;
  lat: number;
  lon: number;
  /** e.g. "50 × 70 CM / FRAMED" */
  formatLabel: string;
  /**
   * Framed orders and unframed orders are packed differently, and the shipping
   * email used to tell every customer the print "ships flat in a rigid sleeve"
   * — including the ones whose parcel is an assembled frame. Both sentences
   * now come from lib/guarantees.ts and this flag picks between them.
   */
  framed?: boolean;
  /** e.g. "$420" — already formatted with formatPrice(). */
  amountLabel?: string;
  receiptNumber?: string | null;
  sensor?: string;
  gsdM?: number;
  windowOpensAt?: string | Date | null;
  windowClosesAt?: string | Date | null;
  capturedAt?: string | Date | null;
  cloudPct?: number;
  printFacility?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  estimatedDeliveryAt?: string | Date | null;
  /** The canonical STAGE_LABEL a mission had reached. Used by the
   *  cancellation notice, which has to say what was stopped. */
  stageLabel?: string | null;
  /** True when the mission was stopped before the satellite was tasked — the
   *  customer's own cancellation window. The notice says something materially
   *  different either side of that line, so it is never assumed. */
  cancelledBeforeTasking?: boolean;
  /**
   * What the refund call actually did. The notice used to promise the money
   * back in every case, including the ones where the refund had not been
   * placed. It now says only what happened. See `refundPayment` in
   * lib/integrations/stripe.ts.
   */
  refundStatus?: 'REFUNDED' | 'PENDING' | 'NOT_CHARGED' | 'FAILED';
}

export interface MagicLinkEmailData {
  /** Absolute verify URL. */
  url: string;
  /** Minutes until the link expires. */
  expiresInMinutes: number;
}

export type EmailPayload =
  | { template: 'order_confirmed'; data: MissionEmailData }
  | { template: 'image_acquired'; data: MissionEmailData }
  | { template: 'shipped'; data: MissionEmailData }
  | { template: 'mission_cancelled'; data: MissionEmailData }
  | { template: 'magic_link'; data: MagicLinkEmailData };

export type SendEmailInput = {
  to: string;
  /** Mission row id, so the mail is attached to the mission's comms log. */
  missionId?: string | null;
} & EmailPayload;

export interface SendEmailResult {
  id: string;
  provider: 'mock' | 'resend';
  subject: string;
  /** False when the provider rejected the send. Never throws. */
  ok: boolean;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface EmailAdapter {
  send(input: SendEmailInput): Promise<SendEmailResult>;
  render(input: EmailPayload): RenderedEmail;
}

/* ------------------------------------------------------------------ */
/* Small formatting helpers                                           */
/* ------------------------------------------------------------------ */

const ts = (v: string | Date | null | undefined) =>
  v ? formatTelemetryTimestamp(v) : 'PENDING';
const dt = (v: string | Date | null | undefined) => (v ? formatTelemetryDate(v) : 'PENDING');

/** Escapes text before it goes into the HTML body. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A plain-text key/value block: right-padded labels, monospace on arrival. */
function textRows(rows: Array<[string, string]>): string {
  const width = rows.reduce((w, [k]) => Math.max(w, k.length), 0);
  return rows.map(([k, v]) => `${k.padEnd(width, ' ')}   ${v}`).join('\n');
}

/**
 * The HTML shell. Deliberately restrained and table-based: tables are the only
 * layout primitive every mail client renders the same way. No images, no web
 * fonts, no tracking pixel. Dark ground, hairline rules, monospace data.
 */
function htmlShell(opts: {
  eyebrow: string;
  title: string;
  lede: string;
  rows: Array<[string, string]>;
  body?: string[];
  cta?: { label: string; href: string };
  footer: string;
}): string {
  const rows = opts.rows
    .map(
      ([k, v]) => `
            <tr>
              <td style="padding:7px 16px 7px 0;font:11px/1.4 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:.08em;color:#8a8a86;text-transform:uppercase;white-space:nowrap;vertical-align:top;">${esc(k)}</td>
              <td style="padding:7px 0;font:12px/1.5 'SFMono-Regular',Menlo,Consolas,monospace;color:#f2f1ec;vertical-align:top;">${esc(v)}</td>
            </tr>`,
    )
    .join('');

  const body = (opts.body ?? [])
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#d6d5cf;">${esc(p)}</p>`,
    )
    .join('');

  const cta = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;">
         <tr><td style="border:1px solid #ff4d1c;">
           <a href="${esc(opts.cta.href)}" style="display:block;padding:12px 22px;font:12px/1 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:#ff4d1c;text-decoration:none;">${esc(opts.cta.label)}</a>
         </td></tr>
       </table>`
    : '';

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b0b0b;margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#0b0b0b;">
        <tr>
          <td style="padding:0 0 18px;border-bottom:1px solid #262622;">
            <span style="font:11px/1 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:.18em;text-transform:uppercase;color:#8a8a86;">${esc(opts.eyebrow)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 0 0;">
            <h1 style="margin:0 0 18px;font:600 22px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f2f1ec;">${esc(opts.title)}</h1>
            <p style="margin:0 0 22px;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#d6d5cf;">${esc(opts.lede)}</p>
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0 0;border-top:1px solid #262622;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 0;">${rows}
            </table>
            ${cta}
          </td>
        </tr>
        <tr>
          <td style="padding:30px 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="border:1px solid #4a4a45;padding:6px 10px;font:10px/1 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:.2em;color:#8a8a86;">[ SHOT FROM SPACE ]</td></tr>
            </table>
            <p style="margin:14px 0 0;font:11px/1.6 'SFMono-Regular',Menlo,Consolas,monospace;color:#6f6f6a;">${esc(opts.footer)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/* ------------------------------------------------------------------ */
/* Templates — real copy, mission voice, no marketing language         */
/* ------------------------------------------------------------------ */

function renderOrderConfirmed(d: MissionEmailData): RenderedEmail {
  const link = missionShortLink(d.code);
  const url = `${SITE_URL}/m/${d.code}`;
  const rows: Array<[string, string]> = [
    ['MISSION', d.code],
    ['TARGET', d.locationLabel],
    ['COORDINATES', formatCoords(d.lat, d.lon)],
    ['FORMAT', d.formatLabel],
    ['FILE', link],
  ];
  if (d.amountLabel) rows.push(['AUTHORISED', d.amountLabel]);
  if (d.receiptNumber) rows.push(['RECEIPT', d.receiptNumber]);

  const subject = `MISSION / ${d.code} — CONFIRMED`;
  const text = `MISSION CONFIRMED

Your target coordinates are locked. Mission ${d.code} is queued for tasking
with the constellation operator.

Tasking takes one to three days to accept. After that a capture window opens
over the target and we wait for clear conditions. You will hear from us again
the moment a frame is downlinked.

${textRows(rows)}

Track the mission: ${url}

Nothing is required from you. This file updates itself.

[ SHOT FROM SPACE ]
Reply to this message to reach mission control.`;

  const html = htmlShell({
    eyebrow: `MISSION / ${d.code}`,
    title: 'Mission confirmed',
    lede: 'Your target coordinates are locked. The mission is queued for tasking with the constellation operator.',
    body: [
      'Tasking takes one to three days to accept. After that a capture window opens over the target and we wait for clear conditions.',
      'Nothing is required from you. This file updates itself.',
    ],
    rows,
    cta: { label: 'Open mission file', href: url },
    footer: 'Reply to this message to reach mission control.',
  });

  return { subject, text, html };
}

function renderImageAcquired(d: MissionEmailData): RenderedEmail {
  const link = missionShortLink(d.code);
  const url = `${SITE_URL}/m/${d.code}`;
  const rows: Array<[string, string]> = [
    ['MISSION', d.code],
    ['TARGET', d.locationLabel],
    ['COORDINATES', formatCoords(d.lat, d.lon)],
    ['CAPTURED', ts(d.capturedAt)],
    ['SENSOR', (d.sensor ?? 'HR / OPTICAL').replace(/^SKYFI-/, '')],
    ['RESOLUTION', d.gsdM !== undefined ? `${d.gsdM} M GSD` : '0.5 M GSD'],
    ['CLOUD', d.cloudPct !== undefined ? `${d.cloudPct}%` : '—'],
    ['FILE', link],
  ];

  const subject = `MISSION / ${d.code} — IMAGE ACQUIRED`;
  const text = `IMAGE ACQUIRED

The satellite passed over ${d.locationLabel} and the frame is down.
A watermarked preview has been released to your mission file.

${textRows(rows)}

View the frame: ${url}

Next: colour grade, composition and telemetry overlay, then the print file
goes to the production facility.

[ SHOT FROM SPACE ]
Reply to this message to reach mission control.`;

  const html = htmlShell({
    eyebrow: `MISSION / ${d.code}`,
    title: 'Image acquired',
    lede: `The satellite passed over ${d.locationLabel} and the frame is down. A watermarked preview has been released to your mission file.`,
    body: [
      'Next: colour grade, composition and telemetry overlay, then the print file goes to the production facility.',
    ],
    rows,
    cta: { label: 'View the frame', href: url },
    footer: 'Reply to this message to reach mission control.',
  });

  return { subject, text, html };
}

function renderShipped(d: MissionEmailData): RenderedEmail {
  const link = missionShortLink(d.code);
  const url = d.trackingUrl ?? `${SITE_URL}/m/${d.code}`;
  const rows: Array<[string, string]> = [
    ['MISSION', d.code],
    ['TARGET', d.locationLabel],
    ['FORMAT', d.formatLabel],
    ['FACILITY', d.printFacility ?? '—'],
    ['CARRIER', d.carrier ?? '—'],
    ['TRACKING', d.trackingNumber ?? '—'],
    ['ETA', dt(d.estimatedDeliveryAt)],
    ['FILE', link],
  ];

  const subject = `MISSION / ${d.code} — SHIPPED`;
  const text = `SHIPPED

The print left ${d.printFacility ?? 'the production facility'} and is with the
carrier. Tracking is active.

${textRows(rows)}

Track the package: ${url}

${packagingSentence(Boolean(d.framed))}

[ SHOT FROM SPACE ]
Reply to this message to reach mission control.`;

  const html = htmlShell({
    eyebrow: `MISSION / ${d.code}`,
    title: 'Shipped',
    lede: `The print left ${d.printFacility ?? 'the production facility'} and is with the carrier. Tracking is active.`,
    body: [packagingSentence(Boolean(d.framed))],
    rows,
    cta: { label: 'Track the package', href: url },
    footer: 'Reply to this message to reach mission control.',
  });

  return { subject, text, html };
}

/**
 * What the notice may say about the money.
 *
 * Every branch here is something the code has just done or just failed to do,
 * handed over as `refundStatus`. The earlier version promised "refunded in
 * full … allow a few working days" unconditionally, at a time when there was
 * no refund call in the codebase at all. Do not restore a sentence that the
 * pipeline cannot keep.
 */
function refundSentence(d: MissionEmailData): string {
  if (!d.amountLabel || d.refundStatus === 'NOT_CHARGED') {
    return 'Nothing was charged for this mission.';
  }

  switch (d.refundStatus) {
    case 'REFUNDED':
      return `Your payment of ${d.amountLabel} has been refunded in full to the card that authorised it. Allow a few working days for it to appear on the statement.`;
    case 'PENDING':
      return `A full refund of ${d.amountLabel} has been submitted to your card issuer. Allow a few working days for it to appear on the statement.`;
    case 'FAILED':
      return `A full refund of ${d.amountLabel} is owed to you and could not be placed automatically. Mission control has been alerted and will complete it by hand; reply to this message if you have not seen it within five working days.`;
    default:
      // No status at all — an older caller, or a mission cancelled outside the
      // customer window where the amount is still being worked out.
      return d.cancelledBeforeTasking
        ? `A full refund of ${d.amountLabel} is due to you under the cancellation guarantee. Mission control will confirm it on this file.`
        : `Mission control will be in touch about the ${d.amountLabel} already authorised on this mission.`;
  }
}

/**
 * CANCELLATION NOTICE.
 *
 * Sent when a mission is cancelled — which, for a customer, can only happen
 * before SATELLITE_TASKED (lib/missions/state.ts). The copy therefore states
 * plainly that nothing was collected and nothing was printed, because that is
 * what the stage guarantees.
 *
 * The refund IS placed now — `refundPayment` in lib/integrations/stripe.ts,
 * called from `cancelEffect` in lib/missions/state.ts — and its outcome
 * arrives here as `refundStatus`. The money sentence is chosen from that and
 * from nothing else. Do not add a claim here that the code cannot keep.
 */
function renderMissionCancelled(d: MissionEmailData): RenderedEmail {
  const link = missionShortLink(d.code);
  const url = `${SITE_URL}/m/${d.code}`;
  const stageLabel = d.stageLabel ?? 'MISSION CONFIRMED';
  const rows: Array<[string, string]> = [
    ['MISSION', d.code],
    ['TARGET', d.locationLabel],
    ['FORMAT', d.formatLabel],
    ['STOPPED AT', stageLabel],
    ['FILE', link],
  ];
  if (d.amountLabel) rows.push(['REFUND DUE', d.amountLabel]);
  if (d.receiptNumber) rows.push(['RECEIPT', d.receiptNumber]);

  // What is TRUE about this cancellation depends entirely on where it
  // happened, so nothing is assumed. Inside the window the satellite was
  // never tasked and that can be stated outright; outside it, the mission had
  // already been worked on and the notice says only what it knows.
  const lede = d.cancelledBeforeTasking
    ? `Mission ${d.code} over ${d.locationLabel} is cancelled. The satellite was never tasked, so no frame was collected and no print was produced.`
    : `Mission ${d.code} over ${d.locationLabel} is cancelled at ${stageLabel}. No further collection or production will be attempted.`;

  const refundLine = refundSentence(d);

  const closing =
    'Nothing further is required from you. Order again whenever you like — the target and the format are yours to choose from scratch.';

  const subject = `MISSION / ${d.code} — CANCELLED`;
  const text = `MISSION CANCELLED

${lede}

${refundLine}

${textRows(rows)}

The file stays open: ${url}

${closing}

[ SHOT FROM SPACE ]
Reply to this message to reach mission control.`;

  const html = htmlShell({
    eyebrow: `MISSION / ${d.code}`,
    title: 'Mission cancelled',
    lede,
    body: [refundLine, closing],
    rows,
    cta: { label: 'Open mission file', href: url },
    footer: 'Reply to this message to reach mission control.',
  });

  return { subject, text, html };
}

function renderMagicLink(d: MagicLinkEmailData): RenderedEmail {
  const rows: Array<[string, string]> = [
    ['VALID FOR', `${d.expiresInMinutes} MINUTES`],
    ['SINGLE USE', 'YES'],
  ];

  const subject = 'ACCESS LINK — SHOT FROM SPACE';
  const text = `ACCESS LINK

Use the link below to open your mission files. It works once and expires in
${d.expiresInMinutes} minutes.

${d.url}

${textRows(rows)}

If you did not request this, ignore it. No account is created and no mission
file is opened until the link is used.

[ SHOT FROM SPACE ]
Reply to this message to reach mission control.`;

  const html = htmlShell({
    eyebrow: 'ACCESS',
    title: 'Access link',
    lede: `Use the link below to open your mission files. It works once and expires in ${d.expiresInMinutes} minutes.`,
    body: [
      'If you did not request this, ignore it. No account is created and no mission file is opened until the link is used.',
    ],
    rows,
    cta: { label: 'Open mission files', href: d.url },
    footer: 'Reply to this message to reach mission control.',
  });

  return { subject, text, html };
}

function render(input: EmailPayload): RenderedEmail {
  switch (input.template) {
    case 'order_confirmed':
      return renderOrderConfirmed(input.data);
    case 'image_acquired':
      return renderImageAcquired(input.data);
    case 'shipped':
      return renderShipped(input.data);
    case 'mission_cancelled':
      return renderMissionCancelled(input.data);
    case 'magic_link':
      return renderMagicLink(input.data);
  }
}

/* ------------------------------------------------------------------ */
/* Persistence — identical for mock and live                          */
/* ------------------------------------------------------------------ */

async function logEmail(
  input: SendEmailInput,
  rendered: RenderedEmail,
  provider: 'mock' | 'resend',
): Promise<string> {
  try {
    const row = await prisma.emailLog.create({
      data: {
        missionId: input.missionId ?? null,
        to: input.to,
        template: input.template,
        subject: rendered.subject,
        bodyText: rendered.text,
        bodyHtml: rendered.html,
        provider,
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    // A mail log failure must never take an order down.
    console.warn('[email] could not write EmailLog:', (err as Error).message);
    return `unlogged_${Date.now()}`;
  }
}

/* ------------------------------------------------------------------ */
/* MOCK                                                               */
/* ------------------------------------------------------------------ */

export const mock: EmailAdapter = {
  render,
  async send(input) {
    const rendered = render(input);
    await sleep(120);
    const id = await logEmail(input, rendered, 'mock');

    // A readable block in the terminal — this is the demo's "inbox".
    const bar = '─'.repeat(64);
    console.log(
      [
        '',
        bar,
        `  MAIL / ${input.template.toUpperCase()}   →  ${input.to}`,
        `  ${rendered.subject}`,
        bar,
        rendered.text
          .split('\n')
          .map((l) => `  ${l}`)
          .join('\n'),
        bar,
        '',
      ].join('\n'),
    );

    return { id, provider: 'mock', subject: rendered.subject, ok: true };
  },
};

/* ------------------------------------------------------------------ */
/* LIVE — Resend. Complete but inactive until MOCK_MODE=false + key.   */
/* ------------------------------------------------------------------ */

export const live: EmailAdapter = {
  render,
  async send(input) {
    const rendered = render(input);
    try {
      // POST https://api.resend.com/emails
      // Docs: https://resend.com/docs/api-reference/emails/send-email
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${INTEGRATIONS.email.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: INTEGRATIONS.email.from,
          to: [input.to],
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          // Replies land with mission control, not in a no-reply void.
          reply_to: 'mission@shotfromspace.com',
          tags: [{ name: 'template', value: input.template }],
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        console.error('[email] resend rejected the send:', res.status, detail);
        const id = await logEmail(input, rendered, 'resend');
        return { id, provider: 'resend', subject: rendered.subject, ok: false };
      }

      const json = (await res.json()) as { id?: string };
      await logEmail(input, rendered, 'resend');
      return {
        id: json.id ?? `resend_${Date.now()}`,
        provider: 'resend',
        subject: rendered.subject,
        ok: true,
      };
    } catch (err) {
      // Network failure must not break a mission transition.
      console.error('[email] live send failed:', (err as Error).message);
      const id = await logEmail(input, rendered, 'resend');
      return { id, provider: 'resend', subject: rendered.subject, ok: false };
    }
  },
};

/* ------------------------------------------------------------------ */
/* Public surface                                                     */
/* ------------------------------------------------------------------ */

function adapter(): EmailAdapter {
  return isLive('email') ? live : mock;
}

/** Renders and delivers a transactional email. Never throws. */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    return await adapter().send(input);
  } catch (err) {
    console.error('[email] send failed:', (err as Error).message);
    return { id: 'failed', provider: 'mock', subject: '', ok: false };
  }
}

/** Renders an email without sending it — used by previews and tests. */
export function renderEmail(input: EmailPayload): RenderedEmail {
  return render(input);
}

export const emailAdapter = { sendEmail, renderEmail, mock, live };
