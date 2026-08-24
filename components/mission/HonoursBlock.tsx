import { clsx as cn } from 'clsx';
import { Artifact3D } from '@/components/artifact';
import type { MissionDTO } from '@/lib/types';
import {
  FILE_LABEL,
  FILE_S,
  FILE_XS,
  INK,
  INK_DIM,
  INK_FAINT,
  IndexPair,
  RULE,
  RuleRow,
} from './ui';

/**
 * HONOURS — the honorary distinctions recorded against the mission.
 *
 * A citation list on a service record, not a product grid. Each entry is one
 * filed line: its position in the set, the badge itself, what it is and what
 * it marks. Five equal cards would read as merchandise; a ruled column of
 * citations reads as a record of what was conferred, which is what these are.
 *
 * ------------------------------------------------------------------------
 * HONESTY — READ THIS BEFORE EDITING A WORD OF THE COPY
 * ------------------------------------------------------------------------
 * THESE ARE HONORARY AND DIGITAL. NOTHING IN THIS BLOCK IS MANUFACTURED,
 * PACKED OR POSTED. The only physical object in the order is the print.
 *
 * That is a correction, not a nuance. Until now this block was headed "the
 * physical distinctions issued with the mission" and said the patch was
 * "packed in the same box as the print"; the landing page promised "a print,
 * a patch, a coin"; the conversion band was labelled "Ships with every
 * print". A buyer reading any of those would have been waiting on a parcel
 * containing three objects that were never going to be in it — which is the
 * one category of claim on this site that a customer can disprove by opening
 * the box. Every one of those strings is gone.
 *
 * What is true, and all that may be said here:
 *   · every mission is conferred all five, automatically;
 *   · they are held on the mission file and shown with it;
 *   · nobody awards them, none is scarce, and there is nothing to win;
 *   · they are renders, and the render is the honour.
 *
 * ------------------------------------------------------------------------
 * WHY THE OBJECTS ARE NOW IN FRAMES — THE PICTURE HAD TO STOP ARGUING
 * ------------------------------------------------------------------------
 * The sentence above was true and the page still read as merchandise,
 * because the copy and the artwork were saying different things. Five
 * photographic renders — an embroidered patch, a struck coin, a milled
 * aluminium plate — laid on a paper ground with contact shadows are a
 * picture of five objects on a table, and a caption underneath explaining
 * that they are not objects is a caption arguing with its own picture. A
 * reader believes the picture.
 *
 * So each render is now inside a badge frame: a ruled tile on a plotted
 * field, stamped DIGITAL BADGE against THIS MISSION'S code. The frame is the
 * point. It says the render is a thing held in a file and displayed, in the
 * same way the telemetry above it is held in the file and displayed — not a
 * thing photographed on a surface. Every citation also opens with a DIGITAL
 * chip and carries `Form / Digital badge` as its first data row, so the
 * claim is made three times before a word of prose is read.
 *
 * <Artifact3D />'s own docblock argues the opposite ("a physical object on a
 * page, not a picture of one", "the patch and the coin are things a customer
 * will hold") and removes exactly this plate. That rationale was written
 * while these were believed to ship. They do not ship, so the premise is
 * gone and the plate comes back. The tilt and the cast shadow are kept: a
 * badge that turns under the pointer is more obviously a rendered thing than
 * a flat PNG, not less.
 *
 * THE SPECIMEN TEXT. Three of these renders carry legible text that is not
 * this mission's. The coin and the badge read MISSION B324. The plate goes
 * further: it is struck with a code, a capture timestamp, a frame-centre
 * coordinate pair and a MISSION PERSONNEL block naming a mission director and
 * a tasking authority — and every one of those values belongs to the render,
 * not to the file. On a page headed MISSION {code}, beside a record stating
 * this mission's real coordinates, that is a discrepancy a reader can see, so
 * the note under the list names it outright rather than hoping nobody looks.
 * The frame's own stamp carries the real code, which is the honest half of
 * that pair and is why it is there.
 *
 * The personnel lines matter most, because they are the only place on this
 * site where a named human is attached to a mission. Nobody is named anywhere
 * in the real record: this operation has no crew roster, and printing one
 * would be an invented credential of exactly the kind the rest of this file
 * refuses. The note therefore disclaims them explicitly.
 *
 * ------------------------------------------------------------------------
 * MATERIALS AND SCALE
 * ------------------------------------------------------------------------
 * The `depicts` field describes what the ARTWORK shows, never what the buyer
 * receives — which is why its visible label is `Render depicts` and never
 * `Material`. <Artifact3D /> owns the tilt, the damping and the cast shadow:
 *
 *   patch   textile (default) — embroidered floss scatters light, it does
 *                               not travel a highlight
 *   badge   metal             — a brushed aluminium medallion does
 *   coin    metal             — struck relief does
 *   pin     textile (default) — hard enamel over the mark; at this size a
 *                               travelling specular would be a glint, not a
 *                               material
 *
 * The five sit on paper. A citation belongs to the record half of the file,
 * and the contact shadow these renders cast is authored for a light ground.
 *
 * Frame widths carry the relative size of the five badges as depicted, and
 * `artScale` corrects for the different amounts of empty canvas around each
 * render so that frame width alone controls apparent size. Measured solid
 * bounds: patch 711/1200 of a landscape canvas, badge 873/1024, coin
 * 1029 across a 1122 x 1402 portrait canvas. Normalising each to the coin's
 * 0.734 disc-to-frame ratio gives 1.24, 0.86 and 1. Each render is also
 * capped at `max-w-full` so the widest of them, the plate, cannot push out
 * of its badge frame at the base step.
 */

