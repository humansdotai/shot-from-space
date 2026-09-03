'use client';

import { PanelHead, PanelStack } from './Panel';
import { WhyGroup, type WhyAnswer } from './S2Why';
import { WhoGroup } from './S3Who';
import { NameGroup } from './S4Name';

/**
 * SECTION 3 — MISSION (was screens 2, 3 and 4).
 *
 * Three questions that were three full-page screens, and between them
 * they change one field of the order — `gift` — plus the name printed on
 * the sheet. None of them needed a viewport of its own, and giving each
 * one meant three consecutive screens with the primary action below the
 * fold on every one.
 *
 * They are grouped here because they are the same subject: WHOSE mission
 * this is. Each keeps its own question, its own copy and its own honesty
 * notice — `Why this place?` still says on screen that its answer is
 * stored nowhere — and each still fires the `step_completed` event it
 * always fired, at the moment it is answered. See `lib/mission-flow/steps.ts`.
 *
 * ORDER inside the section is the order they were in: the reason, then
 * the recipient, then the name. The name is last because it is the one
 * the preview column echoes, and having just typed it the buyer sees it
 * appear on the print beside them.
 *
 * ------------------------------------------------------------------
 * THE CLIP BETWEEN THE CARDS
 * ------------------------------------------------------------------
 * The owner's second note was that the films should be used "as bits
 * between cards", and his first was that a buyer here does not
 * understand they are commissioning a space mission. Both land on the
 * same seam: the point where the questions stop being about the buyer
 * and start being about the object. So one clip sits there — a camera
 * on station — and it is punctuation, not a screen.
 *
 * It delays nothing (the group under it is already rendered), advances
 * nothing (this component has no state and the clip has no `onEnded`),
 * and plays nothing under `prefers-reduced-motion`. See <PhaseBreak />.
 *
 * `zoom-logo` and `intro` are the only two clips reachable from the
 * panel. `result.mp4` and `orbit.mp4` carry burned-in mission codes and
 * would read here as this buyer's own record.
 */
export function MissionSection({
  why,
  gift,
  missionName,
  onWhy,
  onGift,
  onName,
}: {
  why: WhyAnswer | null;
  gift: boolean | null;
  missionName: string;
  onWhy: (v: WhyAnswer) => void;
  onGift: (v: boolean) => void;
  onName: (v: string) => void;
}) {
  return (
    <PanelStack>
      <PanelHead eyebrow="Phase 03 · Mission" title="Whose mission is this?">
        Name it, and say whether it is a gift.
      </PanelHead>

      <WhyGroup value={why} onSelect={onWhy} />
      <WhoGroup gift={gift} onSelect={onGift} />

      <NameGroup value={missionName} onChange={onName} />
    </PanelStack>
  );
}
