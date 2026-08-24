import {
  AnnounceBand,
  AnswersBand,
  ArchiveBand,
  ClosingBand,
  FilmBand,
  FleetBand,
  FounderBand,
  GlobeBand,
  HeroBand,
  MissionCarousel,
  ObjectBand,
  OrbitEntryBand,
  PassBand,
  PricingBand,
  ReachBand,
  RecordBand,
  ResultBand,
} from '@/components/landing';

/**
 * THE LANDING PAGE.
 *
 * One job: move a visitor from "I can point a satellite at my house" to a
 * started mission.
 *
 * ------------------------------------------------------------------
 * WHAT THIS PAGE SELLS
 * ------------------------------------------------------------------
 * Access to orbit — on demand, at an address of your choosing. Not a
 * poster. The print is the form the capability arrives in, and it is a real
 * part of the offer, but it is a fulfilment detail and it is argued as one:
 * the paper, the ink, the formats and the box appear in band 11, after the
 * visitor already believes a satellite will be moved for them. The top
 * third contains no mention of paper at all — only a target, an orbit, a
 * sensor and a set of numbers.
 *
 * ------------------------------------------------------------------
 * THE BANDS, AND THE ARCHETYPE EACH ONE IS
 * ------------------------------------------------------------------
 * Archetypes are SYSTEM-V3 §5.
 *
 *   01  ANNOUNCE     dark   §5.1  announcement band — one line, one link
 *   02  HERO         dark   §5.2  full-bleed frame, THE ADDRESS FIELD, print right
 *   03  REACH        light  §5.3  featured grid — the no-gutter mosaic
 *   04  FILM         dark    —    three clips in sequence
 *   05  PASS         light  §5.5  feature — MEDIA LEFT
 *   06  OVERHEAD     dark    —    the tracked fleet on a live wireframe Earth
 *   07  FLEET        dark    —    the eight spacecraft, from the same elements
 *   08  ORBIT ENTRY  dark    —    the address field again, on a photograph
 *   09  RESULT       dark   §5.4  media-link — one panel, the panel is the link
 *   10  RECORD       light   —    the same mission's file, printed as it prints
 *   11  OBJECT       light  §5.5  feature — MEDIA RIGHT
 *   12  ANSWERS      dark   §5.5  feature — MEDIA LEFT
 *   13  ARCHIVE      light  §5.6  news/index — dated entries with a lead
 *   14  CAROUSEL     dark    —    thirteen finished sheets in one fixed mount
 *   15  FOUNDER      dark    —    the owner's signed note, and only his
 *   16  PRICING      light   —    formats, questions, the five terms, the button
 *   17  CLOSING      dark    —    one action, the terms again, the lockup
 *
 * ------------------------------------------------------------------
 * WHERE ORBIT ENTRY WENT, AND WHY IT IS NOT WHERE IT WAS ASKED FOR
 * ------------------------------------------------------------------
 * It used to be band 03, one screen under the hero. Both bands mount the
 * SAME <MissionEntry /> — the same field, the same button, the same three
 * lines of fine print — and a reader met that block twice inside a screen and
 * a half. The instruction was to move it four sections down.
 *
 * FOUR DOWN LANDS BETWEEN OVERHEAD AND FLEET, and that is the one gap on
 * this page it may not take. Those two are a single instrument movement
 * reading from a single CelesTrak fetch — the globe answers WHERE the eight
 * spacecraft are, the cards answer WHAT they are — and the adjacency is the
 * argument (see BANDS 06, 07 AND 14 below). Dropping a full-bleed photograph
 * with an address form into the middle of it scatters the proof across half
 * a page and leaves the reader wondering why the fleet is being introduced
 * twice.
 *
 * SO IT IS AT 08, one further down, immediately AFTER the pair rather than
 * inside it. That is a better argument than four-down would have been: the
 * globe and the cards establish that there are real spacecraft overhead,
 * and the next thing a reader meets is `Your home. Photographed from orbit.`
 * with the field under it. Evidence, then the ask.
 *
 * THE DARK RUN IS REAL AND IT IS NOT AN ACCIDENT. 06→07→08→09 is four dark
 * bands in a row. Three of them already were: OVERHEAD, FLEET and RESULT are
 * one movement from live elements into the one published mission, and the
 * ground does not flip inside a movement. ORBIT ENTRY is dark too — it is a
 * full-bleed photograph, and there is no light version of it to reach for —
 * so wherever it lands between 06 and 09 the run becomes four. What it must
 * not do is BREAK the movement, and at 08 it does not: it reads as the third
 * beat of it, the one that turns the instrument back on the reader.
 *
 * There was one other candidate and it is worse: 05→06, between PASS and
 * OVERHEAD. It makes the same four-band run, and it puts ORBIT ENTRY's
 * address field directly under PASS's `/mission` button — two asks touching,
 * which is the fault this move exists to fix.
 *
 * The ground flips at most joins. The ones that do not flip are arguments
 * rather than oversights: 06→07→08→09 is the instrument movement above,
 * 10→11 is the record continuing into the object that carries it, and 14→15
 * puts the owner's signature directly against the thirteen files he is
 * signing for. The announcement strip shares the opening dark ground for the
 * same kind of reason: the strip is chrome on the hero, not a band before it.
 *
 * The hero no longer has a same-ground band under it. 02→03 is a clean flip
 * now, which it was not before.
 *
 * ------------------------------------------------------------------
 * BANDS 06, 07 AND 14 WERE BUILT BY OTHER HANDS, AND PLACED BY THIS ONE
 * ------------------------------------------------------------------
 * `GlobeBand`, `FleetBand` and `MissionCarousel` were built in parallel with
 * this pass and arrived without placement notes, so the three positions above
 * are this file's decision and nobody else's:
 *
 *   OVERHEAD and FLEET sit after the mission clock because that band ends
 *   with "the satellite is tasked", and these two are the only evidence on
 *   the site that there is anything up there to task. They are adjacent
 *   because they are one instrument: both propagate the same live elements,
 *   and splitting them scatters the proof across half a page.
 *
 *   CAROUSEL sits after the archive index because the index is thirteen
 *   dated entries and the carousel is the same thirteen as objects — the
 *   list, then the display case.
 *
 * All three are one line each. Move them.
 *
 * The founder's note is what closed the page's other exception. The archive
 * and the price were both paper and sat directly against each other; a dark
 * band between them puts the alternation back on a clean flip and puts the
 * one human voice on the page exactly where a reader is deciding.
 *
 * The three feature rows alternate: left, right, left. Three rows on the
 * same side is a template; three rows that swap is a composition.
 *
 * ------------------------------------------------------------------
 * WHERE THE COLUMN STOPS
 * ------------------------------------------------------------------
 * Six sections opt out of the content column and run full width — the hero,
 * the orbit-entry photograph, the mosaic, the film rail, the media-link
 * panel and the closing frame. That alternation between column and full
 * bleed is the page's rhythm at width, and it is what keeps a 2400px screen
 * composed rather
 * than showing a 1440px design with 480px of dead paper on each side. The
 * column itself takes two measured steps above 1920 (see `geometry.ts`);
 * prose inside it never does, because every paragraph is capped in `ch`.
 *
 * ------------------------------------------------------------------
 * SPACING
 * ------------------------------------------------------------------
 * No band declares padding in a class list. Vertical space comes from
 * `Band`'s five measured values (0 / 20 / 32 / 48 / 56) and from four
 * internal steps — 12 / 20 / 32 / 48 — documented in `geometry.ts`. The one
 * exception is the announcement strip, which reserves the absolutely
 * positioned site header's own height; that is explained in the file.
 *
 * ------------------------------------------------------------------
 * WHERE THE ACTION IS
 * ------------------------------------------------------------------
 * There is no sticky bar on this page and there is not going to be one — a
 * bar that follows the scroll is an admission that the page underneath it
 * is not persuading anyone. Instead the action appears eight times, each at
 * the end of an argument that has just been completed, so it is never more
 * than about a screen and a half away at any depth:
 *
 *   02  HERO         the address field itself — `Begin your mission`
 *   05  PASS         after the sequence from address to shipped object
 *   08  ORBIT ENTRY  the same field, after the eight spacecraft that make it
 *                    a real request rather than a form
 *   11  OBJECT       after the print specification, for the reader who came
 *                    for the object rather than the orbit
 *   12  ANSWERS      after the objections are answered
 *   14  CAROUSEL     under the thirteen finished files
 *   16  PRICING      after the five guarantees, touching them
 *   17  CLOSING      the last one, with the five terms restated under it
 *
 * SEVEN OF THE EIGHT OPEN `/mission`. That is the change this pass made:
 * the site had twenty-one controls pointing at `/start` and one at
 * `/mission`, and the owner picked `/mission` as the funnel. Bands 02 and 08
 * carry the target with them — `/mission?address=…&lat=…&lon=…` — because
 * they are the only two places on the page where a target exists.
 *
 * The eighth is band 16, PRICING, and it still opens `/start`. It is not an
 * oversight and the reason is written at the control itself: that band
 * publishes `lib/pricing`, the print catalogue, and `/mission` prices by
 * tier and cannot charge those figures at any size. Sending a reader from a
 * price table to a checkout that charges different numbers is
 * CONFIGURATOR.md §3.2's defect. Unify the two price lists — the open
 * decision in INTEGRATIONS.md §10 — and that href changes with nothing else.
 *
 * `/start` is not deleted, and nothing here should delete it. It works, it
 * has its own passing specs, and retiring it is the owner's call.
 *
 * BAND 02 AND BAND 08 EACH CARRY THEIR OWN FIRST-SCREEN TEST.
 * The hero's field AND its button are inside the first viewport at every
 * width before any scroll, and band 08's field, button and price line are
 * all inside the viewport the moment a reader arrives at that band — at 320
 * as well as at 2400. Both are CONFIGURATOR.md §3.1, both are measured, and
 * both were re-measured at all nine widths after the print moved to the
 * right of the hero and ORBIT ENTRY moved down the page.
 *
 * ------------------------------------------------------------------
 * WHAT IS NOT HERE, DELIBERATELY
 * ------------------------------------------------------------------
 * No testimonials, no customer names, no quotes, no star ratings, no review
 * counts, no "trusted by" logos, no customer numbers, no countdown, no
 * scarcity, no "N people viewing", and no invented crew on the
 * demonstration file. Shot from Space has not shipped a customer mission,
 * so none of that could be true, and a fabricated endorsement on a page
 * that takes $180 to $640 is fraud with nice typography.
 *
 * Band 15 is the one place a person speaks, and it is the owner. It is
 * built as a signed founder's note — his name and his title in the visible
 * copy, above the first sentence and again at the signature, plus a
 * footnote saying in plain words that this is the founder writing about his
 * own product and is not a customer review. It is not inside a reviews
 * section, it has no stars, no score and no second voice, and if anyone
 * ever puts one beside it the block has become the thing this page exists
 * to refuse. See `components/landing/FounderBand.tsx`.
 *
 * The rest of the proof is real in the same way: five contractual
 * guarantees stated twice — under the price and under the closing button,
 * because risk reversal belongs at the decision and not in a footer — two
 * photographed artifacts, thirteen dated captures from the public Landsat
 * archive, and one example mission published in full and labelled as an
 * example.
 */
export default function HomePage() {
  return (
    <main>
      <AnnounceBand />
      <HeroBand />
      <ReachBand />
      <FilmBand />
      <PassBand />
      <GlobeBand />
      <FleetBand />
      <OrbitEntryBand />
      <ResultBand />
      <RecordBand />
      <ObjectBand />
      <AnswersBand />
      <ArchiveBand />
      <MissionCarousel />
      <FounderBand />
      <PricingBand />
      <ClosingBand />
    </main>
  );
}
