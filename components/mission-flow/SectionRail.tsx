'use client';

import { useEffect, useRef } from 'react';
import { clsx as cn } from 'clsx';
import { IconLock } from '@/components/fui/icons';
import { INK, INK_DIM, RULE } from '@/components/purchase/fields';
import {
  TAB_SECTIONS,
  sectionAnswered,
  sectionEnabled,
  type SectionId,
} from '@/lib/mission-flow/steps';
import type { MissionDraft } from '@/lib/mission-flow/state';

/**
 * THE SECTION RAIL — mission phases, not tabs on a form.
 *
 * ==================================================================
 * WHAT IT HAS TO SAY
 * ==================================================================
 * Two things at once, and the old rail only said one of them: WHICH
 * phase is open, and HOW FAR the mission has got. A row of words with
 * an underline under one of them says the first and nothing about the
 * second, which is why it read as tabs on a form.
 *
 * So each phase is a segment of one continuous track:
 *
 *      01 ─────────   02 ─────────   03 ─────────
 *      TARGET         FRAMING        MISSION
 *
 * The TRACK is the state, and it is the only thing that is coloured:
 *
 *   full ink       the phase that is open
 *   accent         a phase that is SETTLED
 *   hairline       a phase that is open to go to but not settled
 *   nothing        a phase that is not reachable yet
 *
 * and the open phase additionally takes a full-ink rule under it, so
 * the current position is marked twice — above and below — and never
 * by colour alone. Nothing is ticked and nothing is tinted.
 *
 * THE ONE MARK ON THE RAIL is a padlock on a phase that cannot be
 * opened yet, and it is here because the rule above was being broken:
 * `locked` and `open but not settled` differed ONLY in the hue of a
 * one-pixel track, which is state carried by colour alone. A locked tab
 * now says so with a shape. It is 12px so the row does not grow — the
 * label line beside it is already 12.6px — because every pixel of rail
 * is a pixel taken off the only scrolling region on a phone.
 *
 * SETTLED still gets no mark. A tick would be a second state mark, and
 * two state marks is a set of them; the accent track and the visually
 * hidden word already say it and the paragraph above commits to it.
 *
 * SETTLED means one of two things, and never a third: a decision was
 * recorded (`sectionAnswered`), or the phase arrived pre-set and the
 * buyer has opened it (`visited`). A default nobody has looked at is
 * not marked, because marking it would tell the buyer they had chosen
 * something they have not seen.
 *
 * ==================================================================
 * WHY THE SEGMENTS ARE `grow shrink-0` AND NOT `flex-1`
 * ==================================================================
 * `flex-1` is `flex: 1 1 0%` — every segment the same width regardless
 * of its label, which at a 518px panel gives each of the six 86px and
 * clips `FRAMING` to `FRAMI…`. A phase whose name does not fit is not
 * a phase, it is a stub.
 *
 * `grow shrink-0` sizes each segment to its own label first and then
 * spreads whatever is left over, so the strip fills the rail at every
 * width where it fits and overflows its own box where it does not —
 * every phone. Sideways scrolling inside a rail is the one place it is
 * correct, and is why the a11y overflow check exempts an
 * `overflow-x: auto` element.
 *
 * ==================================================================
 * ARIA
 * ==================================================================
 * A real `role="tablist"`: one tab stop for the whole rail, arrow keys
 * move between phases, Home and End jump to the ends, and the open
 * phase is the tab stop. Each tab points at its panel with
 * `aria-controls`. The state a sighted reader takes from the track is
 * given to everyone else as a visually hidden word on the tab.
 */
