'use client';

/* ==================================================================
   THE CARD API — read this first if you are writing card content.
   ==================================================================

   <BriefDeck /> takes an ORDERED ARRAY, not children:

     <BriefDeck
       open={open}
       onClose={() => setOpen(false)}
       code={mission.code}
       cards={[
         { id: 'target',     title: 'Where we are looking', eyebrow: 'TARGET',
           content: <TargetCard mission={mission} /> },
         { id: 'pass',       title: 'The pass',             content: <PassCard … /> },
         …
       ]}
     />

   Each entry is a `BriefCard`:

     id       string     stable, unique, kebab-case. Used for the card's
                         heading id and as its React key. It must not
                         change between renders of the same card.
     title    string     the card's subject, in sentence case. THE DECK
                         RENDERS THIS as the card's <h3> — do not render
                         a heading of your own inside `content`, or the
                         card gets two.
     eyebrow  string?    optional kicker above the title. Uppercase
                         monospace, one or two words. Omit it rather
                         than repeating the title.
     size     'wide'?    a card that genuinely carries more content may
                         be a wider sheet than the rest of the stack.
                         See THE ODD CARD OUT below — it is a fact about
                         the content, not a way to make a card louder.
     content  ReactNode  the card's body. Anything.

   WHY AN ARRAY AND NOT `children`
   The deck has to know the count for the `03 / 06` readout, and the
   title for each card's accessible name and its live announcement.
   Getting either out of `children` means reading props off opaque
   elements, which breaks the moment a card is wrapped in anything. An
   array is typed, and the compiler tells you when a card is malformed.

   THE ODD CARD OUT
   `size: 'wide'` widens ONE sheet in the stack. It exists for card 04,
   which is the only card whose honest form is two parallel lists —
   what the ground sample distance resolves and what it does not — and
   two lists at the narrow measure become one long column at every
   width, which puts the second list below the fold and makes the
   less-flattering half the half nobody reads. The wide sheet lets the
   two stand side by side from 768 up.

   It is a SIZE, not an emphasis. A stack whose cards are all different
   widths is not a stack, it is a pile; if a second card wants this,
   the question to answer first is why its content does not fit the
   measure the other five are read at.

   WHAT THE DECK GIVES YOUR CONTENT
   The card carries `.surface-light`, so inside `content` the ground
   contract is already inverted: `--ground` is paper, `--ink`,
   `--ink-dim`, `--ink-faint` are void, and `--rule`, `--accent` and
   `--focus-ring` are the on-paper variants. Write `ink` / `ink-dim` /
   `rule-ground` and every FUI primitive renders correctly on the card
   with no `tone` prop. Do not hard-code `text-paper` — it is invisible
   here.

   WHAT YOUR CONTENT MUST NOT DO
   · No <h1>/<h2> — the deck owns the heading levels (h2 dialog title,
     h3 card title). Sub-headings inside a card start at <h4>.
   · No `--radius-deck` on anything inside a card. The token is the
     card's silhouette and nothing else's; see app/globals.css.
   · No `position: fixed` and no horizontal overflow. The card body is
     the scroll container and it scrolls vertically only.
   ================================================================== */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/fui';
import { bindCardTilt } from './tilt';
import { useDeck } from './useDeck';
import styles from './brief.module.css';

export interface BriefCard {
  /** Stable, unique, kebab-case. Used for the heading id and the key. */
  id: string;
  /** The card's subject, sentence case. Rendered by the deck as its <h3>. */
  title: string;
  /** Optional uppercase kicker above the title. One or two words. */
  eyebrow?: string;
  /** A sheet that carries more than the measure holds. See the note above. */
  size?: 'default' | 'wide';
  /** The card body. */
  content: ReactNode;
}

export interface BriefDeckProps {
  open: boolean;
  /** Called on Escape and on the close control. There is no backdrop
   *  press — see the note above the render in DeckDialog. */
  onClose: () => void;
  cards: BriefCard[];
  /** Dialog heading. Defaults to the product's name for this surface. */
  label?: string;
  /** Mission code, shown beside the heading and on every sheet. */
  code?: string;
  /** Card to open on. Clamped, never wrapped. */
  initialIndex?: number;
}

