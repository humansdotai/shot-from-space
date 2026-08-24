'use client';

import { PanelGroup } from './Panel';
import { CardGroup, type CardOption } from './CardGroup';

/**
 * WHO IS IT FOR (was screen 3, now a group inside the Mission section).
 *
 * The one answer in this section that changes the order. A gift adds a
 * gift-note field inside checkout and a printable commission certificate
 * on the confirmation; it changes nothing about the capture.
 *
 * It is the section's REQUIRED answer — `sectionAnswered('mission', …)`
 * reads it — because it is the only one here with no defensible default:
 * guessing that a print is for the buyer, and quietly dropping the gift
 * note and the certificate, is a guess that shows up in someone's post.
 */
const OPTIONS: readonly CardOption<'self' | 'gift'>[] = [
  { value: 'self', label: 'Myself' },
  { value: 'gift', label: 'A gift', note: 'Adds a note at checkout and a commission certificate you can print.' },
];

export function WhoGroup({
  gift,
  onSelect,
}: {
  gift: boolean | null;
  onSelect: (gift: boolean) => void;
}) {
  return (
    <PanelGroup label="Who is it for?">
      <CardGroup
        label="Who is it for?"
        options={OPTIONS}
        value={gift === null ? null : gift ? 'gift' : 'self'}
        onSelect={(v) => onSelect(v === 'gift')}
        columns={2}
      />
    </PanelGroup>
  );
}
