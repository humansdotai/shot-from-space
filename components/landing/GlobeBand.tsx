import { Band, Container } from '@/components/fui';
import { LiveGlobe } from '@/components/globe';
import { fetchFleetElements } from '@/lib/integrations/celestrak';
import { BandHead } from './BandHead';
import { MEASURE } from './geometry';

/**
 * OVERHEAD — dark. A wireframe Earth with the tracked fleet on it, live.
 *
 * ------------------------------------------------------------------
 * WHY THIS BAND EXISTS
 * ------------------------------------------------------------------
 * The page asks a visitor to believe that a real spacecraft can be moved for
 * them. Everything above this point argues it in words and photographs. This
 * argues it with a live instrument: eight real objects, in their real places,
 * at their real altitudes, propagated in the reader's own browser from
 * elements CelesTrak published a few hours ago. It is the one section on the
 * site that cannot be faked by a designer, and that is the point of it.
 *
 * It is also what WAVE.md §1 says to build instead of the reference site's
 * spacecraft renders. Those are Albedo Space Corp's hardware. This is ours in
 * the only sense that matters: our code, public data, and nobody else's
 * pictures.
 *
 * ------------------------------------------------------------------
 * THE CLAIM, AND ITS LIMIT
 * ------------------------------------------------------------------
 * "These are Earth-observation satellites in orbit and this is where they
 * are." Nothing more. Tasking is brokered through SkyFi at capture time and
 * the spacecraft that flies a mission is very often none of these eight, so
 * the lede says so in the same breath as the invitation. A band that showed
 * a fleet and a button without that sentence would be implying a link that
 * does not exist.
 *
 * ------------------------------------------------------------------
 * DATA
 * ------------------------------------------------------------------
 * ONE CelesTrak request for the whole fleet, held three hours by the Next
 * data cache and shared by every visitor (`lib/integrations/celestrak.ts`).
 * A failed or slow request falls back to the bundled snapshot, and the
 * readout says which one it drew and how old the elements are either way.
 * Propagation is local and costs the network nothing.
 *
 * ------------------------------------------------------------------
 * GROUND
 * ------------------------------------------------------------------
 * Dark, and not optionally: the brief is a black background, and the
 * instrument reads as an instrument on the void. It takes the page's
 * standard column and band rhythm — no padding is declared here.
 */
/**
 * The headline counts what is actually on the globe. It used to say "Eight"
 * as a literal, and eight is what the fleet holds — but the number drawn is
 * whatever CelesTrak returned for `FLEET_IDS`, and a partial answer is
 * explicitly allowed through by `fetchFleetElements()` ("one decommissioned
 * object should not drop the page to a snapshot"). Measured with the fetch
 * forced empty, the band headlined "Eight spacecraft, where they actually
 * are." over an unpopulated globe. The count now comes from the data.
 */
const COUNT_WORD: Record<number, string> = {
  1: 'One',
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
};

export async function GlobeBand() {
  // Cached three hours, shared by every visitor. The drawing still moves once
  // a second, because propagation is local and does not touch the network.
  const fleet = await fetchFleetElements();
  const serverNow = new Date().toISOString();
  const drawn = fleet.elements.length;

  return (
    <Band tone="dark" top="open" bottom="open">
      <Container className={MEASURE}>
        <BandHead
          label="Overhead now"
          title={
            drawn === 0
              ? 'The fleet is not readable right now.'
              : drawn === 1
                ? 'One spacecraft, where it actually is.'
                : `${COUNT_WORD[drawn] ?? drawn} spacecraft, where they actually are.`
          }
          lede={
            drawn > 0
              ? 'Live orbital elements from CelesTrak, propagated in your browser. Hover one to draw a full revolution of its track at its true altitude. These are not the satellites assigned to your mission — tasking is brokered at capture time and the spacecraft is very often none of these. They are simply what is up there, and where.'
              : 'This band draws real spacecraft from real published orbital elements and nothing else. The element sets did not reach the page, so there is nothing to place on the globe and no position is estimated in their absence.'
          }
        />

        <LiveGlobe
          className="mt-12"
          elements={fleet.elements}
          source={fleet.source}
          serverNow={serverNow}
        />
      </Container>
    </Band>
  );
}
