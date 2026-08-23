import { cn } from '@/lib/utils';

/** 1px hairline rule. The only divider in the system. */
export function Rule({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'soft' }) {
  return (
    <hr
      className={cn('border-0 border-t', tone === 'soft' ? 'border-hairline-soft' : 'border-hairline', className)}
    />
  );
}
