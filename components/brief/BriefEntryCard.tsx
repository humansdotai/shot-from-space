'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ButtonArrow } from '@/components/fui';
import { VideoPlate } from '@/components/hero';
import type { MissionDTO } from '@/lib/types';
import { BriefDeck } from './BriefDeck';
import { briefCards } from './cards';
import styles from './brief.module.css';

/**
 * MISSION BRIEF — the way in (BRIEF-DECK §A).
 *
 * A WIDE RECTANGLE FLOATING AT THE BOTTOM RIGHT OF THE SCREEN, playing a
 * short silent clip on a loop, with the words MISSION BRIEF set large and
 * white over the picture and no stroke anywhere on it. Pressing it opens
 * <BriefDeck />; closing the deck puts focus back here.
 *
 * ==================================================================
 * WHY `zoom-logo.mp4`
 * ==================================================================
 * Four clips ship in `/video/`. Three of them are wrong for this card and
 * one of them is wrong in a way that matters:
 *
 *   result.mp4     the finished print, and it is a beautiful frame — but it
 *                  has MISSION 32BF and 21:34PM 02.10.2026 burned into it.
 *                  On /m/18QD that is a mission number and a capture time
 *                  this file does not hold, printed on the card that opens
 *                  its brief. BRIEF-DECK §C forbids exactly that.
 *   orbit.mp4      the sleeve patch, embroidered MISSION B324 — same
 *                  problem, a second mission's number on this mission's
 *                  file.
 *   intro.mp4      the mark resolving out of darkness. Its POSTER FRAME is
 *                  very nearly black, and the poster is the whole card
 *                  under `prefers-reduced-motion`. A reduced-motion reader
 *                  would get an empty rectangle.
 *   zoom-logo.mp4  the imaging satellite on station, cloud deck and ocean
 *                  under it, closing until the SHOT FROM SPACE nameplate on
 *                  its hull fills the frame.
 *
 * The last one is the only clip that is about THIS mission rather than
 * about another one: the instrument, the sky it is looking through and the
 * cloud that decides whether the pass is usable — which is what cards one
 * to four of the deck are about. It carries no burned-in text of its own,
 * so it stays true on every mission code, and its poster frame is a fully
 * legible image, so the reduced-motion card is still a picture.
 *
 * Cropped to 11:5. The sources are 720x1280 portrait and the clip's subject
 * sits dead centre, so a wide landscape crop loses nothing but sky.
 *
 * ==================================================================
 * `position: fixed`, AND WHAT THAT COSTS
 * ==================================================================
 * The instruction is "floating on bottom right of the screen". The screen
 * is the viewport, so the card is fixed to it. An absolutely-positioned
 * corner of the masthead would have been the safer build and it would not
 * have been the thing asked for: it floats for one screenful of a ten
 * screenful document and is gone for the rest.
 *
 * Fixed is a promise to the rest of the page, and it is kept in four
 * places — the geometry is in `brief.module.css`, the behaviour is here:
 *
 *   1. IT GETS OUT OF THE WAY OF THE PAGE'S OWN CONTROLS. The file ends in
 *      File actions and then the site footer. `FOOT_CLEARANCE` below is how
 *      much document has to be left under the fold before the card is
 *      willing to sit over it; past that it stands down — fades, drops, and
 *      goes `inert`, which takes it out of the tab order and the
 *      accessibility tree together so nothing invisible is still reachable.
 *      It never stands down while it holds focus, because a control moving
 *      out from under a keyboard user is worse than a control in the way.
 *   2. IT COLLAPSES. The reader can minimise it to a 44px control that is
 *      still the door to the deck, so dismissing the card never costs the
 *      brief. There is no way to make the deck unreachable.
 *   3. IT CANNOT TRAP FOCUS. It is two ordinary buttons in the document's
 *      own tab order and it captures no key.
 *   4. IT IS NEVER OVER THE DECK. z-index 30 against the deck overlay's 60,
 *      and that overlay is opaque edge to edge.
 *
 * ==================================================================
 * ONE VIDEO COMPONENT
 * ==================================================================
 * <VideoPlate> is mounted as-is. It already owns muted/playsInline/loop,
 * the two encodes, the poster, IntersectionObserver and tab-visibility
 * gating, the reduced motion branch (poster only, never played, metadata
 * never fetched) and the pause control that WCAG 2.2.2 requires of anything
 * that loops. Nothing here re-implements any of it. Its own hairline is the
 * one thing overridden — the owner's instruction is "no strokes".
 *
 * ==================================================================
 * WHY THE BUTTON IS NOT WRAPPED AROUND THE PLATE
 * ==================================================================
 * The obvious markup — <button><VideoPlate /></button> — is invalid twice
 * over: a <figure> is not phrasing content, and VideoPlate's pause control
 * is itself a <button>, which cannot nest.
 *
 * So the press target is a bare <button> stretched under the card, and
 * everything the card draws sits over it with `pointer-events: none`, the
 * pause control alone opting back in. Result: a click anywhere on the card
 * opens the deck, a click on PAUSE stops the clip and opens nothing, and
 * both are real buttons in the tab order in that order.
 *
 * The wrapper carries `group`, so VideoPlate's own hover moves — the frame
 * scaling, the pause control fading up — fire from a hover anywhere on the
 * card, not just from a hover on the plate it can no longer receive.
 *
 * ==================================================================
 * MOTION
 * ==================================================================
 * The lift is a 2px translate and a deeper cast on the house curve, and
 * that is the whole of it. NO TILT HERE: the deck's cards turn toward the
 * pointer (./tilt.ts) because they are the objects being examined; this is
 * a door, and a door that tips when you look at it is a door drawing
 * attention to itself. It also has to stay legible while a bright cloud
 * deck moves under a large white word, which a rotation does not help.
 *
 * ==================================================================
 * ROUNDED CORNERS
 * ==================================================================
 * `--radius-card` is 2px (SPEC-V4 §A5). This card is one of the two
 * consumers of `--radius-deck`, the §E exception declared in
 * app/globals.css — the deck's cards and this door into them, so that
 * opening the deck reads as this card being picked up.
 */

