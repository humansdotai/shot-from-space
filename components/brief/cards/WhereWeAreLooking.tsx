import { IconArea, IconCrosshair, IconPin } from '@/components/fui/icons';
import { formatCoordsHemisphere } from '@/lib/utils';
import type { BriefCardProps } from './types';
import { Body, Lead, Note, Row, Rows } from './ui';

/**
 * CARD 01 · WHERE WE ARE LOOKING
 *
 * The place, the fix, and how much ground the frame covers.
 *
 * EVERY VALUE:
 *   place       `mission.locationLabel` — the row, city-level by contract
 *   coordinates `mission.lat` / `mission.lon` through `formatCoordsHemisphere`
 *   footprint   `mission.private.areaKm` — the square the customer chose
 *
 * PRECISION IS AN OWNERSHIP DECISION, NOT A FORMATTING ONE. Four decimal
 * places is about eleven metres, which is not "near the address", it IS the
 * address — `lib/missions/dto.ts` says so at PUBLIC_COORD_DP and already
 * rounds the public projection to two before it reaches this card. The card
 * prints the precision the record released to it: 4 dp for the owner, 2 dp
 * for a share link, which is the same order as the footprint itself.
 *
 * THE FOOTPRINT IS OWNER-ONLY for the same reason — it lives on the private
 * block. On a shared link the row is not blank and it is not omitted: it says
 * the value is held with the owner, because a missing number and a withheld
 * number are two different facts and a reader is entitled to know which one
 * they are looking at.
 */
export function WhereWeAreLooking({ mission, variant = 'owner', className }: BriefCardProps) {
  const priv = variant === 'owner' ? mission.private : undefined;
  // Owner reads the exact fix; everyone else reads the city-level one the
  // DTO already rounded. Never widened here, and never re-rounded.
  const dp = priv ? 4 : 2;

  return (
    <Body className={className}>
      <Lead
        icon={<IconPin size={18} />}
        label="Target"
        value={mission.locationLabel}
      />

      <Rows className="mt-8">
        <Row
          icon={<IconCrosshair />}
          label="Coordinates"
          mono
          value={formatCoordsHemisphere(mission.lat, mission.lon, dp)}
        />
        <Row
          icon={<IconArea />}
          label="Capture area"
          mono={Boolean(priv)}
          tone={priv ? undefined : 'dim'}
          value={priv ? `${priv.areaKm} × ${priv.areaKm} km` : 'Held with the owner'}
        />
      </Rows>

      <Note className="mt-7">
        {priv
          ? 'The frame is centred on this fix and squared to it. The file states a city on any link you share — the street address stays here.'
          : 'The fix is stated to about a kilometre, which is the city, not the doorstep. The address and the footprint stay with the owner of the file.'}
      </Note>
    </Body>
  );
}