type Distinction = {
  name: string;
  src: string;
  alt: string;
  /** What the distinction is and what it marks. Report voice, two lines. */
  citation: string;
  /** Who gets it. Never "with the print" — nothing here ships. */
  conferred: string;
  /** What the ARTWORK depicts. Not a material the buyer will hold. */
  depicts: string;
  /** Frame width. Carries the real relative size of the five badges. */
  width: string;
  /** Optical correction inside the square frame — see Artifact3D. */
  artScale?: number;
  material?: 'textile' | 'metal';
};

/**
 * Every citation is written in the passive of depiction — "drawn as",
 * "rendered as", "shown as" — and never in the present indicative of a
 * material. "Struck bronze, the mark raised at the centre" describes an
 * object that exists; "Rendered as struck bronze" describes a badge. The
 * distinction is the whole subject of this block, so it is made in the
 * grammar and not only in the note at the foot.
 */
const DISTINCTIONS: Distinction[] = [
  {
    name: 'Mission plate',
    src: '/brand/mission-plate.webp',
    alt: 'Badge render of the mission sheet embossed into a brushed aluminium plate, the frame above the record',
    citation:
      'The whole file drawn as a single struck sheet — the frame embossed above, the record embossed below, in the same arrangement the print uses. It is the file shown as an object rather than as a page, and it is the badge that carries the most of the record.',
    conferred: 'Every mission',
    depicts: 'Struck aluminium',
    // 4:3 artwork with no alpha, so it already fills its frame's width and
    // its shadow copy is a true rectangle. Nothing to correct.
    artScale: 1,
    material: 'metal',
    width: 'w-[168px] md:w-[204px] xl:w-[224px] xl2:w-[248px]',
  },
  {
    name: 'Mission patch',
    src: '/brand/mission-patch.webp',
    alt: 'Badge render of a Shot from Space mission patch drawn as embroidered twill, a satellite above the curve of the Earth',
    citation:
      'The mission’s own insignia, drawn as embroidered twill. It is conferred the moment the mission is confirmed and it stays on the file for as long as the file exists.',
    conferred: 'Every mission',
    depicts: 'Embroidered twill',
    artScale: 1.24,
    width: 'w-[132px] md:w-[160px] xl:w-[176px] xl2:w-[196px]',
  },
  {
    name: 'Mission badge',
    src: '/brand/mission-badge.webp',
    alt: 'Badge render of a Shot from Space mission medallion drawn as brushed aluminium, the mark raised at its centre',
    citation:
      'A medallion rendered in brushed aluminium, the mark raised at the centre and the mission legend drawn around the rim. It marks a mission that reached a confirmed frame rather than one that was merely opened.',
    conferred: 'Every mission',
    depicts: 'Brushed aluminium',
    // 0.86 normalises an 873/1024 disc to the coin's 0.734 disc-to-frame
    // ratio, so the frame widths below are a true relative scale.
    artScale: 0.86,
    material: 'metal',
    width: 'w-[118px] md:w-[142px] xl:w-[156px] xl2:w-[174px]',
  },
  {
    name: 'Mission coin',
    src: '/brand/mission-coin.webp',
    alt: 'Badge render of a Shot from Space mission coin drawn as struck bronze, the chrome mark raised at its centre',
    citation:
      'Rendered as struck bronze, the mark raised at the centre and the mission legend around the rim. One per mission, conferred whether the first pass clears or the mission is re-tasked four times.',
    conferred: 'Every mission',
    depicts: 'Struck bronze',
    material: 'metal',
    width: 'w-[94px] md:w-[112px] xl:w-[124px] xl2:w-[138px]',
  },
  {
    name: 'Lapel pin',
    src: '/brand/mark-3d.webp',
    alt: 'The Shot from Space chrome mark, shown at lapel-pin scale',
    citation:
      'The mark itself, drawn at the scale a lapel pin is made to and finished as hard enamel — the same mark that stands raised at the centre of the coin and the badge. Shown as the mark, not as a photograph of a pin.',
    conferred: 'Every mission',
    depicts: 'Hard enamel',
    width: 'w-[58px] md:w-[70px] xl:w-[78px] xl2:w-[86px]',
  },
];

