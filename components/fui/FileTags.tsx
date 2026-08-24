import { cn } from '@/lib/utils';

/**
 * File tags: `16:9 · JPEG · ORIGINAL · DECLASSIFIED`.
 * Separated by hairline dividers, never by punctuation.
 */
export function FileTags({ tags, className }: { tags: string[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center', className)}>
      {tags.map((t, i) => (
        <span key={t + i} className="flex items-center">
          {i > 0 ? <span aria-hidden className="mx-2 h-3 w-px bg-hairline" /> : null}
          <span className="font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-paper-faint">
            {t}
          </span>
        </span>
      ))}
    </div>
  );
}
