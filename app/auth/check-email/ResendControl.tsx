'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/fui';
import { MockLinkBlock } from '../MockLinkBlock';

const COOLDOWN_SECONDS = 30;

/**
 * Resend, with a 30-second lockout so the mailbox is never flooded and the
 * per-address limit is never burned by accident. The control states its own
 * countdown rather than going quietly dead.
 */
export function ResendControl({ email, next }: { email: string; next: string | null }) {
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function resend() {
    if (cooldown > 0 || status === 'sending') return;
    setStatus('sending');
    setMessage(null);
    setDevLink(null);

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, redirectTo: next ?? undefined }),
      });
      const data: { devLink?: string; detail?: string } = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus('error');
        setMessage(data.detail ?? 'The link could not be reissued. Try again shortly.');
        return;
      }

      setStatus('sent');
      setCooldown(COOLDOWN_SECONDS);
      if (data.devLink) setDevLink(data.devLink);
    } catch {
      setStatus('error');
      setMessage('The network dropped before the request landed. Try again.');
    }
  }

  return (
    <div className="mt-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={resend}
          disabled={cooldown > 0}
          loading={status === 'sending'}
          className="w-full sm:w-auto"
        >
          {status === 'sending' ? 'Transmitting' : 'Resend link'}
        </Button>
        <p className="text-label uppercase text-[color:var(--ink-dim)]">
          {cooldown > 0 ? `Available in ${String(cooldown).padStart(2, '0')}s` : 'Available now'}
        </p>
      </div>

      {status === 'sent' ? (
        <p className="mt-5 max-w-[var(--measure)] text-body text-[color:var(--ink-dim)]">
          Reissued. Any earlier link is now dead — use the newest one.
        </p>
      ) : null}

      {status === 'error' && message ? (
        <div
          role="alert"
          className="mt-6 rounded-[6px] border border-l-2 border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_6%,transparent)] px-4 py-4"
        >
          <p className="text-label uppercase text-[color:var(--accent)]">Request refused</p>
          <p className="mt-2 max-w-[var(--measure)] text-body text-[color:var(--ink-dim)]">{message}</p>
        </div>
      ) : null}

      {devLink ? (
        <div className="mt-6">
          <MockLinkBlock href={devLink} />
        </div>
      ) : null}
    </div>
  );
}
