/**
 * /mission — the sections of the configurator.
 *
 * ------------------------------------------------------------------
 * WHAT CHANGED, AND WHY
 * ------------------------------------------------------------------
 * This was ten sequential full-page screens. On a 1440 × 820 viewport the
 * first of them showed a header, a rail, an eyebrow, a headline, an
 * address and the top of a picture — and no button. The primary action
 * was below the fold on every screen in the sequence.
 *
 * That is a layout-model defect, not a styling one: a WIZARD was built
 * where the category standard is a CONFIGURATOR. So the ten screens are
 * re-housed as SEVEN SECTIONS of one persistent surface — a live preview
 * beside a control panel whose foot carries the price and the primary
 * action at all times. See CONFIGURATOR.md §2.
 *
 * Sections are TABS, not pages. The buyer can go back to an earlier
 * decision without losing the later ones, which a sequence cannot do.
 *
 * ------------------------------------------------------------------
 * TWO VOCABULARIES, ON PURPOSE
 * ------------------------------------------------------------------
 * `SectionId` is where the buyer is — it is in the URL (`?step=`), it
 * names the tab, and it is what `step_viewed` reports.
 *
 * `ScreenId` is the ten original screens. They are kept because they are
 * the ANALYTICS vocabulary: `step_completed` still fires `reveal`, `why`,
 * `who`, `name`, `how`, `configure`, `windows`, `dossier`, `offer` with
 * the same properties they always carried, so a re-housed decision is
 * still the decision it was and a funnel built on those events survives
 * the move. Nothing here invents an event and nothing drops one.
 *
 * THE ANSWERS are not in the URL — they are in localStorage, where a
 * shared link cannot leak them and a reload cannot lose them.
 */

import type { MissionDraft } from './state';

/* ------------------------------------------------------------------ */
/* The two vocabularies                                                */
/* ------------------------------------------------------------------ */

/** Where the buyer is. One tab each. */
export type SectionId =
  | 'target'
  | 'framing'
  | 'mission'
  | 'design'
  | 'window'
  | 'review'
  | 'confirmation';

/**
 * The ten screens this configurator re-houses. Retained as the analytics
 * vocabulary and for nothing else — no component navigates by these.
 */
export type ScreenId =
  | 'reveal'
  | 'why'
  | 'who'
  | 'name'
  | 'how'
  | 'configure'
  | 'windows'
  | 'dossier'
  | 'offer'
  | 'confirmation';

/** What `track()` accepts: a section view, or a screen completion. */
export type StepId = SectionId | ScreenId;

/** Which artefact the preview column shows for a section. */
export type PreviewKind = 'reveal' | 'map' | 'poster' | 'dossier';

export interface Section {
  id: SectionId;
  /** The tab. Two words at most — it is set in the label role. */
  label: string;
  /** As the buyer would count them. Shown on the tab. */
  index: number;
  /** The screens of the old sequence this section re-houses. */
  screens: readonly ScreenId[];
  /**
   * The screens whose `step_completed` event has no moment of its own
   * inside the section — a card tap fires `why`, `who` and `windows`
   * where they are chosen, but `reveal`, `how`, `configure` and `dossier`
   * were completed by pressing the screen's button, and that button is
   * now the panel foot. These fire when the foot advances past them.
   */
  completesOnAdvance: readonly ScreenId[];
  preview: PreviewKind;
}

/**
 * ORDER — progressive disclosure, broadest and most consequential first.
 *
 *   the place → where exactly the frame falls → whose mission it is and
 *   what it is called → what the object is → when it is taken → the money.
 *
 * `confirmation` is not a tab. It is a terminal state: once payment has
 * settled the configurator is closed and only it is reachable.
 */
export const SECTIONS: readonly Section[] = [
  {
    id: 'target',
    label: 'Target',
    index: 1,
    screens: ['reveal'],
    completesOnAdvance: ['reveal'],
    preview: 'reveal',
  },
  {
    id: 'framing',
    label: 'Framing',
    index: 2,
    screens: ['how'],
    completesOnAdvance: ['how'],
    preview: 'map',
  },
  {
    id: 'mission',
    label: 'Mission',
    index: 3,
    screens: ['why', 'who', 'name'],
    completesOnAdvance: ['name'],
    preview: 'poster',
  },
  {
    id: 'design',
    label: 'Design',
    index: 4,
    screens: ['configure'],
    completesOnAdvance: ['configure'],
    preview: 'poster',
  },
  {
    id: 'window',
    label: 'Window',
    index: 5,
    screens: ['windows'],
    completesOnAdvance: [],
    preview: 'poster',
  },
  {
    id: 'review',
    label: 'Review',
    index: 6,
    screens: ['dossier', 'offer'],
    // Both fire at the moment the commission is authorised: the dossier
    // has no decision of its own now that it is the preview artefact.
    completesOnAdvance: ['dossier', 'offer'],
    preview: 'dossier',
  },
  {
    id: 'confirmation',
    label: 'Confirmation',
    index: 7,
    screens: ['confirmation'],
    completesOnAdvance: [],
    preview: 'dossier',
  },
] as const;

