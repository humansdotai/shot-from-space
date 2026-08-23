import type { Metadata } from 'next';
import {
  CAPTURE_WINDOW_DAYS,
  CLOUD_THRESHOLD_PCT,
  DAMAGE_REPORT_DAYS,
  MATERIALS,
  PACKAGING,
  REFUND_WINDOW_DAYS,
} from '@/lib/guarantees';
import { DocHeader } from '../DocHeader';
import { DocParagraph, DocSection } from '../DocSection';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'Terms of sale and service for Shot from Space missions.',
};

/**
 * THIS PAGE IS THE CONTRACT. EVERY SHORTER FORM ON THE SITE ANSWERS TO IT.
 *
 * The five guarantees on the landing page and in the purchase flow are the
 * same promises with words removed — never stronger ones. They and this page
 * both read their numbers from lib/guarantees.ts, because a guarantee with a
 * number typed into it twice is a guarantee with two different values, and
 * that is what a QA pass found: cloud published at ten percent while the
 * tasking order asked for fifteen, sixty days counted from tasking here and
 * from confirmation there, and a thirty-day damage deadline that appeared in
 * the contract and nowhere else.
 *
 * If you change a promise, change it in lib/guarantees.ts. If a promise needs
 * words this file alone can carry, add them here — but do not re-type a
 * number that already exists in that module.
 *
 * A promise on this page must also have code behind it. Where it does, the
 * comment names the code. Where it does not, the sentence says what actually
 * happens instead.
 */
