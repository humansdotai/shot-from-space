import Link from 'next/link';
import { clsx as cn } from 'clsx';
import { PRINT_FACILITY } from '@/lib/pricing';
import { CLOUD_THRESHOLD_WORD, MATERIALS, PACKAGING, REFUND_WINDOW_DAYS } from '@/lib/guarantees';
import type { Region } from '@/lib/types';
import { INK, INK_DIM, RULE } from './fields';

/**
 * The five questions that actually stop this purchase.
 *
 * They are answered on /how-it-works and on the landing page, but a reader
 * who has got as far as the authorise control will not leave the page to find
 * them — they will leave the page. So the same five answers sit here, one tap
 * from the button, closed by default so they cost nothing to the reader who
 * has already decided.
 *
 * Native disclosures: no state, no JavaScript, keyboard and screen reader
 * behaviour for free, and each summary is a 48px row. The answers are the
 * ones the rest of the site gives — the same numbers, the same policy. A
 * different answer here from the one on /how-it-works would be worse than no
 * answer at all.
 */
function answers(region: Region) {
  return [
    {
      q: 'What does the resolution actually show?',
      a: [
        'Captures are ordered at roughly fifty centimetres to a pixel, looking near-straight-down. Your roof, your driveway, parked cars as distinct rectangles, individual mature trees, the street pattern your address sits inside.',
        'It does not show faces — a person is a mark about two pixels across — and it does not show house numbers, number plates, or anything through a window, under a canopy or indoors. This is a portrait of a place, not surveillance of the people in it.',
      ],
    },
    {
      q: 'How long does it take?',
      a: [
        'Tasking is filed with the operator inside a day of the payment settling. A specific point on the ground comes back around every one to three days, so the capture window opens within about a week and normally closes inside two.',
        'Printing adds one to two days and transit three to seven. The dates in your brief are that arithmetic run against today.',
      ],
    },
    {
      q: 'What happens if it is cloudy?',
      a: [
        `Cloud over ${CLOUD_THRESHOLD_WORD} percent across the target fails the frame, and the next pass is re-tasked at no cost to you. There is no limit on re-tasking and nothing is added to the price.`,
        `Every attempt is logged to your mission file, including the ones that fail. If no usable frame is acquired within ${REFUND_WINDOW_DAYS} days the mission is refunded in full.`,
      ],
    },
    {
      q: 'Where does it print, and what does it arrive as?',
      a: [
        `Your region's own facility — ${PRINT_FACILITY[region]} — so the print crosses no customs desk on the way to you. Shipping and duties are already inside the price shown.`,
        `It arrives as a finished object: the capture composed with the telemetry of its own pass, printed on ${MATERIALS.paperUnframed} and shipped ${PACKAGING.unframedPhrase}, or on ${MATERIALS.paperFramed} in a ${MATERIALS.frameLower} frame and shipped ${PACKAGING.framedPhrase}.`,
      ],
    },
    {
      q: 'Who can see my address?',
      a: [
        'Nobody outside the fulfilment chain. The mission file and the public archive show a city and a country, never a street address — the record says where the frame was taken, not who asked for it.',
        'The address itself is used for two things: aiming the satellite and printing a shipping label.',
      ],
    },
  ];
}

export function Objections({ region }: { region: Region }) {
  return (
    <div>
      <p className={cn('pb-1 text-label uppercase', INK_DIM)}>Before you authorise</p>
      <div>
        {answers(region).map((item) => (
          <details key={item.q} className={cn('group border-t', RULE)}>
            <summary
              className={cn(
                'flex min-h-12 cursor-pointer list-none items-center justify-between gap-5 py-3 text-action transition-house',
                'hover:text-[color:var(--ink)] [&::-webkit-details-marker]:hidden',
                INK,
              )}
            >
              <span className="min-w-0">{item.q}</span>
              {/* A rule that closes into a cross. One drawing, two states. */}
              <span aria-hidden className="relative h-3 w-3 shrink-0">
                <span
                  className={cn(
                    'absolute top-1/2 left-0 h-px w-3 -translate-y-1/2',
                    'bg-[color:var(--rule-strong)]',
                  )}
                />
                <span
                  className={cn(
                    'absolute top-0 left-1/2 h-3 w-px -translate-x-1/2 transition-transform duration-house ease-house',
                    'bg-[color:var(--rule-strong)] group-open:scale-y-0',
                  )}
                />
              </span>
            </summary>
            <div className="pb-5">
              {item.a.map((paragraph, i) => (
                <p
                  key={paragraph}
                  className={cn('max-w-[var(--measure)] text-body', INK_DIM, i > 0 && 'pt-3')}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </details>
        ))}
      </div>

      <p className={cn('border-t pt-4 text-body', RULE, INK_DIM)}>
        The long version of all five is on{' '}
        <Link
          href="/how-it-works"
          className="link-underline text-[color:var(--ink-dim)] transition-house hover:text-[color:var(--ink)]"
        >
          how it works
        </Link>{' '}
        and in the{' '}
        <Link
          href="/legal/terms"
          className="link-underline text-[color:var(--ink-dim)] transition-house hover:text-[color:var(--ink)]"
        >
          terms
        </Link>
        .
      </p>
    </div>
  );
}
