/**
 * /mission — the printable commission certificate.
 *
 * Offered on the confirmation screen: something to put in an envelope on
 * the day the print itself is still in orbit.
 *
 * IT SAYS WHAT THE ORDER ACTUALLY IS. There are two products behind this
 * sheet and they are not the same act. A COMMISSION tasks a spacecraft
 * for a frame that does not exist yet; an ARCHIVE order prints a frame
 * that already does. The certificate used to state the first of those on
 * every order — *"A satellite has been commissioned to photograph these
 * coordinates. The frame does not exist yet"* — printed, signed and put
 * in an envelope for an archive buyer, over a `Capture window / TO BE
 * SCHEDULED` row for a capture nobody would ever schedule and a
 * `Resolution ordered` figure nobody ordered. `tasked` is what closes
 * that: the lede, the window row, the resolution row and the footnote
 * all follow it, and the archive sheet claims only what an archive order
 * is.
 *
 * IT IS BUILT IN THE BROWSER, from values the browser already has, and
 * downloaded as a self-contained HTML file sized for A4 with a print
 * stylesheet. No server round trip, no PDF dependency, no font fetch —
 * a certificate that needs a network to open is not a certificate.
 *
 * WHAT IT DOES NOT SAY. It does not say a frame has been captured, it
 * does not name a satellite and it does not carry a delivery date. On
 * the day it is printed none of those are known, and a certificate is
 * exactly the wrong document to guess on.
 *
 * THE CERTIFICATE IS NAMED FOR THE KIND OF MISSION. `tasked` already
 * chose the lede, the window row, the resolution row and the footnote;
 * it now also chooses the heading, the document title and the file name.
 * An archive buyer's sheet is headed ARCHIVE CERTIFICATE and saves as
 * `…-archive-certificate.html`; the word COMMISSION appears nowhere on
 * its face. One flag, one document per mission type, visible from the
 * browser tab down to the downloads folder.
 *
 * THE DISTINCTIONS ARE ON IT, AND THEY ARE ON IT AS DIGITAL. Five
 * honorary distinctions are conferred on every mission. This sheet is
 * the one printable record of the order, so it names them — and because
 * it is a sheet that goes in an envelope, it is the single most
 * dangerous place on the site to let a reader infer that a patch, a coin
 * or a plate is coming in a parcel. The block says outright that they
 * are held on the mission file, that none of them is manufactured,
 * packed or posted, and that the print is the only object that arrives.
 * Do not soften that wording. See components/mission/HonoursBlock.tsx
 * for the defect it exists to prevent.
 */

import { CAPTURE_GSD_CM } from './config';

export interface CertificateInput {
  missionName: string;
  missionCode: string;
  /** `51.5074° N 0.1278° W` — already formatted by the caller. */
  coordinates: string;
  /** Human date of the capture window, or null when none was chosen. */
  windowLabel: string | null;
  /** Human date the commission was placed. */
  commissionedLabel: string;
  formatLabel: string;
  giftNote: string;
  /**
   * True when a spacecraft is tasked for this order (`isTasked(tier)`).
   * False for an ARCHIVE order, whose frame is already on file — see the
   * note at the top of this file.
   */
  tasked: boolean;
}

/**
 * Conferred on every mission, automatically, and digital in every case.
 * Named here rather than imported from the honours block because that is a
 * React component on the mission file and this is a standalone HTML sheet
 * with no imports at all; the two lists are short, fixed and reviewed
 * together.
 */