export function HonoursBlock({
  mission,
  className,
}: {
  mission: MissionDTO;
  className?: string;
}) {
  return (
    <div className={className}>
      {/* NO "DIGITAL" CHIP HERE ANY MORE, and the reason is a count.

          The word rendered SIXTEEN times in this one section: the section
          headline is now "Digital only", each of the five badge frames is
          stamped "Digital badge", and each citation's first data row reads
          "Form / Digital badge". A fifth accent chip repeating it made the
          section shout a fact the reader had already accepted, and `alert`
          was the wrong register besides — this is a standing property of the
          set, not a status anyone needs warning about.

          What the line still has to carry is the CONSEQUENCE, which the word
          "digital" does not state on its own: nothing is posted. That stays. */}
      <p className={cn(FILE_S, FILE_LABEL)}>Held on this file · nothing is posted</p>

      {/* ==================================================================
          THE AWARDS COME FIRST. The owner pointed at this section and said
          "here put awards".

          What they were pointing at: on a 2000 x 1040 screen the top of a
          section called DISTINCTIONS contained an eyebrow, a display
          headline, and then TWO DENSE PARAGRAPHS — and not one distinction.
          A reader had to scroll a full screen past prose to reach the
          objects the section is named after. The artwork was already in
          this file; it was just buried under the explanation of it.

          So the order is inverted: one line that says what these are, then
          the five, then everything the old two paragraphs were saying.
          Nothing is deleted — the certificate sentence and the "nothing to
          win" clause both survive below the list, where someone who wants
          the detail will be looking for it.

          THE LOAD-BEARING CLAIM DOES NOT MOVE. The owner instructed, in
          capitals, that ALL DISTINCTIONS ARE DIGITAL and are never posted,
          and `tests/unit/distinctions-are-digital.spec.ts` scans this source
          for delivery verbs next to distinction nouns. That claim is now
          made ONCE, in the line directly under the eyebrow, where it is the
          first thing read rather than the fourth. Said once and clearly
          beats said five times weakly — which is what the old paragraph
          did, repeating "honorary", "digital", "not manufactured, packed or
          posted" and "the print is the only object that arrives" in the
          space of four sentences.
          ================================================================== */}
      <p className={cn('mt-7 max-w-[var(--measure)] text-body', INK_DIM)}>
        Five honorary distinctions are conferred on mission {mission.code} and held on its file.
        They are digital: nothing beyond the print is manufactured or posted.
      </p>

      <ol className={cn('mt-10 border-t xl:mt-12', RULE)}>
        {DISTINCTIONS.map((d, i) => (
          <Citation
            key={d.name}
            distinction={d}
            index={i + 1}
            total={DISTINCTIONS.length}
            missionCode={mission.code}
          />
        ))}
      </ol>

      {/* THE REST OF WHAT THE TWO PARAGRAPHS SAID, kept in full and moved
          to where it belongs — after the objects it describes. */}
      <p className={cn('mt-12 max-w-[var(--measure)] text-body', INK_DIM)}>
        None of the five is scarce, competitive or held back for a result. Nobody awards them and
        there is nothing to win: each is a badge held on this file and shown with it, exactly as
        the telemetry above is held and shown.
      </p>

      <p className={cn('mt-4 max-w-[var(--measure)] text-body', INK_DIM)}>
        All five are named on the certificate issued with the order, which is written for the
        kind of mission it records: a commission certificate where a satellite was tasked for a
        new frame, an archive certificate where an existing frame was printed.
      </p>

      {/* Prose, so it takes `text-note` (sans) rather than the uppercase
          detail ramp — a sentence of provenance is not a label. */}
      <p className={cn('mt-7 max-w-[var(--measure)] text-note', INK_FAINT)}>
        Each is a render, and the render is the distinction. The legend drawn on the coin and the
        badge reads MISSION B324, and the plate is drawn with a mission code, a capture time, a
        coordinate pair and two named personnel of its own — all of it specimen text carried in
        the artwork, none of it this mission’s record. The code stamped on each badge frame is
        the real one. The record itself is the file you are reading. The pin is represented by
        the mark it would be enamelled from.
      </p>
    </div>
  );
}