const CLIP = {
  src: '/video/zoom-logo.mp4',
  poster: '/video/zoom-logo-poster.jpg',
  alt: 'Closing in on an imaging satellite in orbit above the cloud deck until the Shot from Space nameplate on its hull fills the frame',
} as const;

/** A wide rectangle. 11:5 at every width; the width itself steps in CSS. */
const ASPECT = '11 / 5';

/**
 * How much document has to remain below the fold before the card is willing
 * to float over it. The tail of the file is `File actions` — share, receipt,
 * reorder — and then the site footer, and a fixed card parked over a control
 * is the defect this number exists to prevent. 560px clears the footer and
 * the last row of the actions block at every width tested.
 */
const FOOT_CLEARANCE = 560;

/*
   HEAD CLEARANCE — the same idea at the other end of the document.

   The card is fixed to the bottom-right of the VIEWPORT, so on a phone it
   opens sitting on top of the masthead. Measured on /m/56SL at first paint,
   scroll 0: at 390 it covered MISSION FILE, SHOT.SPACE/M56SL, HANDLING and
   ROUTINE; at 320 it covered the live stage readout and the first pass time.
   Two separate agents reported it independently.

   The foot rule already says the card must not sit over the file's own
   controls. The head of the file is the same claim: the masthead IS the
   identity of the mission, and a floating entry card is worth less than the
   thing it is an entry to. So the card does not appear until the reader has
   started reading — one viewport of scroll, which is past the masthead at
   every width and is also the point at which an entry card starts being
   useful rather than premature.

   Deliberately a scroll distance, not an IntersectionObserver on the
   masthead: this component does not own the masthead and must not go looking
   for it in the DOM. It is mounted on the shared view too, where the header
   is a different component. "How far has the reader come" needs no agreement
   with anyone.
*/
const HEAD_CLEARANCE = 0.9;

export interface BriefEntryCardProps {
  mission: MissionDTO;
  /** Ownership, passed straight to the deck. `shared` sees no private field. */
  variant?: 'owner' | 'shared';
  className?: string;
}