const SECTIONS = [
  {
    heading: 'What you are buying',
    body: [
      'A mission is a request to photograph a single address from orbit and to deliver that photograph as a finished print. You select a target address and a format. We task a satellite over the target, compose the resulting frame with its own capture telemetry, print it in your region and ship it to you.',
      'You are buying the printed object. The digital file is a by-product of producing it and is made available to you as a preview inside Mission Control.',
    ],
  },
  {
    heading: 'Capture is subject to orbit and weather',
    body: [
      `Satellites pass over a given point on a schedule that cannot be changed, and cloud cover cannot be predicted with certainty. A capture window is normally ${CAPTURE_WINDOW_DAYS.min} to ${CAPTURE_WINDOW_DAYS.max} days. If a pass is obstructed, the mission is re-tasked for the next viable window at no additional cost. Re-tasking is recorded in your mission timeline.`,
      // The threshold is the number sent to the operator as
      // `maxCloudCoveragePercent` in lib/integrations/skyfi.ts. One constant,
      // both places. It used to be published as 10 and requested as 15.
      `Cloud above ${CLOUD_THRESHOLD_PCT}% over the target fails the frame. We do not deliver a capture above that figure; we book the next pass at our expense, as many times as the weather takes.`,
      // Implemented: closeUnfulfilledMissions() in lib/missions/index.ts,
      // triggered by /api/jobs/refund-sweep, which places the Stripe refund
      // through refundPayment() in lib/integrations/stripe.ts.
      `If no usable frame is acquired within ${REFUND_WINDOW_DAYS} days of the mission being confirmed, the mission is closed and refunded in full without you asking for it.`,
    ],
  },
  {
    heading: 'What a capture can and cannot show',
    body: [
      'A tasked capture resolves buildings, roofs, vehicles, pools, gardens and the shape of a property. It does not resolve people, faces, number plates or anything inside a building. We photograph from orbit at nadir or near-nadir; we do not photograph obliquely into windows, and we do not operate aircraft or drones.',
      'Example frames shown in the mission archive are public-domain Landsat imagery at roughly thirty metres per pixel, acquired between 1986 and 2023 — each one is credited with its own acquisition date on the imagery credits page. They demonstrate composition, not the resolution of a tasked capture.',
    ],
  },
  {
    heading: 'Addresses you may target',
    body: [
      'You may target an address you own, occupy or have a legitimate connection to, or any location that is not a private residence. Do not target a private residence you have no connection to. We reserve the right to decline or refund any mission, before or after payment, without stating a reason.',
      'Certain territories cannot be tasked because of imaging restrictions imposed on the satellite operator. If your target falls inside one, the mission is declined and refunded before tasking.',
    ],
  },
  {
    heading: 'Pricing, payment and duties',
    body: [
      'Prices are shown in full before you authorise a mission and include shipping and any import duties. There are no additional charges at delivery. Orders placed to addresses in the European Economic Area, the United Kingdom and Switzerland are priced in euro and printed in the Netherlands. All other orders are priced in US dollars and printed in Nevada.',
      'Payment is taken at authorisation, before tasking, because tasking a satellite commits a real cost to us at that moment.',
    ],
  },
  {
    heading: 'What arrives',
    body: [
      // Written from GELATO_PRODUCT_UID in lib/integrations/gelato.ts via
      // MATERIALS. The site used to promise pigment ink on museum-grade
      // cotton glazed with anti-glare acrylic; none of that is ordered.
      `An unframed print is ${MATERIALS.paperUnframed}, and ships ${PACKAGING.unframedPhrase}. A framed print is ${MATERIALS.paperFramed} in a ${MATERIALS.frameLower} frame with ${MATERIALS.glazing} glazing, and ships ${PACKAGING.framedPhrase}.`,
      'The capture is composed with its own telemetry printed beneath it, and the credit line is part of the sheet rather than a sticker on the back.',
    ],
  },
  {
    heading: 'Cancellation and returns',
    body: [
      // Implemented: POST /api/missions/[code]/cancel, owner-gated, which
      // runs cancelEffect() — refund plus notice. There is no cancel control
      // in the mission file UI yet, so this says "ask" rather than "press".
      'You may cancel for a full refund at any point before the satellite is tasked — in practice, within a few hours of ordering. Ask through Mission Comms on your mission page and we cancel it and refund the payment. Once the mission reaches SATELLITE TASKED the capture cost is committed and cancellation is no longer possible.',
      `If the delivered print is damaged, misprinted or does not match the approved composition, we replace it. Report it within ${DAMAGE_REPORT_DAYS} days of delivery through Mission Comms on your mission page. Because each print is produced to order for a single address, we do not accept returns for change of mind once the print is produced.`,
    ],
  },
  {
    heading: 'Rights in the image',
    body: [
      'You receive a perpetual, worldwide, non-exclusive licence to use the frame captured for your mission for personal purposes, including displaying and reproducing the print. Commercial use requires written permission. This licence is granted by these terms; nothing further has to be issued to you for it to apply.',
      // Was: "We retain the right to display your mission frame in our own
      // archive … Ask us and we will remove it." Missions are created with
      // isPublic false and there is no publication path or removal control,
      // so the right claimed was broader than the product, and the removal
      // promise had nothing behind it. This states what is actually true.
      'We do not publish customer mission frames. The public archive is public-domain Landsat imagery only. If we ever want to show a frame from your mission, we will ask you first, and showing it would be limited to city-level location — your street address is never published.',
    ],
  },
  {
    heading: 'Operation',
    body: [
      'This service is operated by an automated pipeline. Orders, tasking, composition, production and support correspondence are handled by software agents with human oversight at the edges. Mission Comms connects you to that pipeline directly.',
      'Nothing in these terms limits your statutory rights as a consumer.',
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <DocHeader
        index="01"
        title="Terms of sale and service"
        revised="2026-08-01T00:00:00Z"
        summary="Plain terms for a product that photographs a single address from orbit and ships the result as a print. Read the capture and targeting sections — they are the ones that matter."
      />
      {SECTIONS.map((s, i) => (
        <DocSection key={s.heading} index={String(i + 1).padStart(2, '0')} heading={s.heading}>
          {s.body.map((p) => (
            <DocParagraph key={p.slice(0, 32)}>{p}</DocParagraph>
          ))}
        </DocSection>
      ))}
      <footer className="border-t border-hairline pt-6">
        {/* §A2. Subject, verb, two prepositional phrases — a sentence,
            so it is set as one. */}
        <p className="max-w-[62ch] text-note text-paper-faint">
          Questions about these terms go through Mission Comms on your mission page.
        </p>
      </footer>
    </>
  );
}