export function SectionRail({
  active,
  draft,
  visited,
  onSelect,
}: {
  active: SectionId;
  draft: MissionDraft;
  /** Sections that have been opened. See the note on the mark, above. */
  visited: readonly SectionId[];
  onSelect: (id: SectionId) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const scroller = useRef<HTMLDivElement | null>(null);

  // Keep the open phase in view when the flow moves the buyer itself — a
  // `Continue` that advances to a phase scrolled off the end of the rail
  // would otherwise leave the rail showing the wrong place.
  useEffect(() => {
    const i = TAB_SECTIONS.findIndex((s) => s.id === active);
    refs.current[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  const enabledIndexes = TAB_SECTIONS.map((s, i) => (sectionEnabled(s.id, draft) ? i : -1)).filter(
    (i) => i >= 0,
  );

  const move = (from: number, delta: number) => {
    if (enabledIndexes.length === 0) return;
    const at = enabledIndexes.indexOf(from);
    const next =
      enabledIndexes[
        ((((at === -1 ? 0 : at) + delta) % enabledIndexes.length) + enabledIndexes.length) %
          enabledIndexes.length
      ];
    refs.current[next]?.focus();
  };

  return (
    <div
      ref={scroller}
      className={cn('w-full overflow-x-auto border-b', RULE)}
      // A rail that scrolls sideways must not also rubber-band the page
      // it sits in.
      style={{ overscrollBehaviorX: 'contain' }}
    >
      <div
        role="tablist"
        aria-label="Mission phases"
        aria-orientation="horizontal"
        className="flex min-w-full"
      >
        {TAB_SECTIONS.map((section, i) => {
          const selected = section.id === active;
          const open = sectionEnabled(section.id, draft);
          // A default is not a decision, so `sectionAnswered` is false for
          // the two sections that arrive pre-set. Opening one settles it.
          const answered = sectionAnswered(section.id, draft) || visited.includes(section.id);

          const track = selected
            ? 'bg-[color:var(--ink)]'
            : answered
              ? 'bg-[color:var(--accent)]'
              : open
                ? 'bg-[color:var(--rule-strong)]'
                : 'bg-[color:var(--rule)]';

          const state = selected ? ', current phase' : answered ? ', set' : open ? '' : ', locked';

          return (
            <button
              key={section.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`section-tab-${section.id}`}
              /* ONLY WHEN THE PANEL IS ACTUALLY IN THE DOCUMENT.
                 <MissionFlow /> mounts a section the first time it is
                 opened and not before — which is what keeps the pass
                 search off a cold arrival — so on a fresh page four of
                 these six tabs pointed `aria-controls` at an id nothing
                 has. A dangling IDREF is not a weaker association, it is
                 no association: a screen reader is told the tab controls
                 something and then cannot find it. `visited` is exactly
                 the set that exists. */
              aria-controls={
                visited.includes(section.id) ? `section-panel-${section.id}` : undefined
              }
              aria-selected={selected}
              aria-disabled={open ? undefined : true}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                if (open) onSelect(section.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  move(i, 1);
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  move(i, -1);
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  refs.current[enabledIndexes[0] ?? 0]?.focus();
                } else if (e.key === 'End') {
                  e.preventDefault();
                  refs.current[enabledIndexes[enabledIndexes.length - 1] ?? 0]?.focus();
                }
              }}
              className={cn(
                // 44px is the tap-target floor and the rail sits on it
                // under 380px, where every pixel of rail is a pixel the
                // scroller does not have. From 380 up it takes the 48px
                // the rest of the chrome is built on. See <PanelFoot />
                // for the arithmetic.
                'group relative flex min-h-12 min-w-[4.5rem] shrink-0 grow flex-col',
                'items-stretch justify-center gap-1.5 px-3 py-2.5 text-left transition-house',
                'max-[379px]:min-h-11 max-[379px]:gap-1 max-[379px]:py-1.5 sm:px-3.5',
                // HOVER. The wash alone was a 5% change on a black ground —
              // invisible on most screens, which on a strip of six words
              // is the difference between a rail that looks like tabs and
              // one that looks like a caption. The label and the index go
              // to full ink with it, so the phase under the pointer reads
              // as the pressable thing it is.
              open
                  ? cn(
                      'hover:bg-[color:color-mix(in_srgb,var(--ink)_8%,transparent)]',
                      '[&:hover_[data-rail-text]]:text-[color:var(--ink)]',
                    )
                  : 'cursor-not-allowed',
              )}
            >
              {/* The phase index and its stretch of the track. */}
              <span className="flex items-center gap-2">
                <span
                  data-telemetry
                  data-rail-text
                  className={cn(
                    'font-mono text-tele-xs uppercase tabular-nums transition-house',
                    selected ? INK : open ? INK_DIM : 'text-[color:var(--ink-faint)]',
                  )}
                >
                  {String(section.index).padStart(2, '0')}
                </span>
                <span aria-hidden className={cn('h-px min-w-2 flex-1 transition-house', track)} />
                {/* The state, as a shape. `aria-hidden` because the tab
                    already carries `aria-disabled` and the word `locked`
                    in its visually hidden state string. */}
                {!open ? (
                  <span aria-hidden className="shrink-0 text-[color:var(--ink-faint)]">
                    <IconLock size={12} />
                  </span>
                ) : null}
              </span>

              <span
                data-rail-text
                className={cn(
                  'block whitespace-nowrap text-label uppercase transition-house',
                  selected ? INK : open ? INK_DIM : 'text-[color:var(--ink-faint)]',
                )}
              >
                {section.label}
                <span className="sr-only">{state}</span>
              </span>

              {/* The open phase is marked below as well as above, so the
                  current position never depends on hue alone. */}
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-0 bottom-0 h-px transition-house',
                  selected ? 'bg-[color:var(--ink)]' : 'bg-transparent',
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The rail's replacement once the mission is paid for. The configurator
 * is closed at that point — every tab clamps forward to the confirmation
 * (see `furthestLegalSection`), so showing six of them that all lead to
 * the same place would be a lie told six times.
 *
 * It keeps the rail's own anatomy — a label and a track — so the strip
 * does not change shape under the buyer at the moment they pay.
 */
export function ClosedRail({ missionCode }: { missionCode: string }) {
  return (
    <div className={cn('flex min-h-12 w-full items-center gap-3 border-b px-5 max-[379px]:min-h-11 xl:px-8', RULE)}>
      <span className={cn('shrink-0 font-mono text-tele-s uppercase', INK_DIM)}>Commissioned</span>
      <span aria-hidden className="h-px min-w-2 flex-1 bg-[color:var(--accent)]" />
      <span
        data-telemetry
        className={cn('shrink-0 font-mono text-tele uppercase tabular-nums', INK)}
      >
        {missionCode.toUpperCase()}
      </span>
    </div>
  );
}