export function BriefEntryCard({ mission, variant = 'owner', className }: BriefEntryCardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const miniRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [retreat, setRetreat] = useState(false);

  /* Focus returns to the card when the deck closes, per §D. The deck hands
     focus back to whatever held it when it opened, which is one of these two
     buttons in every normal case; this is the belt to that braces, and it is
     what makes the guarantee a property of the TRIGGER rather than of the
     dialog — the one element that is certain to still be mounted afterwards.
     `preventScroll` because the page behind never moved. */
  const close = useCallback(() => setOpen(false), []);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) {
      const target = minimised ? miniRef.current : buttonRef.current;
      target?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open, minimised]);

  /* THE STAND-DOWN. Read on scroll and on resize, coalesced to one read per
     frame, and never applied while the card holds focus — see obligation 1
     in the note above. It is a plain scroll listener rather than an
     IntersectionObserver on the footer because this component does not own
     the footer and must not go looking for it in the DOM: "how much document
     is left" is a fact about the page that needs no agreement with anyone. */
  useEffect(() => {
    let frame = 0;

    const read = () => {
      frame = 0;
      /* NEVER MOVE OUT FROM UNDER A KEYBOARD USER. The test is
         `:focus-visible`, not `contains(activeElement)`: a mouse user who
         opens and closes the deck leaves focus sitting on this button for
         the rest of the session, and a plain containment test would freeze
         the card on screen for good — it would never stand down again, over
         the footer or anywhere else. `:focus-visible` is exactly the
         distinction wanted: the ring is showing, so something is going to
         move under someone's eyes. */
      const root = rootRef.current;
      const active = document.activeElement;
      if (root && active instanceof HTMLElement && root.contains(active)) {
        try {
          if (active.matches(':focus-visible')) return;
        } catch {
          /* :focus-visible is universally supported now; if it ever is not,
             the safe answer is to carry on and let the card stand down. */
        }
      }
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      /* A page with nothing much to scroll is a page whose top IS its foot,
         and standing the card down there would mean it never appeared at
         all — which is worse than a card near a control. On a short page it
         stays, and the minimise control is the reader's way out of it. */
      if (scrollable <= FOOT_CLEARANCE) {
        setRetreat(false);
        return;
      }
      const left = scrollable - window.scrollY;
      const beforeHead = window.scrollY < window.innerHeight * HEAD_CLEARANCE;
      setRetreat(beforeHead || left < FOOT_CLEARANCE);
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    // Focus moving in or out changes the answer above, and neither fires a
    // scroll — without these a card held on screen by a focus ring would
    // stay there after the ring left.
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
    };
  }, []);

  /* The deck is mounted only while open, so its own focus trap, scroll lock
     and card state have exactly the dialog's lifetime — and so the six cards
     are not built on every poll of a closed file. `variant` travels through
     unchanged: the deck reads the same DTO this page was given, so a
     share-link viewer's deck is built from a record that never held the
     private block. It is rendered outside the retreat wrapper because a
     `inert` ancestor would disable the dialog with it — and the dialog is a
     portal to <body> in any case. */
  const deck = open ? (
    <BriefDeck open onClose={close} code={mission.code} cards={briefCards(mission, variant)} />
  ) : null;

  if (minimised) {
    return (
      <>
        <div
          ref={rootRef}
          className={`${styles.entry} ${className ?? ''}`}
          data-retreat={retreat || undefined}
          inert={retreat || undefined}
        >
          <button
            ref={miniRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            /* The visible words are inside the accessible name, so WCAG
               2.5.3 holds, and the code is what tells two open files apart
               in a screen reader's list of controls. */
            aria-label={`Open the mission brief for ${mission.code}`}
            className={styles.mini}
          >
            Mission brief
            <span aria-hidden className="inline-flex">
              <ButtonArrow />
            </span>
          </button>
        </div>
        {deck}
      </>
    );
  }

  return (
    <>
      <div
        ref={rootRef}
        className={`${styles.entry} ${className ?? ''}`}
        data-retreat={retreat || undefined}
        inert={retreat || undefined}
      >
        <div className={`group ${styles.card3d}`}>
          {/* THE PRESS TARGET. Stretched under the whole card, which is drawn
              pointer-transparent above it. The name repeats the card's own
              visible label so WCAG 2.5.3 holds, and adds the mission code,
              which is what tells two open files apart in a reader's list. */}
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={styles.hit}
          >
            <span className="sr-only">Open the mission brief for {mission.code}</span>
          </button>

          <div className={styles.draw}>
            <VideoPlate
              {...CLIP}
              aspect={ASPECT}
              rounded={false}
              // No strokes. VideoPlate bounds its frame with a hairline and
              // strengthens it on hover; both are dropped here.
              className="[&>div]:border-0"
            />

            <div aria-hidden className={styles.scrim} />

            <div className={styles.plateText}>
              {/* The one line of telemetry the card carries, and it is the
                  file reference rather than a card count: the code is a fact
                  the record already holds, it is the thing that tells two
                  open files apart, and it cannot fall out of step with the
                  deck the way a hard-typed `06 CARDS` could. */}
              <p data-telemetry className={styles.plateTele}>
                Mission {mission.code}
              </p>
              <p className={styles.plateTitle}>
                <span className={styles.plateLine}>Mission</span>
                <span className={styles.plateLine}>
                  Brief
                  <span aria-hidden className={styles.plateArrow}>
                    <ButtonArrow />
                  </span>
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMinimised(true)}
            className={styles.minimise}
            aria-label="Minimise the mission brief card"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>
      </div>
      {deck}
    </>
  );
}
