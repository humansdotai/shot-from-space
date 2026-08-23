import Image from 'next/image';
import { Band, Button, Container } from '@/components/fui';
import { GuaranteeStrip } from './Guarantees';
import { MEASURE } from './geometry';
import { frameBySlug } from '@/lib/imagery';
import { EXAMPLE } from './example-mission';

/**
 * 13 · CLOSING — dark, full bleed, one action.
 *
 * The page ends the way it opened: a frame, a line, and the only thing
 * worth asking for. One button, no second choice, no newsletter. The lockup
 * and the mission URL sit on the bottom rail the way they sit on the
 * printed poster.
 *
 * ------------------------------------------------------------------
 * WHAT CHANGES AT EACH BREAKPOINT
 * ------------------------------------------------------------------
 * The height, and only the height: 480 → 600 → 680 → 760 → 840. The copy
 * block keeps its measure at every width, so a wider screen gives the
 * photograph more room rather than stretching the sentence across it.
 */
export function ClosingBand() {
  const frame = frameBySlug('lena-delta-ru');

  return (
    <Band tone="dark" top="flush" bottom="flush" className="relative isolate overflow-hidden">
      {frame ? (
        <Image
          src={frame.src}
          alt=""
          aria-hidden
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
      ) : null}
      <div aria-hidden className="absolute inset-0 bg-void/78" />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-void to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-void to-transparent"
      />

      <Container
        className={`relative flex min-h-[480px] flex-col justify-end py-12 min-[768px]:min-h-[600px] min-[1280px]:min-h-[680px] min-[1920px]:min-h-[760px] min-[2400px]:min-h-[840px] ${MEASURE}`}
      >
        <h2 className="max-w-[13ch] text-hero ink">Give it an address.</h2>
        <p className="mt-5 max-w-[46ch] text-body ink-dim">
          The next clear pass over your roof is one to three days out. Everything from the
          tasking order to the ground receipt is logged in your name, and the frame it returns
          is posted to you.
        </p>

        <div className="mt-8">
          <Button variant="primary" size="lg" href="/mission">
            Start a mission
          </Button>
        </div>

        {/*
          The five terms again, one line each, AT the last button (SPEC-V4
          §B4). A reader who scrolled past the price block and arrived here
          should not have to go back up to find out what happens if the sky
          is in the way. Same five facts, same source, no detail paragraphs
          — this is the fine print refusing to be fine.
        */}
        <GuaranteeStrip className="mt-8" />

        <div className="mt-12 flex flex-wrap items-end justify-between gap-6 border-t rule-ground pt-5">
          <Image
            src="/brand/logo-wordmark.svg"
            alt="Shot from Space"
            width={596}
            height={124}
            className="h-9 w-auto opacity-90 transition-house hover:opacity-100 min-[768px]:h-11 min-[1920px]:h-14"
          />
          <span data-telemetry className="font-mono text-tele-s uppercase ink-dim">
            {EXAMPLE.url}
          </span>
        </div>
      </Container>
    </Band>
  );
}
