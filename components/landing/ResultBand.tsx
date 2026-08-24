import { Band, Container, MediaCard } from '@/components/fui';
import { BandHead } from './BandHead';
import { MEASURE } from './geometry';
import { EXAMPLE } from './example-mission';
import { titleCase } from '@/lib/gallery';

/**
 * 06 · THE RESULT — dark. Media-link section (SYSTEM-V3 §5.4).
 *
 * One large media panel that is itself the link, with the heading over it.
 * There is no button under this picture and no small "view" target inside
 * it: the panel is the control, full width, and the whole of it is
 * clickable and focusable as one thing.
 *
 * ------------------------------------------------------------------
 * IT IS NOT THE HERO'S FRAME, AND THE HEADING NO LONGER SAYS IT IS
 * ------------------------------------------------------------------
 * It used to be. This band opened "The frame at the top of this page is a
 * finished mission", because both this panel and the hero mounted
 * `hero-los-angeles` — mission 32BF. The hero has since moved to
 * `lisse-nl` / mission 84VN, for reasons written out at `GROUND_SLUG` in
 * HeroBand.tsx: the LA frame is Landsat draped over SRTM elevation, which
 * is a visualisation rather than a capture, and this page's hero now
 * carries a printable sheet.
 *
 * So the old heading had become a plain false statement — it asserted that
 * two different missions over two different continents were one mission —
 * and it is gone. What this band is FOR survives it: one worked order,
 * opened, with the code on the panel and the link into the file. Band 10
 * directly below prints the same mission's record, and that pairing is now
 * what the copy points at, because it is the pairing that is actually true.
 *
 * If the hero is ever re-pointed at 32BF, the identity claim can come back
 * — and until then it must not.
 *
 * It is labelled an example everywhere it appears. No mission has shipped,
 * so there is no customer to quote and no order to count — the honest
 * substitute for a testimonial is the full file, published before anyone
 * has paid for it.
 *
 * ------------------------------------------------------------------
 * WHAT CHANGES AT EACH BREAKPOINT
 * ------------------------------------------------------------------
 * The panel's aspect, and only the aspect: 4:3 on a phone, 16:9 from 768,
 * 21:9 from 1280, 3:1 at 2400 — each step chosen so the panel stays under
 * about 850px tall and never becomes a wall.
 */
const SUMMARY = [
  { label: 'Frames collected', value: 'One' },
  { label: 'Exposed', value: EXAMPLE.captureStamp },
  { label: 'Frame centre', value: EXAMPLE.frameCentre },
  { label: 'Anomalies', value: EXAMPLE.anomalies },
];

export function ResultBand() {
  return (
    <Band id="example-mission" tone="dark" top="open" bottom="open">
      <Container className={MEASURE}>
        <BandHead
          label="The result"
          title="A finished mission, published to the last line."
          titleClassName="max-w-[22ch]"
          lede="Mission 32BF is a worked example, open before anyone has paid for one. Its frame
                is below and its whole record is the band under that. Nothing here is quoted and
                no one is named — there is only the file, exactly as it prints."
        />
      </Container>

      {/* The column stops here. The panel is the link. */}
      <div className="mt-12 aspect-[4/3] w-full min-[768px]:aspect-[16/9] min-[1280px]:aspect-[21/9] min-[2400px]:aspect-[3/1]">
        <MediaCard
          href={EXAMPLE.href}
          src={EXAMPLE.frameSrc}
          alt={`The frame acquired by mission 32BF over ${titleCase(EXAMPLE.city)}, ${titleCase(EXAMPLE.admin)}`}
          title={`Mission ${EXAMPLE.code}`}
          subtitle="Example mission — open the file"
          aspect="auto"
          sizes="100vw"
          className="h-full rounded-none"
        />
      </div>

      <Container className={`mt-12 ${MEASURE}`}>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-t rule-ground pt-5 min-[768px]:grid-cols-4">
          {SUMMARY.map((row) => (
            <div key={row.label} className="flex flex-col gap-2">
              <dt className="font-mono text-tele-xs uppercase ink-faint">{row.label}</dt>
              <dd data-telemetry className="font-mono text-tele uppercase ink">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </Band>
  );
}
