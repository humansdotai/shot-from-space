'use client';

import { PanelGroup } from './Panel';
import { CardGroup, type CardOption } from './CardGroup';

/**
 * WHY THIS PLACE (was screen 2, now a group inside the Mission section).
 *
 * The answer is an ANALYTICS PROPERTY AND NOTHING ELSE. It is not stored
 * in the draft, not sent with the order, not printed on the sheet and not
 * shown back to the reader later. It exists so the owner can learn what
 * this product is actually bought for; it does not exist to personalise
 * anything, and it must never quietly start to.
 *
 * That is also why the group says so. A question whose answer goes
 * nowhere is fine; a question that looks like it configures the order and
 * does not is a small lie repeated on every purchase.
 *
 * It is now the first of three groups on one tab rather than a page of
 * its own, because it is the only question in the flow that changes
 * nothing — and a question that changes nothing does not deserve a whole
 * viewport with the buy button pushed off the bottom of it.
 */
export type WhyAnswer =
  | 'family_home'
  | 'grew_up'
  | 'first_home'
  | 'gift'
  | 'other';

const OPTIONS: readonly CardOption<WhyAnswer>[] = [
  { value: 'family_home', label: 'My family home' },
  { value: 'grew_up', label: 'The house I grew up in' },
  { value: 'first_home', label: 'My first home' },
  { value: 'gift', label: 'A gift' },
  { value: 'other', label: 'Another reason' },
];

export function WhyGroup({
  value,
  onSelect,
}: {
  value: WhyAnswer | null;
  onSelect: (v: WhyAnswer) => void;
}) {
  return (
    <PanelGroup
      label="Why this place?"
      hint="Optional"
      /* The disclosure is the group's own `note`, not a paragraph the
         group happens to contain — it is small print about the control
         above it, which is the role that slot exists for. The claim is
         unchanged and it is still true: see the header of this file. */
      note="Not stored with your order, not sent anywhere, not printed. It stays in this tab."
    >
      <CardGroup label="Why this place?" options={OPTIONS} value={value} onSelect={onSelect} />
    </PanelGroup>
  );
}