const DISTINCTIONS = [
  'Mission plate',
  'Mission patch',
  'Mission badge',
  'Mission coin',
  'Lapel pin',
] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function certificateHtml(input: CertificateInput): string {
  const e = escapeHtml;
  const rows: [string, string][] = [
    ['Mission', input.missionName],
    ['Reference', input.missionCode],
    ['Coordinates', input.coordinates],
    // A tasking has a day it is asked for. An archive frame has none, and
    // `To be scheduled` over one is a promise of an event that will not
    // happen.
    input.tasked
      ? ['Capture window', input.windowLabel ?? 'To be scheduled']
      : ['Acquisition', 'Existing capture, already on file'],
    ['Commissioned', input.commissionedLabel],
    ['Print', input.formatLabel],
    ['Distinctions', 'Five, digital'],
    // `CAPTURE_GSD_CM` is the tier ORDERED from the operator at tasking.
    // Nothing is ordered for an archive frame, so nothing is quoted.
    ...(input.tasked
      ? ([
          [
            'Resolution ordered',
            `${CAPTURE_GSD_CM} cm per pixel, very-high-resolution tier`,
          ],
        ] as [string, string][])
      : []),
  ];

  const lede = input.tasked
    ? 'A satellite has been commissioned to photograph these coordinates. The frame does not exist yet. It will be taken during the window below and printed from the pass that takes it.'
    : 'An existing satellite frame of these coordinates has been commissioned as a print. The picture is already on file; nothing is tasked and nothing is waited for.';

  const heading = input.tasked ? 'Commission certificate' : 'Archive certificate';

  const foot = input.tasked
    ? 'This certificate records a commission, not a completed capture. No spacecraft is named on it because the operator assigns one at tasking time. Cloud over the target can move the capture to a later pass at no cost.'
    : 'This certificate records an archive commission: a frame that already exists over these coordinates, printed. No spacecraft is tasked for it and no capture is scheduled.';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${e(input.missionName)} — ${e(heading.toLowerCase())}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #ffffff; color: #08090b;
    font-family: ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .sheet { max-width: 174mm; margin: 0 auto; padding: 18mm 0; }
  .rule { border: 0; border-top: 1px solid rgba(8,9,11,0.2); margin: 0; }
  .mark {
    display: inline-block; border: 1px solid rgba(8,9,11,0.45);
    padding: 6px 10px; font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
    font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
  }
  h1 { font-size: 30px; line-height: 1.05; letter-spacing: -0.02em; font-weight: 400; margin: 28px 0 0; }
  .lede { max-width: 60ch; font-size: 14px; line-height: 1.6; color: #4a4f56; margin: 14px 0 0; }
  dl { margin: 32px 0 0; }
  .row { display: flex; justify-content: space-between; gap: 24px; border-top: 1px solid rgba(8,9,11,0.2); padding: 10px 0; }
  dt { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #4a4f56; }
  dd { margin: 0; font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
       font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; text-align: right; }
  .note { margin: 26px 0 0; padding: 14px 16px; border: 1px solid rgba(8,9,11,0.2); }
  .note p { margin: 0; font-size: 14px; line-height: 1.6; }
  .foot { margin: 34px 0 0; font-size: 11px; line-height: 1.55; color: #5f656c; max-width: 70ch; }
  .honours { margin: 26px 0 0; border-top: 1px solid rgba(8,9,11,0.2); padding: 14px 0 0; }
  .honours .label { margin: 0 0 8px; font-size: 10px; letter-spacing: 0.06em;
       text-transform: uppercase; color: #4a4f56; }
  .honours .names { margin: 0; font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
       font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }
  .honours .why { margin: 10px 0 0; font-size: 11px; line-height: 1.55; color: #5f656c; max-width: 70ch; }
  @media print { .sheet { padding: 0; } }
</style>
</head>
<body>
  <div class="sheet">
    <span class="mark">SHOT FROM SPACE</span>
    <h1>${e(heading)}</h1>
    <p class="lede">${e(lede)}</p>
    <dl>
      ${rows
        .map(([k, v]) => `<div class="row"><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`)
        .join('\n      ')}
    </dl>
    ${
      input.giftNote.trim()
        ? `<div class="note"><p>${e(input.giftNote.trim())}</p></div>`
        : ''
    }
    <div class="honours">
      <p class="label">Distinctions conferred</p>
      <p class="names">${DISTINCTIONS.map((d) => e(d)).join(' &middot; ')}</p>
      <p class="why">All five are conferred on this mission automatically. They are honorary and they are digital: they are held on the mission file and shown with it. None of them is manufactured, packed or posted &mdash; the print is the only object that arrives.</p>
    </div>
    <p class="foot">${e(foot)}</p>
    <hr class="rule" style="margin-top:24px">
  </div>
</body>
</html>`;
}

/**
 * Hands the certificate to the reader as a file.
 *
 * Returns false when the browser refuses the download, so the caller can
 * say so instead of leaving a button that appears to have done nothing.
 */
export function downloadCertificate(input: CertificateInput): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const blob = new Blob([certificateHtml(input)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${input.missionCode || 'mission'}-${
      input.tasked ? 'commission' : 'archive'
    }-certificate.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoked on the next tick: revoking synchronously can cancel the
    // download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
