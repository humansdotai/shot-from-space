import { cn } from '@/lib/utils';

const SIZE = {
  sm: { label: 'text-[0.625rem] tracking-[0.16em]', code: 'text-[0.8125rem] tracking-[0.08em]' },
  md: { label: 'text-[0.6875rem] tracking-[0.14em]', code: 'text-[clamp(1rem,0.95rem_+_0.35vw,1.125rem)] tracking-[0.06em]' },
  lg: { label: 'text-[0.6875rem] tracking-[0.14em]', code: 'text-[clamp(1.25rem,1.05rem_+_0.9vw,1.5rem)] tracking-[0.05em]' },
} as const;

/**
 * `MISSION / 32BF` — the identity of an order. Never a logo, always a record.
 */
export function MissionCode({
  code,
  size = 'md',
  tone = 'paper',
  className,
}: {
  code: string;
  size?: keyof typeof SIZE;
  tone?: 'paper' | 'signal';
  className?: string;
}) {
  const s = SIZE[size];
  return (
    <span className={cn('inline-flex items-baseline gap-2 font-mono uppercase', className)}>
      <span className={cn('text-paper-faint', s.label)}>MISSION</span>
      <span className={cn('text-paper-faint', s.label)}>/</span>
      <span data-telemetry className={cn(s.code, tone === 'signal' ? 'text-signal' : 'text-paper')}>
        {code.toUpperCase()}
      </span>
    </span>
  );
}
