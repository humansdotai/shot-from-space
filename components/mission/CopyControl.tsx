'use client';

import { clsx as cn } from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/fui';

type Result = 'idle' | 'copied' | 'failed';

/**
 * Copy-to-clipboard with a designed confirmation: the label swaps to the
 * confirmed state for three seconds, then returns. No toast, no icon set.
 */
export function CopyControl({
  value,
  label,
  copiedLabel = 'Copied',
  ariaLabel,
  variant = 'ghost',
  size = 'md',
  className,
}: {
  value: string;
  label: string;
  copiedLabel?: string;
  ariaLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
  className?: string;
}) {
  const [result, setResult] = useState<Result>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setResult('copied');
    } catch {
      setResult('failed');
    }
    timer.current = setTimeout(() => setResult('idle'), 3000);
  }

  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <Button
        variant={variant}
        size={size}
        onClick={copy}
        aria-label={ariaLabel ?? label}
        className={result === 'copied' ? 'text-[color:var(--accent)]' : undefined}
      >
        {result === 'copied' ? copiedLabel : label}
      </Button>
      <span aria-live="polite" className="sr-only">
        {result === 'copied' ? 'Copied to clipboard' : result === 'failed' ? 'Copy unavailable' : ''}
      </span>
      {result === 'failed' ? (
        <span className="text-label uppercase text-[color:var(--accent)]">
          Clipboard blocked — copy manually
        </span>
      ) : null}
    </span>
  );
}
