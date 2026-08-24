'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/fui';
import { missionShortLink, normalizeMissionCode } from '@/lib/codes';
import { cn } from '@/lib/utils';

/**
 * Mission code lookup.
 *
 * This is how a customer reaches their own file: the code printed on their
 * confirmation opens `/m/{code}`. Deliberately quiet — one field on one rule,
 * not a search bar. Validation happens locally against the code pattern;
 * whether the mission exists is Mission Control's answer to give.
 *
 * The field itself is monospace because a mission code *is* telemetry. The
 * label, the button and the failure message are not, and are set in the sans
 * roles like everything else on the page.
 */
export function MissionLookup({ className }: { className?: string }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const preview = normalizeMissionCode(value);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = normalizeMissionCode(value);
    if (!code) {
      setError(
        value.trim().length === 0
          ? 'No code entered. The mission code is on your confirmation — two digits, two letters.'
          : 'Code not recognised. Mission codes are two digits followed by two letters, like 32BF.',
      );
      return;
    }
    setError(null);
    router.push(`/m/${code}`);
  }

  return (
    <form onSubmit={onSubmit} className={cn('flex flex-col gap-4', className)} noValidate>
      <label htmlFor={id} className="text-label uppercase ink-dim">
        Mission code
      </label>

      <div className="flex flex-col gap-4 min-[768px]:flex-row min-[768px]:items-end">
        <input
          id={id}
          name="code"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.toUpperCase().slice(0, 5));
            if (error) setError(null);
          }}
          placeholder="32BF"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          data-telemetry
          className={cn(
            'min-h-13 w-full border-b bg-transparent pb-1 font-mono text-[1.25rem] uppercase tracking-[0.24em] ink transition-house placeholder:[color:var(--ink-faint)] focus:outline-none min-[768px]:w-56 min-[1920px]:w-64',
            error ? 'border-[var(--accent)]' : 'rule-ground hover:[border-color:var(--rule-strong)] focus:[border-color:var(--ink)]',
          )}
        />
        <Button type="submit" variant="primary" size="lg">
          Open file
        </Button>
      </div>

      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="max-w-[46ch] border-l-2 pl-3 text-body text-[var(--accent)] [border-color:var(--accent)]"
        >
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-body ink-dim">
          {preview ? (
            <>
              Resolves to{' '}
              <span className="font-mono tracking-[0.06em]">{missionShortLink(preview)}</span>
            </>
          ) : (
            'Two digits and two letters. It is on your confirmation and printed on the finished work.'
          )}
        </p>
      )}
    </form>
  );
}
