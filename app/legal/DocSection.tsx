import type { ReactNode } from 'react';

/**
 * One numbered clause of a legal document: a label-role number, a heading and
 * the paragraphs beneath it set in the long-form reading role.
 *
 * `text-prose` exists for exactly this — multi-paragraph documents. Everywhere
 * else on the site copy is set at `text-body` in short blocks.
 */
export function DocSection({
  index,
  heading,
  children,
}: {
  index: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-hairline pt-6">
      <p className="text-label uppercase text-paper-faint">{index}</p>
      <h2 className="mt-4 max-w-[26ch] text-heading text-paper">{heading}</h2>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** A paragraph of document copy. */
export function DocParagraph({ children }: { children: ReactNode }) {
  return <p className="max-w-[68ch] text-prose text-paper-dim">{children}</p>;
}
