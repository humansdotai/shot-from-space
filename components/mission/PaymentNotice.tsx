'use client';

/**
 * PAYMENT NOTICE — the strip above an UNPAID mission file.
 *
 * A mission exists from the moment the order opens; payment settles on
 * Stripe's hosted page. If the buyer backed out, or the session expired,
 * they land here (from the keyed short link or Stripe's cancel URL) and can
 * reopen payment for the same mission at the same price.
 */
import { useState } from 'react';
import { formatPrice } from '@/lib/pricing';
import type { Currency } from '@/lib/types';

export function PaymentNotice({
  code,
  amountMinor,
  currency,
  shareToken,
  shortLink,
}: {
  code: string;
  amountMinor: number;
  currency: Currency;
  shareToken: string | null;
  shortLink: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reopen() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/missions/${code}/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ k: shareToken ?? undefined }),
      });
      const body = (await res.json()) as { url?: string; detail?: string; error?: string };
      if (!res.ok || !body.url) {
        setError(body.detail || body.error || `Checkout could not be opened (status ${res.status}).`);
        setBusy(false);
        return;
      }
      window.location.assign(body.url);
    } catch {
      setError('Uplink unavailable. Check the connection and retry.');
      setBusy(false);
    }
  }

  return (
    <section
      role="status"
      aria-live="polite"
      style={{
        background: 'var(--color-signal, #ff4d1f)',
        color: '#0b0b0b',
        padding: '14px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '12px 24px',
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        fontSize: 13,
        letterSpacing: '0.04em',
      }}
    >
      <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>
        Payment not completed · Mission {code} · {formatPrice(amountMinor, currency)}
      </span>
      <span style={{ opacity: 0.85 }}>
        Your link: <strong>{shortLink}</strong> — keep it to retry payment or follow progress.
      </span>
      <button
        type="button"
        onClick={reopen}
        disabled={busy}
        style={{
          marginLeft: 'auto',
          background: '#0b0b0b',
          color: '#fff',
          border: 0,
          padding: '10px 16px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? 'Opening checkout…' : 'Complete payment →'}
      </button>
      {error ? <span style={{ flexBasis: '100%', fontWeight: 600 }}>{error}</span> : null}
    </section>
  );
}
