'use client';

import { Button } from '@/components/fui';
import { VideoPlate } from '@/components/hero';
import { clsx as cn } from 'clsx';
import { INK, INK_DIM } from './fields';
import { StepAction } from './StepAction';

/**
 * OPEN — the instrument, before the question.
 *
 * The first screen demonstrates rather than asks. There is no field on it and
 * nothing to fill in: a clip of the instrument on station, one line saying
 * what a mission is, and one control. The first thing the reader does here is
 * decide to begin, not decide what to type.
 *
 * The clip plays only while it is on screen and never carries sound; under
 * `prefers-reduced-motion` it is the poster frame and nothing moves. See
 * <VideoPlate />.
 *
 * The control is in the pinned bar rather than under the copy: at 320 it sat
 * 62px below the fold, because a hero, a standfirst and a 4:5 plate do not
 * leave room for a button on a 568px screen. See <StepAction />.
 */
export function OpenStep({ onBegin }: { onBegin: () => void }) {
  return (
    <div>
      <div className="grid items-center gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:gap-16 xl2:gap-20">
        <div className="max-w-[40rem]">
          <p className={cn('text-label uppercase', INK_DIM)}>Mission intake</p>

          <h1 className={cn('mt-6 max-w-[16ch] text-hero', INK)}>
            A satellite pass over an address you choose.
          </h1>

          <p className={cn('mt-6 max-w-[var(--measure-tight)] text-body', INK_DIM)}>
            You name the place. It is photographed from orbit, and the frame comes back to
            you as a print.
          </p>
        </div>

        <VideoPlate
          src="/video/intro.mp4"
          poster="/video/intro-poster.jpg"
          alt="The Shot from Space mark resolving out of darkness and opening onto an imaging satellite above the Earth"
          label="Sighting"
          aspect="4 / 5"
          className="w-full max-w-[26rem] xl:justify-self-end"
        />
      </div>

      <StepAction note="Nothing is charged yet.">
        <Button size="lg" variant="primary" onClick={onBegin} trailing={<span>&#8594;</span>}>
          Begin
        </Button>
      </StepAction>
    </div>
  );
}
