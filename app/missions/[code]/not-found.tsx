'use client';

import { usePathname } from 'next/navigation';
import { Band, Button, Container } from '@/components/fui';
import { MissionLookup } from '@/components/discovery/MissionLookup';
import { missionShortLink, normalizeMissionCode } from '@/lib/codes';

/**
 * 404 for the archive.
 *
 * A well-formed code that is not in the reference archive is almost always a
 * customer's own mission — so this page hands them straight to Mission
 * Control instead of dead-ending. A malformed code gets the format back, and
 * a field to try again in.
 *
 * Client-side only because `not-found.tsx` receives no params: the requested
 * code is read off the pathname.
 *
 * The opening band is dark because the site bar floats over the first band
 * of every page and is set for a photograph. The answer to the question sits
 * on the paper band under it, like everything else that is written down.
 */
export default function MissionNotFound() {
  const pathname = usePathname();
  const raw = pathname.split('/').filter(Boolean).pop() ?? '';
  const code = normalizeMissionCode(decodeURIComponent(raw));

  return (
    <main>
      <Band tone="dark" top="footer" bottom="open" className="pt-[132px] lg:pt-[164px]">
        <Container>
          <p className="text-label uppercase ink-dim">Mission archive</p>
          {code ? (
            <h1 className="mt-6 max-w-[18ch] text-display ink">
              No reference file{' '}
              <span data-telemetry className="font-mono tracking-[0.04em]">
                {code}
              </span>
              .
            </h1>
          ) : (
            <h1 className="mt-6 max-w-[18ch] text-display ink">That code is not recognised.</h1>
          )}
          <p className="mt-7 max-w-[54ch] text-body ink-dim">
            {code ? (
              <>
                The reference archive holds example missions only. If this is your own mission
                code, its live file is at{' '}
                <span data-telemetry className="font-mono lowercase tracking-[0.04em] ink">
                  {missionShortLink(code).toLowerCase()}
                </span>{' '}
                — Mission Control will show the current stage.
              </>
            ) : (
              'A mission code is two digits followed by two letters, like 32BF. Nothing in the reference archive is filed under the address you requested.'
            )}
          </p>
        </Container>
      </Band>

      <Band tone="light" top="open" bottom="open">
        <Container>
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-[var(--gutter-shell)]">
            <div className="lg:col-span-7">
              {code ? (
                <>
                  <p className="text-label uppercase ink-dim">Where to go</p>
                  <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                    <Button href={`/m/${code}`} variant="primary" size="lg">
                      Open Mission Control
                    </Button>
                    <Button href="/missions" variant="secondary" size="lg">
                      Return to the archive
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-label uppercase ink-dim">Try again</p>
                  <MissionLookup className="mt-8" />
                </>
              )}
            </div>

            <div className="flex flex-col items-start gap-7 border-t pt-9 rule-ground lg:col-span-4 lg:col-start-9 lg:border-t-0 lg:pt-0">
              <p className="max-w-[40ch] text-body ink-dim">
                The archive is indexed by capture date and region. Every file in it opens with
                the same plate, the same specification and the same source credit.
              </p>
              <Button href="/missions" variant="secondary" size="md">
                Browse the archive
              </Button>
            </div>
          </div>
        </Container>
      </Band>
    </main>
  );
}
