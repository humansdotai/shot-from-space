import type { Metadata } from 'next';
import { ActionButton } from '@/components/fui';
import { MissionNotice } from '@/components/mission';

/**
 * 404 — the site-wide designed refusal.
 *
 * Rendered through <MissionNotice />, which is the component the shared-file
 * refusals already use (`app/s/[code]/page.tsx`). A 404 is a refusal like any
 * other, so it takes the same stamp, the same tag rail and the same operations
 * metadata rather than a bespoke page: this route is the one a visitor is
 * least likely to have chosen to visit, and it is the worst possible place to
 * introduce a layout they have not seen anywhere else on the site.
 *
 * The headline is the owner's copy, verbatim.
 *
 * Two ways out and no more — the archive, which needs nothing from the
 * visitor, and the flow, which is the only thing this site asks anyone to do.
 * A 404 with a link list is a sitemap apologising.
 */
export const metadata: Metadata = {
  title: 'Lost in space',
  description: 'No record matches that address.',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <MissionNotice
      stamp="No record"
      title="Lost in space. Reacquiring telemetry."
      tags={['NAVIGATION', 'NO FIX']}
      body="Nothing on file answers to that address. The link may be mistyped, or the page it pointed at may have been retired. The mission archive is open to anyone and needs no key."
      actions={
        <>
          <ActionButton variant="primary" size="lg" href="/missions">
            Open the archive
          </ActionButton>
          <ActionButton variant="ghost" size="lg" href="/">
            Back to the start
          </ActionButton>
        </>
      }
    />
  );
}