/**
 * One citation.
 *
 * The ordinal pair and the badge stay together on the left at every width —
 * that pairing is what makes the entry read as filed rather than as a card.
 * The citation itself sits underneath below 768 and beside from there, so a
 * 390 column never sets a sentence to a 150px measure.
 */
function Citation({
  distinction: d,
  index,
  total,
  missionCode,
}: {
  distinction: Distinction;
  index: number;
  total: number;
  missionCode: string;
}) {
  return (
    <li className={cn('border-b', RULE)}>
      <div className="flex flex-col gap-7 py-9 md:flex-row md:items-start md:gap-10 xl:gap-14 xl:py-11">
        <div className="flex shrink-0 justify-center md:justify-start">
          <BadgeFrame missionCode={missionCode}>
            <Artifact3D
              src={d.src}
              alt={d.alt}
              artScale={d.artScale}
              material={d.material}
              className={cn(d.width, 'max-w-full')}
            />
          </BadgeFrame>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-6">
            <h3 className={cn('text-action', INK)}>{d.name}</h3>
            <IndexPair index={index} total={total} />
          </div>
          <p className={cn('mt-3 max-w-[var(--measure)] text-body', INK_DIM)}>{d.citation}</p>

          {/* `Form` leads, and it says the same thing as the stamp on the
              frame. The materials row is labelled `Render depicts` so it can
              never be read as a spec for something that arrives. */}
          <dl className="mt-7 grid grid-cols-1 gap-x-[var(--grid-gap-x)] sm:grid-cols-3">
            <RuleRow label="Form" value="Digital badge" sans />
            <RuleRow label="Conferred" value={d.conferred} sans />
            <RuleRow label="Render depicts" value={d.depicts} sans />
          </dl>
        </div>
      </div>
    </li>
  );
}

/**
 * THE BADGE FRAME — what makes the render read as a file object.
 *
 * A 1px ruled tile over a 16px plotted field, with a stamp strip along the
 * foot carrying DIGITAL BADGE and this mission's real code. The grid is
 * mixed from `--ink` at 5%, so it inverts with the ground token like every
 * other rule on the file rather than hard-coding a colour for the paper
 * half.
 *
 * The tile is a fixed width at each step and the badges inside are not, which
 * is deliberate: one frame at five different fill ratios reads as a set of
 * five badges of different sizes, which is what they are. A uniform fill
 * would have thrown away the measured relative scale the widths encode.
 */
function BadgeFrame({
  children,
  missionCode,
}: {
  children: React.ReactNode;
  missionCode: string;
}) {
  return (
    <div
      className={cn(
        'flex w-[196px] flex-col border md:w-[212px] xl:w-[236px] xl2:w-[260px]',
        RULE,
      )}
    >
      <div
        className="flex aspect-[5/4] items-center justify-center p-4 md:p-5"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0 15px, color-mix(in srgb, var(--ink) 5%, transparent) 15px 16px),' +
            'repeating-linear-gradient(90deg, transparent 0 15px, color-mix(in srgb, var(--ink) 5%, transparent) 15px 16px)',
        }}
      >
        {children}
      </div>
      <div className={cn('flex items-center justify-between gap-3 border-t px-3 py-2', RULE)}>
        <span className={cn(FILE_XS, FILE_LABEL)}>Digital badge</span>
        <span data-telemetry className={cn(FILE_XS, 'tabular-nums', INK_DIM)}>
          {missionCode}
        </span>
      </div>
    </div>
  );
}
