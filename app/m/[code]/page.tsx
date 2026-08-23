import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MissionComms } from '@/components/comms';
import { MissionFile } from '@/components/mission';
import { FleetTracker } from '@/components/satellites';
import { fetchFleetElements } from '@/lib/integrations/celestrak';
import { getSessionUser } from '@/lib/auth';
import { normalizeMissionCode } from '@/lib/codes';
import { PUBLIC_MOCK_MODE, SITE_URL } from '@/lib/env';
import { getMissionByCode, getShareToken } from '@/lib/missions';
import type { MissionDTO } from '@/lib/types';

/**
 * MISSION CONTROL — /m/[code]
 *
 * The flight report for one mission, composed by <MissionFile />: masthead,
 * timeline, instrumentation, specification, exhibit, honours, comms, actions,
 * alternating dark and light band by band.
 *
 * This route is only the shell. It does three things and nothing else:
 *
 *   1. resolves the mission by code, asking for private fields only when
 *      somebody is signed in at all;
 *   2. RE-STRIPS them unless that session belongs to the address the mission
 *      was filed to — a session is not an entitlement, and the second check
 *      is what makes the first one safe;
 *   3. reads the share key, for the owner only, so the file can offer a
 *      copyable read-only link without the key ever entering the DTO.
 *
 * `dynamic = 'force-dynamic'` because both of those depend on the request.
 * The file itself keeps current by polling /api/missions/[code] from the
 * client; that endpoint answers with the public projection, so a poll can
 * never widen what this route decided to release.
 *
 * THERE IS DELIBERATELY NO `loading.tsx` IN THIS SEGMENT.
 *
 * A `loading.tsx` makes the segment a streaming boundary: Next flushes the
 * shell — and with it a 200 — before this component runs, so the `notFound()`
 * below could no longer change the status and every mistyped code answered
 * 200 with the not-found page inside it. That is indexable, and it looks
 * healthy to an uptime check. `/missions/[code]`, which never had a loading
 * boundary, has always 404'd correctly; this route now matches it.
 *
 * The resolve is one indexed read and the page is dynamic anyway, so there is
 * nothing here worth a skeleton. If a future change makes this segment slow,
 * put the slow part behind its own `<Suspense>` INSIDE the component, after
 * the existence check — do not reintroduce `loading.tsx`.
 */

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code: raw } = await params;
  const code = normalizeMissionCode(raw);
  return {
    title: code ? `Mission / ${code}` : 'Mission file',
    description: 'Live mission file: tasking, capture window, production and delivery.',
    robots: { index: false, follow: false },
  };
}

export default async function MissionControlPage({ params }: Params) {
  const { code: raw } = await params;
  const code = normalizeMissionCode(raw);
  if (!code) notFound();

  const user = await getSessionUser().catch(() => null);
  const record = await getMissionByCode(code, { includePrivate: Boolean(user) });
  if (!record) notFound();

  // A session alone does not open the file: private fields are released only
  // when the session belongs to the address the mission was filed to.
  const isOwner = Boolean(
    user && record.private && record.private.email.toLowerCase() === user.email.toLowerCase(),
  );
  // `record` was built with `includePrivate` for ANY signed-in session, so a
  // signed-in visitor who is not the owner has to be brought back down to the
  // public shape here. That means every owner-gated field, not just the
  // `private` block: the carrier tracking number is a bearer token for the
  // delivery address (see `toMissionDTO`) and must come off with it.
  const mission: MissionDTO = isOwner
    ? record
    : { ...record, private: undefined, trackingNumber: null, trackingUrl: null };

  // The share key never travels in the DTO — it is read for the owner only,
  // and only to build the copyable read-only link.
  const shareToken = isOwner ? await getShareToken(mission.code) : null;

  // The sky over this target. One CelesTrak request, cached three hours and
  // shared across every mission file; the positions move once a second in the
  // browser because propagation is local, not because this is re-fetched.
  const fleet = await fetchFleetElements();
  const serverNow = new Date().toISOString();

  return (
    <MissionFile
      mission={mission}
      variant="owner"
      isOwner={isOwner}
      mockMode={PUBLIC_MOCK_MODE}
      pollUrl={`/api/missions/${mission.code}`}
      siteOrigin={SITE_URL}
      serverNow={serverNow}
      shareToken={shareToken}
      satellites={
        <FleetTracker
          elements={fleet.elements}
          source={fleet.source}
          serverNow={serverNow}
          observer={{ latitude: mission.lat, longitude: mission.lon }}
          observerLabel="the target"
        />
      }
      comms={<MissionComms missionCode={mission.code} stage={mission.stage} />}
    />
  );
}
