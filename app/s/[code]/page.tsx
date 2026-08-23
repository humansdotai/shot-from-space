import type { Metadata } from 'next';
import { ActionButton, Grid12 } from '@/components/fui';
import { MissionFile, MissionNotice } from '@/components/mission';
import { FleetTracker } from '@/components/satellites';
import { fetchFleetElements } from '@/lib/integrations/celestrak';
import { normalizeMissionCode } from '@/lib/codes';
import { SITE_URL } from '@/lib/env';
import { getMissionByShareToken } from '@/lib/missions';

/**
 * SHARED MISSION FILE — /s/[code]?k=token
 *
 * The document someone was handed. Same language as mission control, reduced:
 * the timeline, the exhibit and the public record. No address, no receipt, no
 * comms, no controls — one way in for the reader who wants their own.
 */

export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ k?: string | string[] }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code: raw } = await params;
  const code = normalizeMissionCode(raw);
  return {
    title: code ? `Mission / ${code} — shared file` : 'Shared mission file',
    description: 'A shared mission file: tasking, capture and delivery of one frame from orbit.',
    robots: { index: false, follow: false },
  };
}

export default async function SharedMissionPage({ params, searchParams }: Params) {
  const { code: raw } = await params;
  const { k } = await searchParams;
  const code = normalizeMissionCode(raw);
  const token = Array.isArray(k) ? k[0] : k;

  if (!code) return <NotAccessible reference={raw?.toUpperCase()} />;
  if (!token) return <NotAccessible reference={code} missingKey />;

  const mission = await getMissionByShareToken(code, token).catch(() => null);
  if (!mission) return <NotAccessible reference={code} />;

  // The sky over this target. One CelesTrak request, cached three hours and
  // shared across every mission file; the positions move once a second in the
  // browser because propagation is local, not because this is re-fetched.
  const fleet = await fetchFleetElements();
  const serverNow = new Date().toISOString();

  return (
    <MissionFile
      mission={mission}
      variant="shared"
      pollUrl={`/api/missions/${mission.code}/share?k=${encodeURIComponent(token)}`}
      siteOrigin={SITE_URL}
      serverNow={serverNow}
      satellites={
        <FleetTracker
          elements={fleet.elements}
          source={fleet.source}
          serverNow={serverNow}
          observer={{ latitude: mission.lat, longitude: mission.lon }}
          observerLabel="the target"
        />
      }
      cta={<ShareCta />}
    />
  );
}

/** The single action on the shared view. Same language, one way in. */
function ShareCta() {
  return (
    <Grid12>
      <div className="col-span-12 md:col-span-9 xl:col-span-7">
        <p className="text-label uppercase text-paper-dim">Same pipeline / any address</p>
        <h2 className="mt-5 max-w-[22ch] text-heading text-paper">
          A file like this one opens for every address.
        </h2>
        <p className="mt-5 max-w-[var(--measure)] text-body text-paper-dim">
          Give an address. A satellite is tasked over it, the frame is composed with its own
          telemetry, printed in your region and shipped as a finished object. You follow the
          whole run from a file like this one.
        </p>
      </div>
      <div className="col-span-12 flex items-end md:col-span-8 xl:col-span-4 xl:col-start-9 xl:justify-end">
        <ActionButton variant="primary" size="lg" href="/start">
          Start your own mission
        </ActionButton>
      </div>
    </Grid12>
  );
}

/** Designed refusal — a share link with no key, a wrong key, an unknown code. */
function NotAccessible({ reference, missingKey = false }: { reference?: string; missingKey?: boolean }) {
  return (
    <MissionNotice
      stamp="File not accessible"
      title={missingKey ? 'Share key missing' : 'Share key not recognised'}
      tags={['SHARED FILE', 'ACCESS DENIED']}
      reference={reference}
      body={
        missingKey
          ? 'A shared mission file opens only with the key that was issued with it. Use the full link exactly as it was sent to you — the key is the part after ?k=.'
          : 'This key does not match the file. Share links are issued per file and can be reissued by the owner from mission control. Ask for a fresh link, or open a mission of your own.'
      }
    />
  );
}