/**
 * THE MISSION BRIEF DECK — a stack of white cards on a black ground.
 *
 * BRIEF-DECK.md §B, §D, §E. This file is the shell: the dialog, the
 * chrome, the controls and the accessibility contract. The index is in
 * ./useDeck.ts, the tilt is in ./tilt.ts and the look is in
 * ./brief.module.css, all of which carry their own reasoning at the top.
 *
 * ==================================================================
 * IT IS A STACK, NOT A TRACK
 * ==================================================================
 * The six cards are laid on top of one another in one grid cell, the next
 * two peeking out from under the top one, and advancing SHUFFLES the top
 * card away to the left to uncover the one beneath it. Back deals it back.
 *
 * That is a different object from the horizontal track this used to be, and
 * the difference is the whole redesign: a track is a filmstrip you scrub and
 * it wants a thumb on it; a stack is a physical deck you deal, and it does
 * not. The swipe gesture is gone — all ~200 lines of it — and Next, Back,
 * the arrow keys and Escape are the whole interaction, exactly as §D always
 * required them to be.
 *
 * THE TOP CARD TURNS TOWARD THE POINTER. That is the product's existing tilt
 * — the same just-overdamped springs, the same constants, the same
 * reduced-motion and coarse-pointer discipline — reused from
 * `components/artifact/Artifact3D.tsx` via ./tilt.ts. Only the top card ever
 * binds it; the ones underneath are inert sheets.
 *
 * ==================================================================
 * ACCESSIBILITY — every card is a paragraph of one document
 * ==================================================================
 * A carousel that exists only as a stack is unusable with a screen reader,
 * and the usual "fixes" are both worse than the disease:
 *
 *   · `inert` / `aria-hidden` on the buried cards makes the deck a
 *     six-page document of which five pages do not exist. A reader who
 *     cannot see the Next control is trapped on card one with no way to
 *     learn there are five more. This is the failure §D names by hand.
 *   · a second, visually-hidden linear copy of the content doubles the
 *     surface that can go stale, and the copy is always the one that does.
 *
 * WHAT THIS DOES INSTEAD. All six cards are in the DOM, in order, at all
 * times, and NOT ONE of them is hidden from assistive technology. A card
 * that has been dealt away is at `opacity: 0` — which removes it from view
 * without removing it from the accessibility tree, exactly as the old
 * track's `overflow: hidden` did — so a screen reader's virtual cursor
 * walks card 1 through card 6 as one continuous document, headings and
 * all, and Tab moves through every control in every card in reading order.
 * There is no trap because there is no boundary.
 *
 * The price of that is the classic off-screen-focus bug: Tab could land on
 * a control inside a card that is not on top. `onFocusCapture` in useDeck.ts
 * pays it — focus entering card i deals the stack to card i, so the deck
 * follows the reader. A sighted keyboard user and a screen reader user are
 * looking at the same card, always.
 *
 * Only the top card takes pointer events. That is not a hack around the
 * overlap, it is the same statement the stack is already making: you cannot
 * touch a card that is underneath another one. Keyboard and assistive
 * activation are unaffected — neither goes through hit testing.
 *
 * The chrome is honest about the structure rather than mimicking it: each
 * card is a `role="group"` named "Card 3 of 6, Conditions", the region is an
 * `aria-roledescription="card deck"`, and an `aria-live` line announces the
 * move when it came from a control or a key — the cases where nothing else
 * would have spoken.
 *
 * ==================================================================
 * WHY A PORTAL
 * ==================================================================
 * The trigger — the brief entry card — is `position: fixed` and lifts on
 * hover, i.e. it has a `transform`, and a `position: fixed` overlay inside a
 * transformed ancestor is positioned against that ancestor rather than the
 * viewport. The portal makes the deck immune to whatever the entry card does
 * to itself, and to wherever on the page it is mounted.
 *
 * Everything else follows <VoiceLinkDialog> exactly: role="dialog",
 * aria-modal, focus moved in on open, Tab trapped inside, Escape closes,
 * body scroll locked, focus restored to the trigger on close.
 */
export function BriefDeck({
  open,
  onClose,
  cards,
  label = 'Mission brief',
  code,
  initialIndex = 0,
}: BriefDeckProps) {
  // The dialog is mounted only while open, so its effects' lifetimes are the
  // open lifetime: the focus trap installs on open and — critically — the
  // focus RESTORE runs on close and nowhere else. `key` resets the index for
  // a second opening.
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  if (!open || !portalTarget || cards.length === 0) return null;

  return createPortal(
    <DeckDialog
      onClose={onClose}
      cards={cards}
      label={label}
      code={code}
      initialIndex={initialIndex}
    />,
    portalTarget,
  );
}

/* ------------------------------------------------------------------ */
/* The dialog                                                         */
/* ------------------------------------------------------------------ */

