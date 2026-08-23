import type { ReactNode } from 'react';
import { Band, Container } from '@/components/fui';

/**
 * The legal documents share one narrow reading column — <Container
 * size="narrow"> — and one band rhythm: 20px above the file header, 48px below
 * the last clause. Body copy is set in the sans face at the long-form reading
 * role; monospace is reserved for labels and data (CONTRACT.md §2).
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main>
      {/* Clears the absolute site bar, which scrolls with the page.
          `--site-bar-h` is the ONE number the bar publishes for this — 70px to
          1024 and 90px above it. The hard-coded `h-14` that stood here was a
          copy of a 56px bar that no longer exists, so from 1024 up the file's
          first line (`LEGAL FILE 02` / `REVISED …`) rendered underneath the
          plate. Never re-type this height; read the token. */}
      <div aria-hidden className="h-[var(--site-bar-h)]" />
      <Band top="tight" bottom="open">
        <Container size="narrow">
          <article className="flex flex-col gap-10">{children}</article>
        </Container>
      </Band>
    </main>
  );
}
