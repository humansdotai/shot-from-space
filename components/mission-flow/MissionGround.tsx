'use client';

import type { ReactNode } from 'react';
import { clsx as cn } from 'clsx';
import { VideoPlate } from '@/components/hero/VideoPlate';

/**
 * ==================================================================
 * THE MISSION GROUND — one full-bleed clip, one honesty note, and
 * whatever card the section puts on top of it.
 * ==================================================================
 *
 * This is the Review section's composition, extracted so that every
 * other section can have it and none of them can have a slightly
 * different version of it. It was `Backing` inside `S8Dossier.tsx`; the
 * scrim, the honesty note and the way <VideoPlate /> is stretched to the
 * well all now live here and nowhere else. The one thing it does NOT
 * own is the edge: every caller wraps it in <Mount />, the house's
 * "an object, on paper" treatment, so there is one hairline on that
 * boundary rather than two.
 *
 * ------------------------------------------------------------------
 * WHY A CARD ON MOVING FOOTAGE AT ALL
 * ------------------------------------------------------------------
 * `section-middle.pdf` sets the house composition: a sheet centred on a
 * full-bleed aerial, held by a white mount, no outer border on the
 * photograph. Used once it is a good screen; used on every step where
 * the preview column holds a SHEET rather than a photograph, the flow
 * reads as one continuous mission instead of one good screen among
 * plain ones.
 *
 * It is not used where the preview column already holds a PICTURE. The
 * archive descent and the framing map bleed to all four edges, so a clip
 * behind them is a video nobody can see, decoding for nothing. And the
 * print preview is the object being bought: measured at 390, the well is
 * 129px, this ground spends 56px of it on the note row and the pause
 * control, and <PreviewObject /> then caps the sheet at `100cqh × ratio`
 * — the print fell from ~92px to ~51px tall, a thumbnail of the thing
 * the buyer is judging. Tried, screenshotted at 390 and 1440, reverted.
 *
 * ------------------------------------------------------------------
 * ONLY TWO CLIPS ARE USABLE, AND THE TYPE SAYS SO
 * ------------------------------------------------------------------
 * `public/video` holds four clips. TWO OF THEM CARRY BURNED-IN MISSION
 * CODES: `result.mp4` prints `MISSION 32BF` and a capture timestamp,
 * `orbit.mp4` prints `MISSION B324`. On a surface that names THIS
 * buyer's mission either one reads as this buyer's own record, which is
 * false for every mission but two. So the safe set is a union type
 * (`MissionClip`) and the table below is the only place a file path is
 * written: a wrong clip is a type error, not a review catch.
 *
 * ------------------------------------------------------------------
 * THE NOTE RIDES WITH THE CLIP
 * ------------------------------------------------------------------
 * Adjacency argues. A spacecraft moving under a document that names a
 * mission asserts, without a word, that this is the spacecraft flying
 * it. It is not — it is stock footage, and this site does not operate
 * spacecraft. So the note is not a prop a caller may forget: it is a
 * property OF the clip, written beside its path, and it is rendered
 * unconditionally.
 *
 * ------------------------------------------------------------------
 * THE SCRIM IS MEASURED, NOT ASSUMED
 * ------------------------------------------------------------------
 * The card is `--ground` on `.surface-light` — #eeede8, relative
 * luminance 0.8457. What sits behind it is not a still: taking the
 * PER-PIXEL MAXIMUM across all 145 frames of each clip, the visible
 * centre band reaches #ffffff in both (median of that per-pixel maximum
 * is 0.937 for `zoom-logo`), because the clouds and the specular
 * highlights on the spacecraft blow out. Against a white card that is
 * 1.17 : 1 — no boundary at all.
 *
 *   scrim   worst-case ground   paper : ground
 *     28%       #bababb             1.65 : 1     ← what shipped
 *     40%       #9c9d9d             2.33 : 1
 *     50%       #848485             3.19 : 1
 *     52%       #808081             3.36 : 1     ← this
 *     60%       #6b6b6d             4.52 : 1
 *
 * 52% is the first round step that clears WCAG 1.4.11's 3 : 1 for a
 * non-text boundary against the brightest frame the clip can produce,
 * with a margin, while leaving the footage plainly readable as footage.
 * The card's own text is unaffected by any of this — it is ink on paper
 * inside the card — but the card has to read as an OBJECT on something,
 * and at 28% its edge dissolved into cloud.
 *
 * The NOTE is white text directly on the clip, so it gets a second,
 * local darkening: a bottom gradient under the note row only. Sampled
 * off the rendered page with every clip frame forced to #ffffff — the
 * genuine maximum, not a still — the shipped stack measures:
 *
 *              card : ground beside it     note on its ground
 *   1440           3.42 : 1                    16.59 : 1
 *    390           3.77 : 1                    16.69 : 1
 *
 * ------------------------------------------------------------------
 * THE NOTE IS A ROW, NOT AN OVERLAY
 * ------------------------------------------------------------------
 * It used to be `absolute inset-x-0 bottom-0` with the card padded off
 * it. At 390 the preview column is 38svh, the note wraps to two lines
 * and it printed straight across the bottom of the dossier sheet. Here
 * the ground is a flex column and the note is its last row, so the card
 * gets `flex-1` of whatever is left and the two cannot overlap at any
 * height. The row keeps a right inset because <VideoPlate /> puts its
 * pause control in that corner — two things in one strip, neither on
 * top of the other.
 *
 * ------------------------------------------------------------------
 * PLAYBACK IS <VideoPlate />'s JOB
 * ------------------------------------------------------------------
 * Not a bare `<video>`. It already owns iOS Low Power Mode refusing
 * `play()`, the always-visible control on a coarse pointer, WCAG 2.2.2,
 * `prefers-reduced-motion` (poster frame only, never played) and the
 * `-540` encode below 768px. It also gates playback on an
 * IntersectionObserver, which is what makes the performance rule hold
 * for free: <PreviewStage /> hides the inactive artefacts with the
 * `hidden` attribute, a `display: none` element never intersects, and
 * every clip but the active section's is therefore paused. Verified by
 * walking the whole rail in one session, with every visited artefact
 * still mounted, and reading `getVideoPlaybackQuality().totalVideoFrames`
 * on each element over 1.5s: the active one advanced by 36 frames, every
 * hidden one by 0.
 *
 * The plate is a FIGURE with its own proportion and its own frame; here
 * it is the GROUND, so the proportion is released (`aspect="auto"`) and
 * the figure and its box are stretched to the well with child selectors
 * rather than a new prop — a shared component stays shared.
 */

