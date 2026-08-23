import Image from 'next/image';
import Link from 'next/link';

import { Band, Container, Grid12 } from '@/components/fui';
import { frameBySlug } from '@/lib/imagery';
import { formatCoords, cn } from '@/lib/utils';
import { MEASURE } from './geometry';
import { MissionEntry } from './MissionEntry';

/**
 * ==================================================================
 * 08 · ORBIT ENTRY — the second ask, on the frame it is asking for.
 * ==================================================================
 *
 * The hero is `section-middle.pdf` itself: a full-bleed aerial with the
 * printed sheet lying on it, large, on the right. THIS BAND THEREFORE DOES
 * NOT CARRY A POSTER. It used to show one — small, in the right half, in a
 * display mount, with a column of copy beside it — and that is exactly the
 * composition the owner rejected.
 *
 * What is left is the thing this band was actually for: a second ask, set on
 * the evidence rather than on the object. The evidence is one real frame from
 * the public Landsat archive, full bleed, with its own target, its own fix
 * and its own sensor stated along the foot.
 *
 * ------------------------------------------------------------------
 * IT IS NO LONGER ONE SCREEN UNDER THE HERO, AND THAT WAS THE POINT
 * ------------------------------------------------------------------
 * This band was 03. It is now 08 — after OVERHEAD and FLEET — and the reason
 * is written out in `app/page.tsx` under WHERE ORBIT ENTRY WENT. The short
 * version is that this band and the hero mount the SAME <MissionEntry />, so
 * a reader at 03 met one field, one button and the same three lines of fine
 * print twice inside a screen and a half. Measured on the page as shipped —
 * field top to field top — the two mounts are now 7,143px apart at 1440 and
 * 12,263px at 390, five bands of argument between them, against 899px and
 * 1,345px before. At 1440 that is one screen apart before and 8.7 screens
 * apart now; the repetition the audit flagged is gone.
 *
 * The band is SHALLOW on purpose. Removing the sheet took roughly 600px out
 * of it at a phone's width, and it now sits inside a run of dark bands rather
 * than opening one.
 *
 * ------------------------------------------------------------------
 * THE PHOTOGRAPH CHANGED, AND WHY IT HAD TO
 * ------------------------------------------------------------------
 * This band used to mount `/imagery/aerial-pitch-2400.webp`. That file has no
 * recorded source — IMAGERY.md § UNRESOLVED PROVENANCE — it is not in the
 * catalogue, it is not covered by the footer's NASA / USGS credit, and at
 * roughly 5 cm per pixel it resolves individual people and cars: an order of
 * magnitude finer than the 30–75 cm this product sells, sitting directly
 * under the words "Photographed from orbit". It is no longer referenced by
 * anything on this page.
 *
 * In its place: `samarkand-uz`, a near-natural-colour Landsat 8 frame of a
 * real city, public domain, with a source record and a stated acquisition
 * date. Its credit is printed on the band and linked to /legal/imagery, which
 * is the licence requirement rather than a courtesy.
 *
 * ------------------------------------------------------------------
 * WHAT THE SECTION'S OWN FIRST SCREEN HAS TO CARRY
 * ------------------------------------------------------------------
 * CONFIGURATOR.md §3.1: the field, the button and the price line are inside
 * the viewport the moment a reader arrives at this band, at every width, with
 * no further scrolling. That is why the offer comes before the foot rail and
 * why nothing tall sits above the headline. The whole band is now shorter
 * than one viewport at every width from 768 up, so the rule holds by
 * construction rather than by arithmetic.
 *
 * ------------------------------------------------------------------
 * LEGIBILITY
 * ------------------------------------------------------------------
 * Two washes, both from the shell's existing vocabulary: a vertical one that
 * closes the foot of the picture, and a left-edge one from 1280 where the
 * headline and the field sit over the brighter half of the frame. Below 1280
 * the copy is the whole column and carries its own flat plate instead —
 * see the note at that element, and the measurements that moved its
 * breakpoint from 768 to 1280. Nothing in the copy is `ink-faint` — over a
 * photograph the faint role cannot be brought to 4.5:1 without a wash heavy
 * enough to delete the picture, so the microlines under the field are
 * `ink-dim` and separate by size.
 */

/** A real, dated, public-domain frame — and never the unattributed aerial. */
const FRAME = frameBySlug('samarkand-uz');