/** The tabs. The confirmation is a terminal state, not somewhere to go. */
export const TAB_SECTIONS: readonly Section[] = SECTIONS.filter(
  (s) => s.id !== 'confirmation',
);

const IDS: readonly SectionId[] = SECTIONS.map((s) => s.id);

export function isSectionId(value: unknown): value is SectionId {
  return typeof value === 'string' && (IDS as readonly string[]).includes(value);
}

export function sectionIndex(id: SectionId): number {
  return IDS.indexOf(id);
}

export function sectionById(id: SectionId): Section {
  return SECTIONS[sectionIndex(id)];
}

/* ------------------------------------------------------------------ */
/* What is answered, and what may be opened                            */
/* ------------------------------------------------------------------ */

/**
 * Has a DECISION been recorded for this section?
 *
 * A DEFAULT IS NOT A DECISION. `framing` and `design` both arrive
 * pre-set — the footprint is centred, the print is 50 × 70 unframed —
 * and those defaults are real, priced and already in the preview. But a
 * buyer who has never opened the Design tab has not chosen 50 × 70, and
 * a rail that marked it as answered would be telling them they had.
 * Both therefore answer `false` here and are marked by the rail only
 * once they have actually been opened; see `<SectionRail />`.
 *
 * Used by the rail to mark a tab, by `nextUnanswered` to decide where
 * `Continue` goes, and by the foot to decide whether it can move at all.
 */
export function sectionAnswered(id: SectionId, draft: MissionDraft): boolean {
  switch (id) {
    case 'target':
      return draft.target !== null;
    case 'framing':
    case 'design':
      return false;
    case 'mission':
      return draft.gift !== null && draft.missionName.trim().length >= 3;
    case 'window':
      return draft.window !== null;
    case 'review':
    case 'confirmation':
      return draft.missionCode !== null;
  }
}

/**
 * May the buyer open this tab at all?
 *
 * Only one gate: nothing exists without a target. Everything past it is
 * open in any order, which is the whole point of a configurator — a buyer
 * who wants to see the price of the large format before naming the
 * mission is allowed to.
 */
export function sectionEnabled(id: SectionId, draft: MissionDraft): boolean {
  if (draft.missionCode) return id === 'confirmation';
  if (id === 'confirmation') return false;
  if (id === 'target') return true;
  return draft.target !== null;
}

/**
 * The gates, in both directions.
 *
 *   · Nothing past the target exists without a target.
 *   · The confirmation does not exist without a settled payment.
 *   · And once payment HAS settled the flow is closed: every section
 *     clamps forward to the confirmation. Browser Back from a paid
 *     mission would otherwise land on the review tab with a live pay
 *     button, and pressing it opens a second order and charges again. A
 *     hidden Back control is not a guard; this is.
 *
 * A new target clears the draft (see <MissionFlow />), so commissioning a
 * second mission is unaffected — it is a different mission.
 */
export function furthestLegalSection(id: SectionId, draft: MissionDraft): SectionId {
  if (!draft.target) return 'target';
  if (draft.missionCode) return 'confirmation';
  if (id === 'confirmation') return 'review';
  return id;
}

/**
 * The next tab the buyer has not answered, or the last one. This is where
 * the panel foot's primary action goes when the current section is done —
 * so `Continue` means "the next thing that still needs me", not "the next
 * index", and a buyer who jumped back to change the size is returned to
 * the money rather than walked through everything again.
 */
export function nextUnanswered(
  from: SectionId,
  draft: MissionDraft,
  /** Sections the buyer has already opened. A default that has been LOOKED
   *  at is settled; one that has not is the next thing to show them. */
  seen: readonly SectionId[] = [],
): SectionId {
  const start = sectionIndex(from);
  for (let i = start + 1; i < IDS.length; i += 1) {
    const id = IDS[i];
    if (id === 'confirmation') break;
    if (!sectionAnswered(id, draft) && !seen.includes(id)) return id;
  }
  // Everything after this one is settled: go to the money.
  return 'review';
}
