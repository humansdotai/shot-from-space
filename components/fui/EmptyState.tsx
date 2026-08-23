import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CropMarks } from './CropMarks';

/**
 * Nothing on file. A designed empty state, written in mission voice: state
 * what is absent and what the next action is. Never an illustration, never an
 * apology, never an exclamation mark.
 */
export function EmptyState({
  title,
  detail,
  action,
  className,
}: {
  /** Short, declarative, all caps by convention: `NO MISSIONS ON FILE`. */
  title: string;
  /** One or two sentences in sans. What happened and what happens next. */
  detail: ReactNode;
  /** Usually an <ActionButton />. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-start gap-4 border border-hairline bg-deck/30 px-4 py-10 sm:px-8 sm:py-14',
        className,
      )}
    >
      <CropMarks length={12} inset={-1} />
      <span className="font-mono text-[0.625rem] uppercase leading-none tracking-[0.16em] text-paper-faint">
        NO RECORD
      </span>
      <h2 className="font-mono text-[0.9375rem] uppercase leading-[1.3] tracking-[0.1em] text-paper sm:text-base">
        {title}
      </h2>
      <p className="max-w-[52ch] text-body text-paper-dim">{detail}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
