'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx as cn } from 'clsx';
import type { GeoSuggestion } from '@/lib/types';
import { INK_DIM, QUIET_BUTTON } from './fields';

/**
 * BROWSER GEOLOCATION → A LOCKED TARGET.
 *
 * This file holds two things: the behaviour (`useBrowserLocation`) and the
 * purchase flow's own block-level presentation of it (`<UseMyLocation />`).
 * The behaviour was extracted because the landing page's address field needs
 * exactly the same capability rendered as a compact control INSIDE the input
 * — see `components/landing/MissionEntry.tsx`. One implementation, two
 * presentations; the two hard-won fixes below can only be got wrong once.
 *
 * Two things make this different from a normal geolocation button.
 *
 * First, the permission prompt is the browser's, and we cannot style it, delay
 * it or ask twice. So the control says what it is about to do *before* it is
 * pressed: on a product that photographs the buyer's home, springing an
 * OS-level location prompt with no warning is the wrong order of events.
 *
 * Second, a fix is coordinates, not an address, and this flow needs a postal
 * address because the print ships to it. The fix therefore goes to
 * POST /api/geocode/reverse (the adapter holds the live key and must stay
 * server-side) and only locks the target if a real address comes back. A fix
 * in open water resolves to nothing, which is a normal answer, not an error.
 */

export type LocationPhase = 'idle' | 'locating' | 'resolving' | 'error';

const TIMEOUT_MS = 12_000;

export type BrowserLocation = {
  /**
   * Whether the capability exists AT ALL on this device and origin. Decided
   * on the client after mount, so server and client markup agree — and false
   * means the caller must render nothing, because a control that can never
   * work is worse than no control.
   */
  supported: boolean;
  phase: LocationPhase;
  /** Set only in the `error` phase. Plain, final, never a nag. */
  message: string | null;
  /** `locating` or `resolving`. */
  busy: boolean;
  /** Call from a real user gesture. Geolocation requires one. */
  request: () => void;
};

/**
 * The behaviour. `onResolved` fires once, with a real reverse-geocoded
 * address, and never with a bare coordinate pair.
 */
export function useBrowserLocation(
  onResolved: (s: GeoSuggestion) => void,
): BrowserLocation {
  const [phase, setPhase] = useState<LocationPhase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    // Re-arm on every mount. React StrictMode runs effects mount -> unmount ->
    // mount in development, so the cleanup below fires once before the real
    // mount. Without this line the ref stays false for the component's whole
    // life and every geolocation callback returns early at its guard — the
    // button spins forever and never reports anything.
    aliveRef.current = true;

    // Geolocation only exists in a secure context. Rendering a button that can
    // never work is worse than not offering it, so this is decided on the
    // client after mount — and it means server and client markup agree.
    setSupported(
      typeof navigator !== 'undefined' &&
        'geolocation' in navigator &&
        window.isSecureContext,
    );
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const request = useCallback(() => {
    setMessage(null);
    setPhase('locating');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (!aliveRef.current) return;
        setPhase('resolving');
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        try {
          const res = await fetch('/api/geocode/reverse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
            }),
            signal: ac.signal,
          });
          if (!aliveRef.current) return;
          if (!res.ok) throw new Error(String(res.status));
          const data = (await res.json()) as { suggestion: GeoSuggestion | null };
          if (!aliveRef.current) return;
          if (!data.suggestion) {
            setPhase('error');
            setMessage('No street address at that fix. Type the address instead.');
            return;
          }
          setPhase('idle');
          onResolved(data.suggestion);
        } catch (err) {
          if (!aliveRef.current || (err instanceof DOMException && err.name === 'AbortError')) return;
          setPhase('error');
          setMessage('The address index did not answer. Type the address instead.');
        }
      },
      (err) => {
        if (!aliveRef.current) return;
        setPhase('error');
        // Denial is a decision, not a fault — say so without nagging, and do
        // not offer to ask again, because the browser will not re-prompt.
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? 'Location is off for this site. Type the address instead.'
            : err.code === err.TIMEOUT
              ? 'That took too long. Type the address instead.'
              : 'No fix from this device. Type the address instead.',
        );
      },
      // enableHighAccuracy is deliberately OFF. We need a street address, not a
      // metre-level fix — and a high-accuracy request waits on GPS, which can
      // hang indefinitely indoors and on any device without one. A coarse fix
      // reverse-geocodes to the right street, and the next screen shows the
      // capture area over it so the buyer confirms what will be photographed
      // before anything is tasked.
      { enableHighAccuracy: false, timeout: TIMEOUT_MS, maximumAge: 60_000 },
    );
  }, [onResolved]);

  return {
    supported,
    phase,
    message,
    busy: phase === 'locating' || phase === 'resolving',
    request,
  };
}

/**
 * "Use my location" — the purchase flow's block-level presentation: an
 * underlined quiet button, the sentence that warns what pressing it does, and
 * a live region for the answer.
 */
export function UseMyLocation({
  onResolved,
  className,
}: {
  onResolved: (s: GeoSuggestion) => void;
  className?: string;
}) {
  const { supported, phase, message, busy, request } = useBrowserLocation(onResolved);

  if (!supported) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={request}
        disabled={busy}
        aria-describedby="use-location-note"
        className={cn(QUIET_BUTTON, busy && 'opacity-60')}
      >
        {phase === 'locating'
          ? 'Asking your browser…'
          : phase === 'resolving'
            ? 'Finding the address…'
            : 'Use my location'}
      </button>

      <p id="use-location-note" className={cn('pt-2 text-body', INK_DIM)}>
        Your browser will ask first. The fix becomes a street address and is used
        to aim the satellite and ship the print — nothing else.
      </p>

      <p role="status" aria-live="polite" className={cn('pt-2 text-body', INK_DIM)}>
        {message ?? ''}
      </p>
    </div>
  );
}