/* ------------------------------------------------------------------ */
/* The safe set                                                        */
/* ------------------------------------------------------------------ */

/**
 * The clips with no burned-in text. `result.mp4` (MISSION 32BF, plus a
 * capture timestamp) and `orbit.mp4` (MISSION B324) are deliberately
 * absent and must stay absent — see the header.
 */
export type MissionClip = 'zoom-logo' | 'intro';

interface ClipRecord {
  src: string;
  poster: string;
  /** For assistive tech. Describes the footage, never the product. */
  alt: string;
  /** What the footage is NOT. Printed on the plate, always. */
  note: string;
}

export const MISSION_CLIPS: Readonly<Record<MissionClip, ClipRecord>> = {
  'zoom-logo': {
    src: '/video/zoom-logo.mp4',
    poster: '/video/zoom-logo-poster.jpg',
    alt: 'Stock footage of a satellite in low Earth orbit above cloud.',
    note: 'Stock orbital footage · not the spacecraft assigned to this mission',
  },
  intro: {
    src: '/video/intro.mp4',
    poster: '/video/intro-poster.jpg',
    alt: 'The Shot From Space mark, turning, opening onto Earth from orbit.',
    // Truthful for THIS clip: it is an identity sequence, not footage of
    // a spacecraft at all. The note that rides with a clip has to be
    // about that clip.
    note: 'Identity sequence · not footage of the spacecraft assigned to this mission',
  },
} as const;

