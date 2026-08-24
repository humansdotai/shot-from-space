'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/fui';
import { FieldLabel, INPUT_CLASS } from '@/components/purchase/fields';
import { MockLinkBlock } from '../MockLinkBlock';

type Status = 'idle' | 'sending' | 'sent' | 'error';

/**
 * The whole of sign-in: one field, one control.
 *
 * The field is the same 56px, 16px control the purchase flow uses — an
 * account screen is not a place to invent a second input.
 *
 * In mock mode the API returns the link itself, so the form holds position
 * and renders it. With a mail provider configured the form hands off to
 * /auth/check-email, which owns the resend.
 */
export function SignInForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;

    setStatus('sending');
    setMessage(null);
    setDevLink(null);

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, redirectTo: next ?? undefined }),
      });
      const data: { ok?: boolean; devLink?: string; detail?: string } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setStatus('error');
        setMessage(data.detail ?? 'The link could not be issued. Try again.');
        return;
      }

      if (data.devLink) {
        setDevLink(data.devLink);
        setStatus('sent');
        return;
      }

      const params = new URLSearchParams({ email });
      if (next) params.set('next', next);
      router.push(`/auth/check-email?${params.toString()}`);
    } catch {
      setStatus('error');
      setMessage('The network dropped before the request landed. Try again.');
    }
  }

  const sending = status === 'sending';

  return (
    <div>
      <form onSubmit={onSubmit} noValidate>
        <FieldLabel htmlFor="email" hint="Required">
          Email address on the order
        </FieldLabel>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="operator@shotfromspace.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={sending}
          className={INPUT_CLASS}
        />

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" loading={sending} className="w-full sm:w-auto">
            {sending ? 'Transmitting' : 'Send the link'}
          </Button>
          <p className="text-label uppercase text-[color:var(--ink-dim)]">
            Link expires in 15 min
          </p>
        </div>
      </form>

      {status === 'error' && message ? (
        <div
          role="alert"
          className="mt-8 rounded-[6px] border border-l-2 border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_6%,transparent)] px-4 py-4"
        >
          <p className="text-label uppercase text-[color:var(--accent)]">Request refused</p>
          <p className="mt-2 max-w-[var(--measure)] text-body text-[color:var(--ink-dim)]">{message}</p>
        </div>
      ) : null}

      {status === 'sent' && devLink ? (
        <div className="mt-10 flex flex-col gap-5 border-t border-[color:var(--rule)] pt-8">
          <div>
            <p className="text-label uppercase text-[color:var(--ink-dim)]">Transmission sent</p>
            <p className="mt-3 max-w-[var(--measure)] text-body text-[color:var(--ink-dim)]">
              The link was issued to{' '}
              <span className="text-action text-[color:var(--ink)]">{email}</span>
              . The file opens the moment it is used.
            </p>
          </div>
          <MockLinkBlock href={devLink} />
        </div>
      ) : null}
    </div>
  );
}