export function OrbitEntryBand() {
  if (!FRAME) return null;

  return (
    <Band
      id="orbit-entry"
      tone="dark"
      top="open"
      bottom="open"
      className="isolate overflow-hidden"
    >
      {/* ---------- The photograph, edge to edge ------------------------- */}
      <div aria-hidden className="absolute inset-0">
        <Image
          src={FRAME.src}
          alt=""
          fill
          sizes="100vw"
          /* Not `priority` — the hero above owns LCP. */
          className="object-cover object-center"
        />
        {/* The foot of the picture is closed to solid void, because the file
            rail underneath is 10px type and its contrast has to be a fact.
            Above that the wash eases off fast, so the frame is a frame and
            not a texture: at 1280 the right half of it carries no wash at
            all. */}
        <div className="absolute inset-0 bg-linear-to-t from-void from-14% via-void/58 via-46% to-void/12" />
        <div className="absolute inset-y-0 left-0 w-[72%] bg-linear-to-r from-void/92 from-6% via-void/74 via-44% to-transparent min-[1280px]:w-[58%]" />
      </div>

      <Container className={cn('relative z-10', MEASURE)}>
        <Grid12>
          {/* --- The proposition and the field --------------------------
              Both in the left half from 1280, so the right half of the frame
              carries no copy and no wash and is simply the picture. A block
              in each half would have needed a wash across the whole band,
              and a photograph you cannot see is not evidence of anything. */}
          <div className="relative col-span-12 min-[1280px]:col-span-6 min-[1280px]:col-start-1">
            {/*
              THE COPY'S OWN GROUND, BELOW 1280.

              THE BREAKPOINT IS 1280 AND IT USED TO BE 768, because 768 was
              not where the layout changes — 1280 is. Below 1280 this block is
              `col-span-12`: the copy is the WHOLE column, the wash behind it
              is a horizontal gradient, and the right part of every line runs
              off the end of it. That was measured, not assumed. At 320 the
              headline sat at 1.93 : 1 over open Samarkand, which is why the
              plate was added; but at 768 and at 1024 the same fault survived
              in miniature, because the copy still spans the full column
              there and the gradient's plateau does not. Measured on the text
              line, `Cloud-blocked passes re-tasked free` read 4.48 : 1 at 768
              against a 4.5 floor and 4.87 : 1 at 1024. Both are now 15 : 1.

              From 1280 the block is `col-span-6` and the left-edge wash does
              carry it — 5.04 : 1 at 1280 rising to 5.55 : 1 at 1920 — so the
              plate stops exactly where the layout stops needing it.

              `void/86` is the same floor <HeroBand /> uses and for the same
              reason: over the brightest ground a sensor can return it still
              gives `ink-dim` 4.99 : 1, so it holds against ANY frame and not
              just this one. It is bled to both screen edges and clipped by
              the Band, starts 96px above the block so its top edge is cut off
              rather than seen (the band's own top padding runs 48 → 72px
              across this range, so 64px was not enough at 1024), fades out
              over the 96px below it, and sits at `-z-10` so it paints under
              every static child of this column and still over the photograph.
            */}
            <div aria-hidden className="pointer-events-none min-[1280px]:hidden">
              <div className="absolute -top-24 bottom-0 left-[calc(50%_-_50vw)] -z-10 w-screen bg-void/86" />
              <div className="absolute top-full left-[calc(50%_-_50vw)] -z-10 h-24 w-screen bg-linear-to-b from-void/86 to-transparent" />
            </div>

            <h2 className="max-w-[16ch] text-hero ink">Your home. Photographed from orbit.</h2>
            <MissionEntry className="mt-8" inputId="orbit-entry-address" />
          </div>

          {/* --- What the picture actually is ---------------------------
              Every value here is the frame's own record (lib/imagery.ts), at
              the precision that record supports. The credit is a licensing
              requirement, not a nicety. */}
          <div className="col-span-12 mt-12">
            <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t rule-ground pt-5 font-mono text-tele-s uppercase ink">
              <div className="flex items-baseline gap-2">
                <dt className="ink-dim">Target</dt>
                <dd>
                  {FRAME.city} / {FRAME.country}
                </dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="ink-dim">Fix</dt>
                <dd data-telemetry>{formatCoords(FRAME.lat, FRAME.lon)}</dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="ink-dim">Sensor</dt>
                <dd data-telemetry>
                  {FRAME.orbit.sensor} · {FRAME.orbit.gsdM} m / px
                </dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="ink-dim">Credit</dt>
                <dd>
                  <Link
                    href="/legal/imagery"
                    className="inline-flex min-h-11 items-center underline decoration-[color:var(--rule-strong)] underline-offset-4 transition-house hover:decoration-current"
                  >
                    NASA / USGS Landsat — public domain
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        </Grid12>
      </Container>
    </Band>
  );
}
