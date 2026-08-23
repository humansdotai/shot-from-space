/**
 * THE MISSION BRIEF — the entry card and the deck it opens.
 *
 * BRIEF-DECK.md. Import from here, never from the individual files: the
 * deck's internals (the gesture hook, the slide, the module stylesheet)
 * are its own business, and a consumer that reaches past this barrel is
 * about to couple to something that is allowed to change.
 *
 * The API for card authors is documented at the top of ./BriefDeck.tsx —
 * an ordered `cards: BriefCard[]`, one subject per entry, with the deck
 * owning the heading and the chrome.
 */

export { BriefEntryCard } from './BriefEntryCard';
export type { BriefEntryCardProps } from './BriefEntryCard';

export { BriefDeck } from './BriefDeck';
export type { BriefCard, BriefDeckProps } from './BriefDeck';
