import type { Metadata } from 'next';
import { DATA_REQUEST_DAYS, PRIVACY_EMAIL } from '@/lib/guarantees';
import { DocHeader } from '../DocHeader';
import { DocParagraph, DocSection } from '../DocSection';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What Shot from Space collects, why, and how long it is kept.',
};

/**
 * WHAT THIS PAGE MAY PROMISE.
 *
 * A privacy policy is a statement of what the system does, so nothing here
 * may describe a mechanism that does not exist. Two sentences used to:
 * "Ask us to delete your account and we delete your personal data" (there is
 * no deletion code anywhere in this codebase) and subject-access requests
 * "answered within thirty days" through Mission Comms (which has no privacy
 * intent, so such a message fell through to the generic operator reply).
 *
 * Both are now described as what they actually are: a request to a named
 * address, handled by a person, inside a stated deadline. The deadline is a
 * real obligation under UK/EU law whether or not code exists — a human can
 * keep it, and this page no longer implies a button that does.
 *
 * If you build the deletion endpoint, come back and say so here.
 */
const SECTIONS = [
  {
    heading: 'What we collect',
    body: [
      'The address you ask us to photograph, because it is the product. Your email address, because it is how a mission reaches you and how your account exists. Your delivery address, if it differs from the target. Payment is processed by Stripe; we never see or store card details.',
      'We also store the mission itself: its capture telemetry, its timeline, the frames acquired for it, and any Mission Comms correspondence.',
      // ADDED WHEN THE CONFIRMATION SCREEN BEGAN ASKING FOR A NUMBER.
      // Collecting a category of personal data the notice does not name
      // is a real defect, not a documentation lapse, so this line ships
      // with the field rather than after it. It states the single
      // purpose, that it is optional, and that nothing is sent today —
      // which is the truth while no SMS provider is wired. See
      // components/mission-flow/S10Confirmation.tsx and
      // app/api/missions/[code]/notify/route.ts.
      'A mobile number, only if you choose to leave one after paying. It has one purpose: to tell you when a satellite has been found for your mission. It is never used for marketing, never printed on anything and never passed to another company. No message is sent today — no SMS provider is connected yet, so a number given now is held against the mission and nothing more. You can remove it from the same place you gave it.',
    ],
  },
  {
    heading: 'What we do not collect',
    body: [
      'No password — access is by single-use link. No advertising identifiers, no third-party trackers, no cross-site pixels, no session recording, no behavioural profiling. We do not sell or rent anything about you.',
    ],
  },
  {
    heading: 'Your target address',
    body: [
      'The street address you target is used to task the satellite and to produce the print. It is visible to you inside your own account. It is never shown on a public mission page, never shown on a shared mission link, and never included in the archive. Public and shared views resolve location to city level only.',
    ],
  },
  {
    heading: 'Who else handles your data',
    body: [
      'SkyFi receives the target coordinates in order to task a capture. Gelato receives your delivery address and the print file in order to produce and ship the object. Stripe processes payment. Our email provider delivers transactional messages. Each receives only what its job requires, and none of them receive your data for their own purposes.',
    ],
  },
  {
    heading: 'How long we keep it',
    body: [
      'Mission records, including the frame and its telemetry, are kept for as long as your account exists, so you can return to a mission years later. Order and payment records are kept for seven years where tax law requires it. Mission Comms transcripts are kept with the mission. There is no automatic purge: nothing is deleted until you ask us to delete it, or until we close the account.',
      `Ask us to delete your account and we delete your personal data — email, addresses, correspondence — and retain only the anonymised financial record the law requires. There is no self-serve delete button; it is a request to ${PRIVACY_EMAIL}, carried out by a person, and confirmed to you when it is done.`,
    ],
  },
  {
    heading: 'Your rights',
    body: [
      `You can request a copy of everything we hold about you, ask for a correction, or ask for deletion. Send it to ${PRIVACY_EMAIL} — that address is the route of record and it reaches a person. Mission Comms is an automated operator scoped to one mission's state; it will point a data request here rather than answer it. Requests are answered within ${DATA_REQUEST_DAYS} days. If you are in the EEA or the UK you may also complain to your national data protection authority.`,
    ],
  },
  {
    heading: 'Cookies',
    body: [
      'One cookie: a session cookie set after you use a sign-in link, so you stay signed in. It is httpOnly, same-site, and expires after thirty days. There is no analytics cookie and no consent banner, because there is nothing to consent to.',
    ],
  },
  {
    heading: 'Automated operation',
    body: [
      'This service is run by software agents. Your correspondence in Mission Comms is answered by an automated operator with access to your mission state. It cannot see your payment details. Ask for a human at any point and the mission is escalated.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <DocHeader
        index="02"
        title="Privacy"
        revised="2026-08-01T00:00:00Z"
        summary="We collect an address, an email and a payment, and a mobile number only if you offer one. The address is the product. Everything else is what it takes to get a printed photograph to your door."
      />
      {SECTIONS.map((s, i) => (
        <DocSection key={s.heading} index={String(i + 1).padStart(2, '0')} heading={s.heading}>
          {s.body.map((p) => (
            <DocParagraph key={p.slice(0, 32)}>{p}</DocParagraph>
          ))}
        </DocSection>
      ))}
      <footer className="border-t border-hairline pt-6">
        <p className="max-w-[62ch] font-mono text-tele-s uppercase leading-[1.7] text-paper-faint">
          DATA REQUESTS: {PRIVACY_EMAIL.toUpperCase()}
        </p>
      </footer>
    </>
  );
}