/* ------------------------------------------------------------------ */
/* An existing picture, where the tier is an existing picture          */
/* ------------------------------------------------------------------ */

/**
 * The Archive tier's ground. It is not a clip and must not be one: that
 * tier's whole product is a frame that already exists, so the ground is
 * that frame. It shares this component so that the scrim, the note row
 * and the mount are the same construction as everywhere else.
 */
export interface MissionStill {
  src: string;
  alt: string;
  /** What the still is NOT. Same contract as a clip's note. */
  note: string;
}

/* ------------------------------------------------------------------ */
/* The ground                                                          */
/* ------------------------------------------------------------------ */

type MissionGroundProps = {
  /** The card. Given the height left over once the note row has its own. */
  children?: ReactNode;
  className?: string;
} & (
  | { clip: MissionClip; still?: never }
  | { still: MissionStill; clip?: never }
);

export function MissionGround({ clip, still, children, className }: MissionGroundProps) {
  const media: ClipRecord | MissionStill = clip ? MISSION_CLIPS[clip] : still!;

  return (
    <div
      /* NO BORDER OF ITS OWN. Every caller puts this inside <Mount />,
         which is the house's "an object, on paper" treatment — a darker
         edge than the interior rule plus a contact cast. Drawing a second
         hairline inside it stacked two rules on one boundary. */
      className={cn('relative flex h-full w-full flex-col overflow-hidden bg-void', className)}
    >
      {clip ? (
        <div
          className={cn(
            'absolute inset-0',
            '[&>figure]:h-full [&>figure]:w-full',
            '[&>figure>div]:h-full [&>figure>div]:w-full [&>figure>div]:border-0',
          )}
        >
          <VideoPlate
            src={MISSION_CLIPS[clip].src}
            poster={MISSION_CLIPS[clip].poster}
            alt={MISSION_CLIPS[clip].alt}
            aspect="auto"
            rounded={false}
          />
        </div>
      ) : (
        /* Plain <img>: `/api/geocode/static` renders the crop at the size
           this component asks for, so there is nothing for the image
           optimiser to decide. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={still!.src}
          alt={still!.alt}
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
        />
      )}

      {/* THE SCRIM. 52% — measured, see the header. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[color:color-mix(in_srgb,#08090b_52%,transparent)]"
      />

      {/* THE SECOND DARKENING, under the note row only. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-void via-[color:color-mix(in_srgb,#08090b_55%,transparent)] to-transparent"
      />

      {/* THE CARD.
          `min-h-0` so a sheet that scrolls inside itself actually can —
          without it the flex child refuses to shrink and the note row is
          pushed out of the plate. No bottom padding: the note row below
          supplies that gap, once, at a measured height. `overflow-hidden`
          because `items-center` lets an over-tall child spill in BOTH
          directions, and at 320 it did, straight across the note.
          `container-type: size` republishes THIS box's height as `cqh`,
          so a caller sizing a print from `100cqh` measures the space it
          is actually allowed rather than the stage's whole well. */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 pt-2 [container-type:size] lg:px-4 lg:pt-4">
        {children}
      </div>

      {/* THE NOTE. A row, not an overlay, so nothing can print across the
          card at any height. `min-h-11` is not slack either: it is the
          exact band <VideoPlate />'s pause control occupies (44px at
          `bottom-3`), so the control sits in this row rather than on the
          corner of the card. The right inset keeps the two apart
          horizontally as well. */}
      <p className="relative z-10 flex min-h-11 shrink-0 items-end pb-3 pl-3 pr-16 font-mono text-tele-xs uppercase text-paper [text-shadow:0_1px_6px_rgba(8,9,11,0.9)] lg:pb-4 lg:pl-4">
        {media.note}
      </p>
    </div>
  );
}
