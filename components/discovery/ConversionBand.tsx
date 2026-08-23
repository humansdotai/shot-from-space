import { Band, Button, Container } from '@/components/fui';
import { guaranteeTerm } from '@/lib/guarantees';
import { PRICE_FROM } from '@/lib/mission-flow/config';
import { MissionArtifact } from './MissionArtifact';

/**
 * The one sales line in the archive — the closing band of a dossier.
 *
 * On paper, because it is an argument rather than a picture: the frame above
 * it was already taken, the next one is tasked for the reader. One action,
 * no adjectives, no promise beyond the product. The honour beside it is held
 * on the mission file and is digital — this comment used to say it was "a
 * real object that ships with the print", which the block's own caption
 * already contradicts. The print is the only object that ships.
 *
 * ------------------------------------------------------------------
 * THE NUMBER UNDER THE BUTTON
 * ------------------------------------------------------------------
 * A control with no price beside it is the surprise CONFIGURATOR.md §3.2
 * exists to remove, and this band was the only sales line on a dossier page
 * that quoted no price anywhere. It quotes one now, from `PRICE_FROM` — the
 * entry price of `/mission`, which is where this button goes, checked in
 * `lib/mission-flow/config.ts` against every configuration that flow can
 * actually charge. The button and the number therefore belong to the same
 * funnel, which is the whole of §3.2.
 *
 * The two promises under it are the `short` strings in lib/guarantees.ts,
 * used verbatim. The paragraph above used to end "shipping and duties
 * included", which is a guarantee re-typed as prose; that clause is gone and
 * the promise is now made in the one place it is allowed to be made from.
 */
export function ConversionBand() {
  return (
    <Band top="open" bottom="open" tone="light">
      <Container>
        <div className="grid grid-cols-1 items-end gap-12 min-[1280px]:grid-cols-12 min-[1280px]:gap-x-[var(--gutter-shell)] min-[1920px]:gap-x-20">
          <div className="min-[1280px]:col-span-6 min-[1920px]:col-span-5">
            <p className="text-label uppercase ink-dim">End of file</p>
            <h2 className="mt-6 max-w-[20ch] text-display ink">
              This frame was already taken. The next one is tasked for you.
            </h2>
            <p className="mt-6 max-w-[50ch] text-body ink-dim">
              Give an address and a satellite is scheduled over it. The frame comes back
              composed with its own mission sheet, printed on the continent you live on and
              shipped as a finished object.
            </p>
            <Button href="/mission" variant="primary" size="lg" className="mt-9">
              Start a mission
            </Button>
            <p className="mt-5 max-w-[52ch] text-note ink-dim">
              Missions from €{PRICE_FROM} · {guaranteeTerm('shipping').short} ·{' '}
              {guaranteeTerm('refund').short}
            </p>
          </div>

          <MissionArtifact
            className="min-[1280px]:col-span-4 min-[1280px]:col-start-9 min-[1920px]:col-span-4 min-[1920px]:col-start-9"
            src="/brand/mission-badge.webp"
            alt="A render of a brushed aluminium mission badge, the mark raised at its centre."
            label="Conferred on every mission"
            detail="An honorary badge, held on the mission file alongside the plate, the patch, the coin and the pin — five in all. Digital: the print is the only object that ships."
            sizes="(min-width: 1280px) 22vw, 55vw"
          />
        </div>
      </Container>
    </Band>
  );
}
