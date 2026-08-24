import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type TelemetryTone = 'dim' | 'bright' | 'faint' | 'signal';
export type TelemetrySize = 'sm' | 'xs';

const TONE: Record<TelemetryTone, string> = {
  faint: 'text-paper-faint',
  dim: 'text-paper-dim',
  bright: 'text-paper',
  signal: 'text-signal',
};

/**
 * The workhorse label: small monospace, all caps, letterspaced.
 * Used for every piece of metadata on the site.
 */
export function TelemetryLabel({
  children,
  tone = 'dim',
  size = 'sm',
  as: Tag = 'span',
  id,
  className,
}: {
  children: ReactNode;
  tone?: TelemetryTone;
  size?: TelemetrySize;
  as?: ElementType;
  /** Anchor / aria target, e.g. when a label names a region. */
  id?: string;
  className?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        'font-mono uppercase',
        size === 'sm'
          ? 'text-[0.6875rem] leading-[1.4] tracking-[0.14em]'
          : 'text-[0.625rem] leading-[1.4] tracking-[0.16em]',
        TONE[tone],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
