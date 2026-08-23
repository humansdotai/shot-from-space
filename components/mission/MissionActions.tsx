'use client';

import { clsx as cn } from 'clsx';
import { Button, Grid12 } from '@/components/fui';
import { missionSharePath } from '@/lib/codes';
import type { MissionDTO } from '@/lib/types';
import { AdvanceControl } from './AdvanceControl';
import { CopyControl } from './CopyControl';
import { shareTokenOf } from './telemetry';
import { INK_DIM, INK_FAINT, RULE } from './ui';

/**
 * FILE ACTIONS — what the owner can do with the file, on the grid.
 *
 * Share is a copy, not a dialog. Receipt and reorder leave the file. The demo
 * advance control is fenced off in its own column and out of the product
 * palette entirely: it is simulation scaffolding, not a customer control.
 */
export function MissionActions({
  mission,
  origin,
  isOwner,
  mockMode,
  shareToken,
  className,
}: {
  mission: MissionDTO;
  /** Absolute origin used to build copyable links. */
  origin: string;
  isOwner: boolean;
  mockMode: boolean;
  /** Read from lib/missions on the server; owner views only. */
  shareToken?: string | null;
  className?: string;
}) {
  const token = shareToken ?? shareTokenOf(mission);
  const sharePath = token ? missionSharePath(mission.code, token) : null;
  const shareUrl = sharePath ? `${origin}${sharePath}` : null;

  return (
    <Grid12 className={cn('gap-y-12', className)}>
      <div className="col-span-12 flex flex-col gap-8 md:col-span-9 xl:col-span-7">
        <div className="flex flex-wrap items-center gap-3">
          {shareUrl ? (
            <CopyControl
              value={shareUrl}
              label="Share file"
              copiedLabel="Share link copied"
              ariaLabel="Copy the read-only link to this mission file"
              variant="primary"
            />
          ) : null}
          {isOwner ? (
            <Button variant="secondary" href={`/account/missions/${mission.code}`}>
              View receipt
            </Button>
          ) : null}
          <Button variant="ghost" href="/start">
            Reorder
          </Button>
        </div>

        {shareUrl ? (
          <div className={cn('flex flex-col gap-3 border-t pt-6', RULE)}>
            <span className={cn('text-label uppercase', INK_DIM)}>Read-only link</span>
            <p data-telemetry className={cn('font-mono text-tele break-all', INK_DIM)}>
              {shareUrl}
            </p>
            <p className={cn('mt-1 max-w-[var(--measure)] text-body', INK_FAINT)}>
              Anyone holding this link sees the timeline and the exhibit. The address, the
              receipt and mission comms stay in this file.
            </p>
          </div>
        ) : (
          <div className={cn('flex flex-col gap-5 border-t pt-6', RULE)}>
            <span className={cn('text-label uppercase', INK_DIM)}>Restricted fields withheld</span>
            <p className={cn('max-w-[var(--measure)] text-body', INK_DIM)}>
              The address, the receipt and the share key are released to the account this
              mission was filed to. Sign in with that address to open the full file.
            </p>
            <Button
              variant="secondary"
              href={`/auth/sign-in?next=${encodeURIComponent(`/m/${mission.code}`)}`}
              className="self-start"
            >
              Sign in to open the file
            </Button>
          </div>
        )}
      </div>

      {mockMode ? (
        <div className="col-span-12 md:col-span-8 xl:col-span-4 xl:col-start-9">
          <AdvanceControl code={mission.code} stage={mission.stage} />
        </div>
      ) : null}
    </Grid12>
  );
}