function DeckDialog({
  onClose,
  cards,
  label,
  code,
  initialIndex,
}: Omit<BriefDeckProps, 'open'> & { label: string; initialIndex: number }) {
  const deck = useDeck(cards.length, initialIndex);
  const { index, count, canPrev, canNext, next, prev } = deck;

  const panelRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const titleId = `${uid}-title`;

  // The deck re-renders on every index change and `onClose` is a fresh
  // closure from the parent each time. Holding it in a ref lets the focus
  // trap below install exactly once — otherwise its cleanup would fire on
  // every render and hand focus back to the trigger mid-read. Straight from
  // <VoiceLinkDialog>, for the same reason.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const arrowRef = useRef(deck.handleArrowKey);
  arrowRef.current = deck.handleArrowKey;

  /* --- Dialog behaviour -------------------------------------------- */

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('[data-autofocus]')?.focus();

    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (arrowRef.current(e)) return;
      if (e.key !== 'Tab') return;

      // NOTE ON THE TRAP AND THE BURIED CARDS. `focusables()` returns
      // controls in EVERY card, not only the top one — a card that has been
      // dealt away is transparent, not hidden, so `offsetParent` is non-null
      // and it stays in the list. That is intended: the trap's first and last
      // are the first control of card one and the last control of card six,
      // so Tab walks the whole deck exactly as the linear-document contract
      // above promises, and only wraps at the true ends.
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panel?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  /* --- Announcement ------------------------------------------------- */

  /**
   * ONE announcement, from one place, with one rule.
   *
   * A move made with Next or an arrow changes what is on screen and nothing
   * speaks — so it has to be announced. A move made by Tab or by a virtual
   * cursor entering a card ALREADY speaks: the focused element announces
   * itself and the card's group label goes with it. Announcing that too would
   * double every keyboard step.
   *
   * The two cases are told apart by where focus is once the index has
   * changed: if it is already inside the card that just came to the top, the
   * card came to the top BECAUSE focus went there (see `onFocusCapture` in
   * useDeck.ts) and the reader has heard it. Otherwise, speak.
   */
  const [announcement, setAnnouncement] = useState('');
  const announcedRef = useRef(index);

  useEffect(() => {
    if (announcedRef.current === index) return;
    announcedRef.current = index;
    const card = cards[index];
    if (!card) return;

    const active = document.activeElement as HTMLElement | null;
    const inCard =
      active?.closest<HTMLElement>('[data-slide-index]')?.dataset.slideIndex === String(index);
    if (inCard) return;

    setAnnouncement(`Card ${index + 1} of ${cards.length}. ${card.title}`);
  }, [index, cards]);

  /* --- Render -------------------------------------------------------- */

  /* NO BACKDROP-CLOSE, and it is not an oversight. There is no backdrop:
     the deck IS the ground, edge to edge, and the black around the stack is
     the table the cards are dealt on. Closing on a press there would make a
     mis-aimed press at the edge of a card a dismissal. The exits are Escape
     and the close control: both always available, neither reachable by a
     press that was aimed at something else. */

  return (
    <div className={styles.overlay}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${styles.panel} surface-dark`}
      >
        {/* Header — name · file reference … position · close.

            The position readout moved up here from the footer, which is what
            leaves the footer as two controls and air. A folio belongs at the
            head of a sheet, beside the reference it is a folio OF. */}
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            <span>{label}</span>
            {code ? (
              <span className={styles.code} data-telemetry>
                {code}
              </span>
            ) : null}
          </h2>

          <div className={styles.headerEnd}>
            {/* The visible readout is decorative to AT — "03 / 06" read aloud
                is "three slash six". The live region in the footer carries
                the sentence a reader actually wants. */}
            <p className={styles.readout} aria-hidden>
              <span className={styles.readoutIndex}>{pad(index + 1)}</span>
              {' / '}
              {pad(count)}
            </p>
            <button
              type="button"
              className={styles.close}
              onClick={() => closeRef.current()}
              aria-label="Close the mission brief"
            >
              <span aria-hidden>✕</span>
            </button>
          </div>
        </div>

        {/* The stack */}
        <div
          data-autofocus
          tabIndex={0}
          role="group"
          aria-roledescription="card deck"
          aria-label={`${label}, ${count} cards. Use the left and right arrow keys, or the Back and Next controls.`}
          className={styles.stack}
          {...deck.stackProps}
        >
          {cards.map((card, i) => (
            <Slide key={card.id} card={card} i={i} count={count} index={index} code={code} />
          ))}
        </div>

        {/* Footer — Back · Next. Two controls and the air between them. */}
        <div className={styles.footer}>
          <Button
            variant="secondary"
            size="md"
            className={styles.control}
            disabled={!canPrev}
            onClick={prev}
          >
            Back
          </Button>

          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>

          <Button
            variant="primary"
            size="md"
            className={styles.control}
            disabled={!canNext}
            onClick={next}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A card in the stack                                                */
/* ------------------------------------------------------------------ */

/** How many cards peek out from under the top one. Three sheets of paper is
 *  a stack; six is a ream, and the sliver each one adds past the third is
 *  under a pixel of information for a real compositor layer. */
const PEEK = 2;

/** The sliver, in px, each buried card shows below the one above it, and how
 *  much smaller it is drawn. Both are multiplied by depth. */
const PEEK_STEP_PX = 34;
const PEEK_SCALE_STEP = 0.035;

function Slide({
  card,
  i,
  count,
  index,
  code,
}: {
  card: BriefCard;
  i: number;
  count: number;
  index: number;
  code?: string;
}) {
  const headingId = `brief-card-${card.id}`;
  const posId = `${headingId}-pos`;

  const stageRef = useRef<HTMLDivElement>(null);
  const active = i === index;

  /* THE TILT, on the top card only. Binding it per-slide rather than once on
     the stack is what keeps exactly one pointermove listener alive at a time
     and keeps the measured rect the rect of the card being turned. ./tilt.ts
     binds nothing at all under reduced motion or on a coarse pointer, so on
     a phone this effect installs and removes a no-op. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !active) return;
    return bindCardTilt(stage, styles.tilting);
  }, [active]);

  /* DEPTH — how far this sheet is from the top of the stack.
     Negative means it has already been dealt away. The stylesheet reads the
     five channels below and nothing else; a change of index is therefore a
     change of custom properties, which the house transition interpolates on
     the compositor with no JavaScript in the loop. */
  const depth = i - index;
  const gone = depth < 0;
  const buried = Math.min(Math.max(depth, 0), PEEK);

  const style: React.CSSProperties & Record<string, string | number> = {
    // Dealt away: off to the left, turned a little, fading. It is the card
    // being taken OFF the top, so it passes over the one it uncovers.
    '--slide-x': gone ? '-14%' : '0%',
    '--slide-y': gone ? '-2%' : `${buried * PEEK_STEP_PX}px`,
    '--slide-rot': gone ? '-3.2deg' : '0deg',
    '--slide-scale': gone ? 1.02 : 1 - buried * PEEK_SCALE_STEP,
    '--slide-op': gone || depth > PEEK ? 0 : 1,
    zIndex: gone ? count + 1 : count - depth,
  };

  return (
    <div
      ref={stageRef}
      className={styles.slide}
      data-slide-index={i}
      data-active={active || undefined}
      data-size={card.size === 'wide' ? 'wide' : undefined}
      data-buried={depth > 0 || undefined}
      style={style}
    >
      {/* THE CAST. A blurred copy of the card's own silhouette, offset and
          counter-moving against the tilt — the construction the artifacts and
          the framed poster use, for the reason stated there: it is a SHAPE,
          so it stays a shape when the object turns. A `box-shadow` cannot
          counter-move and cannot be composited; this can do both. */}
      <div className={styles.castWrap} aria-hidden>
        <div className={styles.cast} />
      </div>

      <section
        role="group"
        aria-roledescription="card"
        // Named by position AND subject, in that order, so a reader always
        // knows where in the set they are before they know what it says.
        aria-labelledby={`${posId} ${headingId}`}
        className={`${styles.card} surface-light`}
      >
        <div className={styles.cardInner}>
          <span id={posId} className="sr-only">{`Card ${i + 1} of ${count}.`}</span>

          {/* THE FOLIO RAIL. A sheet in a record carries its own number and
              the reference of the file it belongs to, at the head, on a rule.
              That is all this is — the page furniture the rest of the file
              already speaks in, at the smallest size the ramp has. It does
              not repeat the header's readout: this is a folio (`03`), that is
              a position in a set (`03 / 06`). */}
          <div className={styles.rail}>
            <span data-telemetry className={styles.railFolio}>
              {pad(i + 1)}
            </span>
            <span aria-hidden className={styles.railRule} />
            {code ? (
              <span data-telemetry className={styles.railRef}>
                {code}
              </span>
            ) : null}
          </div>

          {card.eyebrow ? <p className={styles.eyebrow}>{card.eyebrow}</p> : null}
          <h3 id={headingId} className={styles.cardTitle}>
            {card.title}
          </h3>
          <div className={styles.body}>{card.content}</div>
        </div>
      </section>
    </div>
  );
}

/** `3` -> `03`. Two digits is the floor, not the cap — a 12-card deck
 *  reads `12 / 12` and nothing has to change. */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
