import Image from 'next/image';
import { Band, Container, Grid12, OrbitDiagram } from '@/components/fui';
import { MEASURE } from './geometry';
import { EXAMPLE } from './example-mission';

/**
 * 07 · THE RECORD — light.
 *
 * The same mission, on the paper. Band 06 is the frame on the void; this is
 * the file underneath it, set the way the deliverable sets it — purpose in
 * monospace, the instrument, the sequence of events against range zero, and
 * the target with its planned and actual centres. Read together the two
 * bands are the poster's own construction at page scale: the photograph on
 * the dark ground, the record on the light one.
 *
 * There are no names on this file. See `example-mission.ts`.
 *
 * ------------------------------------------------------------------
 * WHAT CHANGES AT EACH BREAKPOINT
 * ------------------------------------------------------------------
 *   < 1280  one column, purpose first
 *   1280    5 / 7 — purpose, instrument and orbit on the left, the two
 *           event tables on the right
 *   1920    4 / 7 — the left column narrows so the monospace purpose stays
 *           near its 48-character measure, and the chrome mark is allowed
 *           into the margin the wider column opens up
 */
export function RecordBand() {
  return (
    <Band tone="light" top="snug" bottom="snug" className="overflow-hidden">
      {/* The chrome mark, printed into the panel the way the poster prints it. */}
      <Image
        src="/brand/mark-3d.png"
        alt=""
        aria-hidden
        width={900}
        height={702}
        className="pointer-events-none absolute -right-24 top-1/2 hidden w-[520px] -translate-y-1/2 opacity-[0.12] mix-blend-multiply min-[1280px]:block min-[1920px]:-right-16 min-[1920px]:w-[620px]"
      />

      <Container className={`relative ${MEASURE}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b rule-ground pb-4">
          <span data-telemetry className="font-mono text-tele uppercase ink">
            Mission / {EXAMPLE.code}
          </span>
          <span className="font-mono text-tele-s uppercase ink-dim">{EXAMPLE.url}</span>
        </div>

        <Grid12 className="mt-12 gap-y-12">
          {/* --- Purpose, instrument, orbit --- */}
          <div className="col-span-12 min-[1280px]:col-span-5 min-[1920px]:col-span-4">
            {/* §A2. This is five sentences of mission narrative. It was
                set in `.tele` — 11px monospace, uppercased, tracked out
                +0.14em, on a 48ch measure — which is the label
                treatment applied to a paragraph: every word becomes a
                rectangle, word-shape recognition is gone, and the
                longest piece of prose in the band became the hardest
                thing on the page to read. It is language, so it takes
                the body face and negative tracking. */}
            <p className="max-w-[48ch] text-body ink-dim">{EXAMPLE.purpose}</p>

            <h3 className="mt-8 font-mono text-tele-s uppercase ink-faint">Instrument</h3>
            <dl className="mt-3 max-w-[40ch]">
              {EXAMPLE.instrument.map((row) => (
                <div
                  key={row.label}
                  className="row-hover flex items-baseline justify-between gap-6 py-2"
                >
                  <dt className="font-mono text-tele-s uppercase ink-faint">{row.label}</dt>
                  <dd data-telemetry className="font-mono text-tele-s uppercase ink">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            {/*
              The diagram sets its own readout in paper ink, which is a
              dark-ground colour. On this half of the page it has to follow
              the band, so the label is re-inked here rather than in the
              primitive — one caller, one override.
            */}
            <div className="mt-8 [&_span]:text-[color:var(--ink-dim)]">
              <OrbitDiagram track={EXAMPLE.orbitTrack} size={128} animated />
            </div>
          </div>

          {/* --- Sequence of events, target --- */}
          <div className="col-span-12 min-[1280px]:col-span-7 min-[1280px]:col-start-6">
            <h3 className="font-mono text-tele-s uppercase ink-faint">Sequence of events</h3>
            <dl className="mt-3">
              {EXAMPLE.sequence.map((e) => (
                <div
                  key={e.label}
                  className="row-hover flex items-baseline justify-between gap-6 border-b rule-ground py-2.5"
                >
                  <dt className="font-mono text-tele-s uppercase ink-dim">{e.label}</dt>
                  <dd data-telemetry className="font-mono text-tele-s uppercase ink">
                    {e.elapsed}
                  </dd>
                </div>
              ))}
            </dl>

            <h3 className="mt-8 font-mono text-tele-s uppercase ink-faint">Target</h3>
            <dl className="mt-3">
              {EXAMPLE.target.map((t) => (
                <div
                  key={t.label}
                  className="row-hover flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b rule-ground py-2.5"
                >
                  <dt className="font-mono text-tele-s uppercase ink-dim">{t.label}</dt>
                  <dd data-telemetry className="font-mono text-tele-s uppercase ink">
                    {t.value}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-5 font-mono text-tele-s uppercase ink">
              Anomalies: {EXAMPLE.anomalies}
            </p>
            {/* A footnote is a sentence — `note`, not `tele-s`. */}
            <p className="mt-5 max-w-[52ch] text-note ink-faint">{EXAMPLE.footnote}</p>
          </div>
        </Grid12>
      </Container>
    </Band>
  );
}
