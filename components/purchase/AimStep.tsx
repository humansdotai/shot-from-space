'use client';

import { Button } from '@/components/fui';
import type { TargetAddress } from '@/lib/types';
import { clsx as cn } from 'clsx';
import { formatCoords } from '@/lib/utils';
import { CaptureBlock } from './CaptureBlock';
import { INK, INK_DIM, RULE } from './fields';
import { SCREEN_FRAME } from './layout';
import { StepAction } from './StepAction';
import { StepHead } from './StepScreen';
import type { AreaKm } from './state';

/**
 * THE AIM — the screen the sequence is built around.
 *
 * The capture area resolves over the reader's own coordinates while the
 * coordinates settle onto their value, and the footprint is chosen against
 * that picture rather than from a list of sizes: every tap re-aims the
 * instrument and the square of ground visibly changes. It is the one screen
 * where the answer is on the screen before the question is closed, which is
 * why it closes on a control instead of on the selection — advancing the
 * moment a footprint is tapped would take away the thing being decided.
 */
export function AimStep({
  address,
  areaKm,
  onAreaChange,
  onConfirm,
}: {
  address: TargetAddress;
  areaKm: AreaKm;
  onAreaChange: (v: AreaKm) => void;
  onConfirm: () => void;
}) {
  const street = [address.line1, address.line2].filter(Boolean).join(', ');
  const place = [address.city, address.region, address.postalCode, address.country]
    .filter(Boolean)
    .join(' / ');

  return (
    <div>
      <StepHead title="How much ground?" aside={`${areaKm} × ${areaKm} km`}>
        This is the square the satellite is pointed at. Widen it and the block becomes a
        district; tighten it and the cars on your street resolve.
      </StepHead>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,38rem)_minmax(0,1fr)] xl:gap-14 xl2:gap-20">
        <div className={SCREEN_FRAME}>
          <CaptureBlock address={address} areaKm={areaKm} onAreaChange={onAreaChange} />
        </div>

        <div className={cn('max-w-[30rem] border-t pt-8 xl:border-t-0 xl:pt-1', RULE)}>
          <p className={cn('text-label uppercase', INK_DIM)}>Target</p>
          <p className={cn('mt-4 text-heading break-words', INK)}>{street.toUpperCase()}</p>
          <p className={cn('mt-2 text-label uppercase break-words', INK_DIM)}>
            {place.toUpperCase()}
          </p>
          <p
            data-telemetry
            className={cn('mt-3 font-mono text-tele uppercase tabular-nums', INK_DIM)}
          >
            {formatCoords(address.lat, address.lon)}
          </p>
        </div>
      </div>

      <StepAction note="Nothing is charged yet.">
        <Button
          id="aim-confirm"
          size="lg"
          variant="primary"
          onClick={onConfirm}
          trailing={<span>&#8594;</span>}
        >
          Lock the frame
        </Button>
      </StepAction>
    </div>
  );
}
