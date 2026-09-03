import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MissionComms } from '@/components/comms';
import { MissionFile } from '@/components/mission';
import { FleetTracker } from '@/components/satellites';
import { fetchFleetElements } from '@/lib/integrations/celestrak';
import { getSessionUser } from '@/lib/auth';
import { missionShortLink, normalizeMissionCode } from '@/lib/codes';
import { PaymentNotice } from '@/components/mission/PaymentNotice';
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

type Params = {
  params: Promise<{ code: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code: raw } = await params;
  const code = normalizeMissionCode(raw);
  return {
    title: code ? `Mission / ${code}` : 'Mission file',
    description: 'Live mission file: tasking, capture window, production and delivery.',
    robots: { index: false, follow: false },
  };
}

export default async function MissionControlPage({ params, searchParams }: Params) {
  const { code: raw } = await params;
  const code = normalizeMissionCode(raw);
  if (!code) notFound();

  // THE KEY. `shot.space/M{code}?k=…` carries the mission's share token; a
  // four-character code is guessable, the 24-character key is not. A
  // matching key opens the owner view exactly like a signed-in owner does —
  // it is how a buyer retries payment or follows progress without an
  // account. Compared server-side against the stored token; never echoed.
  const sp = (await searchParams) ?? {};
  const keyParam = typeof sp.k === 'string' ? sp.k : Array.isArray(sp.k) ? sp.k[0] : null;
  const storedKey = keyParam ? await getShareToken(code) : null;
  const keyOwner = Boolean(keyParam && storedKey && keyParam === storedKey);

  const user = await getSessionUser().catch(() => null);
  const record = await getMissionByCode(code, { includePrivate: Boolean(user) || keyOwner });
  if (!record) notFound();

  // A session alone does not open the file: private fields are released only
  // when the session belongs to the address the mission was filed to — or
  // when the request carried the mission's own key.
  const isOwner =
    keyOwner ||
    Boolean(
      user && record.private && record.private.email.toLowerCase() === user.email.toLowerCase(),
    );
  // `record` was built with `includePrivate` for ANY signed-in session, so a
  // signed-in visitor who is not the owner has to be brought back down to the
  // public shape here. That means every owner-gated field, not just the
  // `private` block: the carrier tracking number is a bearer token for the
  // delivery address (see `toMissionDTO`) and must come off with it.
  // The share key never travels in the DTO — it is read for the owner only,
  // and only to build the copyable links.
  const shareToken = isOwner ? (storedKey ?? (await getShareToken(code))) : null;

  const mission: MissionDTO = isOwner
    ? { ...record, shortLink: missionShortLink(record.code, shareToken) }
    : { ...record, private: undefined, trackingNumber: null, trackingUrl: null };

  const unpaid = Boolean(isOwner && mission.private && !mission.private.paidAt && mission.state !== 'CANCELLED');

  // The sky over this target. One CelesTrak request, cached three hours and
  // shared across every mission file; the positions move once a second in the
  // browser because propagation is local, not because this is re-fetched.
  const fleet = await fetchFleetElements();
  const serverNow = new Date().toISOString();

  return (
    <>
      {unpaid && mission.private ? (
        <PaymentNotice
          code={mission.code}
          amountMinor={mission.private.amountMinor}
          currency={mission.private.currency}
          shareToken={shareToken}
          shortLink={mission.shortLink}
        />
      ) : null}
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
    </>
  );
}
