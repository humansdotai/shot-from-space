import { Band, Container } from '@/components/fui';
import { VideoPlate } from '@/components/hero';
import { BandHead } from './BandHead';
import { MEASURE } from './geometry';

/**
 * 04 · IN FLIGHT — dark, three clips in sequence.
 *
 * Three of the four supplied clips, chosen because together they are an
 * argument and not a showreel: the aperture opens, the instrument that
 * carries the frame is on station, and the order flies as a numbered
 * mission.
 *
 * PERFORMANCE
 * `VideoPlate` gates playback on IntersectionObserver and on tab
 * visibility, so a plate scrolled past or a backgrounded tab decodes
 * nothing. The plates are set at 3:4 rather than the sources' native 9:16:
 * a wall of full portrait video reads as a feed, and a shorter plate keeps
 * the whole band inside one screen so the sequence is read as one sentence.
 *
 * ------------------------------------------------------------------
 * WHAT CHANGES AT EACH BREAKPOINT
 * ------------------------------------------------------------------
 *   < 768   a horizontal snap rail, bled to the viewport edges so the
 *           third plate is visibly cut off and the row reads as
 *           scrollable. Stacked, three portrait clips become three screens
 *           of scrolling and the sequence stops being a sequence.
 *   768     three up, on the grid, at 3:4
 *   1280    plates grow with the column, still three up
 *   1920    the row takes its own width past the column — this is media,
 *           not prose, so it is allowed the screen
 *   2400    one step wider again, and no wider
 *
 * `overflow-x` lives on the rail element, never on the page, so nothing
 * outside it can scroll sideways.
 */
const CLIPS = [
  {
    src: '/video/intro.mp4',
    poster: '/video/intro-poster.jpg',
    alt: 'The Shot from Space mark resolving out of darkness and opening onto an imaging satellite above the Earth',
    label: 'Sighting',
    caption: 'The mark opens on the instrument. Everything under it is addressable.',
  },
  {
    src: '/video/zoom-logo.mp4',
    poster: '/video/zoom-logo-poster.jpg',
    alt: 'Closing in on an imaging satellite in orbit until the Shot from Space nameplate on its hull fills the frame',
    label: 'Instrument',
    caption: 'A camera in orbit, on station. Your target is one line in its collection queue.',
  },
  {
    src: '/video/orbit.mp4',
    poster: '/video/orbit-poster.jpg',
    /* "RENDERED AS", NOT "AN EMBROIDERED". The clip shows twill and floss
       and a spacesuit sleeve; there is no embroidered patch, and a screen
       reader hearing "an embroidered mission patch" is told there is. */
    alt: 'A Shot from Space mission patch rendered as embroidery on a spacesuit sleeve',
    label: 'Mission',
    /* THIS LINE USED TO ENUMERATE A PATCH AS SOMETHING THE ORDER GETS —
       "a code, a patch, and a file that stays open" — with a patch between
       two things the buyer genuinely does receive, under video of one being
       worn. That is the exact construction of the defect
       `components/mission/HonoursBlock.tsx` was rebuilt to close: the five
       distinctions (plate, patch, badge, coin, pin) are DIGITAL, held on the
       mission file, and the print is the only object that is manufactured or
       posted. Nothing is packed with it. The patch stays in the line, because
       it is what the clip shows and it is real — as a record on a file — but
       it is now named as a record, and the second sentence closes the door
       the first one used to leave open. */
    caption:
      'Every order flies as a mission — a code, a file that stays open, and a patch recorded on it. The print is the only object posted.',
  },
];

export function FilmBand() {
  return (
    <Band tone="dark" top="open" bottom="open">
      <Container className={MEASURE}>
        <BandHead
          label="In flight"
          title="The order goes up. The photograph comes down."
          titleClassName="max-w-[20ch]"
          lede="The instrument that carries the frame, the pass it is tasked on, and the number
                your order is flown under."
        />
      </Container>

      <div
        className={[
          // `overscroll-x-contain` for the same reason `.tab-row` carries it:
          // the strip runs to both screen edges, and a swipe past either end
          // otherwise chains into the document.
          'mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain',
          // BELOW 768 — the rail's lead-in, and the cutout inset in one
          // declaration. It used to be two classes, `safe-pad-x` and
          // `px-[var(--gutter-shell)]`, and they were both utilities writing
          // the same property: `safe-pad-x` won, resolved to 0 on every
          // device without a notch, and the whole strip — plates AND
          // captions — sat flush against the viewport edge at 320 through
          // 1440 while this band's own head started at 32px. Measured, not
          // guessed: `padding-left` computed `0px` at all seven widths.
          // One property, written once, so nothing can override it again.
          'pl-[calc(var(--gutter-shell)_+_var(--safe-inset-left))]',
          'pr-[calc(var(--gutter-shell)_+_var(--safe-inset-right))]',
          'scroll-pl-[calc(var(--gutter-shell)_+_var(--safe-inset-left))] pb-1',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          // FROM 768 it stops being a rail and becomes three on the grid, so
          // the padding goes and the row takes the CONTENT COLUMN'S OWN
          // WIDTH instead — the same expression `.column` uses. That is what
          // makes the first plate's left edge land on the band head's left
          // edge at every width, including the two steps above 1920 where
          // the column is wider than 1376 and a fixed padding would have
          // pushed the plates 32px inside the heading.
          'min-[768px]:mx-auto min-[768px]:grid min-[768px]:p-0',
          'min-[768px]:w-[calc(100%_-_2_*_var(--gutter-shell)_-_var(--safe-inset-left)_-_var(--safe-inset-right))]',
          'min-[768px]:max-w-[var(--column-max)]',
          'min-[768px]:grid-cols-3 min-[768px]:gap-[var(--grid-gap-x)]',
          'min-[768px]:overflow-visible',
          'min-[1920px]:max-w-[1680px]',
          'min-[2400px]:max-w-[1920px]',
        ].join(' ')}
      >
        {CLIPS.map((clip) => (
          <VideoPlate
            key={clip.src}
            src={clip.src}
            poster={clip.poster}
            alt={clip.alt}
            label={clip.label}
            caption={clip.caption}
            aspect="3 / 4"
            className="w-[76vw] shrink-0 snap-start min-[768px]:w-auto [&_figcaption]:text-paper-dim"
          />
        ))}
      </div>
    </Band>
  );
}
