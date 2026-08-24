import Link from 'next/link';
import { Band, Container, Grid12 } from '@/components/fui';
import { PUBLIC_MOCK_MODE } from '@/lib/env';
import { LicensedSeal } from './LicensedSeal';
import { Wordmark } from './Wordmark';

const COLUMNS = [
  {
    label: 'Product',
    links: [
      // /mission is the default funnel; the header and the mobile index
      // were repointed with it. See INTEGRATIONS.md on the two-flow decision.
      { href: '/mission', label: 'Start a mission' },
      { href: '/missions', label: 'Mission archive' },
      { href: '/how-it-works', label: 'Process' },
      { href: '/account', label: 'Account' },
    ],
  },
  {
    label: 'Capability',
    links: [
      { href: '/how-it-works#tasking', label: 'Satellite tasking' },
      { href: '/how-it-works#capture', label: 'Capture windows' },
      { href: '/how-it-works#composition', label: 'Composition' },
      { href: '/how-it-works#print', label: 'Printing' },
    ],
  },
  {
    label: 'File',
    links: [
      { href: '/legal/terms', label: 'Terms' },
      { href: '/legal/privacy', label: 'Privacy' },
      { href: '/legal/imagery', label: 'Imagery credits' },
      { href: '/system', label: 'Design system' },
    ],
  },
];

/**
 * FOOTER — tall, link-dense, grouped columns.
 *
 * The largest padding on the page and the only place `--band-footer`
 * appears: 56px at 390, stepping to 104px at 2400. There is NO top
 * border. The footer is separated from the page by mass, not by a
 * rule.
 *
 * It closes on the dark ground whatever came before it, so the last
 * thing on every page is the lockup on void, the way the poster ends.
 *
 * ------------------------------------------------------------------
 * THE FIVE STEPS
 * ------------------------------------------------------------------
 *   390   brand block full width; the three groups in a 2 + 1 grid
 *         below it. Every row is 44px — this is the densest thing on
 *         the page and it is still all thumb-sized.
 *   768   the three groups go across in one row of 4-col cells, brand
 *         still full width above them.
 *   1280  brand joins the row: 3 + 3 + 3 + 3, a flat four-column
 *         footer, which is the first width it fits at.
 *   1440  same structure, the column at its 1376px maximum, band
 *         padding at 72px.
 *   1920  the footer stops obeying the column. `.column-expand` takes
 *         it to a 1600px cap on 64px gutters and the groups move right
 *         — brand at columns 1–3, links at 7–8, 9–10, 11–12 — so the
 *         page ends on a spread rather than on a 1376px block adrift
 *         in 544px of nothing. This is an INDEX, not prose: it is
 *         exactly the kind of section that should take a big display.
 *   2400  the same spread at a 2000px cap on 80px gutters, 104px band
 *         padding, type one step up again.
 *
 * Every link answers to the pointer: colour lifts and an underline
 * grows from the leading edge on the house curve.
 */
export function SiteFooter() {
  return (
    <>
      <Band as="footer" tone="dark" top="footer" bottom="footer">
        <Container size="flush">
          <div className="column-expand">
            <Grid12>
              <div className="col-span-12 flex flex-col gap-5 xl:col-span-3 xl2:gap-6">
                <Link
                  href="/"
                  aria-label="Shot from Space — home"
                  className="inline-flex w-fit text-paper transition-house hover:opacity-80"
                >
                  <Wordmark className="h-14 w-auto xl:h-16 xl2:h-20 xl3:h-24" />
                </Link>
                {/* Capped in `ch`, not in px: the type steps up at 1920
                    and 2400 and the LINE stays the same length. */}
                <p className="measure-tight text-body text-paper-dim">
                  One photograph of your address, taken from orbit on request.
                  Tasked, composed, printed in your region and shipped as a
                  finished object.
                </p>
                <p className="text-label uppercase text-paper-dim">
                  First portfolio company of 0humans
                </p>
              </div>

              {COLUMNS.map((col, i) => (
                <nav
                  key={col.label}
                  aria-label={col.label}
                  className={[
                    'col-span-6 flex flex-col gap-3 md:col-span-4 xl:col-span-3 xl2:col-span-2 xl2:gap-4',
                    // Only the first group needs placing; the other two
                    // follow it. 3 + gap + 2 + 2 + 2 = a spread.
                    i === 0 ? 'xl2:col-start-7' : '',
                  ].join(' ')}
                >
                  <span className="text-label uppercase text-paper-dim">
                    {col.label}
                  </span>
                  {/* No row gap: the 44px rows ARE the rhythm. */}
                  <ul className="flex flex-col">
                    {col.links.map((l) => (
                      <li key={l.href} className="flex">
                        {/* 44px at every width. A footer is where a
                            thumb goes looking for the legal page. */}
                        <Link
                          href={l.href}
                          className="link-underline inline-flex min-h-11 items-center text-action text-paper-dim hover:text-paper"
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}

              {/* CREDITS + SEAL. The seal is LAST in source order and pinned
                  to the end, so it lands bottom-right at every width.

                  The seal is now ~136-224px rather than 68 — the wording on
                  it has to be legible — which is far too tall to sit in the
                  same wrap flow as two lines of label type: at 390 it would
                  land beside a credit and leave a ragged hole. So the two
                  credits are their own wrapping group and the row splits:
                  stacked below 768 with the seal on its own line, one row
                  from 768 up. `items-end` rather than `items-center` because
                  a 200px object and a 2-line credit share a bottom edge, not
                  a midline — centred, the credits float in the middle of the
                  seal and read as unrelated.

                  `ml-auto` rather than `justify-between`: in the column it
                  pushes the seal to the right on the cross axis, in the row
                  it takes up all the slack, and in neither case does the
                  imagery credit get pushed into the middle and read as a
                  third column. The wrapping <div> around <LicensedSeal /> is
                  load-bearing — artifact3d.module.css sets `margin: 0` on
                  its own root, which silently beats an `ml-auto` utility put
                  on the component itself. */}
              <div className="col-span-12 mt-10 flex flex-col gap-y-8 border-t border-hairline pt-6 md:flex-row md:items-end md:gap-x-8 xl:mt-14 xl2:mt-20 xl2:pt-8 xl3:mt-24">
                <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3">
                  <span className="text-label uppercase text-paper-dim">
                    © {new Date().getUTCFullYear()} Shot from Space
                  </span>
                  <span className="text-label uppercase text-paper-dim">
                    Example imagery: NASA / USGS Landsat — public domain
                  </span>
                </div>
                <div className="ml-auto shrink-0">
                  <LicensedSeal />
                </div>
              </div>
            </Grid12>
          </div>
        </Container>
      </Band>

      {PUBLIC_MOCK_MODE ? <MockModeBar /> : null}
    </>
  );
}

/** Thin amber strip shown while every external integration is mocked. */
function MockModeBar() {
  return (
    <div className="border-t border-[#7a5410] bg-[#160f02]">
      <Container className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 xl2:py-3">
        <span className="flex items-center gap-2 font-mono text-tele-xs uppercase text-[#f0b23a]">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#f0b23a]" />
          Mock mode
        </span>
        <span className="font-mono text-tele-xs uppercase text-[#f0b23a]/70">
          Stripe · SkyFi · Gelato · ElevenLabs · email simulated — see INTEGRATIONS.md
        </span>
      </Container>
    </div>
  );
}
